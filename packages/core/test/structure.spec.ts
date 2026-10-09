import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { evaluateAt } from "../src/temporal/evaluate.js";
import { assignWeights } from "../src/weights/assign.js";
import { applyStructure, slotsOf } from "../src/structure/apply.js";
import { detectHe, detectClash, detectXing } from "../src/structure/detect.js";
import { chongDistanceCoef, heDistanceCoef, pillarGap } from "../src/structure/distance.js";
import { arbitrate } from "../src/structure/arbitrate.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { loadParams } from "../src/params/load.js";
import type { Carrier } from "../src/weights/carrier.js";
import type { BirthInput } from "../src/chart/types.js";

const P = DEFAULT_PARAMS.structure;

/** 深拷贝载体，使每个用例互不污染。 */
function fresh(input: BirthInput, params = DEFAULT_PARAMS) {
  const chart = buildChart(input);
  const w = assignWeights({ chart, params });
  const carriers: Carrier[] = w.carriers.map((c) => ({ ...c, flags: [...c.flags], trace: [...c.trace] }));
  return { chart, before: w.totals.grand, carriers, params };
}

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};

describe("**察与改是两个开关，不是一个**", () => {
  const CH = buildChart({
    year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
  });
  const ON = loadParams({ structure: { rewriteCarriers: true } });
  const OFF = loadParams({ structure: { rewriteCarriers: false } });

  it("关掉「改」，事件一条不少 —— 否则神煞、应期、节点会悄悄失效", () => {
    const a = buildBaseChart(CH, ON);
    const b = buildBaseChart(CH, OFF);
    expect(b.events.length).toBeGreaterThan(0);
    const sig = (x: typeof a) => x.events.map(
      (e) => `${e.kind}/${e.outcome}/${e.pillars.join("-")}/${e.narrativeTag}`);
    expect(sig(b)).toEqual(sig(a));
  });

  it("关掉「改」，载体权重确实不动了 —— 反向对照，否则上一条可能只是开关没接上", () => {
    const a = buildBaseChart(CH, ON);
    const b = buildBaseChart(CH, OFF);
    const l2Of = (x: typeof a) => x.carriers.some((c) => c.trace.some((t) => t.layer === "L2"));
    expect(l2Of(a), "开着却没有一条 L2 痕迹").toBe(true);
    expect(l2Of(b), "关了却仍有 L2 痕迹").toBe(false);
  });

  it("**两条路径共用同一个开关** —— 基础盘与时点盘不允许各走各的", () => {
    for (const p of [ON, OFF]) {
      const base = buildBaseChart(CH, p);
      // 空时点 = 不加大运流年，故事件应与基础盘逐条相同
      const at = evaluateAt(base);
      expect(at.events.length, "时点盘的事件数与基础盘不符").toBe(base.events.length);
    }
  });
});

describe("工作例 庚午 辛巳 丁丑 丁未 的结构", () => {
  const f = fresh(EXAMPLE);
  const r = applyStructure(f.carriers, f.chart.month.branch, f.params);
  const kinds = r.events.map((e) => `${e.kind}:${e.outcome}`);
  const find = (k: string) => r.events.filter((e) => e.kind === k);

  it("巳午未 三会南方火局", () => {
    const sh = find("sanhui");
    expect(sh).toHaveLength(1);
    expect(new Set(sh[0]!.branches)).toEqual(new Set(["巳", "午", "未"]));
    expect(sh[0]!.transformedTo).toBe("火");
  });

  it("巳丑缺旺神酉 —— 只成拱，不成半合", () => {
    // 旺神是三合的必要条件。这条若错，会把大量「拱」误判为半合而虚增局气
    expect(find("banhe")).toHaveLength(0);
    const gong = find("gong");
    expect(gong).toHaveLength(1);
    expect(new Set(gong[0]!.branches)).toEqual(new Set(["巳", "丑"]));
    expect(gong[0]!.transformedTo).toBe("金");
  });

  it("丑未相冲，双库皆开", () => {
    expect(find("chong")).toHaveLength(1);
    const opened = find("tombOpen");
    expect(opened).toHaveLength(2);
    expect(new Set(opened.flatMap((e) => e.branches ?? []))).toEqual(new Set(["丑", "未"]));
  });

  it("午未六合被会局夺去 —— 范围大者优先", () => {
    const lh = find("liuhe");
    expect(lh).toHaveLength(1);
    expect(lh[0]!.outcome).toBe("neutralized");
    expect(lh[0]!.narrativeTag).toBe("会局夺合");
    expect(Object.keys(lh[0]!.weightDelta)).toHaveLength(0);
  });

  it("丑未只见两支的恃势之刑 —— 有刑意无刑局", () => {
    const x = find("xing");
    expect(x).toHaveLength(1);
    expect(x[0]!.outcome).toBe("partial");
    expect(x[0]!.narrativeTag).toBe("恃势之刑");
  });

  it("午丑六害", () => {
    expect(find("hai")).toHaveLength(1);
  });

  it("结构层净减权重 —— 战克交加者内耗", () => {
    const after = r.carriers.reduce((a, c) => a + c.weight, 0);
    expect(after).toBeLessThan(f.before);
    expect(after / f.before).toBeGreaterThan(0.8);
    expect(kinds.length).toBeGreaterThanOrEqual(7);
  });
});

describe("L2 不变量（docs/04-structure.md §13）", () => {
  const f = fresh(EXAMPLE);
  const r = applyStructure(f.carriers, f.chart.month.branch, f.params);

  it("① activity ∈ [0,1]，只减不增", () => {
    for (const c of r.carriers) {
      expect(c.activity, c.id).toBeGreaterThanOrEqual(0);
      expect(c.activity, c.id).toBeLessThanOrEqual(1);
    }
  });

  it("② 合化后参与载体的五行一致且等于化神", () => {
    for (const e of r.events) {
      if (e.outcome !== "transformed") continue;
      const parts = r.carriers.filter((c) => e.participants.includes(c.id));
      for (const c of parts) expect(c.element, c.id).toBe(e.transformedTo);
    }
  });

  it("③ 任一载体最多参与一次成功合化", () => {
    for (const c of r.carriers) {
      expect(c.flags.filter((x) => x === "TRANSFORMED").length, c.id).toBeLessThanOrEqual(1);
    }
  });

  it("④ 全部事件的 weightDelta 之和 == 实际权重变化总量（审计闭合）", () => {
    const declared = r.events.reduce(
      (a, e) => a + Object.values(e.weightDelta).reduce((x, y) => x + y, 0), 0);
    const actual = r.carriers.reduce((a, c) => a + c.weight, 0) - f.before;
    expect(Math.abs(declared - actual)).toBeLessThan(1e-9);
  });

  it("④′ 逐载体也闭合", () => {
    const orig = new Map(assignWeights({ chart: f.chart }).carriers.map((c) => [c.id, c.weight]));
    for (const c of r.carriers) {
      const declared = r.events.reduce((a, e) => a + (e.weightDelta[c.id] ?? 0), 0);
      expect(Math.abs((orig.get(c.id) ?? 0) + declared - c.weight), c.id).toBeLessThan(1e-9);
    }
  });

  it("⑤ 凡经互解裁决者必须留下 strengthScores", () => {
    // 这条最初只查 broken，漏掉了 neutralized —— 而「合解冲」恰是更需要解释的一半：
    // 「你这盘巳亥看似相冲，实际被寅亥合解住了」，没有依据就答不了。
    // 由 arbitrationCoverage 一组用例保证此断言不是空转。
    for (const e of r.events) {
      const viaArbitration = e.outcome === "broken" || e.narrativeTag === "合解冲";
      if (viaArbitration) {
        expect(e.strengthScores, `${e.kind}:${e.outcome} 经裁决却无依据`).toBeDefined();
      }
      if (e.outcome === "bound" || e.outcome === "contested"
          || e.outcome === "broken" || e.outcome === "neutralized") {
        expect(e.note, `${e.kind}:${e.outcome} 未说明原因`).toBeTruthy();
      }
    }
  });

  it("⑥ 三合缺旺神必判为 gong，绝不判为 banhe", () => {
    const { branches, stems } = slotsOf(f.carriers);
    for (const h of detectHe(branches, stems)) {
      if (h.kind !== "banhe" && h.kind !== "gong") continue;
      const hasWang = h.slots.some((s) => (["子", "午", "卯", "酉"] as string[]).includes(s.branch));
      expect(h.kind === "banhe", `${h.slots.map((s) => s.branch).join("")}`).toBe(hasWang);
    }
  });

  it("权重非负，且 trace 逐条闭合", () => {
    for (const c of r.carriers) {
      expect(c.weight).toBeGreaterThanOrEqual(0);
      expect(c.trace.at(-1)!.to).toBeCloseTo(c.weight, 9);
      for (let i = 1; i < c.trace.length; i++) {
        expect(c.trace[i]!.from, `${c.id} trace 断链`).toBeCloseTo(c.trace[i - 1]!.to, 9);
      }
    }
  });
});

describe("互解裁决的实证覆盖", () => {
  /**
   * 上面那条不变量是条件断言 —— 若样本里根本没有走到裁决的盘，它会空转通过。
   * 这一组用真实命例把两条裁决路径都打到，确保断言有咬合力。
   */
  const cases: { input: BirthInput; pillars: string; expectTag: string }[] = [
    {
      input: { year: 1980, month: 2, day: 20, hour: 10, minute: 30,
        gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47 },
      pillars: "庚申 戊寅 癸亥 丁巳", expectTag: "合而不化",
    },
    {
      input: { year: 1983, month: 2, day: 20, hour: 10, minute: 30,
        gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47 },
      pillars: "癸亥 甲寅 己卯 己巳", expectTag: "合解冲",
    },
  ];

  it("冲破合：巳申看似合水，实为寅申冲破 —— 事件带裁决分", () => {
    const f = fresh(cases[0]!.input);
    const r = applyStructure(f.carriers, f.chart.month.branch, f.params);
    const broken = r.events.filter((e) => e.outcome === "broken");
    expect(broken.length).toBeGreaterThan(0);
    for (const e of broken) {
      expect(e.strengthScores).toBeDefined();
      expect(e.strengthScores!.chong).toBeGreaterThan(e.strengthScores!.he);
      expect(e.note).toContain("C4");
    }
  });

  it("合解冲：巳亥之冲被寅亥合解 —— 事件同样带裁决分与说明", () => {
    const f = fresh(cases[1]!.input);
    const r = applyStructure(f.carriers, f.chart.month.branch, f.params);
    const neut = r.events.filter((e) => e.narrativeTag === "合解冲");
    expect(neut.length).toBeGreaterThan(0);
    for (const e of neut) {
      expect(e.strengthScores, "合解冲必须带依据").toBeDefined();
      expect(e.strengthScores!.he).toBeGreaterThan(e.strengthScores!.chong);
      expect(e.note).toMatch(/合力 .* 胜冲力/);
      expect(Object.keys(e.weightDelta), "被解的冲不应改动权重").toHaveLength(0);
    }
  });

  it("两条裁决路径互斥：同一个冲不会既被解又生效", () => {
    for (const c of cases) {
      const f = fresh(c.input);
      const r = applyStructure(f.carriers, f.chart.month.branch, f.params);
      const chongs = r.events.filter((e) => e.kind === "chong");
      const key = (e: typeof chongs[number]) => (e.branches ?? []).join("");
      const seen = new Map<string, string>();
      for (const e of chongs) {
        const k = key(e);
        expect(seen.has(k), `${c.pillars} 的 ${k} 冲出现两次`).toBe(false);
        seen.set(k, e.outcome);
      }
    }
  });
});

describe("检测的正确性", () => {
  const slots = (bs: string[]) => bs.map((b, i) => ({
    pillar: (["year", "month", "day", "hour"] as const)[i]!,
    branch: b as never, carriers: [], weight: 100,
  }));

  it("申子辰成水局；缺子则只成拱", () => {
    const full = detectHe(slots(["申", "子", "辰"]), []);
    expect(full.filter((h) => h.kind === "sanhe")).toHaveLength(1);
    expect(full.find((h) => h.kind === "sanhe")!.element).toBe("水");

    const noWang = detectHe(slots(["申", "辰"]), []);
    expect(noWang.filter((h) => h.kind === "banhe")).toHaveLength(0);
    expect(noWang.filter((h) => h.kind === "gong")).toHaveLength(1);
  });

  it("生+旺 与 旺+墓 皆为半合，力度不同", () => {
    expect(detectHe(slots(["申", "子"]), []).find((h) => h.kind === "banhe")!.banheKind)
      .toBe("shengWang");
    expect(detectHe(slots(["子", "辰"]), []).find((h) => h.kind === "banhe")!.banheKind)
      .toBe("wangMu");
    expect(P.banhe.shengWang.gain).toBeGreaterThan(P.banhe.wangMu.gain);
  });

  it("寅卯辰三会东方木", () => {
    const h = detectHe(slots(["寅", "卯", "辰"]), []).find((x) => x.kind === "sanhui");
    expect(h?.element).toBe("木");
  });

  it("寅巳申三支全见方成无恩之刑；两支为 partial", () => {
    expect(detectXing(slots(["寅", "巳", "申"])).find((x) => x.punishment === "无恩之刑")?.complete).toBe(true);
    expect(detectXing(slots(["寅", "巳"])).find((x) => x.punishment === "无恩之刑")?.complete).toBe(false);
  });

  it("子卯二支即成无礼之刑", () => {
    expect(detectXing(slots(["子", "卯"])).find((x) => x.punishment === "无礼之刑")?.complete).toBe(true);
  });

  it("同支重见成自刑", () => {
    expect(detectXing(slots(["辰", "辰"])).filter((x) => x.punishment === "自刑")).toHaveLength(1);
    expect(detectXing(slots(["辰", "戌"])).filter((x) => x.punishment === "自刑")).toHaveLength(0);
  });

  it("冲害破各自检出", () => {
    const c = detectClash(slots(["子", "午"]), []);
    expect(c.map((x) => x.kind)).toContain("chong");
    expect(detectClash(slots(["子", "未"]), []).map((x) => x.kind)).toContain("hai");
    expect(detectClash(slots(["子", "酉"]), []).map((x) => x.kind)).toContain("po");
  });
});

describe("距离", () => {
  it("本命柱序 年0 月1 日2 时3", () => {
    expect(pillarGap("year", "hour")).toBe(3);
    expect(pillarGap("month", "day")).toBe(1);
    expect(pillarGap("luck", "year")).toBeNull();
  });

  it("远冲力弱 —— 年与时之间只留三成", () => {
    expect(chongDistanceCoef("day", "hour", P.chong.distance)).toBe(1.0);
    expect(chongDistanceCoef("year", "day", P.chong.distance)).toBe(0.6);
    expect(chongDistanceCoef("year", "hour", P.chong.distance)).toBe(0.3);
  });

  it("外部层用独立系数，且大运强于流年", () => {
    expect(chongDistanceCoef("luck", "day", P.chong.distance)).toBe(0.9);
    expect(chongDistanceCoef("annual", "day", P.chong.distance)).toBe(0.85);
    expect(chongDistanceCoef("luck", "annual", P.chong.distance)).toBe(1.0);
  });

  it("合局取两两距离的最小者 —— 最弱一环决定成色", () => {
    expect(heDistanceCoef(["year", "month"], P.heDistance, 1)).toBe(1.0);
    expect(heDistanceCoef(["year", "month", "hour"], P.heDistance, 1)).toBe(0.6);
  });

  it("含大运流年者再乘外部系数", () => {
    expect(heDistanceCoef(["day", "annual"], P.heDistance, P.externalHeFactor))
      .toBeCloseTo(0.9, 9);
  });
});

describe("互解裁决", () => {
  it("合力显著大于冲力则合胜", () => {
    expect(arbitrate(100, 50, P).verdict).toBe("heWins");
  });
  it("冲力显著大于合力则冲胜", () => {
    expect(arbitrate(50, 100, P).verdict).toBe("chongWins");
  });
  it("势均力敌则两败", () => {
    expect(arbitrate(100, 95, P).verdict).toBe("mutual");
    expect(arbitrate(100, 110, P).verdict).toBe("mutual");
  });
  it("裁决门槛即 decisiveMargin", () => {
    expect(P.arbitration.decisiveMargin).toBe(1.20);
    expect(arbitrate(100, 100 / 1.19, P).verdict).toBe("mutual");
    expect(arbitrate(100, 100 / 1.21, P).verdict).toBe("heWins");
  });
});

describe("墓库", () => {
  it("闭库时中气余气打折，本气不受影响", () => {
    // 戌为火库：本气戊土是墙本身，辛丁才是库里的东西
    const f = fresh({ ...EXAMPLE, year: 1994, month: 11, day: 8, hour: 10, minute: 0 });
    const before = new Map(f.carriers.map((c) => [c.id, c.weight]));
    const r = applyStructure(f.carriers, f.chart.month.branch, f.params);
    for (const c of r.carriers) {
      if (!c.flags.includes("TOMB_SEALED")) continue;
      expect(c.position.hiddenIndex, "本气不应被封").not.toBe(0);
      expect(c.weight).toBeLessThan(before.get(c.id)!);
    }
  });

  it("闭库与开库的系数一进一出", () => {
    expect(P.tomb.sealedFactor).toBeLessThan(1);
    expect(P.tomb.releaseGain).toBeGreaterThan(1);
  });
});

describe("参数可调", () => {
  it("关闭六破则不再产生破事件", () => {
    const f = fresh(EXAMPLE, loadParams({ structure: { po: { enabled: false } } }));
    const r = applyStructure(f.carriers, f.chart.month.branch, f.params);
    expect(r.events.filter((e) => e.kind === "po")).toHaveLength(0);
  });

  it("提高 uprootThreshold 可让原本拔根的冲降级为普通冲", () => {
    const lo = fresh(EXAMPLE, loadParams({ structure: { chong: { uprootThreshold: 1.05 } } }));
    const rl = applyStructure(lo.carriers, lo.chart.month.branch, lo.params);
    const tag = rl.events.find((e) => e.kind === "chong" && e.outcome === "applied")!.narrativeTag;
    expect(tag).toBe("冲而拔根");

    const hi = fresh(EXAMPLE);
    const rh = applyStructure(hi.carriers, hi.chart.month.branch, hi.params);
    expect(rh.events.find((e) => e.kind === "chong" && e.outcome === "applied")!.narrativeTag)
      .toBe("相冲");
  });
});

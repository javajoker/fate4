import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { assignWeights, luckStemShareAt } from "../src/weights/assign.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { loadParams } from "../src/params/load.js";
import type { Pillar } from "../src/types/ganzhi.js";

const EXAMPLE = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male" as const, timeZone: "Asia/Shanghai", longitude: 121.47,
};
const chart = buildChart(EXAMPLE);
const w = assignWeights({ chart });
const sum = (f: (c: (typeof w.carriers)[number]) => boolean) =>
  w.carriers.filter(f).reduce((a, c) => a + c.weight, 0);

describe("工作例的逐柱配重", () => {
  it("载体 15 个，总量 468 = 100 + 168 + 100 + 100", () => {
    expect(w.carriers).toHaveLength(15);
    expect(w.totals.grand).toBeCloseTo(468, 9);
  });

  it("年日时三柱各 100，月柱 168（月提放大后）", () => {
    expect(w.totals.byPillar.year).toBeCloseTo(100, 9);
    expect(w.totals.byPillar.day).toBeCloseTo(100, 9);
    expect(w.totals.byPillar.hour).toBeCloseTo(100, 9);
    expect(w.totals.byPillar.month).toBeCloseTo(168, 9);
    // 月柱占本命 35.9% —— 落在传统「月令定五分」的区间内
    expect(168 / 468).toBeCloseTo(0.359, 3);
  });

  it("巳月三藏干经庚金司令加成并重归一：丙 69.33 · 庚 40.00 · 戊 10.67", () => {
    const at = (i: number) => w.carriers.find(
      (c) => c.position.pillar === "month" && c.position.layer === "branch" && c.position.hiddenIndex === i)!;
    expect(at(0).stem).toBe("丙"); expect(at(0).weight).toBeCloseTo(69.333, 2);
    expect(at(1).stem).toBe("庚"); expect(at(1).weight).toBeCloseTo(40.000, 2);
    expect(at(2).stem).toBe("戊"); expect(at(2).weight).toBeCloseTo(10.667, 2);
    expect(at(1).flags).toContain("SILING");
  });

  it("五行合计 木6 火206.33 土106.67 金134 水15", () => {
    const e = w.totals.byElement;
    expect(e["木"]).toBeCloseTo(6, 6);
    expect(e["火"]).toBeCloseTo(206.333, 2);
    expect(e["土"]).toBeCloseTo(106.667, 2);
    expect(e["金"]).toBeCloseTo(134, 6);
    expect(e["水"]).toBeCloseTo(15, 6);
  });

  it("日主与透干标记正确", () => {
    const dm = w.carriers.filter((c) => c.flags.includes("DAY_MASTER"));
    expect(dm).toHaveLength(1);
    expect(dm[0]!.stem).toBe("丁");
    expect(dm[0]!.position).toEqual({ pillar: "day", layer: "stem", hiddenIndex: null });
    // 丁己辛庚 皆有同字天干透出
    const revealed = new Set(w.carriers.filter((c) => c.flags.includes("REVEALED")).map((c) => c.stem));
    expect(revealed).toEqual(new Set(["丁", "庚", "辛"]));
  });
});

describe("L1 不变量（docs/03-weights.md §10）", () => {
  it("① 本命各柱干支之和等于基准，月柱除外", () => {
    for (const k of ["year", "day", "hour"] as const) {
      expect(w.totals.byPillar[k], k).toBeCloseTo(100, 9);
    }
  });

  it("② 司令重归一后，月支藏干之和**精确**等于 120", () => {
    // 浮点上最易出岔的一条：加成后必须严格归一，否则月支总量随司令段漂移
    const mb = sum((c) => c.position.pillar === "month" && c.position.layer === "branch");
    expect(Math.abs(mb - 120)).toBeLessThan(1e-9);
  });

  it("②′ 三个司令段给出不同的内部结构，但月支总量恒为 120", () => {
    // 同一个月支，月初与月末的力量结构不同 —— 这正是精确排盘的意义
    const seen = new Set<string>();
    for (const days of [2, 8, 20]) {
      const c2 = { ...chart, siling: { ...chart.siling, daysIntoJie: days } };
      const probe = assignWeights({
        chart: { ...c2, siling: silingAt(days) } as typeof chart,
      });
      const mb = probe.carriers.filter((c) => c.position.pillar === "month" && c.position.layer === "branch");
      expect(Math.abs(mb.reduce((a, c) => a + c.weight, 0) - 120), `距节 ${days} 日`).toBeLessThan(1e-9);
      seen.add(mb.map((c) => c.weight.toFixed(4)).join("/"));
    }
    expect(seen.size, "三段应给出三种不同的内部分配").toBe(3);
  });

  it("③ 大运干支之和恒为 130，与经年无关", () => {
    const luck: Pillar = chart.luck.pillars[0]!.pillar;
    for (const t of [0, 1, 2.5, 5, 7.5, 9.99]) {
      const r = assignWeights({ chart, luck: { pillar: luck, elapsedYears: t } });
      expect(r.totals.byPillar.luck, `t=${t}`).toBeCloseTo(130, 9);
    }
  });

  it("④ 流年干支之和恒为 110，且干支为 40:70", () => {
    const r = assignWeights({ chart, annual: { stem: "丙", branch: "午" } });
    expect(r.totals.byPillar.annual).toBeCloseTo(110, 9);
    const s = r.carriers.find((c) => c.position.pillar === "annual" && c.position.layer === "stem")!;
    expect(s.weight).toBeCloseTo(40, 9);
    expect(sum2(r.carriers, "annual", "branch")).toBeCloseTo(70, 9);
  });

  it("⑤ 所有权重非负", () => {
    for (const c of w.carriers) expect(c.weight, c.id).toBeGreaterThanOrEqual(0);
  });

  it("⑥ 载体数：本命 12–16，加大运流年后 18–24", () => {
    expect(w.carriers.length).toBeGreaterThanOrEqual(12);
    expect(w.carriers.length).toBeLessThanOrEqual(16);
    const full = assignWeights({
      chart, luck: { pillar: chart.luck.pillars[0]!.pillar, elapsedYears: 3 },
      annual: { stem: "丙", branch: "午" },
    });
    expect(full.carriers.length).toBeGreaterThanOrEqual(18);
    expect(full.carriers.length).toBeLessThanOrEqual(24);
  });

  it("⑦ 每个载体至少有一条 trace，且 trace 的终值即当前权重", () => {
    for (const c of w.carriers) {
      expect(c.trace.length, c.id).toBeGreaterThanOrEqual(1);
      expect(c.trace.at(-1)!.to, c.id).toBeCloseTo(c.weight, 12);
      expect(c.trace[0]!.layer).toBe("L1");
    }
  });

  it("载体 id 唯一", () => {
    const ids = w.carriers.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("大运干支的经年摆动", () => {
  it("0.70 → 0.30 线性，交叉点恰在第 5 年末", () => {
    expect(luckStemShareAt(0, DEFAULT_PARAMS)).toBeCloseTo(0.70, 9);
    expect(luckStemShareAt(5, DEFAULT_PARAMS)).toBeCloseTo(0.50, 9);
    expect(luckStemShareAt(10, DEFAULT_PARAMS)).toBeCloseTo(0.30, 9);
    expect(luckStemShareAt(2.5, DEFAULT_PARAMS)).toBeCloseTo(0.60, 9);
    expect(luckStemShareAt(7.5, DEFAULT_PARAMS)).toBeCloseTo(0.40, 9);
  });

  it("交运时干 91 支 39，换运前反转", () => {
    const luck = chart.luck.pillars[0]!.pillar;
    const a = assignWeights({ chart, luck: { pillar: luck, elapsedYears: 0 } });
    const b = assignWeights({ chart, luck: { pillar: luck, elapsedYears: 9.999 } });
    expect(sum2(a.carriers, "luck", "stem")).toBeCloseTo(91, 6);
    expect(sum2(a.carriers, "luck", "branch")).toBeCloseTo(39, 6);
    expect(sum2(b.carriers, "luck", "stem")).toBeCloseTo(39, 1);
    expect(sum2(b.carriers, "luck", "branch")).toBeCloseTo(91, 1);
  });

  it("阶梯模式在第 5 年整跳变", () => {
    const p = loadParams({ weights: { luck: { mode: "step" } } });
    expect(luckStemShareAt(4.99, p)).toBeCloseTo(0.65, 9);
    expect(luckStemShareAt(5.01, p)).toBeCloseTo(0.35, 9);
  });

  it("经年超出 [0,10] 时钳制，不外推", () => {
    expect(luckStemShareAt(-3, DEFAULT_PARAMS)).toBeCloseTo(0.70, 9);
    expect(luckStemShareAt(50, DEFAULT_PARAMS)).toBeCloseTo(0.30, 9);
  });
});

describe("参数变动的传导", () => {
  it("月提系数直接改变月柱占比", () => {
    const lo = assignWeights({ chart, params: loadParams({ weights: { monthCommand: { branchMultiplier: 1 } } }) });
    const hi = assignWeights({ chart, params: loadParams({ weights: { monthCommand: { branchMultiplier: 3 } } }) });
    expect(lo.totals.byPillar.month).toBeCloseTo(60 + 48, 9);
    expect(hi.totals.byPillar.month).toBeCloseTo(180 + 48, 9);
  });

  it("关闭司令表则藏干按标准比例，不加成", () => {
    const off = assignWeights({ chart, params: loadParams({ weights: { monthCommand: { useSilingTable: false } } }) });
    expect(off.context.silingApplied).toBe(false);
    const mb = off.carriers.filter((c) => c.position.pillar === "month" && c.position.layer === "branch");
    expect(mb.map((c) => c.weight)).toEqual([120 * 0.65, 120 * 0.25, 120 * 0.10]);
  });

  it("干支占比可调，且两侧此消彼长", () => {
    const p = loadParams({ weights: { stemShare: 0.3, branchShare: 0.7 } });
    const r = assignWeights({ chart, params: p });
    expect(sum2(r.carriers, "year", "stem")).toBeCloseTo(30, 9);
    expect(sum2(r.carriers, "year", "branch")).toBeCloseTo(70, 9);
    expect(r.totals.byPillar.year).toBeCloseTo(100, 9);
  });
});

describe("时辰未知", () => {
  it("少一柱就是少一柱 —— 总量降至 368，不作归一补偿", () => {
    const c = buildChart({ ...EXAMPLE, unknownHour: true });
    const r = assignWeights({ chart: c });
    expect(r.totals.byPillar.hour).toBeUndefined();
    expect(r.totals.grand).toBeCloseTo(368, 9);   // 100 + 168 + 100
    expect(r.carriers.every((x) => x.position.pillar !== "hour")).toBe(true);
  });
});

// ── 辅助 ──
function sum2(cs: readonly { position: { pillar: string; layer: string }; weight: number }[],
              pillar: string, layer: string): number {
  return cs.filter((c) => c.position.pillar === pillar && c.position.layer === layer)
    .reduce((a, c) => a + c.weight, 0);
}
function silingAt(days: number) {
  return { ...chart.siling, daysIntoJie: days,
    ...(days < 5 ? { stem: "戊" as const, segment: 0 as const, resolvedTo: "戊" as const, resolution: "exact" as const }
      : days < 14 ? { stem: "庚" as const, segment: 1 as const, resolvedTo: "庚" as const, resolution: "exact" as const }
      : { stem: "丙" as const, segment: 2 as const, resolvedTo: "丙" as const, resolution: "exact" as const }) };
}
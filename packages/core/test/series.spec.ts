import { describe, expect, it } from "vitest";
import { buildChart, chartOptionsOf } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildSeries, relationStrength } from "../src/temporal/series.js";
import { curveStats } from "../src/temporal/nodes.js";
import { evaluateAt } from "../src/temporal/evaluate.js";
import { annualPillarOf } from "../src/temporal/views.js";
import { loadParams, paramsHash, ParamsValidationError } from "../src/params/load.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import type { BirthInput } from "../src/chart/types.js";
import { BRANCHES } from "../src/types/ganzhi.js";

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const base = buildBaseChart(buildChart(EXAMPLE));
const S = buildSeries(base, { years: 20, statsYears: 20 });

describe("采样", () => {
  it("每年十二点，且立春年连续", () => {
    expect(S.samplesPerYear).toBe(12);
    expect(S.frames).toHaveLength(20 * 12);
    for (let i = 0; i < 20; i++) {
      const seg = S.frames.slice(i * 12, i * 12 + 12);
      expect(new Set(seg.map((f) => f.year)).size, "一年内的十二点年份不一致").toBe(1);
      expect(seg.map((f) => f.monthIndex)).toEqual([...Array(12).keys()]);
    }
    const years = [...new Set(S.frames.map((f) => f.year))];
    for (let i = 1; i < years.length; i++) expect(years[i]! - years[i - 1]!).toBe(1);
  });

  it("时刻单调递增，且流年柱与立春年对得上", () => {
    for (let i = 1; i < S.frames.length; i++) {
      expect(S.frames[i]!.jd).toBeGreaterThan(S.frames[i - 1]!.jd);
    }
    for (const f of S.frames) expect(f.annual).toEqual(annualPillarOf(f.year));
  });

  it("流月柱按节气月序推，不按公历月", () => {
    const first = S.frames.slice(0, 12);
    expect(first.map((f) => f.fleetingMonth.branch))
      .toEqual(["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"]);
  });

  it("大运随时点推进：同一步内 elapsedYears 单调增", () => {
    let prev: number | null = null; let prevIdx: number | null = null;
    let checked = 0;
    for (const f of S.frames) {
      // 起运在生后 8.24 年，故序列开头有若干点尚未交运 —— 那时没有大运，正确
      if (f.luckIndex !== null && f.luckIndex === prevIdx && prev !== null) {
        expect(f.elapsedYears).toBeGreaterThan(prev);
        checked++;
      }
      prev = f.elapsedYears; prevIdx = f.luckIndex;
    }
    expect(checked, "一个同步点对都没检查到，该断言在空转").toBeGreaterThan(100);
  });

  it("起运之前没有大运柱 —— 那时的盘是本命加流年", () => {
    const pre = S.frames.filter((f) => f.luckPillar === null);
    expect(pre.length, "样本从起运年起，理应有若干点尚未交运").toBeGreaterThan(0);
    for (const f of pre) expect(f.elapsedYears).toBe(0);
  });
});

describe("序列", () => {
  it("八组齐全，条数与文档一致", () => {
    const byKind = new Map<string, number>();
    for (const s of S.series) byKind.set(s.kind, (byKind.get(s.kind) ?? 0) + 1);
    expect(Object.fromEntries(byKind)).toEqual({
      tenGod: 10, element: 5, palace: 8, dayMaster: 3,
      innerOuter: 2, domain: 18, metric: 3, agitation: 6,
    });
    expect(S.series).toHaveLength(55);
  });

  it("每条长度等于采样点数，id 唯一", () => {
    for (const s of S.series) {
      expect(s.values, s.id).toHaveLength(S.frames.length);
      expect(s.deltas, s.id).toHaveLength(S.frames.length);
    }
    expect(new Set(S.series.map((s) => s.id)).size).toBe(S.series.length);
  });

  it("deltas 恒等于 values − baseValue", () => {
    for (const s of S.series) {
      for (const [i, v] of s.values.entries()) {
        expect(s.deltas[i]!, s.id).toBeCloseTo(v - s.baseValue, 9);
      }
    }
  });

  it("**z 分数对平移不变 —— 故用 values 或 deltas 检出节点结果相同**", () => {
    // 规格初稿说「节点必须跑在偏离上，因为零点有意义」，这条推理是错的。
    const z = (xs: readonly number[]) => {
      const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mu) ** 2, 0) / xs.length);
      return xs.map((x) => (sd > 0 ? (x - mu) / sd : 0));
    };
    for (const s of S.series.slice(0, 12)) {
      const zv = z(s.values); const zd = z(s.deltas);
      for (const [i, v] of zv.entries()) expect(zd[i]!, s.id).toBeCloseTo(v, 9);
    }
  });

  it("基础盘值取自基础盘本身，不是曲线首点", () => {
    const tg = S.series.find((s) => s.id === "tenGod.食神")!;
    expect(tg.baseValue).toBeCloseTo(base.conclusions.tenGods["食神"], 9);
    const el = S.series.find((s) => s.id === "element.火")!;
    expect(el.baseValue).toBeCloseTo(base.propagation.byElement["火"], 9);
  });

  it("用忌方向按本命用神定，且三档齐全", () => {
    const els = S.series.filter((s) => s.kind === "element");
    const y = base.conclusions.yongshen.value;
    for (const s of els) {
      const e = s.id.split(".")[1]!;
      const expected = [y.primary, ...y.xishen].includes(e as never) ? "favorable"
        : [...y.jishen, ...y.choushen].includes(e as never) ? "adverse" : "neutral";
      expect(s.polarity, s.id).toBe(expected);
    }
    // 域的两条量方向性不同，不可一并处理：
    // 张力是「顺逆并存」的度量，高张力既非吉也非凶 —— 定方向等于把拆开的又合回去；
    // 净值 = 顺 − 逆，符号即方向。两条都写 neutral 会让趋避一节几乎空着。
    for (const s of S.series.filter((x) => x.kind === "domain")) {
      expect(s.polarity, s.id).toBe(s.id.endsWith(".tension") ? "neutral" : "favorable");
    }
  });
});

describe("**月内确有变化，且两个来源可分**", () => {
  it("非换运年的月内极差来自大运斜坡，不为零", () => {
    const el = S.series.find((s) => s.id === "element.火")!;
    let ramp = 0; let switching = 0; let switchYears = 0;
    for (let i = 0; i + 12 <= S.frames.length; i += 12) {
      const seg = el.values.slice(i, i + 12);
      const range = Math.max(...seg) - Math.min(...seg);
      if (new Set(S.frames.slice(i, i + 12).map((f) => f.luckIndex)).size > 1) {
        switching = Math.max(switching, range); switchYears++;
      } else ramp = Math.max(ramp, range);
    }
    // 这一条正是月度采样存在的理由：年度采样会把它整个抹掉
    expect(ramp, "非换运年月内毫无变化，则月度采样没有意义").toBeGreaterThan(1);
    expect(switchYears, "样本内没有换运年，换柱那一半在空转").toBeGreaterThan(0);
    expect(switching, "换柱造成的跳变应远大于斜坡").toBeGreaterThan(ramp);
  });

  it("**流月不参与权重** —— 权重类序列在同一时点与不给流月时相同", () => {
    const f = S.frames[40]!;
    const withMonth = evaluateAt(base, {
      luck: f.luckPillar === null ? null : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
      annual: f.annual, fleetingMonth: f.fleetingMonth,
    });
    const without = evaluateAt(base, {
      luck: f.luckPillar === null ? null : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
      annual: f.annual,
    });
    for (const [i, c] of withMonth.carriers.entries()) {
      expect(c.weight, c.id).toBeCloseTo(without.carriers[i]!.weight, 12);
    }
    // 但符号层不同 —— 流月带来了自己的神煞落点
    expect(withMonth.shensha.length).toBeGreaterThanOrEqual(without.shensha.length);
  });
});

describe("扰动序列", () => {
  it("关系强度只取最强一条，不叠加", () => {
    const a = DEFAULT_PARAMS.series.agitation;
    // 子午相冲
    expect(relationStrength("子", "午", a)).toBe(a.chong);
    // 寅亥六合（这一对不落在任何三合/三会内，故无歧义）
    expect(relationStrength("寅", "亥", a)).toBe(a.liuhe);
    expect(relationStrength("卯", "戌", a)).toBe(a.liuhe);
    // 申子辰三合
    expect(relationStrength("申", "辰", a)).toBe(a.sanheSanhui);
    // 无关
    expect(relationStrength("子", "巳", a)).toBe(0);
    // 任一对的强度不超过最大系数
    const maxCoef = Math.max(a.chong, a.sanheSanhui, a.liuhe, a.xing, a.hai, a.po);
    for (const x of BRANCHES) {
      for (const z of BRANCHES) expect(relationStrength(x, z, a)).toBeLessThanOrEqual(maxCoef);
    }
  });

  it("**两类重叠时按局论 —— 与 L2 的优先级同一个答案**", () => {
    const a = DEFAULT_PARAMS.series.agitation;
    // 子丑既是六合，又在亥子丑三会内；午未既是六合，又在巳午未三会内。
    // 不是因为局一定比合强，而是同一份判断在两处必须给同一个答案。
    expect(relationStrength("子", "丑", a)).toBe(a.sanheSanhui);
    expect(relationStrength("午", "未", a)).toBe(a.sanheSanhui);
    // 其余四对六合无歧义
    for (const [x, y] of [["寅", "亥"], ["卯", "戌"], ["辰", "酉"], ["巳", "申"]] as const) {
      expect(relationStrength(x, y, a), `${x}${y}`).toBe(a.liuhe);
    }
  });

  it("扰动的零点为 0，且确有起伏", () => {
    for (const s of S.series.filter((x) => x.kind === "agitation")) {
      expect(s.baseValue).toBe(0);
      expect(s.deltas).toEqual(s.values);
      const range = Math.max(...s.values) - Math.min(...s.values);
      expect(range, `${s.id} 全程无起伏`).toBeGreaterThan(0);
    }
  });

  it("流月**参与**扰动 —— 它是符号层的量，不是权重", () => {
    // 同一年内十二个月的扰动值不应完全相同
    const s = S.series.find((x) => x.kind === "agitation")!;
    const first = s.values.slice(0, 12);
    expect(new Set(first.map((v) => v.toFixed(6))).size, "十二个月扰动完全相同，流月没进来").toBeGreaterThan(1);
  });

  it("命宫与胎元都有扰动序列 —— 它们无权重，但有被引动的程度", () => {
    const ids = S.series.filter((x) => x.kind === "agitation").map((x) => x.id);
    expect(ids).toContain("agitation.命宫");
    expect(ids).toContain("agitation.胎元");
  });
});

describe("硬约束", () => {
  it("月度采样是硬约束，改则参数校验拦下", () => {
    expect(() => loadParams({ series: { samplesPerYear: 1 as never } }))
      .toThrow(ParamsValidationError);
  });

  it("🧪 实验分支：流月入权重的硬约束已放开，但必须是布尔、比例必须在 [0,1]", () => {
    expect(() => loadParams({ series: { fleetingMonthInWeights: true } })).not.toThrow();
    expect(() => loadParams({ series: { fleetingMonthInWeights: "yes" as never } }))
      .toThrow(ParamsValidationError);
    expect(() => loadParams({ weights: { fleetingMonth: { ratioToYear: 1.5 } } as never }))
      .toThrow(ParamsValidationError);
  });

  it("统计窗不得长于绘制跨度", () => {
    expect(() => loadParams({ series: { spanYears: 80, drawYears: 60 } }))
      .toThrow(/没有采样点/);
  });

  it("统计窗标记与实际年份一致", () => {
    const s2 = buildSeries(base, { years: 12, statsYears: 5 });
    const inWin = s2.frames.filter((f) => f.inStatsWindow);
    expect(new Set(inWin.map((f) => f.year)).size).toBe(5);
    expect(s2.statsTo - s2.statsFrom).toBe(4);
  });
});

describe("**绘制跨度与大运柱数必须配套**", () => {
  /**
   * 界面可以把生命曲线拉到 60 / 120 / 180 年。但大运的柱数由
   * `temporal.luckPillarCount` 定（默认 12 柱 = 120 年）——
   * 只拉年数而不加柱，最后那几十年的帧 `luckPillar === null`，
   * **曲线少了一整层**，而那个断口看起来像一个真实的转折。
   *
   * 实测过：180 年配 12 柱，三分之一的帧没有大运。
   */
  const INPUT: BirthInput = {
    year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
  };
  const baseWith = (pillars: number) => {
    const p = loadParams({ temporal: { luckPillarCount: pillars } });
    return buildBaseChart(buildChart(INPUT, chartOptionsOf(p)), p);
  };

  /** 起运之前没有大运，那不是缺口 —— 是那段本来就还没起运。 */
  const gapAfterStart = (S: ReturnType<typeof buildSeries>): number => {
    const first = S.frames.findIndex((f) => f.luckPillar !== null);
    return S.frames.slice(first).filter((f) => f.luckPillar === null).length;
  };

  it("**配套的柱数下，起运之后一帧不缺**", () => {
    for (const [years, pillars] of [[60, 6], [120, 12], [180, 18]] as const) {
      const S = buildSeries(baseWith(pillars), { years });
      expect(gapAfterStart(S), `${years} 年配 ${pillars} 柱`).toBe(0);
      expect(S.frames).toHaveLength(years * 12);
    }
  });

  it("**反向对照：柱数不够时确实会缺一大片** —— 这正是要防的", () => {
    const S = buildSeries(baseWith(12), { years: 180 });
    const missing = gapAfterStart(S);
    expect(missing, "180 年只配 12 柱，末尾六十年应当没有大运")
      .toBeGreaterThan(S.frames.length / 4);
  });

  it("**σ 的基准窗不随跨度变** —— 否则节点会因显示选择而出现或消失", () => {
    const stats = (years: number, pillars: number) => {
      const S = buildSeries(baseWith(pillars), { years });
      const s = S.series[0]!;
      const st = curveStats(S, s);
      return { center: st.center, sigma: st.sigma, inWindow: S.frames.filter((f) => f.inStatsWindow).length };
    };
    const a = stats(60, 6);
    const b = stats(120, 12);
    const c = stats(180, 18);
    // 基准窗恒为头 60 年
    expect(a.inWindow).toBe(60 * 12);
    expect(b.inWindow).toBe(60 * 12);
    expect(c.inWindow).toBe(60 * 12);
    // 故同一条序列的中心与散布三档一致
    expect(b.center).toBeCloseTo(a.center, 9);
    expect(c.center).toBeCloseTo(a.center, 9);
    expect(b.sigma).toBeCloseTo(a.sigma, 9);
    expect(c.sigma).toBeCloseTo(a.sigma, 9);
  });

  it("拉长跨度只是往后接，前 60 年逐点不变", () => {
    const a = buildSeries(baseWith(6), { years: 60 });
    const c = buildSeries(baseWith(18), { years: 180 });
    const sid = a.series[0]!.id;
    const av = a.series.find((s) => s.id === sid)!.values;
    const cv = c.series.find((s) => s.id === sid)!.values;
    expect(cv.length).toBe(av.length * 3);
    for (let i = 0; i < av.length; i++) {
      expect(cv[i], `第 ${i} 帧`).toBeCloseTo(av[i]!, 9);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  🧪 实验分支 exp/fleeting-month-weights：流月入权重
//  主线上这是硬约束。这一组只在实验分支存在。
// ═══════════════════════════════════════════════════════════

describe("🧪 流月入权重（实验）", () => {
  const mk = (over: Parameters<typeof loadParams>[0]) => {
    const p = loadParams(over);
    return buildBaseChart(buildChart(EXAMPLE, chartOptionsOf(p)), p);
  };
  const off = base;
  const on = mk({ series: { fleetingMonthInWeights: true } });
  const sample = buildSeries(on, { years: 12, statsYears: 12 });
  const f = sample.frames[30]!;
  const at = (b: typeof off, month = f.fleetingMonth) => evaluateAt(b, {
    luck: f.luckPillar === null ? null : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
    annual: f.annual, fleetingMonth: month,
  });

  it("**反向对照：开关关着时，传不传流月，权重逐位相同** —— 默认行为与主线不变", () => {
    const withMonth = at(off);
    const without = evaluateAt(off, {
      luck: f.luckPillar === null ? null : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
      annual: f.annual,
    });
    expect(withMonth.carriers.map((c) => c.weight)).toEqual(without.carriers.map((c) => c.weight));
    expect(withMonth.carriers.some((c) => c.position.pillar === "fleetingMonth")).toBe(false);
  });

  it("**开关打开：流月载体存在，总量恰为流年的 ratio**", () => {
    const ev = evaluateAt(on, {
      luck: f.luckPillar === null ? null : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
      annual: f.annual, fleetingMonth: f.fleetingMonth,
    });
    // 传导之前的初始配重 —— 传导会改 weight，故直接看 trace 的第一条
    const initial = (k: string) => ev.carriers
      .filter((c) => c.position.pillar === k)
      .reduce((a, c) => a + c.trace[0]!.to, 0);
    expect(initial("annual")).toBeCloseTo(110, 6);
    expect(initial("fleetingMonth")).toBeCloseTo(110 * 0.25, 6);
  });

  it("干支内部按流年的 40:70 同比缩放", () => {
    const ev = at(on);
    const stem = ev.carriers.find((c) => c.position.pillar === "fleetingMonth" && c.position.layer === "stem")!;
    expect(stem.trace[0]!.to).toBeCloseTo(40 * 0.25, 6);
    const branchSum = ev.carriers
      .filter((c) => c.position.pillar === "fleetingMonth" && c.position.layer === "branch")
      .reduce((a, c) => a + c.trace[0]!.to, 0);
    expect(branchSum).toBeCloseTo(70 * 0.25, 6);
  });

  it("**比例参数真的在起作用，而且线性**", () => {
    const half = mk({ series: { fleetingMonthInWeights: true }, weights: { fleetingMonth: { ratioToYear: 0.5 } } } as never);
    const initial = (b: typeof off) => at(b).carriers
      .filter((c) => c.position.pillar === "fleetingMonth").reduce((a, c) => a + c.trace[0]!.to, 0);
    expect(initial(half)).toBeCloseTo(2 * initial(on), 6);
  });

  it("**换一个流月，权重类序列就变** —— 与主线上「毫无变化」恰成反向", () => {
    const other = { stem: f.fleetingMonth.stem === "甲" ? "乙" : "甲", branch: f.fleetingMonth.branch === "子" ? "午" : "子" } as typeof f.fleetingMonth;
    const a = at(on); const b = at(on, other);
    const differs = Object.keys(a.conclusions.tenGods).some((g) =>
      Math.abs(a.conclusions.tenGods[g as keyof typeof a.conclusions.tenGods]
        - b.conclusions.tenGods[g as keyof typeof b.conclusions.tenGods]) > 1e-9);
    expect(differs).toBe(true);
    // 主线对照：同样换法，开关关着时十神一位不动
    const c = at(off); const d = at(off, other);
    for (const g of Object.keys(c.conclusions.tenGods)) {
      expect(c.conclusions.tenGods[g as keyof typeof c.conclusions.tenGods])
        .toBe(d.conclusions.tenGods[g as keyof typeof d.conclusions.tenGods]);
    }
  });

  it("monthResolving 随开关走：权重类为真，应期域仍为假，关着时全为假（扰动除外）", () => {
    const Son = buildSeries(on, { years: 3, statsYears: 3 });
    const Soff = buildSeries(off, { years: 3, statsYears: 3 });
    for (const s of Son.series) {
      if (s.kind === "agitation") expect(s.monthResolving).toBe(true);
      else if (s.kind === "domain") expect(s.monthResolving).toBe(false);
      else expect(s.monthResolving, s.id).toBe(true);
    }
    for (const s of Soff.series) expect(s.monthResolving, s.id).toBe(s.kind === "agitation");
  });

  it("**流月在距离上借流年的系数，但不借「太岁君临」那条日主加成**", async () => {
    const { propagationDistance } = await import("../src/propagate/distance.js");
    const ev = at(on);
    const dm = ev.carriers.find((c) => c.flags.includes("DAY_MASTER"))!;
    const ann = ev.carriers.find((c) => c.position.pillar === "annual" && c.position.layer === "stem")!;
    const mon = ev.carriers.find((c) => c.position.pillar === "fleetingMonth" && c.position.layer === "stem")!;
    const P = on.params.propagation;
    const dAnn = propagationDistance(ann, dm, P);
    const dMon = propagationDistance(mon, dm, P);
    expect(dAnn / dMon).toBeCloseTo(P.external.annualToDayMasterBonus, 9);
  });

  it("参数指纹因此不同 —— 数不可与主线的报告相比", () => {
    expect(paramsHash(on.params)).not.toBe(paramsHash(off.params));
  });
});

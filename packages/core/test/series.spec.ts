import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildSeries, relationStrength } from "../src/temporal/series.js";
import { evaluateAt } from "../src/temporal/evaluate.js";
import { annualPillarOf } from "../src/temporal/views.js";
import { loadParams, ParamsValidationError } from "../src/params/load.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { BRANCHES } from "../src/types/ganzhi.js";
import type { BirthInput } from "../src/chart/types.js";

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
    // 域张力恒不判方向 —— 张力本就是「顺逆并存」的度量
    for (const s of S.series.filter((x) => x.kind === "domain")) {
      expect(s.polarity, s.id).toBe("neutral");
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
  it("月度采样与流月不加权，改则参数校验拦下", () => {
    expect(() => loadParams({ series: { samplesPerYear: 1 as never } }))
      .toThrow(ParamsValidationError);
    expect(() => loadParams({ series: { fleetingMonthInWeights: true as never } }))
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

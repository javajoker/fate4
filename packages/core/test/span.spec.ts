import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildSeries } from "../src/temporal/series.js";
import { curveStats } from "../src/temporal/nodes.js";
import {
  baseForSpan, seriesForSpan, pillarsForSpan, isSpanYears, SPANS, DEFAULT_SPAN,
} from "../src/temporal/span.js";
import { buildReport } from "../src/report/assemble.js";
import { loadParams } from "../src/params/load.js";
import type { BirthInput } from "../src/chart/types.js";

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const base = buildBaseChart(buildChart(EXAMPLE), loadParams());

describe("跨度 60 / 120 / 180", () => {
  it("三档，一步大运十年，故柱数是 6 / 12 / 18；默认 60", () => {
    expect([...SPANS]).toEqual([60, 120, 180]);
    expect(SPANS.map(pillarsForSpan)).toEqual([6, 12, 18]);
    expect(DEFAULT_SPAN).toBe(60);
    expect(isSpanYears(120)).toBe(true);
    expect(isSpanYears(90)).toBe(false);
  });

  it("**柱数够就原样返回同一个对象；不够才另建，且不改传入的那一份**", () => {
    const n0 = base.chart.luck.pillars.length;
    expect(n0).toBeGreaterThanOrEqual(12);
    expect(baseForSpan(base, 60)).toBe(base);
    expect(baseForSpan(base, 120)).toBe(base);
    const b180 = baseForSpan(base, 180);
    expect(b180).not.toBe(base);
    expect(b180.chart.luck.pillars.length).toBeGreaterThanOrEqual(18);
    expect(base.chart.luck.pillars.length, "传入的基础盘不得被悄悄改动").toBe(n0);
  });

  it("另建的基础盘与原来的在已有的那些柱上逐柱相同 —— 只是更长", () => {
    const b180 = baseForSpan(base, 180);
    for (let i = 0; i < base.chart.luck.pillars.length; i++) {
      expect(b180.chart.luck.pillars[i]!.pillar).toEqual(base.chart.luck.pillars[i]!.pillar);
      expect(b180.chart.luck.pillars[i]!.startJd).toBe(base.chart.luck.pillars[i]!.startJd);
    }
  });
});

describe("**σ 随跨度重算**", () => {
  const S60 = seriesForSpan(base, 60);
  const S120 = seriesForSpan(base, 120);
  const S180 = seriesForSpan(base, 180);

  it("**60 年时与此前逐位相同** —— 默认不改变任何已有的数", () => {
    const legacy = buildSeries(base);
    expect(S60.frames).toHaveLength(legacy.frames.length);
    expect(S60.statsFrom).toBe(legacy.statsFrom);
    expect(S60.statsTo).toBe(legacy.statsTo);
    for (const [i, s] of legacy.series.entries()) {
      expect(S60.series[i]!.values, s.id).toEqual(s.values);
      const a = curveStats(legacy, s); const b = curveStats(S60, S60.series[i]!);
      expect(b.center).toBe(a.center);
      expect(b.sigma).toBe(a.sigma);
    }
  });

  it("基准窗就是整个跨度", () => {
    for (const [S, span] of [[S60, 60], [S120, 120], [S180, 180]] as const) {
      expect(S.statsTo - S.statsFrom + 1, `${span} 年`).toBe(span);
      expect(S.frames).toHaveLength(span * 12);
      expect(S.frames.every((f) => f.inStatsWindow)).toBe(true);
    }
  });

  it("**换跨度，σ 确实重算了** —— 多数序列的 σ 与 60 年时不同", () => {
    let differ = 0; let total = 0;
    for (const [i, s] of S60.series.entries()) {
      const a = curveStats(S60, s).sigma;
      const b = curveStats(S120, S120.series[i]!).sigma;
      if (a > 0) { total++; if (Math.abs(a - b) > 1e-9) differ++; }
    }
    expect(total).toBeGreaterThan(30);
    expect(differ / total, "几乎所有序列的 σ 都应随跨度而变").toBeGreaterThan(0.9);
  });

  it("**反向对照：旧做法（基准窗固定头 60 年）给的 σ 与 60 年时一模一样**", () => {
    // 若 seriesForSpan 其实没有重算 σ，这条与上一条会同时变成「相同」。
    // 这里把旧做法显式造出来：120 年的曲线，基准窗仍取 60 年。
    const b = baseForSpan(base, 120);
    const fixed = buildSeries(b, { years: 120, statsYears: 60 });
    for (const [i, s] of S60.series.entries()) {
      expect(curveStats(fixed, fixed.series[i]!).sigma, s.id)
        .toBeCloseTo(curveStats(S60, s).sigma, 9);
    }
  });

  it("同一年的 z 分数随跨度改变 —— 这正是代价，所以要写明", () => {
    const k = 0; // 第一条序列
    const z = (S: typeof S60, i: number) => {
      const s = S.series[k]!; const { center, sigma } = curveStats(S, s);
      return (s.values[i]! - center) / sigma;
    };
    // 取前 60 年里 |z| 最大的那一帧
    let best = 0;
    for (let i = 0; i < S60.frames.length; i++) if (Math.abs(z(S60, i)) > Math.abs(z(S60, best))) best = i;
    expect(Math.abs(z(S60, best) - z(S120, best))).toBeGreaterThan(1e-3);
    expect(Math.abs(z(S120, best) - z(S180, best))).toBeGreaterThan(1e-3);
  });

  it("**逐年的数值不随跨度变** —— 变的只是拿什么当尺子", () => {
    const n = S60.frames.length;
    for (const [i, s] of S60.series.entries()) {
      expect(S120.series[i]!.values.slice(0, n), s.id).toEqual(s.values);
      expect(S180.series[i]!.values.slice(0, n), s.id).toEqual(s.values);
    }
  });
});

describe("报告随跨度走", () => {
  const rep = (span?: 60 | 120 | 180) => buildReport(base, {
    includeNodes: true, ...(span === undefined ? {} : { span }),
  });

  it("**大运列 6 / 12 / 18 柱，曲线 60 / 120 / 180 年，节点基准窗等于跨度**", () => {
    for (const span of SPANS) {
      const r = rep(span);
      expect(r.luck.steps, `${span} 年`).toHaveLength(span / 10);
      expect(r.years.curve).toHaveLength(span);
      expect(r.nodes!.statsTo - r.nodes!.statsFrom + 1).toBe(span);
      expect(r.meta.span).toBe(span);
    }
  });

  it("不给跨度就是 60 年 —— 默认值在 core 里，Web 与 CLI 才同源", () => {
    const r = rep();
    expect(r.meta.span).toBe(60);
    expect(r.luck.steps).toHaveLength(6);
    expect(r.years.curve).toHaveLength(60);
  });

  it("**参数指纹不随跨度变** —— 另建的更长基础盘不该让同一张盘同样的参数得到不同的指纹", () => {
    const h = rep(60).meta.paramsHash;
    expect(rep(120).meta.paramsHash).toBe(h);
    expect(rep(180).meta.paramsHash).toBe(h);
    expect(rep(180).method.paramsHash).toBe(h);
  });

  it("两份指纹相同、跨度不同的报告：逐年的数相同，节点的基准窗不同", () => {
    const a = rep(60); const b = rep(120);
    for (let i = 0; i < 60; i++) {
      expect(b.years.curve[i]!.favorIndex).toBe(a.years.curve[i]!.favorIndex);
    }
    expect(b.nodes!.statsTo).toBeGreaterThan(a.nodes!.statsTo);
  });

  it("**方法一节写明跨度与 σ 随之重算**", () => {
    const t = rep(120).method.narrative.map((l) => l.text).join("\n");
    expect(t).toContain("时间跨度 120 年");
    expect(t).toContain("z 分数会随之改变");
  });

  it("显式给了 curveYears 就以它为准，跨度不覆盖它", () => {
    const r = buildReport(base, { span: 180, curveYears: 7 });
    expect(r.years.curve).toHaveLength(7);
    expect(r.luck.steps).toHaveLength(18);
  });
});

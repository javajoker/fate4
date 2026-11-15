import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildSeries } from "../src/temporal/series.js";
import { curveStats, findNodes } from "../src/temporal/nodes.js";
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

describe("**σ 的基准窗固定为起运后 60 年，不随跨度变**", () => {
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

  it("曲线画满整个跨度，基准窗仍只有 60 年", () => {
    for (const [S, span] of [[S60, 60], [S120, 120], [S180, 180]] as const) {
      expect(S.frames, `${span} 年`).toHaveLength(span * 12);
      expect(S.statsTo - S.statsFrom + 1).toBe(60);
      expect(S.frames.filter((f) => f.inStatsWindow)).toHaveLength(60 * 12);
    }
  });

  it("**换跨度，μ 与 σ 逐位不变** —— 每一条序列", () => {
    for (const [i, s] of S60.series.entries()) {
      const a = curveStats(S60, s);
      for (const S of [S120, S180]) {
        const b = curveStats(S, S.series[i]!);
        expect(b.center, s.id).toBe(a.center);
        expect(b.sigma, s.id).toBe(a.sigma);
      }
    }
  });

  it("**同一年的 z 分数在三个跨度下逐位相同** —— 一个显示选择不改变一个数的含义", () => {
    const n = S60.frames.length;
    for (const [i, s] of S60.series.entries()) {
      const a = curveStats(S60, s);
      if (!(a.sigma > 0)) continue;
      for (const S of [S120, S180]) {
        const s2 = S.series[i]!; const b = curveStats(S, s2);
        for (let k = 0; k < n; k++) {
          expect((s2.values[k]! - b.center) / b.sigma, `${s.id}#${k}`)
            .toBe((s.values[k]! - a.center) / a.sigma);
        }
      }
    }
  });

  it("**反向对照：若基准窗跟着跨度走，σ 会变** —— 证明上面几条不是恒真", () => {
    // 把「基准窗 = 跨度」显式造出来（这是被推翻过的做法）：σ 与 60 年时不同
    const b = baseForSpan(base, 120);
    const follow = buildSeries(b, { years: 120, statsYears: 120 });
    let differ = 0; let total = 0;
    for (const [i, s] of S60.series.entries()) {
      const a = curveStats(S60, s).sigma;
      if (!(a > 0)) continue;
      total++;
      if (Math.abs(curveStats(follow, follow.series[i]!).sigma - a) > 1e-9) differ++;
    }
    expect(total).toBeGreaterThan(30);
    expect(differ / total, "几乎所有序列的 σ 都会随基准窗而变").toBeGreaterThan(0.9);
  });

  it("**逐年的数值也不随跨度变**", () => {
    const n = S60.frames.length;
    for (const [i, s] of S60.series.entries()) {
      expect(S120.series[i]!.values.slice(0, n), s.id).toEqual(s.values);
      expect(S180.series[i]!.values.slice(0, n), s.id).toEqual(s.values);
    }
  });
});

describe("**统计节点：窗外的年份也被扫描，用同一把尺子**", () => {
  const S60 = seriesForSpan(base, 60);
  const S120 = seriesForSpan(base, 120);
  const S180 = seriesForSpan(base, 180);
  const big = (S: typeof S60) => findNodes(S, "large", { maxShown: 99999 });
  const mid = (S: typeof S60) => findNodes(S, "medium", { maxShown: 99999 });
  const sml = (S: typeof S60) => findNodes(S, "small", { maxShown: 99999 });
  const winEnd = S60.statsTo;

  it("**跨度越长，节点覆盖的年份越远** —— 60 年时一个窗外的节点都没有", () => {
    const last = (set: ReturnType<typeof big>) => Math.max(...set.nodes.map((n) => n.exit.year));
    expect(last(big(S60))).toBeLessThanOrEqual(winEnd);
    expect(last(big(S120))).toBeGreaterThan(winEnd);
    expect(last(big(S180))).toBeGreaterThan(last(big(S120)));
    expect(big(S120).total).toBeGreaterThan(big(S60).total);
  });

  it("**大尺度：μ 与 σ 在三个跨度下相同** —— 基准是头 60 年，不是被扫描的那一段", () => {
    const key = (n: { seriesId: string; enter: { year: number; monthIndex: number } }) =>
      `${n.seriesId}@${n.enter.year}.${n.enter.monthIndex}`;
    const a = new Map(big(S60).nodes.map((n) => [key(n), n]));
    let checked = 0;
    for (const S of [S120, S180]) {
      for (const n of big(S).nodes) {
        // 同一条序列在所有跨度下基准相同：取它在 60 年里的任一节点比对
        const ref = [...a.values()].find((x) => x.seriesId === n.seriesId);
        if (ref === undefined) continue;
        expect(n.mean, n.seriesId).toBe(ref.mean);
        expect(n.sigma, n.seriesId).toBe(ref.sigma);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("**基准窗之内、且远离窗口边界的节点，三个跨度下逐位相同**", () => {
    // 只有与窗口边界相交的区间才可能不同（区间在窗口末尾被截断 / 延伸）。
    const interior = (set: ReturnType<typeof big>) => set.nodes
      .filter((n) => n.exit.year <= winEnd - 2)
      .map((n) => JSON.stringify({ ...n, reasons: n.reasons.length }))
      .sort();
    const a = interior(big(S60));
    expect(a.length).toBeGreaterThan(50);
    expect(interior(big(S120))).toEqual(a);
    expect(interior(big(S180))).toEqual(a);
  });

  it("**反向对照：把基准改成扫描的整段，窗外的节点就会变** —— 证明窗外确实用了头 60 年的尺子", () => {
    // 被推翻的做法：基准窗 = 跨度。此时 120 年里的 σ 与 60 年时不同。
    const follow = buildSeries(baseForSpan(base, 120), { years: 120, statsYears: 120 });
    const a = big(S120).nodes.find((n) => n.exit.year > winEnd)!;
    const b = big(follow).nodes.find((n) => n.seriesId === a.seriesId && n.exit.year > winEnd);
    expect(b, "基准随跨度时同一条序列的窗外节点应有不同的 σ").toBeDefined();
    expect(b!.sigma).not.toBe(a.sigma);
  });

  it("中尺度：基准仍是头 60 年的那几步，窗外的步被扫描", () => {
    const a = mid(S60); const b = mid(S120);
    expect(Math.max(...a.nodes.map((n) => n.exit.year))).toBeLessThanOrEqual(winEnd);
    expect(Math.max(...b.nodes.map((n) => n.exit.year))).toBeGreaterThan(winEnd);
    const ref = a.nodes[0]!;
    const same = b.nodes.find((n) => n.seriesId === ref.seriesId);
    expect(same!.mean).toBe(ref.mean);
    expect(same!.sigma).toBe(ref.sigma);
  });

  it("小尺度：基准是所在的那一步自己，窗外的步照样各用各的", () => {
    const b = sml(S120);
    expect(Math.max(...b.nodes.map((n) => n.exit.year))).toBeGreaterThan(winEnd);
    for (const n of b.nodes.filter((x) => x.enter.year > winEnd)) {
      // 窗外那一步的基准就是它自己：一步 120 个月
      expect(n.groupSize, n.seriesId).toBeGreaterThanOrEqual(100);
    }
  });
});

describe("报告随跨度走", () => {
  const rep = (span?: 60 | 120 | 180) => buildReport(base, {
    includeNodes: true, ...(span === undefined ? {} : { span }),
  });

  it("**大运列 6 / 12 / 18 柱，曲线 60 / 120 / 180 年；节点基准窗恒为 60 年，扫描随跨度**", () => {
    for (const span of SPANS) {
      const r = rep(span);
      expect(r.luck.steps, `${span} 年`).toHaveLength(span / 10);
      expect(r.years.curve).toHaveLength(span);
      expect(r.nodes!.statsTo - r.nodes!.statsFrom + 1, "基准窗不随跨度变").toBe(60);
      expect(r.nodes!.scanTo - r.nodes!.statsFrom + 1, "扫描覆盖整个跨度").toBe(span);
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

  it("两份指纹相同、跨度不同的报告：逐年的数相同，基准窗相同，只是后者看得更远", () => {
    const a = rep(60); const b = rep(120);
    for (let i = 0; i < 60; i++) {
      expect(b.years.curve[i]!.favorIndex).toBe(a.years.curve[i]!.favorIndex);
    }
    expect(b.nodes!.statsFrom).toBe(a.nodes!.statsFrom);
    expect(b.nodes!.statsTo).toBe(a.nodes!.statsTo);
    expect(b.nodes!.scanTo).toBeGreaterThan(a.nodes!.scanTo);
  });

  it("**方法一节写明跨度，以及 σ 的基准窗不随它变**", () => {
    const t = rep(120).method.narrative.map((l) => l.text).join("\n");
    expect(t).toContain("时间跨度 120 年");
    expect(t).toContain("σ 的基准窗不随跨度变");
    expect(t).not.toContain("z 分数会随之改变");
  });

  it("显式给了 curveYears 就以它为准，跨度不覆盖它", () => {
    const r = buildReport(base, { span: 180, curveYears: 7 });
    expect(r.years.curve).toHaveLength(7);
    expect(r.luck.steps).toHaveLength(18);
  });
});

/**
 * 报告的时间跨度：60 / 120 / 180 年。
 *
 * ## 这一处定义什么
 *
 * 曲线、流年、统计节点、大运、完整报告原本各管各的年数：曲线 60 年、
 * 流年曲线 120 年、节点基准 60 年、大运 12 柱。要让它们一起切 60 / 120 / 180，
 * 就得有**一个**说法 —— 跨度 = 自起运起算的年数，一步大运十年，故柱数 = 跨度 / 10。
 * 各页各调各的，迟早有一页停在旧跨度上而别的页已经换了。
 *
 * ## σ 随跨度重算
 *
 * 统计节点与曲线上的 ±θσ 界线，基准窗就是**这一整段跨度**
 * （`seriesForSpan` 传 `statsYears = years`）。换跨度，μ 与 σ 重算，
 * 同一年的 z 分数随之改变，节点会出现或消失。
 *
 * 这是一个有代价的选择，必须明说：此前基准窗固定为头 60 年，理由是
 * 「一个显示选择不该改变一个数的含义」。现在基准窗跟着跨度走，
 * 切到 120 / 180 年时基准里就纳入了第 60 年之后的那些年 ——
 * 那段年份已超出任何人的寿数，反映的是这套方法本身的结构。
 * 60 年时与此前逐位相同。
 *
 * ## 大运柱数
 *
 * 基础盘的大运柱数由 `temporal.luckPillarCount` 定（默认 12 柱）。
 * 跨度要的柱数更多时，**另建一份**带足够柱数的基础盘，不改传入的那一份 ——
 * 否则大运页、报告与节点页的范围会被悄悄带着一起变。
 * 不够柱就硬拉长，最后那几十年根本没有大运这一层，曲线照画，
 * 那个断口看起来像一个真实的转折。
 */

import type { BaseChart } from "../chart/baseChart.js";
import { buildBaseChart } from "../chart/baseChart.js";
import { buildChart, chartOptionsOf } from "../chart/buildChart.js";
import { loadParams } from "../params/load.js";
import type { PartialParams } from "../params/types.js";
import { buildSeries, type SeriesSet } from "./series.js";

export const SPANS = [60, 120, 180] as const;
export type SpanYears = (typeof SPANS)[number];

/**
 * 默认跨度。取 60：它是统计节点基准窗一贯的取值，
 * 默认下节点与 σ 的数与此前逐位相同。
 */
export const DEFAULT_SPAN: SpanYears = 60;

export const SPAN_LABEL: Readonly<Record<SpanYears, string>> = Object.freeze({
  60: "60 年", 120: "120 年", 180: "180 年",
});

export function isSpanYears(x: unknown): x is SpanYears {
  return SPANS.includes(x as SpanYears);
}

/** 跨度要几柱大运。一柱十年。 */
export function pillarsForSpan(span: SpanYears): number {
  return span / 10;
}

/**
 * 给定跨度的基础盘。
 *
 * 传入的基础盘大运柱数已够、且没有额外参数要叠时，**原样返回**（同一个对象）；
 * 否则另建一份。`extra` 是叠在当前参数之上的**字段级**覆盖，不整段替换 ——
 * 整段替换会把用户校准过的权重悄悄换回默认值。
 */
export function baseForSpan(
  base: BaseChart, span: SpanYears, extra?: PartialParams,
): BaseChart {
  const need = pillarsForSpan(span);
  if (extra === undefined && base.chart.luck.pillars.length >= need) return base;

  const t = base.params.temporal;
  const p = loadParams({
    ...base.params,
    temporal: { ...t, luckPillarCount: Math.max(t.luckPillarCount, need) },
    ...(extra ?? {}),
  } as never);
  return buildBaseChart(buildChart(base.chart.input, chartOptionsOf(p)), p);
}

/**
 * 给定跨度的曲线集。**基准窗 = 整个跨度**，σ 随之重算。
 *
 * @param extra 叠在当前参数之上的覆盖，见 {@link baseForSpan}。
 */
export function seriesForSpan(
  base: BaseChart, span: SpanYears, extra?: PartialParams,
): SeriesSet {
  return buildSeries(baseForSpan(base, span, extra), { years: span, statsYears: span });
}

/**
 * 精度地平线 —— 这份报告算到了多远，而引擎的承诺到哪儿为止。
 *
 * ## 为什么需要这个模块
 *
 * 引擎对节气时刻声明 60 秒容差，且这条承诺**有年份上界**：
 * `TOLERANCE_GUARANTEED_UNTIL_YEAR`（2050）。`julian.ts` 另外声明
 * 整个引擎的时间跨度为 1900–2100。
 *
 * 问题在于，这两条此前**只对出生年校验过**（`buildChart` 里那一处），
 * 而报告覆盖的年份远不止出生年：一张 1990 年的盘，大运排到 2108，
 * 流年曲线排到 2109 —— 117 个年份越过 2050，18 个越过 2100，
 * 而报告里一个字都没提。
 *
 * 那是一条**引擎自己给不出保证、却照样输出**的数。本项目到处在防的
 * 正是这种形态：盘的来历警告、参数指纹、待校准清单、ΔT 的 `basis` 字段，
 * 每一条都是「说清楚这个数凭什么」。这里补上最后一处。
 *
 * ## 实际后果有多大 —— 不要夸大
 *
 * 越过 2050 **不意味着那些年的柱是错的**。年柱、月柱走的是六十甲子的
 * 定序推进，与节气时刻无关；节气只决定**哪一刻换柱**。于是：
 *
 * - 整年、整月的卡片：**不受影响**。2109 年的年柱就是那一柱。
 * - 受影响的只有「某一刻属于哪一柱」，而且只在该刻落在节前后
 *   一分钟以内时才真的会判到隔壁 —— 起运时刻、流月边界属于这一类。
 *
 * 把它说成「2050 年以后的结论不可信」是另一种不诚实。故本模块给出的
 * 措辞明确限定在**边界时刻**上。
 *
 * ## 三段
 *
 * | 年份 | band | 含义 |
 * | --- | --- | --- |
 * | ≤ 2050 | `guaranteed` | 60 秒容差内 |
 * | 2051–2100 | `beyondTolerance` | ΔT 外推不确定度已超过容差 |
 * | > 2100 | `beyondSpan` | 超出引擎声明并测试过的跨度 |
 *
 * 第三段不是「算错了」：格里高利历在 2100 年不失效，级数也照常收敛。
 * 它是「没有声明，也没有测试覆盖」—— 两者的区别要说清楚。
 */

import { TOLERANCE_GUARANTEED_UNTIL_YEAR } from "./deltaT.js";

/** 引擎声明并测试过的时间跨度下界（见 `julian.ts`）。 */
export const ENGINE_SPAN_FROM_YEAR = 1900;
/** 引擎声明并测试过的时间跨度上界（见 `julian.ts`）。 */
export const ENGINE_SPAN_TO_YEAR = 2100;

export type PrecisionBand = "guaranteed" | "beyondTolerance" | "beyondSpan";

export function precisionBandOf(year: number): PrecisionBand {
  if (year > ENGINE_SPAN_TO_YEAR) return "beyondSpan";
  if (year > TOLERANCE_GUARANTEED_UNTIL_YEAR) return "beyondTolerance";
  return "guaranteed";
}

export interface PrecisionHorizon {
  /** 这份报告覆盖到的最远年份。 */
  readonly furthestYear: number;
  /** 最远年份落在哪一段。 */
  readonly band: PrecisionBand;
  /** 越过容差上界的年份个数 —— 「有几条」比「有没有」更能说明规模。 */
  readonly beyondToleranceCount: number;
  /** 越过声明跨度的年份个数。 */
  readonly beyondSpanCount: number;
  /** 容差承诺的上界年份，随结论一起带出，免得读者再去翻文档。 */
  readonly toleranceUntilYear: number;
  /** 声明跨度的上界年份。 */
  readonly spanToYear: number;
}

/**
 * 由报告实际覆盖的年份集合求地平线。
 *
 * 传入**所有**出现过的年份而不是只传最大值：`beyondToleranceCount`
 * 要的是规模。一份只有一个年份越界的报告，与一份一百多个年份越界的报告，
 * 读者该知道是哪一种。
 */
export function horizonOf(years: readonly number[]): PrecisionHorizon {
  const furthestYear = years.length === 0
    ? ENGINE_SPAN_FROM_YEAR
    : years.reduce((a, b) => (b > a ? b : a), years[0]!);
  return {
    furthestYear,
    band: precisionBandOf(furthestYear),
    beyondToleranceCount: years.filter(
      (y) => y > TOLERANCE_GUARANTEED_UNTIL_YEAR).length,
    beyondSpanCount: years.filter((y) => y > ENGINE_SPAN_TO_YEAR).length,
    toleranceUntilYear: TOLERANCE_GUARANTEED_UNTIL_YEAR,
    spanToYear: ENGINE_SPAN_TO_YEAR,
  };
}

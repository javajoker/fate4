/**
 * 各套系统**可能的结果有多少种** —— 数得出来的那一类比较。
 *
 * ## 为什么这个数值得算
 *
 * 一套占法的状态空间大小，决定了它**最多能携带多少信息**。
 * 这不是对它准不准的判断，是一个上界：
 *
 * - 状态少 → 不同的人、不同的事更容易落到同一个结果上
 * - 状态多 → 落点分散，但分散本身不等于有意义
 *
 * 更有意思的是**连续与离散**的分野：中土这几套的结果是有限个符号组合，
 * 数得清；而西洋占星的行星黄经是**连续量**，它的盘根本不是从有限集里取的。
 * 分成十二宫是后加的一层量化，不是它本来的样子。
 * 这条分界跨在「东方／西方」之上，却常被归入文化差异 —— 它是数学差异。
 *
 * ## 这里的数分两种
 *
 * 标 `computed` 的是**算出来或数出来**的；标 `declared` 的是按起例推出的组合数，
 * 本项目没有那套引擎，故没有实测背书。两者不混为一谈。
 */

import type { CoinThrow } from "../liuyao/cast.js";
import { ziweiStateSpace } from "../ziwei/chart.js";

export interface StateSpace {
  readonly system: string;
  /** 结果是有限个符号组合，还是连续量。 */
  readonly kind: "离散" | "连续";
  /** 离散时的状态数；连续时为 null。 */
  readonly size: number | null;
  readonly basis: "computed" | "declared";
  readonly note: string;
}

// ─────────────────────────────────────────────────────────
// 四柱
// ─────────────────────────────────────────────────────────

/**
 * 四柱的状态数 —— **不是 60⁴**。
 *
 * 八个字看起来是四组独立的干支，其实只有四个自由度：
 *
 * ```
 * 年柱   60      自由
 * 月支   12      自由（由节气定）
 * 月干    —      由年干与月支唯一决定（五虎遁）
 * 日柱   60      自由（六十甲子连续计数）
 * 时支   12      自由
 * 时干    —      由日干与时支唯一决定（五鼠遁）
 * ```
 *
 * 故 60 × 12 × 60 × 12 = 518400，而非 60⁴ = 12960000 —— 差 25 倍。
 * 那两条「唯一决定」由 {@link sizhuRuleHolds} 在真盘上验证。
 */
export const SIZHU_STATES = 60 * 12 * 60 * 12;
export const SIZHU_NAIVE = 60 ** 4;

/**
 * 验证「月干由年干与月支定、时干由日干与时支定」。
 *
 * 给一组真盘，若同一个 (年干, 月支) 出现过两个不同的月干，规则就不成立，
 * 上面那个状态数也就错了。本函数返回冲突数，应恒为 0。
 */
export function sizhuRuleHolds(
  charts: readonly {
    year: { stem: string }; month: { stem: string; branch: string };
    day: { stem: string }; hour: { stem: string; branch: string } | null;
  }[],
): { readonly conflicts: number; readonly checked: number } {
  const m = new Map<string, string>();
  const h = new Map<string, string>();
  let conflicts = 0; let checked = 0;
  for (const c of charts) {
    const k1 = `${c.year.stem}|${c.month.branch}`;
    if (m.get(k1) !== undefined && m.get(k1) !== c.month.stem) conflicts++;
    m.set(k1, c.month.stem);
    checked++;
    if (c.hour === null) continue;
    const k2 = `${c.day.stem}|${c.hour.branch}`;
    if (h.get(k2) !== undefined && h.get(k2) !== c.hour.stem) conflicts++;
    h.set(k2, c.hour.stem);
  }
  return { conflicts, checked };
}

// ─────────────────────────────────────────────────────────
// 六爻
// ─────────────────────────────────────────────────────────

/**
 * 掷钱法的状态数。
 *
 * 每爻四种（老阳、少阴、少阳、老阴），六爻独立 → 4⁶ = 4096 种掷法。
 * 而掷法到「本卦 + 动爻集合」是**一一对应**的：爻性定本卦的那一位，
 * 老少定它动不动。故状态数恰为 4096 = 64 本卦 × 64 动爻子集。
 *
 * ⚠️ 不是 64 × 64 = 4096「本卦 × 变卦」—— 那个说法凑巧同数却是错的：
 * 变卦由本卦与动爻集合决定，不是自由的。六爻皆静时根本没有变卦。
 */
export const LIUYAO_COIN_STATES = 4 ** 6;

/** 逐一枚举掷法，数出不同的（本卦, 动爻集合）。应等于 4096。 */
export function liuyaoCoinEnumeration(): number {
  const seen = new Set<string>();
  for (let n = 0; n < 4096; n++) {
    const throws = Array.from({ length: 6 }, (_, i) => ((n >> (i * 2)) & 3) as CoinThrow);
    // 阳面数 3 或 1 为阳爻；3 与 0 为动
    const lines = throws.map((t) => (t === 3 || t === 1 ? 1 : 0));
    const moving = throws.map((t) => (t === 3 || t === 0 ? 1 : 0));
    seen.add(lines.join("") + "|" + moving.join(""));
  }
  return seen.size;
}

/**
 * 按时起卦在**一个时辰内**的状态数。
 *
 * 上卦取年月日之和模 8，下卦取年月日时之和模 8，动爻取同一和模 6。
 * 一个时辰内年月日时全部固定 —— 故一个时辰只有**一个**卦。
 * 这不是漏洞，是该方法的前提：卦属于时刻。
 */
export const MEIHUA_TIME_STATES_PER_HOUR = 1;

/**
 * 单数报数法在一个时辰内的状态数。
 *
 * 上卦 = n mod 8，下卦 = (n + 时支数) mod 8，动爻 = (n + 时支数) mod 6。
 * 时支在一个时辰内固定，三者**全由 n 决定**，而 8 与 6 不互素 ——
 * 周期是 lcm(8, 6) = 24。故一个时辰内只有 24 种结果，
 * 不是 64 × 6 = 384，也不是「8 × 6 = 48」。
 */
export const MEIHUA_NUMBER_STATES_PER_HOUR = 24;

// ─────────────────────────────────────────────────────────
// 塔罗
// ─────────────────────────────────────────────────────────

/** 不放回的有序抽取：78 张里取 k 张。 */
export function tarotDraws(k: number, withReversals: boolean): number {
  let n = 1;
  for (let i = 0; i < k; i++) n *= 78 - i;
  return withReversals ? n * 2 ** k : n;
}

// ─────────────────────────────────────────────────────────

export function stateSpaces(): readonly StateSpace[] {
  return Object.freeze([
    {
      system: "四柱", kind: "离散", size: SIZHU_STATES, basis: "computed",
      note: `60 × 12 × 60 × 12。不是 60⁴ = ${SIZHU_NAIVE} —— 月干与时干不自由，`
        + "由五虎遁、五鼠遁唯一决定。",
    },
    {
      system: "六爻（掷钱）", kind: "离散", size: LIUYAO_COIN_STATES, basis: "computed",
      note: "4⁶，逐一枚举 4096 种掷法所得的（本卦, 动爻集合）两两不同。",
    },
    {
      system: "六爻（按时）", kind: "离散", size: MEIHUA_TIME_STATES_PER_HOUR, basis: "computed",
      note: "一个时辰内只有一个卦 —— 同一时辰所有人问所有事得同一卦，"
        + "区分靠取不同的用神。",
    },
    {
      system: "梅花（报数）", kind: "离散", size: MEIHUA_NUMBER_STATES_PER_HOUR, basis: "computed",
      note: "一个时辰内 lcm(8, 6) = 24 种。8 与 6 不互素，故远少于 8 × 6。",
    },
    {
      system: "塔罗（三张，含逆位）", kind: "离散",
      size: tarotDraws(3, true), basis: "computed",
      note: "78 × 77 × 76 × 2³。牌阵越大状态数涨得极快，十张的凯尔特十字已逾 10¹⁸。"
        + "本项目已实现其机制（`tarot/`），这个数与 `spreadStateSpace` 同源。",
    },
    {
      system: "紫微斗数", kind: "离散", size: ziweiStateSpace().distinctCharts,
      basis: "computed",
      note: "输入基数 60 × 12 × 30 × 12 × 2 = 518,400（农历年干支、月、日、时辰、性别），"
        + "穷举后**落到 34,560 张不同的盘** —— 恰好 15 个输入合成一张。"
        + "坍缩主要来自「日 → 紫微落点」是多对一：一局之内三十天只摊到十二宫。"
        + "另一个穷举得出的结果：星曜布局**唯一决定**命宫位置与年干四化，"
        + "故把它们加进比对的键，一张盘都没有多分出来。"
        + "⚠️ 这个数属于**本实现所收星曜**，收更多杂曜会让盘更易区分。",
    },
    {
      system: "西洋占星 / 七政四余", kind: "连续", size: null, basis: "computed",
      note: "⚠️ **它的状态空间不是有限集。** 行星黄经是连续量，上升点随时刻连续变化，"
        + "两张盘可以任意接近而不相同。分十二宫是后加的量化，不是它本来的样子。"
        + "这条分界跨在东西之上 —— 它是数学差异，不是文化差异。"
        + "现在这条可以当场演示而不只是声称：`sky/chart.ts` 起盘，"
        + "把时刻挪动一秒，上升点就换一个值 —— 而四柱挪动一秒，"
        + "除非正落在节上或时辰界上，整张盘逐字不变。"
        + "basis 记为 computed，指的是这个**连续性**是算出来的；"
        + "size 仍为 null，因为它本来就没有一个数。",
    },
  ]);
}

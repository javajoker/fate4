/**
 * 八卦 —— 六爻的地基。
 *
 * ## 爻的存放次序
 *
 * **自下而上**，下标 0 为初爻。全项目统一，不设第二种。
 * 卦画写作 `☰` 时视觉上是自上而下，容易反 —— 故凡涉及顺序处一律注明。
 *
 * ## 先天数不是约定，是二进制
 *
 * 乾1 兑2 离3 震4 巽5 坎6 艮7 坤8 常被当作一张要背的表。
 * 它其实是二进制：**自下而上读三爻，初爻为最高位，阳记 0、阴记 1，所得数加一**。
 *
 * ```
 *        初二三   位值        初二三
 * 乾 ☰   阳阳阳 → 000 = 0 → 1    巽 ☴   阴阳阳 → 100 = 4 → 5
 * 兑 ☱   阳阳阴 → 001 = 1 → 2    坎 ☵   阴阳阴 → 101 = 5 → 6
 * 离 ☲   阳阴阳 → 010 = 2 → 3    艮 ☶   阴阴阳 → 110 = 6 → 7
 * 震 ☳   阳阴阴 → 011 = 3 → 4    坤 ☷   阴阴阴 → 111 = 7 → 8
 * ```
 *
 * 初稿的注释把位序写成「自上而下」，八卦里只有乾坤两个对得上 ——
 * 由测试当场逮到。这条性质由测试断言：表若抄错，二进制对不上。
 */

import type { Element } from "../types/ganzhi.js";

export type Yao = 0 | 1;
export type TrigramName = "乾" | "兑" | "离" | "震" | "巽" | "坎" | "艮" | "坤";

export interface Trigram {
  readonly name: TrigramName;
  /** 三爻，自下而上。 */
  readonly lines: readonly [Yao, Yao, Yao];
  /** 先天八卦数 1–8。 */
  readonly xiantian: number;
  readonly element: Element;
  readonly symbol: string;
  /** 卦象所指 —— 只作叙述素材，不参与任何计算。 */
  readonly image: string;
}

export const TRIGRAMS: readonly Trigram[] = Object.freeze([
  { name: "乾", lines: [1, 1, 1], xiantian: 1, element: "金", symbol: "☰", image: "天" },
  { name: "兑", lines: [1, 1, 0], xiantian: 2, element: "金", symbol: "☱", image: "泽" },
  { name: "离", lines: [1, 0, 1], xiantian: 3, element: "火", symbol: "☲", image: "火" },
  { name: "震", lines: [1, 0, 0], xiantian: 4, element: "木", symbol: "☳", image: "雷" },
  { name: "巽", lines: [0, 1, 1], xiantian: 5, element: "木", symbol: "☴", image: "风" },
  { name: "坎", lines: [0, 1, 0], xiantian: 6, element: "水", symbol: "☵", image: "水" },
  { name: "艮", lines: [0, 0, 1], xiantian: 7, element: "土", symbol: "☶", image: "山" },
  { name: "坤", lines: [0, 0, 0], xiantian: 8, element: "土", symbol: "☷", image: "地" },
]);

export const TRIGRAM_BY_NAME: ReadonlyMap<TrigramName, Trigram> =
  new Map(TRIGRAMS.map((t) => [t.name, t]));

/** 先天数 → 卦。起卦法用它，故 8 与 0 都要能落到坤。 */
export const trigramByXiantian = (n: number): Trigram => {
  const k = ((n - 1) % 8 + 8) % 8;
  return TRIGRAMS[k]!;
};

const keyOf = (lines: readonly Yao[]): string => lines.join("");
const BY_LINES: ReadonlyMap<string, Trigram> = new Map(TRIGRAMS.map((t) => [keyOf(t.lines), t]));

/** 三爻（自下而上）→ 卦。 */
export function trigramOf(lines: readonly [Yao, Yao, Yao]): Trigram {
  const t = BY_LINES.get(keyOf(lines));
  if (t === undefined) throw new Error(`非法的三爻组合 ${keyOf(lines)}`);
  return t;
}

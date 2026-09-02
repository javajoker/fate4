/**
 * 六十四卦、京房八宫与世应。
 *
 * ## 八宫**生成**，不转录
 *
 * 京房八宫的次序是一条机械规则，不是要背的表：
 *
 * ```
 * 本宫（八纯）→ 一世（初爻变）→ 二世（再变二爻）→ 三世 → 四世 → 五世
 *            → 游魂（五世卦的第四爻变回）
 *            → 归魂（游魂卦的下卦整个变回本宫的下卦）
 * ```
 *
 * 照规则生成，比逐行抄 64 条可靠得多；而且**生成出的 64 个恰好是全部 64 个**
 * 本身就是一条硬校验 —— 规则若写错，必然出现重复或缺漏。
 * 转录只剩卦名一项，那是标准化程度最高、也最容易核对的部分。
 *
 * 以乾宫验规则：
 * `乾111111 → 姤011111 → 遁001111 → 否000111 → 观000011 → 剥000001
 *  → 晋000101（四爻变回）→ 大有111101（下卦复乾）`
 *
 * ## 世应
 *
 * 世爻位置只由**宫内次序**定，与卦画无关：
 *
 * | 次序 | 本宫 | 一世 | 二世 | 三世 | 四世 | 五世 | 游魂 | 归魂 |
 * | 世爻 | 6 | 1 | 2 | 3 | 4 | 5 | 4 | 3 |
 *
 * 应爻恒与世爻相隔三位。**世为我方，应为他方** —— 占自身即以世爻为用神。
 */

import { TRIGRAMS, TRIGRAM_BY_NAME, trigramOf, type TrigramName, type Yao } from "./trigrams.js";
import type { Element } from "../types/ganzhi.js";

/** 六爻，自下而上。下标 0 为初爻。 */
export type Hexagram = readonly [Yao, Yao, Yao, Yao, Yao, Yao];

export type PalaceRank =
  | "本宫" | "一世" | "二世" | "三世" | "四世" | "五世" | "游魂" | "归魂";

export const PALACE_RANKS: readonly PalaceRank[] = Object.freeze([
  "本宫", "一世", "二世", "三世", "四世", "五世", "游魂", "归魂",
]);

/** 各次序的世爻位（1–6，1 为初爻）。 */
export const SHI_POSITION: Readonly<Record<PalaceRank, number>> = Object.freeze({
  本宫: 6, 一世: 1, 二世: 2, 三世: 3, 四世: 4, 五世: 5, 游魂: 4, 归魂: 3,
});

/** 应爻恒与世爻相隔三位。 */
export const yingOf = (shi: number): number => ((shi - 1 + 3) % 6) + 1;

export interface HexagramInfo {
  readonly name: string;
  readonly lines: Hexagram;
  readonly lower: TrigramName;
  readonly upper: TrigramName;
  /** 所属八宫。 */
  readonly palace: TrigramName;
  readonly palaceElement: Element;
  readonly rank: PalaceRank;
  /** 世爻位 1–6。 */
  readonly shi: number;
  /** 应爻位 1–6。 */
  readonly ying: number;
}

// ─────────────────────────────────────────────────────────
// 卦名表 —— 唯一需要转录的部分。行为上卦，列为下卦。
// ─────────────────────────────────────────────────────────

const ORDER: readonly TrigramName[] = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"];

/** `NAMES[上卦][下卦]`。 */
const NAMES: Readonly<Record<TrigramName, Readonly<Record<TrigramName, string>>>> = Object.freeze({
  乾: { 乾: "乾为天", 兑: "天泽履", 离: "天火同人", 震: "天雷无妄", 巽: "天风姤", 坎: "天水讼", 艮: "天山遁", 坤: "天地否" },
  兑: { 乾: "泽天夬", 兑: "兑为泽", 离: "泽火革", 震: "泽雷随", 巽: "泽风大过", 坎: "泽水困", 艮: "泽山咸", 坤: "泽地萃" },
  离: { 乾: "火天大有", 兑: "火泽睽", 离: "离为火", 震: "火雷噬嗑", 巽: "火风鼎", 坎: "火水未济", 艮: "火山旅", 坤: "火地晋" },
  震: { 乾: "雷天大壮", 兑: "雷泽归妹", 离: "雷火丰", 震: "震为雷", 巽: "雷风恒", 坎: "雷水解", 艮: "雷山小过", 坤: "雷地豫" },
  巽: { 乾: "风天小畜", 兑: "风泽中孚", 离: "风火家人", 震: "风雷益", 巽: "巽为风", 坎: "风水涣", 艮: "风山渐", 坤: "风地观" },
  坎: { 乾: "水天需", 兑: "水泽节", 离: "水火既济", 震: "水雷屯", 巽: "水风井", 坎: "坎为水", 艮: "水山蹇", 坤: "水地比" },
  艮: { 乾: "山天大畜", 兑: "山泽损", 离: "山火贲", 震: "山雷颐", 巽: "山风蛊", 坎: "山水蒙", 艮: "艮为山", 坤: "山地剥" },
  坤: { 乾: "地天泰", 兑: "地泽临", 离: "地火明夷", 震: "地雷复", 巽: "地风升", 坎: "地水师", 艮: "地山谦", 坤: "坤为地" },
});

// ─────────────────────────────────────────────────────────

const flip = (h: Hexagram, i: number): Hexagram => {
  const out = [...h] as Yao[];
  out[i] = (out[i] === 1 ? 0 : 1) as Yao;
  return out as unknown as Hexagram;
};

const lowerOf = (h: Hexagram): TrigramName => trigramOf([h[0], h[1], h[2]]).name;
const upperOf = (h: Hexagram): TrigramName => trigramOf([h[3], h[4], h[5]]).name;
export const nameOf = (h: Hexagram): string => NAMES[upperOf(h)][lowerOf(h)];
export const keyOf = (h: Hexagram): string => h.join("");

/** 生成一宫的八卦，按 {@link PALACE_RANKS} 次序。 */
function palaceSeries(palace: TrigramName): Hexagram[] {
  const t = TRIGRAM_BY_NAME.get(palace)!;
  const pure = [...t.lines, ...t.lines] as unknown as Hexagram;
  const out: Hexagram[] = [pure];
  let cur = pure;
  for (let i = 0; i < 5; i++) { cur = flip(cur, i); out.push(cur); }   // 一世 → 五世
  const you = flip(cur, 3);                                            // 游魂：四爻变回
  out.push(you);
  out.push([t.lines[0], t.lines[1], t.lines[2], you[3], you[4], you[5]] as Hexagram); // 归魂
  return out;
}

const ALL: HexagramInfo[] = [];
for (const palace of ORDER) {
  const t = TRIGRAM_BY_NAME.get(palace)!;
  palaceSeries(palace).forEach((lines, i) => {
    const rank = PALACE_RANKS[i]!;
    const shi = SHI_POSITION[rank];
    ALL.push({
      name: nameOf(lines), lines,
      lower: lowerOf(lines), upper: upperOf(lines),
      palace, palaceElement: t.element, rank, shi, ying: yingOf(shi),
    });
  });
}

/** 六十四卦，按八宫次序：乾、兑、离、震、巽、坎、艮、坤，每宫八卦。 */
export const HEXAGRAMS: readonly HexagramInfo[] = Object.freeze(ALL);

const BY_KEY: ReadonlyMap<string, HexagramInfo> = new Map(ALL.map((h) => [keyOf(h.lines), h]));

export function hexagramOf(lines: Hexagram): HexagramInfo {
  const h = BY_KEY.get(keyOf(lines));
  if (h === undefined) throw new Error(`查不到卦 ${keyOf(lines)}`);
  return h;
}

/** 由上下卦组卦。 */
export const composeHexagram = (lower: TrigramName, upper: TrigramName): Hexagram => {
  const l = TRIGRAM_BY_NAME.get(lower)!; const u = TRIGRAM_BY_NAME.get(upper)!;
  return [...l.lines, ...u.lines] as unknown as Hexagram;
};

/** 八纯卦 —— 上下同卦者，恰为八宫的本宫卦。 */
export const PURE_HEXAGRAMS: readonly HexagramInfo[] =
  Object.freeze(TRIGRAMS.map((t) => hexagramOf(composeHexagram(t.name, t.name))));

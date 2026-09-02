/**
 * 京房纳甲、六亲与六神。
 *
 * ## 纳甲
 *
 * 内卦（初、二、三爻）与外卦（四、五、上爻）**各自**纳一组干支，自下而上。
 * 天干由卦定，地支按各卦的次序推。
 *
 * ⚠️ **坤、巽、离、兑四卦的地支是逆行的**（乙未 → 乙巳 → 乙卯），不是笔误。
 * 阳卦顺行、阴卦逆行，与十二长生的阳顺阴逆同一个思路。
 *
 * ## 六亲不分阴阳，十神分
 *
 * 六亲以**卦宫五行**为「我」，比对爻支五行，得五位；
 * 四柱的十神以日主为「我」，再按阴阳分成十位。同一套生克，两种粒度。
 * 故此处复用 `ganzhi/algebra.ts` 里那组反向查表的具名函数 ——
 * 写成 `CONTROLS[我]` 会把「我克者（妻财）」与「克我者（官鬼）」整个对调，
 * 这个方向错误在四柱那边犯过三次。
 *
 * ## 六神不入力量
 *
 * 六神由日干起，只作事象修饰（青龙主喜庆、白虎主刚急……），
 * **不参与任何生克计算** —— 与四柱的「神煞不入权重」同构。
 */

import type { Branch, Element, Stem } from "../types/ganzhi.js";
import { branchElement, controlledBy, generatedBy } from "../ganzhi/algebra.js";
import { CONTROLS, GENERATES } from "../ganzhi/tables.js";
import type { TrigramName } from "./trigrams.js";

export type Liuqin = "父母" | "兄弟" | "子孙" | "妻财" | "官鬼";
export type Liushen = "青龙" | "朱雀" | "勾陈" | "腾蛇" | "白虎" | "玄武";

export interface NajiaHalf {
  readonly stem: Stem;
  /** 三爻的地支，自下而上。 */
  readonly branches: readonly [Branch, Branch, Branch];
}

/** 纳甲表。`inner` 配初二三爻，`outer` 配四五上爻。 */
export const NAJIA: Readonly<Record<TrigramName, { readonly inner: NajiaHalf; readonly outer: NajiaHalf }>> =
  Object.freeze({
    乾: { inner: { stem: "甲", branches: ["子", "寅", "辰"] }, outer: { stem: "壬", branches: ["午", "申", "戌"] } },
    坤: { inner: { stem: "乙", branches: ["未", "巳", "卯"] }, outer: { stem: "癸", branches: ["丑", "亥", "酉"] } },
    震: { inner: { stem: "庚", branches: ["子", "寅", "辰"] }, outer: { stem: "庚", branches: ["午", "申", "戌"] } },
    巽: { inner: { stem: "辛", branches: ["丑", "亥", "酉"] }, outer: { stem: "辛", branches: ["未", "巳", "卯"] } },
    坎: { inner: { stem: "戊", branches: ["寅", "辰", "午"] }, outer: { stem: "戊", branches: ["申", "戌", "子"] } },
    离: { inner: { stem: "己", branches: ["卯", "丑", "亥"] }, outer: { stem: "己", branches: ["酉", "未", "巳"] } },
    艮: { inner: { stem: "丙", branches: ["辰", "午", "申"] }, outer: { stem: "丙", branches: ["戌", "子", "寅"] } },
    兑: { inner: { stem: "丁", branches: ["巳", "卯", "丑"] }, outer: { stem: "丁", branches: ["亥", "酉", "未"] } },
  });

/**
 * 六亲 —— 以卦宫五行为我。
 *
 * | 关系 | 六亲 |
 * | 同我 | 兄弟 |
 * | 我生 | 子孙 |
 * | 我克 | 妻财 |
 * | 克我 | 官鬼 |
 * | 生我 | 父母 |
 */
export function liuqinOf(palaceElement: Element, yaoElement: Element): Liuqin {
  if (yaoElement === palaceElement) return "兄弟";
  if (yaoElement === GENERATES[palaceElement]) return "子孙";
  if (yaoElement === CONTROLS[palaceElement]) return "妻财";
  if (yaoElement === controlledBy(palaceElement)) return "官鬼";
  if (yaoElement === generatedBy(palaceElement)) return "父母";
  throw new Error(`${palaceElement} 与 ${yaoElement} 之间无生克关系 —— 五行表有误`);
}

/** 由爻的地支直接取六亲。 */
export const liuqinOfBranch = (palaceElement: Element, b: Branch): Liuqin =>
  liuqinOf(palaceElement, branchElement(b));

export const LIUSHEN_ORDER: readonly Liushen[] = Object.freeze([
  "青龙", "朱雀", "勾陈", "腾蛇", "白虎", "玄武",
]);

/** 六神由日干起于初爻。甲乙起青龙、丙丁朱雀、戊勾陈、己腾蛇、庚辛白虎、壬癸玄武。 */
const LIUSHEN_START: Readonly<Record<Stem, number>> = Object.freeze({
  甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5,
});

/** 六神自初爻向上排，返回长度 6 的数组（下标 0 为初爻）。 */
export function liushenOf(dayStem: Stem): readonly Liushen[] {
  const s = LIUSHEN_START[dayStem];
  return Object.freeze(
    Array.from({ length: 6 }, (_, i) => LIUSHEN_ORDER[(s + i) % 6]!),
  );
}

/** 六神的传统事象 —— 只作叙述素材，不参与计算。 */
export const LIUSHEN_IMAGE: Readonly<Record<Liushen, string>> = Object.freeze({
  青龙: "喜庆、财喜、酒色",
  朱雀: "口舌、文书、音信",
  勾陈: "田土、迟滞、牵连",
  腾蛇: "虚惊、怪异、缠绕",
  白虎: "刚急、伤病、丧服",
  玄武: "暗昧、盗失、私情",
});

/** 六亲的通用指代 —— 占事分类的依据，见 docs/13-liuyao.md §5.1。 */
export const LIUQIN_SCOPE: Readonly<Record<Liuqin, string>> = Object.freeze({
  父母: "父母长辈、师长、文书证件、房屋车辆、学业消息",
  兄弟: "兄弟姐妹、同辈朋友、同事、竞争者、劫财之神",
  子孙: "子女晚辈、下属、宠物、医药、解忧之神",
  妻财: "财物钱粮、薪资、货物；男占则兼指妻或女友",
  官鬼: "职位官职、名分、官非讼事、忧疑；女占则兼指夫或男友",
});

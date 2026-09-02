/**
 * 大六壬的静态表。
 *
 * ## 与四柱、六爻共用的部分
 *
 * 干支代数、五行生克、冲合、节气 —— 全部复用 `ganzhi` 与 `astro`。
 * 六壬新增的只有四张表：日干寄宫、十二月将、十二天将、贵人起例。
 */

import type { Branch, Stem } from "../types/ganzhi.js";

/**
 * 日干寄宫 —— 天干无位，寄于地支。
 *
 * 四课的第一课以它为下神，故它是整个课体的起点。
 * 戊寄巳与丙同，己寄未与丁同 —— 土随火位，这是六壬与四柱不同的一处。
 */
export const JIGONG: Readonly<Record<Stem, Branch>> = Object.freeze({
  甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳",
  己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑",
});

export interface YuejiangDef {
  readonly branch: Branch;
  readonly name: string;
  /** 自该中气起用此将。 */
  readonly fromZhongqi: string;
}

/**
 * 十二月将 —— 太阳所在之宫，**以中气为界**。
 *
 * 注意两点：
 * 1. 月将随太阳**逆行**十二支（雨水后用亥、春分后用戌……），与月建的顺行相反
 * 2. 界在**中气**，不在节 —— 四柱的月柱以节为界，两者不可混
 */
export const YUEJIANG: readonly YuejiangDef[] = Object.freeze([
  { branch: "亥", name: "登明", fromZhongqi: "雨水" },
  { branch: "戌", name: "河魁", fromZhongqi: "春分" },
  { branch: "酉", name: "从魁", fromZhongqi: "谷雨" },
  { branch: "申", name: "传送", fromZhongqi: "小满" },
  { branch: "未", name: "小吉", fromZhongqi: "夏至" },
  { branch: "午", name: "胜光", fromZhongqi: "大暑" },
  { branch: "巳", name: "太乙", fromZhongqi: "处暑" },
  { branch: "辰", name: "天罡", fromZhongqi: "秋分" },
  { branch: "卯", name: "太冲", fromZhongqi: "霜降" },
  { branch: "寅", name: "功曹", fromZhongqi: "小雪" },
  { branch: "丑", name: "大吉", fromZhongqi: "冬至" },
  { branch: "子", name: "神后", fromZhongqi: "大寒" },
]);

export const YUEJIANG_BY_BRANCH: ReadonlyMap<Branch, YuejiangDef> =
  new Map(YUEJIANG.map((y) => [y.branch, y]));

export type TianjiangName =
  | "贵人" | "螣蛇" | "朱雀" | "六合" | "勾陈" | "青龙"
  | "天空" | "白虎" | "太常" | "玄武" | "太阴" | "天后";

/** 十二天将的固定次序。顺布逆布都按此序，只是方向不同。 */
export const TIANJIANG: readonly TianjiangName[] = Object.freeze([
  "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙",
  "天空", "白虎", "太常", "玄武", "太阴", "天后",
]);

/**
 * 贵人起例 —— 口诀「甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎」。
 *
 * 前一位为昼贵，后一位为夜贵。昼夜之分**以卯至申为昼、酉至寅为夜**，
 * 按占时（时支）判，不按日出日落 —— 后者要地理纬度，而六壬课式历来只取时支。
 */
export const GUIREN: Readonly<Record<Stem, { readonly day: Branch; readonly night: Branch }>> =
  Object.freeze({
    甲: { day: "丑", night: "未" }, 戊: { day: "丑", night: "未" }, 庚: { day: "丑", night: "未" },
    乙: { day: "子", night: "申" }, 己: { day: "子", night: "申" },
    丙: { day: "亥", night: "酉" }, 丁: { day: "亥", night: "酉" },
    壬: { day: "卯", night: "巳" }, 癸: { day: "卯", night: "巳" },
    辛: { day: "午", night: "寅" },
  });

/** 昼占之时 —— 卯至申。 */
export const DAY_HOURS: readonly Branch[] = Object.freeze(["卯", "辰", "巳", "午", "未", "申"]);

/** 三合局的驿马 —— 返吟无克时取之为初传。申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳。 */
export const YIMA: Readonly<Record<Branch, Branch>> = Object.freeze({
  申: "寅", 子: "寅", 辰: "寅",
  寅: "申", 午: "申", 戌: "申",
  巳: "亥", 酉: "亥", 丑: "亥",
  亥: "巳", 卯: "巳", 未: "巳",
});

/** 孟仲季 —— 涉害取深浅相等时的最后一道取舍。 */
export const MENG: readonly Branch[] = Object.freeze(["寅", "申", "巳", "亥"]);
export const ZHONG: readonly Branch[] = Object.freeze(["子", "午", "卯", "酉"]);
export const JI: readonly Branch[] = Object.freeze(["辰", "戌", "丑", "未"]);

/** 地支相刑 —— 伏吟课的中末传取刑。 */
export const XING: Readonly<Record<Branch, Branch>> = Object.freeze({
  子: "卯", 卯: "子",
  寅: "巳", 巳: "申", 申: "寅",
  丑: "戌", 戌: "未", 未: "丑",
  辰: "辰", 午: "午", 酉: "酉", 亥: "亥",
});

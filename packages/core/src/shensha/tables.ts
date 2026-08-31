/**
 * 神煞起例表。
 *
 * **凡可推导者一律推导，只把无法推导的列为字面量表。**
 * 三合局类（驿马、桃花、华盖、将星、亡神、劫煞、灾煞、六厄）全部由三合局位置推出；
 * 金舆 = 禄前二辰；天医 = 月支前一位；学堂 = 同五行阳干的长生位；
 * 孤辰寡宿 = 三会方的后一位与前一位；天喜 = 红鸾之冲。
 * 推导式与字面量表由 test/shensha.spec.ts 双向核对。
 */

import type { Branch, Stem } from "../types/ganzhi.js";

export type ShenshaBase =
  | "dayStem" | "yearStem" | "dayBranch" | "yearBranch"
  | "monthBranch" | "pillar" | "combination";

export type ShenshaCategory =
  | "noble" | "peach" | "travel" | "canopy" | "blade"
  | "solitary" | "punish" | "void" | "other";

export interface ShenshaDef {
  readonly name: string;
  readonly base: ShenshaBase;
  readonly category: ShenshaCategory;
  readonly polarity: "auspicious" | "inauspicious" | "neutral";
  readonly narrativeTags: readonly string[];
  /** 有争议、默认不启用者。 */
  readonly disputed?: boolean;
}

// ─────────────────────────────────────────────────────────
// 以天干起（无法推导，列表）
// ─────────────────────────────────────────────────────────

/** 天乙贵人：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎。 */
export const TIANYI: Readonly<Record<Stem, readonly Branch[]>> = Object.freeze({
  甲: ["丑", "未"], 戊: ["丑", "未"], 庚: ["丑", "未"],
  乙: ["子", "申"], 己: ["子", "申"],
  丙: ["亥", "酉"], 丁: ["亥", "酉"],
  壬: ["卯", "巳"], 癸: ["卯", "巳"],
  辛: ["午", "寅"],
});

export const TAIJI: Readonly<Record<Stem, readonly Branch[]>> = Object.freeze({
  甲: ["子", "午"], 乙: ["子", "午"],
  丙: ["卯", "酉"], 丁: ["卯", "酉"],
  戊: ["辰", "戌", "丑", "未"], 己: ["辰", "戌", "丑", "未"],
  庚: ["寅", "亥"], 辛: ["寅", "亥"],
  壬: ["巳", "申"], 癸: ["巳", "申"],
});

export const WENCHANG: Readonly<Record<Stem, Branch>> = Object.freeze({
  甲: "巳", 乙: "午", 丙: "申", 丁: "酉", 戊: "申",
  己: "酉", 庚: "亥", 辛: "子", 壬: "寅", 癸: "卯",
});

export const HONGYAN: Readonly<Record<Stem, Branch>> = Object.freeze({
  甲: "午", 乙: "午", 丙: "寅", 丁: "未", 戊: "辰",
  己: "辰", 庚: "戌", 辛: "酉", 壬: "子", 癸: "申",
});

export const LIUXIA: Readonly<Record<Stem, Branch>> = Object.freeze({
  甲: "酉", 乙: "戌", 丙: "未", 丁: "申", 戊: "巳",
  己: "午", 庚: "辰", 辛: "卯", 壬: "亥", 癸: "寅",
});

// ─────────────────────────────────────────────────────────
// 以月支起（天德干支混列，非笔误）
// ─────────────────────────────────────────────────────────

/** 天德贵人。取值有干有支 —— 天德本就干支混列，命中判定须同时扫两层。 */
export const TIANDE: Readonly<Record<Branch, Stem | Branch>> = Object.freeze({
  寅: "丁", 卯: "申", 辰: "壬", 巳: "辛", 午: "亥", 未: "甲",
  申: "癸", 酉: "寅", 戌: "丙", 亥: "乙", 子: "巳", 丑: "庚",
});

// ─────────────────────────────────────────────────────────
// 以日柱（或时柱）整柱定
// ─────────────────────────────────────────────────────────

export const KUIGANG: readonly string[] = Object.freeze(["庚辰", "壬辰", "戊戌", "庚戌"]);
export const RIDE: readonly string[] = Object.freeze(["甲寅", "丙辰", "戊辰", "庚辰", "壬戌"]);
export const RIGUI: readonly string[] = Object.freeze(["丁酉", "丁亥", "癸卯", "癸巳"]);
export const SHIE_DABAI: readonly string[] = Object.freeze(
  ["甲辰", "乙巳", "丙申", "丁亥", "戊戌", "己丑", "庚辰", "辛巳", "壬申", "癸亥"]);
export const YINCHA_YANGCUO: readonly string[] = Object.freeze(
  ["丙子", "丙午", "丁丑", "丁未", "戊寅", "戊申", "辛卯", "辛酉", "壬辰", "壬戌", "癸巳", "癸亥"]);
export const BAZHUAN: readonly string[] = Object.freeze(
  ["甲寅", "乙卯", "丁未", "戊戌", "己未", "庚申", "辛酉", "癸丑"]);
export const JIUCHOU: readonly string[] = Object.freeze(
  ["丁酉", "戊子", "戊午", "己卯", "己酉", "辛卯", "辛酉", "壬子", "壬午"]);
export const GULUAN: readonly string[] = Object.freeze(
  ["乙巳", "丁巳", "辛亥", "戊申", "甲寅", "戊午", "壬子", "丙午"]);
/** 金神仅论时柱。 */
export const JINSHEN: readonly string[] = Object.freeze(["乙丑", "己巳", "癸酉"]);

// ─────────────────────────────────────────────────────────
// 组合型
// ─────────────────────────────────────────────────────────

export const SANQI: readonly { readonly name: string; readonly stems: readonly Stem[] }[] =
  Object.freeze([
    { name: "天上三奇", stems: ["甲", "戊", "庚"] },
    { name: "地下三奇", stems: ["乙", "丙", "丁"] },
    { name: "人中三奇", stems: ["壬", "癸", "辛"] },
  ]);

/** 天罗：辰见巳；地网：戌见亥。 */
export const TIANLUO: readonly [Branch, Branch] = Object.freeze(["辰", "巳"]);
export const DIWANG: readonly [Branch, Branch] = Object.freeze(["戌", "亥"]);

// ─────────────────────────────────────────────────────────
// 定义清单：名称 → 起例基准、类别、吉凶倾向、叙述标签
// ─────────────────────────────────────────────────────────

export const SHENSHA_DEFS: readonly ShenshaDef[] = Object.freeze([
  { name: "天乙贵人", base: "dayStem", category: "noble", polarity: "auspicious",
    narrativeTags: ["得助", "逢凶化吉", "贵人扶持"] },
  { name: "太极贵人", base: "dayStem", category: "noble", polarity: "auspicious",
    narrativeTags: ["好学", "玄理", "有始有终"] },
  { name: "文昌贵人", base: "dayStem", category: "noble", polarity: "auspicious",
    narrativeTags: ["文思", "考试", "聪敏"] },
  { name: "金舆", base: "dayStem", category: "noble", polarity: "auspicious",
    narrativeTags: ["车马", "配偶助力", "安逸"] },
  { name: "禄神", base: "dayStem", category: "other", polarity: "auspicious",
    narrativeTags: ["自立", "衣食", "根基"] },
  { name: "羊刃", base: "dayStem", category: "blade", polarity: "inauspicious",
    narrativeTags: ["刚烈", "果决", "血光"] },
  { name: "红艳煞", base: "dayStem", category: "peach", polarity: "neutral",
    narrativeTags: ["多情", "风姿", "感情牵绊"] },
  { name: "流霞", base: "dayStem", category: "other", polarity: "inauspicious",
    narrativeTags: ["酒色", "血光"] },
  { name: "学堂", base: "dayStem", category: "noble", polarity: "auspicious",
    narrativeTags: ["求学", "师承"] },

  { name: "将星", base: "yearBranch", category: "other", polarity: "auspicious",
    narrativeTags: ["统御", "掌权", "核心"] },
  { name: "华盖", base: "yearBranch", category: "canopy", polarity: "neutral",
    narrativeTags: ["孤高", "艺术", "玄学", "宗教"] },
  { name: "桃花", base: "yearBranch", category: "peach", polarity: "neutral",
    narrativeTags: ["人缘", "情感", "才艺"] },
  { name: "驿马", base: "yearBranch", category: "travel", polarity: "neutral",
    narrativeTags: ["迁动", "出行", "变化"] },
  { name: "亡神", base: "yearBranch", category: "punish", polarity: "inauspicious",
    narrativeTags: ["内耗", "算计", "失据"] },
  { name: "劫煞", base: "yearBranch", category: "punish", polarity: "inauspicious",
    narrativeTags: ["夺取", "破财", "意外"] },
  { name: "灾煞", base: "yearBranch", category: "punish", polarity: "inauspicious",
    narrativeTags: ["灾厄", "疾病"] },
  { name: "六厄", base: "yearBranch", category: "punish", polarity: "inauspicious",
    narrativeTags: ["阻滞", "困顿"] },
  { name: "孤辰", base: "yearBranch", category: "solitary", polarity: "inauspicious",
    narrativeTags: ["孤独", "疏离"] },
  { name: "寡宿", base: "yearBranch", category: "solitary", polarity: "inauspicious",
    narrativeTags: ["孤独", "疏离"] },
  { name: "红鸾", base: "yearBranch", category: "peach", polarity: "auspicious",
    narrativeTags: ["婚姻", "喜庆"] },
  { name: "天喜", base: "yearBranch", category: "peach", polarity: "auspicious",
    narrativeTags: ["喜庆", "和顺"] },

  { name: "天德贵人", base: "monthBranch", category: "noble", polarity: "auspicious",
    narrativeTags: ["化解", "庇佑"] },
  { name: "月德贵人", base: "monthBranch", category: "noble", polarity: "auspicious",
    narrativeTags: ["宽厚", "庇佑"] },
  { name: "天医", base: "monthBranch", category: "other", polarity: "auspicious",
    narrativeTags: ["医药", "疗愈"] },

  { name: "魁罡", base: "pillar", category: "other", polarity: "neutral",
    narrativeTags: ["刚断", "极端", "掌权"] },
  { name: "日德", base: "pillar", category: "noble", polarity: "auspicious",
    narrativeTags: ["宽厚", "福泽"] },
  { name: "日贵", base: "pillar", category: "noble", polarity: "auspicious",
    narrativeTags: ["清贵"] },
  { name: "十恶大败", base: "pillar", category: "other", polarity: "inauspicious",
    narrativeTags: ["耗散", "根基不固"] },
  { name: "阴差阳错", base: "pillar", category: "other", polarity: "inauspicious",
    narrativeTags: ["姻缘波折", "错位"] },
  { name: "八专", base: "pillar", category: "peach", polarity: "neutral",
    narrativeTags: ["专一", "情感浓烈"] },
  { name: "九丑", base: "pillar", category: "other", polarity: "inauspicious",
    narrativeTags: ["波折"] },
  { name: "孤鸾", base: "pillar", category: "solitary", polarity: "inauspicious",
    narrativeTags: ["独处", "婚缘迟"] },
  { name: "金神", base: "pillar", category: "blade", polarity: "neutral",
    narrativeTags: ["刚锐", "需火制"] },

  { name: "三奇", base: "combination", category: "noble", polarity: "auspicious",
    narrativeTags: ["异禀", "非常之才"] },
  { name: "天罗地网", base: "combination", category: "punish", polarity: "inauspicious",
    narrativeTags: ["困顿", "牵绊"] },
  { name: "空亡", base: "combination", category: "void", polarity: "neutral",
    narrativeTags: ["虚空", "不着实"] },
]);

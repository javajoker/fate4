/**
 * 十神与五行的特质对照表。
 *
 * ## 用词的约束
 *
 * 一律取**传统命理的常用表述**（自守、仗义、内秀、锋芒、务实、果决、涵养…），
 * **不用心理学量表的词汇**（外向、宜人性、神经质、大五）。
 *
 * 混用会制造虚假的科学感：读者会以为这些词背后有心理测量学的效度，而它们没有。
 * 传统词汇的好处恰恰在于它自带出处 —— 读者知道那是命理的说法，
 * 而不会误以为是某种测量结果。
 *
 * ## 为什么必须四栏
 *
 * 同一个十神，旺与弱的表述**相反**：
 * 食神适中为温和从容，太过则疏懒无争；七杀有制为果决开创，无制则暴戾多惊。
 * 只给一栏，强弱两端会说同样的话，那张表就废了。
 *
 * 内与外的分别取「透干为显，藏支为隐」—— 同一个十神，
 * 藏而不透是心里那一面，透干显用是外人看见的那一面。
 *
 * ## 底本
 *
 * 十神的性格对应在典籍中分布很散，不像《穷通宝鉴》那样有现成的表可转录。
 * 本表为**通行表述**（`persona.source: conventional`），随盘声明，允许替换。
 * 列入待校准清单第 17 项。
 */

import { TEN_GODS, type Element, type TenGod } from "../types/ganzhi.js";

export interface GodTrait {
  readonly god: TenGod;
  /** 藏而不透 —— 心里的那一面。 */
  readonly inner: readonly string[];
  /** 透干显用 —— 外人看见的那一面。 */
  readonly outer: readonly string[];
  /** 过旺。与 outer 常呈同一倾向的过度。 */
  readonly excess: readonly string[];
  /** 过弱或缺。 */
  readonly deficient: readonly string[];
}

export const GOD_TRAITS: Readonly<Record<TenGod, GodTrait>> = Object.freeze({
  比肩: Object.freeze({
    god: "比肩",
    inner: ["自守", "有主见而不外露", "内里执拗"],
    outer: ["自立", "不假外求", "与人并肩"],
    excess: ["固执", "难纳异见", "争强"],
    deficient: ["少主见", "易随人转", "自立之力不足"],
  }),
  劫财: Object.freeze({
    god: "劫财",
    inner: ["怀竞胜之心", "重义而不形于色"],
    outer: ["仗义", "好交游", "敢争"],
    excess: ["急躁好胜", "耗散", "易为人所累"],
    deficient: ["不与人争", "少同侪助力"],
  }),
  食神: Object.freeze({
    god: "食神",
    inner: ["内秀", "自得其乐", "思虑绵长"],
    outer: ["温和从容", "善表达", "有口福"],
    excess: ["疏懒", "耽于安逸", "泄气太过"],
    deficient: ["少舒展", "心思郁而不发"],
  }),
  伤官: Object.freeze({
    god: "伤官",
    inner: ["才思内蕴", "不平之气藏于心"],
    outer: ["锋芒外露", "才艺显", "不喜拘束"],
    excess: ["傲物", "任性", "易招怨"],
    deficient: ["才华无从施展", "拘谨"],
  }),
  偏财: Object.freeze({
    god: "偏财",
    inner: ["有算计而不吝", "机变藏于心"],
    outer: ["慷慨", "善交际", "路数活"],
    excess: ["好挥霍", "事多而不专"],
    deficient: ["财路窄", "不善经营"],
  }),
  正财: Object.freeze({
    god: "正财",
    inner: ["内实而不显", "俭而有度"],
    outer: ["务实", "勤谨", "重实利"],
    excess: ["拘于琐细", "为财所累"],
    deficient: ["不善积蓄", "于实务上疏"],
  }),
  七杀: Object.freeze({
    god: "七杀",
    inner: ["有威而不发", "能忍"],
    outer: ["果决", "有威", "任事而不避难"],
    excess: ["暴戾", "多惊", "所任过重"],
    deficient: ["少约束", "遇事无断"],
  }),
  正官: Object.freeze({
    god: "正官",
    inner: ["自持", "守分而不张扬"],
    outer: ["自律", "守法度", "重名分"],
    excess: ["拘谨", "为名分所缚"],
    deficient: ["少拘束", "不受管束"],
  }),
  偏印: Object.freeze({
    god: "偏印",
    inner: ["好独思", "心思幽深"],
    outer: ["别具见解", "不循常途", "好玄理"],
    excess: ["孤高", "多疑", "与众寡合"],
    deficient: ["少内省", "于偏门之学无缘"],
  }),
  正印: Object.freeze({
    god: "正印",
    inner: ["涵养内蓄", "好学而不炫"],
    outer: ["端方", "好文", "受人庇荫"],
    excess: ["依赖", "优柔", "少行动"],
    deficient: ["少庇荫", "自学自立"],
  }),
});

export interface ElementTrait {
  readonly element: Element;
  /** 五常。《白虎通》一系的通行配属。 */
  readonly virtue: string;
  readonly strong: readonly string[];
  readonly weak: readonly string[];
}

export const ELEMENT_TRAITS: Readonly<Record<Element, ElementTrait>> = Object.freeze({
  木: Object.freeze({ element: "木", virtue: "仁",
    strong: ["条达舒展", "好生"], weak: ["生发不足", "少舒展"] }),
  火: Object.freeze({ element: "火", virtue: "礼",
    strong: ["明朗炎上", "好显"], weak: ["光焰不足", "少温"] }),
  土: Object.freeze({ element: "土", virtue: "信",
    strong: ["厚重持信", "能容"], weak: ["根基薄", "少承载"] }),
  金: Object.freeze({ element: "金", virtue: "义",
    strong: ["肃而有断", "刚"], weak: ["缺决断", "少刚"] }),
  水: Object.freeze({ element: "水", virtue: "智",
    strong: ["润下周流", "机变"], weak: ["少润泽", "机变不足"] }),
});

/** 全部特质词。供测试逐条断言全为中文，并检查无重复堆砌。 */
export function allTraitWords(): string[] {
  const out: string[] = [];
  for (const g of TEN_GODS) {
    const t = GOD_TRAITS[g];
    out.push(...t.inner, ...t.outer, ...t.excess, ...t.deficient);
  }
  for (const t of Object.values(ELEMENT_TRAITS)) out.push(...t.strong, ...t.weak, t.virtue);
  return out;
}

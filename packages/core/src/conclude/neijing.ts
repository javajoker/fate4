/**
 * 《黄帝内经》的五行配属，以及形体的相法配属。
 *
 * ## 一处真实的文本分歧，随表声明
 *
 * 五窍的配属在内经**内部就不一致**：
 *
 * - 《素问·阴阳应象大论》：心「在窍为舌」，肾「在窍为耳」
 * - 《素问·金匮真言论》：心「开窍于耳」，肾「开窍于二阴」
 *
 * 默认取阴阳应象大论一系（亦即后世系统化之后的主流）。
 * 这是**流派选择**，不是唯一正解，故进参数 `persona.wuqiaoSource`，
 * 随盘声明 —— 与十二长生、土的长生同等对待，不静默择一。
 *
 * ## 底本
 *
 * 全表标 `conventional`（通行表述），列入待校准清单第 15 项。
 * 待指定版本（人卫本？四库本？）后逐格核对替换。
 *
 * ## 这张表怎么用
 *
 * 只做一件事：**指出本盘哪个五行最旺、最弱、受克最重，然后把对应的一格念出来。**
 * 不作任何推论。措辞的固定形状见 report/templates.ts，
 * 由 `zh.body.framing`（段级双条件）与 `zh.medical.diseaseName`（无条件）两条规则强制。
 */

import { ELEMENTS, type Element } from "../types/ganzhi.js";

export type WuqiaoSource = "yinyangYingxiang" | "jinguiZhenyan";

export interface NeijingRow {
  readonly element: Element;
  /** 五脏。 */
  readonly zang: string;
  /** 六腑（表里相配者）。 */
  readonly fu: string;
  /** 五体。 */
  readonly ti: string;
  /** 五华。 */
  readonly hua: string;
  /** 五液。 */
  readonly ye: string;
  /** 五志。 */
  readonly zhi: string;
  /** 五气（外邪）。 */
  readonly qi: string;
  /** 五味。 */
  readonly wei: string;
  /** 五色。 */
  readonly se: string;
  /** 五时。 */
  readonly shi: string;
  /** 五方。 */
  readonly fang: string;
  /** 形体 —— **不属内经**，来自命理相法的通行表述。 */
  readonly xingti: string;
}

/** 五窍。两派各一套，随参数取用。 */
export const WUQIAO: Readonly<Record<WuqiaoSource, Readonly<Record<Element, string>>>> =
  Object.freeze({
    // 《素问·阴阳应象大论》：肝目、心舌、脾口、肺鼻、肾耳
    yinyangYingxiang: Object.freeze({ 木: "目", 火: "舌", 土: "口", 金: "鼻", 水: "耳" }),
    // 《素问·金匮真言论》：心开窍于耳、肾开窍于二阴
    jinguiZhenyan: Object.freeze({ 木: "目", 火: "耳", 土: "口", 金: "鼻", 水: "二阴" }),
  });

export const NEIJING: Readonly<Record<Element, NeijingRow>> = Object.freeze({
  木: Object.freeze({
    element: "木", zang: "肝", fu: "胆", ti: "筋", hua: "爪", ye: "泪",
    zhi: "怒", qi: "风", wei: "酸", se: "青", shi: "春", fang: "东",
    xingti: "修长挺拔",
  }),
  火: Object.freeze({
    element: "火", zang: "心", fu: "小肠", ti: "脉", hua: "面", ye: "汗",
    zhi: "喜", qi: "暑", wei: "苦", se: "赤", shi: "夏", fang: "南",
    xingti: "尖露明快",
  }),
  土: Object.freeze({
    element: "土", zang: "脾", fu: "胃", ti: "肉", hua: "唇", ye: "涎",
    zhi: "思", qi: "湿", wei: "甘", se: "黄", shi: "长夏", fang: "中",
    xingti: "厚重敦实",
  }),
  金: Object.freeze({
    element: "金", zang: "肺", fu: "大肠", ti: "皮毛", hua: "毛", ye: "涕",
    zhi: "忧", qi: "燥", wei: "辛", se: "白", shi: "秋", fang: "西",
    xingti: "方正结实",
  }),
  水: Object.freeze({
    element: "水", zang: "肾", fu: "膀胱", ti: "骨", hua: "发", ye: "唾",
    zhi: "恐", qi: "寒", wei: "咸", se: "黑", shi: "冬", fang: "北",
    xingti: "圆润灵活",
  }),
});

export function wuqiaoOf(e: Element, source: WuqiaoSource): string {
  return WUQIAO[source][e];
}

/** 全表的字面值，供测试逐格断言与中文校验。 */
export function allNeijingWords(): string[] {
  const out: string[] = [];
  for (const e of ELEMENTS) {
    const r = NEIJING[e];
    out.push(r.zang, r.fu, r.ti, r.hua, r.ye, r.zhi, r.qi, r.wei, r.se, r.shi, r.fang, r.xingti);
    for (const src of Object.keys(WUQIAO) as WuqiaoSource[]) out.push(WUQIAO[src][e]);
  }
  return out;
}

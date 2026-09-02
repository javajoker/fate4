/**
 * 奇门 → 跨体系结构断言。
 *
 * ## 它比六爻、六壬多一条轴：方位
 *
 * 奇门的九宫本就是空间的 —— 坎北、离南、震东、兑西。故「方位」这条轴
 * 只有它说得上话，而 crossref 会如实标为**单侧**，不会让读者误以为另两家默认同意。
 *
 * 这也是把轴定得少而稳的好处：宁可一条轴只有一家表态，
 * 也不要为了凑齐而让另外两家说些它们说不出的话。
 *
 * ## 吉凶不入断言
 *
 * 八门有传统的吉凶分野（开休生为三吉门，死惊伤为三凶门）。
 * 本层**不据此判顺逆** —— 那是对结果的断言。顺逆只看**门与日干的生克**，
 * 与四柱、六爻用的是同一把尺。门的传统事象另作素材，放在 evidence 里陈述。
 */

import type { StructuralClaim } from "../divination/claim.js";
import { branchElement, controls, elementOf, generates } from "../ganzhi/algebra.js";
import type { Element } from "../types/ganzhi.js";
import { DOOR_IMAGE, PALACE_DIRECTION, PALACE_NAME, type Palace } from "./tables.js";
import type { QimenChart } from "./chart.js";

/** 八门的五行。休水、生土、伤木、杜木、景火、死土、惊金、开金。 */
const DOOR_ELEMENT: Readonly<Record<string, Element>> = Object.freeze({
  休门: "水", 生门: "土", 伤门: "木", 杜门: "木",
  景门: "火", 死门: "土", 惊门: "金", 开门: "金",
});

/** 九宫的五行。 */
const PALACE_ELEMENT: Readonly<Record<Palace, Element>> = Object.freeze({
  1: "水", 2: "土", 3: "木", 4: "木", 5: "土",
  6: "金", 7: "金", 8: "土", 9: "火",
});

export function qimenClaims(q: QimenChart): StructuralClaim[] {
  const dayEl = elementOf(q.pillars.day.stem);
  const hourEl = branchElement(q.pillars.hour.branch);
  void hourEl;

  // 我方以日干为准 —— 与六壬同。日干落哪一宫，看地盘。
  const dayStem = q.pillars.day.stem === "甲" ? q.xunshou.yi : q.pillars.day.stem;
  const dayPalace = (Object.keys(q.earth) as unknown as Palace[])
    .map(Number).find((p) => q.earth[p as Palace] === dayStem) as Palace | undefined;
  const home = dayPalace ?? q.hourPalace;
  const homeDoor = q.doors[home];
  const homeEl = PALACE_ELEMENT[home];

  const claims: StructuralClaim[] = [{
    system: "qimen", axis: "我方位置",
    polarity: generates(homeEl, dayEl) || homeEl === dayEl ? "顺"
      : controls(homeEl, dayEl) ? "逆" : "中性",
    evidence: `日干${dayStem}落${PALACE_NAME[home]}（${homeEl}），`
      + `其上${q.stars[home]}、${homeDoor ?? "无门"}、${q.gods[home] ?? "无神"}；`
      + `日干属${dayEl}，宫${generates(homeEl, dayEl) ? "生之" : controls(homeEl, dayEl) ? "克之" : "与之无生克"}`,
    confidence: 0.7,
  }];

  // 阻碍来源：值使门与日干的生克。门之吉凶不入此判。
  const doorEl = DOOR_ELEMENT[q.zhishi]!;
  claims.push({
    system: "qimen", axis: "阻碍来源",
    polarity: controls(doorEl, dayEl) ? "逆" : "中性",
    evidence: `值使${q.zhishi}（${doorEl}）落${PALACE_NAME[q.zhishiPalace]}，`
      + (controls(doorEl, dayEl) ? "克日干" : "不克日干")
      + `。${q.zhishi}传统主${DOOR_IMAGE[q.zhishi]}`,
    confidence: 0.65,
  });

  // 事之动静：局与值符
  claims.push({
    system: "qimen", axis: "事之动静",
    polarity: "中性",
    evidence: `${q.term}${q.yuan}，${q.yin ? "阴" : "阳"}遁 ${q.ju} 局；`
      + `值符${q.zhifu}加临${PALACE_NAME[q.zhifuPalace]}，值使${q.zhishi}落${PALACE_NAME[q.zhishiPalace]}`,
    confidence: 0.8,
  });

  // 方位 —— **只有奇门说得上话**
  claims.push({
    system: "qimen", axis: "方位",
    polarity: "中性",
    evidence: `日干所落之宫在${PALACE_DIRECTION[home]}；`
      + `值符所临在${PALACE_DIRECTION[q.zhifuPalace]}，值使所落在${PALACE_DIRECTION[q.zhishiPalace]}`,
    confidence: 0.7,
  });

  return claims;
}

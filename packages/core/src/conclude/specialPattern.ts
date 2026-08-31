/**
 * 特殊格局：从格 · 专旺格 · 化气格。按序检测，先命中者胜出。
 */

import { ELEMENTS, type Element, type TenGod } from "../types/ganzhi.js";
import { CONTROLS, GENERATES, HIDDEN_STEMS } from "../ganzhi/tables.js";
import type { ConclusionParams } from "../params/types.js";
import type { Branch } from "../types/ganzhi.js";
import type { Carrier } from "../weights/carrier.js";
import { GOD_GROUPS, sumGods, tenGodOf } from "./tenGods.js";
import type { DerivationStep, SpecialPattern, Verdict } from "./types.js";
import { elementOf, polarityOf } from "../ganzhi/algebra.js";

const ZHUANWANG_NAME: Readonly<Record<Element, string>> = Object.freeze({
  木: "曲直仁寿格", 火: "炎上格", 土: "稼穑格", 金: "从革格", 水: "润下格",
});

export interface SpecialInput {
  readonly ratio: number;
  readonly rootScore: number;
  readonly tenGods: Readonly<Record<TenGod, number>>;
  readonly dayMaster: Carrier;
  readonly monthBranch: Branch;
  readonly carriers: readonly Carrier[];
}

export function specialPatternVerdict(
  input: SpecialInput, p: ConclusionParams,
): Verdict<SpecialPattern | null> {
  const { ratio, rootScore, tenGods, dayMaster, monthBranch } = input;
  const derivation: DerivationStep[] = [];

  // ── 化气格：日主与月干或时干五合且 L2 判为化成 ──
  if (p.specialGe.enableHuaqi && dayMaster.flags.includes("TRANSFORMED")) {
    derivation.push({ step: "化气", detail: `日主已被 L2 判为合化，化神为 ${dayMaster.element}` });
    return {
      value: { kind: "huaqi", element: dayMaster.element },
      // 化气格实务误判率高，置信度封顶
      confidence: p.specialGe.huaqiConfidenceCap,
      derivation,
      alternatives: [{
        value: null,
        reason: "化气格成格条件严苛、实务争议大。报告须并列常规扶抑的解读。",
      }],
    };
  }

  // ── 从格 ──
  const yinWeight = sumGods(tenGods, GOD_GROUPS.印星);
  const monthQi = HIDDEN_STEMS[monthBranch][0]!;
  const monthGod = tenGodOf(dayMaster.element, dayMaster.polarity,
    elementOf(monthQi), polarityOf(monthQi));
  const monthSupportsSelf = ([...GOD_GROUPS.比劫, ...GOD_GROUPS.印星] as TenGod[]).includes(monthGod);

  const conggeChecks = [
    { ok: ratio < p.congge.ratioThreshold, why: `r = ${ratio.toFixed(4)} < ${p.congge.ratioThreshold}` },
    { ok: !p.congge.requireRootless || rootScore === 0, why: `通根评分 = ${rootScore.toFixed(3)}` },
    { ok: !monthSupportsSelf, why: `月令本气 ${monthQi} 为${monthGod}` },
    { ok: yinWeight < p.congge.yinThreshold, why: `印星 ${yinWeight.toFixed(2)} < ${p.congge.yinThreshold}` },
  ];
  if (conggeChecks.every((c) => c.ok)) {
    const groups: [string, Element, number][] = [
      ["从财格", godGroupElement(dayMaster.element, "财"), sumGods(tenGods, GOD_GROUPS.财星)],
      ["从杀格", godGroupElement(dayMaster.element, "官杀"), tenGods["七杀"]],
      ["从官格", godGroupElement(dayMaster.element, "官杀"), tenGods["正官"]],
      ["从儿格", godGroupElement(dayMaster.element, "食伤"), sumGods(tenGods, GOD_GROUPS.食伤)],
    ];
    groups.sort((a, b) => b[2] - a[2]);
    const top = groups[0]!;
    const rest = groups.slice(1).reduce((a, g) => a + g[2], 0);
    const subtype = top[2] < rest * 1.3 ? "从势格" : top[0];
    for (const c of conggeChecks) derivation.push({ step: "从格条件", detail: c.why });
    return {
      value: { kind: "congge", subtype, element: top[1] },
      confidence: 0.75,
      derivation,
      alternatives: [],
    };
  }
  derivation.push({
    step: "从格", detail: "未命中：" + conggeChecks.filter((c) => !c.ok).map((c) => c.why).join("；"),
  });

  // ── 专旺格 ──
  const opposing: [TenGod[], number][] = [
    [[...GOD_GROUPS.食伤], sumGods(tenGods, GOD_GROUPS.食伤)],
    [[...GOD_GROUPS.财星], sumGods(tenGods, GOD_GROUPS.财星)],
    [[...GOD_GROUPS.官杀], sumGods(tenGods, GOD_GROUPS.官杀)],
  ];
  const maxOpposing = Math.max(...opposing.map(([, v]) => v));
  if (ratio >= p.specialGe.zhuanwangThreshold && maxOpposing < p.specialGe.suppressThreshold) {
    derivation.push({
      step: "专旺", detail: `r = ${ratio.toFixed(4)} ≥ ${p.specialGe.zhuanwangThreshold}，`
        + `异党最强项 ${maxOpposing.toFixed(2)} < ${p.specialGe.suppressThreshold}`,
    });
    return {
      value: { kind: "zhuanwang", name: ZHUANWANG_NAME[dayMaster.element], element: dayMaster.element },
      confidence: 0.7, derivation, alternatives: [],
    };
  }
  derivation.push({
    step: "专旺", detail: `未命中：r = ${ratio.toFixed(4)}，异党最强项 ${maxOpposing.toFixed(2)}`,
  });

  return { value: null, confidence: 0.9, derivation, alternatives: [] };
}

/**
 * 日主的某类十神对应哪个五行。
 *
 * 直接查生克表，**不用模运算** —— 「克我者 = idx+3」这类写法极易错位
 * （曾把它写成 idx+4，对木给出水，那是生我者而非克我者），
 * 而错了之后从杀格会报出错误的五行且无人察觉。
 */
export function godGroupElement(
  dmElement: Element, group: "食伤" | "财" | "官杀" | "印",
): Element {
  switch (group) {
    case "食伤": return GENERATES[dmElement];                              // 我生者
    case "财":   return CONTROLS[dmElement];                                // 我克者
    case "官杀": return ELEMENTS.find((e) => CONTROLS[e] === dmElement)!;   // 克我者
    case "印":   return ELEMENTS.find((e) => GENERATES[e] === dmElement)!;  // 生我者
  }
}

/**
 * 用神选取。优先级：调候（极端时）→ 扶抑 → 通关 → 病药。
 *
 * ⚠️ **调候表尚未就位。**《穷通宝鉴》的完整调候表是 10 日干 × 12 月支 = 120 格，
 * 须逐格转录并双源校对。凭记忆转录 120 格必然出错，而错误的调候表比没有更糟。
 * 在它就位前，引擎使用可计算的极端气候规则作为降级方案，
 * 并在输出中标记 `tiaohouSource: 'heuristic'` —— 绝不冒充完整调候。
 */

import { ELEMENTS, type Element, type TenGod } from "../types/ganzhi.js";
import { CONTROLS, GENERATES } from "../ganzhi/tables.js";
import type { Branch } from "../types/ganzhi.js";
import type { ConclusionParams } from "../params/types.js";
import { godGroupElement } from "./specialPattern.js";
import { GOD_GROUPS, sumGods } from "./tenGods.js";
import type { DerivationStep, SpecialPattern, StrengthBand, Verdict, YongshenVerdict } from "./types.js";

const WINTER: readonly Branch[] = Object.freeze(["亥", "子", "丑"]);
const weakDayMaster = (b: StrengthBand): boolean => b === "WEAK" || b === "VERY_WEAK";
const SUMMER: readonly Branch[] = Object.freeze(["巳", "午", "未"]);

export interface YongshenInput {
  readonly dayMasterElement: Element;
  readonly monthBranch: Branch;
  readonly byElement: Readonly<Record<Element, number>>;
  readonly tenGods: Readonly<Record<TenGod, number>>;
  readonly strength: StrengthBand;
  readonly special: SpecialPattern | null;
}

function shareOf(el: Element, by: Readonly<Record<Element, number>>): number {
  const total = ELEMENTS.reduce((a, e) => a + by[e], 0);
  return total > 0 ? by[el] / total : 0;
}

/** 喜忌五组的组装：用神既定，其余四组随之而定。 */
function assemble(
  primary: Element, secondary: Element | null, method: YongshenVerdict["method"],
  by: Readonly<Record<Element, number>>, p: ConclusionParams,
  extra: Partial<YongshenVerdict> = {},
): YongshenVerdict {
  const xishen = [ELEMENTS.find((e) => GENERATES[e] === primary)!];       // 生用神者
  const jishen = [CONTROLS[primary], ...(secondary === null ? [] : [])]   // 克用神者
    .filter((e, i, a) => a.indexOf(e) === i);
  const choushen = [ELEMENTS.find((e) => GENERATES[e] === jishen[0]!)!];  // 生忌神者
  const xianshen = ELEMENTS.filter(
    (e) => e !== primary && !xishen.includes(e) && !jishen.includes(e) && !choushen.includes(e));
  const strength = by[primary];
  return {
    method, primary, secondary,
    xishen, jishen, choushen, xianshen,
    strength,
    needsLuckSupport: strength < p.yongshen.weakYongshenThreshold,
    ...extra,
  };
}

export function yongshenVerdict(
  input: YongshenInput, p: ConclusionParams,
): Verdict<YongshenVerdict> {
  const { dayMasterElement: dm, monthBranch, byElement, tenGods, strength, special } = input;
  const derivation: DerivationStep[] = [];
  const alternatives: { value: YongshenVerdict; reason: string }[] = [];

  // ── 从格 / 专旺格：顺其势，不逆 ──
  if (special !== null && special.kind !== "huaqi") {
    const primary = special.element;
    derivation.push({
      step: "特殊格局", detail: `${special.kind === "congge" ? special.subtype : special.name}，顺其势而不逆`,
    });
    return {
      value: assemble(primary, null, "fuyi", byElement, p),
      confidence: 0.75, derivation, alternatives,
    };
  }

  // ── 调候：极端气候优先 ──
  const fireShare = shareOf("火", byElement);
  const waterShare = shareOf("水", byElement);
  const isWinter = WINTER.includes(monthBranch);
  const isSummer = SUMMER.includes(monthBranch);
  const tooCold = isWinter && fireShare < p.yongshen.tiaohou.fireFloor;
  const tooHot = isSummer && waterShare < p.yongshen.tiaohou.waterFloor;

  if (tooCold || tooHot) {
    const primary: Element = tooCold ? "火" : "水";
    derivation.push({
      step: "调候", detail: tooCold
        ? `生于${monthBranch}月，火仅占 ${(fireShare * 100).toFixed(1)}% < ${p.yongshen.tiaohou.fireFloor * 100}%，极寒`
        : `生于${monthBranch}月，水仅占 ${(waterShare * 100).toFixed(1)}% < ${p.yongshen.tiaohou.waterFloor * 100}%，极燥`,
      values: { fireShare, waterShare },
    });
    derivation.push({
      step: "来源", detail: "《穷通宝鉴》120 格调候表尚未转录，此处为可计算的极端气候降级规则",
    });
    // 调候与扶抑方向相反时，必须两存 ——
    // 「身弱却取克身之神」是真实的张力，不是矛盾；把它藏起来才是错的。
    if (weakDayMaster(strength)) {
      const yin = godGroupElement(dm, "印");
      const support = byElement[yin] >= byElement[dm] ? yin : dm;
      if (support !== primary) {
        alternatives.push({
          value: assemble(support, null, "fuyi", byElement, p),
          reason: `日主判为${strength === "VERY_WEAK" ? "极弱" : "身弱"}，扶抑一路当取 ${support} 生扶；`
            + `而调候取 ${primary}，方向相反。此为调候与扶抑的固有张力，报告须并列。`,
        });
        derivation.push({
          step: "张力", detail: `调候取 ${primary}，扶抑取 ${support}，二者相反 —— 已并列为替代取用`,
        });
      }
    }
    return {
      value: assemble(primary, null, "tiaohou", byElement, p, { tiaohouSource: p.yongshen.tiaohou.source }),
      // 降级规则的置信度封顶 —— 不冒充完整调候；若与扶抑冲突则再降
      confidence: alternatives.length > 0 ? 0.45 : 0.55, derivation, alternatives,
    };
  }

  // ── 通关：两组势均力敌且相克 ──
  const total = ELEMENTS.reduce((a, e) => a + byElement[e], 0);
  for (const a of ELEMENTS) {
    const b = CONTROLS[a];
    const wa = byElement[a]; const wb = byElement[b];
    if (wa <= 0 || wb <= 0) continue;
    const diff = Math.abs(wa - wb) / Math.max(wa, wb);
    if (diff < p.yongshen.tongguan.balanceBand
        && (wa + wb) / total > p.yongshen.tongguan.dominanceFloor) {
      const middle = GENERATES[a];   // a 生 middle 生 b
      if (GENERATES[middle] !== b) continue;
      derivation.push({
        step: "通关", detail: `${a}(${wa.toFixed(1)}) 与 ${b}(${wb.toFixed(1)}) 相克而势均，取${middle}通关`,
        values: { [a]: wa, [b]: wb },
      });
      return { value: assemble(middle, null, "tongguan", byElement, p), confidence: 0.7, derivation, alternatives };
    }
  }

  // ── 扶抑：主路 ──
  const weakSide = strength === "WEAK" || strength === "VERY_WEAK";
  const strongSide = strength === "STRONG" || strength === "VERY_STRONG";

  if (weakSide) {
    const yin = godGroupElement(dm, "印");
    const bi = dm;
    const primary = byElement[yin] >= byElement[bi] ? yin : bi;
    derivation.push({ step: "扶抑", detail: `身弱，取印(${yin} ${byElement[yin].toFixed(1)}) 与比劫(${bi} ${byElement[bi].toFixed(1)}) 中较有力者` });
    return { value: assemble(primary, primary === yin ? bi : yin, "fuyi", byElement, p), confidence: 0.8, derivation, alternatives };
  }

  if (strongSide) {
    // 身旺三选一：不机械取最强者，而看流通是否通畅
    const candidates: [Element, number, string][] = [
      [godGroupElement(dm, "食伤"), sumGods(tenGods, GOD_GROUPS.食伤), "食伤泄秀"],
      [godGroupElement(dm, "财"), sumGods(tenGods, GOD_GROUPS.财星), "财耗"],
      [godGroupElement(dm, "官杀"), sumGods(tenGods, GOD_GROUPS.官杀), "官杀克身"],
    ];
    const scored = candidates.map(([el, w, label]) => {
      const fedBy = ELEMENTS.find((e) => GENERATES[e] === el)!;
      const attackedBy = ELEMENTS.find((e) => CONTROLS[e] === el)!;
      const flow = byElement[fedBy] / (byElement[attackedBy] + 1);
      return { el, w, label, score: w * flow };
    }).sort((a, b) => b.score - a.score);

    const top = scored[0]!;
    derivation.push({
      step: "扶抑", detail: `身旺，三选一按「权重 × 流通度」排序：`
        + scored.map((s) => `${s.label}(${s.el}) ${s.score.toFixed(1)}`).join("、"),
    });
    if (top.w < p.yongshen.weakYongshenThreshold) {
      derivation.push({ step: "用神无力", detail: `${top.el} 仅 ${top.w.toFixed(1)}，盘中不存在，须待大运送来` });
    }
    if (scored[1] !== undefined && scored[1].score > top.score * 0.8) {
      alternatives.push({
        value: assemble(scored[1].el, null, "fuyi", byElement, p),
        reason: `${scored[1].label} 得分 ${scored[1].score.toFixed(1)}，与首选 ${top.score.toFixed(1)} 接近，取用可两存`,
      });
    }
    return {
      value: assemble(top.el, scored[1]?.el ?? null, "fuyi", byElement, p),
      confidence: alternatives.length > 0 ? 0.6 : 0.8, derivation, alternatives,
    };
  }

  // ── 中和：补全局最弱的一环 ──
  const weakest = [...ELEMENTS].sort((a, b) => byElement[a] - byElement[b])[0]!;
  derivation.push({ step: "扶抑", detail: `中和，补全局最弱的 ${weakest}（${byElement[weakest].toFixed(1)}）` });
  return { value: assemble(weakest, null, "fuyi", byElement, p), confidence: 0.6, derivation, alternatives };
}

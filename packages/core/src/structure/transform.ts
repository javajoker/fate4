/**
 * 合化判定 —— 六合与天干五合共用的四个条件。
 *
 * 四条全部满足才转换五行；否则只作合绊：权重不变，**活性打折**。
 * 这正是「贪合忘克」—— 被合住的七杀不再去克身，但它仍在那里，仍可被制。
 */

import { elementOf, generates } from "../ganzhi/algebra.js";
import { HIDDEN_STEMS } from "../ganzhi/tables.js";
import type { Branch, Element } from "../types/ganzhi.js";
import type { StructureParams } from "../params/types.js";
import type { Carrier } from "../weights/carrier.js";
import { pillarGap } from "./distance.js";
import type { HeCandidate } from "./detect.js";

export interface TransformVerdict {
  readonly transforms: boolean;
  /** 未能化成时，逐条列出卡在哪一条 —— 「为什么不化」是读者一定会追问的。 */
  readonly failedConditions: readonly string[];
}

export interface TransformContext {
  readonly monthBranch: Branch;
  readonly allCarriers: readonly Carrier[];
  /** 该候选是否被判为争合妒合。 */
  readonly contested: boolean;
  /** 该候选是否被冲破（由裁决给出）。 */
  readonly brokenByChong: boolean;
}

export function judgeTransform(
  cand: HeCandidate, ctx: TransformContext, p: StructureParams,
): TransformVerdict {
  const t = p.transform;
  const failed: string[] = [];

  // C1 月令支持化神：月支本气即化神，或月支本气生化神
  if (t.requireMonthSupport) {
    const monthQi = elementOf(HIDDEN_STEMS[ctx.monthBranch][0]!);
    const ok = monthQi === cand.element || generates(monthQi, cand.element);
    if (!ok) failed.push(`C1 月令不支持化神（月支${ctx.monthBranch}本气为${monthQi}，非${cand.element}亦不生${cand.element}）`);
  }

  // C2 有引化：化神在天干层透出，或局中化神总权重达阈值
  if (t.requireCatalyst) {
    const revealed = ctx.allCarriers.some(
      (c) => c.position.layer === "stem" && c.element === cand.element);
    const total = ctx.allCarriers
      .filter((c) => c.element === cand.element)
      .reduce((a, c) => a + c.weight, 0);
    if (!revealed && total < t.catalystThreshold) {
      failed.push(`C2 无引化（${cand.element}未透干，且局中${cand.element}仅 ${total.toFixed(1)} < ${t.catalystThreshold}）`);
    }
  }

  // C3 无争合妒合
  if (t.blockOnContention && ctx.contested) failed.push("C3 争合妒合，力量分散");

  // C4 未被冲破
  if (t.blockOnChong && ctx.brokenByChong) failed.push("C4 参与之支被冲破");

  // 天干五合须相邻方可化；隔位只作合绊
  if (cand.kind === "ganhe" && t.ganheRequireAdjacent) {
    const ps = (cand.stemSlots ?? []).map((s) => s.pillar);
    const gap = ps.length === 2 ? pillarGap(ps[0]!, ps[1]!) : null;
    if (gap === null || gap > 1) failed.push("天干五合非相邻，不化");
  }

  return { transforms: failed.length === 0, failedConditions: failed };
}

export type { Element };

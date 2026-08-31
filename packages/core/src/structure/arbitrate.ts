/**
 * 冲与合的互解裁决。
 *
 * 一个支同时进入合与冲时，必须裁出谁成立。裁决结果写进事件的 strengthScores ——
 * 「你这个盘的巳申看似合水，实际被寅冲破，所以不化」是读者一定会追问的结论，
 * 没有依据就没法回答。
 */

import type { StructureParams } from "../params/types.js";
import type { HeCandidate, ClashCandidate } from "./detect.js";
import type { BranchSlot } from "./types.js";
import { chongDistanceCoef, heDistanceCoef } from "./distance.js";

export type Verdict = "heWins" | "chongWins" | "mutual";

export interface Arbitration {
  readonly verdict: Verdict;
  readonly he: number;
  readonly chong: number;
}

/** 合力 = 参与者权重之和 × 类型系数 × 距离系数。 */
export function heStrength(cand: HeCandidate, p: StructureParams): number {
  const coefKey = cand.kind === "gong" ? "banhe" : cand.kind === "ganhe" ? "liuhe" : cand.kind;
  const typeCoef = p.arbitration.heTypeCoef[coefKey as keyof typeof p.arbitration.heTypeCoef] ?? 0.5;
  const slots = cand.slots.length > 0 ? cand.slots : [];
  const weight = slots.reduce((a, s) => a + s.weight, 0)
    + (cand.stemSlots ?? []).reduce((a, s) => a + s.carrier.weight, 0);
  const pillars = [...slots.map((s) => s.pillar), ...(cand.stemSlots ?? []).map((s) => s.pillar)];
  const dist = heDistanceCoef(pillars, p.heDistance, p.externalHeFactor);
  return weight * typeCoef * dist;
}

/** 冲力 = 弱方权重 × 系数 × 距离。取弱方，因为冲的破坏上限由弱方决定。 */
export function chongStrength(c: ClashCandidate, p: StructureParams): number {
  const a = c.a as BranchSlot;
  const b = c.b as BranchSlot;
  const wa = "weight" in a ? a.weight : 0;
  const wb = "weight" in b ? b.weight : 0;
  const dist = chongDistanceCoef(a.pillar, b.pillar, p.chong.distance);
  return Math.min(wa, wb) * p.arbitration.chongCoef * dist;
}

export function arbitrate(he: number, chong: number, p: StructureParams): Arbitration {
  const m = p.arbitration.decisiveMargin;
  if (he > chong * m) return { verdict: "heWins", he, chong };
  if (chong > he * m) return { verdict: "chongWins", he, chong };
  return { verdict: "mutual", he, chong };
}

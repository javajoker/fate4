/**
 * 同党抗性 —— 本模型与常见量化八字最大的分歧点。
 *
 * ## 为何不用「同五行互相加分」
 *
 * 若把比劫帮身实现为同五行互相加分，则任意两个同五行载体每轮互相增益，
 * 构成正反馈：以距离 0.8、核 0.20 计，每轮互增约 16%，带阻尼 0.5 后仍是
 * 8% 的复利 —— 20 轮放大 4.66 倍。数值发散，且结论会被「同类多寡」单一维度绑架。
 *
 * ## 比劫的真实职能是抗压
 *
 * 传统说的是「分担官杀之克」「帮身任财官」，那是抗打击能力，不是凭空生力。
 * 故实现为：
 *
 *     resistance_j = 1 / (1 + β · S_j / M)
 *     S_j = Σ_(同五行载体 a ≠ j) [ W_a · D(a, j) ]
 *
 * 只作用于**克**，不作用于生。好处有三：
 *   · 数学上严格收敛，无正反馈
 *   · 语义上更准 —— 有比劫、有通根的日主是「更抗打」而非「凭空更旺」
 *   · **通根自动被覆盖** —— 天干的根就是同柱距离 1.00 的同五行载体，无需另设机制
 */

import type { PropagationParams } from "../params/types.js";
import type { Carrier } from "../weights/carrier.js";
import { propagationDistance } from "./distance.js";

/** 逐载体的抗性系数，∈ (0, 1]。同党越厚，受克越轻。 */
export function computeResistance(
  carriers: readonly Carrier[], totalMass: number, p: PropagationParams,
): Map<string, number> {
  const out = new Map<string, number>();
  if (p.tongdang.mode === "additive") {
    for (const c of carriers) out.set(c.id, 1);
    return out;
  }
  const M = Math.max(totalMass, 1e-12);
  for (const j of carriers) {
    let S = 0;
    for (const a of carriers) {
      if (a.id === j.id || a.element !== j.element) continue;
      S += a.weight * propagationDistance(a, j, p);
    }
    out.set(j.id, 1 / (1 + p.tongdang.beta * (S / M)));
  }
  return out;
}

/**
 * 生克作用核与阴阳系数。
 *
 * ## 阴阳的不对称
 *
 * 生与克的阴阳规律**方向相反**：生取异性为强，克取同性为强。
 * 这是四柱阴阳理论的核心不对称，已在 test/tables.spec.ts 与此处双重固定。
 *
 * | 关系 | 阴阳 | 系数 | 十神 |
 * | 生 | 异 | 1.00 | 正印 · 伤官 —— 有情之生 |
 * | 生 | 同 | 0.70 | 偏印 · 食神 —— 同性相斥 |
 * | 克 | 同 | 1.00 | 七杀 —— 无情之克 |
 * | 克 | 异 | 0.70 | 正官 · 正财 —— 有情之克 |
 */

import { actingRelation } from "../ganzhi/algebra.js";
import type { ActingRelation } from "../types/ganzhi.js";
import type { PropagationParams } from "../params/types.js";
import type { Carrier } from "../weights/carrier.js";

export function relationOf(from: Carrier, to: Carrier): ActingRelation {
  return actingRelation(from.element, to.element);
}

/** 作用核 K。克重于生 —— 四柱中「制」比「生」更能决定成败。 */
export function kernelOf(rel: ActingRelation, p: PropagationParams): number {
  return rel === "生" ? p.kernel.sheng : rel === "克" ? p.kernel.ke : 0;
}

export function polarityCoefOf(from: Carrier, to: Carrier, rel: ActingRelation,
                               p: PropagationParams): number {
  const same = from.polarity === to.polarity;
  if (rel === "生") return same ? p.polarity.shengSame : p.polarity.shengCross;
  if (rel === "克") return same ? p.polarity.keSame : p.polarity.keCross;
  return 0;
}

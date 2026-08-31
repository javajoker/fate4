/**
 * 十神向量。
 *
 * **按载体的当前五行与阴阳计算，不按原天干。**
 * L2 的合化会改写 element —— 乙木若被乙庚合化为金，它对丁火日主就不再是偏印，
 * 而是偏财。「化气之后论化神」是传统的明确要求。
 */

import { TEN_GODS, type Element, type Polarity, type TenGod } from "../types/ganzhi.js";
import { controls, generates } from "../ganzhi/algebra.js";
import { OPPOSING_GODS, SUPPORTING_GODS } from "../ganzhi/algebra.js";
import type { Carrier } from "../weights/carrier.js";

export function tenGodOf(
  dmElement: Element, dmPolarity: Polarity,
  element: Element, polarity: Polarity,
): TenGod {
  const same = polarity === dmPolarity;
  if (element === dmElement) return same ? "比肩" : "劫财";
  if (generates(dmElement, element)) return same ? "食神" : "伤官";
  if (controls(dmElement, element)) return same ? "偏财" : "正财";
  if (controls(element, dmElement)) return same ? "七杀" : "正官";
  if (generates(element, dmElement)) return same ? "偏印" : "正印";
  /* istanbul ignore next —— 五行关系已穷尽 */
  throw new Error(`无法定十神：${dmElement}${dmPolarity} 对 ${element}${polarity}`);
}

// 同党/异党的分组定义在 ganzhi/algebra.ts —— 那是纯十神的性质，不依赖任何具体命盘

export interface TenGodResult {
  readonly vector: Readonly<Record<TenGod, number>>;
  readonly dayMasterWeight: number;
  readonly supporting: number;
  readonly opposing: number;
  readonly ratio: number;
}

/**
 * 汇总十神向量。
 *
 * **日主自身的权重单列，不计入比肩。**把日主算进比肩会让每个盘都显得身强 ——
 * 这是常见的实现错误。
 */
export function tenGodVector(carriers: readonly Carrier[], dayMaster: Carrier): TenGodResult {
  const vector = Object.fromEntries(TEN_GODS.map((g) => [g, 0])) as Record<TenGod, number>;
  let dayMasterWeight = 0;

  for (const c of carriers) {
    if (c.id === dayMaster.id) { dayMasterWeight += c.weight; continue; }
    const g = tenGodOf(dayMaster.element, dayMaster.polarity, c.element, c.polarity);
    vector[g] += c.weight;
  }

  const supporting = dayMasterWeight + SUPPORTING_GODS.reduce((a, g) => a + vector[g], 0);
  const opposing = OPPOSING_GODS.reduce((a, g) => a + vector[g], 0);
  const total = supporting + opposing;

  return { vector, dayMasterWeight, supporting, opposing, ratio: total > 0 ? supporting / total : 0 };
}

/** 某十神组的权重之和。 */
export function sumGods(v: Readonly<Record<TenGod, number>>, gods: readonly TenGod[]): number {
  return gods.reduce((a, g) => a + v[g], 0);
}

export const GOD_GROUPS = Object.freeze({
  比劫: Object.freeze(["比肩", "劫财"] as const),
  印星: Object.freeze(["正印", "偏印"] as const),
  食伤: Object.freeze(["食神", "伤官"] as const),
  财星: Object.freeze(["正财", "偏财"] as const),
  官杀: Object.freeze(["正官", "七杀"] as const),
});

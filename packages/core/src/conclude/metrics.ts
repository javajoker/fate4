/**
 * 五行流通的三个全局指标。
 *
 * 三者都**不参与旺衰判定** —— 它们描述结构，不作价值判断。
 * `evenness` 高不等于命好：偏枯而成格成局者不在少数。
 */

import { ELEMENTS, type Element } from "../types/ganzhi.js";
import type { FlowRecord } from "../propagate/iterate.js";
import type { FlowMetrics } from "./types.js";
import type { Carrier } from "../weights/carrier.js";

export function flowMetrics(
  vitality: number,
  flows: readonly FlowRecord[],
  byElement: Readonly<Record<Element, number>>,
): FlowMetrics {
  const sheng = flows.filter((f) => f.kind === "sheng").reduce((a, f) => a + f.totalAmount, 0);
  const ke = flows.filter((f) => f.kind === "ke").reduce((a, f) => a + f.totalAmount, 0);
  const circulation = sheng + ke > 0 ? sheng / (sheng + ke) : 0;

  const total = ELEMENTS.reduce((a, e) => a + byElement[e], 0);
  let entropy = 0;
  if (total > 0) {
    for (const e of ELEMENTS) {
      const q = byElement[e] / total;
      if (q > 0) entropy -= q * Math.log(q);
    }
  }
  const evenness = entropy / Math.log(ELEMENTS.length);

  return { vitality, circulation, evenness };
}

/**
 * 克流量矩阵 `keDamage[受害五行][施克五行]`。
 *
 * 病药法判「病」用它，人格层判「受克最重的五行」也用它 ——
 * 同一份计算不写两遍。
 */
export function keDamageMatrix(
  carriers: readonly Carrier[], flows: readonly FlowRecord[],
): Record<Element, Record<Element, number>> {
  const elementById = new Map(carriers.map((c) => [c.id, c.element]));
  const m = Object.fromEntries(ELEMENTS.map((e) => [
    e, Object.fromEntries(ELEMENTS.map((f) => [f, 0])) as Record<Element, number>,
  ])) as Record<Element, Record<Element, number>>;
  for (const f of flows) {
    if (f.kind !== "ke") continue;
    const from = elementById.get(f.from);
    const to = elementById.get(f.to);
    if (from === undefined || to === undefined) continue;
    m[to][from] += f.totalAmount;
  }
  return m;
}

/** 某五行受到的总克流量。 */
export function attackOn(
  m: Readonly<Record<Element, Readonly<Record<Element, number>>>>, e: Element,
): number {
  return ELEMENTS.reduce((a, f) => a + m[e][f], 0);
}

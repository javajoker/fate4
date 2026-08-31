/**
 * 五行流通的三个全局指标。
 *
 * 三者都**不参与旺衰判定** —— 它们描述结构，不作价值判断。
 * `evenness` 高不等于命好：偏枯而成格成局者不在少数。
 */

import { ELEMENTS, type Element } from "../types/ganzhi.js";
import type { FlowRecord } from "../propagate/iterate.js";
import type { FlowMetrics } from "./types.js";

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

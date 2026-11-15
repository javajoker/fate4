"use client";

import { DEFAULT_MONTH_RATIO, loadMonthRatio, saveMonthRatio } from "./store";
import { useDeferredChoice } from "./useDeferred";

/** 移动版的流月比例。「选中」与「已用于计算」分开的理由见 useDeferredChoice。 */
export function useMonthRatio() {
  const c = useDeferredChoice(loadMonthRatio, saveMonthRatio, DEFAULT_MONTH_RATIO);
  return { ratio: c.value, applied: c.applied, set: c.set, pending: c.pending };
}

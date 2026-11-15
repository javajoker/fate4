"use client";

import { DEFAULT_SPAN } from "@fate/core";
import { loadSpan, saveSpan } from "./store";
import { useDeferredChoice } from "./useDeferred";

/** 移动版的时间跨度。「选中」与「已用于计算」分开的理由见 useDeferredChoice。 */
export function useSpan() {
  const c = useDeferredChoice(loadSpan, saveSpan, DEFAULT_SPAN);
  return { span: c.value, applied: c.applied, set: c.set, pending: c.pending };
}

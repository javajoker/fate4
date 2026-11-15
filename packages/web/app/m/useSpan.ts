"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SPAN, type SpanYears } from "@fate/core";
import { loadSpan, saveSpan } from "./store";

/**
 * 移动版的时间跨度。
 *
 * ## 为什么有「选中」与「已用于计算」两个值
 *
 * 切到 180 年，报告里的统计节点要按月跑 2160 个点，在手机上是好几秒的**同步**计算。
 * 若切换与计算在同一次渲染里发生，界面会先卡死，再一下子跳到新结果 ——
 * 用户点了一下没反应，以为没点上，于是再点。
 *
 * 故分两步：先把「选中」置上（芯片高亮、出现「正在重新计算」），
 * 等浏览器把这一帧画出来，再把「已用于计算」置上去触发那段重活。
 * 它不让计算变快，只让用户知道发生了什么。
 */
export function useSpan() {
  const [span, setSpanState] = useState<SpanYears>(DEFAULT_SPAN);
  const [applied, setApplied] = useState<SpanYears>(DEFAULT_SPAN);

  // 载入本机保存的值 —— 直接作为「已用于计算」，不必等一拍
  useEffect(() => { const v = loadSpan(); setSpanState(v); setApplied(v); }, []);

  useEffect(() => {
    if (span === applied) return;
    const t = setTimeout(() => setApplied(span), 40);
    return () => clearTimeout(t);
  }, [span, applied]);

  const set = (s: SpanYears) => { setSpanState(s); saveSpan(s); };
  return { span, applied, set, pending: span !== applied };
}

"use client";

import { useEffect, useState } from "react";

/**
 * 一个存在本机、改了要重算报告的选择 —— 时间跨度、流月比例都是。
 *
 * ## 为什么有「选中」与「已用于计算」两个值
 *
 * 报告里的统计节点要按月跑几百到几千个点，在手机上是好几秒的**同步**计算。
 * 若切换与计算在同一次渲染里发生，界面会先卡死，再一下子跳到新结果 ——
 * 用户点了一下没反应，以为没点上，于是再点。
 *
 * 故分两步：先把「选中」置上（芯片高亮、出现「正在重新计算」），
 * 等浏览器把这一帧画出来，再把「已用于计算」置上去触发那段重活。
 * 它不让计算变快，只让用户知道发生了什么。
 */
export function useDeferredChoice<T>(load: () => T, save: (v: T) => void, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [applied, setApplied] = useState<T>(initial);

  // 载入本机保存的值 —— 直接作为「已用于计算」，不必等一拍
  useEffect(() => { const v = load(); setValue(v); setApplied(v); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value === applied) return;
    const t = setTimeout(() => setApplied(value), 40);
    return () => clearTimeout(t);
  }, [value, applied]);

  const set = (v: T) => { setValue(v); save(v); };
  return { value, applied, set, pending: value !== applied };
}

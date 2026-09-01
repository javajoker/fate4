"use client";

import { useEffect, useState } from "react";

/**
 * 当前日期。
 *
 * 内核里没有 `Date.now()` —— 时间一律由外部传入，这是可测试性的前提。
 * 取系统时间是**界面层**的职责，故只在此处一处发生。
 *
 * 用 effect 而非 useState 初值：页面是构建期预渲染的，
 * 初值里读系统时间会让预渲染的年份与客户端的对不上。
 */
export function useToday(): { year: number; month: number; day: number } | null {
  const [t, setT] = useState<{ year: number; month: number; day: number } | null>(null);
  useEffect(() => {
    const d = new Date();
    setT({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
  }, []);
  return t;
}

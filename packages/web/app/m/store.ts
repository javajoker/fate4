"use client";

import type { BirthInput } from "@fate/core";

/**
 * 移动版只记一份出生信息，存在本机。
 *
 * 桌面版用 IndexedDB 存多张盘；移动版是「看自己」的应用，一份就够。
 * **不上传、不同步** —— 与全站同一条隐私纪律。
 */
const KEY = "fate.m.birth.v1";

export function loadBirth(): BirthInput | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : (JSON.parse(raw) as BirthInput);
  } catch { return null; }
}

export function saveBirth(b: BirthInput): void {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* 隐私模式下写不进，无妨 */ }
}

export function clearBirth(): void {
  try { localStorage.removeItem(KEY); } catch { /* 同上 */ }
}

export const CITIES: readonly (readonly [string, string, number])[] = [
  ["上海", "Asia/Shanghai", 121.47], ["北京", "Asia/Shanghai", 116.41],
  ["广州", "Asia/Shanghai", 113.26], ["深圳", "Asia/Shanghai", 114.06],
  ["成都", "Asia/Shanghai", 104.07], ["西安", "Asia/Shanghai", 108.95],
  ["台北", "Asia/Taipei", 121.56], ["香港", "Asia/Hong_Kong", 114.17],
  ["新加坡", "Asia/Singapore", 103.82],
];

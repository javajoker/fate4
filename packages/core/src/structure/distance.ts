/**
 * 柱间距离。
 *
 * 本命柱在一条数轴上：年 0 · 月 1 · 日 2 · 时 3。
 * 大运与流年不在这条轴上 —— 它们是施加于命局的外部条件，用独立系数。
 */

import type { PillarKind } from "../weights/carrier.js";

const NATAL_ORDER: Partial<Record<PillarKind, number>> = {
  year: 0, month: 1, day: 2, hour: 3, taiyuan: 1,
};

export function isNatal(p: PillarKind): boolean {
  return NATAL_ORDER[p] !== undefined;
}

/** 两柱间隔位数；任一为外部层则返回 null。 */
export function pillarGap(a: PillarKind, b: PillarKind): number | null {
  const x = NATAL_ORDER[a];
  const y = NATAL_ORDER[b];
  if (x === undefined || y === undefined) return null;
  return Math.abs(x - y);
}

export interface HeDistanceParams {
  readonly adjacent: number;
  readonly gap1: number;
  readonly gap2: number;
}

/** 合局的距离系数。三支时取两两距离系数的最小者 —— 最弱的一环决定合的成色。 */
export function heDistanceCoef(
  pillars: readonly PillarKind[],
  p: HeDistanceParams,
  externalFactor: number,
): number {
  let coef = 1;
  let hasExternal = false;
  for (let i = 0; i < pillars.length; i++) {
    if (!isNatal(pillars[i]!)) hasExternal = true;
    for (let j = i + 1; j < pillars.length; j++) {
      const gap = pillarGap(pillars[i]!, pillars[j]!);
      if (gap === null) { hasExternal = true; continue; }
      const c = gap <= 1 ? p.adjacent : gap === 2 ? p.gap1 : p.gap2;
      coef = Math.min(coef, c);
    }
  }
  return hasExternal ? coef * externalFactor : coef;
}

export interface ChongDistanceParams {
  readonly adjacent: number;
  readonly gap1: number;
  readonly gap2: number;
  readonly luckToNatal: number;
  readonly annualToNatal: number;
  readonly luckToAnnual: number;
}

/** 冲刑害破的距离系数。远冲力弱 —— 年与时之间只留三成。 */
export function chongDistanceCoef(
  a: PillarKind, b: PillarKind, p: ChongDistanceParams,
): number {
  const gap = pillarGap(a, b);
  if (gap !== null) {
    return gap <= 1 ? p.adjacent : gap === 2 ? p.gap1 : p.gap2;
  }
  const set = new Set([a, b]);
  if (set.has("luck") && set.has("annual")) return p.luckToAnnual;
  if (set.has("luck")) return p.luckToNatal;
  if (set.has("annual")) return p.annualToNatal;
  return p.adjacent;
}

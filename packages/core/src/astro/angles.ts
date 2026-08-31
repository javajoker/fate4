/** 角度工具。全部以**度**为单位，弧度只在调用三角函数的瞬间出现。 */

export const DEG = Math.PI / 180;
export const ARCSEC_PER_DEG = 3600;

export const sinDeg = (d: number): number => Math.sin(d * DEG);
export const cosDeg = (d: number): number => Math.cos(d * DEG);
export const tanDeg = (d: number): number => Math.tan(d * DEG);

/** 归入 [0, 360)。 */
export function norm360(d: number): number {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

/** 归入 (−180, 180]，用于求两角之差。 */
export function normSigned(d: number): number {
  const r = norm360(d);
  return r > 180 ? r - 360 : r;
}

export const arcsecToDeg = (a: number): number => a / ARCSEC_PER_DEG;

/** 度 → 时间分钟，按太阳周日视运动（1° ≈ 4 分钟）。 */
export const degToMinutes = (d: number): number => d * 4;

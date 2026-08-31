/**
 * ΔT = TT − UT，地球时与世界时之差。
 *
 * 采用 Espenak & Meeus (2006) 的分段多项式（NASA 日食网站所用）。
 *
 * **为何这一项不可省略**：1900–2100 区间内 ΔT 约在 −3 秒到 +200 秒之间，
 * 而本引擎对节气时刻的容差是 60 秒。忽略 ΔT 会让 20 世纪的节气整体偏差
 * 数十秒、21 世纪末偏差数分钟 —— 直接击穿容差。
 *
 * **精度自知**：2005 年之后的分段是外推预测，非观测值。
 * 实测 ΔT 与预测的偏离逐年累积，2100 年附近的不确定度可达数十秒。
 * 因此本引擎对 2050 年以后的节气时刻不承诺 60 秒容差 ——
 * 这不是实现缺陷，是 ΔT 本身不可预知（取决于地球自转的不规则变化）。
 */

export interface DeltaTResult {
  /** ΔT，秒。 */
  readonly seconds: number;
  /** 该值是基于观测拟合，还是对未来的外推。 */
  readonly basis: "fitted" | "extrapolated";
}

/** 小数年份，供分段多项式取用。 */
export function decimalYear(year: number, month: number): number {
  return year + (month - 0.5) / 12;
}

export function deltaTSeconds(year: number, month: number): DeltaTResult {
  const y = decimalYear(year, month);
  const poly = (t: number, c: readonly number[]): number =>
    c.reduce((acc, coef, i) => acc + coef * Math.pow(t, i), 0);

  if (y >= 1900 && y < 1920) {
    const t = y - 1900;
    return { seconds: poly(t, [-2.79, 1.494119, -0.0598939, 0.0061966, -0.000197]), basis: "fitted" };
  }
  if (y >= 1920 && y < 1941) {
    const t = y - 1920;
    return { seconds: poly(t, [21.20, 0.84493, -0.076100, 0.0020936]), basis: "fitted" };
  }
  if (y >= 1941 && y < 1961) {
    const t = y - 1950;
    return { seconds: 29.07 + 0.407 * t - (t * t) / 233 + (t * t * t) / 2547, basis: "fitted" };
  }
  if (y >= 1961 && y < 1986) {
    const t = y - 1975;
    return { seconds: 45.45 + 1.067 * t - (t * t) / 260 - (t * t * t) / 718, basis: "fitted" };
  }
  if (y >= 1986 && y < 2005) {
    const t = y - 2000;
    return {
      seconds: poly(t, [63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599]),
      basis: "fitted",
    };
  }
  if (y >= 2005 && y < 2050) {
    const t = y - 2000;
    return { seconds: poly(t, [62.92, 0.32217, 0.005589]), basis: "extrapolated" };
  }
  if (y >= 2050 && y < 2150) {
    const u = (y - 1820) / 100;
    return { seconds: -20 + 32 * u * u - 0.5628 * (2150 - y), basis: "extrapolated" };
  }

  // 区间外的长期抛物线拟合（Morrison & Stephenson 2004）
  const u = (y - 1820) / 100;
  return { seconds: -20 + 32 * u * u, basis: "extrapolated" };
}

/** 本引擎承诺 60 秒容差的年份上界；超出则 ΔT 外推不确定度已超过容差。 */
export const TOLERANCE_GUARANTEED_UNTIL_YEAR = 2050;

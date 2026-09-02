/**
 * 月球视黄经与定朔。
 *
 * ## 为什么需要它
 *
 * 四柱只用节气，不用农历，所以本项目至今没有月球位置。
 * 六爻的按时起卦要农历月日（见 `docs/13-liuyao.md` §1.2），故补上。
 *
 * ## 精度与它的实际后果
 *
 * 级数取 Meeus《Astronomical Algorithms》第 47 章的截断 ELP-2000/82，
 * 黄经项 60 条，自称精度约 10″。折算到朔的时刻：
 *
 * ```
 * 日月相对行度 ≈ 13.1764 − 0.9856 = 12.1908 °/日
 * 10″ = 0.00278°  →  0.00278 / 12.1908 日 ≈ 20 秒
 * ```
 *
 * 20 秒对农历意味着什么：**朔所在的那一日为初一**，日界是地方民用时的子夜。
 * 只有当朔刻落在子夜前后 20 秒内时，初一才可能判到隔壁那一天 ——
 * 而那会把整个月的日序推移一天。这种情形罕见但确实存在，历史上引起过真实的历争。
 *
 * 故 {@link solveNewMoon} **如实报出它与日界的距离**，由上层决定是否标注。
 * 不做的事：假装 20 秒不存在，或者悄悄取整。
 *
 * ## 与 solarTerms.ts 同构
 *
 * 同一套牛顿求根，只换目标函数：节气求 `λ☉ = 15k°`，定朔求 `λ☾ − λ☉ = 0`。
 * `deltaT`、`julian`、`nutation` 全部复用。
 */

import { arcsecToDeg, norm360, normSigned, sinDeg } from "./angles.js";
import { julianCentury, asTT, asUT, fromJulianDay, type JulianDay, type JulianDayTT } from "./julian.js";
import { nutation } from "./nutation.js";
import { apparentSolarLongitude, MEAN_SOLAR_MOTION_DEG_PER_DAY } from "./sun.js";
import { DEFAULT_SOLAR_PROVIDER } from "./defaults.js";
import type { SolarLongitudeProvider } from "./sun.js";

// ─────────────────────────────────────────────────────────
// Meeus 表 47.A —— 黄经与距离的周期项
// 每行：D, M, M′, F, Σl 系数(1e-6 度), Σr 系数(1e-3 km)
// ─────────────────────────────────────────────────────────

const TERMS_LR: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751],
  [0, 2, 0, 0, -2069, 0],
  [2, -2, -1, 0, 2048, -4950],
  [2, 0, 1, -2, -1773, 4130],
  [2, 0, 0, 2, -1595, 0],
  [4, -1, -1, 0, 1215, -3958],
  [0, 0, 2, 2, -1110, 0],
  [3, 0, -1, 0, -892, 3258],
  [2, 1, 1, 0, -810, 2616],
  [4, -1, -2, 0, 759, -1897],
  [0, 2, -1, 0, -713, -2117],
  [2, 2, -1, 0, -700, 2354],
  [2, 1, -2, 0, 691, 0],
  [2, -1, 0, -2, 596, 0],
  [4, 0, 1, 0, 549, -1423],
  [0, 0, 4, 0, 537, -1117],
  [4, -1, 0, 0, 520, -1571],
  [1, 0, -2, 0, -487, -1739],
  [2, 1, 0, -2, -399, 0],
  [0, 0, 2, -2, -381, -4421],
  [1, 1, 1, 0, 351, 0],
  [3, 0, -2, 0, -340, 0],
  [4, 0, -3, 0, 330, 0],
  [2, -1, 2, 0, 327, 0],
  [0, 2, 1, 0, -323, 1165],
  [1, 1, -1, 0, 299, 0],
  [2, 0, 3, 0, 294, 0],
  [2, 0, -1, -2, 0, 8752],
];

export interface LunarPosition {
  /** 视黄经（度），已加章动。 */
  readonly apparentLongitude: number;
  /** 地月距离，公里。 */
  readonly distanceKm: number;
}

/** 级数自称的黄经精度，角秒。 */
export const LUNAR_STATED_ACCURACY_ARCSEC = 10;

/**
 * 月球视黄经与距离。
 *
 * `E` 的幂次修正针对含太阳平近点角 M 的项 —— 地球轨道偏心率随时间变化，
 * 而级数是在某个历元上拟合的。省掉它在数百年尺度上会引入可观误差。
 */
export function lunarPosition(jdTT: JulianDayTT): LunarPosition {
  const T = julianCentury(jdTT);
  const T2 = T * T; const T3 = T2 * T; const T4 = T3 * T;

  // 月球平黄经
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T2
    + T3 / 538841 - T4 / 65194000);
  // 平距角（日月平黄经差）
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2
    + T3 / 545868 - T4 / 113065000);
  // 太阳平近点角
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
  // 月球平近点角
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2
    + T3 / 69699 - T4 / 14712000);
  // 月球升交点角距
  const F = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T2
    - T3 / 3526000 + T4 / 863310000);

  const A1 = norm360(119.75 + 131.849 * T);
  const A2 = norm360(53.09 + 479264.290 * T);

  const E = 1 - 0.002516 * T - 0.0000074 * T2;

  let sumL = 0; let sumR = 0;
  for (const [d, m, mp, f, cl, cr] of TERMS_LR) {
    const arg = d * D + m * M + mp * Mp + f * F;
    // 含 M 的项按 E 的 |m| 次幂修正
    const e = m === 0 ? 1 : m === 1 || m === -1 ? E : E * E;
    sumL += cl * e * sinDeg(arg);
    sumR += cr * e * Math.cos((arg * Math.PI) / 180);
  }
  // 金星、木星与地球扁率引起的附加项
  sumL += 3958 * sinDeg(A1) + 1962 * sinDeg(Lp - F) + 318 * sinDeg(A2);

  const lambda = Lp + sumL / 1_000_000;
  const { deltaPsi } = nutation(jdTT);

  return {
    apparentLongitude: norm360(lambda + deltaPsi),
    distanceKm: 385000.56 + sumR / 1000,
  };
}

/** 月球日均视行度（度/日）。 */
export const MEAN_LUNAR_MOTION_DEG_PER_DAY = 13.176358;
/** 日月相对行度（度/日）—— 定朔求根的一阶导。 */
export const MEAN_ELONGATION_RATE_DEG_PER_DAY =
  MEAN_LUNAR_MOTION_DEG_PER_DAY - MEAN_SOLAR_MOTION_DEG_PER_DAY;

/** 朔望月平均长度（日）。 */
export const SYNODIC_MONTH_DAYS = 29.530588861;

export interface NewMoonResult {
  readonly jdTT: JulianDayTT;
  readonly jdUT: JulianDay;
  readonly iterations: number;
  /** 残差，度。 */
  readonly residualDeg: number;
  /** 级数精度折算的时刻不确定度，秒。 */
  readonly estimatedUncertaintySeconds: number;
}

const TOLERANCE_DEG = 1e-8;
const MAX_ITERATIONS = 30;

/**
 * 求 `approxJdTT` 附近的定朔时刻 —— 日月视黄经差归零。
 *
 * 用**视**黄经而非平黄经：真正的朔是视位置合朔，这也是「定朔」二字的含义。
 * 平朔（按平均朔望月推算）自唐《麟德历》后即不再用于中国历法。
 */
export function solveNewMoon(
  approxJdTT: JulianDayTT,
  provider: SolarLongitudeProvider = DEFAULT_SOLAR_PROVIDER,
): NewMoonResult {
  let t = approxJdTT as number;
  let delta = Number.NaN;
  let i = 0;

  for (; i < MAX_ITERATIONS; i++) {
    const moon = lunarPosition(asTT(t)).apparentLongitude;
    const sun = apparentSolarLongitude(asTT(t), provider);
    delta = normSigned(sun - moon);
    if (Math.abs(delta) < TOLERANCE_DEG) break;
    t += delta / MEAN_ELONGATION_RATE_DEG_PER_DAY;
  }
  if (!(Math.abs(delta) < TOLERANCE_DEG)) {
    throw new Error(`定朔求解未收敛：${MAX_ITERATIONS} 轮后残差 ${delta}°`);
  }

  const cal = fromJulianDay(t);
  const dtSec = deltaTOf(cal.year, cal.month);
  return {
    jdTT: asTT(t),
    jdUT: asUT(t - dtSec / 86400),
    iterations: i,
    residualDeg: delta,
    estimatedUncertaintySeconds:
      (arcsecToDeg(LUNAR_STATED_ACCURACY_ARCSEC) / MEAN_ELONGATION_RATE_DEG_PER_DAY) * 86400,
  };
}

/** 第 n 个朔（自 J2000 附近的某个朔起算）的粗略时刻 —— 供求根取初值。 */
export function approxNewMoon(k: number): JulianDayTT {
  // Meeus 式 49.1：k = 0 对应 2000 年 1 月 6 日的朔
  const T = k / 1236.85;
  return asTT(2451550.09766 + SYNODIC_MONTH_DAYS * k
    + 0.00015437 * T * T - 0.000000150 * T * T * T + 0.00000000073 * T * T * T * T);
}

/** 使 `approxNewMoon(k)` 落在 jd 附近的 k。 */
export const newMoonIndexNear = (jd: number): number =>
  Math.round((jd - 2451550.09766) / SYNODIC_MONTH_DAYS);

// deltaT 在 astro/deltaT.ts，此处只取秒数，避免循环导入形状
import { deltaTSeconds } from "./deltaT.js";
const deltaTOf = (year: number, month: number): number => deltaTSeconds(year, month).seconds;

/**
 * 上升点、中天与整宫制分宫 —— 七政四余与西洋占星共用的那一套角。
 *
 * ## 为什么这一层单独写
 *
 * 行星位置只跟时刻有关，这里的东西**还跟地点有关**，而且跟得很紧：
 * 同一时刻、南北差一度，上升点就能差出几度；差一个时区，差出小半个黄道。
 *
 * 四柱对地点的依赖只到真太阳时（经度）那一层，纬度根本不进算式。
 * 到了这里纬度第一次成为必需输入 —— 这是两类占法在**输入**上的实质分野，
 * 不是风格差异。`compare/systems.ts` 的 `inputs` 一栏早就记着这件事
 * （四柱「时刻」，七政四余与占星「时刻 + 地点」），这里把它兑现。
 *
 * ## 分宫制：只做整宫
 *
 * 分宫制有十几种（Placidus、Koch、Regiomontanus、等宫、整宫……），
 * 彼此在高纬度能差出整整一宫，而**没有一种是「对」的** ——
 * 它们是对同一个几何问题的不同约定。本项目对这类分歧一向的做法是
 * 把它做成参数并声明（见 `params` 的流派开关）。
 *
 * 但这里先只做**整宫制**（whole-sign），理由有三：
 *
 * 1. 它是希腊化占星原本用的那一种 —— 做古典占星而用 Placidus，
 *    是拿十七世纪的约定去读二世纪的规则。
 * 2. 它不需要在高纬度做任何特例处理。象限制在极圈内会退化
 *    （上升点可能整天不动），那些特例每一条都是没有公认答案的约定。
 * 3. 它让「宫」与「宫位」成为同一件事，庙旺与宫主的规则因此是纯符号的，
 *    不掺任何几何近似。
 *
 * 要加别的分宫制是后话，且应当作为流派参数加，不是替换。
 */

import { cosDeg, norm360, sinDeg, tanDeg } from "../astro/angles.js";
import type { JulianDayTT, JulianDay } from "../astro/julian.js";
import { nutation, trueObliquity } from "../astro/nutation.js";

/**
 * 格林尼治**视**恒星时，度。
 *
 * 平恒星时加赤经章动（Δψ·cos ε）。用视而非平：上升点是真黄道上的点，
 * 混用两者会引入最大约 1.1 秒时间（0.004°）的偏差 —— 小，但没有理由要。
 *
 * 入参是 UT 的儒略日**而非 TT** —— 恒星时衡量的是地球转过多少，
 * 那是世界时的事。这里最容易出的错就是把 TT 传进来，
 * 结果整体偏 ΔT 秒（当代约 69 秒，折合 0.29°）。故类型上就分开。
 */
export function apparentSiderealTime(jdUT: JulianDay, jdTT: JulianDayTT): number {
  const T = (jdUT - 2451545.0) / 36525;
  // IAU 1982 平恒星时（Meeus 12.4），度
  const mean = norm360(
    280.46061837 + 360.98564736629 * (jdUT - 2451545.0)
    + 0.000387933 * T * T - (T * T * T) / 38710000);
  const { deltaPsi } = nutation(jdTT);
  return norm360(mean + deltaPsi * cosDeg(trueObliquity(jdTT)));
}

export interface ChartAngles {
  /** 上升点黄经，度。 */
  readonly ascendant: number;
  /** 中天黄经，度。 */
  readonly midheaven: number;
  /** 当地视恒星时，度。 */
  readonly localSiderealTime: number;
  /** 真黄赤交角，度。 */
  readonly obliquity: number;
}

/**
 * 上升点与中天。
 *
 * @param longitudeEast 地理经度，**东经为正**。与本项目其余各处一致。
 * @param latitude      地理纬度，北纬为正。
 *
 * ⚠️ 极区（|φ| > 66.5°）上升点仍算得出，但它在那里会快速跳变，
 * 而整宫制之外的分宫制会直接退化。本函数不做特例，由上层决定要不要警告。
 */
export function chartAngles(
  jdUT: JulianDay, jdTT: JulianDayTT,
  longitudeEast: number, latitude: number,
): ChartAngles {
  const eps = trueObliquity(jdTT);
  const lst = norm360(apparentSiderealTime(jdUT, jdTT) + longitudeEast);

  // 中天：黄道与子午圈的交点
  const mc = norm360(Math.atan2(sinDeg(lst), cosDeg(lst) * cosDeg(eps)) * 180 / Math.PI);

  // 上升点：黄道与地平圈东侧的交点
  //
  // 分母取负号是标准式的写法；atan2 已处理象限，故不需再按 LST 落在
  // 哪一象限去加减 180° —— 那种「分情况加 180」的写法是 atan 时代的遗留，
  // 极易在边界上错一宫。
  const asc = norm360(Math.atan2(
    cosDeg(lst),
    -(sinDeg(lst) * cosDeg(eps) + tanDeg(latitude) * sinDeg(eps)),
  ) * 180 / Math.PI);

  return { ascendant: asc, midheaven: mc, localSiderealTime: lst, obliquity: eps };
}

/** 黄道十二宫，自白羊 0° 起每 30° 一宫。与 `compare/substrate.ts` 的那一份同源。 */
export const SIGNS: readonly { readonly name: string; readonly nameEn: string }[] =
  Object.freeze([
    { name: "白羊", nameEn: "Aries" }, { name: "金牛", nameEn: "Taurus" },
    { name: "双子", nameEn: "Gemini" }, { name: "巨蟹", nameEn: "Cancer" },
    { name: "狮子", nameEn: "Leo" }, { name: "处女", nameEn: "Virgo" },
    { name: "天秤", nameEn: "Libra" }, { name: "天蝎", nameEn: "Scorpio" },
    { name: "人马", nameEn: "Sagittarius" }, { name: "摩羯", nameEn: "Capricorn" },
    { name: "宝瓶", nameEn: "Aquarius" }, { name: "双鱼", nameEn: "Pisces" },
  ]);

/** 黄经落在第几宫（0 = 白羊）。 */
export const signIndexOf = (longitude: number): number =>
  Math.floor(norm360(longitude) / 30);

/** 黄经在本宫内的度数，[0, 30)。 */
export const degreeInSign = (longitude: number): number => norm360(longitude) % 30;

/**
 * 整宫制的宫位号（1–12）。
 *
 * 上升点**所在的整宫**即第一宫，不论上升点落在该宫的第几度 ——
 * 这正是整宫制与等宫制的分别：等宫制以上升点那一度为一宫起点。
 */
export function wholeSignHouse(longitude: number, ascendant: number): number {
  return ((signIndexOf(longitude) - signIndexOf(ascendant) + 12) % 12) + 1;
}

/**
 * 距最近宫界多少度 —— 永远随位置一起报出。
 *
 * 理由与节气那边一模一样：本模块的黄经实测误差 25″，宫界是锐利的 30°，
 * 于是「这颗星在哪一宫」在界附近 25″ 内是说不准的。
 * 本系统的做法一向是**如实报出距离**，而不是假装边界是锐利的。
 */
export function distanceToSignBoundary(longitude: number): number {
  const d = degreeInSign(longitude);
  return Math.min(d, 30 - d);
}

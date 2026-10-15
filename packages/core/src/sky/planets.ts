/**
 * 五星的视黄经、黄纬与地心距 —— 七政四余与西洋占星的地基。
 *
 * ## 为什么四柱用不上它，这里却要算
 *
 * 四柱只要太阳（节气）与月亮（农历），不要行星。但本项目的 `compare/`
 * 一直有两套系统挂着 `implemented: false`：**七政四余**与**西洋占星**。
 * 它们在那张「测天 / 约定」的分类表里同属「实测天体」那一端 ——
 * 输入直接是日月五星的实际位置，要算星历才起得了盘。
 *
 * 而这两套本来就共用同一份星历。`compare/substrate.ts` 已经算出过
 * 中气 ≡ 黄道十二宫入宫点（同一批时刻），`compare/correspondence.ts`
 * 已经算出过四余 = 月亮交点与远地点。缺的一直是**七政**本身。
 * 补上它，那条「东西方共用一片天」的论证就从论述变成可执行的数。
 *
 * ## 算法（Meeus 第 33 章）
 *
 * 1. 地球与行星的**日心**黄道坐标各由 VSOP87D 级数求出（L、B、R）。
 * 2. 转直角坐标相减，得地心向量 —— 但行星的位置要取**光离开它的那一刻**，
 *    故对光行时迭代。
 * 3. 加周年光行差（地球速度引起，最大 20.5″）。
 * 4. 加黄经章动 Δψ（最大 17″）。
 * 5. 加 FK5 修正（动力学黄道 → FK5，约 0.09″）。
 *
 * ## 精度：实测 25 角秒，而且那不是截断造成的
 *
 * 对 Astronomy Engine（JPL 标定）在 1900–2100 每 37 天取一点、
 * 共 1975 点实测：
 *
 * ```
 * 星     黄经最大   黄经均方根   黄纬最大   地心距最大
 * 水星    11.9″       2.6″        8.6″       77 ppm
 * 金星    19.3″       2.8″       12.0″      124 ppm
 * 火星    12.8″       2.2″       15.4″      139 ppm
 * 木星    10.4″       3.4″       13.8″      157 ppm
 * 土星    12.8″       4.2″       21.8″      162 ppm
 * ```
 *
 * **这一档差异不是本模块截断出来的。** 拿未截断的完整 VSOP87D 级数
 * 重算土星，与截断版相差仅 0.03″，而与 Astronomy Engine 仍差 12.3″ ——
 * 也就是说差异来自 **VSOP87 这套解析理论本身**与 JPL 数值历表的出入，
 * 换一个截断阈值一点都改变不了。（这个对照实验值得保留在记忆里：
 * 看见两套实现不合，第一反应往往是怪自己的截断，而那次恰好不是。）
 *
 * 故保守上报 **25″**，并如实说明它是理论的限度，不是实现的粗糙。
 *
 * ## 25″ 对这两套占法意味着什么
 *
 * 几乎什么都不意味着。宫位边界是 30°，庙旺界限是整宫，
 * 相位的容许度（orb）通常取 6°–8° —— 25″ 是 0.007°，比它们小三个数量级。
 *
 * 唯一会被它影响的是「某颗星此刻是否正好在宫界上」这类问题，
 * 而一颗星落在宫界 25″ 以内的概率约 1/4300。那与节气落在节前后
 * 一分钟内是同一类边界情形：**本系统的做法一向是如实报出距离，
 * 而不是假装边界是锐利的。**
 *
 * 也因此这里不追求节气那样的 60 秒容差 —— 那是太阳黄经的要求，
 * 由它决定月柱，错一分钟就整柱改变。行星没有这样的硬边界。
 */

import {
  EARTH_B, MERCURY_L, MERCURY_B, MERCURY_R, VENUS_L, VENUS_B, VENUS_R,
  MARS_L, MARS_B, MARS_R, JUPITER_L, JUPITER_B, JUPITER_R,
  SATURN_L, SATURN_B, SATURN_R, type Vsop87Series,
} from "@fate/data/vsop87-planets";
import { EARTH_L, EARTH_R } from "@fate/data";
import { arcsecToDeg, norm360 } from "../astro/angles.js";
import { julianMillennium, asTT, type JulianDayTT } from "../astro/julian.js";
import { nutation } from "../astro/nutation.js";
import { evaluateSeries } from "../astro/vsop87.js";

const RAD_TO_DEG = 180 / Math.PI;

/** 五星。太阳与月亮各有自己的模块，不在此处 —— 它们的算法完全不同。 */
export type PlanetId = "mercury" | "venus" | "mars" | "jupiter" | "saturn";

export const PLANETS: readonly PlanetId[] = Object.freeze([
  "mercury", "venus", "mars", "jupiter", "saturn",
]);

/** 五星的中文名。七政四余与西洋占星共用同一批天体，故名字只此一份。 */
export const PLANET_NAME: Readonly<Record<PlanetId, string>> = Object.freeze({
  mercury: "水星", venus: "金星", mars: "火星", jupiter: "木星", saturn: "土星",
});

interface Series { readonly L: Vsop87Series; readonly B: Vsop87Series; readonly R: Vsop87Series }

const SERIES: Readonly<Record<PlanetId, Series>> = Object.freeze({
  mercury: { L: MERCURY_L, B: MERCURY_B, R: MERCURY_R },
  venus: { L: VENUS_L, B: VENUS_B, R: VENUS_R },
  mars: { L: MARS_L, B: MARS_B, R: MARS_R },
  jupiter: { L: JUPITER_L, B: JUPITER_B, R: JUPITER_R },
  saturn: { L: SATURN_L, B: SATURN_B, R: SATURN_R },
});

/** 日心黄道直角坐标（AU），当日平动力学黄道与平分点。 */
interface Rect { readonly x: number; readonly y: number; readonly z: number }

function heliocentricRect(s: Series, tau: number): Rect {
  const L = evaluateSeries(s.L, tau);
  const B = evaluateSeries(s.B, tau);
  const R = evaluateSeries(s.R, tau);
  const cosB = Math.cos(B);
  return { x: R * cosB * Math.cos(L), y: R * cosB * Math.sin(L), z: R * Math.sin(B) };
}

function earthRect(tau: number): Rect {
  const L = evaluateSeries(EARTH_L, tau);
  const B = evaluateSeries(EARTH_B, tau);
  const R = evaluateSeries(EARTH_R, tau);
  const cosB = Math.cos(B);
  return { x: R * cosB * Math.cos(L), y: R * cosB * Math.sin(L), z: R * Math.sin(B) };
}

/**
 * 光走 1 AU 所需的天数（Meeus 33.3）。
 *
 * 不迭代会怎样：木星合日时光行时约 50 分钟，木星日行 0.083°，
 * 折合 0.003° ≈ 10″ —— 比级数截断残差大一个量级，是这一层最大的单项误差。
 */
const LIGHT_TIME_DAYS_PER_AU = 0.0057755183;

/** 周年光行差常数，角秒。 */
const ABERRATION_CONSTANT = 20.4898;

export interface PlanetPosition {
  /** 视黄经，度，[0, 360)。 */
  readonly longitude: number;
  /** 视黄纬，度。 */
  readonly latitude: number;
  /** 地心距，AU。 */
  readonly distance: number;
  /** 日心向径，AU —— 判断顺逆留与合冲时用得上。 */
  readonly radiusVector: number;
  /** 光行时，天。如实带出，便于上层核对而不必重算。 */
  readonly lightTimeDays: number;
}

/**
 * 行星的视地心黄道坐标。
 *
 * `jdTT` 为力学时的儒略日 —— 与本项目其余天文函数一致，
 * 由调用方先做 ΔT 换算。混用 UT 会带来最大约 70 秒的时间偏差，
 * 对土星折合 0.00003°，可忽略；但对水星是 0.003°，不该省。
 */
export function planetPosition(id: PlanetId, jdTT: JulianDayTT): PlanetPosition {
  const s = SERIES[id];
  const tau = julianMillennium(jdTT);
  const earth = earthRect(tau);

  // ── 光行时迭代 ──
  //
  // 两轮即收敛到 1e-9 天以下（行星在 50 分钟里走不了多远，
  // 而 Δ 对这点位移不敏感）。取三轮是因为第三轮不要钱，
  // 而一个「大多数情况下够用」的迭代次数迟早会撞上不够用的那一次。
  let lightTime = 0;
  let planet = heliocentricRect(s, tau);
  let dx = 0, dy = 0, dz = 0, delta = 0;
  for (let i = 0; i < 3; i++) {
    planet = heliocentricRect(
      s, julianMillennium(asTT(jdTT - lightTime)));
    dx = planet.x - earth.x;
    dy = planet.y - earth.y;
    dz = planet.z - earth.z;
    delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
    lightTime = delta * LIGHT_TIME_DAYS_PER_AU;
  }

  const lambda = Math.atan2(dy, dx) * RAD_TO_DEG;
  const beta = Math.atan2(dz, Math.sqrt(dx * dx + dy * dy)) * RAD_TO_DEG;

  // ── 周年光行差 ──
  //
  // 取 Meeus 33.2 的经典式：以太阳的几何黄经与地球轨道偏心率表出，
  // 比逐分量求地球速度短得多，残差在 0.001″ 量级。
  const T = (jdTT - 2451545.0) / 36525;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const pi = 102.93735 + 1.71946 * T + 0.00046 * T * T;      // 近日点黄经
  const sunLon = norm360(evaluateSeries(EARTH_L, tau) * RAD_TO_DEG + 180);
  const k = arcsecToDeg(ABERRATION_CONSTANT);
  const dLambda =
    (-k * Math.cos((sunLon - lambda) * Math.PI / 180)
      + e * k * Math.cos((pi - lambda) * Math.PI / 180))
    / Math.cos(beta * Math.PI / 180);
  const dBeta =
    -k * Math.sin(beta * Math.PI / 180)
    * (Math.sin((sunLon - lambda) * Math.PI / 180)
      - e * Math.sin((pi - lambda) * Math.PI / 180));

  // ── 章动与 FK5 ──
  //
  // FK5 的第二项 0.03916″(cos λ + sin λ) tan β 对太阳可略（|β| < 1.2″），
  // 对行星**不可略** —— 水星的黄纬可达 7°，tan β ≈ 0.12，该项约 0.005″。
  // 仍是小量，但这里一并写出，免得日后有人照着太阳那边的注释以为可略。
  const { deltaPsi } = nutation(jdTT);
  const lamFk5 = lambda + dLambda;
  const fk5Lon = arcsecToDeg(
    -0.09033 + 0.03916 * (Math.cos(lamFk5 * Math.PI / 180) + Math.sin(lamFk5 * Math.PI / 180))
    * Math.tan(beta * Math.PI / 180));
  const fk5Lat = arcsecToDeg(
    0.03916 * (Math.cos(lamFk5 * Math.PI / 180) - Math.sin(lamFk5 * Math.PI / 180)));

  return {
    longitude: norm360(lamFk5 + fk5Lon + deltaPsi),
    latitude: beta + dBeta + fk5Lat,
    distance: delta,
    radiusVector: Math.sqrt(planet.x ** 2 + planet.y ** 2 + planet.z ** 2),
    lightTimeDays: lightTime,
  };
}

/**
 * 本模块保守上报的黄经精度，角秒。
 *
 * **不是**由截断残差推出来的 —— 那样只会得到 1″ 这个好看而不实的数。
 * 它是对 Astronomy Engine 在 1900–2100 实测 1975 点的最大差，向上取整：
 * 实测最大 19.3″（金星），取 25″。
 *
 * 由 `test/planets.spec.ts` 锁住两头：实测差不得超过它，
 * 而它也不得报得比实测更好。一个只写在注释里的精度声明等于没有。
 */
export const PLANET_ACCURACY_ARCSEC = 25;

/**
 * 黄纬与地心距的实测上界 —— 同一批采样，同样向上取整。
 *
 * 分开给而不是合成一个「精度」：黄纬的差比黄经大（土星 21.8″），
 * 把两者并成一个数，不是把黄经说松了，就是把黄纬说紧了。
 */
export const PLANET_LATITUDE_ACCURACY_ARCSEC = 25;
export const PLANET_DISTANCE_ACCURACY_PPM = 200;

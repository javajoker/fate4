/**
 * 章动与黄赤交角（Meeus 第 22 章，简化式）。
 *
 * **为何不可省略**：黄经章动 Δψ 的振幅约 17.2″。
 * 太阳日均行 0.9856°，故 17.2″ 折合约 **7 分钟**的时间偏差 ——
 * 远超本引擎 60 秒的容差。任何号称能算准节气而略去章动的实现都是错的。
 *
 * 简化式的精度：Δψ 约 0.5″、Δε 约 0.1″，
 * 折合时间不足 3 秒，相对 60 秒容差有充分余量。
 */

import { arcsecToDeg, cosDeg, sinDeg } from "./angles.js";
import { julianCentury, type JulianDayTT } from "./julian.js";

export interface Nutation {
  /** 黄经章动，度。 */
  readonly deltaPsi: number;
  /** 交角章动，度。 */
  readonly deltaEpsilon: number;
}

export function nutation(jdTT: JulianDayTT): Nutation {
  const T = julianCentury(jdTT);

  // 月球升交点平黄经
  const omega = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
  // 太阳平黄经
  const L = 280.4665 + 36000.7698 * T;
  // 月球平黄经
  const Lp = 218.3165 + 481267.8813 * T;

  const dPsiArcsec =
    -17.20 * sinDeg(omega)
    - 1.32 * sinDeg(2 * L)
    - 0.23 * sinDeg(2 * Lp)
    + 0.21 * sinDeg(2 * omega);

  const dEpsArcsec =
    9.20 * cosDeg(omega)
    + 0.57 * cosDeg(2 * L)
    + 0.10 * cosDeg(2 * Lp)
    - 0.09 * cosDeg(2 * omega);

  return { deltaPsi: arcsecToDeg(dPsiArcsec), deltaEpsilon: arcsecToDeg(dEpsArcsec) };
}

/** 平黄赤交角，度（Laskar 十次多项式，Meeus 22.3）。 */
export function meanObliquity(jdTT: JulianDayTT): number {
  const U = julianCentury(jdTT) / 100;
  const arcsec =
    21.448
    - U * (4680.93
    + U * (1.55
    - U * (1999.25
    - U * (51.38
    + U * (249.67
    + U * (39.05
    - U * (7.12
    + U * (27.87
    + U * (5.79 + U * 2.45)))))))));
  return 23 + 26 / 60 + arcsec / 3600;
}

/** 真黄赤交角 = 平交角 + 交角章动。 */
export function trueObliquity(jdTT: JulianDayTT): number {
  return meanObliquity(jdTT) + nutation(jdTT).deltaEpsilon;
}

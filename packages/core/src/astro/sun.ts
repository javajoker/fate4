/**
 * 太阳视黄经。
 *
 * 黄经级数做成**可插拔的 provider**，因为不同精度等级的级数是不同来源的数据，
 * 而本引擎对节气的容差（60 秒 ≈ 黄经 0.0007° ≈ 2.5″）决定了必须用高精度级数。
 *
 * ┌──────────────────┬────────────┬──────────────────────────────┐
 * │ provider         │ 黄经精度   │ 折合节气时刻误差             │
 * ├──────────────────┼────────────┼──────────────────────────────┤
 * │ meeusLowPrecision│ 约 0.01°   │ 约 ±15 分钟 —— **不达标**    │
 * │ vsop87           │ 约 1″      │ 约 ±1 秒 —— 达标             │
 * └──────────────────┴────────────┴──────────────────────────────┘
 *
 * vsop87 provider 需要 Earth 的 L/R 级数系数（约 195 组），
 * 该数据尚未落地，见 docs/11-validation.md 待校准项。
 * 在它就位前，engine 以 meeusLowPrecision 运行并**在输出中标记精度等级** ——
 * 绝不以低精度结果冒充达标结果。
 */

import { arcsecToDeg, cosDeg, norm360, sinDeg } from "./angles.js";
import { julianCentury, type JulianDayTT } from "./julian.js";
import { nutation } from "./nutation.js";

export interface SolarPosition {
  /** 几何黄经（度），未加章动与光行差。 */
  readonly geometricLongitude: number;
  /** 日地距离，天文单位。用于光行差。 */
  readonly radiusVector: number;
}

export interface SolarLongitudeProvider {
  readonly id: string;
  /** 该级数自称的黄经精度，角秒。用于向上层如实报告能力。 */
  readonly statedAccuracyArcsec: number;
  /** 该 provider 是否足以支撑 60 秒的节气容差。 */
  readonly meetsSolarTermTolerance: boolean;
  position(jdTT: JulianDayTT): SolarPosition;
}

/**
 * Meeus 第 25 章的简化解（开普勒二体 + 中心差三项）。
 *
 * 缺失的是行星摄动与月球引起的地月质心偏移 —— 后者振幅约 6.4″，
 * 是 0.01° 残差中最大的一块。要补齐必须上 VSOP87，没有中间路线。
 */
export const meeusLowPrecision: SolarLongitudeProvider = {
  id: "meeus-low-precision",
  statedAccuracyArcsec: 36,
  meetsSolarTermTolerance: false,

  position(jdTT: JulianDayTT): SolarPosition {
    const T = julianCentury(jdTT);

    // 几何平黄经（FK5 参考系）
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    // 平近点角
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    // 轨道偏心率
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;

    // 中心差
    const C =
      (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinDeg(M)
      + (0.019993 - 0.000101 * T) * sinDeg(2 * M)
      + 0.000289 * sinDeg(3 * M);

    const trueLongitude = L0 + C;
    const trueAnomaly = M + C;
    const R = (1.000001018 * (1 - e * e)) / (1 + e * cosDeg(trueAnomaly));

    return { geometricLongitude: norm360(trueLongitude), radiusVector: R };
  },
};

/** 光行差常数，角秒·AU。 */
const ABERRATION_CONSTANT = 20.4898;

/**
 * 太阳视黄经（度）—— 几何黄经 + 黄经章动 + 周年光行差。
 *
 * 节气的定义正是视黄经取 15° 的整数倍，故此函数是整个 L0 排盘层的地基。
 */
export function apparentSolarLongitude(
  jdTT: JulianDayTT,
  provider: SolarLongitudeProvider = meeusLowPrecision,
): number {
  const { geometricLongitude, radiusVector } = provider.position(jdTT);
  const { deltaPsi } = nutation(jdTT);
  const aberration = -arcsecToDeg(ABERRATION_CONSTANT / radiusVector);
  return norm360(geometricLongitude + deltaPsi + aberration);
}

/** 太阳日均视行度（度/日），Newton 迭代的一阶导近似。 */
export const MEAN_SOLAR_MOTION_DEG_PER_DAY = 360 / 365.2421897;

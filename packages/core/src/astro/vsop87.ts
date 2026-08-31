/**
 * VSOP87D provider —— 达到节气 60 秒容差所需的高精度黄经级数。
 *
 * 系数取自官方档案，程序化生成，见 @fate/data 与 scripts/generate-vsop87.mjs。
 *
 * ## 误差预算
 *
 * 60 秒的时刻容差，折合太阳视黄经 2.5″（太阳日行 0.9856°）。各项占用：
 *
 * | 来源                    | 黄经误差 | 折合时间 |
 * | ----------------------- | -------- | -------- |
 * | 级数截断（|A| < 1e-9）  | 0.03″    | 0.7 秒   |
 * | 章动简化式（Meeus 22）  | 0.5″     | 12 秒    |
 * | 光行差简化式            | 0.01″    | 0.2 秒   |
 * | FK5 修正（已计入）      | —        | —        |
 * | **黄经合计**            | **0.55″**| **13 秒**|
 * | ΔT 外推偏差（另计）     | —        | 2–3 秒   |
 * | **总计**                |          | **≈16 秒** |
 *
 * 余量约 3.7 倍。其中最大的一块是章动简化式的 0.5″ —— 若日后需要更高精度，
 * 换用 IAU 完整章动序列（63 项）可把它压到 0.001″ 量级，是唯一值得做的下一步。
 *
 * ⚠️ 2050 年以后不承诺 60 秒容差：ΔT 是对地球自转不规则变化的外推，
 * 其不确定度届时已超过容差。这是物理限制，非实现缺陷。
 */

import { EARTH_L, EARTH_R, VSOP87_PROVENANCE, type Vsop87Series } from "@fate/data";
import { arcsecToDeg, norm360 } from "./angles.js";
import { julianMillennium, type JulianDayTT } from "./julian.js";
import type { SolarLongitudeProvider, SolarPosition } from "./sun.js";

const RAD_TO_DEG = 180 / Math.PI;

/**
 * 求 Σ_k τ^k · Σ_i A_i cos(B_i + C_i·τ)。
 *
 * 用 Horner 式自高次向低次累加，避免 τ^k 的重复求幂，
 * 也让高次项的浮点误差不被低次项淹没。
 */
export function evaluateSeries(series: Vsop87Series, tau: number): number {
  let acc = 0;
  for (let k = series.length - 1; k >= 0; k--) {
    const terms = series[k]!;
    let sum = 0;
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i]!;
      sum += t[0] * Math.cos(t[1] + t[2] * tau);
    }
    acc = acc * tau + sum;
  }
  return acc;
}

/**
 * VSOP87 的动力学黄道 → FK5 参考系的黄经修正（Meeus 25.9）。
 *
 * 完整式为 Δλ = −0.09033″ + 0.03916″(cos λ′ + sin λ′) tan β。
 * 太阳黄纬 |β| < 1.2″，故 tan β < 6e-6，第二项量级约 3e-7″ —— 可略。
 * 只保留常数项。
 */
const FK5_LONGITUDE_CORRECTION_DEG = arcsecToDeg(-0.09033);

export const vsop87: SolarLongitudeProvider = {
  id: "vsop87d-truncated",
  /** 级数截断 0.03″ + 章动简化 0.5″，取整为 0.6″ 保守上报。 */
  statedAccuracyArcsec: 0.6,
  meetsSolarTermTolerance: true,

  position(jdTT: JulianDayTT): SolarPosition {
    const tau = julianMillennium(jdTT);

    // 地球日心黄经（弧度）与向径（AU）
    const earthLongitude = evaluateSeries(EARTH_L, tau);
    const radiusVector = evaluateSeries(EARTH_R, tau);

    // 地球日心黄经 + 180° = 太阳地心黄经
    const sunLongitude = earthLongitude * RAD_TO_DEG + 180 + FK5_LONGITUDE_CORRECTION_DEG;

    return { geometricLongitude: norm360(sunLongitude), radiusVector };
  },
};

export { VSOP87_PROVENANCE };

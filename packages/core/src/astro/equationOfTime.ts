/**
 * 均时差 E = 平太阳时 − 真太阳时（Meeus 第 28 章）。
 *
 * 取值范围约 −14.2 分钟（2 月中）到 +16.4 分钟（11 月初）。
 *
 * **为何必须做**：时辰边界在整点上，而均时差最大可达 16 分钟。
 * 一个钟表时 10:52 出生的人，均时差 +9 分钟即跨入下一个时辰 ——
 * 时柱因此完全不同。这不是精度洁癖，是会改变盘面的实质差异。
 */

import { cosDeg, degToMinutes, norm360, normSigned, sinDeg } from "./angles.js";
import { julianCentury, type JulianDayTT } from "./julian.js";
import { nutation, trueObliquity } from "./nutation.js";
import { apparentSolarLongitude, type SolarLongitudeProvider } from "./sun.js";
import { DEFAULT_SOLAR_PROVIDER } from "./defaults.js";

/**
 * 返回均时差，单位分钟。
 * 正值表示真太阳时**快于**平太阳时（日晷读数大于钟表）。
 */
export function equationOfTimeMinutes(
  jdTT: JulianDayTT,
  provider: SolarLongitudeProvider | undefined = DEFAULT_SOLAR_PROVIDER,
): number {
  const T = julianCentury(jdTT);
  const tau = T / 10;

  // 太阳平黄经（Meeus 28.2 的十次式，此处取足够项）
  const L0 = norm360(
    280.4664567
    + 360007.6982779 * tau
    + 0.03032028 * tau * tau
    + (tau * tau * tau) / 49931
    - (tau ** 4) / 15300
    - (tau ** 5) / 2000000,
  );

  const lambda = apparentSolarLongitude(jdTT, provider ?? DEFAULT_SOLAR_PROVIDER);
  const epsilon = trueObliquity(jdTT);
  const { deltaPsi } = nutation(jdTT);

  // 视赤经
  const alpha = norm360(
    Math.atan2(cosDeg(epsilon) * sinDeg(lambda), cosDeg(lambda)) / (Math.PI / 180),
  );

  const eDeg = normSigned(L0 - 0.0057183 - alpha + deltaPsi * cosDeg(epsilon));
  return degToMinutes(eDeg);
}

/** 供健全性检查：均时差的理论极值（分钟）。 */
export const EOT_RANGE_MINUTES = { min: -16.5, max: 16.5 } as const;

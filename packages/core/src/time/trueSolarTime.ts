/**
 * 真太阳时校正。
 *
 * 三步，顺序不可换：
 *   1. 民用钟表时 → UTC          （时区 + 历史夏令时规则）
 *   2. UTC → 平太阳时            （经度校正：出生地实际经度，非时区中心经度）
 *   3. 平太阳时 → 真太阳时       （均时差）
 *
 * 第 2 步用的必须是**出生地经度**。中国全境行用东八区，
 * 但乌鲁木齐在东经 87°，与 120° 差 33°，折合 132 分钟 —— 超过一个时辰。
 * 用时区中心经度算，等于给新疆出生的人系统性地错一到两个时辰。
 */

import { asTT, type CalendarDateTime } from "../astro/julian.js";
import { deltaTSeconds } from "../astro/deltaT.js";
import { equationOfTimeMinutes } from "../astro/equationOfTime.js";
import type { SolarLongitudeProvider } from "../astro/sun.js";
import { millisToJulianDay, wallTimeToUtc, type OffsetResolution } from "./timezone.js";

export interface TrueSolarTimeInput {
  readonly wall: CalendarDateTime;
  readonly timeZone: string;
  /** 出生地经度，东经为正。 */
  readonly longitude: number;
  readonly applyEquationOfTime?: boolean;
  readonly applyLongitude?: boolean;
  readonly provider?: SolarLongitudeProvider;
}

export interface TrueSolarTimeResult {
  /** 真太阳时对应的儒略日（UT 标度）。后续节气比较、日柱推算皆基于它。 */
  readonly jdTrueSolar: number;
  /** 未经真太阳时校正的儒略日，供对照。 */
  readonly jdCivil: number;
  readonly corrections: {
    readonly tzOffsetMinutes: number;
    readonly isDaylightSaving: boolean;
    readonly longitudeMinutes: number;
    readonly equationOfTimeMinutes: number;
    readonly totalMinutes: number;
  };
  readonly resolution: OffsetResolution;
  readonly alternativeJd: number | null;
}

/** 时区中心经度（东八区为 120°E）之外的经度差，每度折合 4 分钟。 */
export const MINUTES_PER_DEGREE = 4;

export function toTrueSolarTime(input: TrueSolarTimeInput): TrueSolarTimeResult {
  const applyEot = input.applyEquationOfTime ?? true;
  const applyLon = input.applyLongitude ?? true;

  const conv = wallTimeToUtc(input.wall, input.timeZone);
  const jdCivil = millisToJulianDay(conv.utcMillis);

  // 经度校正：以本初子午线为基准，出生地经度直接给出其平太阳时
  const longitudeMinutes = applyLon ? input.longitude * MINUTES_PER_DEGREE : 0;

  // 均时差以该时刻的 TT 求值；ΔT 只有约 70 秒，对均时差本身的影响可忽略，
  // 但仍照做，以免在 2100 年附近积累出可察觉的偏差。
  const dt = deltaTSeconds(input.wall.year, input.wall.month);
  const jdTTApprox = asTT(jdCivil + dt.seconds / 86400);
  const eot = applyEot ? equationOfTimeMinutes(jdTTApprox, input.provider) : 0;

  const totalMinutes = longitudeMinutes + eot;
  const jdTrueSolar = jdCivil + totalMinutes / 1440;

  return {
    jdTrueSolar,
    jdCivil,
    corrections: {
      tzOffsetMinutes: conv.offsetMinutes,
      isDaylightSaving: conv.isDaylightSaving,
      longitudeMinutes,
      equationOfTimeMinutes: eot,
      totalMinutes,
    },
    resolution: conv.resolution,
    alternativeJd: conv.alternativeUtcMillis === null
      ? null
      : millisToJulianDay(conv.alternativeUtcMillis) + totalMinutes / 1440,
  };
}

/** 便捷：从年月日时分构造 CalendarDateTime。 */
export function wall(
  year: number, month: number, day: number,
  hour = 0, minute = 0, second = 0,
): CalendarDateTime {
  return { year, month, day, hour, minute, second };
}

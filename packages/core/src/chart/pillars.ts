/**
 * 四柱定支定干。
 *
 * ## 时间标度的分工（本层最容易出错的地方）
 *
 * 三种时刻在这里同台，混用必错：
 *
 * | 定什么 | 用哪个标度 | 为什么 |
 * | --- | --- | --- |
 * | 年柱、月柱 | **绝对时刻 UT** | 节气是天文事件，与观测者所在经度无关。用真太阳时去比节气，等于把经度差错算进节气边界 |
 * | 时支、日界 | **真太阳时** | 时辰是本地日影构造，本就该随经度而移 |
 *
 * 「真太阳时 13:39」与「节气时刻 UT 20:02」不是同一把尺子上的刻度，
 * 拿来直接比较是这类实现最隐蔽的一类 bug。
 */

import {
  branchAt, hourStemOf, mod, monthStemOf, stemAt,
} from "../ganzhi/algebra.js";
import type { Branch, Pillar, Stem } from "../types/ganzhi.js";
import { asTT, fromJulianDay, julianDayNumber, toJulianDay, type CalendarDateTime } from "../astro/julian.js";
import { deltaTSeconds } from "../astro/deltaT.js";
import { apparentSolarLongitude } from "../astro/sun.js";
import { DEFAULT_SOLAR_PROVIDER } from "../astro/defaults.js";
import { MEAN_SOLAR_MOTION_DEG_PER_DAY } from "../astro/sun.js";
import { SOLAR_TERMS, solveSolarTerm, type SolarTermDef, type SolveOptions } from "../astro/solarTerms.js";
import type { ZiHourRule } from "./types.js";

/** UT 儒略日 → TT 儒略日。 */
export function utToTT(jdUT: number): number {
  const cal = fromJulianDay(jdUT);
  return jdUT + deltaTSeconds(cal.year, cal.month).seconds / 86400;
}

/**
 * 求出生时刻所处的节（或气）区间。
 *
 * 不逐年枚举 24 节气 —— 先由出生时刻的视黄经直接定位所属的 30° 区间，
 * 只解前后两个。两次求根即可，而非 72 次。
 *
 * 节位于 315 + 30k（立春起），气位于 330 + 30k（雨水起）。
 */
export function enclosingTermOf(
  birthJdUT: number,
  kind: "节" | "气",
  options: SolveOptions = {},
): { prev: { def: SolarTermDef; jdUT: number }; next: { def: SolarTermDef; jdUT: number } } {
  const base = kind === "节" ? 315 : 330;
  const jdTT = asTT(utToTT(birthJdUT));
  const lambda = apparentSolarLongitude(jdTT, options.provider ?? DEFAULT_SOLAR_PROVIDER);

  const k = Math.floor(mod(lambda - base, 360) / 30);
  const prevLon = mod(base + 30 * k, 360);
  const nextLon = mod(prevLon + 30, 360);

  const defOf = (lon: number): SolarTermDef => {
    const d = SOLAR_TERMS.find((t) => t.longitude === lon && t.kind === kind);
    if (d === undefined) throw new Error(`黄经 ${lon}° 不是${kind}`);
    return d;
  };

  // 以 λ 与目标黄经之差折算天数作初值
  const guessPrev = (jdTT as number) - mod(lambda - prevLon, 360) / MEAN_SOLAR_MOTION_DEG_PER_DAY;
  const guessNext = (jdTT as number) + mod(nextLon - lambda, 360) / MEAN_SOLAR_MOTION_DEG_PER_DAY;

  const prev = solveSolarTerm(prevLon, asTT(guessPrev), options);
  const next = solveSolarTerm(nextLon, asTT(guessNext), options);

  return {
    prev: { def: defOf(prevLon), jdUT: prev.jdUT as number },
    next: { def: defOf(nextLon), jdUT: next.jdUT as number },
  };
}

/** 出生时刻所处的节区间 —— 月柱定支的唯一依据。 */
export function enclosingJieOf(birthJdUT: number, options: SolveOptions = {}) {
  return enclosingTermOf(birthJdUT, "节", options);
}

/** 某公历年的立春时刻（UT 儒略日）。 */
export function lichunOf(year: number, options: SolveOptions = {}): number {
  const guess = toJulianDay({ year, month: 2, day: 4, hour: 0, minute: 0, second: 0 });
  return solveSolarTerm(315, asTT(utToTT(guess)), options).jdUT as number;
}

/**
 * 年柱 —— 以**立春**为界，不是农历正月初一，也不是元旦。
 * 公元 4 年为甲子年。
 */
export function yearPillarOf(birthJdUT: number, options: SolveOptions = {}): {
  pillar: Pillar; solarYear: number; lichunJd: number;
} {
  const cal = fromJulianDay(birthJdUT);
  let solarYear = cal.year;
  let lichunJd = lichunOf(solarYear, options);
  if (birthJdUT < lichunJd) {
    solarYear -= 1;
    lichunJd = lichunOf(solarYear, options);
  }
  return {
    pillar: { stem: stemAt(solarYear - 4), branch: branchAt(solarYear - 4) },
    solarYear,
    lichunJd,
  };
}

/** 月柱 —— 支由节定，干由年干起五虎遁。 */
export function monthPillarOf(monthBranch: Branch, yearStem: Stem): Pillar {
  return { stem: monthStemOf(yearStem, monthBranch), branch: monthBranch };
}

/** 时支 —— 23–01 为子。由真太阳时的小时定。 */
export function hourBranchOf(trueSolarHour: number): Branch {
  return branchAt(Math.floor(mod(trueSolarHour + 1, 24) / 2));
}

export interface DayAndHour {
  readonly day: Pillar;
  readonly hour: Pillar;
  /** 日柱是否因晚子规则而进位。 */
  readonly dayAdvanced: boolean;
}

/**
 * 日柱与时柱。
 *
 * 日柱锚定：`(儒略日数 + 49) mod 60`，0 = 甲子。
 * 已由 1949-10-01 甲子 与 2000-01-01 戊午 两点交叉验证。
 *
 * 三种子时规则的差别只在 23:00–24:00 这一小时内显现，见 ZiHourRule。
 */
export function dayAndHourPillarOf(
  trueSolarCalendar: CalendarDateTime,
  rule: ZiHourRule,
): DayAndHour {
  const { year, month, day, hour } = trueSolarCalendar;
  const inLateZi = hour >= 23;

  const baseJdn = julianDayNumber(year, month, day);
  const dayAdvanced = inLateZi && rule === "lateZiNextDay";
  const dayJdn = dayAdvanced ? baseJdn + 1 : baseJdn;

  const daySexagenary = mod(dayJdn + 49, 60);
  const dayPillar: Pillar = { stem: stemAt(daySexagenary), branch: branchAt(daySexagenary) };

  // 时干所依的日干：split 规则下晚子时借次日日干
  const stemSourceJdn = inLateZi && (rule === "lateZiNextDay" || rule === "split")
    ? baseJdn + 1
    : baseJdn;
  const stemSourceStem = stemAt(mod(stemSourceJdn + 49, 60));

  const hourBranch = hourBranchOf(hour);
  const hourPillar: Pillar = {
    stem: hourStemOf(stemSourceStem, hourBranch),
    branch: hourBranch,
  };

  return { day: dayPillar, hour: hourPillar, dayAdvanced };
}


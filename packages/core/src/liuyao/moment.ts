/**
 * 起卦时刻 —— 四柱 + 农历。
 *
 * ## 为什么不直接复用 `buildChart`
 *
 * 起卦时刻的四柱与出生时刻的四柱是同一套算法，复用很自然。但 `buildChart`
 * 还要算胎元、命宫、起运、神煞 —— 那些对一个「问事的时刻」毫无意义，
 * 而且**起运必须给性别**。给一个不存在的性别只为凑参数，
 * 正是本项目反复犯过的「冒充别人的位置」：命宫塞进胎元、流月替掉月柱、
 * 胎元挂在外部宫。宁可薄薄地重组一层，也不让一个时刻假装成一个人。
 *
 * 四柱的三条口径与出生盘**完全一致**，因为调的是同一批函数：
 * 年柱以立春为界、月支由节定、时支由真太阳时定、晚子换日依同一个开关。
 */

import { fromJulianDay, type JulianDay } from "../astro/julian.js";
import { toTrueSolarTime } from "../time/trueSolarTime.js";
import { DEFAULT_SOLAR_PROVIDER } from "../astro/defaults.js";
import {
  dayAndHourPillarOf, enclosingTermOf, monthPillarOf, yearPillarOf,
} from "../chart/pillars.js";
import { lunarDateOf, type LunarOptions } from "../chart/lunar.js";
import type { ZiHourRule } from "../chart/types.js";
import type { Branch } from "../types/ganzhi.js";
import type { CastMoment } from "./cast.js";

export interface MomentInput {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
  readonly timeZone: string;
  readonly longitude: number;
}

export interface MomentOptions extends LunarOptions {
  readonly ziHourRule?: ZiHourRule;
  readonly trueSolarTime?: boolean;
  readonly equationOfTime?: boolean;
}

/** 起卦时刻 → 四柱与农历。 */
export function castMomentOf(input: MomentInput, options: MomentOptions = {}): CastMoment {
  const useTst = options.trueSolarTime ?? true;
  const tst = toTrueSolarTime({
    wall: {
      year: input.year, month: input.month, day: input.day,
      hour: input.hour, minute: input.minute, second: input.second ?? 0,
    },
    timeZone: input.timeZone,
    longitude: input.longitude,
    applyLongitude: useTst,
    applyEquationOfTime: useTst && (options.equationOfTime ?? true),
    provider: DEFAULT_SOLAR_PROVIDER,
  });

  const jdUT = tst.jdCivil;
  const jie = enclosingTermOf(jdUT, "节");
  const monthBranch = jie.prev.def.opensMonthBranch;
  if (monthBranch === null) throw new Error(`${jie.prev.def.name} 未定义所开月支`);

  const { pillar: yearPillar } = yearPillarOf(jdUT);
  const monthPillar = monthPillarOf(monthBranch as Branch, yearPillar.stem);
  const dh = dayAndHourPillarOf(fromJulianDay(tst.jdTrueSolar), options.ziHourRule ?? "lateZiNextDay");

  return {
    pillars: { year: yearPillar, month: monthPillar, day: dh.day, hour: dh.hour },
    lunar: lunarDateOf(jdUT as JulianDay,
      options.tzOffsetHours === undefined ? {} : { tzOffsetHours: options.tzOffsetHours }),
    lichunYearBranch: yearPillar.branch,
  };
}

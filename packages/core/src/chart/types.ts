/** L0 排盘的输入与输出类型。 */

import type { Branch, Pillar, Stem } from "../types/ganzhi.js";
import type { CalendarDateTime } from "../astro/julian.js";
import type { OffsetResolution } from "../time/timezone.js";

export type Gender = "male" | "female";

/** 日界规则 —— 23:00–24:00 出生者如何归日。 */
export type ZiHourRule =
  /** 晚子换日：23 时起即算次日日柱，时干由次日日干起遁。 */
  | "lateZiNextDay"
  /** 早子不换：23–24 时仍算当日日柱，时干由当日日干起遁。 */
  | "earlyZiSameDay"
  /** 折衷：日柱仍算当日，但时干按次日日干起遁。 */
  | "split";

/** 命宫取月的边界。 */
export type MingGongBoundary = "jie" | "zhongqi";

export interface ChartOptions {
  readonly ziHourRule?: ZiHourRule;
  readonly mingGongBoundary?: MingGongBoundary;
  readonly trueSolarTime?: boolean;
  readonly equationOfTime?: boolean;
  readonly qiyunMode?: "continuous" | "traditionalDiscrete";
  readonly luckPillarCount?: number;
}

export interface BirthInput {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
  readonly gender: Gender;
  readonly timeZone: string;
  /** 出生地经度，东经为正。 */
  readonly longitude: number;
  readonly latitude?: number;
  /** 时辰未知时置 true —— 时柱缺省，不猜。 */
  readonly unknownHour?: boolean;
}

export interface TimeCorrections {
  readonly tzOffsetMinutes: number;
  readonly isDaylightSaving: boolean;
  readonly longitudeMinutes: number;
  readonly equationOfTimeMinutes: number;
  readonly totalMinutes: number;
  /** 相对民用钟表时的净偏移（分钟）。 */
  readonly netVsCivilMinutes: number;
  readonly resolution: OffsetResolution;
}

export interface SilingInfo {
  readonly stem: Stem;
  readonly segment: 0 | 1 | 2;
  readonly daysIntoJie: number;
  /** 该司令干在月支藏干中的落点；无解时为 null（唯亥月前 7 日如此）。 */
  readonly resolvedTo: Stem | null;
  readonly resolution: "exact" | "sameElement" | "unresolvable";
}

export interface LuckPillar {
  readonly index: number;
  readonly pillar: Pillar;
  /** 交运的绝对时刻（儒略日，UT）。 */
  readonly startJd: number;
  readonly endJd: number;
  readonly startCalendar: CalendarDateTime;
  readonly startAgeYears: number;
}

export interface LuckInfo {
  readonly direction: "forward" | "reverse";
  /** 出生至交节的时长，日。 */
  readonly daysToTerm: number;
  readonly targetTermName: string;
  /** 交运时刻（儒略日，UT）。 */
  readonly startJd: number;
  readonly startCalendar: CalendarDateTime;
  /** 连续换算的起运年龄（含小数）。 */
  readonly startAgeYears: number;
  /** 传统离散口诀的起运虚岁与月数，仅供对照。 */
  readonly traditional: { readonly years: number; readonly months: number; readonly days: number };
  readonly pillars: readonly LuckPillar[];
}

export interface NatalChart {
  readonly input: BirthInput;
  /** 出生的绝对时刻（儒略日，UT）—— 年柱月柱与节气的比较基于它。 */
  readonly birthJdUT: number;
  /** 真太阳时（儒略日）—— 时支与日界的判定基于它。 */
  readonly trueSolarJd: number;
  readonly trueSolarCalendar: CalendarDateTime;
  readonly corrections: TimeCorrections;

  readonly year: Pillar;
  readonly month: Pillar;
  readonly day: Pillar;
  readonly hour: Pillar | null;

  readonly taiyuan: Pillar;
  readonly mingGong: Pillar | null;

  /** 出生所在的节气区间（UT 儒略日）。 */
  readonly enclosingJie: {
    readonly prevName: string; readonly prevJd: number;
    readonly nextName: string; readonly nextJd: number;
  };
  readonly siling: SilingInfo;
  readonly luck: LuckInfo;

  /** 强制字段：任何一张盘都必须能回答「你是用哪套规则算出来的」。 */
  readonly rulesUsed: {
    readonly ziHourRule: ZiHourRule;
    readonly mingGongBoundary: MingGongBoundary;
    readonly trueSolarTime: boolean;
    readonly equationOfTime: boolean;
    readonly qiyunMode: "continuous" | "traditionalDiscrete";
    readonly solarProviderId: string;
    readonly solarProviderMeetsTolerance: boolean;
  };

  /** 需要在报告中显式提示的情况：时刻歧义、时辰未知、司令无解等。 */
  readonly warnings: readonly string[];
}

export type { Branch, Pillar, Stem };

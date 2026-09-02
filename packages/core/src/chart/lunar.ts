/**
 * 农历（夏历）—— 定朔、中气置闰、正月岁首。
 *
 * ## ⚠️ 农历年界与四柱年界不是同一条线
 *
 * 本项目的年柱以**立春**为界（见 `chart/pillars.ts`），而农历年以**正月初一**为界。
 * 两者可差一个多月，且互有先后：2024 年立春在 2 月 4 日，春节在 2 月 10 日；
 * 2025 年立春在 2 月 3 日，春节却在 1 月 29 日 —— 前一年立春在后，后一年立春在前。
 *
 * **同一份报告里出现两种年界时必须各自标名。** 把农历年当年柱年是本领域最常见的错误之一，
 * 而它只在一年中的某几周里表现出来，平时测不出来。
 *
 * ## 规则（现行中国农历，GB/T 33661）
 *
 * 1. 以**东经 120° 标准时**（UTC+8）为准 —— 定日界，也定朔日归属
 * 2. **朔所在的那一日为初一**。月有大小，由相邻两朔日之差定（29 或 30 日）
 * 3. **含冬至之月为十一月**
 * 4. 两个十一月之间若含 13 个月，则置闰：**第一个不含中气的月为闰月**，
 *    月名取其前一月加「闰」
 * 5. 正月为十一月之后的第二个月（闰月不占月名）
 *
 * ## 一处必须如实报出的不确定
 *
 * 朔刻若落在日界前后约 20 秒内（月球级数的精度，见 `astro/moon.ts`），
 * 初一判在哪一天就是不确定的 —— 而那会把整月日序推移一天。
 * {@link LunarDate.boundaryMarginSeconds} 报出这个距离，
 * {@link LunarDate.boundaryUncertain} 在它小于级数精度时置真。
 * 不做的事：假装它不存在。
 *
 * ## 历史口径
 *
 * 1929 年以前，中国历法以**北京地方时**（约 UTC+7:46）推朔，不是 UTC+8。
 * 换用哪个时区会改变少数月份的朔日归属。故时区偏移是参数，
 * 默认 UTC+8，处理 1929 年前的日期时应显式指定。本模块不替调用方猜。
 */

import { asTT, fromJulianDay, toJulianDay, type JulianDay } from "../astro/julian.js";
import {
  approxNewMoon, newMoonIndexNear, solveNewMoon, SYNODIC_MONTH_DAYS,
  LUNAR_STATED_ACCURACY_ARCSEC, MEAN_ELONGATION_RATE_DEG_PER_DAY,
} from "../astro/moon.js";
import { solveSolarTerm, type SolveOptions } from "../astro/solarTerms.js";
import { apparentSolarLongitude, MEAN_SOLAR_MOTION_DEG_PER_DAY as SOLAR_DEG_PER_DAY } from "../astro/sun.js";
import { DEFAULT_SOLAR_PROVIDER } from "../astro/defaults.js";
import { normSigned } from "../astro/angles.js";

/** 现行农历的标准时区偏移，小时。东经 120°。 */
export const CHINA_STANDARD_OFFSET_HOURS = 8;

export interface LunarDate {
  /** 农历年 —— 以正月初一为岁首，与立春年**不同**。 */
  readonly year: number;
  /** 月序 1–12。闰月与其本月同号，由 `isLeap` 区分。 */
  readonly month: number;
  readonly isLeap: boolean;
  readonly day: number;
  /** 该月天数，29（小）或 30（大）。 */
  readonly monthDays: number;
  /** 该月朔的时刻，UT 儒略日。 */
  readonly newMoonJdUT: JulianDay;
  /** 朔刻距其所在日之日界的秒数（取较近的一侧）。 */
  readonly boundaryMarginSeconds: number;
  /** 该距离小于级数精度 —— 初一的归属存疑，整月日序可能差一天。 */
  readonly boundaryUncertain: boolean;
}

/** 以 tz 为准的民用日序号（整数），由 UT 儒略日换算。 */
const civilDayNumber = (jdUT: number, tzHours: number): number =>
  Math.floor(jdUT + 0.5 + tzHours / 24);

/** 该民用日的日界（当地 0 时）对应的 UT 儒略日。 */
const civilDayStart = (dayNumber: number, tzHours: number): number =>
  dayNumber - 0.5 - tzHours / 24;

/**
 * 冬至与定朔的记忆化。
 *
 * 两者都是**整数键的纯函数**（年份、朔序号），且一次查历要用到两个冬至与十六个朔，
 * 而相邻日期用的是同一批。不缓存时实测 3.5 ms 一次查历，缓存后降到微秒级。
 *
 * 键里带 provider id：换了级数就是另一组答案，不能串味。
 */
const wsCache = new Map<string, number>();
const nmCache = new Map<string, number>();
const providerIdOf = (opts: SolveOptions) => (opts.provider ?? DEFAULT_SOLAR_PROVIDER).id;

/** 求某年冬至的时刻（UT 儒略日）。 */
function winterSolsticeUT(gregorianYear: number, opts: SolveOptions): number {
  const key = `${providerIdOf(opts)}:${gregorianYear}`;
  const hit = wsCache.get(key);
  if (hit !== undefined) return hit;
  const guess = toJulianDay({ year: gregorianYear, month: 12, day: 22, hour: 0, minute: 0, second: 0 });
  const v = solveSolarTerm(270, asTT(guess), opts).jdUT as number;
  wsCache.set(key, v);
  return v;
}

/** 第 k 个朔的时刻（UT 儒略日），记忆化。 */
function newMoonUT(k: number, opts: SolveOptions): number {
  const key = `${providerIdOf(opts)}:${k}`;
  const hit = nmCache.get(key);
  if (hit !== undefined) return hit;
  const v = solveNewMoon(approxNewMoon(k), opts.provider ?? DEFAULT_SOLAR_PROVIDER).jdUT as number;
  nmCache.set(key, v);
  return v;
}

interface MonthSlot {
  /** 该月初一的民用日序号。 */
  readonly startDay: number;
  readonly newMoonJdUT: number;
  readonly boundaryMarginSeconds: number;
}

/** 自某个朔起，连续求 count 个朔，返回月首。 */
function monthsFrom(firstK: number, count: number, tzHours: number, opts: SolveOptions): MonthSlot[] {
  const out: MonthSlot[] = [];
  for (let i = 0; i < count; i++) {
    const jdUT = newMoonUT(firstK + i, opts);
    const startDay = civilDayNumber(jdUT, tzHours);
    const margin = Math.min(
      (jdUT - civilDayStart(startDay, tzHours)) * 86400,
      (civilDayStart(startDay + 1, tzHours) - jdUT) * 86400,
    );
    out.push({ startDay, newMoonJdUT: jdUT, boundaryMarginSeconds: margin });
  }
  return out;
}

/**
 * 该月是否含中气 —— 置闰的唯一判据。
 *
 * 朔望月长 29.53 日，中气间隔 30.44 日，故**一个月内至多一个中气**。
 * 于是只需求「月首之后的第一个中气」，看它落不落在月内 —— 一次求根。
 * 初稿逐个试探 12 个黄经 × 3 个初值，一次查历要解四百多次节气，纯属浪费。
 */
function hasZhongqi(slot: MonthSlot, next: MonthSlot, tzHours: number, opts: SolveOptions): boolean {
  const from = civilDayStart(slot.startDay, tzHours);
  const to = civilDayStart(next.startDay, tzHours);
  const lam = apparentSolarLongitude(asTT(from), opts.provider ?? DEFAULT_SOLAR_PROVIDER);
  // 下一个 30° 的整数倍。ceil 前加个极小量，免得月首恰在中气上时反被跳过。
  const nextLon = (Math.ceil(lam / 30 - 1e-9) * 30) % 360;
  const gapDeg = normSigned(nextLon - lam) < 0 ? normSigned(nextLon - lam) + 360 : normSigned(nextLon - lam);
  const guess = from + gapDeg / SOLAR_DEG_PER_DAY;
  return (solveSolarTerm(nextLon, asTT(guess), opts).jdUT as number) < to;
}

const uncertaintySeconds =
  ((LUNAR_STATED_ACCURACY_ARCSEC / 3600) / MEAN_ELONGATION_RATE_DEG_PER_DAY) * 86400;

export interface LunarOptions extends SolveOptions {
  /** 定朔与日界所用的时区偏移，小时。默认东八区。1929 年前应显式给北京地方时。 */
  readonly tzOffsetHours?: number;
}

/**
 * 公历时刻 → 农历日期。
 *
 * 输入取 UT 儒略日，与 `chart` 层其余部分一致。
 */
export function lunarDateOf(jdUT: JulianDay, options: LunarOptions = {}): LunarDate {
  const tz = options.tzOffsetHours ?? CHINA_STANDARD_OFFSET_HOURS;
  const target = civilDayNumber(jdUT as number, tz);
  const cal = fromJulianDay(jdUT as number);

  // 找到包住 target 的那一对冬至。农历年的骨架是「冬至月 → 下一个冬至月」。
  let ws0 = winterSolsticeUT(cal.year - 1, options);
  let ws1 = winterSolsticeUT(cal.year, options);
  // target 若在本年冬至之后，骨架应向后挪一格
  if (target >= civilDayNumber(ws1, tz)) {
    ws0 = ws1;
    ws1 = winterSolsticeUT(cal.year + 1, options);
  }

  // 含 ws0 的那个月即十一月。自它起连排 14 个月，足以覆盖到下一个十一月。
  const k0 = newMoonIndexNear(ws0 - SYNODIC_MONTH_DAYS / 2);
  let slots = monthsFrom(k0 - 1, 16, tz, options);
  // 十一月 = 含冬至之月：最后一个「月首 ≤ 冬至日」的月
  const ws0Day = civilDayNumber(ws0, tz);
  let i11 = -1;
  for (let i = 0; i < slots.length - 1; i++) {
    if (slots[i]!.startDay <= ws0Day && ws0Day < slots[i + 1]!.startDay) { i11 = i; break; }
  }
  if (i11 < 0) throw new RangeError(`定不出十一月：冬至 ${ws0}`);
  slots = slots.slice(i11);

  // 下一个十一月的下标 —— 含 ws1 的月
  const ws1Day = civilDayNumber(ws1, tz);
  let nextI11 = -1;
  for (let i = 1; i < slots.length - 1; i++) {
    if (slots[i]!.startDay <= ws1Day && ws1Day < slots[i + 1]!.startDay) { nextI11 = i; break; }
  }
  if (nextI11 < 0) throw new RangeError(`定不出下一个十一月：冬至 ${ws1}`);

  // 置闰：两个十一月之间含 13 个月则闰，取第一个无中气者
  const spanMonths = nextI11;
  let leapIndex = -1;
  if (spanMonths === 13) {
    for (let i = 1; i < nextI11; i++) {
      if (!hasZhongqi(slots[i]!, slots[i + 1]!, tz, options)) { leapIndex = i; break; }
    }
    // 理论上必有一个无中气之月；若求不出，宁可抛错也不静默取第一个
    if (leapIndex < 0) throw new Error("十三个月却找不出无中气之月 —— 中气判定有误");
  }

  // 编月名：十一月起，闰月不占号
  const names: { month: number; isLeap: boolean }[] = [];
  let m = 11;
  for (let i = 0; i <= nextI11; i++) {
    if (i === leapIndex) {
      names.push({ month: names[i - 1]!.month, isLeap: true });
    } else {
      names.push({ month: m, isLeap: false });
      m = m === 12 ? 1 : m + 1;
    }
  }

  // 定位 target 落在哪一个月
  let idx = -1;
  for (let i = 0; i < slots.length - 1; i++) {
    if (slots[i]!.startDay <= target && target < slots[i + 1]!.startDay) { idx = i; break; }
  }
  if (idx < 0 || idx >= names.length) throw new RangeError(`时刻 ${jdUT} 落在可定月的范围之外`);

  const slot = slots[idx]!;
  const name = names[idx]!;
  const monthDays = slots[idx + 1]!.startDay - slot.startDay;

  // 农历年：以正月初一为岁首。十一月、十二月属上一个农历年。
  // ws0 所在的公历年记作 Y，则该骨架的正月落在 Y+1。
  const ws0Cal = fromJulianDay(ws0);
  const lunarYear = name.month >= 11 && !(name.month === 11 && name.isLeap)
    ? ws0Cal.year
    : ws0Cal.year + 1;

  return {
    year: lunarYear,
    month: name.month,
    isLeap: name.isLeap,
    day: target - slot.startDay + 1,
    monthDays,
    newMoonJdUT: slot.newMoonJdUT as JulianDay,
    boundaryMarginSeconds: slot.boundaryMarginSeconds,
    boundaryUncertain: slot.boundaryMarginSeconds < uncertaintySeconds,
  };
}

/** 该农历年的正月初一（春节）—— 公历日期。 */
export function springFestivalOf(lunarYear: number, options: LunarOptions = {}): JulianDay {
  const tz = options.tzOffsetHours ?? CHINA_STANDARD_OFFSET_HOURS;
  // 春节必在公历 1 月 21 日至 2 月 21 日之间，逐日试探即可
  for (let d = 21; d <= 52; d++) {
    const month = d <= 31 ? 1 : 2;
    const day = d <= 31 ? d : d - 31;
    const jd = toJulianDay({ year: lunarYear, month, day, hour: 12, minute: 0, second: 0 });
    const L = lunarDateOf(jd as JulianDay, options);
    if (L.year === lunarYear && L.month === 1 && !L.isLeap && L.day === 1) {
      return civilDayStart(civilDayNumber(jd, tz), tz) as JulianDay;
    }
  }
  throw new RangeError(`求不出 ${lunarYear} 年的正月初一`);
}

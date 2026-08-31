/**
 * 时区换算 —— 民用钟表时 ⇄ UTC。
 *
 * 使用平台内建的 Intl + IANA tzdata，不引入依赖：
 * tzdata 含完整历史规则（中国 1986–1991 夏令时、1940–41 与 1945–48 的夏令时等），
 * 而任何手写的时区表都会在几年内过期。
 *
 * **本模块显式处理 DST 造成的两种病态时刻**，不静默取一：
 *   · 重叠（秋季回拨）—— 同一钟表时对应两个 UTC 瞬间，出生时刻**真的**有歧义
 *   · 空缺（春季前拨）—— 该钟表时不存在
 * 四柱推算依赖到分钟的精确时刻，把歧义悄悄抹平会产出一个看似确定、
 * 实则可能错一小时的时柱。宁可上报，让报告如实写明。
 */

import type { CalendarDateTime } from "../astro/julian.js";

export type OffsetResolution = "unique" | "ambiguous" | "nonexistent";

export interface WallTimeConversion {
  /** UTC 毫秒时间戳。歧义时取较早的那个（标准时优先）。 */
  readonly utcMillis: number;
  /** 该瞬间的时区偏移，分钟，东为正。 */
  readonly offsetMinutes: number;
  readonly resolution: OffsetResolution;
  /** 歧义时的另一个候选；否则为 null。 */
  readonly alternativeUtcMillis: number | null;
  readonly alternativeOffsetMinutes: number | null;
  /** 是否处于夏令时。由偏移与该年 1 月的偏移比较得出。 */
  readonly isDaylightSaving: boolean;
}

/** 某 UTC 瞬间在指定时区的偏移（分钟，东为正）。 */
export function offsetMinutesAt(utcMillis: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMillis));
  const pick = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    if (p === undefined) throw new Error(`时区 ${timeZone} 的格式化缺少 ${type} 字段`);
    return Number(p.value);
  };
  const localAsUtc = Date.UTC(
    pick("year"), pick("month") - 1, pick("day"),
    pick("hour"), pick("minute"), pick("second"),
  );
  // 抹去毫秒后再比较：formatToParts 无毫秒字段
  return Math.round((localAsUtc - Math.floor(utcMillis / 1000) * 1000) / 60000);
}

function wallAsUtcMillis(w: CalendarDateTime): number {
  return Date.UTC(
    w.year, w.month - 1, w.day,
    w.hour, w.minute, Math.floor(w.second),
    Math.round((w.second % 1) * 1000),
  );
}

/**
 * 民用钟表时 → UTC。
 *
 * **不能用定点迭代**。以钟表时当 UTC 试探、回代取偏移的做法，
 * 在秋季回拨的重叠小时里两个候选会收敛到同一个，于是永远报「唯一」——
 * 恰好在最需要报告歧义的地方失灵。
 *
 * 正确做法是从转换点**两侧**各取一个偏移（前后各 24 小时），
 * 由此生成至多两个候选，再逐个回验：
 *   两个都成立 → 重叠（该钟表时出现两次）
 *   一个成立   → 唯一
 *   都不成立   → 空缺（该钟表时不存在）
 */
export function wallTimeToUtc(wall: CalendarDateTime, timeZone: string): WallTimeConversion {
  const naive = wallAsUtcMillis(wall);
  const DAY = 86400000;

  const offBefore = offsetMinutesAt(naive - DAY, timeZone);
  const offAfter = offsetMinutesAt(naive + DAY, timeZone);
  const off1 = offBefore;

  const roundTrips = (utc: number): boolean =>
    offsetMinutesAt(utc, timeZone) * 60000 + utc === naive;

  const valid: { utc: number; off: number }[] = [];
  for (const off of new Set([offBefore, offAfter])) {
    const c = naive - off * 60000;
    if (roundTrips(c) && !valid.some((v) => v.utc === c)) {
      valid.push({ utc: c, off: offsetMinutesAt(c, timeZone) });
    }
  }

  const cand1 = naive - off1 * 60000;

  const januaryOffset = offsetMinutesAt(Date.UTC(wall.year, 0, 15), timeZone);
  const julyOffset = offsetMinutesAt(Date.UTC(wall.year, 6, 15), timeZone);
  const standardOffset = Math.min(januaryOffset, julyOffset);

  if (valid.length === 1) {
    const v = valid[0]!;
    return {
      utcMillis: v.utc, offsetMinutes: v.off, resolution: "unique",
      alternativeUtcMillis: null, alternativeOffsetMinutes: null,
      isDaylightSaving: v.off > standardOffset,
    };
  }

  if (valid.length === 2) {
    // 重叠：取偏移较大者（即夏令时那一侧）为较早的 UTC 瞬间
    const sorted = [...valid].sort((a, b) => a.utc - b.utc);
    const first = sorted[0]!;
    const second = sorted[1]!;
    return {
      utcMillis: first.utc, offsetMinutes: first.off, resolution: "ambiguous",
      alternativeUtcMillis: second.utc, alternativeOffsetMinutes: second.off,
      isDaylightSaving: first.off > standardOffset,
    };
  }

  // 空缺：该钟表时不存在（春季前拨跳过的那一小时）
  return {
    utcMillis: cand1, offsetMinutes: off1, resolution: "nonexistent",
    alternativeUtcMillis: null, alternativeOffsetMinutes: null,
    isDaylightSaving: off1 > standardOffset,
  };
}

/** UTC 毫秒 → 儒略日（UT 标度）。 */
export function millisToJulianDay(utcMillis: number): number {
  return utcMillis / 86400000 + 2440587.5;
}

/** 儒略日（UT 标度）→ UTC 毫秒。 */
export function julianDayToMillis(jd: number): number {
  return (jd - 2440587.5) * 86400000;
}

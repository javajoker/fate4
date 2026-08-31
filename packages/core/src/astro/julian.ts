/**
 * 儒略日与历法换算（Meeus《Astronomical Algorithms》第 7 章）。
 *
 * 本层不使用 JS 的 Date —— Date 把时区语义焊进了类型里，
 * 而本引擎需要同时操纵三种时间标度（UT、TT、真太阳时），混用必然出错。
 * 一律以儒略日（浮点天数）为规范表示。
 */

/** 儒略日，世界时（UT1 ≈ UTC）标度。 */
export type JulianDay = number & { readonly __scale: "UT" };

/** 儒略日，地球时（TT）标度。天文级数一律以 TT 为自变量。 */
export type JulianDayTT = number & { readonly __scale: "TT" };

/**
 * 两种标度用品牌类型区分，互相不可赋值。
 * 「把 TT 当 UT 用」是这类代码最隐蔽的 bug —— 差约 70 秒，
 * 恰好落在肉眼看不出、却足以让节气时刻越过分钟边界的量级。
 */
export const asUT = (n: number): JulianDay => n as JulianDay;
export const asTT = (n: number): JulianDayTT => n as JulianDayTT;

/** J2000.0 历元的儒略日。 */
export const J2000 = 2451545.0;

/** 儒略世纪数，自 J2000 起算。 */
export function julianCentury(jdTT: JulianDayTT): number {
  return (jdTT - J2000) / 36525;
}

/** 儒略千年数，自 J2000 起算（VSOP87 的自变量）。 */
export function julianMillennium(jdTT: JulianDayTT): number {
  return (jdTT - J2000) / 365250;
}

export interface CalendarDateTime {
  readonly year: number;
  readonly month: number;   // 1–12
  readonly day: number;     // 1–31
  readonly hour: number;    // 0–23
  readonly minute: number;  // 0–59
  readonly second: number;  // 0–59.999…
}

/**
 * 格里高利历 → 儒略日。
 *
 * 仅支持格里高利历（1582-10-15 起）。本引擎的时间跨度为 1900–2100，
 * 不涉及儒略历，故不实现历法切换 —— 与其留一条从未被测试的分支，
 * 不如在越界时明确抛错。
 */
export function toJulianDay(d: CalendarDateTime): number {
  let y = d.year;
  let m = d.month;
  if (m <= 2) { y -= 1; m += 12; }

  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const dayFraction = d.day + (d.hour + (d.minute + d.second / 60) / 60) / 24;

  const jd = Math.floor(365.25 * (y + 4716))
    + Math.floor(30.6001 * (m + 1))
    + dayFraction + B - 1524.5;

  if (jd < 2299160.5) {
    throw new RangeError(
      `${d.year}-${d.month}-${d.day} 早于格里高利历行用（1582-10-15），本引擎不支持儒略历`,
    );
  }
  return jd;
}

/**
 * 儒略日 → 格里高利历。toJulianDay 的逆运算。
 *
 * **日内时刻先舍入到毫秒再逐级拆分。**否则 14:30 会被重构成 14:29:59.9999：
 * 双精度在 JD ≈ 2.45e6 量级上只剩约 1e-10 日（约 10 微秒）的分辨率，
 * 而 hour → minute → second 的逐级 Math.floor 会把这点亏损放大成整整一分钟。
 * 月柱定支要拿出生时刻与节气时刻比对，差一分钟就可能跨月支。
 */
export function fromJulianDay(jd: number): CalendarDateTime {
  const shifted = jd + 0.5;
  let Z = Math.floor(shifted);
  const F = shifted - Z;

  let secondsOfDay = Math.round(F * 86400 * 1000) / 1000;
  if (secondsOfDay >= 86400) { secondsOfDay -= 86400; Z += 1; }

  const alpha = Math.floor((Z - 1867216.25) / 36524.25);
  const A = Z + 1 + alpha - Math.floor(alpha / 4);
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  const hour = Math.floor(secondsOfDay / 3600);
  const minute = Math.floor((secondsOfDay - hour * 3600) / 60);
  const second = secondsOfDay - hour * 3600 - minute * 60;

  return { year, month, day, hour, minute, second };
}

/**
 * 儒略日数（JDN）—— 当地日界的整数日序，日柱推算用。
 *
 * 注意与 toJulianDay 的区别：JD 的原点在**正午**，而日柱要按**日界**分日，
 * 故此处对当地民用日期取整数，不涉及时刻。
 */
export function julianDayNumber(year: number, month: number, day: number): number {
  return Math.floor(toJulianDay({ year, month, day, hour: 12, minute: 0, second: 0 }));
}

/** 星期（0 = 周日）。 */
export function dayOfWeek(jd: number): number {
  return Math.floor(jd + 1.5) % 7;
}

/** 格式化为 ISO 8601（不带时区标记，标度由调用方声明）。 */
export function formatCalendar(d: CalendarDateTime): string {
  const p = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");
  return `${p(d.year, 4)}-${p(d.month)}-${p(d.day)}T${p(d.hour)}:${p(d.minute)}:${p(d.second)}`;
}

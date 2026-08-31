import { describe, expect, it } from "vitest";
import {
  J2000, dayOfWeek, fromJulianDay, julianCentury, julianDayNumber,
  toJulianDay, asTT,
} from "../src/astro/julian.js";

describe("儒略日", () => {
  it("J2000.0 定义点：2000-01-01 12:00 = JD 2451545.0", () => {
    expect(toJulianDay({ year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 }))
      .toBeCloseTo(J2000, 9);
    expect(julianCentury(asTT(J2000))).toBe(0);
  });

  it("1900-01-01 00:00 = JD 2415020.5", () => {
    expect(toJulianDay({ year: 1900, month: 1, day: 1, hour: 0, minute: 0, second: 0 }))
      .toBeCloseTo(2415020.5, 9);
  });

  it("1970-01-01 00:00 = JD 2440587.5（Unix 纪元）", () => {
    expect(toJulianDay({ year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 }))
      .toBeCloseTo(2440587.5, 9);
  });

  it("往返无损", () => {
    const samples = [
      { year: 1900, month: 1, day: 1, hour: 0, minute: 0, second: 0 },
      { year: 1949, month: 10, day: 1, hour: 15, minute: 0, second: 0 },
      { year: 1990, month: 5, day: 12, hour: 14, minute: 30, second: 0 },
      { year: 2000, month: 2, day: 29, hour: 23, minute: 59, second: 59 },
      { year: 2100, month: 12, day: 31, hour: 6, minute: 45, second: 30 },
    ];
    for (const s of samples) {
      const back = fromJulianDay(toJulianDay(s));
      expect(back.year, JSON.stringify(s)).toBe(s.year);
      expect(back.month).toBe(s.month);
      expect(back.day).toBe(s.day);
      expect(back.hour).toBe(s.hour);
      expect(back.minute).toBe(s.minute);
      expect(back.second).toBeCloseTo(s.second, 4);
    }
  });

  it("闰年规则：2000 是闰年，1900 与 2100 不是", () => {
    const feb29 = (y: number) => toJulianDay({ year: y, month: 3, day: 1, hour: 0, minute: 0, second: 0 })
      - toJulianDay({ year: y, month: 2, day: 1, hour: 0, minute: 0, second: 0 });
    expect(feb29(2000)).toBe(29);
    expect(feb29(1900)).toBe(28);
    expect(feb29(2100)).toBe(28);
    expect(feb29(2024)).toBe(29);
  });

  it("星期：2000-01-01 是周六", () => {
    expect(dayOfWeek(toJulianDay({ year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 })))
      .toBe(6);
  });

  it("早于格里高利历行用则抛错", () => {
    expect(() => toJulianDay({ year: 1500, month: 1, day: 1, hour: 0, minute: 0, second: 0 }))
      .toThrow(/格里高利历/);
  });
});

describe("JDN 与 P0 日柱锚点吻合", () => {
  it("1949-10-01 甲子日、2000-01-01 戊午日，相距 18354 日", () => {
    const a = julianDayNumber(1949, 10, 1);
    const b = julianDayNumber(2000, 1, 1);
    expect(b - a).toBe(18354);
    // (jdn + 49) mod 60 应给出 0 = 甲子
    expect((a + 49) % 60).toBe(0);
    expect((b + 49) % 60).toBe(54); // 54 → 干 4 戊、支 6 午
    expect(54 % 10).toBe(4);
    expect(54 % 12).toBe(6);
  });

  it("工作例 1990-05-12 为丁丑日（序号 13）", () => {
    expect((julianDayNumber(1990, 5, 12) + 49) % 60).toBe(13);
    expect(13 % 10).toBe(3);  // 丁
    expect(13 % 12).toBe(1);  // 丑
  });
});

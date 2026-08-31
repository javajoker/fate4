import { describe, expect, it } from "vitest";
import { toTrueSolarTime, wall } from "../src/time/trueSolarTime.js";
import { equationOfTimeMinutes, EOT_RANGE_MINUTES } from "../src/astro/equationOfTime.js";
import { asTT, fromJulianDay, toJulianDay } from "../src/astro/julian.js";

describe("均时差", () => {
  it("全年不出 ±16.5 分钟", () => {
    for (let d = 0; d < 365; d += 3) {
      const jd = toJulianDay({ year: 2026, month: 1, day: 1, hour: 12, minute: 0, second: 0 }) + d;
      const e = equationOfTimeMinutes(asTT(jd));
      expect(e, `第 ${d} 日`).toBeGreaterThan(EOT_RANGE_MINUTES.min);
      expect(e).toBeLessThan(EOT_RANGE_MINUTES.max);
    }
  });

  it("二月中旬取到最小值约 −14 分钟，十一月初取到最大值约 +16 分钟", () => {
    const at = (m: number, d: number) =>
      equationOfTimeMinutes(asTT(toJulianDay({ year: 2026, month: m, day: d, hour: 12, minute: 0, second: 0 })));
    expect(at(2, 11)).toBeLessThan(-13.5);
    expect(at(2, 11)).toBeGreaterThan(-15);
    expect(at(11, 3)).toBeGreaterThan(15.5);
    expect(at(11, 3)).toBeLessThan(17);
  });

  it("一年内四次过零：约在 4 月中、6 月中、9 月初、12 月下旬", () => {
    const at = (m: number, d: number) =>
      equationOfTimeMinutes(asTT(toJulianDay({ year: 2026, month: m, day: d, hour: 12, minute: 0, second: 0 })));
    for (const [m, d] of [[4, 15], [6, 13], [9, 1], [12, 25]] as const) {
      expect(Math.abs(at(m, d)), `${m}/${d} 应接近零点`).toBeLessThan(1.2);
    }
  });
});

describe("真太阳时校正", () => {
  it("工作例：1990-05-12 14:30 上海 → 真太阳时 13:40，仍在未时内", () => {
    // 三项校正叠加，相对钟表净 −50.4 分钟：
    //   夏令时 −60.0（1990 年 4/15–9/16 行用，此日在内）
    //   经度   +5.88（121.47° 较中央经线 120° 偏东 1.47°）
    //   均时差 +3.67
    // 时支仍落未时（13–15），故工作例的时柱丁未不变 ——
    // 但若漏掉夏令时那一小时，14:40 也在未时内，会「碰巧蒙对」而掩盖 bug。
    const r = toTrueSolarTime({
      wall: wall(1990, 5, 12, 14, 30),
      timeZone: "Asia/Shanghai",
      longitude: 121.47,
    });
    const t = fromJulianDay(r.jdTrueSolar);
    expect(r.corrections.tzOffsetMinutes).toBe(540);
    expect(r.corrections.isDaylightSaving).toBe(true);
    expect(t.hour).toBe(13);
    expect(t.minute).toBeGreaterThanOrEqual(37);
    expect(t.minute).toBeLessThanOrEqual(42);
    expect(r.corrections.totalMinutes - r.corrections.tzOffsetMinutes)
      .toBeCloseTo(-50.4, 0);
    // 未时为 13–15 时
    expect(t.hour).toBeGreaterThanOrEqual(13);
    expect(t.hour).toBeLessThan(15);
  });

  it("上海相对东八区中央经线的经度增益约 +6 分钟", () => {
    // 121.47° − 120° = 1.47°，×4 分钟 = 5.88 分钟
    const r = toTrueSolarTime({
      wall: wall(1990, 5, 12, 14, 30), timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    expect(r.corrections.longitudeMinutes - 480).toBeCloseTo(5.88, 1);
  });

  it("乌鲁木齐用北京时间出生，真太阳时要退回约两小时 —— 足以跨一个时辰", () => {
    // 行政上记录的是北京时间，但当地经度 87.6°，与 120° 差 32.4° → 129.6 分钟。
    const r = toTrueSolarTime({
      wall: wall(1990, 5, 12, 14, 30), timeZone: "Asia/Shanghai", longitude: 87.6,
    });
    const t = fromJulianDay(r.jdTrueSolar);
    expect(r.corrections.longitudeMinutes - 480).toBeCloseTo(-129.6, 1);
    // 同日上海为未时 13:39，乌鲁木齐真太阳时 11:24 —— 相差近两个时辰。
    // 二人钟表读数相同、行政时区相同，时柱却不同支。
    expect(t.hour).toBe(11);
    expect(t.minute).toBeGreaterThanOrEqual(20);
    expect(t.minute).toBeLessThanOrEqual(28);
    // 午时为 11–13 时
    expect(t.hour).toBeGreaterThanOrEqual(11);
    expect(t.hour).toBeLessThan(13);
  });

  it("夏令时期间出生：偏移与标记均正确传出", () => {
    const r = toTrueSolarTime({
      wall: wall(1988, 7, 15, 14, 30), timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    expect(r.corrections.tzOffsetMinutes).toBe(540);
    expect(r.corrections.isDaylightSaving).toBe(true);
    // 夏令时的一小时若不扣除，时柱会整体后移一个时辰
    const t = fromJulianDay(r.jdTrueSolar);
    expect(t.hour).toBe(13);
    expect(t.hour).toBeLessThan(15);
  });

  it("可分别关闭经度校正与均时差，供与旧式排盘工具对照", () => {
    const base = { wall: wall(1990, 5, 12, 14, 30), timeZone: "Asia/Shanghai", longitude: 121.47 };
    const off = toTrueSolarTime({ ...base, applyLongitude: false, applyEquationOfTime: false });
    expect(off.corrections.totalMinutes).toBe(0);
    expect(off.jdTrueSolar).toBe(off.jdCivil);
  });

  it("歧义时刻把两个候选都带出来", () => {
    const r = toTrueSolarTime({
      wall: wall(2021, 11, 7, 1, 30), timeZone: "America/New_York", longitude: -74.0,
    });
    expect(r.resolution).toBe("ambiguous");
    expect(r.alternativeJd).not.toBeNull();
    expect(Math.abs(r.alternativeJd! - r.jdTrueSolar)).toBeCloseTo(1 / 24, 6);
  });
});

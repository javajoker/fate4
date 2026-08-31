import { describe, expect, it } from "vitest";
import { offsetMinutesAt, wallTimeToUtc } from "../src/time/timezone.js";

const wall = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  ({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 });

describe("平台 tzdata 的历史规则", () => {
  it("中国现行东八区，全年无夏令时", () => {
    expect(offsetMinutesAt(Date.UTC(2026, 0, 15), "Asia/Shanghai")).toBe(480);
    expect(offsetMinutesAt(Date.UTC(2026, 6, 15), "Asia/Shanghai")).toBe(480);
  });

  it("中国 1986–1991 行用夏令时 —— 这几年的夏季出生者必须 +1 小时", () => {
    // 1986 年 5 月 4 日至 9 月 14 日、其后各年 4 月中至 9 月中行用。
    // 这是本引擎最容易被忽略、又最能整体错开一个时辰的历史规则。
    expect(offsetMinutesAt(Date.UTC(1986, 6, 15), "Asia/Shanghai"), "1986 年 7 月").toBe(540);
    expect(offsetMinutesAt(Date.UTC(1988, 6, 15), "Asia/Shanghai"), "1988 年 7 月").toBe(540);
    expect(offsetMinutesAt(Date.UTC(1991, 6, 15), "Asia/Shanghai"), "1991 年 7 月").toBe(540);
  });

  it("同期的冬季仍是东八区", () => {
    expect(offsetMinutesAt(Date.UTC(1986, 0, 15), "Asia/Shanghai")).toBe(480);
    expect(offsetMinutesAt(Date.UTC(1988, 11, 15), "Asia/Shanghai")).toBe(480);
  });

  it("1992 年起夏令时废止", () => {
    expect(offsetMinutesAt(Date.UTC(1992, 6, 15), "Asia/Shanghai")).toBe(480);
    expect(offsetMinutesAt(Date.UTC(1995, 6, 15), "Asia/Shanghai")).toBe(480);
  });

  it("乌鲁木齐行政上用东八区（Asia/Shanghai），故须靠经度校正补偿", () => {
    // 新疆全境行用北京时间，而乌鲁木齐在东经 87.6°，
    // 与东八区中央经线 120° 相差 32.4°，折合 130 分钟 —— 超过一个时辰。
    expect(offsetMinutesAt(Date.UTC(2026, 6, 15), "Asia/Urumqi")).toBe(360);
    expect(offsetMinutesAt(Date.UTC(2026, 6, 15), "Asia/Shanghai")).toBe(480);
  });
});

describe("钟表时 → UTC 的三种归结", () => {
  it("常规时刻唯一", () => {
    const r = wallTimeToUtc(wall(1995, 5, 12, 14, 30), "Asia/Shanghai");
    expect(r.resolution).toBe("unique");
    expect(r.offsetMinutes).toBe(480);
    expect(r.isDaylightSaving).toBe(false);
    expect(r.utcMillis).toBe(Date.UTC(1995, 4, 12, 6, 30));
  });

  it("工作例 1990-05-12 恰在夏令时期内 —— 偏移是 +9 而非 +8", () => {
    // 1990 年中国夏令时为 4/15–9/16，5 月 12 日在内。
    // 这正是本引擎坚持接入历史 tzdata 的理由：凭「中国是东八区」的常识
    // 手算，会把这一天的 UTC 算错整整一小时。
    const r = wallTimeToUtc(wall(1990, 5, 12, 14, 30), "Asia/Shanghai");
    expect(r.offsetMinutes).toBe(540);
    expect(r.isDaylightSaving).toBe(true);
    expect(r.utcMillis).toBe(Date.UTC(1990, 4, 12, 5, 30));
  });

  it("中国夏令时期间出生：偏移为 +9 小时且标记为夏令时", () => {
    const r = wallTimeToUtc(wall(1988, 7, 15, 14, 30), "Asia/Shanghai");
    expect(r.offsetMinutes).toBe(540);
    expect(r.isDaylightSaving).toBe(true);
    expect(r.utcMillis).toBe(Date.UTC(1988, 6, 15, 5, 30));
  });

  it("秋季回拨的重叠小时：如实报告歧义，不静默取一", () => {
    // 2021-11-07 01:30 在纽约出现两次（EDT 与 EST 各一次）。
    // 出生时刻落在此处是**真的**有歧义，抹平它会产出一个可能错一小时的时柱。
    const r = wallTimeToUtc(wall(2021, 11, 7, 1, 30), "America/New_York");
    expect(r.resolution).toBe("ambiguous");
    expect(r.alternativeUtcMillis).not.toBeNull();
    expect(Math.abs(r.alternativeUtcMillis! - r.utcMillis)).toBe(3600000);
    expect(r.offsetMinutes).toBe(-240);            // EDT，较早的那次
    expect(r.alternativeOffsetMinutes).toBe(-300); // EST，较晚的那次
  });

  it("春季前拨的空缺小时：标记为不存在", () => {
    // 2021-03-14 02:30 在纽约根本不存在 —— 时钟自 02:00 直接跳到 03:00。
    const r = wallTimeToUtc(wall(2021, 3, 14, 2, 30), "America/New_York");
    expect(r.resolution).toBe("nonexistent");
    expect(r.alternativeUtcMillis).toBeNull();
  });

  it("往返一致：唯一解回代必得原钟表时", () => {
    const cases = [
      [wall(1900, 1, 1, 0, 0), "Asia/Shanghai"],
      [wall(1990, 5, 12, 14, 30), "Asia/Shanghai"],
      [wall(1988, 7, 15, 3, 0), "Asia/Shanghai"],
      [wall(2026, 12, 31, 23, 59), "Asia/Tokyo"],
    ] as const;
    for (const [w, tz] of cases) {
      const r = wallTimeToUtc(w, tz);
      if (r.resolution !== "unique") continue;
      const back = new Date(r.utcMillis + r.offsetMinutes * 60000);
      expect(back.getUTCFullYear(), tz).toBe(w.year);
      expect(back.getUTCMonth() + 1).toBe(w.month);
      expect(back.getUTCDate()).toBe(w.day);
      expect(back.getUTCHours()).toBe(w.hour);
      expect(back.getUTCMinutes()).toBe(w.minute);
    }
  });
});

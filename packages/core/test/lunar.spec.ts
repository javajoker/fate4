import { describe, expect, it } from "vitest";
import { lunarPosition, solveNewMoon, approxNewMoon, newMoonIndexNear } from "../src/astro/moon.js";
import { lunarDateOf, springFestivalOf, CHINA_STANDARD_OFFSET_HOURS } from "../src/chart/lunar.js";
import { asTT, toJulianDay, fromJulianDay, type JulianDay } from "../src/astro/julian.js";
import { buildChart } from "../src/chart/buildChart.js";

const at = (y: number, m: number, d: number, h = 12) =>
  toJulianDay({ year: y, month: m, day: d, hour: h, minute: 0, second: 0 }) as JulianDay;
const ymd = (jd: number) => {
  const c = fromJulianDay(jd + 0.5);
  return `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
};

// ═══════════════════════════════════════════════════════════

describe("月球级数 —— 对 Meeus 的工作例", () => {
  it("例 47.a：1992-04-12 0h TD 的视黄经与地月距离", () => {
    const p = lunarPosition(asTT(2448724.5));
    // 书上 133.167265°，1e-4° = 0.36″，远严于级数自称的 10″
    expect(Math.abs(p.apparentLongitude - 133.167265)).toBeLessThan(1e-4);
    expect(Math.abs(p.distanceKm - 368409.7)).toBeLessThan(0.5);
  });

  it("例 49.a：1977-02-18 的朔，与书上差不到 10 秒", () => {
    const k = newMoonIndexNear(at(1977, 2, 18) as number);
    const nm = solveNewMoon(approxNewMoon(k));
    expect(Math.abs((nm.jdTT as number) - 2443192.65118) * 86400).toBeLessThan(10);
    expect(nm.iterations).toBeLessThan(10);
  });

  it("**级数的精度是如实报出的，不是四舍五入掉的**", () => {
    const nm = solveNewMoon(approxNewMoon(0));
    // 10″ / 12.19°每日 ≈ 20 秒
    expect(nm.estimatedUncertaintySeconds).toBeGreaterThan(15);
    expect(nm.estimatedUncertaintySeconds).toBeLessThan(25);
  });

  it("朔间隔恒在朔望月长附近波动，不会跑飞", () => {
    let prev = solveNewMoon(approxNewMoon(-200)).jdUT as number;
    for (let k = -199; k < 200; k++) {
      const cur = solveNewMoon(approxNewMoon(k)).jdUT as number;
      const gap = cur - prev;
      // 真实朔望月在 29.27–29.83 日之间摆动
      expect(gap, `k=${k} 的朔间隔 ${gap} 日`).toBeGreaterThan(29.2);
      expect(gap).toBeLessThan(29.9);
      prev = cur;
    }
  });
});

describe("农历 —— 对已知历表", () => {
  const SPRING_FESTIVAL: readonly (readonly [number, string])[] = [
    [1980, "1980-02-16"], [1990, "1990-01-27"], [2000, "2000-02-05"],
    [2010, "2010-02-14"], [2020, "2020-01-25"], [2021, "2021-02-12"],
    [2022, "2022-02-01"], [2023, "2023-01-22"], [2024, "2024-02-10"],
    [2025, "2025-01-29"], [2026, "2026-02-17"],
  ];

  it("十一个春节逐日对上", () => {
    for (const [y, want] of SPRING_FESTIVAL) {
      expect(ymd(springFestivalOf(y) as number), `${y} 年春节`).toBe(want);
    }
  });

  it("十个闰月年的闰月月序对上", () => {
    const LEAP: readonly (readonly [number, number])[] = [
      [2001, 4], [2004, 2], [2006, 7], [2009, 5], [2012, 4],
      [2014, 9], [2017, 6], [2020, 4], [2023, 2], [2025, 6],
    ];
    for (const [y, wantMonth] of LEAP) {
      const leaps = new Set<number>();
      for (let mo = 1; mo <= 12; mo++) {
        for (const d of [5, 20]) {
          const L = lunarDateOf(at(y, mo, d));
          if (L.isLeap && L.year === y) leaps.add(L.month);
        }
      }
      expect([...leaps], `${y} 年的闰月`).toEqual([wantMonth]);
    }
  });

  it("**反向对照：无闰之年一个闰月都不出** —— 没有它，「恒判为闰」也能全绿", () => {
    // 这十年在现行历表中均无闰月
    for (const y of [2002, 2003, 2005, 2007, 2008, 2010, 2011, 2013, 2015, 2016]) {
      for (let mo = 1; mo <= 12; mo++) {
        const L = lunarDateOf(at(y, mo, 15));
        expect(L.isLeap, `${y}-${mo} 误判为闰月 ${L.month}`).toBe(false);
      }
    }
  });
});

describe("结构不变量", () => {
  it("月只有大小两种，日序自 1 连续到月末", () => {
    let prev = lunarDateOf(at(2023, 1, 1));
    let day = prev.day;
    for (let i = 1; i < 800; i++) {
      const jd = (at(2023, 1, 1) as number) + i;
      const L = lunarDateOf(jd as JulianDay);
      expect([29, 30], `${ymd(jd)} 的月长 ${L.monthDays}`).toContain(L.monthDays);
      if (L.month === prev.month && L.isLeap === prev.isLeap) {
        expect(L.day, `${ymd(jd)} 日序不连续`).toBe(day + 1);
      } else {
        expect(L.day, `${ymd(jd)} 换月却不是初一`).toBe(1);
        expect(day, `${ymd(jd)} 上个月末日 ${day} 与月长 ${prev.monthDays} 不符`)
          .toBe(prev.monthDays);
      }
      day = L.day; prev = L;
    }
  });

  it("**初一必是朔所在之日** —— 这是农历的定义，不是巧合", () => {
    for (const [y, m, d] of [[2024, 2, 10], [2023, 1, 22], [2020, 1, 25]] as const) {
      const L = lunarDateOf(at(y, m, d));
      expect(L.day).toBe(1);
      const nmDay = Math.floor((L.newMoonJdUT as number) + 0.5 + CHINA_STANDARD_OFFSET_HOURS / 24);
      const thisDay = Math.floor((at(y, m, d) as number) + 0.5 + CHINA_STANDARD_OFFSET_HOURS / 24);
      expect(nmDay).toBe(thisDay);
    }
  });

  it("一个农历年只有 12 或 13 个月，没有第三种", () => {
    for (let y = 1995; y <= 2035; y++) {
      const seen = new Set<string>();
      const from = springFestivalOf(y) as number;
      const to = springFestivalOf(y + 1) as number;
      // 月长 29–30 日，步长 10 日不会漏月
      for (let jd = from; jd < to; jd += 10) {
        const L = lunarDateOf(jd as JulianDay);
        seen.add(`${L.isLeap ? "闰" : ""}${L.month}`);
      }
      expect([12, 13], `${y} 农历年有 ${seen.size} 个月`).toContain(seen.size);
    }
  });
});

describe("**农历年界不是立春年界** —— 本领域最常见的错误之一", () => {
  it("两条界确实会分开，且互有先后", () => {
    // 2024：立春 2/4，春节 2/10 —— 立春在前
    const sf2024 = ymd(springFestivalOf(2024) as number);
    expect(sf2024).toBe("2024-02-10");
    // 2025：立春 2/3，春节 1/29 —— 春节在前
    expect(ymd(springFestivalOf(2025) as number)).toBe("2025-01-29");
  });

  it("落在两界之间的日子，农历年与年柱各说各的", () => {
    // 2024-02-06：已过立春（2/4），未到春节（2/10）
    const chart = buildChart({
      year: 2024, month: 2, day: 6, hour: 12, minute: 0,
      gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    const L = lunarDateOf(at(2024, 2, 6));
    // 年柱已进甲辰（立春为界）
    expect(`${chart.year.stem}${chart.year.branch}`).toBe("甲辰");
    // 农历仍在癸卯年腊月
    expect(L.year).toBe(2023);
    expect(L.month).toBe(12);
    expect(L.isLeap).toBe(false);
  });
});

describe("如实报出的不确定", () => {
  it("日界余量恒为正，且大多数月远离日界", () => {
    let uncertain = 0; let n = 0;
    for (let y = 1950; y <= 2050; y += 2) {
      for (const m of [3, 9]) {
        const L = lunarDateOf(at(y, m, 15));
        expect(L.boundaryMarginSeconds).toBeGreaterThanOrEqual(0);
        expect(L.boundaryMarginSeconds).toBeLessThanOrEqual(43200);
        if (L.boundaryUncertain) uncertain++;
        n++;
      }
    }
    // 20 秒 / 86400 秒 ≈ 0.023%，抽样百余次本就不该撞上
    expect(uncertain / n, "存疑比例异常之高，多半是余量算错了").toBeLessThan(0.02);
  });

  it("**时区偏移确实改变结果** —— 否则那个参数是死的", () => {
    // 1929 年前中国以北京地方时推朔（约 UTC+7:46）。找一个两种口径分月的日子：
    // 逐日扫描，只要存在一天在两种时区下农历日不同，参数就是活的
    let differ = 0;
    for (let i = 0; i < 400; i++) {
      const jd = ((at(1920, 1, 1) as number) + i) as JulianDay;
      const a = lunarDateOf(jd);
      const b = lunarDateOf(jd, { tzOffsetHours: 7 + 46 / 60 });
      if (a.day !== b.day || a.month !== b.month) differ++;
    }
    expect(differ, "换了时区却一天都不差 —— tzOffsetHours 没接进去").toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  JIE, QI, SOLAR_TERMS, solveSolarTerm, termsInGregorianYear,
} from "../src/astro/solarTerms.js";
import { apparentSolarLongitude, meeusLowPrecision } from "../src/astro/sun.js";
import { asTT, fromJulianDay, toJulianDay } from "../src/astro/julian.js";
import { normSigned } from "../src/astro/angles.js";

const jdOf = (y: number, m: number, d: number) =>
  toJulianDay({ year: y, month: m, day: d, hour: 0, minute: 0, second: 0 });

describe("节气定义表", () => {
  it("24 个，黄经自 315° 起每 15° 递增一周", () => {
    expect(SOLAR_TERMS).toHaveLength(24);
    for (let i = 0; i < 24; i++) {
      expect(SOLAR_TERMS[i]!.longitude).toBe((315 + i * 15) % 360);
    }
  });

  it("节与气交替，各 12", () => {
    expect(JIE).toHaveLength(12);
    expect(QI).toHaveLength(12);
    for (let i = 0; i < 24; i++) {
      expect(SOLAR_TERMS[i]!.kind, SOLAR_TERMS[i]!.name).toBe(i % 2 === 0 ? "节" : "气");
    }
  });

  it("十二节各开启一个月支，自寅顺行；气不开月支", () => {
    const opened = JIE.map((t) => t.opensMonthBranch);
    expect(opened).toEqual(["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"]);
    for (const q of QI) expect(q.opensMonthBranch).toBeNull();
  });

  it("立春是寅月之始 —— 年柱与月柱的共同起点", () => {
    const lichun = SOLAR_TERMS.find((t) => t.name === "立春")!;
    expect(lichun.longitude).toBe(315);
    expect(lichun.kind).toBe("节");
    expect(lichun.opensMonthBranch).toBe("寅");
  });
});

describe("求根的自洽性", () => {
  it("解出的时刻代回，视黄经确等于目标值", () => {
    for (const year of [1900, 1950, 1990, 2026, 2100]) {
      for (const t of termsInGregorianYear(year)) {
        const lambda = apparentSolarLongitude(t.jdTT);
        expect(Math.abs(normSigned(t.def.longitude - lambda)), `${year} ${t.def.name}`)
          .toBeLessThan(1e-7);
      }
    }
  });

  it("Newton 法 8 轮内收敛到 1e-8°", () => {
    // 导数取常量日均行度（0.9856°/日），真实值因偏心率有 ±1.7% 起伏，
    // 故收敛是超线性而非二次的：每轮残差约缩小到 1/30。
    // 自 ±0.5 日的初值猜测起，抵达 1e-8° 需 5–7 轮。
    for (const t of termsInGregorianYear(2026)) {
      expect(t.iterations, t.def.name).toBeLessThan(8);
    }
  });

  it("如实上报所用级数的精度，绝不冒充达标", () => {
    const r = solveSolarTerm(315, asTT(jdOf(2026, 2, 4)));
    expect(r.providerId).toBe("meeus-low-precision");
    expect(r.meetsTolerance).toBe(false);
    // 0.01° / 0.9856°·日⁻¹ × 86400 秒 ≈ 876 秒 ≈ 14.6 分钟
    expect(r.estimatedUncertaintySeconds).toBeGreaterThan(800);
    expect(r.estimatedUncertaintySeconds).toBeLessThan(950);
    expect(meeusLowPrecision.meetsSolarTermTolerance).toBe(false);
  });
});

describe("一年 24 节气的结构", () => {
  it("严格递增，且全部落在该公历年内", () => {
    for (const year of [1900, 1987, 2026, 2100]) {
      const ts = termsInGregorianYear(year);
      expect(ts).toHaveLength(24);
      for (let i = 1; i < ts.length; i++) {
        expect(ts[i]!.jdTT as number, `${year} ${ts[i]!.def.name}`)
          .toBeGreaterThan(ts[i - 1]!.jdTT as number);
      }
      for (const t of ts) {
        expect(fromJulianDay(t.jdUT as number).year, `${year} ${t.def.name}`).toBe(year);
      }
    }
  });

  it("相邻间隔在 14.6–15.8 日之间（偏心率造成的真实起伏）", () => {
    const ts = termsInGregorianYear(2026);
    for (let i = 1; i < ts.length; i++) {
      const gap = (ts[i]!.jdTT as number) - (ts[i - 1]!.jdTT as number);
      expect(gap, `${ts[i - 1]!.def.name}→${ts[i]!.def.name}`).toBeGreaterThan(14.6);
      expect(gap).toBeLessThan(15.8);
    }
  });

  it("公历年内自小寒始、至冬至终", () => {
    const ts = termsInGregorianYear(2026);
    expect(ts[0]!.def.name).toBe("小寒");
    expect(ts[23]!.def.name).toBe("冬至");
  });
});

/**
 * 以下为**独立于任何系数表**的天文事实校验。
 * 不引用外部数据，不依赖凭记忆转录的常数 —— 只用无可争议的物理与历法常识。
 * 低精度级数（±15 分钟）足以通过这些检查；它们能捕获的是量级错误、
 * 符号错误、历元错误、项号错位这类真正致命的问题。
 */
describe("独立天文事实校验", () => {
  const dateOf = (year: number, name: string) => {
    const t = termsInGregorianYear(year).find((x) => x.def.name === name)!;
    return fromJulianDay(t.jdUT as number);
  };

  it("四立与二分二至落在公认的日期窗口内", () => {
    const windows: [string, number, number, number][] = [
      ["立春", 2, 3, 5], ["春分", 3, 19, 21], ["立夏", 5, 5, 6],
      ["夏至", 6, 20, 22], ["立秋", 8, 7, 8], ["秋分", 9, 22, 24],
      ["立冬", 11, 7, 8], ["冬至", 12, 20, 23],
    ];
    for (const year of [1900, 1950, 2000, 2026, 2050]) {
      for (const [name, month, lo, hi] of windows) {
        const d = dateOf(year, name);
        expect(d.month, `${year} ${name} 的月份`).toBe(month);
        expect(d.day, `${year} ${name} 的日期`).toBeGreaterThanOrEqual(lo);
        expect(d.day, `${year} ${name} 的日期`).toBeLessThanOrEqual(hi);
      }
    }
  });

  /**
   * 「回归年 = 365.2422 日」只对**全黄经平均**成立，对单个黄经点并不成立。
   * 各基点的年长实测约为：
   *   冬至年 365.2427 > 春分年 365.2424 > 秋分年 365.2420 > 夏至年 365.2416
   * 差异源于地球在轨道不同位置的角速度不同（近日点在一月）。
   * 拿 365.2422 去卡立春年（315°，介于冬至与春分之间）必然失败 ——
   * 那不是实现误差，是把平均值误当成了逐点值。
   */
  const yearLengthAt = (name: string): number => {
    const at = (y: number) =>
      termsInGregorianYear(y).find((t) => t.def.name === name)!.jdTT as number;
    return (at(2100) - at(1900)) / 200;
  };

  it("各基点年长皆在 365.241–365.244 日之间", () => {
    for (const t of SOLAR_TERMS) {
      const len = yearLengthAt(t.name);
      expect(len, `${t.name}年`).toBeGreaterThan(365.2410);
      expect(len, `${t.name}年`).toBeLessThan(365.2435);
    }
  });

  it("二十四点年长的平均值才是回归年 365.2422", () => {
    const mean = SOLAR_TERMS.reduce((a, t) => a + yearLengthAt(t.name), 0) / 24;
    expect(mean).toBeCloseTo(365.2422, 3);
  });

  it("年长排序：冬至年 > 春分年 > 秋分年 > 夏至年", () => {
    // 这条排序只有正确建模了轨道偏心率才可能重现 —— 正圆轨道下四者全等。
    const winter = yearLengthAt("冬至");
    const vernal = yearLengthAt("春分");
    const autumn = yearLengthAt("秋分");
    const summer = yearLengthAt("夏至");
    expect(winter).toBeGreaterThan(vernal);
    expect(vernal).toBeGreaterThan(autumn);
    expect(autumn).toBeGreaterThan(summer);
    expect(winter - summer, "冬至年比夏至年长约 0.0011 日").toBeGreaterThan(0.0005);
    expect(winter - summer).toBeLessThan(0.0018);
  });

  it("北半球夏半年比冬半年长约 7.5 日 —— 一月过近日点的直接后果", () => {
    // 春分→秋分 ≈ 186.4 日，秋分→次年春分 ≈ 178.8 日。
    // 这条不对称是地球轨道偏心率的直接体现：近日点在一月，
    // 冬季公转快、扫过 180° 用时短。任何把轨道当正圆的实现都过不了这一关。
    for (const year of [1950, 2026]) {
      const ts = termsInGregorianYear(year);
      const next = termsInGregorianYear(year + 1);
      const chunfen = ts.find((t) => t.def.name === "春分")!.jdTT as number;
      const qiufen = ts.find((t) => t.def.name === "秋分")!.jdTT as number;
      const chunfenNext = next.find((t) => t.def.name === "春分")!.jdTT as number;

      const summerHalf = qiufen - chunfen;
      const winterHalf = chunfenNext - qiufen;
      expect(summerHalf, `${year} 夏半年`).toBeGreaterThan(185.5);
      expect(summerHalf).toBeLessThan(187.5);
      expect(winterHalf, `${year} 冬半年`).toBeGreaterThan(178);
      expect(winterHalf).toBeLessThan(180);
      expect(summerHalf - winterHalf).toBeGreaterThan(6.5);
      expect(summerHalf - winterHalf).toBeLessThan(8.5);
    }
  });

  it("冬至前后节气间隔最短、夏至前后最长 —— 近日点在冬", () => {
    const ts = termsInGregorianYear(2026);
    const gapAt = (name: string) => {
      const i = ts.findIndex((t) => t.def.name === name);
      return (ts[i + 1]!.jdTT as number) - (ts[i]!.jdTT as number);
    };
    expect(gapAt("小寒"), "小寒→大寒").toBeLessThan(15.0);
    expect(gapAt("夏至"), "夏至→小暑").toBeGreaterThan(15.4);
    expect(gapAt("夏至")).toBeGreaterThan(gapAt("小寒"));
  });
});

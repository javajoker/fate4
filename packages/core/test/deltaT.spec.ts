import { describe, expect, it } from "vitest";
import { deltaTSeconds } from "../src/astro/deltaT.js";

/**
 * ΔT 的已知实测值（IERS / NASA 公布）。
 * 容差刻意分档：拟合区间从严，外推区间从宽 —— 后者本就不可能准。
 */
describe("ΔT 对已知实测值", () => {
  const known: [number, number, number, string][] = [
    [1900, -2.8, 1.5, "20 世纪初 ΔT 为负 —— 当时的世界时快于地球时"],
    [1920, 21.2, 1.5, ""],
    [1950, 29.1, 1.5, ""],
    [1970, 40.2, 1.5, ""],
    [1990, 56.9, 1.5, ""],
    [2000, 63.8, 1.0, "E&M 拟合区间末端，应当很准"],
  ];
  for (const [year, expected, tol, note] of known) {
    it(`${year} 年 ΔT ≈ ${expected}s${note ? ` —— ${note}` : ""}`, () => {
      expect(deltaTSeconds(year, 1).seconds).toBeCloseTo(expected, 0);
      expect(Math.abs(deltaTSeconds(year, 1).seconds - expected)).toBeLessThan(tol);
    });
  }

  it("2020 年：E&M 外推式高估实测约 2 秒，这是已知偏离", () => {
    // 实测 ΔT(2020) ≈ 69.4s；E&M (2006) 外推给出约 71.6s。
    // 记录此偏差是为了让它可见 —— 它吃掉了 60 秒容差中的约 4%。
    const got = deltaTSeconds(2020, 1).seconds;
    expect(got).toBeGreaterThan(69);
    expect(got).toBeLessThan(73);
    expect(got - 69.4).toBeGreaterThan(1); // 确实高估
    expect(got - 69.4).toBeLessThan(4);
  });
});

describe("ΔT 的性质", () => {
  it("长期趋势上升，但**并非单调** —— 1930 年代确有下凹", () => {
    // 地球自转的长期趋势是变慢（ΔT 升），但叠加着不规则的十年尺度涨落。
    // 1930 年代地球自转略微加快，ΔT 实测出现平台乃至微降，
    // E&M 的 1920–1941 分段如实再现了这一点。
    // 把这里写成「单调递增」会是一个看似合理、实则违背史实的断言。
    expect(deltaTSeconds(2100, 7).seconds).toBeGreaterThan(deltaTSeconds(1900, 7).seconds);

    const y1930 = deltaTSeconds(1930, 7).seconds;
    const y1935 = deltaTSeconds(1935, 7).seconds;
    const y1940 = deltaTSeconds(1940, 7).seconds;
    expect(y1935, "1935 应低于 1930 —— 这是真实的下凹").toBeLessThan(y1930);
    expect(y1940, "1940 已回升").toBeGreaterThan(y1935);
    expect(y1930 - y1935, "下凹幅度不足 1 秒").toBeLessThan(1);
  });

  it("1960 年以后单调递增", () => {
    let prev = -Infinity;
    for (let y = 1960; y <= 2100; y += 5) {
      const v = deltaTSeconds(y, 7).seconds;
      expect(v, `${y} 年`).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it("分段处连续，无跳变", () => {
    const boundaries = [1920, 1941, 1961, 1986, 2005, 2050];
    for (const b of boundaries) {
      const before = deltaTSeconds(b - 0.001, 7).seconds;
      const after = deltaTSeconds(b + 0.001, 7).seconds;
      expect(Math.abs(after - before), `${b} 年分段边界`).toBeLessThan(1.5);
    }
  });

  it("如实标注拟合与外推", () => {
    expect(deltaTSeconds(2000, 1).basis).toBe("fitted");
    expect(deltaTSeconds(2030, 1).basis).toBe("extrapolated");
    expect(deltaTSeconds(2090, 1).basis).toBe("extrapolated");
  });
});

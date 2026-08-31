import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { termsInGregorianYear } from "../src/astro/solarTerms.js";
import { vsop87 } from "../src/astro/vsop87.js";
import { meeusLowPrecision } from "../src/astro/sun.js";
import { julianDayToMillis } from "../src/time/timezone.js";

/**
 * 对外部参考数据的验收测试 —— P1 的判据所在。
 *
 * 参考源：香港天文台《二十四节气》，2019–2028 共 240 个节气。
 * 该区间内香港无夏令时，港时恒为 UTC+8。
 * HKO 只公布到分钟，故比对以「我方精确时刻」与「HKO 所报分钟」之差衡量；
 * 若 HKO 取四舍五入，此差已含最多 30 秒的量化噪声。
 */

const HERE = dirname(fileURLToPath(import.meta.url));
interface Ref {
  readonly count: number;
  readonly terms: readonly {
    year: number; term: string;
    hkt: { month: number; day: number; hour: number; minute: number };
  }[];
}
const REF: Ref = JSON.parse(
  readFileSync(resolve(HERE, "fixtures/hko-solar-terms.json"), "utf8"),
) as Ref;

const HKT_OFFSET_MS = 8 * 3600 * 1000;

/** 我方解出的时刻与 HKO 所报分钟之差，秒。正值表示我方偏晚。 */
function deviationSeconds(
  year: number, term: string, provider: typeof vsop87 | typeof meeusLowPrecision,
): number {
  const got = termsInGregorianYear(year, { provider }).find((t) => t.def.name === term);
  if (got === undefined) throw new Error(`${year} 年未解出 ${term}`);
  const ref = REF.terms.find((r) => r.year === year && r.term === term);
  if (ref === undefined) throw new Error(`参考数据缺 ${year} ${term}`);

  const mineHktMs = julianDayToMillis(got.jdUT as number) + HKT_OFFSET_MS;
  const refHktMs = Date.UTC(year, ref.hkt.month - 1, ref.hkt.day, ref.hkt.hour, ref.hkt.minute);
  return (mineHktMs - refHktMs) / 1000;
}

const YEARS = Array.from({ length: 10 }, (_, i) => 2019 + i);

describe("参考数据完整性", () => {
  it("240 条，10 年 × 24 节气", () => {
    expect(REF.count).toBe(240);
    expect(REF.terms).toHaveLength(240);
    for (const y of YEARS) {
      expect(REF.terms.filter((t) => t.year === y), `${y} 年`).toHaveLength(24);
    }
  });
});

describe("VSOP87：对香港天文台 240 个节气的偏差", () => {
  const deviations = YEARS.flatMap((y) =>
    REF.terms.filter((r) => r.year === y).map((r) => ({
      label: `${y} ${r.term}`,
      dev: deviationSeconds(y, r.term, vsop87),
    })),
  );

  it("**每一条**偏差都在 60 秒容差内 —— 无一例外", () => {
    const violations = deviations.filter((d) => Math.abs(d.dev) >= 60);
    expect(violations.map((v) => `${v.label}: ${v.dev.toFixed(1)}s`)).toEqual([]);
  });

  it("最大偏差与均值统计", () => {
    const abs = deviations.map((d) => Math.abs(d.dev));
    const max = Math.max(...abs);
    const mean = abs.reduce((a, b) => a + b, 0) / abs.length;
    const rms = Math.sqrt(abs.reduce((a, b) => a + b * b, 0) / abs.length);
    // 记录实测值；HKO 只报到分钟，故其中含最多 30 秒的量化噪声
    expect(max, `最大 ${max.toFixed(1)}s`).toBeLessThan(60);
    expect(mean, `均值 ${mean.toFixed(1)}s`).toBeLessThan(35);
    expect(rms, `均方根 ${rms.toFixed(1)}s`).toBeLessThan(40);
  });

  it("偏差无系统性正负倾向 —— 若有，说明某项常数偏了", () => {
    const signed = deviations.map((d) => d.dev);
    const bias = signed.reduce((a, b) => a + b, 0) / signed.length;
    // 系统性偏置应远小于随机散布；HKO 的取整方式若为截断会引入约 −30 秒的偏置
    expect(Math.abs(bias), `偏置 ${bias.toFixed(1)}s`).toBeLessThan(35);
  });
});

describe("低精度 provider 对照 —— 它确实不达标", () => {
  it("Meeus 简化解的偏差显著超出 60 秒", () => {
    const devs = REF.terms
      .filter((r) => r.year === 2026)
      .map((r) => Math.abs(deviationSeconds(2026, r.term, meeusLowPrecision)));
    const max = Math.max(...devs);
    // 若这条测试变绿，说明 provider 的精度声明与实际脱节，需重新审视
    expect(max, `低精度最大偏差 ${(max / 60).toFixed(1)} 分钟`).toBeGreaterThan(120);
    expect(meeusLowPrecision.meetsSolarTermTolerance).toBe(false);
    expect(vsop87.meetsSolarTermTolerance).toBe(true);
  });
});

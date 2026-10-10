import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { asTT } from "../src/astro/julian.js";
import { millisToJulianDay } from "../src/time/timezone.js";
import { deltaTSeconds } from "../src/astro/deltaT.js";
import { apparentSolarLongitude } from "../src/astro/sun.js";
import { vsop87 } from "../src/astro/vsop87.js";
import { lunarPosition } from "../src/astro/moon.js";
import { norm360 } from "../src/astro/angles.js";

/**
 * 与 **Astronomy Engine**（MIT，`reference/vendor/astronomy-engine` 子模块）
 * 逐点对照。
 *
 * ## 为什么要有这一条
 *
 * 本项目算太阳用 VSOP87D、算月亮用 Meeus 第 47 章的截断级数。
 * 两者都有自称精度，而「自称」是不够的 —— 一个实现可以自洽地错下去：
 * 系数抄错一位、章动符号写反、历元弄混，这些都不会被任何内部不变量逮到，
 * 因为内部不变量只看自己。
 *
 * 唯一能逮到它们的是**另一套独立实现**。节气那一侧已经对过香港天文台的
 * 240 个公布值；这一条补上的是**月亮**与**任意时刻的太阳**，
 * 那两样没有现成的公布表可查。
 *
 * ## 为什么是子模块而不是依赖
 *
 * 它**只在测试里用**，不进任何运行时路径 —— 内核的零运行时依赖没有破。
 * 子模块没初始化时本条自动跳过：一个因为缺少可选交叉校验而变红的测试套件，
 * 只会教人去忽略红色。
 */
const AE_PATH = resolve(
  import.meta.dirname, "../../../reference/vendor/astronomy-engine/source/js/astronomy.js");
const HAVE_AE = existsSync(AE_PATH);

/** 子模块里的天文库。类型未知，故按最小接口断言。 */
interface AstronomyEngine {
  MakeTime(d: Date): unknown;
  SunPosition(t: unknown): { elon: number };
  EclipticGeoMoon(t: unknown): { lon: number };
}

const MOMENTS: readonly (readonly [number, number, number])[] = [
  [1900, 1, 1], [1950, 7, 15], [1990, 5, 12], [2000, 1, 1],
  [2026, 1, 1], [2026, 3, 20], [2026, 6, 21], [2026, 9, 23], [2026, 12, 21],
  [2050, 4, 4], [2099, 10, 10],
];

/** 两个黄经之差，折到 ±180°，单位角秒。 */
const gapArcsec = (a: number, b: number): number =>
  Math.abs(((norm360(a) - norm360(b) + 540) % 360) - 180) * 3600;

describe.skipIf(!HAVE_AE)("**与 Astronomy Engine 独立对照** —— 自称精度不算数", () => {
  let AE: AstronomyEngine;

  it("子模块载得进来", async () => {
    const m = await import(pathToFileURL(AE_PATH).href) as
      { default?: AstronomyEngine } & AstronomyEngine;
    AE = m.default ?? m;
    expect(typeof AE.SunPosition).toBe("function");
    expect(typeof AE.EclipticGeoMoon).toBe("function");
  });

  it("**太阳黄经：两套实现差不到 5 角秒**", () => {
    let worst = 0; let where = "";
    for (const [y, mo, d] of MOMENTS) {
      const date = new Date(Date.UTC(y, mo - 1, d, 12));
      const jdTT = asTT(millisToJulianDay(date.getTime())
        + deltaTSeconds(y, mo).seconds / 86400);
      const g = gapArcsec(
        apparentSolarLongitude(jdTT, vsop87), AE.SunPosition(AE.MakeTime(date)).elon);
      if (g > worst) { worst = g; where = `${y}-${mo}-${d}`; }
    }
    expect(worst, `最差在 ${where}：${worst.toFixed(2)}″`).toBeLessThan(5);
  });

  it("**月亮黄经：两套实现差不到 20 角秒** —— 级数自称 10″，对照给的是实际", () => {
    let worst = 0; let where = "";
    for (const [y, mo, d] of MOMENTS) {
      const date = new Date(Date.UTC(y, mo - 1, d, 12));
      const jdTT = asTT(millisToJulianDay(date.getTime())
        + deltaTSeconds(y, mo).seconds / 86400);
      const g = gapArcsec(
        lunarPosition(jdTT).apparentLongitude, AE.EclipticGeoMoon(AE.MakeTime(date)).lon);
      if (g > worst) { worst = g; where = `${y}-${mo}-${d}`; }
    }
    expect(worst, `最差在 ${where}：${worst.toFixed(2)}″`).toBeLessThan(20);
  });

  it("**反向对照：故意错开一天，差必须大到离谱** —— 否则上面两条可能在比同一个东西", () => {
    const date = new Date(Date.UTC(2026, 0, 1, 12));
    const jdTT = asTT(millisToJulianDay(date.getTime()) + 69 / 86400 + 1);
    const g = gapArcsec(
      apparentSolarLongitude(jdTT, vsop87), AE.SunPosition(AE.MakeTime(date)).elon);
    expect(g).toBeGreaterThan(3000);   // 太阳一天走约 1°，即 3600″
  });
});

describe("子模块缺席时的交代", () => {
  it("缺了就跳过，不把测试套件搞红", () => {
    // 这一条本身总是通过 —— 它存在只为让「跳过」这件事在输出里留个痕迹。
    expect(typeof HAVE_AE).toBe("boolean");
    if (!HAVE_AE) {
      console.warn("reference/vendor/astronomy-engine 未初始化，交叉校验已跳过。"
        + "需要时：git submodule update --init --depth 1");
    }
  });
});

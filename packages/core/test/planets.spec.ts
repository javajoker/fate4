import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { asTT } from "../src/astro/julian.js";
import { deltaTSeconds } from "../src/astro/deltaT.js";
import { norm360 } from "../src/astro/angles.js";
import {
  planetPosition, PLANETS, PLANET_NAME, PLANET_ACCURACY_ARCSEC,
  PLANET_LATITUDE_ACCURACY_ARCSEC, PLANET_DISTANCE_ACCURACY_PPM, type PlanetId,
} from "../src/sky/planets.js";
import { VSOP87_PROVENANCE } from "@fate/data";

/**
 * 五星位置 —— 与 **Astronomy Engine** 逐点对照。
 *
 * ## 为什么这一条比「两处档案字节相同」更要紧
 *
 * 生成器那边核验的是**上游文件的字节**：sha256 相符、声明项数逐一相符。
 * 那只能证明「我读到的和官方发布的是同一份」，证明不了
 * **我用它用对了** —— 截断阈值取错、τ 的历元弄混、光行时迭代写反、
 * 章动符号颠倒，这些都不会动一个字节，却会让黄经错出几十角秒。
 *
 * 本次生成时 IMCCE 的 ftp 反复中断，五星里只有金星取到了第二份做字节比对
 * （见 `VSOP87_PROVENANCE` 逐天体的 `verifiedBy`）。于是这一条就是
 * 其余四颗的主要保证 —— 而它本来也比字节比对强：它校验的是整条链。
 *
 * ## 判据取多少 —— 以及为什么不是 2″
 *
 * 起初判据取 5″，四颗过了，土星没过（最大 9.7″）。顺手会想到是截断太狠，
 * 但拿**未截断的完整级数**重算，与截断版只差 0.03″，与 Astronomy Engine
 * 仍差 12.3″ —— 差异来自 VSOP87 这套解析理论与 JPL 数值历表的出入，
 * 不是本实现的粗糙。那个反直觉的对照值得记住。
 *
 * 于是判据改为**实测**：1900–2100 每 37 天取一点共 1975 点，
 * 量出每颗星的最大差与均方根，再向上取整定为 25″。
 * 测试用的是同一批采样的稀疏版（每 365 天），
 * 跑得快而仍足以逮住任何结构性错误 —— 一个符号写反是几千角秒的事，
 * 不是几角秒。
 *
 * 子模块没初始化时自动跳过：一个因为缺少可选交叉校验而变红的测试套件，
 * 只会教人去忽略红色。
 */
const AE_PATH = resolve(
  import.meta.dirname, "../../../reference/vendor/astronomy-engine/source/js/astronomy.js");
const HAVE_AE = existsSync(AE_PATH);

interface Vec { x: number; y: number; z: number }
interface AstronomyEngine {
  MakeTime(d: Date): unknown;
  GeoVector(body: string, date: unknown, aberration: boolean): Vec;
  Rotation_EQJ_ECT(time: unknown): { rot: number[][] };
  RotateVector(rot: unknown, v: Vec): Vec;
  EclipticLongitude(body: string, date: unknown): number;
}

const AE_BODY: Readonly<Record<PlanetId, string>> = {
  mercury: "Mercury", venus: "Venus", mars: "Mars",
  jupiter: "Jupiter", saturn: "Saturn",
};

/**
 * 1900–2100 每 365 天一点，共约 200 点。
 *
 * 用均匀采样而不是手挑几个「有代表性」的日子：手挑的那几个，
 * 挑的人多半会（无意地）挑到合得上的。最初那版就是十三个手挑时刻，
 * 四颗星全绿，而均匀采样一上来金星就冒出 19.3″。
 */
const SAMPLE_JDS: readonly number[] = (() => {
  const out: number[] = [];
  for (let jd = 2415020.5; jd < 2488070.5; jd += 365) out.push(jd);
  return out;
})();

const dateOf = (jd: number) => new Date((jd - 2440587.5) * 86400000);
const jdTTof = (jd: number) => {
  const d = dateOf(jd);
  return asTT(jd + deltaTSeconds(d.getUTCFullYear(), d.getUTCMonth() + 1).seconds / 86400);
};

/** 两个黄经之差，折到 ±180°，单位角秒。 */
const gapArcsec = (a: number, b: number): number =>
  Math.abs(((norm360(a) - norm360(b) + 540) % 360) - 180) * 3600;

describe.skipIf(!HAVE_AE)("**五星：与 Astronomy Engine 独立对照**", () => {
  let AE: AstronomyEngine;

  it("子模块载得进来，且带行星", async () => {
    const m = await import(pathToFileURL(AE_PATH).href) as
      { default?: AstronomyEngine } & AstronomyEngine;
    AE = m.default ?? m;
    expect(typeof AE.GeoVector).toBe("function");
    expect(typeof AE.Rotation_EQJ_ECT).toBe("function");
  });

  /** AE 的视地心黄经，取**当日真黄道**（ECT）—— 与本模块同一个坐标系。 */
  const aeLongitude = (id: PlanetId, date: Date): number => {
    const t = AE.MakeTime(date);
    const eqj = AE.GeoVector(AE_BODY[id], t, true);
    const v = AE.RotateVector(AE.Rotation_EQJ_ECT(t), eqj);
    return norm360(Math.atan2(v.y, v.x) * 180 / Math.PI);
  };

  for (const id of PLANETS) {
    it(`**${PLANET_NAME[id]}黄经**：与 AE 差不超过 ${PLANET_ACCURACY_ARCSEC}″（${SAMPLE_JDS.length} 点，1900–2100）`, () => {
      let worst = 0; let where = ""; let sq = 0;
      for (const jd of SAMPLE_JDS) {
        const g = gapArcsec(planetPosition(id, jdTTof(jd)).longitude,
          aeLongitude(id, dateOf(jd)));
        sq += g * g;
        if (g > worst) { worst = g; where = dateOf(jd).toISOString().slice(0, 10); }
      }
      const rms = Math.sqrt(sq / SAMPLE_JDS.length);
      expect(worst, `最差在 ${where}：${worst.toFixed(2)}″（均方根 ${rms.toFixed(2)}″）`)
        .toBeLessThan(PLANET_ACCURACY_ARCSEC);
      // 均方根远小于最大值，说明那几个最大值是偶发的理论差，不是系统偏置
      expect(rms, `均方根 ${rms.toFixed(2)}″`).toBeLessThan(6);
    });
  }

  it(`**黄纬也要对** —— 只比黄经的话，整个 z 分量错了都发现不了`, () => {
    let worst = 0; let where = "";
    for (const id of PLANETS) {
      for (const jd of SAMPLE_JDS) {
        const t = AE.MakeTime(dateOf(jd));
        const v = AE.RotateVector(AE.Rotation_EQJ_ECT(t), AE.GeoVector(AE_BODY[id], t, true));
        const aeLat = Math.atan2(v.z, Math.hypot(v.x, v.y)) * 180 / Math.PI;
        const g = Math.abs(planetPosition(id, jdTTof(jd)).latitude - aeLat) * 3600;
        if (g > worst) { worst = g; where = `${PLANET_NAME[id]} ${dateOf(jd).toISOString().slice(0, 10)}`; }
      }
    }
    expect(worst, `最差在 ${where}：${worst.toFixed(2)}″`)
      .toBeLessThan(PLANET_LATITUDE_ACCURACY_ARCSEC);
  });

  it("**地心距也要对** —— 它决定光行时，错了黄经会跟着错", () => {
    let worst = 0; let where = "";
    for (const id of PLANETS) {
      for (const jd of SAMPLE_JDS) {
        const t = AE.MakeTime(dateOf(jd));
        const v = AE.GeoVector(AE_BODY[id], t, true);
        const aeDist = Math.hypot(v.x, v.y, v.z);
        const ppm = Math.abs(planetPosition(id, jdTTof(jd)).distance - aeDist) / aeDist * 1e6;
        if (ppm > worst) { worst = ppm; where = `${PLANET_NAME[id]} ${dateOf(jd).toISOString().slice(0, 10)}`; }
      }
    }
    expect(worst, `最差在 ${where}：${worst.toFixed(1)} ppm`)
      .toBeLessThan(PLANET_DISTANCE_ACCURACY_PPM);
  });

  it("**差异来自理论，不是截断** —— 这条把结论钉死，免得日后有人去调阈值", () => {
    // 取土星最不合的那一点。若有人把截断放宽十倍，这个差**不会变小** ——
    // 因为它根本不是截断造成的。当初查这个问题走的弯路就在这里：
    // 先怀疑截断，拿未截断的完整级数重算，只差 0.03″，与 AE 仍差 12.3″。
    let worst = 0;
    for (const jd of SAMPLE_JDS) {
      const g = gapArcsec(planetPosition("saturn", jdTTof(jd)).longitude,
        aeLongitude("saturn", dateOf(jd)));
      if (g > worst) worst = g;
    }
    expect(worst, "土星确实有几个点合不上，这不是毛病，是理论的限度")
      .toBeGreaterThan(5);
    expect(worst, "但必须落在如实声明的范围内").toBeLessThan(PLANET_ACCURACY_ARCSEC);
  });

  it("**反向对照：错开一天必须差得离谱** —— 否则上面几条可能在比同一个东西", () => {
    const jd = 2461041.5;
    expect(gapArcsec(planetPosition("mercury", asTT(jdTTof(jd) + 1)).longitude,
      aeLongitude("mercury", dateOf(jd)))).toBeGreaterThan(2000);
  });

  it("**反向对照：五颗星互不相同** —— 否则可能全都在算同一颗", () => {
    const jd = jdTTof(2461041.5);
    const lons = PLANETS.map((p) => planetPosition(p, jd).longitude);
    expect(new Set(lons.map((l) => l.toFixed(3))).size).toBe(PLANETS.length);
  });
});

describe("五星级数的出处记录", () => {
  it("**每颗星都记着它实际核验到什么程度** —— 不笼统写「双源一致」", () => {
    const bodies = VSOP87_PROVENANCE.bodies as Readonly<Record<string, {
      readonly sha256: string; readonly verifiedBy: string;
    }>>;
    for (const id of ["MERCURY", "VENUS", "MARS", "JUPITER", "SATURN", "EARTH"]) {
      expect(bodies[id], id).toBeDefined();
      expect(bodies[id]!.sha256, id).toMatch(/^[0-9a-f]{64}$/);
      expect(bodies[id]!.verifiedBy.length, id).toBeGreaterThan(10);
    }
    // 金星是本次唯一真取到两份的，别让它日后被含糊成和其余一样
    expect(bodies["VENUS"]!.verifiedBy).toContain("逐字节相同");
    expect(bodies["MARS"]!.verifiedBy).toContain("单源");
  });

  it("截断残差是算出来的，且都在 1 角秒以下", () => {
    const bodies = VSOP87_PROVENANCE.bodies as Readonly<Record<string, {
      readonly worstCaseResidual: Readonly<Record<string, { arcsec?: number; au?: number }>>;
    }>>;
    for (const id of ["MERCURY", "VENUS", "MARS", "JUPITER", "SATURN"]) {
      for (const v of ["L", "B"]) {
        const a = bodies[id]!.worstCaseResidual[v]?.arcsec;
        expect(a, `${id}.${v}`).toBeGreaterThan(0);
        expect(a, `${id}.${v}`).toBeLessThan(1);
      }
    }
  });

  it("**自报精度不许比实测更好，也不许松得没有意义**", () => {
    // 两头都锁：报松了这个声明就什么也没保证；报紧了测试会红，
    // 而那时改测试比改声明容易 —— 正是不该发生的那种修法。
    expect(PLANET_ACCURACY_ARCSEC).toBeGreaterThanOrEqual(20);
    expect(PLANET_ACCURACY_ARCSEC).toBeLessThanOrEqual(60);
  });
});

describe("**五星不许漏进根 bundle**", () => {
  it("`@fate/core` 的根 index 不引任何行星级数 —— 四柱一条都用不上", async () => {
    // 410 KB 的级数若经根 index 转出，每个只排四柱的调用方都得背着它。
    // 这条在 dist 的依赖图上查，不是看源码的 import 写法 ——
    // 真正决定 bundle 的是前者。
    const { readFileSync, existsSync } = await import("node:fs");
    const seen = new Set<string>();
    const walk = (f: string) => {
      if (seen.has(f) || !existsSync(f)) return;
      seen.add(f);
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) {
        const rel = m[1]!;
        walk(resolve(f, "..", rel));
      }
    };
    walk(resolve(import.meta.dirname, "../dist/src/index.js"));
    const leaked = [...seen].filter((f) => /vsop87\/(mercury|venus|mars|jupiter|saturn|planets)/.test(f));
    expect(leaked, `这些行星文件漏进了根 bundle：${leaked.join(", ")}`).toEqual([]);
    // 反向对照：地球的确在根 bundle 上（四柱要用），否则上面那条可能只是
    // 因为遍历根本没走起来
    expect([...seen].some((f) => /index\.js$/.test(f))).toBe(true);
    expect(seen.size).toBeGreaterThan(20);
  });
});

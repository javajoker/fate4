import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { asTT, type JulianDay } from "../src/astro/julian.js";
import { deltaTSeconds } from "../src/astro/deltaT.js";
import { trueObliquity } from "../src/astro/nutation.js";
import { norm360 } from "../src/astro/angles.js";
import { apparentSolarLongitude } from "../src/astro/sun.js";
import { vsop87 } from "../src/astro/vsop87.js";
import {
  apparentSiderealTime, chartAngles, wholeSignHouse, signIndexOf,
  degreeInSign, distanceToSignBoundary, SIGNS,
} from "../src/sky/angles.js";
import {
  CLASSICAL_BODIES, DOMICILE, EXALTATION, EGYPTIAN_BOUNDS, TRIPLICITY,
  faceRuler, dignitiesOf, dignityScore, isDayChart, elementOfSign,
  type ClassicalBody,
} from "../src/sky/dignities.js";
import {
  skyChart, aspectsOf, SKY_PENDING_CALIBRATION,
} from "../src/sky/chart.js";
import { PLANET_ACCURACY_ARCSEC } from "../src/sky/planets.js";

const AE_PATH = resolve(
  import.meta.dirname, "../../../reference/vendor/astronomy-engine/source/js/astronomy.js");
const HAVE_AE = existsSync(AE_PATH);

interface AstronomyEngine {
  SiderealTime(d: Date): number;
  Observer: new (lat: number, lon: number, h: number) => unknown;
  Horizon(d: Date, o: unknown, ra: number, dec: number, refraction: string | null):
    { altitude: number; azimuth: number };
  Equator(body: string, d: Date, o: unknown, ofdate: boolean, aberration: boolean):
    { ra: number; dec: number };
}

/** 四个地点，刻意覆盖南北半球、赤道与极圈内。 */
const PLACES: readonly (readonly [string, number, number])[] = [
  ["上海", 121.47, 31.23], ["伦敦", -0.13, 51.51],
  ["悉尼", 151.2, -33.87], ["基多", -78.5, -0.2], ["雷克雅未克", -21.9, 64.13],
];

const jdOf = (jd: number) => jd as JulianDay;
const ttOf = (jd: number) => {
  const d = new Date((jd - 2440587.5) * 86400000);
  return asTT(jd + deltaTSeconds(d.getUTCFullYear(), d.getUTCMonth() + 1).seconds / 86400);
};
const dateOf = (jd: number) => new Date((jd - 2440587.5) * 86400000);

describe.skipIf(!HAVE_AE)("**上升点与中天：与 Astronomy Engine 对照**", () => {
  let AE: AstronomyEngine;

  it("子模块载得进来", async () => {
    const m = await import(pathToFileURL(AE_PATH).href) as
      { default?: AstronomyEngine } & AstronomyEngine;
    AE = m.default ?? m;
    expect(typeof AE.SiderealTime).toBe("function");
  });

  it("**视恒星时差不到 1 角秒** —— 它错了，整张盘跟着转", () => {
    let worst = 0;
    for (let jd = 2415020.5; jd < 2488070.5; jd += 997) {
      const g = Math.abs(((apparentSiderealTime(jdOf(jd), ttOf(jd))
        - AE.SiderealTime(dateOf(jd)) * 15 + 540) % 360) - 180) * 3600;
      if (g > worst) worst = g;
    }
    expect(worst, `最大 ${worst.toFixed(3)}″`).toBeLessThan(1);
  });

  /**
   * 上升点的定义就是**黄道与东地平的交点**，故最直接的检验不是拿另一个
   * 上升点算法来比，而是问：这个黄经点此刻的地平高度是不是 0，
   * 且在不在东边。那是定义本身，不依赖任何第二实现的约定。
   */
  it("**上升点确实落在地平上（高度 0），且在东半天**", () => {
    let worstAlt = 0; let where = "";
    for (const [name, lon, lat] of PLACES) {
      for (let jd = 2451545.0; jd < 2451545.0 + 30; jd += 0.37) {
        const a = chartAngles(jdOf(jd), ttOf(jd), lon, lat);
        const eps = trueObliquity(ttOf(jd)) * Math.PI / 180;
        const L = a.ascendant * Math.PI / 180;
        const x = Math.cos(L), y = Math.sin(L) * Math.cos(eps), z = Math.sin(L) * Math.sin(eps);
        const ra = norm360(Math.atan2(y, x) * 180 / Math.PI) / 15;
        const dec = Math.asin(z) * 180 / Math.PI;
        const obs = new AE.Observer(lat, lon, 0);
        // refraction null = 几何地平。占星的上升点不含蒙气差 ——
        // 传 "normal" 会得到处处 0.483° 的系统偏置，那正是折射本身。
        const h = AE.Horizon(dateOf(jd), obs, ra, dec, null);
        if (Math.abs(h.altitude) > worstAlt) {
          worstAlt = Math.abs(h.altitude); where = `${name} jd=${jd.toFixed(2)}`;
        }
        expect(h.azimuth, `${name}：上升点应在东半天`).toBeLessThan(180);
      }
    }
    expect(worstAlt * 3600, `最差在 ${where}：${(worstAlt * 3600).toFixed(2)}″`).toBeLessThan(2);
  });

  it("**昼夜盘判定与太阳实际高度一致** —— 三分主星全看这一项", () => {
    let checked = 0; let disagree = 0;
    for (const [, lon, lat] of PLACES) {
      for (let jd = 2451545.0; jd < 2451545.0 + 20; jd += 0.137) {
        const a = chartAngles(jdOf(jd), ttOf(jd), lon, lat);
        const sl = apparentSolarLongitude(ttOf(jd), vsop87);
        const obs = new AE.Observer(lat, lon, 0);
        const eq = AE.Equator("Sun", dateOf(jd), obs, true, true);
        const h = AE.Horizon(dateOf(jd), obs, eq.ra, eq.dec, null);
        if (Math.abs(h.altitude) < 0.6) continue;   // 地平附近是边界，不计
        checked++;
        if (isDayChart(sl, a.ascendant) !== (h.altitude > 0)) disagree++;
      }
    }
    expect(checked).toBeGreaterThan(500);   // 反向对照：确实跑起来了
    expect(disagree, `${checked} 点中有 ${disagree} 点不一致`).toBe(0);
  });

  it("**反向对照：换个纬度上升点必须变** —— 否则纬度可能根本没进算式", () => {
    const jd = 2451545.0;
    const a = chartAngles(jdOf(jd), ttOf(jd), 121.47, 31.23).ascendant;
    const b = chartAngles(jdOf(jd), ttOf(jd), 121.47, -33.87).ascendant;
    expect(Math.abs(a - b)).toBeGreaterThan(1);
    // 中天则**不该**随纬度变 —— 它只取决于恒星时与黄赤交角
    const m1 = chartAngles(jdOf(jd), ttOf(jd), 121.47, 31.23).midheaven;
    const m2 = chartAngles(jdOf(jd), ttOf(jd), 121.47, -33.87).midheaven;
    expect(Math.abs(m1 - m2)).toBeLessThan(1e-9);
  });
});

describe("整宫制", () => {
  it("上升点所在的整宫即第一宫，不论它落在该宫第几度", () => {
    for (const asc of [0, 5.5, 29.99, 30, 180, 359.9]) {
      expect(wholeSignHouse(asc, asc)).toBe(1);
      // 同宫内任何一度都仍是第一宫 —— 这正是整宫制与等宫制的分别
      const base = signIndexOf(asc) * 30;
      expect(wholeSignHouse(base, asc)).toBe(1);
      expect(wholeSignHouse(base + 29.9, asc)).toBe(1);
    }
  });

  it("十二宫首尾相接，不重不漏", () => {
    const asc = 95;   // 巨蟹内
    const seen = new Set<number>();
    for (let s = 0; s < 12; s++) seen.add(wholeSignHouse(s * 30 + 15, asc));
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("**距宫界的度数随位置一起报** —— 25″ 的黄经误差在界上说不准", () => {
    expect(distanceToSignBoundary(0)).toBeCloseTo(0, 9);
    expect(distanceToSignBoundary(15)).toBeCloseTo(15, 9);
    expect(distanceToSignBoundary(29.5)).toBeCloseTo(0.5, 9);
    expect(distanceToSignBoundary(390)).toBeCloseTo(0, 9);
  });

  it("十二宫名齐全且每宫 30°", () => {
    expect(SIGNS).toHaveLength(12);
    expect(signIndexOf(29.99)).toBe(0);
    expect(signIndexOf(30)).toBe(1);
    expect(degreeInSign(45)).toBeCloseTo(15, 9);
  });
});

describe("必然尊贵的表 —— 结构性检查", () => {
  /**
   * ⚠️ 这几条**不证明表的内容是对的**。它们挡得住漏抄、重复、累加不到 30
   * 这类机械错误，挡不住「把金星和木星的次序记反」那种同构的张冠李戴。
   * 后者只有拿实体书逐条比才看得出，故已列入 PENDING_CALIBRATION。
   *
   * 把这一点写在这里，是因为一组全绿的结构性测试最容易让人以为表已经核过了。
   */
  it("庙：十二宫各有主星，日月各一、五星各二", () => {
    expect(DOMICILE).toHaveLength(12);
    const count = new Map<ClassicalBody, number>();
    for (const b of DOMICILE) count.set(b, (count.get(b) ?? 0) + 1);
    expect(count.get("sun")).toBe(1);
    expect(count.get("moon")).toBe(1);
    for (const b of ["mercury", "venus", "mars", "jupiter", "saturn"] as const) {
      expect(count.get(b), b).toBe(2);
    }
  });

  it("**庙的配置关于狮子/巨蟹轴对称** —— 这条比逐条记忆更难记错", () => {
    // 狮子(4)配日、巨蟹(3)配月，自此向两侧依次水、金、火、木、土
    for (let k = 1; k <= 5; k++) {
      expect(DOMICILE[(4 + k) % 12], `狮子+${k}`).toBe(DOMICILE[(3 - k + 12) % 12]);
    }
  });

  it("旺：七曜各有且仅有一个旺宫，旺度在 0–30", () => {
    const signs = new Set<number>();
    for (const b of CLASSICAL_BODIES) {
      const e = EXALTATION[b];
      expect(e.sign, b).toBeGreaterThanOrEqual(0);
      expect(e.sign, b).toBeLessThan(12);
      expect(e.degree, b).toBeGreaterThanOrEqual(0);
      expect(e.degree, b).toBeLessThan(30);
      signs.add(e.sign);
    }
    expect(signs.size, "七个旺宫互不相同").toBe(7);
  });

  it("界：每宫五段，累加恰好到 30°，主星互不重复，终止度递增", () => {
    expect(EGYPTIAN_BOUNDS).toHaveLength(12);
    EGYPTIAN_BOUNDS.forEach((sign, i) => {
      expect(sign, `第 ${i} 宫`).toHaveLength(5);
      expect(sign[4]![1], `第 ${i} 宫末段必须到 30°`).toBe(30);
      const rulers = sign.map((x) => x[0]);
      expect(new Set(rulers).size, `第 ${i} 宫五段主星应互不相同`).toBe(5);
      for (let k = 1; k < 5; k++) {
        expect(sign[k]![1], `第 ${i} 宫第 ${k} 段`).toBeGreaterThan(sign[k - 1]![1]);
      }
      // 界不配日月 —— 这是埃及界的定义性特征
      expect(rulers).not.toContain("sun");
      expect(rulers).not.toContain("moon");
    });
  });

  it("面：36 面按迦勒底序连续填充，白羊第一面为火星", () => {
    expect(faceRuler(0, 0)).toBe("mars");
    expect(faceRuler(0, 1)).toBe("sun");
    expect(faceRuler(0, 2)).toBe("venus");
    // 连续性：第 n 面与第 n+1 面在迦勒底序上相邻
    const order = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"];
    for (let n = 0; n < 35; n++) {
      const a = order.indexOf(faceRuler(Math.floor(n / 3), n % 3));
      const b = order.indexOf(faceRuler(Math.floor((n + 1) / 3), (n + 1) % 3));
      expect((a + 1) % 7, `第 ${n} 面到第 ${n + 1} 面`).toBe(b);
    }
  });

  it("三分：四组各有昼夜共三主，元素按火土风水循环", () => {
    expect(TRIPLICITY).toHaveLength(4);
    expect(elementOfSign(0)).toBe(0);   // 白羊火
    expect(elementOfSign(4)).toBe(0);   // 狮子火
    expect(elementOfSign(8)).toBe(0);   // 人马火
    expect(elementOfSign(3)).toBe(3);   // 巨蟹水
  });
});

describe("必然尊贵的判定", () => {
  it("火星在白羊得庙，在天秤得陷 —— 陷由庙推出，不另立表", () => {
    const day = dignitiesOf("mars", 5, true);
    expect(day.map((h) => h.kind)).toContain("domicile");
    const fall = dignitiesOf("mars", 185, true);
    expect(fall.map((h) => h.kind)).toContain("detriment");
  });

  it("太阳在白羊 19° 得旺；在天秤得落", () => {
    expect(dignitiesOf("sun", 19, true).map((h) => h.kind)).toContain("exaltation");
    expect(dignitiesOf("sun", 199, true).map((h) => h.kind)).toContain("fall");
  });

  it("**三分主星随昼夜换星** —— 换一个昼夜判定就换一颗星", () => {
    // 火象（白羊）昼主太阳、夜主木星
    const d = dignitiesOf("sun", 5, true).map((h) => h.kind);
    const n = dignitiesOf("sun", 5, false).map((h) => h.kind);
    expect(d).toContain("triplicity");
    expect(n).not.toContain("triplicity");
    expect(dignitiesOf("jupiter", 5, false).map((h) => h.kind)).toContain("triplicity");
  });

  it("一项都不占即为外来（peregrine），且不与别的项并存", () => {
    for (const b of CLASSICAL_BODIES) {
      for (let lon = 0; lon < 360; lon += 1.7) {
        const hits = dignitiesOf(b, lon, true);
        const kinds = hits.map((h) => h.kind);
        if (kinds.includes("peregrine")) {
          expect(hits, `${b}@${lon}`).toHaveLength(1);
        }
      }
    }
  });

  it("每颗星在每一度上都有判定，且逐项带得出理由", () => {
    for (const b of CLASSICAL_BODIES) {
      for (let lon = 0; lon < 360; lon += 3.3) {
        const hits = dignitiesOf(b, lon, lon > 180);
        expect(hits.length, `${b}@${lon}`).toBeGreaterThan(0);
        for (const h of hits) expect(h.why.length, `${b}@${lon}`).toBeGreaterThan(3);
      }
    }
  });

  it("**总分掩盖来历，故逐项必须可取** —— 分数相同未必同一回事", () => {
    const a = dignitiesOf("venus", 7, true);      // 白羊，看界/面
    const b = dignitiesOf("saturn", 190, true);   // 天秤，旺
    expect(dignityScore(a)).not.toBe(Number.NaN);
    expect(a.every((h) => typeof h.score === "number")).toBe(true);
    expect(b.length).toBeGreaterThan(0);
  });
});

describe("一张星盘 —— 同一份星历，两套读法", () => {
  // 1990-05-12 13:30 CST（当地行夏令时，故钟表 14:30）= 05:30 UTC，上海
  const JD = 2448023.729166667;
  const chart = () => skyChart(jdOf(JD), ttOf(JD), 121.47, 31.23);

  it("七政齐全，次序为传统次序，各自带宫位与宫度", () => {
    const c = chart();
    expect(c.bodies.map((b) => b.body))
      .toEqual(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]);
    for (const b of c.bodies) {
      expect(b.degree, b.name).toBeGreaterThanOrEqual(0);
      expect(b.degree, b.name).toBeLessThan(30);
      expect(b.house, b.name).toBeGreaterThanOrEqual(1);
      expect(b.house, b.name).toBeLessThanOrEqual(12);
      expect(b.dignities.length, b.name).toBeGreaterThan(0);
    }
  });

  it("**上升所在宫即第一宫** —— 七政四余的命宫与西洋的第一宫是同一宫", () => {
    const c = chart();
    expect(wholeSignHouse(c.angles.ascendant, c.angles.ascendant)).toBe(1);
    expect(c.ascendantSign).toBe(SIGNS[signIndexOf(c.angles.ascendant)]!.name);
  });

  it("**月亮黄纬给 null 而不是 0** —— 没算过的量写成 0 就是编的", () => {
    const c = chart();
    const moon = c.bodies.find((b) => b.body === "moon")!;
    expect(moon.latitude).toBeNull();
    // 太阳的 0 是实情（黄纬 < 1.2″），不是没算
    expect(c.bodies.find((b) => b.body === "sun")!.latitude).toBe(0);
    // 五星都有实际黄纬
    for (const b of ["mercury", "venus", "mars", "jupiter", "saturn"] as const) {
      expect(typeof c.bodies.find((x) => x.body === b)!.latitude, b).toBe("number");
    }
  });

  it("四余在盘上，且计都恒为罗睺的对点", () => {
    const c = chart();
    expect(norm360(c.siyu.rahu + 180)).toBeCloseTo(c.siyu.ketu, 9);
  });

  it("**距宫界随位置报出，贴界的会出警告**", () => {
    const c = chart();
    for (const b of c.bodies) {
      expect(b.toBoundary).toBeGreaterThanOrEqual(0);
      expect(b.toBoundary).toBeLessThanOrEqual(15);
    }
    // 造一个贴界的时刻：扫一年，总有星落在宫界 1° 内
    let sawWarning = false;
    for (let d = 0; d < 365 && !sawWarning; d += 1) {
      const c2 = skyChart(jdOf(JD + d), ttOf(JD + d), 121.47, 31.23);
      if (c2.warnings.some((w) => w.includes("宫界"))) sawWarning = true;
    }
    expect(sawWarning, "一年里总该有星贴到宫界上").toBe(true);
  });

  it("极圈内出警告 —— 整宫制仍算得出，但要说清楚", () => {
    const c = skyChart(jdOf(JD), ttOf(JD), -21.9, 78.2);
    expect(c.warnings.some((w) => w.includes("极圈"))).toBe(true);
  });

  it("**UT 与 TT 不可合成一个参数** —— 差 ΔT 的上升点足以差出小半宫", () => {
    const a = skyChart(jdOf(JD), ttOf(JD), 121.47, 31.23);
    // 误把 TT 当 UT 传进去（当代 ΔT ≈ 57 秒）
    const wrong = skyChart(jdOf(ttOf(JD)), ttOf(JD), 121.47, 31.23);
    const gap = Math.abs(a.angles.ascendant - wrong.angles.ascendant);
    expect(gap, `上升点差 ${(gap * 60).toFixed(1)} 角分`).toBeGreaterThan(0.1);
  });

  it("相位：整宫成相与按度成相分开标注，不混成一套", () => {
    const c = chart();
    const all = aspectsOf(c);
    expect(all.length).toBeGreaterThan(0);
    // 同宫两星必定整宫成合，不论相距几度
    const bySign = new Map<number, string[]>();
    for (const b of c.bodies) {
      bySign.set(b.signIndex, [...(bySign.get(b.signIndex) ?? []), b.body]);
    }
    for (const [, group] of bySign) {
      if (group.length < 2) continue;
      const hit = all.find((x) => x.kind === "conjunction"
        && group.includes(x.a) && group.includes(x.b));
      expect(hit, `同宫的 ${group.join("/")} 应整宫成合`).toBeDefined();
      expect(hit!.byWholeSign).toBe(true);
    }
  });

  it("**容许度是参数，不是常数** —— 各家 6°–10°，传统还按星分别取", () => {
    const c = chart();
    const narrow = aspectsOf(c, 3).filter((x) => !x.byWholeSign);
    const wide = aspectsOf(c, 10).filter((x) => !x.byWholeSign);
    expect(wide.length).toBeGreaterThanOrEqual(narrow.length);
  });

  it("**待核对清单与四柱那份分开** —— 四柱报告不该声明它没用到的占星表", () => {
    expect(SKY_PENDING_CALIBRATION.length).toBeGreaterThan(3);
    expect(SKY_PENDING_CALIBRATION.some((x) => x.includes("埃及界"))).toBe(true);
    // 四柱那份里不得混进占星条目
    expect(SKY_PENDING_CALIBRATION.some((x) => x.includes("穷通宝鉴"))).toBe(false);
  });

  it("精度随盘带出，读者不必去翻文档", () => {
    expect(chart().accuracyArcsec).toBe(PLANET_ACCURACY_ARCSEC);
  });
});

describe("**连续 vs 离散：这条分界跨在东西之上**", () => {
  const JD2 = 2448023.729166667;

  it("**挪动一秒，上升点就换一个值** —— 占星的状态空间不是有限集", () => {
    const a = skyChart(jdOf(JD2), ttOf(JD2), 121.47, 31.23).angles.ascendant;
    const b = skyChart(jdOf(JD2 + 1 / 86400), ttOf(JD2 + 1 / 86400), 121.47, 31.23)
      .angles.ascendant;
    expect(a).not.toBe(b);
    // 约 15″/秒（地球自转），随纬度与黄道角略有出入
    expect((b - a) * 3600).toBeGreaterThan(5);
    expect((b - a) * 3600).toBeLessThan(40);
  });

  it("**反向对照：同一时刻两次起盘必须逐位相同** —— 否则上面那条只是在测噪声", () => {
    const a = skyChart(jdOf(JD2), ttOf(JD2), 121.47, 31.23);
    const b = skyChart(jdOf(JD2), ttOf(JD2), 121.47, 31.23);
    expect(a.angles.ascendant).toBe(b.angles.ascendant);
    expect(a.bodies.map((x) => x.longitude)).toEqual(b.bodies.map((x) => x.longitude));
  });
});

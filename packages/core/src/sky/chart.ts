/**
 * 一张星盘 —— 同一份星历，两套读法。
 *
 * ## 这个模块是那条论证的落地
 *
 * `book-compare/` 一直在论证一件事：七政四余与西洋占星**不是两片天**，
 * 是同一片天上的两套约定。此前那是论述加几条算得出来的对应：
 *
 * - `compare/substrate.ts`：中气 ≡ 黄道十二宫入宫点（同一批时刻，皆为黄经 30° 整数倍）
 * - `compare/correspondence.ts`：罗睺计都月孛 = 月亮的升交点、降交点、远地点
 *
 * 缺的一直是**七政本身**。补上五星之后，这里把它兑现成一个函数：
 * 给一个时刻与一个地点，**同一组数**既可以读作七政四余，也可以读作西洋星盘。
 * 两套读法共用的部分（七政位置、十二宫、上升点）在数据上是同一份，
 * 不是「分别算了两遍凑巧一样」。
 *
 * 分野在**读法**，不在天：
 *
 * | | 七政四余 | 西洋古典 |
 * | --- | --- | --- |
 * | 天体 | 七政 + 四余 | 七曜（不含四余，交点另算） |
 * | 分宫 | 十二宫，命宫起于上升 | 整宫制，第一宫起于上升 |
 * | 强弱 | 庙旺利陷（另一套表） | 必然尊贵五项计分 |
 * | 昼夜 | 不构成规则分支 | **定义三分主星**，不可省 |
 *
 * 最后一行值得专门看：昼夜盘在西洋古典里是一条硬规则（换昼夜就换一颗
 * 三分主星），在七政四余里不是。同一片天，一方把它编进了规则，一方没有。
 * 那正是「测天」与「约定」的分界所在 —— 天给的是位置，规则是人定的。
 */

import { norm360 } from "../astro/angles.js";
import type { JulianDay, JulianDayTT } from "../astro/julian.js";
import { apparentSolarLongitude } from "../astro/sun.js";
import { vsop87 } from "../astro/vsop87.js";
import { lunarPosition } from "../astro/moon.js";
import { siyuAt, type SiyuPositions } from "../compare/correspondence.js";
import {
  chartAngles, signIndexOf, degreeInSign, wholeSignHouse,
  distanceToSignBoundary, SIGNS, type ChartAngles,
} from "./angles.js";
import { planetPosition, PLANET_ACCURACY_ARCSEC, type PlanetId } from "./planets.js";
import {
  dignitiesOf, dignityScore, isDayChart, BODY_NAME,
  type ClassicalBody, type DignityHit,
} from "./dignities.js";

export interface BodyPlacement {
  readonly body: ClassicalBody;
  readonly name: string;
  /** 视黄经，度。 */
  readonly longitude: number;
  /**
   * 视黄纬，度。`null` 表示**本引擎没有算**，不是 0。
   *
   * 太阳的黄纬 < 1.2″，记 0 是实情。月亮的黄纬可达 ±5.1°，
   * 但 `astro/moon.ts` 只做了黄经（它是为定朔写的，农历只要黄经），
   * 故这里给 `null` 而不是 0 —— **一个没算过的量写成 0 就是编的**。
   *
   * 本模块的规则一条都用不到它：宫位、庙旺、相位全按黄经。
   * 哪天要做食相或黄纬相位，再补月亮的黄纬级数，那时这里自然变成数。
   */
  readonly latitude: number | null;
  readonly sign: string;
  readonly signIndex: number;
  /** 在本宫内的度数，[0, 30)。 */
  readonly degree: number;
  /** 整宫制宫位（1–12）。 */
  readonly house: number;
  /**
   * 距最近宫界多少度。**永远随位置报出** ——
   * 黄经实测误差 25″，宫界是锐利的 30°，界附近说不准。
   */
  readonly toBoundary: number;
  /** 必然尊贵的逐项命中。 */
  readonly dignities: readonly DignityHit[];
  /** 逐项之和。⚠️ 总分掩盖来历，读的时候要连逐项一起看。 */
  readonly dignityScore: number;
}

export interface SkyChart {
  readonly angles: ChartAngles;
  /** 昼盘与否 —— 太阳在地平之上即为昼。西洋古典的三分主星全看这一项。 */
  readonly isDay: boolean;
  /** 七政：日、月、水、金、火、木、土。次序即传统次序。 */
  readonly bodies: readonly BodyPlacement[];
  /** 四余：罗睺、计都、月孛。紫炁无公认天体对应，故不在此处。 */
  readonly siyu: SiyuPositions;
  /** 上升点所在宫 —— 七政四余的命宫与西洋的第一宫，是同一宫。 */
  readonly ascendantSign: string;
  /** 本模块的黄经精度，角秒。随盘带出，不让读者去翻文档。 */
  readonly accuracyArcsec: number;
  /** 这张盘自己的来历警告。 */
  readonly warnings: readonly string[];
}

/** 七政的传统次序：日月，而后五星按水金火木土。 */
const SEVEN: readonly ClassicalBody[] = Object.freeze([
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
]);

/**
 * 起一张星盘。
 *
 * @param jdUT  世界时的儒略日 —— 恒星时要用它，不能传 TT。
 * @param jdTT  力学时的儒略日 —— 星历要用它。
 * @param longitudeEast 东经为正。
 * @param latitude      北纬为正。
 *
 * 两个儒略日都要，是因为这张盘同时依赖「地球转到哪了」（UT）与
 * 「天体走到哪了」（TT）。合成一个参数就必然在某一处错 ΔT 秒 ——
 * 当代约 69 秒，折合上升点约 0.29°，足以把一颗贴近宫界的星judged 到隔壁宫。
 */
export function skyChart(
  jdUT: JulianDay, jdTT: JulianDayTT,
  longitudeEast: number, latitude: number,
): SkyChart {
  const angles = chartAngles(jdUT, jdTT, longitudeEast, latitude);
  const sunLon = apparentSolarLongitude(jdTT, vsop87);
  const isDay = isDayChart(sunLon, angles.ascendant);
  const moon = lunarPosition(jdTT);

  const longitudeOf = (b: ClassicalBody): { lon: number; lat: number | null } => {
    if (b === "sun") return { lon: sunLon, lat: 0 };
    // 月亮的黄纬没算 —— 见 BodyPlacement.latitude 的说明，给 null 不给 0
    if (b === "moon") return { lon: moon.apparentLongitude, lat: null };
    const p = planetPosition(b as PlanetId, jdTT);
    return { lon: p.longitude, lat: p.latitude };
  };

  const bodies: BodyPlacement[] = SEVEN.map((b) => {
    const { lon, lat } = longitudeOf(b);
    const hits = dignitiesOf(b, lon, isDay);
    return {
      body: b, name: BODY_NAME[b],
      longitude: norm360(lon), latitude: lat,
      sign: SIGNS[signIndexOf(lon)]!.name,
      signIndex: signIndexOf(lon),
      degree: degreeInSign(lon),
      house: wholeSignHouse(lon, angles.ascendant),
      toBoundary: distanceToSignBoundary(lon),
      dignities: hits,
      dignityScore: dignityScore(hits),
    };
  });

  const warnings: string[] = [];

  // 贴近宫界的星：如实说出来，不假装边界是锐利的。
  // 判据取 1 度而非 25 角秒 —— 25″ 是本引擎的误差，
  // 而生时记录本身的误差（「大概下午三点」）比它大几个数量级。
  const nearBoundary = bodies.filter((p) => p.toBoundary < 1);
  for (const p of nearBoundary) {
    warnings.push(
      `${p.name}距${p.sign}的宫界仅 ${p.toBoundary.toFixed(2)}°`
      + `（约 ${(p.toBoundary * 60).toFixed(0)} 角分）。生时差上几分钟，它就换一宫。`);
  }
  if (Math.abs(latitude) > 66.5) {
    warnings.push(
      `纬度 ${latitude.toFixed(1)}° 在极圈之内。整宫制在此仍算得出，`
      + "但上升点在这里会快速跳变，而象限分宫制会直接退化。");
  }

  return {
    angles, isDay, bodies, siyu: siyuAt(jdTT),
    ascendantSign: SIGNS[signIndexOf(angles.ascendant)]!.name,
    accuracyArcsec: PLANET_ACCURACY_ARCSEC,
    warnings,
  };
}

/**
 * 古典相位 —— 只有托勒密五相，没有现代那些。
 *
 * 古典占星里相位是**整宫之间**的关系（同宫、六分、四分、三分、对分），
 * 而容许度是后世的事。这里两样都给：整宫相位（符号的，无容许度）
 * 与按度数的相位（带容许度），并分别标注 —— 它们是两套不同的东西，
 * 合成一套会让人以为古典占星有现代那种精确的 orb。
 */
export type AspectKind = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export const ASPECT_ANGLE: Readonly<Record<AspectKind, number>> = Object.freeze({
  conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180,
});

export const ASPECT_NAME: Readonly<Record<AspectKind, string>> = Object.freeze({
  conjunction: "合", sextile: "六分", square: "四分",
  trine: "三分", opposition: "对分",
});

export interface Aspect {
  readonly a: ClassicalBody;
  readonly b: ClassicalBody;
  readonly kind: AspectKind;
  /** 按整宫成相 —— 古典本义。 */
  readonly byWholeSign: boolean;
  /** 实际角距与正角之差，度。 */
  readonly orb: number;
}

/**
 * 找出盘中的相位。
 *
 * @param maxOrb 按度数成相的容许度。默认 8° —— 这是个**约定**，
 *   各家取 6°–10°，且传统上还按星分别取（日月宽、余星窄）。
 *   故它是参数，不是常数。
 */
export function aspectsOf(chart: SkyChart, maxOrb = 8): readonly Aspect[] {
  const out: Aspect[] = [];
  const bs = chart.bodies;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]!, b = bs[j]!;
      const sep = Math.abs(((a.longitude - b.longitude + 540) % 360) - 180);
      const signGap = Math.abs(((a.signIndex - b.signIndex + 18) % 12) - 6);
      for (const kind of Object.keys(ASPECT_ANGLE) as AspectKind[]) {
        const exact = ASPECT_ANGLE[kind];
        const orb = Math.abs(sep - exact);
        const byWholeSign = signGap * 30 === exact;
        if (orb <= maxOrb || byWholeSign) {
          out.push({ a: a.body, b: b.body, kind, byWholeSign, orb });
        }
      }
    }
  }
  return out;
}

/**
 * 这张盘用到的、尚待人工核对的数据。
 *
 * 与四柱那边的 `PENDING_CALIBRATION` 是同一类东西，但**不能混进同一个列表** ——
 * 一份四柱报告不该声明它根本没用到的占星表。故各列各的。
 */
export const SKY_PENDING_CALIBRATION: readonly string[] = Object.freeze([
  "埃及界 60 个条目（凭记忆转录，未经实体书逐条核对；结构性检查只挡得住漏抄与重复）",
  "三分主星（取 Dorothean 一系；另有 Ptolemaic 一系，昼夜主星配置不同）",
  "必然尊贵的计分（取 Lilly 一系；各家互有出入，且把五项加成一个总分本身是强假设）",
  "相位容许度（默认 8°，各家 6°–10°，传统上还按星分别取）",
  "七政四余的庙旺利陷表（尚未收录）",
]);

/**
 * 奇门遁甲 · 时家转盘起局。
 *
 * ## 五步
 *
 * ```
 * 1 定阴阳遁与局数   节气 + 三元（符头之支）→ 查三元局数表
 * 2 排地盘三奇六仪   自局数之宫起「戊」，阳遁顺飞、阴遁逆飞宫数
 * 3 定值符值使       旬首所遁之仪在地盘的哪一宫，该宫的九星为值符、八门为值使
 * 4 转天盘           值符星飞到「时干所在的地盘宫」，其余星沿洛书圆序跟转
 * 5 布八门八神       值使门按时辰在本旬中的位次移动；八神自值符宫顺逆布
 * ```
 *
 * ## 一处最易错的地方
 *
 * 三奇六仪的次序是 **戊己庚辛壬癸丁丙乙** —— 三奇殿后且**丁丙乙倒着排**。
 * 写成「…癸乙丙丁」全盘皆错，而错法很隐蔽：地盘看上去仍是九干各一，
 * 只有对着典籍逐宫核才看得出来。故测试拿阳遁一局逐宫对账。
 *
 * ## 中五宫
 *
 * 中五宫无门；九星有天禽而转盘时**寄坤二**。这是转盘法的处理，
 * 飞盘法另有其说 —— 两者是不同的流派，不可混。
 */

import type { Branch, Pillar, Stem } from "../types/ganzhi.js";
import { branchIndex, mod, sexagenaryIndexOf, stemAt, branchAt } from "../ganzhi/algebra.js";
import { asTT } from "../astro/julian.js";
import { apparentSolarLongitude, MEAN_SOLAR_MOTION_DEG_PER_DAY } from "../astro/sun.js";
import { DEFAULT_SOLAR_PROVIDER } from "../astro/defaults.js";
import { solveSolarTerm, SOLAR_TERMS } from "../astro/solarTerms.js";
import { utToTT } from "../chart/pillars.js";
import {
  CENTER_LODGE, DOOR_HOME, GODS, JU_TABLE, PALACES, QIYI_ORDER, RING,
  STAR_HOME, XUNSHOU_YI, YIN_TERMS, YUAN_OF_BRANCH,
  type Door, type God, type Palace, type Star, type Yuan,
} from "./tables.js";

export interface QimenChart {
  readonly pillars: {
    readonly year: Pillar; readonly month: Pillar;
    readonly day: Pillar; readonly hour: Pillar;
  };
  /** 所在节气。奇门用全部二十四气，不只取节。 */
  readonly term: string;
  readonly yin: boolean;
  readonly yuan: Yuan;
  /** 局数 1–9。 */
  readonly ju: number;
  /** 符头 —— 定三元所依的那一日。 */
  readonly futou: { readonly stem: Stem; readonly branch: Branch };
  /** 旬首（时干支所在旬的甲），及其所遁之仪。 */
  readonly xunshou: { readonly branch: Branch; readonly yi: Stem };
  /** 地盘三奇六仪。 */
  readonly earth: Readonly<Record<Palace, Stem>>;
  /** 天盘九星。中五恒为天禽 —— 它不上圆序，另见 `qinPalace`。 */
  readonly stars: Readonly<Record<Palace, Star>>;
  /**
   * 天禽星所寄之宫。
   *
   * 转盘法里天禽**寄坤二**，随天芮同行 —— 天芮转到哪一宫，天禽也在那一宫。
   * 初稿把天禽静态留在中五，于是它永远不参与格局，而实务上「天禽加临某门」
   * 是要断的。此处如实给出它的落宫。
   *
   * ⚠️ 飞盘法另有其说（天禽入中不寄）。两者是不同流派，不可混。
   */
  readonly qinPalace: Palace;
  /** 天盘干 —— 随星而转。 */
  readonly sky: Readonly<Record<Palace, Stem>>;
  readonly doors: Readonly<Record<Palace, Door | null>>;
  readonly gods: Readonly<Record<Palace, God | null>>;
  readonly zhifu: Star;
  readonly zhishi: Door;
  /** 值符所落之宫（天盘）。 */
  readonly zhifuPalace: Palace;
  /** 值使所落之宫。 */
  readonly zhishiPalace: Palace;
  /** 时干在地盘所落之宫。 */
  readonly hourPalace: Palace;
  readonly derivation: readonly string[];
}

/** 所在的节气（二十四气之一）—— 与 `enclosingTermOf` 同一套求根，只是步长 15°。 */
export function enclosingTermName(jdUT: number): { name: string; jdUT: number } {
  const jdTT = asTT(utToTT(jdUT));
  const lambda = apparentSolarLongitude(jdTT, DEFAULT_SOLAR_PROVIDER);
  const k = Math.floor(mod(lambda - 315, 360) / 15);
  const lon = mod(315 + 15 * k, 360);
  const def = SOLAR_TERMS.find((t) => t.longitude === lon);
  if (def === undefined) throw new Error(`黄经 ${lon}° 不是节气`);
  const guess = (jdTT as number) - mod(lambda - lon, 360) / MEAN_SOLAR_MOTION_DEG_PER_DAY;
  return { name: def.name, jdUT: solveSolarTerm(lon, asTT(guess)).jdUT as number };
}

/** 五日一元的头 —— 最近的甲日或己日。 */
export function futouOf(day: Pillar): { stem: Stem; branch: Branch; yuan: Yuan } {
  const n = sexagenaryIndexOf(day.stem, day.branch);
  const head = mod(n - mod(n, 5), 60);
  const branch = branchAt(head);
  return { stem: stemAt(head), branch, yuan: YUAN_OF_BRANCH[branch] };
}

/** 时干支所在旬的旬首（六甲之一）。 */
export function xunshouOf(hour: Pillar): { branch: Branch; yi: Stem; offset: number } {
  const n = sexagenaryIndexOf(hour.stem, hour.branch);
  const offset = mod(n, 10);              // 该时在本旬中的位次，0 为旬首
  const head = mod(n - offset, 60);
  const branch = branchAt(head);
  return { branch, yi: XUNSHOU_YI[branch], offset };
}

/** 沿洛书圆序移动 n 步。中五宫先寄坤二。 */
function ringStep(p: Palace, n: number): Palace {
  const at = p === 5 ? CENTER_LODGE : p;
  const i = RING.indexOf(at);
  return RING[mod(i + n, 8)]!;
}

export interface QimenInput {
  readonly pillars: QimenChart["pillars"];
  readonly jdUT: number;
}

export function buildQimen(input: QimenInput): QimenChart {
  const { pillars, jdUT } = input;
  const steps: string[] = [];

  // ── 1 定局 ──
  const term = enclosingTermName(jdUT);
  const yin = YIN_TERMS.has(term.name);
  const futou = futouOf(pillars.day);
  const table = JU_TABLE[term.name];
  if (table === undefined) throw new Error(`节气 ${term.name} 无局数`);
  const ju = table[{ 上元: 0, 中元: 1, 下元: 2 }[futou.yuan]]!;
  steps.push(`节气 ${term.name}，${yin ? "阴" : "阳"}遁；符头 ${futou.stem}${futou.branch} 为${futou.yuan}`
    + `，查得${yin ? "阴" : "阳"}遁 ${ju} 局`);

  // ── 2 地盘三奇六仪：自局数之宫起戊，阳顺阴逆飞宫数 ──
  const earth = {} as Record<Palace, Stem>;
  for (const [i, stem] of QIYI_ORDER.entries()) {
    const p = (mod(ju - 1 + (yin ? -i : i), 9) + 1) as Palace;
    earth[p] = stem;
  }
  steps.push(`地盘自 ${ju} 宫起戊，${yin ? "逆" : "顺"}飞：`
    + PALACES.map((p) => `${p}${earth[p]}`).join(" "));

  // ── 3 值符值使：旬首所遁之仪在地盘的哪一宫 ──
  const xun = xunshouOf(pillars.hour);
  const yiPalace = PALACES.find((p) => earth[p] === xun.yi)!;
  const zhifu = STAR_HOME[yiPalace];
  const zhishi = DOOR_HOME[yiPalace] ?? DOOR_HOME[CENTER_LODGE]!;
  steps.push(`时柱 ${pillars.hour.stem}${pillars.hour.branch} 属甲${xun.branch}旬，遁${xun.yi}；`
    + `${xun.yi}在地盘 ${yiPalace} 宫，故值符为${zhifu}、值使为${zhishi}`);

  // ── 4 转天盘：值符星飞到时干所在的地盘宫 ──
  // 时干为甲时，甲不上盘，以其所遁之仪为准
  const hourStem: Stem = pillars.hour.stem === "甲" ? xun.yi : pillars.hour.stem;
  const hourPalace = PALACES.find((p) => earth[p] === hourStem)!;
  const shift = RING.indexOf(hourPalace === 5 ? CENTER_LODGE : hourPalace)
    - RING.indexOf(yiPalace === 5 ? CENTER_LODGE : yiPalace);
  const stars = {} as Record<Palace, Star>;
  const sky = {} as Record<Palace, Stem>;
  for (const p of PALACES) {
    if (p === 5) { stars[p] = STAR_HOME[5]; sky[p] = earth[5]!; continue; }
    const from = ringStep(p, -shift);
    stars[p] = STAR_HOME[from];
    sky[p] = earth[from]!;
  }
  // 天禽寄坤二，随天芮同行
  const qinPalace = PALACES.find((p) => stars[p] === "天芮") ?? CENTER_LODGE;
  steps.push(`时干 ${hourStem} 在地盘 ${hourPalace} 宫，值符${zhifu}加临其上，`
    + `天盘沿洛书圆序转 ${mod(shift, 8)} 位；天禽寄坤二随天芮，落 ${qinPalace} 宫`);

  // ── 5 值使门与八神 ──
  // 值使自旬首宫起，按该时在本旬中的位次移动
  const zhishiPalace = ringStep(yiPalace, yin ? -xun.offset : xun.offset);
  const doors = {} as Record<Palace, Door | null>;
  for (const p of PALACES) doors[p] = null;
  const doorStart = RING.indexOf(zhishiPalace);
  const homeIdx = RING.indexOf(yiPalace === 5 ? CENTER_LODGE : yiPalace);
  for (let i = 0; i < 8; i++) {
    const src = RING[mod(homeIdx + i, 8)]!;
    const dst = RING[mod(doorStart + i, 8)]!;
    doors[dst] = DOOR_HOME[src];
  }
  steps.push(`该时为本旬第 ${xun.offset + 1} 位，值使${zhishi}自 ${yiPalace} 宫`
    + `${yin ? "逆" : "顺"}行 ${xun.offset} 位，落 ${zhishiPalace} 宫`);

  const zhifuPalace = hourPalace === 5 ? CENTER_LODGE : hourPalace;
  const gods = {} as Record<Palace, God | null>;
  for (const p of PALACES) gods[p] = null;
  const g0 = RING.indexOf(zhifuPalace);
  for (const [i, g] of GODS.entries()) {
    gods[RING[mod(g0 + (yin ? -i : i), 8)]!] = g;
  }
  steps.push(`八神自值符所在的 ${zhifuPalace} 宫${yin ? "逆" : "顺"}布`);

  return {
    pillars, term: term.name, yin, yuan: futou.yuan, ju,
    futou: { stem: futou.stem, branch: futou.branch },
    xunshou: { branch: xun.branch, yi: xun.yi },
    earth, stars, sky, doors, gods, qinPalace,
    zhifu, zhishi, zhifuPalace, zhishiPalace, hourPalace,
    derivation: Object.freeze(steps),
  };
}

/** 某宫的完整格局 —— 供叙述与表格。 */
export interface PalaceView {
  readonly palace: Palace;
  readonly earth: Stem;
  readonly sky: Stem;
  readonly star: Star;
  readonly door: Door | null;
  readonly god: God | null;
}

export const palaceViewOf = (q: QimenChart, p: Palace): PalaceView => ({
  palace: p, earth: q.earth[p], sky: q.sky[p],
  star: q.stars[p], door: q.doors[p], god: q.gods[p],
});

export const branchOfPalace = (b: Branch): number => branchIndex(b);

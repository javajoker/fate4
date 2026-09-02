/**
 * 六壬起课 —— 月将加时、天地盘、四课、十二天将。
 *
 * ## 天地盘
 *
 * 地盘固定：子丑寅卯……十二支各居其位，不动。
 * 天盘由**月将加时**得到：把月将压在占时的位置上，其余顺次排。
 *
 * ```
 * 天盘(地盘位 g) = 月将 + (g − 占时)
 * ```
 *
 * 于是「某地支之上是什么」这个问题有了答案，四课与三传全由它推出。
 *
 * ## 与六爻的一处关键差异
 *
 * 六爻的卦由起卦法决定，可以掷钱、可以报数；六壬的课**完全由时刻决定** ——
 * 同一时刻、同一日，任何人起出的是同一课。它比六爻更彻底地属于时刻。
 * 故六壬里没有「一事不二占」的技术问题：重问必得同课。
 */

import { BRANCHES, type Branch, type Pillar, type Stem } from "../types/ganzhi.js";
import { branchIndex, branchAt, mod } from "../ganzhi/algebra.js";
import { solveSolarTerm, SOLAR_TERMS } from "../astro/solarTerms.js";
import { asTT, toJulianDay } from "../astro/julian.js";
import { utToTT } from "../chart/pillars.js";
import {
  DAY_HOURS, GUIREN, JIGONG, TIANJIANG, YUEJIANG, YUEJIANG_BY_BRANCH,
  type TianjiangName, type YuejiangDef,
} from "./tables.js";

export interface Ke {
  /** 课的下神（地盘之支或前一课的上神）。 */
  readonly lower: Branch;
  /** 课的上神（天盘压在下神之上者）。 */
  readonly upper: Branch;
}

export interface LiurenPlate {
  readonly pillars: {
    readonly year: Pillar; readonly month: Pillar;
    readonly day: Pillar; readonly hour: Pillar;
  };
  readonly yuejiang: YuejiangDef;
  /** 占时 —— 即时支。 */
  readonly zhanshi: Branch;
  /** `tianpan[i]` 为地盘第 i 支（子起）之上的天盘之支。 */
  readonly tianpan: readonly Branch[];
  /** 日干寄宫。 */
  readonly jigong: Branch;
  /** 四课，自第一课起。 */
  readonly ke: readonly [Ke, Ke, Ke, Ke];
  /** 昼占还是夜占 —— 以占时判，卯至申为昼。 */
  readonly isDay: boolean;
  readonly guiren: Branch;
  /** 贵人顺布还是逆布。 */
  readonly clockwise: boolean;
  /** `tianjiang[i]` 为地盘第 i 支所临的天将。 */
  readonly tianjiang: readonly TianjiangName[];
}

/** 天盘之支：压在某个地盘位之上的那一支。 */
export const upperOf = (p: { tianpan: readonly Branch[] }, ground: Branch): Branch =>
  p.tianpan[branchIndex(ground)]!;

/** 天盘某支所临的地盘位 —— 天地盘的逆查。 */
export const groundOf = (p: { tianpan: readonly Branch[] }, sky: Branch): Branch =>
  branchAt(p.tianpan.findIndex((b) => b === sky));

/**
 * 某时刻的月将 —— 以**中气**为界。
 *
 * 不用查表插值，直接解太阳视黄经：中气在 30° 的整数倍上，
 * 而月将随太阳逆行十二支。与 `solarTerms.ts` 同一套求根。
 */
const zhongqiCache = new Map<number, { jd: number; def: YuejiangDef }[]>();

/** 某公历年的十二个中气时刻，按时间升序。记忆化 —— 一年只解一次。 */
function zhongqiOf(year: number): { jd: number; def: YuejiangDef }[] {
  const hit = zhongqiCache.get(year);
  if (hit !== undefined) return hit;
  const jan1 = toJulianDay({ year, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
  const out = YUEJIANG.map((def) => {
    const term = SOLAR_TERMS.find((t) => t.name === def.fromZhongqi);
    if (term === undefined) throw new Error(`未知中气 ${def.fromZhongqi}`);
    // 自小寒（285°）起算该中气在年内的大致位置
    const guess = jan1 + (mod(term.longitude - 285, 360) / 360) * 365.2422 + 5;
    return { jd: solveSolarTerm(term.longitude, asTT(utToTT(guess))).jdUT as number, def };
  }).sort((a, b) => a.jd - b.jd);
  zhongqiCache.set(year, out);
  return out;
}

export function yuejiangAt(jdUT: number): YuejiangDef {
  const y = new Date((jdUT - 2440587.5) * 86400000).getUTCFullYear();
  // 跨年时要看上一年最后一个中气，故取两年
  const all = [...zhongqiOf(y - 1), ...zhongqiOf(y)].filter((x) => x.jd <= jdUT);
  const last = all[all.length - 1];
  if (last === undefined) throw new RangeError(`定不出 ${jdUT} 的月将`);
  return last.def;
}

export interface PlateInput {
  readonly pillars: LiurenPlate["pillars"];
  /** 起课时刻的 UT 儒略日 —— 定月将用。 */
  readonly jdUT: number;
}

export function buildPlate(input: PlateInput): LiurenPlate {
  const { pillars, jdUT } = input;
  const yuejiang = yuejiangAt(jdUT);
  const zhanshi = pillars.hour.branch;

  // 月将加时：把月将压在占时之位，其余顺次
  const shift = branchIndex(yuejiang.branch) - branchIndex(zhanshi);
  const tianpan = BRANCHES.map((_, i) => branchAt(i + shift));

  const up = (g: Branch) => tianpan[branchIndex(g)]!;
  const jigong = JIGONG[pillars.day.stem as Stem];

  // 四课：干寄宫 → 其上 → 其上；日支 → 其上 → 其上
  const k1: Ke = { lower: jigong, upper: up(jigong) };
  const k2: Ke = { lower: k1.upper, upper: up(k1.upper) };
  const k3: Ke = { lower: pillars.day.branch, upper: up(pillars.day.branch) };
  const k4: Ke = { lower: k3.upper, upper: up(k3.upper) };

  // 十二天将：贵人落地盘的阳位（亥子丑寅卯辰）顺布，阴位（巳午未申酉戌）逆布
  const isDay = DAY_HOURS.includes(zhanshi);
  const guirenSky = isDay ? GUIREN[pillars.day.stem].day : GUIREN[pillars.day.stem].night;
  const guirenGround = branchAt(tianpan.findIndex((b) => b === guirenSky));
  const clockwise = ["亥", "子", "丑", "寅", "卯", "辰"].includes(guirenGround);
  const g0 = branchIndex(guirenGround);
  const tianjiang = BRANCHES.map((_, i) => {
    const step = clockwise ? mod(i - g0, 12) : mod(g0 - i, 12);
    return TIANJIANG[step]!;
  });

  return {
    pillars, yuejiang, zhanshi, tianpan, jigong,
    ke: [k1, k2, k3, k4], isDay, guiren: guirenGround, clockwise, tianjiang,
  };
}

/** 某地盘位上的天将。 */
export const tianjiangAt = (p: LiurenPlate, ground: Branch): TianjiangName =>
  p.tianjiang[branchIndex(ground)]!;

/** 某天盘之支所乘的天将 —— 天将随地盘，故先逆查到地盘位。 */
export const tianjiangOfSky = (p: LiurenPlate, sky: Branch): TianjiangName =>
  tianjiangAt(p, groundOf(p, sky));

export { YUEJIANG_BY_BRANCH };

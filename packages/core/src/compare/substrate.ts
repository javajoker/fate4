/**
 * 各套系统底下的**天文基底** —— 哪些是真的在测天，哪些只是在用历法，哪些什么都没有。
 *
 * ## 这一层要回答的问题
 *
 * 「四柱、紫微、六壬、塔罗、西洋占星有没有共同之处」这个问题，
 * 若从象征、哲学、心理层面去答，怎么答都行，也就等于没答。
 * 换一个**可以算的**问法：
 *
 * > 这套系统的输入里，有多少是真实天体的位置？
 *
 * 这个问题有确定答案，而且答案分得很开：有的系统的输入**就是**太阳黄经，
 * 有的只经由历法间接沾一点，有的一点都没有。
 *
 * ## 算出来的那条硬结论
 *
 * 二十四节气里的十二个**中气**，其定义黄经恰为 30° 的整数倍
 * （雨水 330°、春分 0°、谷雨 30°……）；而西方回归黄道十二宫的入宫点，
 * 定义也正是 30° 的整数倍（白羊 0°、金牛 30°……）。
 *
 * **它们是同一组时刻。** 不是「相似」，不是「对应」，是同一个量的同一组刻度 ——
 * 由 {@link zodiacVsZhongqi} 逐格验证，误差为零（因为两者是同一个定义）。
 *
 * 而十二个**节**（立春 315°、惊蛰 345°……）落在这些刻度的**正中间**，
 * 偏移恰好 15°。四柱的月建由节划分，故：
 *
 * ```
 * 中气 / 入宫点   0°  30°  60°  …     ← 六壬的月将也换在这里
 * 节 / 月建界    15°  45°  75°  …     ← 四柱的月柱换在这里
 * ```
 *
 * 两套格子同样大，错开半格。**四柱与西洋占星在月这一层用的是同一把尺，
 * 只是零点差了 15°。** 这件事与任何象征体系无关，是定义的直接后果。
 *
 * ## 岁差：同一把尺，两种零点
 *
 * 西方分回归（tropical）与恒星（sidereal）两派：前者以春分点为 0°，
 * 后者以某颗恒星为锚。春分点因岁差每年西移约 50.3″，两者因此逐年拉开，
 * 当代差约 24°（见 {@link ayanamsaAt}）。
 *
 * 中土的二十四节气**是回归的** —— 它按太阳黄经定义，而黄经以春分点起算。
 * 故四柱、六壬、紫微的历法基底与西方的回归派同源，与恒星派不同源。
 * 这不是立场问题，是定义问题。
 */

import { apparentSolarLongitude, type SolarLongitudeProvider } from "../astro/sun.js";
import { vsop87 } from "../astro/vsop87.js";
import { lunarPosition } from "../astro/moon.js";
import { norm360 } from "../astro/angles.js";
import { SOLAR_TERMS } from "../astro/solarTerms.js";
import type { JulianDayTT } from "../astro/julian.js";

/**
 * 西方回归黄道十二宫，自白羊起，各占 30°。
 *
 * 叫 `TROPICAL_SIGNS` 而不是 `ZODIAC`：后者在 `ganzhi/tables.ts` 里已经是
 * **生肖**（子鼠丑牛）。两者在英文里都叫 zodiac，却是完全不同的两套东西 ——
 * 生肖是十二地支的动物别名，与黄道位置无关；这里这十二个才是黄道上的分段。
 * 重名会让这个区别消失，而这个区别正是本模块要讲的事情之一。
 */
export const TROPICAL_SIGNS: readonly { readonly name: string; readonly nameEn: string; readonly from: number }[] =
  Object.freeze([
    { name: "白羊", nameEn: "Aries", from: 0 },
    { name: "金牛", nameEn: "Taurus", from: 30 },
    { name: "双子", nameEn: "Gemini", from: 60 },
    { name: "巨蟹", nameEn: "Cancer", from: 90 },
    { name: "狮子", nameEn: "Leo", from: 120 },
    { name: "处女", nameEn: "Virgo", from: 150 },
    { name: "天秤", nameEn: "Libra", from: 180 },
    { name: "天蝎", nameEn: "Scorpio", from: 210 },
    { name: "射手", nameEn: "Sagittarius", from: 240 },
    { name: "摩羯", nameEn: "Capricorn", from: 270 },
    { name: "水瓶", nameEn: "Aquarius", from: 300 },
    { name: "双鱼", nameEn: "Pisces", from: 330 },
  ]);

/** 黄经 → 宫。 */
export const signOf = (lonDeg: number): (typeof TROPICAL_SIGNS)[number] =>
  TROPICAL_SIGNS[Math.floor(norm360(lonDeg) / 30)]!;

export interface GridRow {
  /** 定义黄经。 */
  readonly longitude: number;
  /** 该黄经上的中气名；非 30° 整数倍时为 null。 */
  readonly zhongqi: string | null;
  /** 该黄经上的节名；非「30k+15」时为 null。 */
  readonly jie: string | null;
  /** 该黄经若为入宫点，入的是哪一宫。 */
  readonly zodiacIngress: string | null;
}

/**
 * 把二十四节气与十二宫摆在同一条黄经轴上，逐格对照。
 *
 * 返回 24 行，每行一个 15° 刻度。**这张表就是那条结论本身** ——
 * 凡有中气的行必有入宫点，凡有节的行必无入宫点，无一例外。
 */
export function zodiacVsZhongqi(): readonly GridRow[] {
  const rows: GridRow[] = [];
  for (let k = 0; k < 24; k++) {
    const lon = k * 15;
    const term = SOLAR_TERMS.find((t) => t.longitude === lon);
    rows.push({
      longitude: lon,
      zhongqi: term?.kind === "气" ? term.name : null,
      jie: term?.kind === "节" ? term.name : null,
      zodiacIngress: lon % 30 === 0 ? TROPICAL_SIGNS.find((z) => z.from === lon)!.name : null,
    });
  }
  return Object.freeze(rows);
}

/**
 * 六壬的月将 → 太阳所在之宫。
 *
 * 月将每中气一换，而中气即入宫点，故**月将与太阳星座是同一件事的两种记法**：
 * 太阳进入双鱼（黄经 330°，雨水）时月将为亥（登明），之后地支逆行。
 *
 * 「逆行」这件事本身也有来历：月将是**太阳在天盘上的位置**，
 * 而天盘随天左旋、地盘不动，故自地上看去，太阳每月退一宫。
 */
export const YUEJIANG_ZODIAC: readonly { readonly branch: string; readonly zodiac: string }[] =
  Object.freeze([
    { branch: "亥", zodiac: "双鱼" }, { branch: "戌", zodiac: "白羊" },
    { branch: "酉", zodiac: "金牛" }, { branch: "申", zodiac: "双子" },
    { branch: "未", zodiac: "巨蟹" }, { branch: "午", zodiac: "狮子" },
    { branch: "巳", zodiac: "处女" }, { branch: "辰", zodiac: "天秤" },
    { branch: "卯", zodiac: "天蝎" }, { branch: "寅", zodiac: "射手" },
    { branch: "丑", zodiac: "摩羯" }, { branch: "子", zodiac: "水瓶" },
  ]);

// ─────────────────────────────────────────────────────────
// 岁差
// ─────────────────────────────────────────────────────────

/**
 * 自 J2000 起累积的黄道总岁差，单位度。
 *
 * 取 IAU 2006 的 `p_A` 前两项：`5028.796195″·T + 1.1054348″·T²`，
 * T 为自 J2000 的儒略世纪。截断在二次项 —— 三次项在 ±2000 年内
 * 不足 0.01°，而本模块的用处是看量级与趋势，不是做星历。
 */
export function precessionSinceJ2000(jdTT: JulianDayTT): number {
  const T = (jdTT - 2451545.0) / 36525;
  return (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

/** 岁差的当代速率，度/年。 */
export const PRECESSION_DEG_PER_YEAR = 5028.796195 / 3600 / 100;

/**
 * 回归黄道与恒星黄道的夹角（ayanamsa），单位度。
 *
 * 各派恒星黄道的差别**只在零点的选择**：取某个历元上两者重合，
 * 此后的夹角就是自那时累积的岁差。故此处把零点作为参数，不替人选。
 *
 * 常见的 Lahiri（印度官方）零点约在公元 285 年前后；代入可得
 * 当代约 24.1°–24.3°，与各星历软件给出的值相符 —— 这正好反过来
 * 说明这套算法没有跑偏。
 */
export function ayanamsaAt(jdTT: JulianDayTT, zeroEpochJdTT: JulianDayTT): number {
  return precessionSinceJ2000(jdTT) - precessionSinceJ2000(zeroEpochJdTT);
}

/** 公元 285 年春分前后 —— Lahiri 一派常用的恒星黄道零点，置于此处仅作示例。 */
export const LAHIRI_ZERO_EPOCH_JD: JulianDayTT = 1825000.0 as JulianDayTT;

// ─────────────────────────────────────────────────────────
// 一个时刻的天文量
// ─────────────────────────────────────────────────────────

export interface SkyAt {
  readonly jdTT: JulianDayTT;
  /** 太阳视黄经。四柱的节气、六壬的月将、西洋的太阳星座都只是它的刻度。 */
  readonly solarLongitude: number;
  readonly zodiac: string;
  readonly zodiacEn: string;
  /** 太阳所在的那个 30° 格里，走了多少度。 */
  readonly degreeInSign: number;
  /** 月亮视黄经。 */
  readonly lunarLongitude: number;
  /** 日月角距 —— 月相。0 为朔，180 为望。农历的月序由它定。 */
  readonly elongation: number;
  /** 自 J2000 累积的岁差。 */
  readonly precession: number;
}

export function skyAt(
  jdTT: JulianDayTT, provider: SolarLongitudeProvider = vsop87,
): SkyAt {
  const sun = norm360(apparentSolarLongitude(jdTT, provider));
  const moon = norm360(lunarPosition(jdTT).apparentLongitude);
  const z = signOf(sun);
  return {
    jdTT,
    solarLongitude: sun,
    zodiac: z.name,
    zodiacEn: z.nameEn,
    degreeInSign: sun - z.from < 0 ? sun - z.from + 360 : sun - z.from,
    lunarLongitude: moon,
    elongation: norm360(moon - sun),
    precession: precessionSinceJ2000(jdTT),
  };
}

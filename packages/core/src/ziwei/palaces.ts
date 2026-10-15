/**
 * 紫微斗数的十二宫与五行局 —— 一套**不查星历**的起法。
 *
 * ## 先说这一套最容易被说错的地方
 *
 * 紫微斗数的「星」—— 紫微、天府、贪狼、廉贞 —— **不是天上的星**。
 * 它们是按**农历日与时辰的算术规则**摆进十二宫的**虚星**。
 * 真正的紫微垣（北极一带的星官）一次都不进计算。
 *
 * 这不是贬低。虚星体系自有其一致性，而且完全可复算 ——
 * 问题只在于把它说成「观星」是归错了档
 * （见《测天，还是约定》[第 2 章](../../../book-compare/02-天文含量.md)）。
 *
 * 本模块把这件事做实：**整张盘由四个整数加性别推出** ——
 * 农历年干支、农历月、农历日、时辰。不查星历，不看节气，不要地点。
 * 那个「不要地点」尤其值得对照：隔壁的星盘要经纬度，四柱要经度，
 * 紫微一个都不要。
 *
 * ## 农历那一层仍然是实测的
 *
 * 要当心别把结论推过头：紫微**自己**不算天象，但它吃的农历是实测的 ——
 * 定朔要真算合朔，置闰要看中气。所以它落在「历法派生」这一档，
 * 不是「纯约定」那一档（那一档只有塔罗）。
 *
 * ## ⚠️ 本模块的表全部凭记忆转录
 *
 * 与《穷通宝鉴》120 格、埃及界 60 条同一类数据风险。
 * 结构性检查（十二宫不重不漏、紫微天府关于寅申轴对称、五行局只有五种）
 * 挡得住机械错误，**挡不住把某一颗星的偏移记错一位**。
 * 已列入 `ZIWEI_PENDING_CALIBRATION`。
 */

import { BRANCHES, STEMS, type Branch, type Stem } from "../types/ganzhi.js";
import { NAYIN } from "../ganzhi/tables.js";
import { monthStemOf } from "../ganzhi/algebra.js";

/** 十二宫，自命宫起**逆行**。次序各家一致。 */
export const PALACE_NAMES: readonly string[] = Object.freeze([
  "命宫", "兄弟", "夫妻", "子女", "财帛", "疾厄",
  "迁移", "交友", "官禄", "田宅", "福德", "父母",
]);

export interface ZiweiPalaceLayout {
  /** 命宫的地支下标，0 = 子。 */
  readonly mingIndex: number;
  /** 身宫的地支下标。身宫不另占一宫，它与某一宫重合。 */
  readonly shenIndex: number;
  /** 十二宫名按地支下标排列：`palaceAt[i]` 是地支 i 上的宫名。 */
  readonly palaceAt: readonly string[];
}

/**
 * 命宫、身宫与十二宫的落位。
 *
 * **命宫**：自寅起正月，顺数至生月；再自该宫起子时，**逆**数至生时。
 * **身宫**：同样起算，但**顺**数至生时。
 *
 * 两者的分别只在最后一步的方向 —— 子时生人命身同宫，正是这个缘故。
 *
 * @param lunarMonth 农历月 1–12。闰月按本月论（各家一致）。
 * @param hourBranch 时辰 0–11，0 为子时。
 */
export function palaceLayout(lunarMonth: number, hourBranch: number): ZiweiPalaceLayout {
  if (!Number.isInteger(lunarMonth) || lunarMonth < 1 || lunarMonth > 12) {
    throw new Error(`农历月越界：${lunarMonth}`);
  }
  if (!Number.isInteger(hourBranch) || hourBranch < 0 || hourBranch > 11) {
    throw new Error(`时辰越界：${hourBranch}`);
  }
  const monthPalace = (2 + (lunarMonth - 1)) % 12;          // 寅 的下标是 2
  const mingIndex = (((monthPalace - hourBranch) % 12) + 12) % 12;
  const shenIndex = (monthPalace + hourBranch) % 12;

  // 自命宫**逆行**安十二宫
  const palaceAt = new Array<string>(12);
  for (let k = 0; k < 12; k++) {
    palaceAt[(((mingIndex - k) % 12) + 12) % 12] = PALACE_NAMES[k]!;
  }
  return { mingIndex, shenIndex, palaceAt: Object.freeze(palaceAt) };
}

/**
 * 五行局 —— 由**命宫的干支纳音**定。
 *
 * 命宫的天干由年干起五虎遁（与四柱的月干同一条规则，故此处直接复用
 * `monthStemOf`，不另写一份）；地支即命宫所在。
 * 取该干支的纳音五行，得水二、木三、金四、土五、火六。
 *
 * 局数的用处只有一个：定紫微星的落点。它不参与别的判断。
 */
export type Bureau = "水二局" | "木三局" | "金四局" | "土五局" | "火六局";

const NAYIN_BUREAU: Readonly<Record<string, Bureau>> = Object.freeze({
  水: "水二局", 木: "木三局", 金: "金四局", 土: "土五局", 火: "火六局",
});

export const BUREAU_NUMBER: Readonly<Record<Bureau, number>> = Object.freeze({
  水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6,
});

export interface BureauResult {
  readonly bureau: Bureau;
  readonly number: number;
  /** 命宫干支 —— 随结果带出，便于核对。 */
  readonly mingStem: string;
  readonly mingBranch: string;
  readonly nayin: string;
}

export function bureauOf(yearStem: Stem, mingIndex: number): BureauResult {
  const mingBranch = BRANCHES[mingIndex]!;
  const mingStem = monthStemOf(yearStem, mingBranch);
  // 纳音按六十甲子每两位共用一名，故下标取干支序 ÷ 2
  const si = STEMS.indexOf(mingStem);
  const bi = BRANCHES.indexOf(mingBranch as Branch);
  const sexagenary = sexagenaryIndex(si, bi);
  const nayin = NAYIN[Math.floor(sexagenary / 2)]!;
  const element = nayin.slice(-1);
  const bureau = NAYIN_BUREAU[element];
  if (bureau === undefined) {
    throw new Error(`纳音「${nayin}」的五行「${element}」不在五局之内`);
  }
  return { bureau, number: BUREAU_NUMBER[bureau], mingStem, mingBranch, nayin };
}

/**
 * 由干支下标求六十甲子序（0–59）。
 *
 * 干十支十二，最小公倍数六十。解同余：i ≡ si (mod 10)，i ≡ bi (mod 12)。
 * 只有当 si 与 bi 同奇偶时才有解 —— 而五虎遁给出的干支必然同奇偶，
 * 故此处无解即说明上游出了问题，抛错而不是返回一个凑合的数。
 */
function sexagenaryIndex(si: number, bi: number): number {
  for (let i = 0; i < 60; i++) {
    if (i % 10 === si && i % 12 === bi) return i;
  }
  throw new Error(`干支组合不合法：干 ${si}、支 ${bi}（干支必须同奇偶）`);
}

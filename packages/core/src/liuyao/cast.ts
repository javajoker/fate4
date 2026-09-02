/**
 * Q0 起卦 —— 三法。
 *
 * ## 卦属于「时刻」，不属于「人」
 *
 * 按时起卦的输入只有时刻，于是**同一时辰内所有人问所有事得到同一个卦**。
 * 这是该方法的前提，不是它的漏洞：卦象属于那个「应机」的时刻本身，
 * 同一时刻的不同问题靠**取不同的用神**区分（问财取妻财、问职取官鬼）。
 *
 * 曾经想过把问题文本哈希进起卦以求区分 —— 那是发明一种传统里没有的方法，
 * 还伪装成传统。不做。要真正区分，用报数或掷钱。
 *
 * ## 三法的结构差异要紧
 *
 * | 法 | 动爻个数 |
 * | `time` | **恒为一个** |
 * | `number` | **恒为一个** |
 * | `coin` | **0 到 6 个** |
 *
 * 只按「恒一个动爻」实现断卦，会在掷钱法上直接塌掉。故 `moving` 一律是数组，
 * 空数组是合法状态（六爻皆静，传统称静卦，自有其断法）。
 *
 * ## ⚠️ 单数报数起卦在一个时辰内只有八个卦
 *
 * 单数法的算式是 `上卦 = n mod 8`、`下卦 = (n + 时支数) mod 8`、`动爻 = (n + 时支数) mod 6`。
 * 时支在一个时辰内固定，于是三者**全部由 `n` 单独决定**：
 *
 * - 下卦被上卦完全决定 → 一个时辰内至多**八个本卦**
 * - 动爻位也由 n 决定，而 `n mod 8` 与 `n mod 6` 并不独立 ——
 *   周期是 `lcm(8, 6) = 24`，故一个时辰内**总共只有 24 种结果**，
 *   而非 64 × 6 = 384 种，也不是「8 × 6 = 48」那么多
 *
 * 初稿的注释写的正是 48，实测才是 24 —— 两个模数不互素这件事很容易漏掉。
 *
 * 这是该公式本身的性质，不是实现的疏漏，故不掩盖。要全覆盖，用**两数起卦**
 * （上卦数、下卦数各报一个，亦是梅花本法）或掷钱法。
 *
 * ## 按时起卦的年，取哪条年界
 *
 * 公式其余部分（月、日）全在农历口径，故默认取**农历年**的地支（正月初一为界）。
 * 另一说取立春年，与四柱同界。两说在正月初一与立春之间的那几周里给出不同的卦 ——
 * 进参数 `liuyao.timeCast.yearBoundary`，随卦声明。
 */

import { BRANCHES, type Branch, type Pillar } from "../types/ganzhi.js";
import { branchIndex, mod } from "../ganzhi/algebra.js";
import { trigramByXiantian, type Yao } from "../yijing/trigrams.js";
import { composeHexagram, hexagramOf, type Hexagram } from "../yijing/hexagrams.js";
import type { LiuyaoParams } from "../params/types.js";
import type { LunarDate } from "../chart/lunar.js";

export type CastMethod = "time" | "number" | "coin";

/** 三枚铜钱中的阳面数，0–3。 */
export type CoinThrow = 0 | 1 | 2 | 3;

export interface CastMoment {
  /** 起卦时刻的四柱。月建取月柱，日辰取日柱 —— 断卦的两个主宰。 */
  readonly pillars: {
    readonly year: Pillar; readonly month: Pillar;
    readonly day: Pillar; readonly hour: Pillar;
  };
  readonly lunar: LunarDate;
  /** 立春年的地支 —— `yearBoundary: "lichun"` 时用它。 */
  readonly lichunYearBranch: Branch;
}

export type CastInput =
  | { readonly method: "time" }
  | {
    readonly method: "number";
    readonly value: number;
    /** 第二个数。给了则为两数起卦：上卦取 value、下卦取 second。见模块头。 */
    readonly second?: number;
  }
  | {
    readonly method: "coin";
    readonly throws: readonly [CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow];
  };

export interface Casting {
  readonly method: CastMethod;
  readonly moment: CastMoment;
  readonly input: CastInput;
  readonly benGua: Hexagram;
  /** 动爻下标（0 = 初爻），升序。**可以为空，也可以有多个。** */
  readonly moving: readonly number[];
  /** 无动爻时为 null —— 静卦无变卦。 */
  readonly bianGua: Hexagram | null;
  /** 起卦的算式，逐步写明。不可复算的卦等于没有卦。 */
  readonly derivation: readonly string[];
}

/** 地支序，子为 1。梅花起卦的年、时都用它。 */
const branchNumber = (b: Branch): number => branchIndex(b) + 1;

/** 余 0 取 8 / 取 6 —— 起卦法的通例。 */
const wrap = (n: number, m: number): number => (mod(n, m) === 0 ? m : mod(n, m));

/**
 * 掷钱的三枚阳面数 → 爻与动静。
 *
 * 少数决定爻性：一阳两阴为少阳，两阳一阴为少阴；三面同则为老，老者动。
 *
 * | 阳面数 | 名 | 爻 | 动 |
 * | 3 | 老阳（重） | ⚊ | ✓ 变阴 |
 * | 2 | 少阴（拆） | ⚋ | |
 * | 1 | 少阳（单） | ⚊ | |
 * | 0 | 老阴（交） | ⚋ | ✓ 变阳 |
 */
export function coinToYao(yangCount: CoinThrow): { yao: Yao; moving: boolean } {
  switch (yangCount) {
    case 3: return { yao: 1, moving: true };
    case 2: return { yao: 0, moving: false };
    case 1: return { yao: 1, moving: false };
    case 0: return { yao: 0, moving: true };
  }
}

function flipAt(h: Hexagram, idx: readonly number[]): Hexagram {
  const out = [...h] as Yao[];
  for (const i of idx) out[i] = (out[i] === 1 ? 0 : 1) as Yao;
  return out as unknown as Hexagram;
}

export class CastInputError extends Error {
  constructor(msg: string) { super(msg); this.name = "CastInputError"; }
}

/**
 * 农历年的地支 —— 即生肖之支。
 *
 * 公元 4 年为甲子年，故 `(year - 4) mod 12` 即地支序。
 */
export const lunarYearBranchOf = (lunarYear: number): Branch =>
  BRANCHES[mod(lunarYear - 4, 12)]!;

/**
 * 起卦。
 *
 * `p.castMethod` 决定用哪一法；`input` 须与之相符，不符即抛错 ——
 * 悄悄改用另一法，会让「同一输入同一卦」这条不再成立。
 */
export function cast(moment: CastMoment, input: CastInput, p: LiuyaoParams): Casting {
  if (input.method !== p.castMethod) {
    throw new CastInputError(
      `参数声明的起卦法是 ${p.castMethod}，而输入给的是 ${input.method}。`
      + "两者必须一致 —— 否则卦与它自称的来历对不上。",
    );
  }
  const derivation: string[] = [];

  if (input.method === "coin") {
    const parts = input.throws.map(coinToYao);
    const ben = parts.map((x) => x.yao) as unknown as Hexagram;
    const moving = parts.flatMap((x, i) => (x.moving ? [i] : []));
    const face = p.coin.yangFace === "back" ? "背" : "字";
    derivation.push(`掷钱六次，以${face}为阳。自初爻起阳面数 ${input.throws.join("、")}`);
    derivation.push(`得本卦 ${hexagramOf(ben).name}，动爻 ${
      moving.length === 0 ? "无（六爻皆静）" : moving.map((i) => `第${i + 1}爻`).join("、")}`);
    return {
      method: "coin", moment, input, benGua: ben, moving,
      bianGua: moving.length === 0 ? null : flipAt(ben, moving),
      derivation,
    };
  }

  const hourNum = branchNumber(moment.pillars.hour.branch);
  let upperN: number; let lowerN: number; let movingN: number;

  if (input.method === "time") {
    const yearBranch = p.timeCast.yearBoundary === "lichun"
      ? moment.lichunYearBranch
      : lunarYearBranchOf(moment.lunar.year);
    const y = branchNumber(yearBranch);
    const { month: lm, day: ld, isLeap } = moment.lunar;
    const base = y + lm + ld;
    upperN = wrap(base, 8);
    lowerN = wrap(base + hourNum, 8);
    movingN = wrap(base + hourNum, 6);
    derivation.push(
      `按时起卦：${p.timeCast.yearBoundary === "lichun" ? "立春年" : "农历年"}支 ${yearBranch}=${y}，`
      + `农历${isLeap ? "闰" : ""}${lm}月=${lm}，${ld}日=${ld}，时支 ${moment.pillars.hour.branch}=${hourNum}`);
    derivation.push(`上卦 (${y}+${lm}+${ld}) mod 8 = ${upperN}；`
      + `下卦 (${base}+${hourNum}) mod 8 = ${lowerN}；动爻 (${base}+${hourNum}) mod 6 = ${movingN}`);
  } else {
    const nums = input.second === undefined ? [input.value] : [input.value, input.second];
    for (const v of nums) {
      if (!Number.isInteger(v) || v <= 0) {
        throw new CastInputError(`报数须为正整数，得到 ${v}`);
      }
    }
    if (input.second === undefined) {
      upperN = wrap(input.value, 8);
      lowerN = wrap(input.value + hourNum, 8);
      movingN = wrap(input.value + hourNum, 6);
      derivation.push(`报数起卦（单数）：数 ${input.value}，时支 ${moment.pillars.hour.branch}=${hourNum}`);
      derivation.push(`上卦 ${input.value} mod 8 = ${upperN}；`
        + `下卦 (${input.value}+${hourNum}) mod 8 = ${lowerN}；动爻 同式 mod 6 = ${movingN}`);
      derivation.push("⚠️ 单数法在一个时辰内只生成八个本卦 —— 下卦由上卦完全决定。"
        + "要全覆盖请用两数起卦或掷钱。");
    } else {
      upperN = wrap(input.value, 8);
      lowerN = wrap(input.second, 8);
      movingN = wrap(input.value + input.second + hourNum, 6);
      derivation.push(`报数起卦（两数）：${input.value}、${input.second}，`
        + `时支 ${moment.pillars.hour.branch}=${hourNum}`);
      derivation.push(`上卦 ${input.value} mod 8 = ${upperN}；下卦 ${input.second} mod 8 = ${lowerN}；`
        + `动爻 (${input.value}+${input.second}+${hourNum}) mod 6 = ${movingN}`);
    }
  }

  const upper = trigramByXiantian(upperN);
  const lower = trigramByXiantian(lowerN);
  const ben = composeHexagram(lower.name, upper.name);
  const moving = [movingN - 1];
  derivation.push(`上卦 ${upper.name}、下卦 ${lower.name} → 本卦 ${hexagramOf(ben).name}，第 ${movingN} 爻动`);

  return {
    method: input.method, moment, input,
    benGua: ben, moving, bianGua: flipAt(ben, moving), derivation,
  };
}

/** 供报告：起卦法的名目与它借自哪一家。 */
export const CAST_METHOD_LABEL: Readonly<Record<CastMethod, string>> = Object.freeze({
  time: "按时起卦（梅花易数法）",
  number: "报数起卦（梅花易数法）",
  coin: "掷钱起卦（六爻本法）",
});

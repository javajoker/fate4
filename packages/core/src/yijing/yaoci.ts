/**
 * 爻辞语料的取用 —— 卦画 → 通行本序号 → 三种语言的四类文字。
 *
 * ## 两套卦序，一张桥
 *
 * 本项目的六十四卦按**京房八宫**生成（乾宫八卦、兑宫八卦……），因为断卦要用
 * 宫与世应；而爻辞语料按**通行本**编号（乾坤屯蒙需讼师比……），因为那是典籍
 * 的次序。两者之间只能靠一张对照。
 *
 * 桥不靠人转录：语料自带 {@link RECEIVED_BINARY}（六十四个卦画二进制串），
 * 照串查本项目自己生成的卦即可。另一份 {@link RECEIVED_NAMES}（卦名）纯属冗余，
 * 唯一的用处是**当场对质** —— 测试断言「照二进制查出来的卦，名字必须等于名单里
 * 那一个」。任一份搬错都会暴露；只搬一份则无从发觉。
 *
 * ## 四类文字，各有各的分寸
 *
 * | 类 | 是什么 | 谁写的 |
 * | `classic` | 卦辞、爻辞原文 | 《周易》，公有领域 |
 * | `gist`    | 一句话指事 | 语料作者的撰述 |
 * | `expand`  | 白话转述 | 语料作者的撰述 |
 * | `stage`   | 六个爻位各自的阶段 | 语料作者的撰述 |
 *
 * 后三类都是**转述**，不是经文。本模块只负责取出来，不判断能不能发 ——
 * 那是 `report/screen.ts` 的事，而它的答案在技术层与人话层并不相同。
 *
 * ## 爻位下标：0 是卦辞，1–6 才是爻
 *
 * 语料每卦占七格。原型项目在此处错了一位：动爻的 0 基下标直接当成格号用，
 * 于是初爻取到卦辞、上爻取到五爻，六爻全体错开一格。本模块把「卦辞」显式定为
 * {@link GUA_SLOT}，爻位一律用 1–6，类型上就不允许把两者混起来。
 */

import { en, zhHans, zhHant, RECEIVED_BINARY, RECEIVED_NAMES } from "@fate/data/yaoci";
import { hexagramOf, keyOf, type Hexagram, type HexagramInfo } from "./hexagrams.js";
import type { Yao } from "./trigrams.js";

/** 语料的每卦第 0 格：卦辞。 */
export const GUA_SLOT = 0;
/** 爻位 1–6，1 为初爻。 */
export type YaoPos = 1 | 2 | 3 | 4 | 5 | 6;
/** 语料的格号：0 为卦辞，1–6 为六爻。 */
export type YaociSlot = 0 | YaoPos;

export type YaociLocale = "zh-Hans" | "zh-Hant" | "en";

export interface YaociEntry {
  /** 通行本卦序 0–63。 */
  readonly received: number;
  readonly slot: YaociSlot;
  /** 《周易》原文。 */
  readonly classic: string;
  /** 一句话指事。卦辞格没有，为 null。 */
  readonly gist: string | null;
  /** 白话转述。 */
  readonly expand: string;
}

interface Pack {
  readonly CLASSIC: readonly string[];
  readonly GIST: readonly string[];
  readonly EXPAND: readonly string[];
  readonly STAGE: readonly string[];
}

const PACKS: Readonly<Record<YaociLocale, Pack>> = Object.freeze({
  "zh-Hans": zhHans, "zh-Hant": zhHant, en,
});

/** 二进制串 → 本项目的六爻数组，下标 0 为初爻。 */
export function parseReceived(bits: string): Hexagram {
  if (!/^[01]{6}$/.test(bits)) throw new Error(`非法卦画串 ${bits}`);
  return [...bits].map((c) => (c === "1" ? 1 : 0) as Yao) as unknown as Hexagram;
}

const RECEIVED_OF: ReadonlyMap<string, number> = new Map(
  RECEIVED_BINARY.map((b, i) => [keyOf(parseReceived(b)), i]),
);

/** 卦 → 通行本卦序 0–63。 */
export function receivedIndexOf(h: HexagramInfo): number {
  const i = RECEIVED_OF.get(keyOf(h.lines));
  if (i === undefined) throw new Error(`语料里查不到卦 ${h.name}`);
  return i;
}

/** 通行本第 i 卦 —— 供测试对质用。 */
export const receivedHexagram = (i: number): HexagramInfo =>
  hexagramOf(parseReceived(RECEIVED_BINARY[i] ?? ""));

/** 通行本第 i 卦的卦名（语料自带，简体）。 */
export const receivedName = (i: number): string => RECEIVED_NAMES[i] ?? "";

/** 按通行本卦序取一格。`slot` 为 0 时取卦辞。 */
export function yaociAt(
  received: number, slot: YaociSlot, locale: YaociLocale = "zh-Hans",
): YaociEntry {
  if (!Number.isInteger(received) || received < 0 || received > 63) {
    throw new Error(`通行本卦序越界：${received}`);
  }
  const k = received * 7 + slot;
  const p = PACKS[locale];
  const gist = p.GIST[k] ?? "";
  return {
    received, slot,
    classic: p.CLASSIC[k] ?? "",
    gist: slot === GUA_SLOT || gist === "" ? null : gist,
    expand: p.EXPAND[k] ?? "",
  };
}

/** 取一格。`slot` 为 0 时取卦辞。 */
export const yaociOf = (
  h: HexagramInfo, slot: YaociSlot, locale: YaociLocale = "zh-Hans",
): YaociEntry => yaociAt(receivedIndexOf(h), slot, locale);

/**
 * 爻位的阶段描述。
 *
 * 这一层说的是**位置本身**，与是哪一卦无关 —— 初爻恒为「刚接触」，
 * 上爻恒为「到了这个环境容得下的边上」。故六条通用，不随卦变。
 */
export const stageOf = (pos: YaoPos, locale: YaociLocale = "zh-Hans"): string =>
  PACKS[locale].STAGE[pos - 1] ?? "";

export { YAOCI_PROVENANCE } from "@fate/data/yaoci";

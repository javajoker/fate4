/**
 * 干支代数 —— 纯函数，无状态，无 I/O。
 *
 * 所有取模运算一律走 mod()，绝不用 % ——
 * JS 的 % 对负数返回负值，而干支推算中逆行、退位、跨旬随处产生负数。
 */

import {
  BRANCHES, STEMS,
  type ActingRelation, type Branch, type Element, type Polarity,
  type SexagenaryIndex, type Stem, type TenGod,
} from "../types/ganzhi.js";
import {
  BRANCH_ELEMENT, BRANCH_INDEX, BRANCH_POSITIONAL_POLARITY,
  CONTROLS, GENERATES, HIDDEN_SPLIT, HIDDEN_STEMS,
  NAYIN, STEM_ELEMENT, STEM_INDEX, STEM_POLARITY,
} from "./tables.js";
import type { HiddenStem } from "../types/ganzhi.js";

/** 恒返回 [0, m) 的取模。 */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

// ─────────────────────────────────────────────────────────
// 查表（缺失即抛，绝不静默返回 undefined）
// ─────────────────────────────────────────────────────────

export function stemIndex(s: Stem): number {
  const i = STEM_INDEX.get(s);
  if (i === undefined) throw new RangeError(`未知天干: ${s}`);
  return i;
}

export function branchIndex(b: Branch): number {
  const i = BRANCH_INDEX.get(b);
  if (i === undefined) throw new RangeError(`未知地支: ${b}`);
  return i;
}

export function stemAt(i: number): Stem {
  return STEMS[mod(i, 10)]!;
}

export function branchAt(i: number): Branch {
  return BRANCHES[mod(i, 12)]!;
}

export function elementOf(s: Stem): Element {
  return STEM_ELEMENT[s];
}

export function polarityOf(s: Stem): Polarity {
  return STEM_POLARITY[s];
}

/** 地支本气五行。 */
export function branchElement(b: Branch): Element {
  return BRANCH_ELEMENT[b];
}

/**
 * 地支的**气阴阳** —— 取本气藏干的阴阳，而非序位阴阳。
 * 子午巳亥四支二者不一致（体阴用阳）。生克与十神一律用此。
 */
export function branchQiPolarity(b: Branch): Polarity {
  return polarityOf(HIDDEN_STEMS[b][0]!);
}

/** 地支的**位阴阳** —— 序位偶数为阳。仅用于长生排布与部分神煞起例。 */
export function branchPositionalPolarity(b: Branch): Polarity {
  return BRANCH_POSITIONAL_POLARITY[b];
}

// ─────────────────────────────────────────────────────────
// 步进
// ─────────────────────────────────────────────────────────

export function stepStem(s: Stem, n: number): Stem {
  return stemAt(stemIndex(s) + n);
}

export function stepBranch(b: Branch, n: number): Branch {
  return branchAt(branchIndex(b) + n);
}

// ─────────────────────────────────────────────────────────
// 五行关系
// ─────────────────────────────────────────────────────────

/** a 生 b ？ */
export function generates(a: Element, b: Element): boolean {
  return GENERATES[a] === b;
}

/** a 克 b ？ */
export function controls(a: Element, b: Element): boolean {
  return CONTROLS[a] === b;
}

/**
 * 载体 i 施于载体 j 的作用关系（有向）。
 *
 * `无` 表示 i 在此方向不施力（j 生 i 或 j 克 i），其作用由 (j, i) 方向计入。
 * 在同一方向同时计入正反两种作用，是这类实现最常见的重复计数 bug。
 */
export function actingRelation(i: Element, j: Element): ActingRelation {
  if (i === j) return "同";
  if (generates(i, j)) return "生";
  if (controls(i, j)) return "克";
  return "无";
}

// ─────────────────────────────────────────────────────────
// 十神
//
// 不变量：对任一日主，10 个天干恰好一一映射到 10 个十神。
// ─────────────────────────────────────────────────────────

export function tenGod(dayMaster: Stem, target: Stem): TenGod {
  const dmEl = elementOf(dayMaster);
  const dmPol = polarityOf(dayMaster);
  const el = elementOf(target);
  const same = polarityOf(target) === dmPol;

  if (el === dmEl) return same ? "比肩" : "劫财";
  if (generates(dmEl, el)) return same ? "食神" : "伤官";
  if (controls(dmEl, el)) return same ? "偏财" : "正财";
  if (controls(el, dmEl)) return same ? "七杀" : "正官";
  if (generates(el, dmEl)) return same ? "偏印" : "正印";
  /* istanbul ignore next —— 五行关系已穷尽，此处不可达 */
  throw new Error(`无法定十神: 日主 ${dayMaster} 对 ${target}`);
}

/** 同党：比劫 + 印星（不含日主自身，日主权重单列）。 */
export const SUPPORTING_GODS: readonly TenGod[] = Object.freeze(
  ["比肩", "劫财", "正印", "偏印"] as const,
);

/** 异党：食伤 + 财 + 官杀。 */
export const OPPOSING_GODS: readonly TenGod[] = Object.freeze(
  ["食神", "伤官", "正财", "偏财", "正官", "七杀"] as const,
);

// ─────────────────────────────────────────────────────────
// 藏干
// ─────────────────────────────────────────────────────────

export function hiddenStemsOf(b: Branch): readonly HiddenStem[] {
  const stems = HIDDEN_STEMS[b];
  const count = stems.length as 1 | 2 | 3;
  const shares = HIDDEN_SPLIT[count];
  return stems.map((stem, i) => ({
    stem,
    role: (["本气", "中气", "余气"] as const)[i]!,
    share: shares[i]!,
  }));
}

// ─────────────────────────────────────────────────────────
// 六十甲子
//
// 序号 n → 天干 n mod 10、地支 n mod 12。
// 反解用中国剩余定理：n = (6·si − 5·bi) mod 60，仅当 si ≡ bi (mod 2) 时有解。
// ─────────────────────────────────────────────────────────

export function sexagenaryAt(n: SexagenaryIndex): { stem: Stem; branch: Branch } {
  const i = mod(n, 60);
  return { stem: stemAt(i), branch: branchAt(i) };
}

/** 干支组合是否合法（须同为阳位或同为阴位）。 */
export function isValidPair(stem: Stem, branch: Branch): boolean {
  return mod(stemIndex(stem) - branchIndex(branch), 2) === 0;
}

/** 反解六十甲子序号；组合非法时抛错。 */
export function sexagenaryIndexOf(stem: Stem, branch: Branch): SexagenaryIndex {
  if (!isValidPair(stem, branch)) {
    throw new RangeError(`${stem}${branch} 不是合法的六十甲子组合（阴阳不配）`);
  }
  return mod(6 * stemIndex(stem) - 5 * branchIndex(branch), 60);
}

export function nayinOf(n: SexagenaryIndex): string {
  return NAYIN[Math.floor(mod(n, 60) / 2)]!;
}

// ─────────────────────────────────────────────────────────
// 旬与空亡
// ─────────────────────────────────────────────────────────

/** 所属旬的起始序号（甲子=0、甲戌=10 …）。 */
export function xunStartOf(n: SexagenaryIndex): SexagenaryIndex {
  const i = mod(n, 60);
  return i - (i % 10);
}

/**
 * 旬空二支。
 * 一旬十位配十干，地支多出两位无干可配，即为空亡。
 */
export function xunKongOf(n: SexagenaryIndex): readonly [Branch, Branch] {
  const startBranch = mod(xunStartOf(n), 12);
  return [branchAt(startBranch + 10), branchAt(startBranch + 11)];
}

// ─────────────────────────────────────────────────────────
// 五虎遁 / 五鼠遁
//
// 二者同源：某柱的干支序列在六十甲子上连续推进，
// 起点由上一级的天干决定，周期 5（因 10 干与 12 支的最小公倍关系）。
// ─────────────────────────────────────────────────────────

/**
 * 五虎遁（年上起月）：由年干定寅月天干。
 *   甲己之年丙作首，乙庚之岁戊为头，丙辛必定寻庚起，
 *   丁壬壬位顺行流，戊癸之年何处觅，甲寅之上好追求。
 */
export function yinMonthStemOf(yearStem: Stem): Stem {
  return stemAt((stemIndex(yearStem) % 5) * 2 + 2);
}

/** 由年干与月支定月干。月支须为节气月（寅月起）。 */
export function monthStemOf(yearStem: Stem, monthBranch: Branch): Stem {
  const offset = mod(branchIndex(monthBranch) - branchIndex("寅"), 12);
  return stepStem(yinMonthStemOf(yearStem), offset);
}

/**
 * 五鼠遁（日上起时）：由日干定子时天干。
 *   甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途。
 */
export function ziHourStemOf(dayStem: Stem): Stem {
  return stemAt((stemIndex(dayStem) % 5) * 2);
}

/** 由日干与时支定时干。 */
export function hourStemOf(dayStem: Stem, hourBranch: Branch): Stem {
  return stepStem(ziHourStemOf(dayStem), branchIndex(hourBranch));
}

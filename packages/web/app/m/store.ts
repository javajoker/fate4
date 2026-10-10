"use client";

import type { Audience, BirthInput } from "@fate/core";

/**
 * 移动版只记一份出生信息，存在本机。
 *
 * 桌面版用 IndexedDB 存多张盘；移动版是「看自己」的应用，一份就够。
 * **不上传、不同步** —— 与全站同一条隐私纪律。
 */
const KEY = "fate.m.birth.v1";

export function loadBirth(): BirthInput | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : (JSON.parse(raw) as BirthInput);
  } catch { return null; }
}

export function saveBirth(b: BirthInput): void {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* 隐私模式下写不进，无妨 */ }
}

export function clearBirth(): void {
  try { localStorage.removeItem(KEY); } catch { /* 同上 */ }
}

export const CITIES: readonly (readonly [string, string, number])[] = [
  ["上海", "Asia/Shanghai", 121.47], ["北京", "Asia/Shanghai", 116.41],
  ["广州", "Asia/Shanghai", 113.26], ["深圳", "Asia/Shanghai", 114.06],
  ["成都", "Asia/Shanghai", 104.07], ["西安", "Asia/Shanghai", 108.95],
  ["台北", "Asia/Taipei", 121.56], ["香港", "Asia/Hong_Kong", 114.17],
  ["新加坡", "Asia/Singapore", 103.82],
];

/**
 * 人话由谁生成。
 *
 * `code`（默认）：走 `plainCards` 的定值映射 —— 判定枚举查表，
 * 过人话守卫，逐条挂着技术依据。**全部在本机完成。**
 *
 * `ai`：交给 `bazi-plain` Skill 转述。它读得懂上下文，措辞更活，
 * 但它是**语言模型**，不是查表 —— 同一份判定两次转述未必一字不差。
 *
 * ⚠️ **AI 档不会自动把数据送出去。** 本站是纯静态、生辰数据不出本机；
 * 若在浏览器里直连模型接口，等于把出生信息发给第三方，与全站的隐私纪律相反。
 * 故 AI 档只把**技术报告**导出成一段可复制的文本，由你自己交给 Skill ——
 * 送不送、送给谁，是你的决定，不是这个应用替你做的。
 */
export type PlainSource = "code" | "ai";

const SRC_KEY = "fate.m.plainSource.v1";

export function loadPlainSource(): PlainSource {
  try {
    return localStorage.getItem(SRC_KEY) === "ai" ? "ai" : "code";
  } catch { return "code"; }
}

export function savePlainSource(v: PlainSource): void {
  try { localStorage.setItem(SRC_KEY, v); } catch { /* 同上 */ }
}

/**
 * 读者档。
 *
 * **它控制披露，不控制断言** —— 措辞守卫在三档下完全相同，
 * 见 `packages/core/src/report/audience.ts`。
 *
 * 默认取最严的 `lay`：反过来（默认全给、让人自己关）等于默认把最容易
 * 被读成预告的东西端出去。
 */
const AUD_KEY = "fate.m.audience.v1";

export function loadAudience(): Audience {
  try {
    const v = localStorage.getItem(AUD_KEY);
    return v === "student" || v === "practitioner" ? v : "lay";
  } catch { return "lay"; }
}

export function saveAudience(v: Audience): void {
  try { localStorage.setItem(AUD_KEY, v); } catch { /* 同上 */ }
}

// ─────────────────────────────────────────────────────────
// 回看的标注 —— 见 docs/15-engagement.md
// ─────────────────────────────────────────────────────────

export type Verdict = "hit" | "miss" | "unclear";

export interface Mark {
  /** 标的是哪一年，或哪一次问事的指纹。 */
  readonly key: string;
  readonly kind: "year" | "question";
  readonly verdict: Verdict;
  /** 模型当时给的置信度。汇总时按它分栏 —— 合成一个总数会抹掉最有意思的差别。 */
  readonly confidence: number;
  readonly at: string;
}

const MARK_KEY = "fate.m.marks.v1";

export function loadMarks(): Mark[] {
  try {
    const raw = localStorage.getItem(MARK_KEY);
    return raw === null ? [] : (JSON.parse(raw) as Mark[]);
  } catch { return []; }
}

/** 同一个 key 只留最后一次标注 —— 允许改主意，但不重复计数。 */
export function saveMark(m: Mark): Mark[] {
  const next = [...loadMarks().filter((x) => x.key !== m.key), m];
  try { localStorage.setItem(MARK_KEY, JSON.stringify(next)); } catch { /* 同上 */ }
  return next;
}

export function clearMarks(): void {
  try { localStorage.removeItem(MARK_KEY); } catch { /* 同上 */ }
}

/**
 * 样本量的门槛。
 *
 * 低于此数**不出百分数** —— 七次里中四次，在完全随机时也一点都不稀奇，
 * 把它写成 57% 会让一个说明不了什么的数字看起来像统计量。
 */
export const ENOUGH = 30;

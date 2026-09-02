/**
 * 一事不二占 —— 同一问题在同一日内只起一次卦。
 *
 * ## 为什么这是工程问题而不只是礼节
 *
 * 传统说「不诚不占、不疑不占、一事不二占」。工程上它有一个更硬的理由：
 * **允许重掷，等于允许用户一直摇到满意为止。** 那样得到的不是占卜，是筛选 ——
 * 而筛选出来的结果看起来仍像是卦给的。
 *
 * 故首卦一经落定即为该问题当日的答案。再问，返回首卦，并明确告知这是首卦。
 *
 * ## 只存哈希，不存原文
 *
 * 记录里没有问题的文本，只有它的指纹。与生辰数据同一条隐私纪律 ——
 * 一份能被翻出来的问卜日记，泄露的东西比生辰多得多。
 * 指纹取 SHA-256 的前 16 个十六进制字符：碰撞概率足够低，而它短到可以印在报告上。
 */

import { createHash } from "node:crypto";
import type { CastInput } from "@fate/core";
import type { Io } from "./io.js";

export interface JournalEntry {
  /** 起卦时刻的日干支 —— 键的一部分，也便于人肉核对。 */
  readonly dayGanzhi: string;
  readonly topicId: string;
  readonly questionFingerprint: string;
  /** 起卦时刻，本地钟表时。重放时原样喂回去，故所得卦逐字相同。 */
  readonly at: {
    readonly year: number; readonly month: number; readonly day: number;
    readonly hour: number; readonly minute: number;
    readonly timeZone: string; readonly longitude: number;
  };
  readonly input: CastInput;
  /** 首次落定的时刻，ISO 串。只作记录，不参与起卦。 */
  readonly recordedAt: string;
}

export interface Journal {
  readonly version: 1;
  readonly entries: readonly JournalEntry[];
}

/** 问题文本 → 指纹。**文本不出此函数。** */
export const fingerprintOf = (question: string): string =>
  createHash("sha256").update(question.normalize("NFKC").trim()).digest("hex").slice(0, 16);

export const keyOf = (e: {
  dayGanzhi: string; topicId: string; questionFingerprint: string;
}): string => `${e.dayGanzhi}|${e.topicId}|${e.questionFingerprint}`;

export function readJournal(io: Io, path: string): Journal {
  let raw: string;
  try { raw = io.readFile(path); } catch { return { version: 1, entries: [] }; }
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    throw new Error(`问卜记录 ${path} 不是合法的 JSON。宁可报错也不覆盖 —— `
      + "一事不二占的记录一旦被悄悄重置，重掷就防不住了。");
  }
  const j = parsed as Partial<Journal>;
  if (j.version !== 1 || !Array.isArray(j.entries)) {
    throw new Error(`问卜记录 ${path} 的格式不认识（version=${String(j.version)}）。`);
  }
  return { version: 1, entries: j.entries };
}

export function findEntry(j: Journal, key: string): JournalEntry | null {
  return j.entries.find((e) => keyOf(e) === key) ?? null;
}

export function appendEntry(io: Io, path: string, j: Journal, e: JournalEntry): void {
  io.writeFile(path, `${JSON.stringify({ version: 1, entries: [...j.entries, e] }, null, 2)}\n`);
}

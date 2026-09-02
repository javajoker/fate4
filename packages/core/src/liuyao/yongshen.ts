/**
 * Q2 定用神 —— 含多现取舍与伏藏。
 *
 * ## 两个必须处理的局面
 *
 * **用神多现**：同一六亲出现在多个爻。取舍次序各家一致度较高：
 * 动爻 > 临世应 > 不取空破 > 与日月有关系 > 就近于世爻。
 * **定不下来时两存**，与四柱的做法一致 —— 藏起来一个答案不叫定夺。
 *
 * **用神不上卦**：六爻只有六位而六亲有五类，缺类是常态（实测 64 卦中十余卦不全）。
 * 此时取伏神。伏神不得出者，传统视为「所问之事无着落」——
 * 叙述层须表述为**结构上找不到对应位置**，不表述为「事不成」。
 * 前者是对卦象的描述，后者是对结果的预言。
 */

import type { Verdict, DerivationStep } from "../conclude/types.js";
import type { Liuqin } from "../yijing/najia.js";
import type { DressedGua, YaoInfo, FuShen } from "./dress.js";
import { fourGodsOf, TOPIC_BY_ID, type FourGods, type Topic } from "./topics.js";

export interface Yongshen {
  readonly topic: Topic;
  /** 用神爻。伏藏时为 null，另见 `fu`。 */
  readonly yao: YaoInfo | null;
  /** 用神伏藏时的伏神。 */
  readonly fu: FuShen | null;
  /** 四神的六亲名。世应类占事无六亲用神时为 null。 */
  readonly gods: FourGods | null;
  /** 原神、忌神、仇神各自在卦中的爻（可能多现，可能没有）。 */
  readonly yuanYaos: readonly YaoInfo[];
  readonly jiYaos: readonly YaoInfo[];
  readonly chouYaos: readonly YaoInfo[];
  /** 多现时的全部候选，含最终未取的。 */
  readonly candidates: readonly YaoInfo[];
}

export class TopicNeedsRelationError extends Error {
  constructor(topicId: string) {
    super(`占事 ${topicId} 的用神随所问的人而定，须由调用方指明六亲。`);
    this.name = "TopicNeedsRelationError";
  }
}

/**
 * 用神多现的取舍。
 *
 * 逐条打分不合适 —— 这些判据是**有序的**，不是可加的：
 * 「发动」与「临世」不能相加得出「比只临世更强」。故走阶梯，逐级淘汰。
 */
function pickAmong(
  cands: readonly YaoInfo[], shi: number, steps: DerivationStep[],
): { picked: YaoInfo; tied: readonly YaoInfo[] } {
  const rungs: readonly { readonly why: string; readonly f: (y: YaoInfo) => boolean }[] = [
    { why: "取发动之爻", f: (y) => y.moving },
    { why: "取临世应之爻", f: (y) => y.isShi || y.isYing },
    { why: "舍旬空月破之爻", f: (y) => !(y.xunkong && y.xunkongNullified === null)
      && !(y.yuepo && y.yuepoNullified === null) },
    { why: "取与日辰有关系之爻", f: (y) => y.dayRelations.length > 0 },
    { why: "取月建旺相之爻", f: (y) => y.monthPhase === "旺" || y.monthPhase === "相" },
  ];

  let pool = [...cands];
  for (const r of rungs) {
    if (pool.length === 1) break;
    const kept = pool.filter(r.f);
    if (kept.length > 0 && kept.length < pool.length) {
      steps.push({ step: "多现取舍", detail: `${r.why}：${
        pool.map((y) => `第${y.pos}爻`).join("、")} → ${kept.map((y) => `第${y.pos}爻`).join("、")}` });
      pool = kept;
    }
  }
  if (pool.length > 1) {
    // 阶梯走完仍不止一个 —— 就近于世爻，但明记为「未能定夺」
    const sorted = [...pool].sort((a, b) => Math.abs(a.pos - shi) - Math.abs(b.pos - shi));
    steps.push({
      step: "多现未定", detail: `${pool.map((y) => `第${y.pos}爻`).join("、")} 诸条判据下皆等，`
        + `暂取就近于世爻的第${sorted[0]!.pos}爻，其余并列为替代`,
    });
    return { picked: sorted[0]!, tied: sorted.slice(1) };
  }
  return { picked: pool[0]!, tied: [] };
}

/**
 * 定用神。
 *
 * `callerLiuqin` 只在占事的用神取法为 `caller` 时需要（如占行人归期，
 * 用神随所问之人是父母还是子女而定）。
 */
export function pickYongshen(
  gua: DressedGua, topicId: string, callerLiuqin?: Liuqin,
): Verdict<Yongshen> {
  const topic = TOPIC_BY_ID.get(topicId);
  if (topic === undefined) throw new Error(`未知的占事类型 ${topicId}`);

  const derivation: DerivationStep[] = [];
  const alternatives: { value: Yongshen; reason: string }[] = [];
  const byPos = (p: number) => gua.yaos[p - 1]!;

  // ── 世应类：没有六亲用神 ──
  if (topic.use.kind === "shi" || topic.use.kind === "ying" || topic.use.kind === "shiYing") {
    const pos = topic.use.kind === "ying" ? gua.ying : gua.shi;
    derivation.push({
      step: "取用", detail: topic.use.kind === "shiYing"
        ? `占「${topic.label}」以世应关系为主，世在第${gua.shi}爻、应在第${gua.ying}爻`
        : `占「${topic.label}」以${topic.use.kind === "shi" ? "世" : "应"}爻为用，在第${pos}爻`,
    });
    const y = byPos(pos);
    return {
      value: {
        topic, yao: y, fu: null, gods: null,
        yuanYaos: [], jiYaos: [], chouYaos: [], candidates: [y],
      },
      confidence: 0.85, derivation, alternatives,
    };
  }

  const yong: Liuqin = topic.use.kind === "caller"
    ? (callerLiuqin ?? (() => { throw new TopicNeedsRelationError(topic.id); })())
    : topic.use.value;
  const gods = fourGodsOf(yong, gua.ben.palaceElement);
  derivation.push({
    step: "取用", detail: `占「${topic.label}」以${yong}为用神；`
      + `原神${gods.yuan}、忌神${gods.ji}、仇神${gods.chou}（由用神一位按生克推出）`,
  });

  const pick = (q: Liuqin) => gua.yaos.filter((y) => y.liuqin === q);
  const cands = pick(yong);
  const yuanYaos = pick(gods.yuan);
  const jiYaos = pick(gods.ji);
  const chouYaos = pick(gods.chou);

  // ── 不上卦 → 伏神 ──
  if (cands.length === 0) {
    const fu = gua.fushen.find((f) => f.liuqin === yong) ?? null;
    derivation.push({
      step: "用神不上卦", detail: fu === null
        ? `${yong}不上卦，且本宫卦同位亦无 —— 此局面异常，须复核`
        : `${yong}不上卦，取伏神 ${fu.stem}${fu.branch}，伏于第${fu.pos}爻${fu.feiLiuqin}之下`,
    });
    return {
      value: { topic, yao: null, fu, gods, yuanYaos, jiYaos, chouYaos, candidates: [] },
      // 伏藏本就难断，置信度低于出现者
      confidence: fu === null ? 0.30 : 0.55, derivation, alternatives,
    };
  }

  // ── 多现取舍 ──
  if (cands.length === 1) {
    derivation.push({ step: "用神", detail: `${yong}独现于第${cands[0]!.pos}爻` });
    return {
      value: { topic, yao: cands[0]!, fu: null, gods, yuanYaos, jiYaos, chouYaos, candidates: cands },
      confidence: 0.85, derivation, alternatives,
    };
  }

  derivation.push({
    step: "用神多现",
    detail: `${yong}见于第 ${cands.map((y) => y.pos).join("、")} 爻，须取舍`,
  });
  const { picked, tied } = pickAmong(cands, gua.shi, derivation);
  const base = { topic, fu: null, gods, yuanYaos, jiYaos, chouYaos, candidates: cands } as const;
  for (const t of tied) {
    alternatives.push({
      value: { ...base, yao: t },
      reason: `第${t.pos}爻同为${yong}，诸条判据下与所取者等，另一说以它为用。`,
    });
  }
  return {
    value: { ...base, yao: picked },
    confidence: tied.length > 0 ? 0.50 : 0.75,
    derivation, alternatives,
  };
}

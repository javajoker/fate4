/**
 * 问事的人话渲染。
 *
 * 与 `cards.ts` 同一条纪律：人话由**枚举查表**得到，技术原文作依据。
 * 六爻的枚举比四柱少，但每一个都要有对应的话 —— 缺一个就会漏出术语，
 * 而漏出的那一句读起来会格外突兀（整页都是平常话，忽然冒出「用神妻财」）。
 *
 * ## 有一处刻意不翻译
 *
 * 「用神」这个概念没有对应的平常词。硬翻成「关键的那一项」尚可，
 * 翻成「你的财运」就是把一个**位置**说成了一件**事** —— 那正是要避免的。
 * 故人话里一律说「这件事在卦里的那个位置」，笨一点，但不多说。
 */

import type { QuestionReport } from "../liuyao/report.js";
import type { NarrativeLine } from "../report/render.js";
import type { PlainCard } from "./cards.js";
import { confidencePlain, PLAIN_DISCLAIMER } from "./vocab.js";

/** 用神力量五档 → 人话。**不说成败**，只说这件事在卦里的分量。 */
export const YAO_BAND_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  有力: "这件事在卦里的那个位置分量很足 —— 时令帮它，周围也在给它劲。",
  偏有力: "这件事在卦里的那个位置分量还行，有一处在给它劲。",
  平: "这件事在卦里的那个位置不强不弱，既没有明显的助力，也没有明显的拖累。",
  偏无力: "这件事在卦里的那个位置分量偏轻，有一处在拖它。",
  无力: "这件事在卦里的那个位置分量很轻 —— 要么时令不帮，要么正被压着。",
});

/** 动静 → 人话。 */
export const MOTION_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  moving: "这个位置是动的，卦里显示它正在变。",
  still: "这个位置是静的。静的位置自己不动，要等外面的东西来引。",
  hidden: "这个位置表面上静着，但被今天的日子冲了一下 —— 传统上算它实际在动。",
  absent: "这件事在卦里找不到对应的位置，只能到底卦里去找它藏在哪 ——"
    + "传统上这叫「伏」。这是结构上没有着落，不是事情办不成。",
});

/** 世应关系 → 人话。说的是「你」与「对方」的相对位置。 */
export const SHIYING_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  世生应: "卦里你这边在往对方那边使劲。",
  应生世: "卦里对方那边在往你这边使劲。",
  世克应: "卦里你这边压着对方那边。",
  应克世: "卦里对方那边压着你这边。",
  比和: "卦里你这边和对方那边是一路的，没有相互的推拉。",
});

/** 整卦形态 → 人话。 */
export const GUA_FLAG_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  六冲: "这一卦六个位置两两相冲，传统上归在「散」「变动」一类。",
  六合: "这一卦六个位置两两相合，传统上归在「聚」「牵连」一类。",
  反吟: "变出来的和原来的处处相冲，传统上归在「反覆」一类。",
  伏吟: "变出来的和原来的处处相同，传统上归在「停在原地」一类。",
});

export interface PlainQuestion {
  readonly cards: readonly PlainCard[];
  readonly framing: string;
  readonly disclaimer: string;
  readonly disclaimerTechnical: string;
}

/** 问事页顶部的框定语。比四柱那一版多说一件事：结果属于时刻，不属于人。 */
export const PLAIN_QUESTION_FRAMING =
  "下面是按传统方法对「你问的这个时刻」推演出来的结构，换成了平常话。"
  + "同一个时段里，所有人问所有事得到的是同一个结果 —— 它属于那个时刻，不属于你，"
  + "区分不同的事靠看结果里的哪一个位置。每一条都可以展开看它的来历。";

const line = (id: string, title: string, body: string,
  ev: readonly NarrativeLine[], conf = 1): PlainCard => ({
  id, section: "今天", title, body: body + confidencePlain(conf), evidence: ev, confidence: conf,
});

export function plainQuestion(r: QuestionReport): PlainQuestion {
  const cards: PlainCard[] = [];
  const nar = r.judgement.narrative;

  const strengthLine = nar.find((l) => l.templateId === "liuyao.yong.strength");
  const fuLine = nar.find((l) => l.templateId === "liuyao.yong.fu");
  if (strengthLine !== undefined) {
    const band = (["有力", "偏有力", "平", "偏无力", "无力"] as const)
      .find((b) => strengthLine.text.includes(`力量为${b}`)) ?? "平";
    cards.push(line("q.strength", "这件事的分量",
      YAO_BAND_PLAIN[band]!, [strengthLine], strengthLine.confidence));
  } else if (fuLine !== undefined) {
    cards.push(line("q.hidden", "这件事的位置",
      MOTION_PLAIN.absent!, [fuLine], fuLine.confidence));
  }

  const mv = nar.find((l) => l.templateId === "liuyao.yong.moving");
  const an = nar.find((l) => l.templateId === "liuyao.yong.andong");
  const st = nar.find((l) => l.templateId === "liuyao.yong.still");
  const motion = mv ?? an ?? st;
  if (motion !== undefined) {
    cards.push(line("q.motion", "它在动还是静",
      MOTION_PLAIN[mv !== undefined ? "moving" : an !== undefined ? "hidden" : "still"]!,
      [motion]));
  }

  const sy = nar.find((l) => l.templateId === "liuyao.shiying");
  if (sy !== undefined) {
    const rel = (Object.keys(SHIYING_PLAIN) as (keyof typeof SHIYING_PLAIN)[])
      .find((k) => sy.text.includes(k));
    cards.push(line("q.shiying", "你和对方",
      (rel === undefined ? "卦里你这边与对方那边的关系不明显。" : SHIYING_PLAIN[rel]!)
      + (sy.text.includes("用神持世") ? "　这件事正落在你自己这边。" : ""),
      [sy], sy.confidence));
  }

  const flags = nar.find((l) => l.templateId.startsWith("liuyao.gua."));
  if (flags !== undefined) {
    const hit = (Object.keys(GUA_FLAG_PLAIN) as (keyof typeof GUA_FLAG_PLAIN)[])
      .filter((k) => flags.text.includes(k));
    cards.push(line("q.gua", "整体的样子",
      hit.length === 0 ? "这一卦没有特别的整体形态。"
        : hit.map((k) => GUA_FLAG_PLAIN[k]!).join(""),
      [flags]));
  }

  const yq = r.yingqi.result;
  cards.push(line("q.window", "传统上指向的时段",
    yq.suppressed !== null
      ? "这一类不给时段。「什么时候会怎样」是这套方法给不出的东西，"
        + "在健康这类事情上尤其不该给。"
      : yq.windows.length === 0
        ? "这一卦没有指向特定的时段。"
        : `${yq.windows.map((w) => `${w.year} 年的${w.branch}月前后`).join("、")}。`
          + "这是按传统取法列出的候选，按远近排 —— 方法本身给不出哪一段更可能，"
          + "所以不作这种排序。",
    r.yingqi.narrative));

  return {
    cards: Object.freeze(cards),
    framing: PLAIN_QUESTION_FRAMING,
    disclaimer: PLAIN_DISCLAIMER,
    disclaimerTechnical: r.disclaimerBottom,
  };
}

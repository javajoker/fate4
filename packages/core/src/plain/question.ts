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
import { relayerYaoci, type Quote, type YaociPick, type YaociReading } from "../liuyao/yaoci.js";
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
  // ⚠️ 末句原作「不是事情办不成」，被 `zh.liuyao.outcomeVerb` 拦下 ——
  // 那条规则拦的是「不成」这个成败词的**形状**，不解析否定。
  // 给否定式开豁免会立刻变成一个洞（「不是必然离婚」照样放行），故改写句子。
  absent: "这件事在卦里找不到对应的位置，只能到底卦里去找它藏在哪 ——"
    + "传统上这叫「伏」。这说的是结构上没有着落，不是对这件事结果的话。",
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
  /** 指事一路的卡片。与 `cards` 分开，因为它是**引文**，不是本系统的话。 */
  readonly yaoci: readonly PlainCard[];
  readonly framing: string;
  readonly disclaimer: string;
  readonly disclaimerTechnical: string;
}

/** 爻位在人话里怎么叫。序数词比「初爻/上爻」好懂，且不引入术语。 */
const POS_PLAIN: readonly string[] = Object.freeze([
  "最下面那一格", "第二格", "第三格", "第四格", "第五格", "最上面那一格",
]);

/** 取爻角色 → 人话。**「应」是对方，不是将来** —— 见 liuyao/yaoci.ts。 */
const ROLE_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  动爻: "卦里正在动的那一格",
  世爻: "卦里代表你这边的那一格",
  应爻: "卦里代表对方那边的那一格",
});

const quoted = (q: Quote | null): string | null => q?.text ?? null;

/**
 * 一格的引文卡。守卫拦下的那几条不出现在这里 —— `quoted` 返回 null。
 *
 * 引文的「依据」是它的**出处**，不是一段推导，故写进正文里：卦名、通行本第几卦、
 * 第几爻。折进「看依据」的只留取法那一条 —— 每张卡都折同样两行，等于没折。
 */
function yaociCardsOf(
  pick: YaociPick, ev: readonly NarrativeLine[], idPrefix: string,
  cite: string, citeBian: string | null,
): PlainCard[] {
  const out: PlainCard[] = [];
  const where = POS_PLAIN[pick.pos - 1] ?? `第 ${pick.pos} 格`;
  const role = ROLE_PLAIN[pick.role] ?? "";
  const how = ev.slice(0, 1);
  const card = (id: string, title: string, body: string): PlainCard =>
    ({ id: `${idPrefix}.${id}`, section: "今天", title, body, evidence: how, confidence: 1 });

  const stage = quoted(pick.stage);
  if (stage !== null) {
    out.push(card(`yaoci.${pick.pos}.stage`, "走到哪一步了",
      `传统把一件事分成六个阶段，这次落在${where} —— 也就是${role}。这一格传统上是这样描述的：${stage}`));
  }

  const gist = quoted(pick.ben.gist);
  const classic = quoted(pick.ben.classic);
  if (gist !== null) {
    out.push(card(`yaoci.${pick.pos}.gist`, "传统在这一格上的说法",
      `${gist}` + (classic === null ? ""
        : `　这句话来自《周易》的原文：「${classic}」（${cite}）。`)));
  }

  const bianGist = quoted(pick.bian?.gist ?? null);
  const bianClassic = quoted(pick.bian?.classic ?? null);
  if (bianGist !== null) {
    out.push(card(`yaoci.${pick.pos}.turn`, "这一格变过去以后",
      `这一格是动的，传统上会连着看它变成什么。变过去那一格的说法是：${bianGist}`
      + (bianClassic === null ? ""
        : `　原文：「${bianClassic}」（${citeBian ?? cite}）。`)
      + "　这说的是同一格的两种样子，不是两件事，也不是先后。"));
  }

  const expand = quoted(pick.ben.expand);
  if (expand !== null) {
    out.push(card(`yaoci.${pick.pos}.expand`, "把这一格展开说",
      `以下是这套传统说法的白话转述，写的是这一格的处境，不是对你的判断。${expand}`));
  }
  return out;
}

/**
 * 指事一路的人话。**引文原样端出，一个字不改；过不了守卫的就不端。**
 *
 * 技术层的读法里没有爻位阶段与白话转述（那两项通篇第二人称，技术层不载），
 * 故此处 `relayerYaoci` 换到人话层重取一遍 —— 取的是同样几个位置。
 */
export function plainYaociCards(
  reading: YaociReading, ev: readonly NarrativeLine[], idPrefix = "q",
): PlainCard[] {
  const y: YaociReading = reading.layer === "plain" ? reading : relayerYaoci(reading, "plain");
  const out: PlainCard[] = [];

  out.push({
    id: `${idPrefix}.yaoci.how`, section: "今天", title: "这些话是从哪来的",
    body: "下面几条不是这套推演写的，是《周易》的爻辞与它的传统转述 —— 引文原样端出，一个字没改。"
      + (y.method === "动爻"
        ? "传统在这里取卦里正在动的那一格，连着看它变成什么。"
        : "六格都没动，传统在这里改看代表你这边与对方那边的两格。")
      + "它给的是「说的是什么事」，另外那几条给的是「这件事在卦里的分量」；两路各说各的，不互相印证。",
    evidence: ev, confidence: 1,
  });

  for (const pick of y.picks) {
    const at = (g: { name: string; received: number }) =>
      `${g.name}，通行本第 ${g.received + 1} 卦第 ${pick.pos} 爻`;
    out.push(...yaociCardsOf(pick, ev, idPrefix,
      at(y.gua.ben), y.gua.bian === null ? null : at(y.gua.bian)));
  }

  if (y.withheldCount > 0) {
    out.push({
      id: `${idPrefix}.yaoci.withheld`, section: "今天", title: "有几条没端出来",
      body: `所引的 ${y.quoted} 条里有 ${y.withheldCount} 条没通过本项目的措辞检查，`
        + "所以没显示。语料是外面来的，不给它开例外 —— 那样的话这道检查就没有意义了。",
      evidence: ev, confidence: 1,
    });
  }
  return out;
}

export const plainYaoci = (r: QuestionReport): PlainCard[] =>
  plainYaociCards(r.yaoci.reading, r.yaoci.narrative, "q");

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
    // id 曾作 "q.hidden"，而它填的是 `MOTION_PLAIN.absent`（伏神）——
    // `hidden` 在本模块指的是暗动，两者不是一回事。
    cards.push(line("q.absent", "这件事的位置",
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
    yaoci: Object.freeze(plainYaoci(r)),
    framing: PLAIN_QUESTION_FRAMING,
    disclaimer: PLAIN_DISCLAIMER,
    disclaimerTechnical: r.disclaimerBottom,
  };
}

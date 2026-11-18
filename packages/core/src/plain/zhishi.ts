/**
 * 指事接成一段话 —— 给只要「说的是什么事」的读者。
 *
 * ## 这一处做什么
 *
 * 人话层的指事原本是一张张卡片（`plainYaociCards`）：走到哪一步了、传统在这一格上的
 * 说法、把这一格展开说……各占一张。卡片适合「逐条看依据」，不适合一口气读下来。
 * 这里把**同样那几段引文**按次序接成段落，中间只添连接词：
 *
 * | 所取 | 接法 |
 * | 主（爻辞） | 阶段。这一步的要点是：指事。具体来说，白话转述 |
 * | 次（爻辞） | 其次，指事。细说起来，白话转述 |
 * | 主（卦辞） | 整体来看，指事。具体来说，白话转述 |
 * | 体（卦辞） | 就这件事本身来说，指事。具体来说，白话转述 |
 * | 用（卦辞） | 再看它往哪里去，指事。细说起来，白话转述 |
 *
 * 次的那一格**不再说阶段**：两格动时阶段说两遍，读者会以为事情同时走在两步上。
 * 阶段只随主的那一格说。
 *
 * ## 不改引文
 *
 * 连接词之外一个字不动 —— 引文原样，与卡片那一路同一条纪律。唯一的加工是补句末标点：
 * 语料的一句话指事多半不带句号，接进段落里不补就粘成一句。
 *
 * 过不了守卫的那几段（`text` 为 null）直接略去，连同它前面的连接词；
 * 略去了几段如实记在 {@link ZhishiProse.withheld}，由调用方说出来。
 */

import { relayerYaoci, pickSource, type YaociPick, type YaociReading } from "../liuyao/yaoci.js";
import { ZHISHI_RULE_PLAIN } from "./question.js";

export interface ZhishiParagraph {
  /** 主／次／体／用。 */
  readonly role: YaociPick["role"];
  /** 接好的一段。 */
  readonly text: string;
  /** 出处：「本卦风水涣第 2 爻」「变卦山水蒙卦辞」。 */
  readonly source: string;
  /** 《周易》原文的开头 —— 爻辞是爻题（九二、上六……），卦辞为 null。 */
  readonly title: string | null;
}

export interface ZhishiProse {
  /** 这一次按哪一例取的，平常话。 */
  readonly rule: string;
  readonly paragraphs: readonly ZhishiParagraph[];
  /** 没过措辞守卫、因而略去的段数。 */
  readonly withheld: number;
}

/** 补句末标点。已以句号、问号、叹号、引号收尾的不动。 */
const sentence = (s: string): string => (/[。？！?!」”]$/.test(s) ? s : `${s}。`);

const LEAD: Readonly<Record<YaociPick["role"], { readonly open: string; readonly expand: string }>> = {
  // 「要点是：」而不是「此时，」：一句话指事有时是名词短语（「像母亲一样宽广的胸怀」），
  // 接在「此时，」后面不成句；也有以「…时」起头的，「此时，条件成熟时」叠了两个时。
  主: { open: "这一步的要点是：", expand: "具体来说，" },
  次: { open: "其次，", expand: "细说起来，" },
  体: { open: "就这件事本身来说，", expand: "具体来说，" },
  用: { open: "再看它往哪里去，", expand: "细说起来，" },
};

function paragraphOf(p: YaociPick, withStage: boolean): {
  readonly text: string; readonly withheld: number;
} {
  let withheld = 0;
  const take = (q: { readonly text: string | null } | null): string | null => {
    if (q === null) return null;
    if (q.text === null) { withheld++; return null; }
    return q.text;
  };
  const isGua = p.slot === 0;
  // 阶段只随主的那一格说；卦辞没有阶段
  const stage = withStage && !isGua ? take(p.stage) : null;
  const gist = take(p.quotes.gist);
  const expand = take(p.quotes.expand);

  // 卦辞的「主」（静卦、六爻皆动）没有阶段可接，开头改用「整体来看」
  const lead = p.role === "主" && isGua ? { open: "整体来看，", expand: "具体来说，" } : LEAD[p.role];
  // 爻辞的「主」，「这一步」指的是前面那句阶段；阶段不在（被拦），它就无所指
  const open = p.role === "主" && !isGua && stage === null ? "" : lead.open;

  const parts: string[] = [];
  if (stage !== null) parts.push(sentence(stage));
  if (gist !== null) parts.push(open + sentence(gist));
  // 指事被拦时，开头的连接词让给转述
  if (expand !== null) parts.push((gist === null ? open : lead.expand) + sentence(expand));
  return { text: parts.join(""), withheld };
}

/** 一份指事 → 段落。技术层的读法会先换到人话层（阶段与白话转述只有人话层载）。 */
export function zhishiProse(reading: YaociReading): ZhishiProse {
  const y = reading.layer === "plain" ? reading : relayerYaoci(reading, "plain");
  let withheld = 0;
  const paragraphs: ZhishiParagraph[] = [];
  y.picks.forEach((p, i) => {
    const one = paragraphOf(p, i === 0);
    withheld += one.withheld;
    if (one.text.length === 0) return;
    const head = p.slot === 0 ? null : (p.quotes.classic.text?.match(/^[^。]+/)?.[0] ?? null);
    paragraphs.push({ role: p.role, text: one.text, source: pickSource(y, p), title: head });
  });
  return { rule: ZHISHI_RULE_PLAIN[y.count] ?? "", paragraphs, withheld };
}

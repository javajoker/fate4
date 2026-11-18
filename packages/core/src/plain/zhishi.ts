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
 * | 次（爻辞） | 其次，阶段。这一步的要点是：指事。细说起来，白话转述 |
 * | 主（卦辞） | 整体来看，指事。具体来说，白话转述 |
 * | 体（卦辞） | 就这件事本身来说，指事。具体来说，白话转述 |
 * | 用（卦辞） | 再看它往哪里去，指事。细说起来，白话转述 |
 *
 * 爻辞的每一格**各说各的阶段**：两格动（或四爻动取两个不变爻）时，主与次落在不同的爻位，
 * 本来就是两步 —— 「其次」那一段说它自己走到哪一步，读者才知道这第二段话说的是哪一格的处境。
 * 卦辞没有爻位，也就没有阶段。
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

/** 段首的连接词。主（爻辞）由阶段起句，不加；卦辞的主没有阶段，用「整体来看」。 */
const OPEN: Readonly<Record<YaociPick["role"], string>> = {
  主: "", 次: "其次，", 体: "就这件事本身来说，", 用: "再看它往哪里去，",
};
/** 白话转述前的连接词。 */
const EXPAND: Readonly<Record<YaociPick["role"], string>> = {
  主: "具体来说，", 次: "细说起来，", 体: "具体来说，", 用: "细说起来，",
};
/**
 * 阶段之后、指事之前。用「要点是：」而不是「此时，」：一句话指事有时是名词短语
 * （「像母亲一样宽广的胸怀」），接在「此时，」后面不成句；也有以「…时」起头的，
 * 「此时，条件成熟时」叠了两个时。
 */
const AFTER_STAGE = "这一步的要点是：";

function paragraphOf(p: YaociPick): {
  readonly text: string; readonly withheld: number;
} {
  let withheld = 0;
  const take = (q: { readonly text: string | null } | null): string | null => {
    if (q === null) return null;
    if (q.text === null) { withheld++; return null; }
    return q.text;
  };
  const isGua = p.slot === 0;
  // 卦辞没有爻位，也就没有阶段
  const stage = isGua ? null : take(p.stage);
  const gist = take(p.quotes.gist);
  const expand = take(p.quotes.expand);

  // 卦辞的「主」（静卦、六爻皆动）没有阶段可接，开头用「整体来看」
  let open: string = p.role === "主" && isGua ? "整体来看，" : OPEN[p.role];
  const parts: string[] = [];
  // 段首连接词只用一次：落在第一句实际出现的话前面（阶段、指事、转述，哪句被拦就往后让）
  const lead = (): string => { const o = open; open = ""; return o; };

  if (stage !== null) parts.push(lead() + sentence(stage));
  // 「这一步」指的是前面那句阶段；阶段不在（卦辞，或被拦），它就无所指
  if (gist !== null) parts.push((stage !== null ? AFTER_STAGE : lead()) + sentence(gist));
  if (expand !== null) {
    parts.push((stage !== null || gist !== null ? EXPAND[p.role] : lead()) + sentence(expand));
  }
  return { text: parts.join(""), withheld };
}

/** 一份指事 → 段落。技术层的读法会先换到人话层（阶段与白话转述只有人话层载）。 */
export function zhishiProse(reading: YaociReading): ZhishiProse {
  const y = reading.layer === "plain" ? reading : relayerYaoci(reading, "plain");
  let withheld = 0;
  const paragraphs: ZhishiParagraph[] = [];
  y.picks.forEach((p) => {
    const one = paragraphOf(p);
    withheld += one.withheld;
    if (one.text.length === 0) return;
    const head = p.slot === 0 ? null : (p.quotes.classic.text?.match(/^[^。]+/)?.[0] ?? null);
    paragraphs.push({ role: p.role, text: one.text, source: pickSource(y, p), title: head });
  });
  return { rule: ZHISHI_RULE_PLAIN[y.count] ?? "", paragraphs, withheld };
}

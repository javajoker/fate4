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
 *
 * ## 三种语言
 *
 * 跟着读法的 `locale` 走。引文取各自语言的语料原文（繁体是语料自带的繁体，不经转换）；
 * 连接词、取法说明、出处这几样**本模块自己的话**：
 *
 * - 繁体：由简体经 `toHant` 机械转出（与报告层同一条路，测试断言每个字都已归类）；
 * - 英文：另写一份（{@link EN}）。英文的连接词后接逗号时，转述句首的大写字母要改小写，
 *   否则读成「More concretely, When you…」。
 */

import { relayerYaoci, pickSource, type YaociPick, type YaociReading } from "../liuyao/yaoci.js";
import type { YaociLocale } from "../yijing/yaoci.js";
import { toHant } from "../report/hant.js";
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
  readonly locale: YaociLocale;
  /** 这一次按哪一例取的，平常话。 */
  readonly rule: string;
  readonly paragraphs: readonly ZhishiParagraph[];
  /** 没过措辞守卫、因而略去的段数。 */
  readonly withheld: number;
}

type Role = YaociPick["role"];

/** 一种语言的全部接法。 */
interface Connect {
  /** 段首的连接词。主（爻辞）由阶段起句，不加。 */
  readonly open: Readonly<Record<Role, string>>;
  /** 卦辞的主（静卦、六爻皆动）没有阶段可接，段首用它。 */
  readonly guaMain: string;
  /**
   * 阶段之后、指事之前。用「要点是：」而不是「此时，」：一句话指事有时是名词短语
   * （「像母亲一样宽广的胸怀」），接在「此时，」后面不成句；也有以「…时」起头的，
   * 「此时，条件成熟时」叠了两个时。
   */
  readonly afterStage: string;
  /** 白话转述前的连接词。 */
  readonly expand: Readonly<Record<Role, string>>;
  /** 句与句之间。中文直接相接，英文隔一个空格。 */
  readonly sep: string;
  /** 补句末标点。 */
  readonly sentence: (s: string) => string;
  /** 七例取法的说明，按动爻数索引。 */
  readonly rules: readonly string[];
  /** 出处。 */
  readonly source: (r: YaociReading, p: YaociPick) => string;
  /** 爻题的切法：中文到第一个句号，英文到第一个英文句号。 */
  readonly title: RegExp;
}

const HANS: Connect = {
  open: { 主: "", 次: "其次，", 体: "就这件事本身来说，", 用: "再看它往哪里去，" },
  guaMain: "整体来看，",
  afterStage: "这一步的要点是：",
  expand: { 主: "具体来说，", 次: "细说起来，", 体: "具体来说，", 用: "细说起来，" },
  sep: "",
  // 已以句号、问号、叹号、引号收尾的不动
  sentence: (s) => (/[。？！?!」”]$/.test(s) ? s : `${s}。`),
  rules: ZHISHI_RULE_PLAIN,
  source: (r, p) => pickSource(r, p),
  title: /^[^。]+/,
};

const mapRoles = (m: Readonly<Record<Role, string>>, f: (s: string) => string) =>
  ({ 主: f(m.主), 次: f(m.次), 体: f(m.体), 用: f(m.用) });

/** 繁体：本模块自己的话由简体机械转出；引文用语料自带的繁体。 */
const HANT: Connect = {
  ...HANS,
  open: mapRoles(HANS.open, toHant),
  guaMain: toHant(HANS.guaMain),
  afterStage: toHant(HANS.afterStage),
  expand: mapRoles(HANS.expand, toHant),
  rules: HANS.rules.map(toHant),
  source: (r, p) => toHant(pickSource(r, p)),
};

/** 英文：连接词与取法说明另写；卦名不译，给通行本卦序与原名。 */
export const EN: Connect = {
  // 体／用／整体用逗号接：一句话指事有的自带冒号（「Near completion: …」），再接冒号就叠了
  open: { 主: "", 次: "Secondly, ", 体: "As for the matter itself, ", 用: "As for where it is heading, " },
  guaMain: "Overall, ",
  afterStage: "The key at this step: ",
  expand: { 主: "More concretely, ", 次: "In more detail, ", 体: "More concretely, ", 用: "In more detail, " },
  sep: " ",
  sentence: (s) => (/[.?!"'”’)]$/.test(s) ? s : `${s}.`),
  rules: [
    "No line is moving, so the tradition reads the judgement of the whole hexagram.",
    "One line is moving, so the tradition reads the text of that line.",
    "Two lines are moving, so the tradition reads both, with the upper one leading.",
    "Three lines are moving, half and half, so the tradition reads the judgements of both hexagrams: "
      + "the original speaks of the matter itself, the changed one of where it is heading.",
    "Four lines are moving, so the tradition turns to the two unmoving lines of the changed hexagram, "
      + "with the lower one leading.",
    "Five lines are moving, so the tradition reads the one unmoving line of the changed hexagram.",
    "All six lines are moving, so the tradition reads the judgement of the changed hexagram.",
  ],
  source: (r, p) => {
    const g = p.source === "本卦" ? r.gua.ben : r.gua.bian;
    const which = p.source === "本卦" ? "Original" : "Changed";
    return `${which} hexagram, No. ${(g?.received ?? 0) + 1} ${toHant(g?.name ?? "")}, `
      + (p.slot === 0 ? "judgement" : `line ${p.slot}`);
  },
  title: /^[^.]+/,
};

const CONNECT: Readonly<Record<YaociLocale, Connect>> = { "zh-Hans": HANS, "zh-Hant": HANT, en: EN };

/**
 * 英文的连接词以逗号收尾时，后面那句的句首大写改小写（「Secondly, just as you…」）。
 * 代词 I 与全大写的缩写不动。冒号后保留大写。
 */
const glue = (lead: string, text: string): string =>
  /, $/.test(lead) && /^[A-Z][a-z]/.test(text) && !/^I\b/.test(text)
    ? lead + text[0]!.toLowerCase() + text.slice(1)
    : lead + text;

function paragraphOf(p: YaociPick, c: Connect): {
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
  let open: string = p.role === "主" && isGua ? c.guaMain : c.open[p.role];
  const parts: string[] = [];
  // 段首连接词只用一次：落在第一句实际出现的话前面（阶段、指事、转述，哪句被拦就往后让）
  const lead = (): string => { const o = open; open = ""; return o; };

  if (stage !== null) parts.push(glue(lead(), c.sentence(stage)));
  // 「这一步」指的是前面那句阶段；阶段不在（卦辞，或被拦），它就无所指
  if (gist !== null) parts.push(glue(stage !== null ? c.afterStage : lead(), c.sentence(gist)));
  if (expand !== null) {
    parts.push(glue(stage !== null || gist !== null ? c.expand[p.role] : lead(), c.sentence(expand)));
  }
  return { text: parts.join(c.sep), withheld };
}

/**
 * 一份指事 → 段落，语言跟着读法走。技术层的读法会先换到人话层
 * （阶段与白话转述只有人话层载）。
 */
export function zhishiProse(reading: YaociReading): ZhishiProse {
  const y = reading.layer === "plain" ? reading : relayerYaoci(reading, "plain");
  const c = CONNECT[y.locale];
  let withheld = 0;
  const paragraphs: ZhishiParagraph[] = [];
  y.picks.forEach((p) => {
    const one = paragraphOf(p, c);
    withheld += one.withheld;
    if (one.text.length === 0) return;
    const head = p.slot === 0 ? null : (p.quotes.classic.text?.match(c.title)?.[0]?.trim() ?? null);
    paragraphs.push({ role: p.role, text: one.text, source: c.source(y, p), title: head });
  });
  return { locale: y.locale, rule: c.rules[y.count] ?? "", paragraphs, withheld };
}

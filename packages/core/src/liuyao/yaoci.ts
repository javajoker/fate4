/**
 * Q7 指事 —— 从卦里取出「说的是什么事」。
 *
 * ## 这一层不断卦，也不参与断卦
 *
 * 纳甲断法（Q1–Q5）与象辞（卦辞、爻辞）本来是**两套系统**。京房一路看的是六亲、
 * 生克、旬空月破，一句爻辞都不用；文王卦的民间用法才把两者并起来读。
 *
 * 本项目照旧只用纳甲断，象辞进来只作**指事** —— 给「用神偏无力」这类结构判断
 * 配上具体的所指（旅行、争讼、婚嫁、田猎）。故：
 *
 * - 象辞**不改动任何判断**，不进 `Judgement`，不影响应期；
 * - 取辞按象辞自己的规矩（见下），**不按用神**；
 * - 取出来的爻位是否恰好是用神位，只作一行记录（{@link YaociReading.hitsYongshen}），
 *   不作「两法相符」的加权 —— 那与合参一节「一致不等于互证」是同一条纪律。
 *
 * ## 取辞：按动爻多寡分七例
 *
 * | 动爻 | 取 | 主次 |
 * | 0 | 本卦卦辞 | —— |
 * | 1 | 本卦变爻爻辞 | —— |
 * | 2 | 本卦两个变爻爻辞 | 上者为主 |
 * | 3 | 本卦卦辞与变卦卦辞 | 本卦为体，变卦为用 |
 * | 4 | 变卦两个不变爻爻辞 | 下者为主 |
 * | 5 | 变卦不变爻爻辞 | —— |
 * | 6 | 变卦卦辞 | —— |
 *
 * 这一套本于朱熹《易学启蒙·考变占》。与原文有两处出入，都是有意的：
 *
 * - 三爻动，原文作「以本卦为贞，之卦为悔」；此处称**体／用** —— 本卦是事之所立，
 *   变卦是事之所往。
 * - 六爻皆动，原文「乾坤占二用」—— 乾之坤占「用九」、坤之乾占「用六」。
 *   本项目的语料每卦七格（卦辞 + 六爻），**没有用九、用六两条**，
 *   故六爻皆动一律取变卦卦辞，乾坤不另作例外。
 *
 * 这张表的要点是**分量随动爻的多寡在本卦与变卦之间移交**：动得少，
 * 事还在本卦里，取本卦；动过半，事已到变卦那边，改取变卦里**没动的**那几爻 ——
 * 不动的才是变卦里站得住的部分。三爻动恰好一半，两卦并取。
 *
 * ⚠️ 此前的取法是「有动爻取每个动爻（本卦→变卦同位）、六爻皆静看世应」。
 * 两处都换了：多爻动时动爻不再逐个照取；静卦不再看世应（那是纳甲断卦看世应
 * 的规矩借过来的），改取卦辞。原型把静卦的应爻标作「将来」的那个错
 * （应是对方，不是将来），随世应一路一起退出了这一层。
 *
 * 按时起卦（默认）恒得一个动爻，故走的一直是第二例；其余六例只在掷钱时出现。
 *
 * ## 哪一层载哪几项、过哪一道闸
 *
 * 语料四类文字里，**爻位阶段与白话转述通篇是第二人称**，而技术层禁第二人称
 * （`zh.secondPerson.address`）。按技术层的闸扫，白话转述 448 条拦 444 条 ——
 * 全数拦下的东西不该端上去让读者看几百遍「未通过检查」。
 *
 * 两项的处置不同：
 *
 * - **爻位阶段**技术层不载。它说的是爻位，不是卦爻辞的意思，技术层用不上。
 * - **白话转述**两层都载 —— 卦爻辞原文读者多半读不懂，原文旁边得有一段白话。
 *   它一律按**人话层**的闸过（`scanPlain`）：那是为第二人称语域写的闸，
 *   比技术层的闸只少「禁第二人称」一条，另多六条（祈使、可照做的指定等）。
 *   所以这不是给引文开豁免，是按它所在的语域换一道闸；报告层的统扫也照此分闸
 *   （{@link collectYaociText} 的 `gate`）。
 *
 * | | 卦爻辞原文 | 一句话指事 | 爻位阶段 | 白话转述 |
 * | 技术层 | ✅ | ✅ | —— | ✅（人话层的闸） |
 * | 人话层 | ✅（作出处） | ✅ | ✅（爻辞才有） | ✅ |
 *
 * 载了的每一项仍要过 `screen`。
 */

import type { HexagramInfo } from "../yijing/hexagrams.js";
import {
  stageOf, yaociAt, receivedIndexOf, GUA_SLOT,
  type YaociEntry, type YaociLocale, type YaociSlot, type YaoPos,
} from "../yijing/yaoci.js";
import { screen, type GuardLayer, type Screened } from "../report/screen.js";
import type { DressedGua } from "./dress.js";
import type { Yongshen } from "./yongshen.js";

/** 动爻数 —— 七例各对一个。 */
export type MovingCount = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** 所取之辞出自哪一卦。 */
export type YaociSource = "本卦" | "变卦";
/**
 * 所取之辞在这一例里的分量。
 *
 * 只取一条时为「主」；二爻动、四爻动分「主／次」；三爻动分「体／用」。
 */
export type YaociRole = "主" | "次" | "体" | "用";

/**
 * 一条过了闸的引文。
 *
 * `text` 为 null 且 `withheld` 非空 —— 被守卫拦下，`withheld` 是规则 id。
 * 整个 `Quote` 为 null —— 这一层不载此项，与守卫无关。
 */
export type Quote = Screened;

export interface YaociQuotes {
  /** 《周易》原文。 */
  readonly classic: Quote;
  /** 一句话指事。爻辞取自语料，卦辞取自本项目撰述（`yijing/guaGist.ts`）。 */
  readonly gist: Quote;
  /**
   * 白话转述。语料作者的现代转述，**不是逐字直译**。两层都载，
   * 一律按人话层的闸过 —— 它通篇第二人称（见模块头）。
   */
  readonly expand: Quote;
}

/** 取辞的一格 —— 与语言、层无关。 */
export interface YaociSlotPick {
  readonly source: YaociSource;
  /** 0 为卦辞，1–6 为爻辞。 */
  readonly slot: YaociSlot;
  readonly role: YaociRole;
}

export interface YaociPick extends YaociSlotPick {
  /** 爻位本身的阶段 —— 与是哪一卦无关。卦辞没有；技术层不载。均为 null。 */
  readonly stage: Quote | null;
  readonly quotes: YaociQuotes;
  /** 该爻位是否为用神所在。卦辞恒为 false。**只作记录**，不参与任何判断。 */
  readonly isYongshen: boolean;
}

export interface YaociGua {
  readonly name: string;
  /** 通行本卦序 0–63。 */
  readonly received: number;
}

export interface YaociReading {
  readonly locale: YaociLocale;
  readonly layer: GuardLayer;
  /** 动爻位，升序。 */
  readonly moving: readonly YaoPos[];
  readonly count: MovingCount;
  readonly gua: { readonly ben: YaociGua; readonly bian: YaociGua | null };
  /** 所取之辞，主（或体）在前。 */
  readonly picks: readonly YaociPick[];
  /** 取到的爻位里含用神位。 */
  readonly hitsYongshen: boolean;
  /** 本层所载的引文条数，与其中被守卫拦下的条数。 */
  readonly quoted: number;
  readonly withheldCount: number;
}

export interface YaociOptions {
  readonly locale?: YaociLocale;
  /** 技术层用 `scanText`（禁第二人称），人话层用 `scanPlain`。默认技术层。 */
  readonly layer?: GuardLayer;
}

const ALL_POS: readonly YaoPos[] = [1, 2, 3, 4, 5, 6];

/**
 * 七例取辞。只看动爻在哪几位，不看卦、不看用神 —— 故单列出来，可以穷举着测。
 *
 * @param moving 动爻位，任意次序；重复或越界抛错。
 */
export function zhishiSlots(moving: readonly number[]): readonly YaociSlotPick[] {
  const m = [...new Set(moving)].sort((a, b) => a - b) as YaoPos[];
  if (m.length !== moving.length || m.some((p) => !ALL_POS.includes(p))) {
    throw new Error(`非法动爻位：${moving.join(",")}`);
  }
  const still = ALL_POS.filter((p) => !m.includes(p));
  const ben = (slot: YaociSlot, role: YaociRole): YaociSlotPick => ({ source: "本卦", slot, role });
  const bian = (slot: YaociSlot, role: YaociRole): YaociSlotPick => ({ source: "变卦", slot, role });
  switch (m.length as MovingCount) {
    case 0: return [ben(GUA_SLOT, "主")];
    case 1: return [ben(m[0]!, "主")];
    case 2: return [ben(m[1]!, "主"), ben(m[0]!, "次")];          // 上者为主
    case 3: return [ben(GUA_SLOT, "体"), bian(GUA_SLOT, "用")];
    case 4: return [bian(still[0]!, "主"), bian(still[1]!, "次")]; // 下者为主
    case 5: return [bian(still[0]!, "主")];
    case 6: return [bian(GUA_SLOT, "主")];
  }
}

function quotesOf(
  received: number, slot: YaociSlot, locale: YaociLocale, layer: GuardLayer,
): YaociQuotes {
  // 原文与指事按本层的闸；白话转述恒按人话层的闸（第二人称语域）。
  const e: YaociEntry = yaociAt(received, slot, locale);
  const at = (kind: string) => `yaoci.${kind}.${received}.${slot}`;
  return {
    classic: screen(e.classic, layer, at("classic")),
    gist: screen(e.gist, layer, at("gist")),
    expand: screen(e.expand, "plain", at("expand")),
  };
}

/** 取辞的结果 —— 与语言、层无关的那一半。 */
interface Selection {
  readonly moving: readonly YaoPos[];
  readonly ben: YaociGua;
  readonly bian: YaociGua | null;
  readonly slots: readonly YaociSlotPick[];
  readonly yongPos: number | null;
}

function select(gua: DressedGua, ys: Yongshen | null): Selection {
  const moving = gua.yaos.filter((y) => y.moving).map((y) => y.pos as YaoPos);
  const of = (h: HexagramInfo): YaociGua => ({ name: h.name, received: receivedIndexOf(h) });
  const slots = zhishiSlots(moving);
  if (gua.bian === null && slots.some((s) => s.source === "变卦")) {
    throw new Error("有动爻却没有变卦");
  }
  return {
    moving, ben: of(gua.ben), bian: gua.bian === null ? null : of(gua.bian),
    slots, yongPos: ys?.yao?.pos ?? null,
  };
}

function build(sel: Selection, locale: YaociLocale, layer: GuardLayer): YaociReading {
  const picks: YaociPick[] = sel.slots.map((s) => {
    const g = s.source === "本卦" ? sel.ben : sel.bian!;
    return {
      ...s,
      stage: s.slot === GUA_SLOT || layer === "technical" ? null
        : screen(stageOf(s.slot, locale), layer, `yaoci.stage.${s.slot}`),
      quotes: quotesOf(g.received, s.slot, locale, layer),
      isYongshen: s.slot !== GUA_SLOT && sel.yongPos === s.slot,
    };
  });

  const carried: Quote[] = [];
  const take = (q: Quote | null) => { if (q !== null) carried.push(q); };
  for (const p of picks) {
    take(p.stage); take(p.quotes.classic); take(p.quotes.gist); take(p.quotes.expand);
  }

  return {
    locale, layer,
    moving: Object.freeze([...sel.moving]),
    count: sel.moving.length as MovingCount,
    gua: { ben: sel.ben, bian: sel.bian },
    picks: Object.freeze(picks),
    hitsYongshen: picks.some((p) => p.isYongshen),
    quoted: carried.length,
    withheldCount: carried.filter((q) => q.text === null).length,
  };
}

export function yaociReading(
  gua: DressedGua, ys: Yongshen | null, options: YaociOptions = {},
): YaociReading {
  return build(select(gua, ys), options.locale ?? "zh-Hans", options.layer ?? "technical");
}

/**
 * 换一层重取同一份指事。
 *
 * 人话层要的三项（爻位阶段、白话转述、以及按人话守卫重筛的指事）技术层不载，
 * 而人话渲染只拿得到 `QuestionReport`，拿不到 `DressedGua`。取辞的结果里
 * 已经带着通行本卦序与格号，够重取一遍 —— 于是**不必把装好的卦一路传下去**，
 * 也不必在报告里塞两份读法。
 *
 * 取辞本身不重来：换层只换引哪几项、按哪套守卫筛，取的是同样那几格。
 *
 * 用神位只由 `isYongshen` 反推，故未被取到的用神位在此丢失 —— 无妨：
 * 它唯一的用处就是标记「取到的这几位里有没有用神」，未取到的位置本就不参与。
 */
export function relayerYaoci(
  r: YaociReading, layer: GuardLayer, locale: YaociLocale = r.locale,
): YaociReading {
  return build({
    moving: r.moving,
    ben: r.gua.ben,
    bian: r.gua.bian,
    slots: r.picks.map(({ source, slot, role }) => ({ source, slot, role })),
    yongPos: r.picks.find((p) => p.isYongshen)?.slot ?? null,
  }, locale, layer);
}

/**
 * 白话转述的框定语。凡把白话转述端给读者的地方（Markdown、Web）都带这一句：
 * 它是转述不是直译；它的第二人称是语料作者的口吻，不是本引擎对读者说话。
 * 这一句本身是引擎的话，故自己不用第二人称。
 */
export const EXPAND_NOTE =
  "白话转述 —— 语料作者对原文的现代转述，不是逐字直译；文中的第二人称是转述者的口吻，"
  + "不是本推演对读者的建议。";

/** 一格所取之辞的出处：「本卦风水涣卦辞」「变卦山水蒙第 3 爻」。 */
export function pickSource(r: YaociReading, p: YaociSlotPick): string {
  const g = p.source === "本卦" ? r.gua.ben : r.gua.bian;
  return `${p.source}${g?.name ?? ""}${p.slot === GUA_SLOT ? "卦辞" : `第 ${p.slot} 爻`}`;
}

/**
 * 走遍一份指事，把每一段**会到达读者**的字取出来 —— 供报告层统扫。
 *
 * `where` 一律带 {@link QUOTE_PREFIX} 前缀。这不是装饰：报告层的其余文字都是
 * 本引擎写的，繁体由 `toHant` 机械转出，故有一条硬测试要求「每个汉字都已归类」；
 * 引文不同 —— 它有自己的繁体原文，**不经转换**，也就不该被那条测试要求归类。
 * 一个前缀把两类分开，省得日后在几百个爻辞用字上做无谓的简繁对照。
 */
export const QUOTE_PREFIX = "quote:";

export interface CollectedQuote {
  readonly text: string;
  readonly where: string;
  /** 统扫时该用哪一道闸。白话转述恒为 `plain`，其余随读法所在的层。 */
  readonly gate: GuardLayer;
}

export function collectYaociText(r: YaociReading): CollectedQuote[] {
  const out: CollectedQuote[] = [];
  const push = (q: Quote | null, w: string, gate: GuardLayer = r.layer) => {
    if (q?.text != null && q.text.length > 0) out.push({ text: q.text, where: QUOTE_PREFIX + w, gate });
  };
  for (const p of r.picks) {
    const at = `yaoci.${p.source === "本卦" ? "ben" : "bian"}.${p.slot}`;
    push(p.stage, `${at}.stage`);
    push(p.quotes.classic, `${at}.classic`);
    push(p.quotes.gist, `${at}.gist`);
    push(p.quotes.expand, `${at}.expand`, "plain");
  }
  return out;
}

/**
 * 按人话层的闸过过的那几段引文原文（目前只有白话转述）。
 *
 * 给出口扫描用：CLI 在打印前会对整份输出再扫一遍技术层规则，而白话转述是第二人称
 * 语域，按技术层规则必然被拦。出口拿这份清单，对这几段改用人话层规则、其余照旧 ——
 * 总闸一条不减，只是每段按它的语域扫。被拦下的（`text` 为 null）不在其中：它们本就没印出来。
 */
export function plainGatedSpans(r: YaociReading): string[] {
  return collectYaociText(r).filter((c) => c.gate === "plain").map((c) => c.text);
}

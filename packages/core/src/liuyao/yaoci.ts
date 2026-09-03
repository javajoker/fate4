/**
 * Q7 指事 —— 从卦里取出「说的是什么事」。
 *
 * ## 这一层不断卦，也不参与断卦
 *
 * 纳甲断法（Q1–Q5）与象辞（爻辞）本来是**两套系统**。京房一路看的是六亲、
 * 生克、旬空月破，一句爻辞都不用；文王卦的民间用法才把两者并起来读。
 *
 * 本项目照旧只用纳甲断，爻辞进来只作**指事** —— 给「用神偏无力」这类结构判断
 * 配上具体的所指（旅行、争讼、婚嫁、田猎）。故：
 *
 * - 爻辞**不改动任何判断**，不进 `Judgement`，不影响应期；
 * - 取爻按象辞自己的规矩（见下），**不按用神**；
 * - 取出来的位置是否恰好是用神位，只作一行记录（{@link YaociReading.hitsYongshen}），
 *   不作「两法相符」的加权 —— 那与合参一节「一致不等于互证」是同一条纪律。
 *
 * ## 取爻
 *
 * | 卦况 | 取 | 依据 |
 * | 有动爻 | 每个动爻，本卦爻 → 变卦同位爻 | 动爻为事之所主 |
 * | 六爻皆静 | 世爻与应爻 | 《增删卜易》静卦看世应 |
 *
 * ⚠️ 静卦这一路，原型代码把应爻写作「将来」。**应不是将来，是对方。**
 * 世应是一组空间关系（我方／他方），不是时间关系；把它读成时间，等于凭空
 * 多出一条对未来的话。此处照实标 {@link YaociRole}：世爻、应爻。
 * 唯有动爻那一路的本卦→变卦才真是「由此及彼」。
 *
 * 按时起卦（默认）恒得一个动爻，故走的一直是第一路；世应那一路只在掷钱
 * 六爻皆静时出现 —— 掷钱法下约六分之一。
 *
 * ## 世爻不靠算
 *
 * 民间有一套从卦画推世爻的口诀（比对初四、二五、三上三组爻的异同）。原型实现
 * 它时把三个标志位用 `&` 而不是 `|` 合并，于是结果恒为 0，静卦一律取初爻。
 * 本项目不走这条路：世爻位置由八宫次序直接给出（`SHI_POSITION`），
 * 而八宫是生成的 —— 这类错误在结构上就发生不了。
 *
 * ## 哪一层载哪几项，是构造决定的
 *
 * 语料四类文字里，**爻位阶段与白话转述通篇是第二人称**，而技术层禁第二人称
 * （`zh.secondPerson.address`）。故这两项在技术层根本不取 —— 不是「取了被拦」，
 * 是这一层本就不载。实测也印证：技术层扫描下阶段一项 2184 条全数被拦，
 * 全数拦下的东西不该端上去让读者看 2184 遍「未通过检查」。
 *
 * | | 爻辞原文 | 一句话指事 | 爻位阶段 | 白话转述 |
 * | 技术层 | ✅ | ✅ | —— | —— |
 * | 人话层 | ✅（作出处） | ✅ | ✅ | ✅ |
 *
 * 载了的每一项仍要过 `screen`：实测技术层拦下 1.9%（全在指事），
 * 人话层拦下 3.1%（指事 1.0%、白话 10.0%），爻辞原文两层皆零。
 */

import type { HexagramInfo } from "../yijing/hexagrams.js";
import {
  stageOf, yaociAt, receivedIndexOf, GUA_SLOT,
  type YaociEntry, type YaociLocale, type YaoPos,
} from "../yijing/yaoci.js";
import { screen, type GuardLayer, type Screened } from "../report/screen.js";
import type { DressedGua } from "./dress.js";
import type { Yongshen } from "./yongshen.js";

export type YaociMethod = "动爻" | "世应";
export type YaociRole = "动爻" | "世爻" | "应爻";

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
  /** 一句话指事。卦辞格没有，为 null。 */
  readonly gist: Quote | null;
  /** 白话转述。技术层不载，为 null。 */
  readonly expand: Quote | null;
}

export interface YaociPick {
  readonly pos: YaoPos;
  readonly role: YaociRole;
  /** 爻位本身的阶段 —— 与是哪一卦无关。技术层不载，为 null。 */
  readonly stage: Quote | null;
  readonly ben: YaociQuotes;
  /** 变卦同位 —— 只有动爻有。 */
  readonly bian: YaociQuotes | null;
  /** 该位是否为用神所在。**只作记录**，不参与任何判断。 */
  readonly isYongshen: boolean;
}

export interface YaociGua {
  readonly name: string;
  /** 通行本卦序 0–63。 */
  readonly received: number;
  readonly classic: Quote;
  readonly expand: Quote | null;
}

export interface YaociReading {
  readonly locale: YaociLocale;
  readonly layer: GuardLayer;
  readonly method: YaociMethod;
  readonly gua: { readonly ben: YaociGua; readonly bian: YaociGua | null };
  readonly picks: readonly YaociPick[];
  /** 取到的位置里含用神位。 */
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

function quotesOf(
  received: number, slot: 0 | YaoPos, locale: YaociLocale, layer: GuardLayer,
): YaociQuotes {
  const e: YaociEntry = yaociAt(received, slot, locale);
  const at = (kind: string) => `yaoci.${kind}.${received}.${slot}`;
  return {
    classic: screen(e.classic, layer, at("classic")),
    gist: e.gist === null ? null : screen(e.gist, layer, at("gist")),
    expand: layer === "technical" ? null : screen(e.expand, layer, at("expand")),
  };
}

/** 取爻的结果 —— 与语言、层无关的那一半。 */
interface Selection {
  readonly method: YaociMethod;
  readonly ben: { readonly name: string; readonly received: number };
  readonly bian: { readonly name: string; readonly received: number } | null;
  readonly positions: readonly { readonly pos: YaoPos; readonly role: YaociRole }[];
  readonly yongPos: number | null;
}

/** 取爻。见本模块开头的「取爻」一节。 */
function select(gua: DressedGua, ys: Yongshen | null): Selection {
  const moving = gua.yaos.filter((y) => y.moving);
  const of = (h: HexagramInfo) => ({ name: h.name, received: receivedIndexOf(h) });
  return {
    method: moving.length > 0 ? "动爻" : "世应",
    ben: of(gua.ben),
    bian: gua.bian === null ? null : of(gua.bian),
    positions: moving.length > 0
      ? moving.map((y) => ({ pos: y.pos as YaoPos, role: "动爻" as const }))
      : [
        { pos: gua.shi as YaoPos, role: "世爻" as const },
        { pos: gua.ying as YaoPos, role: "应爻" as const },
      ],
    yongPos: ys?.yao?.pos ?? null,
  };
}

function build(sel: Selection, locale: YaociLocale, layer: GuardLayer): YaociReading {
  const picks: YaociPick[] = sel.positions.map(({ pos, role }) => ({
    pos, role,
    stage: layer === "technical" ? null
      : screen(stageOf(pos, locale), layer, `yaoci.stage.${pos}`),
    ben: quotesOf(sel.ben.received, pos, locale, layer),
    bian: role === "动爻" && sel.bian !== null
      ? quotesOf(sel.bian.received, pos, locale, layer) : null,
    isYongshen: sel.yongPos === pos,
  }));

  const guaOf = (g: { name: string; received: number }): YaociGua => {
    const q = quotesOf(g.received, GUA_SLOT, locale, layer);
    return { name: g.name, received: g.received, classic: q.classic, expand: q.expand };
  };
  const ben = guaOf(sel.ben);
  const bian = sel.bian === null ? null : guaOf(sel.bian);

  const carried: Quote[] = [];
  const take = (q: Quote | null) => { if (q !== null) carried.push(q); };
  take(ben.classic); take(ben.expand);
  if (bian !== null) { take(bian.classic); take(bian.expand); }
  for (const p of picks) {
    take(p.stage); take(p.ben.classic); take(p.ben.gist); take(p.ben.expand);
    take(p.bian?.classic ?? null); take(p.bian?.gist ?? null); take(p.bian?.expand ?? null);
  }

  return {
    locale, layer, method: sel.method,
    gua: { ben, bian },
    picks: Object.freeze(picks),
    hitsYongshen: sel.yongPos !== null && picks.some((p) => p.isYongshen),
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
 * 而人话渲染只拿得到 `QuestionReport`，拿不到 `DressedGua`。取爻的结果里
 * 已经带着通行本卦序与爻位，够重取一遍 —— 于是**不必把装好的卦一路传下去**，
 * 也不必在报告里塞两份读法。
 *
 * 取爻本身不重来：换层只换引哪几项、按哪套守卫筛，取的是同样那几个位置。
 *
 * 用神位只由 `isYongshen` 反推，故未被取到的用神位在此丢失 —— 无妨：
 * 它唯一的用处就是标记「取到的这几位里有没有用神」，未取到的位置本就不参与。
 */
export function relayerYaoci(
  r: YaociReading, layer: GuardLayer, locale: YaociLocale = r.locale,
): YaociReading {
  return build({
    method: r.method,
    ben: { name: r.gua.ben.name, received: r.gua.ben.received },
    bian: r.gua.bian === null ? null
      : { name: r.gua.bian.name, received: r.gua.bian.received },
    positions: r.picks.map((p) => ({ pos: p.pos, role: p.role })),
    yongPos: r.picks.find((p) => p.isYongshen)?.pos ?? null,
  }, locale, layer);
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

export function collectYaociText(r: YaociReading): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = [];
  const push = (q: Quote | null, w: string) => {
    if (q?.text != null && q.text.length > 0) out.push({ text: q.text, where: QUOTE_PREFIX + w });
  };
  push(r.gua.ben.classic, "yaoci.gua.ben.classic");
  push(r.gua.ben.expand, "yaoci.gua.ben.expand");
  push(r.gua.bian?.classic ?? null, "yaoci.gua.bian.classic");
  push(r.gua.bian?.expand ?? null, "yaoci.gua.bian.expand");
  for (const p of r.picks) {
    push(p.stage, `yaoci.${p.pos}.stage`);
    push(p.ben.classic, `yaoci.${p.pos}.ben.classic`);
    push(p.ben.gist, `yaoci.${p.pos}.ben.gist`);
    push(p.ben.expand, `yaoci.${p.pos}.ben.expand`);
    push(p.bian?.classic ?? null, `yaoci.${p.pos}.bian.classic`);
    push(p.bian?.gist ?? null, `yaoci.${p.pos}.bian.gist`);
    push(p.bian?.expand ?? null, `yaoci.${p.pos}.bian.expand`);
  }
  return out;
}

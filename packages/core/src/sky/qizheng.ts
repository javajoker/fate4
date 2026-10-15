/**
 * 七政四余的庙旺利陷 —— 以及一个不能拿它来证明的结论。
 *
 * ## 先说这张表最要紧的一件事
 *
 * 下面这张庙旺表，与 `dignities.ts` 里西洋古典那张**几乎逐格相同**：
 * 太阳庙狮子旺白羊、太阴庙巨蟹旺金牛、火星庙白羊天蝎旺磨羯……
 *
 * 看见这个，很容易写下一句漂亮的结论：「东西方各自独立发展出了同一张表，
 * 可见它反映的是天本身。」
 *
 * **那句话不能从这里得出，而且多半是错的。**
 *
 * 两个理由：
 *
 * 1. **历史上它本来就是传过来的。** 七政四余唐代随佛经与西域历法入华
 *    （《七曜攘灾决》《都利聿斯经》），而印度那一套与希腊化天文同源。
 *    同一张表出现在两处，最简单的解释是**它只被发明过一次**。
 *    那是文化传播的证据，不是天文必然性的证据。
 *
 * 2. ⚠️ **更要紧的一条：本表的来源是转录，而转录者读过西洋那张表。**
 *    一个读过 A 表的人凭记忆写下 B 表，写出来的 B 像 A，
 *    **不构成 B 本来就像 A 的证据** —— 它也可能只是记混了。
 *    这是本项目的数据风险里最隐蔽的一种：前面那些（《穷通宝鉴》120 格、
 *    埃及界 60 条）错了只是错，而这一张若错，会错得**恰好支持一个动听的结论**。
 *
 * 所以本模块给出表与对照，但**不给出那个结论**。要坐实它，须拿
 * 《果老星宗》一类实体书逐宫核对，并且最好由不曾先读西洋表的人来核。
 * 已列入 `QIZHENG_PENDING_CALIBRATION`。
 *
 * ## 真正能从这里得出的，是另一件事
 *
 * 七政四余与西洋占星共用的**天**是算得出来的：日月五星的黄经是同一组数，
 * 上升点是同一个点（见 `chart.ts`）。那一层不依赖任何转录，
 * 由 `test/planets.spec.ts` 对 Astronomy Engine 逐点核过。
 *
 * **天是共用的，这一点有证据；表是不是独立的，这一点没有。**
 * 两者不可混为一谈 —— 而把它们混为一谈，恰恰是这类比较研究最常见的毛病。
 *
 * ## 十二宫的地支分野
 *
 * 七政四余的宫配地支：戌白羊、酉金牛、申阴阳（双子）、未巨蟹、午狮子、
 * 巳双女、辰天秤、卯天蝎、寅人马、丑磨羯、子宝瓶、亥双鱼。
 *
 * 地支**逆行**，因为它记的是太阳在天盘上的位置，而天盘左旋。
 * 这与六壬月将是同一套分野 —— 故本模块直接取 `YUEJIANG_ZODIAC`，
 * 不另抄一份（见 `compare/substrate.ts` 对「月将与太阳星座是同一件事」的说明）。
 */

import { norm360 } from "../astro/angles.js";
import { YUEJIANG_ZODIAC, TROPICAL_SIGNS } from "../compare/substrate.js";
import { signIndexOf, degreeInSign } from "./angles.js";
import {
  DOMICILE, EXALTATION, BODY_NAME, CLASSICAL_BODIES, type ClassicalBody,
} from "./dignities.js";

/**
 * 十二宫的七政四余传统名。
 *
 * 与 `TROPICAL_SIGNS` 的现代名并列而非替换：同一宫，两套叫法。
 * 现代通行「射手」「水瓶」，《果老星宗》一系作「人马」「宝瓶」，
 * 双子作「阴阳」、处女作「双女」、摩羯作「磨羯」。
 *
 * 这份别名**不是装饰**：读古籍时宫名对不上，是第一道门槛。
 */
export const QIZHENG_PALACE_NAME: readonly string[] = Object.freeze([
  "白羊", "金牛", "阴阳", "巨蟹", "狮子", "双女",
  "天秤", "天蝎", "人马", "磨羯", "宝瓶", "双鱼",
]);

export interface QizhengPalace {
  /** 宫序，0 = 白羊。 */
  readonly index: number;
  /** 七政四余传统名。 */
  readonly name: string;
  /** 现代通行名（取自 `TROPICAL_SIGNS`）。 */
  readonly modernName: string;
  /** 地支分野。 */
  readonly branch: string;
}

export const QIZHENG_PALACES: readonly QizhengPalace[] = Object.freeze(
  QIZHENG_PALACE_NAME.map((name, index) => {
    const modernName = TROPICAL_SIGNS[index]!.name;
    // 地支由月将表反查 —— 不另抄一份，抄了就会分叉
    const branch = YUEJIANG_ZODIAC.find((y) => y.zodiac === modernName)!.branch;
    return Object.freeze({ index, name, modernName, branch });
  }),
);

/**
 * 庙与旺 —— **本表为凭记忆转录，未经实体书核对。** 见文件头的警告。
 *
 * `miao` 是庙宫（五星各二、日月各一），`wang` 是旺宫。
 * 陷与落不在表里：它们由庙旺的对宫**推出**，与 `dignities.ts` 同一做法 ——
 * 另立表就有两份会不一致的真相。
 *
 * 旺的**度数**不收：希腊化一系与印度一系的旺度本就不同
 * （如太阳旺于白羊，希腊化作 19°，印度一系作 10°），
 * 而中土文献是否保留度数、保留的是哪一系，本人无可靠依据。
 * **不确定的东西宁可不给，也不给一个看起来精确的数。**
 */
export const QIZHENG_DIGNITY: Readonly<Record<ClassicalBody, {
  readonly miao: readonly number[];
  readonly wang: number;
}>> = Object.freeze({
  sun: { miao: [4], wang: 0 },              // 庙狮子，旺白羊
  moon: { miao: [3], wang: 1 },             // 庙巨蟹，旺金牛
  mercury: { miao: [2, 5], wang: 5 },       // 庙阴阳双女，旺双女
  venus: { miao: [1, 6], wang: 11 },        // 庙金牛天秤，旺双鱼
  mars: { miao: [0, 7], wang: 9 },          // 庙白羊天蝎，旺磨羯
  jupiter: { miao: [8, 11], wang: 3 },      // 庙人马双鱼，旺巨蟹
  saturn: { miao: [9, 10], wang: 6 },       // 庙磨羯宝瓶，旺天秤
});

export type QizhengState = "庙" | "旺" | "陷" | "落" | "平";

export interface QizhengPlacement {
  readonly body: ClassicalBody;
  readonly name: string;
  readonly palace: QizhengPalace;
  /** 宫内度数，[0, 30)。 */
  readonly degree: number;
  /**
   * 该星在该宫的状态。
   *
   * 一颗星可以同时占两项（如庙宫恰为另一星的旺宫不相干；但自身的庙与旺
   * 在本表里互不重合），故返回数组而非单值 —— 本表虽无重合，
   * 但「返回单值」这个形状会在日后收录更多档位（得地、利、受制）时挡路。
   */
  readonly states: readonly QizhengState[];
  /** 逐项的来历。 */
  readonly why: readonly string[];
}

/** 一颗星在某黄经上的庙旺利陷。 */
export function qizhengStateOf(
  body: ClassicalBody, longitude: number,
): QizhengPlacement {
  const idx = signIndexOf(longitude);
  const palace = QIZHENG_PALACES[idx]!;
  const d = QIZHENG_DIGNITY[body];
  const states: QizhengState[] = [];
  const why: string[] = [];

  if (d.miao.includes(idx)) {
    states.push("庙");
    why.push(`${palace.name}宫为其庙`);
  }
  if (d.wang === idx) {
    states.push("旺");
    why.push(`${palace.name}宫为其旺`);
  }
  // 陷落由对宫推出，不另立表
  if (d.miao.includes((idx + 6) % 12)) {
    states.push("陷");
    why.push(`${palace.name}宫为其庙（${QIZHENG_PALACE_NAME[(idx + 6) % 12]}）之对宫，故陷`);
  }
  if (d.wang === (idx + 6) % 12) {
    states.push("落");
    why.push(`${palace.name}宫为其旺（${QIZHENG_PALACE_NAME[(idx + 6) % 12]}）之对宫，故落`);
  }
  if (states.length === 0) {
    states.push("平");
    why.push(`${palace.name}宫于本星无庙旺陷落，为平`);
  }

  return {
    body, name: BODY_NAME[body], palace,
    degree: degreeInSign(longitude), states, why,
  };
}

/** 七政在一张盘上的庙旺利陷。 */
export const qizhengStates = (
  longitudes: Readonly<Record<ClassicalBody, number>>,
): readonly QizhengPlacement[] =>
  CLASSICAL_BODIES.map((b) => qizhengStateOf(b, norm360(longitudes[b])));

// ═════════════════════════════════════════════════════════
// 与西洋古典的逐格对照
// ═════════════════════════════════════════════════════════

export interface TableComparison {
  readonly body: ClassicalBody;
  readonly name: string;
  /** 庙宫是否逐格相同。 */
  readonly domicileSame: boolean;
  /** 旺宫是否相同。 */
  readonly exaltationSame: boolean;
  readonly qizhengMiao: readonly string[];
  readonly westernDomicile: readonly string[];
  readonly qizhengWang: string;
  readonly westernExaltation: string;
}

/**
 * 把两张表摆在一起，逐格报出异同。
 *
 * ⚠️ **这个函数产出的是一个观察，不是一个论证。** 见文件头：
 * 两张表相同最可能的解释是它只被发明过一次（唐代传入），
 * 而本表的转录者读过西洋那张表，故「相同」这件事本身还带着污染风险。
 *
 * 之所以仍然把它算出来而不是只写在注释里：**算出来的东西可以被推翻**。
 * 哪天有人拿实体书核出某一格不同，这个函数当场就报出来，
 * 而一句写死在文档里的「两张表相同」不会。
 *
 * `table` 可注入，是为了让测试能证明这个对照**认得出不同** ——
 * 现状是七格全同，若不注入一张故意改过的表，那条测试就无法区分
 * 「确实相同」与「这个函数恒返回 true」。
 */
export function compareWithHellenistic(
  table: typeof QIZHENG_DIGNITY = QIZHENG_DIGNITY,
): readonly TableComparison[] {
  return CLASSICAL_BODIES.map((body) => {
    const q = table[body];
    const westernDom: number[] = [];
    DOMICILE.forEach((ruler, i) => { if (ruler === body) westernDom.push(i); });
    const westEx = EXALTATION[body].sign;
    const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);
    return {
      body, name: BODY_NAME[body],
      domicileSame: sorted(q.miao).join() === sorted(westernDom).join(),
      exaltationSame: q.wang === westEx,
      qizhengMiao: sorted(q.miao).map((i) => QIZHENG_PALACE_NAME[i]!),
      westernDomicile: sorted(westernDom).map((i) => TROPICAL_SIGNS[i]!.name),
      qizhengWang: QIZHENG_PALACE_NAME[q.wang]!,
      westernExaltation: TROPICAL_SIGNS[westEx]!.name,
    };
  });
}

/**
 * 四余的庙旺：**本项目不收**。
 *
 * 各家对罗睺计都月孛紫炁的庙旺配置差异很大，而本人无可靠来源。
 * 收一个拿不准的表，比不收坏 —— 不收至少读者知道这里没有东西，
 * 收了错的，读者会拿它去推论。
 *
 * 紫炁另有一层：它连天体对应都没有公认说法
 * （见 `compare/correspondence.ts`），故连位置都算不出，遑论庙旺。
 */
export const SIYU_DIGNITY_NOT_INCLUDED =
  "四余的庙旺各家差异大，本项目不收录；紫炁连天体对应都无公认说法，位置亦算不出。";

export const QIZHENG_PENDING_CALIBRATION: readonly string[] = Object.freeze([
  "七政四余庙旺表（凭记忆转录，未经《果老星宗》一类实体书逐宫核对）",
  "⚠️ 上一条的转录者读过西洋古典的庙旺表，故「两表相同」这一观察带污染风险，"
    + "最好由不曾先读西洋表的人复核",
  "旺的度数（希腊化与印度两系本就不同，中土文献保留哪一系无依据，故未收录）",
  "得地、利、受制一类更细的档位（本项目只做庙旺陷落平五档）",
  "四余的庙旺（各家差异大，未收录）",
]);

/**
 * 洗牌、切牌与牌阵 —— 以及一条与六爻正好相反的规矩。
 *
 * ## 这里的随机是真的，而且必须是真的
 *
 * 六爻那边本项目拒绝过一件事：把**问题文本的哈希**掺进起卦，好让不同的
 * 问题得到不同的卦。拒绝的理由是那会**发明一种传统里没有的方法，
 * 还伪装成传统** —— 把一个确定性系统偷偷变成伪随机系统，而使用者不知道。
 *
 * 塔罗正好相反：**它本来就是随机的**，洗牌是它的起法本身。
 * 所以这里该用真随机，而且不该掺任何「让结果更贴合问题」的东西。
 *
 * 用 `crypto.getRandomValues` 而不是 `Math.random()`：
 * 后者在多数引擎里是可预测的 PRNG，而一个**看起来随机、实际可预测**的
 * 洗牌，与上面那条「伪装」是同一类问题，只是藏得更深。
 *
 * ## 一事不二占在这里**不适用**
 *
 * 六爻有「一事不二占」：同一个问题当天只起一次，因为允许反复重问
 * 等于允许一直问到自己满意为止 —— 那样得到的不是占问，是挑选。
 *
 * 塔罗没有这条，而且**不该有**。它的每一次抽都是一次独立试验，
 * 「重抽就是另一次」是它的定义，不是它的漏洞。拿六爻的规矩套上来，
 * 是把确定性系统的伦理搬到随机系统上 —— 两者不通用。
 *
 * 这个差别不是风格，是 §6「确定还是随机」那条分界的直接后果。
 * 故本模块**不记录、不限制重抽**，并在结果里明写这一点。
 */

import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import {
  deck, DECK_SIZE, majorNumber, SUIT_ELEMENT,
  type Card, type DeckSchools, type MajorNumbering, type SuitElementSchool,
} from "./deck.js";

/** 一次抽取的随机源。可注入，仅为测试 —— 生产路径恒用 crypto。 */
export interface RandomSource {
  /** 返回 [0, n) 的整数，须无模偏。 */
  readonly int: (n: number) => number;
  readonly id: string;
}

/**
 * 默认随机源：`crypto.getRandomValues`，**拒绝取模**。
 *
 * 直接 `value % n` 会引入模偏：当 2³² 不是 n 的整数倍时，
 * 小的余数比大的多出现一次。78 张牌上这个偏差约 1e-8，实际看不出来 ——
 * 但「实际看不出来」不是正确的理由，而一个有偏的洗牌正是这类系统
 * 最不该有的东西。故用拒绝采样。
 */
export const cryptoRandom: RandomSource = {
  id: "crypto.getRandomValues",
  int(n: number): number {
    if (n <= 0) throw new Error("取值范围须为正");
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    for (;;) {
      crypto.getRandomValues(buf);
      const v = buf[0]!;
      if (v < limit) return v % n;
      // 落在尾巴上就重抽 —— 这几行就是「无模偏」的全部代价
    }
  },
};

/**
 * Fisher–Yates 洗牌。
 *
 * 自后向前、每次与 [0, i] 中的一个交换 —— 这是能给出**均匀排列**的那一版。
 * 常见的写法是每次与 [0, n) 中任一交换，那一版有偏（n^n 条路径
 * 落到 n! 个排列上，而 n^n 不被 n! 整除），且同样「实际看不出来」。
 */
export function shuffle<T>(xs: readonly T[], rnd: RandomSource): readonly T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd.int(i + 1);
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

export interface SpreadPosition {
  readonly index: number;
  readonly name: string;
  /** 这一位**问的是什么** —— 牌阵的意义全在这里，不在牌义里。 */
  readonly question: string;
}

export interface Spread {
  readonly id: string;
  readonly name: string;
  readonly positions: readonly SpreadPosition[];
  readonly note: string;
}

const pos = (xs: readonly (readonly [string, string])[]): readonly SpreadPosition[] =>
  Object.freeze(xs.map(([name, question], index) => ({ index, name, question })));

/**
 * 牌阵 —— 本项目只收**位置与问题**，不收牌义。
 *
 * 牌阵其实是这套东西里最经得起说的部分：它是一组**预先定好的问题**，
 * 在抽牌之前就固定下来。那与「先看到牌再决定它回答什么」有本质区别 ——
 * 后者是事后编故事，而预先定位置至少把这条路堵上了一半。
 *
 * 凯尔特十字的十个位置各家命名差异不小，此处取通行的一种，
 * 并列入待核对（见 `TAROT_PENDING_CALIBRATION`）。
 */
export const SPREADS: readonly Spread[] = Object.freeze([
  {
    id: "one", name: "单张",
    positions: pos([["此刻", "就这一件事，眼下最该看的是什么"]]),
    note: "最少的那一种。一张牌给不出情节，正好免掉编故事的余地。",
  },
  {
    id: "three", name: "三张",
    positions: pos([
      ["过去", "这件事从哪儿来"],
      ["现在", "眼下处在什么位置"],
      ["将来", "照现在这样下去会往哪儿走"],
    ]),
    note: "最常见的一种。⚠️ 第三位名为「将来」，但它问的是趋势，"
      + "不是预告 —— 本项目不替它把那一步跨过去。",
  },
  {
    id: "celtic", name: "凯尔特十字",
    positions: pos([
      ["现况", "这件事当下的样子"],
      ["横逆", "与它正面相交的是什么"],
      ["根柢", "底下压着的是什么"],
      ["已过", "刚刚过去的那一段"],
      ["头顶", "摆在明面上的目标或想法"],
      ["眼前", "马上要到的那一段"],
      ["自处", "你在这件事里的位置"],
      ["外缘", "外部环境与旁人"],
      ["所望", "你的期待与担忧 —— 两者常是同一件事"],
      ["结末", "照以上各条合起来看，走向哪里"],
    ]),
    note: "十张。状态数已逾 10²¹ —— 超过地球上活过的人数总和。"
      + "那不是优点：位置越多，事后拼出一个说得通的故事就越容易。",
  },
]);

export const spreadById = (id: string): Spread | undefined =>
  SPREADS.find((s) => s.id === id);

export interface DrawnCard {
  readonly position: SpreadPosition;
  readonly card: Card;
  /** 逆位。不用逆位时恒为 false。 */
  readonly reversed: boolean;
  /** 该流派下的大牌序号；小牌为 null。 */
  readonly majorNumber: number | null;
  /** 花色的元素 —— ⚠️ 十九世纪末的注解，不是来历。小牌才有。 */
  readonly suitElement: string | null;
}

export interface TarotReading {
  readonly spread: Spread;
  readonly cards: readonly DrawnCard[];
  readonly schools: DeckSchools;
  /** 随机源的标识 —— 与四柱的参数指纹同一用途：说清这个结果凭什么。 */
  readonly randomSource: string;
  /** 抽牌时刻。**不进算式**，只是一条记录。 */
  readonly at: string;
  readonly notes: readonly string[];
}

export interface DrawOptions {
  readonly spreadId?: string;
  /**
   * 流派取自 `Params.tarot`。
   *
   * 下面三个单项仍然留着，但它们是**覆盖**，不是真源 ——
   * 真源在参数里，因为这三样会改变结果，必须进参数指纹。
   */
  readonly params?: Params;
  readonly numbering?: MajorNumbering;
  readonly suitElement?: SuitElementSchool;
  readonly withReversals?: boolean;
  readonly random?: RandomSource;
  readonly now?: Date;
}

/**
 * 抽一个牌阵。
 *
 * **这个函数没有「问题」参数，而且不该有。** 问题文本不进算式 ——
 * 塔罗的随机不以问题为输入，掺进去就成了伪随机（见文件头）。
 * 问题该留在抽牌的人心里与牌阵的位置名里，不该进这台机器。
 */
export function drawSpread(options: DrawOptions = {}): TarotReading {
  const spread = spreadById(options.spreadId ?? "three") ?? SPREADS[1]!;
  // 次序：单项覆盖 > 参数 > 默认参数。三者都不给时走 DEFAULT_PARAMS，
  // 故「默认值的真源」仍只有 params/defaults.ts 一处。
  const t = (options.params ?? DEFAULT_PARAMS).tarot;
  const numbering = options.numbering ?? t.numbering;
  const suitElement = options.suitElement ?? t.suitElement;
  const withReversals = options.withReversals ?? t.withReversals;
  const rnd = options.random ?? cryptoRandom;

  const shuffled = shuffle(deck(), rnd);
  const cards: DrawnCard[] = spread.positions.map((p, i) => {
    const card = shuffled[i]!;
    return {
      position: p,
      card,
      reversed: withReversals ? rnd.int(2) === 1 : false,
      majorNumber: majorNumber(card, numbering),
      suitElement: card.suit === undefined
        ? null : SUIT_ELEMENT[suitElement][card.suit],
    };
  });

  const notes: string[] = [
    "这一抽「不可复算」。塔罗的每一次抽牌都是一次独立试验，"
    + "重抽就是另一次 —— 那是它的定义，不是它的漏洞。",
    "与六爻不同，这里没有「一事不二占」。那条规矩属于确定性系统："
    + "六爻反复重问等于一直问到自己满意，而塔罗本来就按次计。",
    "⚠️ 起牌不需要知道今天是哪天。九套占法里只有这一套如此 ——"
    + "它的天文含量为零，上面那个时刻只是一条记录，不进任何算式。",
  ];
  if (card_hasMinor(cards)) {
    notes.push(
      "花色与元素的对应（权杖火、圣杯水一类）是 1888 年起金色黎明一系"
      + "后加的注解，不是塔罗的来历，也不进起牌。"
      + "把注解当本文，得出的「塔罗与占星同源」是循环论证。");
  }

  return {
    spread, cards,
    schools: { numbering, suitElement, withReversals },
    randomSource: rnd.id,
    at: (options.now ?? new Date()).toISOString(),
    notes: Object.freeze(notes),
  };
}

const card_hasMinor = (cs: readonly DrawnCard[]): boolean =>
  cs.some((c) => c.card.arcana === "minor");

/**
 * 这一牌阵的状态数 —— 与 `compare/statespace.ts` 的 `tarotDraws` 同一个数。
 *
 * 此处转调而不另算：另算就有两份，而两份迟早不一致。
 */
export function spreadStateSpace(spread: Spread, withReversals: boolean): number {
  let n = 1;
  for (let i = 0; i < spread.positions.length; i++) n *= DECK_SIZE - i;
  return withReversals ? n * 2 ** spread.positions.length : n;
}

export const TAROT_PENDING_CALIBRATION: readonly string[] = Object.freeze([
  "凯尔特十字十个位置的名称与次序（各家差异不小，此处取通行的一种，未经底本核对）",
  "花色的元素归属（金色黎明作权杖火宝剑风，另一系相反；且这层对应本身是后加的注解）",
  "大牌序号流派（马赛 8 正义 11 力量 / 韦特相反）—— 做成参数，不替读者定",
  "⚠️ 牌义不收录：塔罗没有六爻那样可引的底本，"
    + "马赛系小牌本无画面亦无成文牌义，韦特系牌义系 1909 年新造且与马赛不兼容。"
    + "一个没有底本的牌义表写出来只能是编的。",
]);

/**
 * 塔罗牌组 —— 78 张的结构，以及三处不能含糊过去的流派分歧。
 *
 * ## 这一套在本项目里的位置
 *
 * 《测天，还是约定》把塔罗作为九套占法里的**特例**反复引用：
 *
 * - **天文含量为零** —— 九套里唯一一个起盘不需要知道今天是哪天的
 * - **随机** —— 同一时刻重起，结果不同；复算没有意义
 * - 状态空间可数但不以人为单位分格（三张含逆位 3,651,648 种）
 *
 * 实现它，是为了让那几条从论述变成可运行的东西。顺带也验证了一件事：
 * **本项目能把它的机制实现得很完整，却给不出「牌义」** ——
 * 因为它没有六爻那样的经文可引。那个缺口是真实的，不该用生成的话填上。
 *
 * ## 为什么这里只给结构，不给牌义
 *
 * 六爻那边，本项目给的是《周易》的**爻辞原文**（一段可考的引文）
 * 加结构分析。塔罗没有对应的东西：
 *
 * - 马赛系的小牌（Ace–10）**没有画面**，只有花色符号的排列，
 *   十八世纪以前也没有成文的牌义
 * - 韦特系（1909）的画面与牌义是**新造的**，且与马赛系不兼容
 * - 各家牌义差异之大，不存在一个可引的底本
 *
 * 于是这里给**牌的身份与结构**（序号、花色、位阶、流派差异），
 * 以及牌阵每一位的**问题**，不给断语。
 * 一个没有底本的「牌义表」写出来只能是编的，而编出来的东西
 * 读起来和有来历的一模一样 —— 这正是本项目各处都在防的那件事。
 *
 * ## 三处流派分歧，一处都不替读者定
 *
 * 1. **力量与正义的序号对调**（见 `MajorNumbering`）
 * 2. **权杖与宝剑的元素归属**（见 `SuitElementSchool`）
 * 3. **逆位用不用**（见 `drawSpread` 的 `withReversals`）
 *
 * 三处都有各自的传统，没有一处有「正确答案」。与四柱那边的子时规则、
 * 十二长生同样处理：做成参数，随结果声明。
 */

export type Suit = "wands" | "cups" | "swords" | "pentacles";

export const SUITS: readonly Suit[] = Object.freeze([
  "wands", "cups", "swords", "pentacles",
]);

export const SUIT_NAME: Readonly<Record<Suit, string>> = Object.freeze({
  wands: "权杖", cups: "圣杯", swords: "宝剑", pentacles: "钱币",
});

export const SUIT_NAME_FR: Readonly<Record<Suit, string>> = Object.freeze({
  wands: "Bâtons", cups: "Coupes", swords: "Épées", pentacles: "Deniers",
});

/**
 * 花色的元素归属 —— **两家不同，且分歧就在权杖与宝剑之间。**
 *
 * 金色黎明（1888 起）作权杖火、宝剑风；另有一系作权杖风、宝剑火，
 * 理由是剑是铁器、属火，而杖出于木、通风。圣杯水与钱币土两家一致。
 *
 * ⚠️ 要紧的是：**这层对应本身是十九世纪末加上去的**，
 * 不是塔罗的来历，也不进起牌。把它当成本文，
 * 得出的「塔罗与占星同源」是循环论证（见《测天，还是约定》第 2 章）。
 * 故本项目给出它，但标明它是注解而非来历。
 */
export type SuitElementSchool = "goldenDawn" | "swordsFire";

export const SUIT_ELEMENT: Readonly<Record<SuitElementSchool, Readonly<Record<Suit, string>>>> =
  Object.freeze({
    goldenDawn: Object.freeze({
      wands: "火", cups: "水", swords: "风", pentacles: "土",
    }),
    swordsFire: Object.freeze({
      wands: "风", cups: "水", swords: "火", pentacles: "土",
    }),
  });

export type Rank =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | "page" | "knight" | "queen" | "king";

export const RANKS: readonly Rank[] = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "page", "knight", "queen", "king",
]);

export const RANK_NAME: Readonly<Record<string, string>> = Object.freeze({
  "1": "首牌", "2": "二", "3": "三", "4": "四", "5": "五", "6": "六",
  "7": "七", "8": "八", "9": "九", "10": "十",
  page: "侍从", knight: "骑士", queen: "王后", king: "国王",
});

/**
 * 大牌的序号流派。
 *
 * | | 8 号 | 11 号 |
 * | --- | --- | --- |
 * | **马赛系** | 正义 | 力量 |
 * | **韦特系**（承金色黎明） | 力量 | 正义 |
 *
 * 韦特系对调这两张，是为了让大牌序与黄道十二宫的次序对得上
 * （狮子配力量、天秤配正义）。也就是说：**这次对调是为了迁就
 * 一套后加的占星对应而改动的牌序** —— 它本身就是那层注解留下的痕迹。
 *
 * 两系都在用，没有正确答案。故做成参数，且在结果里声明用的是哪一系。
 */
export type MajorNumbering = "marseille" | "rws";

interface MajorDef {
  /** 马赛系序号。韦特系只在 8 与 11 上与它不同。 */
  readonly marseille: number;
  readonly name: string;
  readonly nameFr: string;
  readonly nameEn: string;
  /** 马赛系牌面无名者（13 号）—— 这不是遗漏，是那套牌本来就不写。 */
  readonly unnamedInMarseille?: true;
}

const MAJORS: readonly MajorDef[] = Object.freeze([
  { marseille: 0, name: "愚者", nameFr: "Le Mat", nameEn: "The Fool" },
  { marseille: 1, name: "魔术师", nameFr: "Le Bateleur", nameEn: "The Magician" },
  { marseille: 2, name: "女祭司", nameFr: "La Papesse", nameEn: "The High Priestess" },
  { marseille: 3, name: "皇后", nameFr: "L'Impératrice", nameEn: "The Empress" },
  { marseille: 4, name: "皇帝", nameFr: "L'Empereur", nameEn: "The Emperor" },
  { marseille: 5, name: "教皇", nameFr: "Le Pape", nameEn: "The Hierophant" },
  { marseille: 6, name: "恋人", nameFr: "L'Amoureux", nameEn: "The Lovers" },
  { marseille: 7, name: "战车", nameFr: "Le Chariot", nameEn: "The Chariot" },
  { marseille: 8, name: "正义", nameFr: "La Justice", nameEn: "Justice" },
  { marseille: 9, name: "隐者", nameFr: "L'Ermite", nameEn: "The Hermit" },
  { marseille: 10, name: "命运之轮", nameFr: "La Roue de Fortune", nameEn: "Wheel of Fortune" },
  { marseille: 11, name: "力量", nameFr: "La Force", nameEn: "Strength" },
  { marseille: 12, name: "倒吊人", nameFr: "Le Pendu", nameEn: "The Hanged Man" },
  { marseille: 13, name: "死神", nameFr: "（无名）", nameEn: "Death", unnamedInMarseille: true },
  { marseille: 14, name: "节制", nameFr: "Tempérance", nameEn: "Temperance" },
  { marseille: 15, name: "恶魔", nameFr: "Le Diable", nameEn: "The Devil" },
  { marseille: 16, name: "高塔", nameFr: "La Maison Dieu", nameEn: "The Tower" },
  { marseille: 17, name: "星星", nameFr: "L'Étoile", nameEn: "The Star" },
  { marseille: 18, name: "月亮", nameFr: "La Lune", nameEn: "The Moon" },
  { marseille: 19, name: "太阳", nameFr: "Le Soleil", nameEn: "The Sun" },
  { marseille: 20, name: "审判", nameFr: "Le Jugement", nameEn: "Judgement" },
  { marseille: 21, name: "世界", nameFr: "Le Monde", nameEn: "The World" },
]);

export interface Card {
  /** 稳定标识，与流派无关 —— 洗牌与比对都用它。 */
  readonly id: string;
  readonly arcana: "major" | "minor";
  readonly name: string;
  readonly nameEn: string;
  readonly nameFr: string;
  /** 大牌专有。 */
  readonly suit?: Suit;
  readonly rank?: Rank;
  readonly unnamedInMarseille?: true;
}

/**
 * 按指定的序号流派取整副牌，**恒为 78 张**。
 *
 * 大牌的 `number` 不进 `Card` ——它依流派而变，故由 `majorNumber()` 现算，
 * 免得同一张牌在两处带着两个号。
 */
export function deck(): readonly Card[] {
  const majors: Card[] = MAJORS.map((m) => ({
    id: `major.${m.marseille}`,
    arcana: "major" as const,
    name: m.name, nameEn: m.nameEn, nameFr: m.nameFr,
    ...(m.unnamedInMarseille === true ? { unnamedInMarseille: true as const } : {}),
  }));
  const minors: Card[] = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      minors.push({
        id: `${s}.${r}`,
        arcana: "minor",
        name: `${SUIT_NAME[s]}${RANK_NAME[String(r)]}`,
        nameEn: `${typeof r === "number" ? r : r} of ${s}`,
        nameFr: `${SUIT_NAME_FR[s]}`,
        suit: s, rank: r,
      });
    }
  }
  return Object.freeze([...majors, ...minors]);
}

export const DECK_SIZE = 78;

/** 某张大牌在指定流派下的序号。小牌返回 null。 */
export function majorNumber(card: Card, numbering: MajorNumbering): number | null {
  if (card.arcana !== "major") return null;
  const n = Number(card.id.slice("major.".length));
  if (numbering === "marseille") return n;
  // 韦特系只对调 8（正义）与 11（力量）
  if (n === 8) return 11;
  if (n === 11) return 8;
  return n;
}

/** 这副牌的流派声明 —— 随每次抽牌一起带出，不让读者去猜用的是哪一系。 */
export interface DeckSchools {
  readonly numbering: MajorNumbering;
  readonly suitElement: SuitElementSchool;
  readonly withReversals: boolean;
}

export const SCHOOL_NOTE: Readonly<Record<string, string>> = Object.freeze({
  marseille: "马赛系：8 号为正义，11 号为力量",
  rws: "韦特系：8 号为力量，11 号为正义 —— 这次对调是为迁就一套后加的黄道对应",
  goldenDawn: "金色黎明：权杖火、宝剑风",
  swordsFire: "另一系：权杖风、宝剑火",
});

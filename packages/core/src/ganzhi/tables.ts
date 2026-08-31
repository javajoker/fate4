/**
 * 干支静态表 —— docs/01-foundations.md 的代码化。
 *
 * 本文件必须与该文档逐字对应；test/tables.spec.ts 断言二者一致，
 * 并校验表内部的自洽性（阴干长生 = 同五行阳干的死位、禄 = 临官、羊刃 = 阳干帝旺 等）。
 *
 * 凡可由更基础的表推导者，一律**推导**而非硬编码，再以字面量表反向断言 ——
 * 两份独立表述必须吻合，是这一层唯一可靠的正确性保证。
 */

import {
  BRANCHES, ELEMENTS, STEMS,
  type Branch, type ChangshengPhase, type Element,
  type HiddenRole, type Polarity, type Stem,
} from "../types/ganzhi.js";

// ─────────────────────────────────────────────────────────
// 索引
// ─────────────────────────────────────────────────────────

export const STEM_INDEX: ReadonlyMap<Stem, number> = new Map(STEMS.map((s, i) => [s, i]));
export const BRANCH_INDEX: ReadonlyMap<Branch, number> = new Map(BRANCHES.map((b, i) => [b, i]));

// ─────────────────────────────────────────────────────────
// 天干：五行与阴阳皆由序位推导
//   序 i → 五行 ELEMENTS[⌊i/2⌋]，阴阳 i 偶为阳
// ─────────────────────────────────────────────────────────

export const STEM_ELEMENT: Readonly<Record<Stem, Element>> = Object.freeze(
  Object.fromEntries(
    STEMS.map((s, i) => [s, ELEMENTS[Math.floor(i / 2)]!]),
  ) as Record<Stem, Element>,
);

export const STEM_POLARITY: Readonly<Record<Stem, Polarity>> = Object.freeze(
  Object.fromEntries(
    STEMS.map((s, i) => [s, i % 2 === 0 ? "阳" : "阴"]),
  ) as Record<Stem, Polarity>,
);

// ─────────────────────────────────────────────────────────
// 地支
//
// 位阴阳（排列序位）与气阴阳（本气藏干）在 子午巳亥 四支上不一致 ——
// 即「体阴用阳」问题。二者必须分作两个字段，禁止合并：
//   · 生克与十神一律用**气阴阳**（因载体是藏干，不是地支本身）
//   · 十二长生的阳顺阴逆排布与部分神煞起例用**位阴阳**
// ─────────────────────────────────────────────────────────

export const BRANCH_ELEMENT: Readonly<Record<Branch, Element>> = Object.freeze({
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
});

/** 位阴阳：序位偶数为阳。 */
export const BRANCH_POSITIONAL_POLARITY: Readonly<Record<Branch, Polarity>> = Object.freeze(
  Object.fromEntries(
    BRANCHES.map((b, i) => [b, i % 2 === 0 ? "阳" : "阴"]),
  ) as Record<Branch, Polarity>,
);

export const ZODIAC: Readonly<Record<Branch, string>> = Object.freeze({
  子: "鼠", 丑: "牛", 寅: "虎", 卯: "兔", 辰: "龙", 巳: "蛇",
  午: "马", 未: "羊", 申: "猴", 酉: "鸡", 戌: "狗", 亥: "猪",
});

/** 时辰起始钟点（23 点起子时）。 */
export const BRANCH_HOUR_START: Readonly<Record<Branch, number>> = Object.freeze({
  子: 23, 丑: 1, 寅: 3, 卯: 5, 辰: 7, 巳: 9,
  午: 11, 未: 13, 申: 15, 酉: 17, 戌: 19, 亥: 21,
});

// ─────────────────────────────────────────────────────────
// 藏干：本气 → 中气 → 余气
//   单藏 3 支（子卯酉）· 双藏 2 支（午亥）· 三藏 7 支
// ─────────────────────────────────────────────────────────

export const HIDDEN_STEMS: Readonly<Record<Branch, readonly Stem[]>> = Object.freeze({
  子: ["癸"],
  丑: ["己", "癸", "辛"],
  寅: ["甲", "丙", "戊"],
  卯: ["乙"],
  辰: ["戊", "乙", "癸"],
  巳: ["丙", "庚", "戊"],
  午: ["丁", "己"],
  未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"],
  酉: ["辛"],
  戌: ["戊", "辛", "丁"],
  亥: ["壬", "甲"],
});

export const HIDDEN_ROLES: readonly HiddenRole[] = ["本气", "中气", "余气"];

/** 地支分数下发给藏干的比例，按藏干个数取用。来自 params.weights.hiddenSplit。 */
export const HIDDEN_SPLIT: Readonly<Record<1 | 2 | 3, readonly number[]>> = Object.freeze({
  1: [1.0],
  2: [0.7, 0.3],
  3: [0.65, 0.25, 0.1],
});

// ─────────────────────────────────────────────────────────
// 五行生克
// ─────────────────────────────────────────────────────────

/** 木 → 火 → 土 → 金 → 水 → 木 */
export const GENERATES: Readonly<Record<Element, Element>> = Object.freeze({
  木: "火", 火: "土", 土: "金", 金: "水", 水: "木",
});

/** 木 → 土 → 水 → 火 → 金 → 木 */
export const CONTROLS: Readonly<Record<Element, Element>> = Object.freeze({
  木: "土", 土: "水", 水: "火", 火: "金", 金: "木",
});

// ─────────────────────────────────────────────────────────
// 天干关系
// ─────────────────────────────────────────────────────────

/** 天干五合，间隔 5 位。值为化神五行。 */
export const STEM_COMBINATIONS: readonly (readonly [Stem, Stem, Element])[] = Object.freeze([
  ["甲", "己", "土"],
  ["乙", "庚", "金"],
  ["丙", "辛", "水"],
  ["丁", "壬", "木"],
  ["戊", "癸", "火"],
] as const);

/** 天干相冲，间隔 6 位、同阴阳且五行相克。戊己居中不冲。 */
export const STEM_CLASHES: readonly (readonly [Stem, Stem])[] = Object.freeze([
  ["甲", "庚"], ["乙", "辛"], ["丙", "壬"], ["丁", "癸"],
] as const);

// ─────────────────────────────────────────────────────────
// 地支关系
// ─────────────────────────────────────────────────────────

/** 六合。值为化神五行；午未为日月合，化气最弱。 */
export const BRANCH_SIX_COMBINATIONS: readonly (readonly [Branch, Branch, Element])[] = Object.freeze([
  ["子", "丑", "土"],
  ["寅", "亥", "木"],
  ["卯", "戌", "火"],
  ["辰", "酉", "金"],
  ["巳", "申", "水"],
  ["午", "未", "土"],
] as const);

/** 三合局：生 — 旺 — 墓。 */
export const TRINITIES: readonly { readonly sheng: Branch; readonly wang: Branch; readonly mu: Branch; readonly element: Element }[] =
  Object.freeze([
    { sheng: "申", wang: "子", mu: "辰", element: "水" },
    { sheng: "亥", wang: "卯", mu: "未", element: "木" },
    { sheng: "寅", wang: "午", mu: "戌", element: "火" },
    { sheng: "巳", wang: "酉", mu: "丑", element: "金" },
  ] as const);

/** 三会方：同方三支，力量大于三合。 */
export const DIRECTIONALS: readonly { readonly branches: readonly [Branch, Branch, Branch]; readonly element: Element; readonly name: string }[] =
  Object.freeze([
    { branches: ["寅", "卯", "辰"], element: "木", name: "东方" },
    { branches: ["巳", "午", "未"], element: "火", name: "南方" },
    { branches: ["申", "酉", "戌"], element: "金", name: "西方" },
    { branches: ["亥", "子", "丑"], element: "水", name: "北方" },
  ] as const);

/** 六冲，间隔 6 位。 */
export const BRANCH_CLASHES: readonly (readonly [Branch, Branch])[] = Object.freeze([
  ["子", "午"], ["丑", "未"], ["寅", "申"],
  ["卯", "酉"], ["辰", "戌"], ["巳", "亥"],
] as const);

/** 六害（穿）。 */
export const BRANCH_HARMS: readonly (readonly [Branch, Branch])[] = Object.freeze([
  ["子", "未"], ["丑", "午"], ["寅", "巳"],
  ["卯", "辰"], ["申", "亥"], ["酉", "戌"],
] as const);

/** 六破。 */
export const BRANCH_DESTRUCTIONS: readonly (readonly [Branch, Branch])[] = Object.freeze([
  ["子", "酉"], ["午", "卯"], ["申", "巳"],
  ["寅", "亥"], ["辰", "丑"], ["戌", "未"],
] as const);

export type PunishmentKind = "无恩之刑" | "恃势之刑" | "无礼之刑" | "自刑";

/** 三刑。无恩、恃势须三支全见；无礼二支即成；自刑为同支重见。 */
export const PUNISHMENTS: readonly { readonly kind: PunishmentKind; readonly branches: readonly Branch[] }[] =
  Object.freeze([
    { kind: "无恩之刑", branches: ["寅", "巳", "申"] },
    { kind: "恃势之刑", branches: ["丑", "戌", "未"] },
    { kind: "无礼之刑", branches: ["子", "卯"] },
    { kind: "自刑", branches: ["辰"] },
    { kind: "自刑", branches: ["午"] },
    { kind: "自刑", branches: ["酉"] },
    { kind: "自刑", branches: ["亥"] },
  ] as const);

/** 四生（长生地）· 四旺（四正）· 四墓（库地） */
export const FOUR_BIRTHS: readonly Branch[] = Object.freeze(["寅", "申", "巳", "亥"] as const);
export const FOUR_PEAKS: readonly Branch[] = Object.freeze(["子", "午", "卯", "酉"] as const);
export const FOUR_TOMBS: readonly Branch[] = Object.freeze(["辰", "戌", "丑", "未"] as const);

/**
 * 四墓库所藏何物：辰水库 · 戌火库 · 丑金库 · 未木库。
 *
 * 土不在此列 —— 四墓库本身皆为土，土无专库可入。
 * 戊己的墓位随流派（火土同宫则在戌，水土同宫则在辰），
 * 由 changsheng.ts 依长生表推导，不在这张表里表达。
 */
export type StorableElement = Extract<Element, "水" | "火" | "金" | "木">;

export const TOMB_OF: Readonly<Record<StorableElement, Branch>> = Object.freeze({
  水: "辰", 火: "戌", 金: "丑", 木: "未",
});

/** TOMB_OF 的反向索引，仅四墓支有值。 */
export const TOMB_STORES: Readonly<Record<Branch, StorableElement | undefined>> = Object.freeze({
  辰: "水", 戌: "火", 丑: "金", 未: "木",
  子: undefined, 寅: undefined, 卯: undefined, 巳: undefined,
  午: undefined, 申: undefined, 酉: undefined, 亥: undefined,
});

// ─────────────────────────────────────────────────────────
// 十二长生
//
// 不硬编码 10 × 12 的完整矩阵，只记录各干的长生起点与行进方向，
// 其余由 changsheng.ts 推导。字面量矩阵放在测试里作反向断言 ——
// 两份独立表述吻合，才算这张表是对的。
// ─────────────────────────────────────────────────────────

/** 阳顺阴逆 + 火土同宫（默认流派）下各天干的长生位。 */
export const CHANGSHENG_ORIGIN: Readonly<Record<Stem, Branch>> = Object.freeze({
  甲: "亥", 乙: "午",
  丙: "寅", 丁: "酉",
  戊: "寅", 己: "酉", // 火土同宫：戊己随丙丁
  庚: "巳", 辛: "子",
  壬: "申", 癸: "卯",
});

/** 水土同宫流派下，戊己改随壬癸。 */
export const CHANGSHENG_ORIGIN_WATER_EARTH: Readonly<Record<Stem, Branch>> = Object.freeze({
  ...CHANGSHENG_ORIGIN,
  戊: "申",
  己: "卯",
});

export const PHASE_INDEX: Readonly<Record<ChangshengPhase, number>> = Object.freeze({
  长生: 0, 沐浴: 1, 冠带: 2, 临官: 3, 帝旺: 4, 衰: 5,
  病: 6, 死: 7, 墓: 8, 绝: 9, 胎: 10, 养: 11,
});

// ─────────────────────────────────────────────────────────
// 纳音：六十甲子每两位共用一名
// ─────────────────────────────────────────────────────────

export const NAYIN: readonly string[] = Object.freeze([
  "海中金", "炉中火", "大林木", "路旁土", "剑锋金", "山头火",
  "涧下水", "城头土", "白蜡金", "杨柳木", "泉中水", "屋上土",
  "霹雳火", "松柏木", "长流水", "沙中金", "山下火", "平地木",
  "壁上土", "金箔金", "覆灯火", "天河水", "大驿土", "钗钏金",
  "桑柘木", "大溪水", "沙中土", "天上火", "石榴木", "大海水",
] as const);

// ─────────────────────────────────────────────────────────
// 司令分野（人元司事）
//
// 注意：司令干**可能不在该支的藏干表内** ——
// 子月前 10 日司令为壬，而子只藏癸；卯月前 10 日司令为甲，卯只藏乙；
// 午月前 10 日为丙、酉月前 10 日为庚。此为上月余气未退，非笔误。
// 解析规则见 docs/03-weights.md §4。
// ─────────────────────────────────────────────────────────

export interface SilingSegment {
  readonly stem: Stem;
  readonly days: number;
}

export const SILING: Readonly<Record<Branch, readonly SilingSegment[]>> = Object.freeze({
  寅: [{ stem: "戊", days: 7 }, { stem: "丙", days: 7 }, { stem: "甲", days: 16 }],
  卯: [{ stem: "甲", days: 10 }, { stem: "乙", days: 20 }],
  辰: [{ stem: "乙", days: 9 }, { stem: "癸", days: 3 }, { stem: "戊", days: 18 }],
  巳: [{ stem: "戊", days: 5 }, { stem: "庚", days: 9 }, { stem: "丙", days: 16 }],
  午: [{ stem: "丙", days: 10 }, { stem: "己", days: 9 }, { stem: "丁", days: 11 }],
  未: [{ stem: "丁", days: 9 }, { stem: "乙", days: 3 }, { stem: "己", days: 18 }],
  申: [{ stem: "戊", days: 7 }, { stem: "壬", days: 3 }, { stem: "庚", days: 20 }],
  酉: [{ stem: "庚", days: 10 }, { stem: "辛", days: 20 }],
  戌: [{ stem: "辛", days: 9 }, { stem: "丁", days: 3 }, { stem: "戊", days: 18 }],
  亥: [{ stem: "戊", days: 7 }, { stem: "甲", days: 5 }, { stem: "壬", days: 18 }],
  子: [{ stem: "壬", days: 10 }, { stem: "癸", days: 20 }],
  丑: [{ stem: "癸", days: 9 }, { stem: "辛", days: 3 }, { stem: "己", days: 18 }],
});

// ─────────────────────────────────────────────────────────
// 月支与节气月序
//   寅月为岁首（立春起），故 寅 = 1
// ─────────────────────────────────────────────────────────

export const MONTH_BRANCH_ORDER: readonly Branch[] = Object.freeze([
  "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑",
] as const);

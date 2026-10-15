/**
 * 星曜的落位 —— 全是算术，一次星历都不查。
 *
 * ## 为什么紫微的落点那条规则长得那么怪
 *
 * 紫微由**五行局数**与**农历日**定，规则是：
 *
 * > 以局数除日数。整除则商即步数；不整除则借数凑整，
 * > 借数为偶则再进借数，为奇则退借数。
 *
 * 读起来像密码，但它其实在做一件朴素的事：把 1–30 日**均匀摊到十二宫**，
 * 而每局的摊法不同（二局两日一宫，六局六日一宫）。
 * 借数的奇偶进退，是为了让摊不满的那几天落回已用过的宫里而不越界。
 *
 * 要紧的是：**它只用两个整数**。没有角度，没有时刻，没有地点。
 * 这正是本项目把紫微归入「历法派生」而非「实测天体」的依据。
 *
 * ## 本模块收哪些星
 *
 * | 收 | 不收 |
 * | --- | --- |
 * | 十四主星（紫微系 6 + 天府系 8） | 三台八座、恩光天贵一类日系杂曜 |
 * | 六吉：左辅右弼文昌文曲天魁天钺 | 龙池凤阁、红鸾天喜、孤辰寡宿等年支系杂曜 |
 * | 六煞：擎羊陀罗火星铃星地空地劫 | 长生十二神、博士十二神、流曜 |
 * | 禄存、天马 | |
 * | 四化（年干定） | |
 *
 * 不收的那些**不是忘了**，是本项目没有可靠底本（各家起例差异尤其大）。
 * 收一个拿不准的表比不收坏 —— 不收至少读者知道这里没有东西。
 */

import { STEMS, type Stem } from "../types/ganzhi.js";

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** 寅 的地支下标。紫微系多条规则自寅起算。 */
const YIN = 2;

/**
 * 紫微星的落点。
 *
 * @param bureauNumber 五行局数 2–6
 * @param lunarDay 农历日 1–30
 */
export function ziweiIndex(bureauNumber: number, lunarDay: number): number {
  if (!Number.isInteger(lunarDay) || lunarDay < 1 || lunarDay > 30) {
    throw new Error(`农历日越界：${lunarDay}`);
  }
  if (!Number.isInteger(bureauNumber) || bureauNumber < 2 || bureauNumber > 6) {
    throw new Error(`五行局数越界：${bureauNumber}`);
  }
  const rem = lunarDay % bureauNumber;
  if (rem === 0) return mod12(YIN + lunarDay / bureauNumber - 1);
  const borrow = bureauNumber - rem;
  const steps = (lunarDay + borrow) / bureauNumber;
  // 借数为偶则进，为奇则退 —— 两种情形都落回十二宫之内
  return mod12(YIN + steps - 1 + (borrow % 2 === 0 ? borrow : -borrow));
}

/**
 * 天府星 —— 与紫微关于**寅申轴**对称。
 *
 * 轴穿过寅与申，故那两宫是**不动点**：紫微在寅则天府也在寅，
 * 紫微在申则天府也在申。其余各宫两两互换：子↔辰、丑↔卯、巳↔亥、午↔戌、未↔酉。
 *
 * ```
 * 天府 = (4 − 紫微) mod 12
 * ```
 *
 * ⚠️ 这里原本写的是 `(寅 + 8 − 紫微)`，即 `(10 − 紫微)` ——
 * 那也是一个对合（施两次回到原处），不动点却落在巳与亥上，
 * **是另一条轴**。于是十四主星里八颗（天府系全部）整体偏了六宫。
 *
 * 注释一直写着「寅申轴」，错的是式子；而当初那条测试断言的是
 * `天府(寅) === 申` —— 它把同一个错误抄了一遍，所以一路全绿。
 * 真正逮到它的是 iztro 的逐例对照（见 `test/ziwei-crossvalidate.spec.ts`）。
 *
 * **教训**：对合、周期、幂等这类**结构性**断言，对「选错了哪条轴」
 * 这种错是盲的 —— 两条轴都满足它们。
 */
export const tianfuIndex = (ziwei: number): number => mod12(4 - ziwei);

export interface StarPlacement {
  readonly name: string;
  /** 地支下标 0–11。 */
  readonly index: number;
  readonly group: "紫微系" | "天府系" | "六吉" | "六煞" | "禄马";
}

/** 紫微系：自紫微**逆行**，偏移各家一致。 */
const ZIWEI_SERIES: readonly (readonly [string, number])[] = Object.freeze([
  ["紫微", 0], ["天机", -1], ["太阳", -3], ["武曲", -4], ["天同", -5], ["廉贞", -8],
]);

/** 天府系：自天府**顺行**，七杀之后隔三宫安破军。 */
const TIANFU_SERIES: readonly (readonly [string, number])[] = Object.freeze([
  ["天府", 0], ["太阴", 1], ["贪狼", 2], ["巨门", 3],
  ["天相", 4], ["天梁", 5], ["七杀", 6], ["破军", 10],
]);

/** 十四主星。 */
export function majorStars(ziwei: number): readonly StarPlacement[] {
  const fu = tianfuIndex(ziwei);
  return Object.freeze([
    ...ZIWEI_SERIES.map(([name, d]) => ({
      name, index: mod12(ziwei + d), group: "紫微系" as const,
    })),
    ...TIANFU_SERIES.map(([name, d]) => ({
      name, index: mod12(fu + d), group: "天府系" as const,
    })),
  ]);
}

/**
 * 六吉星。
 *
 * 左辅右弼由**农历月**定，文昌文曲由**时辰**定，天魁天钺由**年干**定。
 * 三对各用一个不同的输入 —— 这本身说明这套体系是分层拼起来的。
 */
const KUI_YUE: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  甲: [1, 7], 乙: [0, 8], 丙: [11, 9], 丁: [11, 9], 戊: [1, 7],
  己: [0, 8], 庚: [1, 7], 辛: [6, 2], 壬: [3, 5], 癸: [3, 5],
});

export function luckyStars(
  lunarMonth: number, hourBranch: number, yearStem: Stem,
): readonly StarPlacement[] {
  const g = "六吉" as const;
  const ky = KUI_YUE[yearStem];
  if (ky === undefined) throw new Error(`年干不识：${yearStem}`);
  return Object.freeze([
    // 左辅自辰起正月顺行，右弼自戌起正月逆行
    { name: "左辅", index: mod12(4 + lunarMonth - 1), group: g },
    { name: "右弼", index: mod12(10 - (lunarMonth - 1)), group: g },
    // 文昌自戌起子时逆行，文曲自辰起子时顺行
    { name: "文昌", index: mod12(10 - hourBranch), group: g },
    { name: "文曲", index: mod12(4 + hourBranch), group: g },
    { name: "天魁", index: ky[0], group: g },
    { name: "天钺", index: ky[1], group: g },
  ]);
}

/** 禄存由年干定；擎羊在禄存前一位，陀罗在后一位 —— 三者恒相邻。 */
const LUCUN: Readonly<Record<string, number>> = Object.freeze({
  甲: 2, 乙: 3, 丙: 5, 丁: 6, 戊: 5, 己: 6, 庚: 8, 辛: 9, 壬: 11, 癸: 0,
});

/** 天马由年支三合定，恒在四马地（寅申巳亥）。 */
const TIANMA: readonly number[] = Object.freeze([
  2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5,
]);

/**
 * 火星铃星 —— 由**年支三合局**起，再按**时辰**顺行。
 *
 * ⚠️ 这一对的起例各家分歧最大（有按年支分四组者，有另立表者）。
 * 本项目取通行的一种，列入待核对。
 */
const HUO_LING_START: readonly (readonly [number, number])[] = Object.freeze([
  [2, 10], [3, 10], [1, 3], [9, 10],    // 子 丑 寅 卯
  [2, 10], [3, 10], [1, 3], [9, 10],    // 辰 巳 午 未
  [2, 10], [3, 10], [1, 3], [9, 10],    // 申 酉 戌 亥
]);

export function unluckyStars(
  yearStem: Stem, yearBranchIndex: number, hourBranch: number,
): readonly StarPlacement[] {
  const g = "六煞" as const;
  const lu = LUCUN[yearStem];
  if (lu === undefined) throw new Error(`年干不识：${yearStem}`);
  const hl = HUO_LING_START[yearBranchIndex]!;
  return Object.freeze([
    { name: "擎羊", index: mod12(lu + 1), group: g },
    { name: "陀罗", index: mod12(lu - 1), group: g },
    { name: "火星", index: mod12(hl[0] + hourBranch), group: g },
    { name: "铃星", index: mod12(hl[1] + hourBranch), group: g },
    // 地空自亥起子时逆行，地劫自亥起子时顺行
    { name: "地空", index: mod12(11 - hourBranch), group: g },
    { name: "地劫", index: mod12(11 + hourBranch), group: g },
  ]);
}

export function luMaStars(
  yearStem: Stem, yearBranchIndex: number,
): readonly StarPlacement[] {
  const lu = LUCUN[yearStem];
  if (lu === undefined) throw new Error(`年干不识：${yearStem}`);
  return Object.freeze([
    { name: "禄存", index: lu, group: "禄马" as const },
    { name: "天马", index: TIANMA[yearBranchIndex]!, group: "禄马" as const },
  ]);
}

/**
 * 四化 —— 由**年干**定，是紫微斗数里最要紧的一层。
 *
 * 它不摆新星，而是给已在盘上的四颗星各加一个标记：
 * 化禄、化权、化科、化忌。同一颗星在不同年干下可以什么都不化，
 * 也可以化忌 —— 故四化是**年干与星的交互**，不是星本身的属性。
 */
export type SihuaKind = "化禄" | "化权" | "化科" | "化忌";

export const SIHUA_ORDER: readonly SihuaKind[] = Object.freeze([
  "化禄", "化权", "化科", "化忌",
]);

const SIHUA: Readonly<Record<string, readonly [string, string, string, string]>> =
  Object.freeze({
    甲: ["廉贞", "破军", "武曲", "太阳"],
    乙: ["天机", "天梁", "紫微", "太阴"],
    丙: ["天同", "天机", "文昌", "廉贞"],
    丁: ["太阴", "天同", "天机", "巨门"],
    戊: ["贪狼", "太阴", "右弼", "天机"],
    己: ["武曲", "贪狼", "天梁", "文曲"],
    庚: ["太阳", "武曲", "太阴", "天同"],
    辛: ["巨门", "太阳", "文曲", "文昌"],
    壬: ["天梁", "紫微", "左辅", "武曲"],
    癸: ["破军", "巨门", "太阴", "贪狼"],
  });

export interface Sihua {
  readonly kind: SihuaKind;
  readonly star: string;
}

export function sihuaOf(yearStem: Stem): readonly Sihua[] {
  const row = SIHUA[yearStem];
  if (row === undefined) throw new Error(`年干不识：${yearStem}`);
  return Object.freeze(row.map((star, i) => ({ kind: SIHUA_ORDER[i]!, star })));
}

/** 年干是否在表内 —— 供测试与上层校验。 */
export const STEM_TABLES_COVER_ALL = (): boolean =>
  STEMS.every((s) => SIHUA[s] !== undefined && LUCUN[s] !== undefined
    && KUI_YUE[s] !== undefined);


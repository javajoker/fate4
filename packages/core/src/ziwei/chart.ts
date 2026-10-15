/**
 * 紫微斗数的命盘装配。
 *
 * ## ⚠️ 年干支取的是农历年，不是立春年 —— 这一条会改变整张盘
 *
 * 四柱的年柱**以立春为界**；紫微斗数的年干支**以正月初一为界**。
 * 两者在每年之间差着十天到一个多月。
 *
 * 于是：**生在正月初一与立春之间的人，两套给出的年干支不是同一个。**
 * 而年干在紫微里决定四化、禄存、擎羊陀罗、天魁天钺 ——
 * 取错一个，盘上一大半东西跟着错。
 *
 * 本项目两套各按各的规矩算，并在命盘上**明写用的是哪一个年**
 * （`yearBasis`），以及两者是否恰好一致（`agreesWithSolarYear`）。
 * 不一致时出一条警告 —— 那不是细节，是这张盘凭什么长这样。
 *
 * ## 整张盘的输入只有五样
 *
 * ```
 * 农历年干支   农历月   农历日   时辰   性别
 * ```
 *
 * 不查星历，不看节气，**不要地点**。隔壁的星盘要经纬度，四柱要经度，
 * 紫微一个都不要 —— 这是它落在「历法派生」而非「实测天体」的直接依据。
 *
 * 但别把结论推过头：紫微**自己**不算天象，它吃的农历却是实测的
 * （定朔要真算合朔，置闰要看中气）。故它不是「纯约定」那一档。
 */

import { BRANCHES, STEMS, type Branch, type Stem } from "../types/ganzhi.js";
import { branchAt, stemAt } from "../ganzhi/algebra.js";
import { lunarDateOf, type LunarDate, type LunarOptions } from "../chart/lunar.js";
import { toJulianDay, type JulianDay } from "../astro/julian.js";
import type { BirthInput } from "../chart/types.js";
import {
  palaceLayout, bureauOf, PALACE_NAMES,
  type BureauResult, type ZiweiPalaceLayout,
} from "./palaces.js";
import {
  ziweiIndex, majorStars, luckyStars, unluckyStars, luMaStars, sihuaOf,
  type StarPlacement, type Sihua,
} from "./stars.js";

export interface ZiweiPalace {
  /** 地支下标 0–11。 */
  readonly index: number;
  readonly branch: string;
  /** 宫的天干 —— 由年干起五虎遁。 */
  readonly stem: string;
  readonly name: string;
  readonly isMing: boolean;
  readonly isShen: boolean;
  readonly stars: readonly StarPlacement[];
  /** 落在本宫的四化。 */
  readonly sihua: readonly Sihua[];
  /** 大限起止岁数。`null` 表示本盘未排到（不会发生，留作类型诚实）。 */
  readonly majorLimit: { readonly from: number; readonly to: number } | null;
}

export interface ZiweiChart {
  readonly lunar: LunarDate;
  /** 时辰 0–11。 */
  readonly hourBranch: number;
  readonly gender: "male" | "female";
  /** 农历年干支 —— **以正月初一为界**，与四柱的立春年不同。 */
  readonly yearStem: Stem;
  readonly yearBranch: Branch;
  readonly yearBasis: "农历年（正月初一为界）";
  /** 四柱的立春年干支是否与上面一致。不一致时盘上一大半东西会不同。 */
  readonly agreesWithSolarYear: boolean;
  readonly bureau: BureauResult;
  readonly layout: ZiweiPalaceLayout;
  readonly palaces: readonly ZiweiPalace[];
  readonly sihua: readonly Sihua[];
  /** 大限行进方向。阳男阴女顺行，阴男阳女逆行。 */
  readonly limitDirection: "顺行" | "逆行";
  readonly warnings: readonly string[];
}

export interface ZiweiOptions extends LunarOptions {
  /** 四柱那一侧的立春年干支，用于比对。不给则不比。 */
  readonly solarYearStem?: Stem;
}

/**
 * 由公历生辰起一张紫微盘。
 *
 * 时辰由**当地钟表时**定，不做真太阳时校正 —— 紫微的传统起法不涉及经度，
 * 而替它加一道四柱才有的校正，是拿一套的规矩改另一套。
 * 若要那样做，须作为流派参数显式打开，不能默认。
 */
export function buildZiweiChart(
  input: BirthInput, options: ZiweiOptions = {},
): ZiweiChart {
  const jdUT = toJulianDay({
    year: input.year, month: input.month, day: input.day,
    hour: input.hour, minute: input.minute, second: input.second ?? 0,
  }) as JulianDay;
  const lunar = lunarDateOf(jdUT, options);

  // 时辰：子时跨日，23 时起即次日子时 —— 与四柱的「晚子」处理同一条线，
  // 但此处只影响时辰序，不影响日序（紫微的日用农历日，不随时辰进位）
  const hourBranch = Math.floor(((input.hour + 1) % 24) / 2);

  return assembleZiwei(lunar, hourBranch, input.gender, options);
}

/**
 * 由农历日期直接起盘 —— 核心入口。
 *
 * 分出来是因为**很多人只知道自己的农历生日**，而反推公历要靠历书。
 * 让这条路走得通，比强迫所有人先转公历诚实。
 */
export function assembleZiwei(
  lunar: LunarDate, hourBranch: number,
  gender: "male" | "female", options: ZiweiOptions = {},
): ZiweiChart {
  const yearStem = stemAt(lunar.year - 4);
  const yearBranch = branchAt(lunar.year - 4);
  const yearBranchIndex = BRANCHES.indexOf(yearBranch);

  const layout = palaceLayout(lunar.month, hourBranch);
  const bureau = bureauOf(yearStem, layout.mingIndex);
  const zw = ziweiIndex(bureau.number, lunar.day);

  const all: StarPlacement[] = [
    ...majorStars(zw),
    ...luckyStars(lunar.month, hourBranch, yearStem),
    ...unluckyStars(yearStem, yearBranchIndex, hourBranch),
    ...luMaStars(yearStem, yearBranchIndex),
  ];
  const sihua = sihuaOf(yearStem);

  // 大限：阳男阴女顺行，阴男阳女逆行；自命宫起，首限自局数岁开始
  const yangYear = STEMS.indexOf(yearStem) % 2 === 0;
  const forward = (yangYear && gender === "male") || (!yangYear && gender === "female");
  const limitDirection = forward ? "顺行" : "逆行";

  const palaces: ZiweiPalace[] = [];
  for (let i = 0; i < 12; i++) {
    const stars = all.filter((s) => s.index === i);
    const step = forward
      ? (((i - layout.mingIndex) % 12) + 12) % 12
      : (((layout.mingIndex - i) % 12) + 12) % 12;
    const from = bureau.number + step * 10;
    palaces.push({
      index: i,
      branch: BRANCHES[i]!,
      // 宫干与命宫同一条五虎遁，故由 bureauOf 的同一规则现算
      stem: stemOfPalace(yearStem, i),
      name: layout.palaceAt[i]!,
      isMing: i === layout.mingIndex,
      isShen: i === layout.shenIndex,
      stars: Object.freeze(stars),
      sihua: Object.freeze(sihua.filter((h) => stars.some((s) => s.name === h.star))),
      majorLimit: { from, to: from + 9 },
    });
  }

  const warnings: string[] = [];
  if (lunar.isLeap) {
    warnings.push(
      `生于闰${lunar.month}月。本项目按「闰月归本月」排盘（各家一致），`
      + "但另有按下半月归次月的说法 —— 换一种，月系的左辅右弼与十二宫全体移位。");
  }
  if (lunar.boundaryUncertain) {
    warnings.push(
      "该月朔的时刻距日界不足级数精度，初一的归属存疑 —— "
      + "整月日序可能差一天，而紫微星的落点由农历日定。");
  }
  const agrees = options.solarYearStem === undefined
    ? true : options.solarYearStem === yearStem;
  if (options.solarYearStem !== undefined && !agrees) {
    warnings.push(
      `紫微取农历年干支（${yearStem}${yearBranch}，以正月初一为界），`
      + `而四柱取立春年（年干 ${options.solarYearStem}）—— 两者不是同一个年。`
      + "年干在这里决定四化、禄存、羊陀、魁钺，故两套盘上这几项必然不同。"
      + "这不是哪一套错了，是两套的岁首本来就不同。");
  }

  return {
    lunar, hourBranch, gender,
    yearStem, yearBranch,
    yearBasis: "农历年（正月初一为界）",
    agreesWithSolarYear: agrees,
    bureau, layout,
    palaces: Object.freeze(palaces),
    sihua,
    limitDirection,
    warnings: Object.freeze(warnings),
  };
}

/** 宫干：年干起五虎遁，与命宫同一条规则。 */
function stemOfPalace(yearStem: Stem, branchIndex: number): string {
  // 五虎遁：甲己之年丙作首，自寅起
  const base = [2, 4, 6, 8, 0][STEMS.indexOf(yearStem) % 5]!;
  return STEMS[(((base + branchIndex - 2) % 10) + 10) % 10]!;
}

export const ZIWEI_PENDING_CALIBRATION: readonly string[] = Object.freeze([
  "火星铃星起例（各家分歧最大：有按年支三合分四组者，有另立表者；本项目取通行的一种）",
  "天魁天钺的年干表（庚干一位各家有异）",
  "闰月归属（本项目按闰月归本月；另有按下半月归次月者，换一种则月系星与十二宫全体移位）",
  "⚠️ 十四主星与六吉六煞的偏移表为凭记忆转录，未经实体书逐条核对；"
    + "结构性检查挡得住机械错误，挡不住把某一颗星的偏移记错一位",
  "未收录：三台八座、恩光天贵、龙池凤阁、红鸾天喜、孤辰寡宿等杂曜，"
    + "以及长生十二神、博士十二神与流曜 —— 各家起例差异大，无可靠底本",
  "命主身主未收录",
  "大限行进方向（阳男阴女顺行、阴男阳女逆行）与首限起岁取局数 —— 通行取法，未经底本核对",
]);

export { PALACE_NAMES };

/**
 * 紫微盘的状态空间 —— **穷举得出，不是估的**。
 *
 * 《测天，还是约定》第 7 章那张表上，紫微一行一直写着
 * 「不给 —— 本项目未实现，不装作知道」。现在实现了，就该给一个算出来的数。
 *
 * 输入的基数是 60 × 12 × 30 × 12 × 2 = 518,400
 * （农历年干支 × 月 × 日 × 时辰 × 性别）。但**落到盘上的不同盘少于这个数** ——
 * 不同的输入会给出同一张盘，而那正是这套起法值得一数的地方。
 *
 * 比对的「盘」取什么：十二宫各自的**星集合**加命宫位置加四化。
 * 不含大限（它只是同一张盘的时间切片），不含宫名（由命宫位置唯一决定）。
 *
 * ⚠️ 这个数依赖本模块收录的那些星。收更多杂曜会让盘更容易区分，
 * 故它是**本实现的**状态数，不是「紫微斗数的」状态数 ——
 * 这个区别要紧，写在返回值里。
 */
export interface ZiweiStateSpace {
  readonly inputs: number;
  readonly distinctCharts: number;
  readonly distinctStarLayouts: number;
  readonly collapseRatio: number;
  readonly note: string;
}

export function ziweiStateSpace(): ZiweiStateSpace {
  const charts = new Set<string>();
  const layouts = new Set<string>();
  let inputs = 0;
  for (let y = 0; y < 60; y++) {
    const yearStem = stemAt(y);
    const yearBranch = branchAt(y);
    const ybi = BRANCHES.indexOf(yearBranch);
    for (let month = 1; month <= 12; month++) {
      for (let hour = 0; hour < 12; hour++) {
        const layout = palaceLayout(month, hour);
        const bureau = bureauOf(yearStem, layout.mingIndex);
        const hua = sihuaOf(yearStem).map((h) => `${h.star}${h.kind}`).join(",");
        for (let day = 1; day <= 30; day++) {
          const zw = ziweiIndex(bureau.number, day);
          const stars = [
            ...majorStars(zw),
            ...luckyStars(month, hour, yearStem),
            ...unluckyStars(yearStem, ybi, hour),
            ...luMaStars(yearStem, ybi),
          ];
          const byPalace = new Array<string[]>(12);
          for (let i = 0; i < 12; i++) byPalace[i] = [];
          for (const st of stars) byPalace[st.index]!.push(st.name);
          const layoutKey = byPalace.map((xs) => xs.sort().join("/")).join("|");
          layouts.add(layoutKey);
          // 性别只改大限方向，不改星的落位，故不进盘的比对；
          // 但它确实是输入，故计入 inputs
          inputs += 2;
          charts.add(`${layout.mingIndex}#${layoutKey}#${hua}`);
        }
      }
    }
  }
  return {
    inputs,
    distinctCharts: charts.size,
    distinctStarLayouts: layouts.size,
    collapseRatio: inputs / charts.size,
    note: "这是**本实现所收星曜**下的状态数。收更多杂曜会让盘更易区分，"
      + "故它是本实现的数，不是「紫微斗数的」数。",
  };
}

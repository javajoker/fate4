/**
 * 天文与历法的**数值对应** —— 把「这套系统跟天象有多少关系」从分类推进到算式。
 *
 * [`substrate.ts`](./substrate.ts) 给了三档分类与一条定义层面的重合
 * （中气 = 入宫点）。这一层再往下挖四条，每一条都能算出数来，
 * 而且每一条都在说同一件事的不同侧面：
 *
 * | | 挖出来的 |
 * | --- | --- |
 * | **四余** | 七政四余的「四余」里，罗睺计都月孛**就是月亮的交点与远地点** —— 与西洋占星的北交点、Black Moon Lilith 是同一批天体 |
 * | **太岁** | 地支纪年起于木星的「次」，而木星周期是 11.862 年不是 12 年。差额累积到一整个次只要约 86 年 —— **这条天文连接早已漂没了** |
 * | **紫微** | 命宫、身宫、五行局全是农历月与时辰的**纯算术函数**，可穷举 —— 没有一步要查星历 |
 * | **平气／定气** | 1645 年之前的历书用平气，今天的排盘用定气。同一个人，两种算法的月柱**可以不同** |
 *
 * 前两条是「本来是天文的」，后两条是「本来就不是」与「天文含量变过」。
 * 合起来说明一件事：**天文含量不是一个固定标签，它有来历，也会变。**
 */

import { norm360 } from "../astro/angles.js";
import { julianCentury, type JulianDayTT } from "../astro/julian.js";
import { apparentSolarLongitude } from "../astro/sun.js";
import { asTT } from "../astro/julian.js";
import { vsop87 } from "../astro/vsop87.js";
import { termsInGregorianYear, MEAN_TERM_INTERVAL_DAYS } from "../astro/solarTerms.js";
import { signOf } from "./substrate.js";

// ═════════════════════════════════════════════════════════
// 一 · 四余：它们是月亮的交点与远地点
// ═════════════════════════════════════════════════════════

/**
 * 「七政四余」的四余，三个是实打实的天文点。
 *
 * 七政是日月五星，谁都知道那是天体。四余常被当成虚构的符号，其实不是：
 *
 * | 四余 | 梵名 | 它是什么 | 西洋占星里的名字 |
 * | --- | --- | --- | --- |
 * | **罗睺** | Rāhu | 月亮轨道的**升交点** | North Node |
 * | **计都** | Ketu | 月亮轨道的**降交点** | South Node |
 * | **月孛** | — | 月亮轨道的**远地点** | Black Moon Lilith（平朔望月版） |
 * | **紫炁** | — | ⚠️ 各家不一，周期约 28 年，无公认的天体对应 | —— |
 *
 * 前三个**不是类比，是同一批点**。它们唐代随印度天文传入，而印度那一套
 * 与希腊化天文同源 —— 所以中土的四余与西洋占星的交点，是同一条传播链的两端。
 *
 * 日月食只发生在交点附近（故名「蚀神」「罗睺吞日」），这是交点唯一的
 * 可观测后果，也正是它当初被编号入列的原因。
 */
export interface SiyuPositions {
  /** 升交点黄经。 */
  readonly rahu: number;
  /** 降交点黄经 = 升交点 + 180°。 */
  readonly ketu: number;
  /** 月亮远地点黄经 = 近地点 + 180°。 */
  readonly yuebei: number;
  /** 各自落在哪一宫 —— 用来与西洋星盘对读。 */
  readonly rahuSign: string;
  readonly ketuSign: string;
  readonly yuebeiSign: string;
}

/**
 * 月亮轨道升交点的平黄经（度）。
 *
 * 取 Meeus 第 47 章的平根多项式。**平**交点与真交点差约 ±1.5°，
 * 两者在占法上都有人用；此处只出平交点，并写明是平的。
 */
export function meanLunarNode(jdTT: JulianDayTT): number {
  const T = julianCentury(jdTT);
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T
    + T ** 3 / 467441 - T ** 4 / 60616000);
}

/**
 * 月亮近地点的平黄经（度）。
 *
 * = 月亮平黄经 − 月亮平近点角，两者都取 `moon.ts` 用的同一组多项式 ——
 * 这样它与本项目算出的月亮位置是**同一套根数**，不会各算各的。
 */
export function meanLunarPerigee(jdTT: JulianDayTT): number {
  const T = julianCentury(jdTT);
  const T2 = T * T; const T3 = T2 * T; const T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2
    + T3 / 538841 - T4 / 65194000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2
    + T3 / 69699 - T4 / 14712000;
  return norm360(Lp - Mp);
}

/** 四余（三个有天体对应的）在某一时刻的位置。 */
export function siyuAt(jdTT: JulianDayTT): SiyuPositions {
  const rahu = meanLunarNode(jdTT);
  const ketu = norm360(rahu + 180);
  const yuebei = norm360(meanLunarPerigee(jdTT) + 180);
  return {
    rahu, ketu, yuebei,
    rahuSign: signOf(rahu).name,
    ketuSign: signOf(ketu).name,
    yuebeiSign: signOf(yuebei).name,
  };
}

/** 交点退行一周的年数 —— 约 18.6 年，即著名的交点周期。 */
export const NODE_PERIOD_YEARS = 360 / 1934.1362891 * 100;
/** 近地点顺行一周的年数 —— 约 8.85 年。 */
export const PERIGEE_PERIOD_YEARS = 360 / 4069.0137287 * 100;

// ═════════════════════════════════════════════════════════
// 二 · 太岁：一条已经漂没了的天文连接
// ═════════════════════════════════════════════════════════

/**
 * 木星的恒星周期（儒略年）。
 *
 * 地支纪年起于**岁星纪年**：木星约十二年绕天一周，把黄道分成十二「次」，
 * 木星每年行一次，以此纪年。这是地支十二这个数的来历。
 *
 * 但木星的周期**不是 12 年**，是 11.862 年。
 */
export const JUPITER_SIDEREAL_YEARS = 11.862615;

/**
 * 岁星纪年与十二年固定周期之间的漂移。
 *
 * 每过 12 年，木星实际多走 `12 / 11.862615 − 1 ≈ 1.16%` 圈 —— 折合约 4.2°。
 * 累积到一整个「次」（30°）需要约 **86 年**。
 *
 * 古人早就发现了：这叫**超辰**（岁星跳过一次）。汉代历法里就有超辰的改正，
 * 而**太岁**这个概念正是为此而生 —— 它是一个假想的天体，
 * 与木星反向、严格十二年一周，用来替代那个不听话的真木星。
 *
 * 结果是：**地支纪年从此与木星脱钩。** 今天的「太岁」是一个纯粹的
 * 十二年计数器，它与天上那颗行星的关系，只剩下一个来历。
 *
 * 这是本模块最要紧的一条：**天文含量会随时间衰减。**
 * 一套起源于观测的系统，可以在保留全部术语的同时，
 * 把观测那一头悄悄换成约定 —— 而且换完之后外表毫无变化。
 */
export interface TaisuiDrift {
  /** 每十二年积累的偏差（度）。 */
  readonly degreesPer12Years: number;
  /** 累积一整个次（30°）需要多少年。 */
  readonly yearsPerStationSkip: number;
  /** 自某个起算年至今，累积偏了几个次。 */
  readonly stationsDrifted: number;
  /** 折合多少度。 */
  readonly degreesDrifted: number;
}

export function taisuiDrift(fromYear: number, toYear: number): TaisuiDrift {
  const revsPer12 = 12 / JUPITER_SIDEREAL_YEARS;
  const degreesPer12Years = (revsPer12 - 1) * 360;
  const perYear = degreesPer12Years / 12;
  const degreesDrifted = perYear * (toYear - fromYear);
  return {
    degreesPer12Years,
    yearsPerStationSkip: 30 / perYear,
    stationsDrifted: degreesDrifted / 30,
    degreesDrifted,
  };
}

// ═════════════════════════════════════════════════════════
// 三 · 紫微：命宫是一个纯算术函数
// ═════════════════════════════════════════════════════════

const BRANCHES12 = ["子", "丑", "寅", "卯", "辰", "巳",
  "午", "未", "申", "酉", "戌", "亥"] as const;

/**
 * 紫微斗数的命宫与身宫。
 *
 * 起法（各家一致的那一层）：
 *
 * ```
 * 自寅起正月，顺数至生月；再自该宫起子时，逆数至生时 → 命宫
 * 同起点，顺数至生时                                  → 身宫
 * ```
 *
 * **输入只有农历月与时辰两个整数。** 不查星历，不看节气，不要地点。
 * 这是 [`systems.ts`](./systems.ts) 把紫微归入「历法派生」而非「实测天体」
 * 的直接依据 —— 不是印象，是起法本身。
 *
 * @param lunarMonth 农历月 1–12（闰月按本月论，各家一致）
 * @param hourBranch 时辰 0–11，0 为子时
 */
export function ziweiPalaces(lunarMonth: number, hourBranch: number): {
  readonly ming: string; readonly shen: string;
  readonly mingIndex: number; readonly shenIndex: number;
} {
  if (!Number.isInteger(lunarMonth) || lunarMonth < 1 || lunarMonth > 12) {
    throw new Error(`农历月越界：${lunarMonth}`);
  }
  if (!Number.isInteger(hourBranch) || hourBranch < 0 || hourBranch > 11) {
    throw new Error(`时辰越界：${hourBranch}`);
  }
  // 寅 的下标是 2
  const monthPalace = (2 + (lunarMonth - 1)) % 12;
  const mingIndex = ((monthPalace - hourBranch) % 12 + 12) % 12;
  const shenIndex = (monthPalace + hourBranch) % 12;
  return {
    ming: BRANCHES12[mingIndex]!, shen: BRANCHES12[shenIndex]!,
    mingIndex, shenIndex,
  };
}

/**
 * 命宫与身宫的全部组合 —— 穷举 12 × 12。
 *
 * 用处是把「它的输入基数有多大」算实：144 种 (月, 时) 组合，
 * 映到多少对 (命宫, 身宫)。穷举得出的数**小于 144** —— 有重合，
 * 这本身就是这套起法的一个性质。
 */
export function ziweiPalaceSpace(): {
  readonly inputs: number; readonly distinctMing: number;
  readonly distinctPairs: number;
} {
  const ming = new Set<number>(); const pairs = new Set<string>();
  for (let m = 1; m <= 12; m++) {
    for (let h = 0; h < 12; h++) {
      const p = ziweiPalaces(m, h);
      ming.add(p.mingIndex);
      pairs.add(`${p.mingIndex},${p.shenIndex}`);
    }
  }
  return { inputs: 144, distinctMing: ming.size, distinctPairs: pairs.size };
}

// ═════════════════════════════════════════════════════════
// 四 · 平气与定气：1645 年那条缝
// ═════════════════════════════════════════════════════════

/**
 * 同一个节气，平气与定气差几天。
 *
 * - **平气**：把一个回归年等分二十四份，每份 `365.2422 / 24 ≈ 15.218` 天。
 *   冬至为起点，其余按等时距排。明末之前中国历法一直用它。
 * - **定气**：太阳**真实**走到那个黄经的时刻。地球轨道是椭圆，
 *   近日点（一月初）附近走得快、远日点（七月初）附近走得慢，
 *   故真实的节气间隔在 14.7–15.7 天之间变化。
 *
 * 两者在冬至、夏至附近几乎重合（那是误差的驻点），
 * 在春分、秋分附近差得最多 —— **可以差到两天**。
 *
 * ⚠️ **这不是学术细节，它直接改月柱。** 1645 年（清顺治二年，
 * 《时宪历》行用）之前出生的人，当时的历书按平气排月，
 * 而今天任何一个排盘程序按定气算 —— 两者给出的月柱可以不同。
 *
 * 本项目**一律用定气**（真实太阳黄经）。这对 1645 年之后是对的，
 * 对之前是「按今天的算法回推」，而不是「当时的历书怎么写」。
 * 两者是不同的问题，此处写明取的是前者。
 */
export interface QiComparison {
  readonly term: string;
  readonly longitude: number;
  /** 定气时刻（JD）。 */
  readonly trueJd: number;
  /** 平气时刻（JD），以同年冬至为锚等分。 */
  readonly meanJd: number;
  /** 定气 − 平气，天。正值表示真实节气来得晚。 */
  readonly diffDays: number;
}

/**
 * 给定年份，逐个节气比较平气与定气。
 *
 * 平气的锚取**该年的冬至**（定气冬至），自它起按等时距向后排 ——
 * 这是传统平气法的做法：冬至由圭表实测，其余由算术推。
 */
export function meanVsTrueTerms(year: number): readonly QiComparison[] {
  // 该公历年内的全部二十四节气，由现成的求解器一次给出
  const terms = termsInGregorianYear(year);
  // 平气的锚取**冬至**：传统上冬至由圭表实测，其余由算术等分推出
  const dongzhi = terms.find((t) => t.def.name === "冬至");
  if (dongzhi === undefined) throw new Error(`${year} 年没有冬至？`);
  const anchor = dongzhi.jdTT as number;

  return Object.freeze(terms.map((t) => {
    // 自冬至数到该节气隔了几个 15° 段（冬至黄经 270°）
    const steps = (((t.def.longitude - 270) % 360) + 360) % 360 / 15;
    // 冬至在年末，故年内早于它的节气要往回数一整年
    const k = (t.jdTT as number) < anchor ? steps - 24 : steps;
    const meanJd = anchor + k * MEAN_TERM_INTERVAL_DAYS;
    return {
      term: t.def.name, longitude: t.def.longitude,
      trueJd: t.jdTT as number, meanJd,
      diffDays: (t.jdTT as number) - meanJd,
    };
  }));
}

/** 平气与定气最大差几天 —— 扫一个年份区间取最大绝对值。 */
export function maxQiDivergence(fromYear: number, toYear: number): {
  readonly days: number; readonly term: string; readonly year: number;
} {
  let best = { days: 0, term: "", year: fromYear };
  for (let y = fromYear; y <= toYear; y++) {
    for (const c of meanVsTrueTerms(y)) {
      if (Math.abs(c.diffDays) > Math.abs(best.days)) {
        best = { days: c.diffDays, term: c.term, year: y };
      }
    }
  }
  return best;
}

/** 《时宪历》行用之年 —— 中国历法由平气改定气的那条缝。 */
export const DINGQI_REFORM_YEAR = 1645;

/**
 * 太阳单日行度 —— 用来直观看出「定气间隔为什么不等」。
 *
 * 近日点附近约 1.019°/日，远日点附近约 0.953°/日，差约 7%。
 * 一个 15° 的节气段因此在 14.7 到 15.7 天之间摆动。
 */
export function solarDailyMotion(jdTT: JulianDayTT): number {
  const a = apparentSolarLongitude(jdTT, vsop87);
  const b = apparentSolarLongitude(asTT((jdTT as number) + 1), vsop87);
  const d = b - a;
  return d < -180 ? d + 360 : d > 180 ? d - 360 : d;
}

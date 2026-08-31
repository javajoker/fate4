/**
 * 二十四节气。
 *
 * 节气的定义是**太阳视黄经取 15° 的整数倍的时刻** —— 是天文事件，
 * 不是历法约定。因此这里没有查表，只有对 λ(t) = target 的求根。
 *
 * 「节」与「气」交替：十二节定月支的边界，十二气不定边界。
 * 月柱一律以**节**为界 —— 这是四柱与农历最常被混淆的一处。
 */

import { MEAN_SOLAR_MOTION_DEG_PER_DAY, apparentSolarLongitude,
  type SolarLongitudeProvider } from "./sun.js";
import { DEFAULT_SOLAR_PROVIDER } from "./defaults.js";
import { normSigned } from "./angles.js";
import { asTT, asUT, fromJulianDay, toJulianDay, type JulianDay, type JulianDayTT } from "./julian.js";
import { deltaTSeconds } from "./deltaT.js";

export type TermKind = "节" | "气";

export interface SolarTermDef {
  readonly name: string;
  /** 太阳视黄经，度。 */
  readonly longitude: number;
  readonly kind: TermKind;
  /** 若为「节」，它开启哪一个月支；「气」为 null。 */
  readonly opensMonthBranch: string | null;
}

/** 自立春（315°）起，按黄经顺序排列。 */
export const SOLAR_TERMS: readonly SolarTermDef[] = Object.freeze([
  { name: "立春", longitude: 315, kind: "节", opensMonthBranch: "寅" },
  { name: "雨水", longitude: 330, kind: "气", opensMonthBranch: null },
  { name: "惊蛰", longitude: 345, kind: "节", opensMonthBranch: "卯" },
  { name: "春分", longitude: 0,   kind: "气", opensMonthBranch: null },
  { name: "清明", longitude: 15,  kind: "节", opensMonthBranch: "辰" },
  { name: "谷雨", longitude: 30,  kind: "气", opensMonthBranch: null },
  { name: "立夏", longitude: 45,  kind: "节", opensMonthBranch: "巳" },
  { name: "小满", longitude: 60,  kind: "气", opensMonthBranch: null },
  { name: "芒种", longitude: 75,  kind: "节", opensMonthBranch: "午" },
  { name: "夏至", longitude: 90,  kind: "气", opensMonthBranch: null },
  { name: "小暑", longitude: 105, kind: "节", opensMonthBranch: "未" },
  { name: "大暑", longitude: 120, kind: "气", opensMonthBranch: null },
  { name: "立秋", longitude: 135, kind: "节", opensMonthBranch: "申" },
  { name: "处暑", longitude: 150, kind: "气", opensMonthBranch: null },
  { name: "白露", longitude: 165, kind: "节", opensMonthBranch: "酉" },
  { name: "秋分", longitude: 180, kind: "气", opensMonthBranch: null },
  { name: "寒露", longitude: 195, kind: "节", opensMonthBranch: "戌" },
  { name: "霜降", longitude: 210, kind: "气", opensMonthBranch: null },
  { name: "立冬", longitude: 225, kind: "节", opensMonthBranch: "亥" },
  { name: "小雪", longitude: 240, kind: "气", opensMonthBranch: null },
  { name: "大雪", longitude: 255, kind: "节", opensMonthBranch: "子" },
  { name: "冬至", longitude: 270, kind: "气", opensMonthBranch: null },
  { name: "小寒", longitude: 285, kind: "节", opensMonthBranch: "丑" },
  { name: "大寒", longitude: 300, kind: "气", opensMonthBranch: null },
]);

/** 十二节 —— 定月支边界者。 */
export const JIE = SOLAR_TERMS.filter((t) => t.kind === "节");
/** 十二气。 */
export const QI = SOLAR_TERMS.filter((t) => t.kind === "气");

export interface SolveOptions {
  readonly provider?: SolarLongitudeProvider;
  /** 收敛容差，度。默认 1e-8°（约 0.036″，远严于级数本身的精度）。 */
  readonly toleranceDeg?: number;
  readonly maxIterations?: number;
}

export interface SolveResult {
  /** 求得的时刻，TT 标度。 */
  readonly jdTT: JulianDayTT;
  /** 同一时刻的 UT 标度（已扣除 ΔT）。 */
  readonly jdUT: JulianDay;
  readonly iterations: number;
  readonly residualDeg: number;
  /** 所用级数的自称精度，折算为时间秒。如实向上层报告。 */
  readonly estimatedUncertaintySeconds: number;
  readonly providerId: string;
  readonly meetsTolerance: boolean;
}

const DEFAULT_TOLERANCE_DEG = 1e-8;
const DEFAULT_MAX_ITERATIONS = 30;

/**
 * 求解 λ(t) = target 附近的根，Newton 法。
 *
 * 一阶导取太阳日均视行度（0.9856°/日）。真实行度在近日点与远日点相差约 ±1.7%，
 * 但 Newton 法对导数的粗估容忍度很高 —— 实测 3–4 轮即收敛到 1e-8°。
 */
export function solveSolarTerm(
  targetLongitudeDeg: number,
  approxJdTT: JulianDayTT,
  options: SolveOptions = {},
): SolveResult {
  const provider = options.provider ?? DEFAULT_SOLAR_PROVIDER;
  const tol = options.toleranceDeg ?? DEFAULT_TOLERANCE_DEG;
  const maxIter = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  let t = approxJdTT as number;
  let delta = Number.NaN;
  let i = 0;

  for (; i < maxIter; i++) {
    const lambda = apparentSolarLongitude(asTT(t), provider);
    delta = normSigned(targetLongitudeDeg - lambda);
    if (Math.abs(delta) < tol) break;
    t += delta / MEAN_SOLAR_MOTION_DEG_PER_DAY;
  }

  if (!(Math.abs(delta) < tol)) {
    throw new Error(
      `节气求解未收敛：目标黄经 ${targetLongitudeDeg}°，${maxIter} 轮后残差 ${delta}°`,
    );
  }

  const cal = fromJulianDay(t);
  const dt = deltaTSeconds(cal.year, cal.month);
  const jdUT = t - dt.seconds / 86400;

  // 级数精度折算为时间：Δλ(″) / 3600 / 0.9856(°/日) × 86400(秒/日)
  const uncertaintySeconds =
    (provider.statedAccuracyArcsec / 3600 / MEAN_SOLAR_MOTION_DEG_PER_DAY) * 86400;

  return {
    jdTT: asTT(t),
    jdUT: asUT(jdUT),
    iterations: i,
    residualDeg: delta,
    estimatedUncertaintySeconds: uncertaintySeconds,
    providerId: provider.id,
    meetsTolerance: provider.meetsSolarTermTolerance,
  };
}

/** 平均节气间隔（日）—— 回归年的二十四分之一。 */
export const MEAN_TERM_INTERVAL_DAYS = 365.2421897 / 24;

/**
 * 某公历年内的全部 24 个节气，按时刻升序。
 *
 * 一个公历年恰好含 24 个节气，自小寒（285°，约 1 月 5 日）起，至冬至（270°，约 12 月 22 日）止。
 * 注意这与「立春年」的划分不同 —— 后者是年柱的边界，见 chart 层。
 */
export function termsInGregorianYear(
  year: number,
  options: SolveOptions = {},
): readonly (SolveResult & { readonly def: SolarTermDef })[] {
  const jan1 = toJulianDay({ year, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
  const results: (SolveResult & { def: SolarTermDef })[] = [];

  // 公历年内的节气自小寒（285°）起，按黄经每 15° 递推
  const startIndex = SOLAR_TERMS.findIndex((t) => t.name === "小寒");

  for (let k = 0; k < 24; k++) {
    const def = SOLAR_TERMS[(startIndex + k) % 24]!;
    // 小寒约在 1 月 5 日，其后每节气约隔 15.218 日
    const guess = jan1 + 5 + k * MEAN_TERM_INTERVAL_DAYS;
    results.push({ ...solveSolarTerm(def.longitude, asTT(guess), options), def });
  }

  return results;
}

/**
 * 给定时刻落在哪一个「节」所开启的月支之内，并返回前后两个节。
 * 这是月柱定支的唯一依据。
 */
export function enclosingJie(
  jdTT: JulianDayTT,
  options: SolveOptions = {},
): { readonly prev: SolveResult & { def: SolarTermDef }; readonly next: SolveResult & { def: SolarTermDef } } {
  const cal = fromJulianDay(jdTT as number);
  // 取相邻三年的节，足以覆盖任何跨年情形
  const candidates = [cal.year - 1, cal.year, cal.year + 1]
    .flatMap((y) => termsInGregorianYear(y, options))
    .filter((r) => r.def.kind === "节")
    .sort((a, b) => (a.jdTT as number) - (b.jdTT as number));

  for (let i = 0; i < candidates.length - 1; i++) {
    const a = candidates[i]!;
    const b = candidates[i + 1]!;
    if ((a.jdTT as number) <= (jdTT as number) && (jdTT as number) < (b.jdTT as number)) {
      return { prev: a, next: b };
    }
  }
  throw new RangeError(`时刻 ${jdTT} 超出可求解的节气范围`);
}

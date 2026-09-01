/**
 * 参数载入与校验。
 *
 * 不引入 zod 一类校验库 —— core 需在浏览器、Node、Worker 中零运行时依赖地运行。
 * 默认值的形状已由 TypeScript 在编译期保证；运行时唯一需要防守的是**外部覆盖**，
 * 而那只需一张声明式的区间/枚举表加一个遍历器。
 *
 * 校验分两类，语义不同，不可合并：
 *   · **区间与枚举** —— 单个值是否落在允许范围内
 *   · **结构不变量** —— 多个值之间必须成立的关系（如干支占比之和为 1）
 * 后者才是真正会静默产出错误盘面的那一类。
 */

import { DEFAULT_PARAMS } from "./defaults.js";
import type { Params, PartialParams } from "./types.js";

const EPSILON = 1e-9;

interface RangeRule { readonly path: string; readonly min: number; readonly max: number }
interface EnumRule { readonly path: string; readonly values: readonly string[] }

const RANGES: readonly RangeRule[] = [
  { path: "weights.pillarBase", min: 1, max: 10000 },
  { path: "weights.stemShare", min: 0, max: 1 },
  { path: "weights.branchShare", min: 0, max: 1 },
  { path: "weights.monthCommand.branchMultiplier", min: 0.1, max: 10 },
  { path: "weights.monthCommand.stemMultiplier", min: 0.1, max: 10 },
  { path: "weights.monthCommand.silingBoost", min: 1, max: 5 },
  { path: "weights.luck.total", min: 1, max: 1000 },
  { path: "weights.luck.stemShareStart", min: 0, max: 1 },
  { path: "weights.luck.stemShareEnd", min: 0, max: 1 },
  { path: "weights.luck.stepFirstHalf", min: 0, max: 1 },
  { path: "weights.luck.stepSecondHalf", min: 0, max: 1 },
  { path: "weights.year.total", min: 1, max: 1000 },
  { path: "weights.year.stem", min: 0, max: 1000 },
  { path: "weights.year.branch", min: 0, max: 1000 },
  { path: "weights.kongwang.factor", min: 0, max: 1 },
  { path: "weights.revealedResonance", min: 0, max: 5 },
  { path: "weights.taiyuanTotal", min: 0, max: 1000 },

  { path: "propagation.damping", min: 0, max: 1 },
  { path: "propagation.maxRounds", min: 1, max: 100 },
  { path: "propagation.epsilon", min: 0, max: 1 },
  { path: "propagation.outflowCap", min: 0, max: 1 },
  { path: "propagation.inflowDamageCap", min: 0, max: 1 },
  { path: "propagation.kernel.sheng", min: 0, max: 2 },
  { path: "propagation.kernel.ke", min: 0, max: 2 },
  { path: "propagation.shengEfficiency", min: 0, max: 1 },
  { path: "propagation.keCost", min: 0, max: 2 },
  { path: "propagation.tongdang.beta", min: 0, max: 10 },

  { path: "conclusion.strengthBands.veryStrong", min: 0, max: 1 },
  { path: "conclusion.strengthBands.strong", min: 0, max: 1 },
  { path: "conclusion.strengthBands.balancedLow", min: 0, max: 1 },
  { path: "conclusion.strengthBands.weak", min: 0, max: 1 },
  { path: "conclusion.confidence.bandMargin", min: 0.001, max: 0.5 },
  { path: "conclusion.confidence.floor", min: 0, max: 1 },
  { path: "conclusion.congge.ratioThreshold", min: 0, max: 1 },
  { path: "conclusion.specialGe.zhuanwangThreshold", min: 0, max: 1 },
  { path: "conclusion.specialGe.huaqiConfidenceCap", min: 0, max: 1 },

  { path: "temporal.luckPillarCount", min: 1, max: 30 },
  { path: "temporal.yearRangeYears", min: 1, max: 200 },
  { path: "temporal.index.a", min: 0, max: 50 },
  { path: "temporal.index.b", min: 0, max: 50 },

  { path: "persona.excessShare", min: 0.05, max: 0.9 },
  { path: "persona.deficientShare", min: 0, max: 0.5 },
  { path: "persona.dominantMargin", min: 0.001, max: 0.5 },
  { path: "persona.excessBand", min: 0.05, max: 3 },
  { path: "persona.deficientBand", min: 0.05, max: 1 },
  { path: "persona.attackedBand", min: 0, max: 5 },
  { path: "persona.seasonAdjust", min: 0, max: 1 },
  { path: "persona.axisBand", min: 0.01, max: 1 },
];

const ENUMS: readonly EnumRule[] = [
  { path: "weights.monthCommand.silingResolution", values: ["exact", "sameElement", "none"] },
  { path: "weights.luck.mode", values: ["linear", "step"] },
  { path: "propagation.mode", values: ["syncIterative"] },
  { path: "propagation.tongdang.mode", values: ["resistance", "additive"] },
  { path: "conclusion.changshengSchool", values: ["yangForwardYinReverse", "sameBirthDeath"] },
  { path: "conclusion.earthChangsheng", values: ["fireEarthSame", "waterEarthSame"] },
  { path: "conclusion.yongshen.tiaohou.source", values: ["heuristic", "table"] },
  { path: "conclusion.femaleChildStarVariant", values: ["standard", "reversed"] },
  { path: "chart.ziHourRule", values: ["lateZiNextDay", "earlyZiSameDay", "split"] },
  { path: "chart.mingGongBoundary", values: ["jie", "zhongqi"] },
  { path: "chart.hiddenStemVariant", values: ["standard", "alt"] },
  { path: "temporal.qiyun.mode", values: ["continuous", "traditionalDiscrete"] },
  { path: "report.locale", values: ["zh-Hans", "zh-Hant", "en"] },
  { path: "persona.source", values: ["conventional"] },
  { path: "persona.neijingSource", values: ["conventional"] },
  { path: "persona.wuqiaoSource", values: ["yinyangYingxiang", "jinguiZhenyan"] },
];

function at(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, key) => (acc !== null && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(override)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined) continue;
    const cur = out[k];
    out[k] = isPlainObject(v) && isPlainObject(cur) ? deepMerge(cur, v) : v;
  }
  return out as T;
}

/** 逐值区间与枚举校验。 */
function validateValues(p: Params): string[] {
  const errors: string[] = [];
  for (const r of RANGES) {
    const v = at(p, r.path);
    if (typeof v !== "number" || !Number.isFinite(v)) {
      errors.push(`${r.path} 须为有限数值，实为 ${JSON.stringify(v)}`);
    } else if (v < r.min || v > r.max) {
      errors.push(`${r.path} 须在 [${r.min}, ${r.max}]，实为 ${v}`);
    }
  }
  for (const r of ENUMS) {
    const v = at(p, r.path);
    if (typeof v !== "string" || !r.values.includes(v)) {
      errors.push(`${r.path} 须为 ${r.values.join(" | ")} 之一，实为 ${JSON.stringify(v)}`);
    }
  }
  return errors;
}

/**
 * 结构不变量 —— 值与值之间必须成立的关系。
 * 这一类若被违反，引擎不会报错，只会静默产出错误的盘面，故必须在入口拦住。
 */
function validateInvariants(p: Params): string[] {
  const errors: string[] = [];
  const w = p.weights;

  const shareSum = w.stemShare + w.branchShare;
  if (Math.abs(shareSum - 1) > EPSILON) {
    errors.push(`weights.stemShare + branchShare 须为 1，实为 ${shareSum}`);
  }

  for (const n of [1, 2, 3] as const) {
    const split = w.hiddenSplit[n];
    if (split.length !== n) {
      errors.push(`weights.hiddenSplit.${n} 须有 ${n} 项，实为 ${split.length} 项`);
      continue;
    }
    const sum = split.reduce((a: number, b: number) => a + b, 0);
    if (Math.abs(sum - 1) > EPSILON) {
      errors.push(`weights.hiddenSplit.${n} 之和须为 1，实为 ${sum}`);
    }
    for (let i = 1; i < split.length; i++) {
      if (split[i]! > split[i - 1]!) {
        errors.push(`weights.hiddenSplit.${n} 须递减（本气 > 中气 > 余气），第 ${i + 1} 项反而更大`);
      }
    }
  }

  // 生的传输效率若 > 1 即凭空造质量，破坏「质量非增」不变量
  if (p.propagation.shengEfficiency > 1) {
    errors.push(`propagation.shengEfficiency 须 ≤ 1，否则「生」会凭空制造质量，实为 ${p.propagation.shengEfficiency}`);
  }

  // 旺衰五档的阈值必须严格递减，否则分档逻辑会静默失序
  const b = p.conclusion.strengthBands;
  if (!(b.veryStrong > b.strong && b.strong > b.balancedLow && b.balancedLow > b.weak)) {
    errors.push(
      `conclusion.strengthBands 须严格递减，实为 ${b.veryStrong} > ${b.strong} > ${b.balancedLow} > ${b.weak}`,
    );
  }

  // [硬约束] 流月流日不得重算权重 —— 月与日是引动的扳机，不是力量的来源。
  // 放开它会让一个 30 天的短期因素与终生不变的月令同台竞争数值，
  // 既无理论依据，也会让年度曲线被高频噪声淹没。
  if (p.temporal.monthLayer.recomputeWeights !== false) {
    errors.push("temporal.monthLayer.recomputeWeights 必须为 false（硬约束）");
  }
  if (p.temporal.dayLayer.recomputeWeights !== false) {
    errors.push("temporal.dayLayer.recomputeWeights 必须为 false（硬约束）");
  }

  // ── 未实现的开关必须锁在默认值上 ──
  //
  // 这几项在 params/default.yaml 里有条目、在 Params 里有字段，但引擎尚未实现。
  // 三种处置里只有一种是诚实的：
  //   删掉它们 → 丢掉路线图，日后会被当作疏漏补回来
  //   静默忽略 → 用户改了值、以为生效了，而盘面纹丝不动
  //   锁在默认值上并说明 → 条目还在，但改不动，且改的时候会告诉你为什么
  if (p.chart.hiddenStemVariant !== "standard") {
    errors.push("chart.hiddenStemVariant 目前只支持 standard —— 申/亥的藏干别本尚未录入（待校准 #5）");
  }
  if (p.chart.handleDst !== true) {
    errors.push("chart.handleDst 不可关闭 —— 时区换算无条件走 IANA 历史规则，没有旁路");
  }
  if (p.chart.includeShenGong !== false || p.chart.includeTaiXi !== false) {
    errors.push("chart.includeShenGong / includeTaiXi 尚未实现，须保持 false");
  }

  // [硬约束] 传统不反转季节。南半球生人仍按北半球节气定月 ——
  // 反转会同时改变月柱、司令、大运顺逆，而典籍中并无此说。
  if (p.chart.southernHemisphereFlip !== false) {
    errors.push("chart.southernHemisphereFlip 必须为 false（硬约束）");
  }

  // [硬约束] 措辞扫描与中性配色不可关闭。见 docs/09-report.md §6。
  // 这两项若可配置，就等于把「违反的输出视为 bug」降格成一句建议。
  if (p.report.guard.enforceBannedTerms !== true) {
    errors.push("report.guard.enforceBannedTerms 必须为 true（硬约束）");
  }
  if (p.report.guard.neutralPalette !== true) {
    errors.push("report.guard.neutralPalette 必须为 true（硬约束）");
  }

  // 过旺门槛须高于过弱门槛，否则同一个十神会被同时判为过旺与过弱
  if (p.persona.excessShare <= p.persona.deficientShare) {
    errors.push(
      `persona.excessShare(${p.persona.excessShare}) 须大于 deficientShare(${p.persona.deficientShare})，`
      + "否则同一个十神会被同时判为过旺与过弱",
    );
  }

  const yearSum = w.year.stem + w.year.branch;
  if (Math.abs(yearSum - w.year.total) > EPSILON) {
    errors.push(`weights.year.stem + branch 须等于 total(${w.year.total})，实为 ${yearSum}`);
  }

  return errors;
}

export class ParamsValidationError extends Error {
  constructor(public readonly errors: readonly string[]) {
    super(`参数校验失败：\n  ${errors.join("\n  ")}`);
    this.name = "ParamsValidationError";
  }
}

/** 载入参数。覆盖项与默认值深合并后校验；不合法即抛错，绝不静默取默认。 */
export function loadParams(overrides?: PartialParams): Params {
  const merged = overrides === undefined ? DEFAULT_PARAMS : deepMerge(DEFAULT_PARAMS, overrides);
  const errors = [...validateValues(merged), ...validateInvariants(merged)];
  if (errors.length > 0) throw new ParamsValidationError(errors);
  return merged;
}

/** 稳定序列化：键按字典序递归排序，使指纹与书写顺序无关。 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * 参数指纹 —— 写进每份报告，供日后回答「为什么现在算出来不一样」。
 * FNV-1a：无依赖、稳定、对本用途足够。
 */
export function paramsHash(p: Params): string {
  const json = stableStringify(p);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export { DEFAULT_PARAMS, stableStringify };

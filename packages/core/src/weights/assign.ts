/**
 * L1 配重 —— 把排盘结果转成一组带初始权重的载体。
 *
 * 本层**不做任何生克判断**，只回答「谁在场、各占多少分」。
 *
 * 每柱基准 100，天干与地支按 40:60 拆，地支再按藏干个数下发。
 * 月提单独放大；司令藏干额外加成后在月支内**重新归一**，故月支总量恒定，
 * 变的只是内部结构 —— 这正是「同一个月支，月初与月末力量结构不同」的来源。
 */

import { hiddenStemsOf, elementOf, polarityOf } from "../ganzhi/algebra.js";
import type { Branch, Pillar, Stem } from "../types/ganzhi.js";
import type { NatalChart } from "../chart/types.js";
import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import {
  addTrace, carrierId,
  type Carrier, type CarrierFlag, type PillarKind, type Position,
} from "./carrier.js";

export interface LuckContext {
  readonly pillar: Pillar;
  /** 交运后经过的年数，∈ [0, 10)。决定大运干支的内部分配。 */
  readonly elapsedYears: number;
}

export interface AssignInput {
  readonly chart: NatalChart;
  readonly luck?: LuckContext | null;
  readonly annual?: Pillar | null;
  readonly params?: Params;
}

export interface WeightTotals {
  readonly byPillar: Readonly<Partial<Record<PillarKind, number>>>;
  readonly byElement: Readonly<Record<string, number>>;
  readonly byPolarity: Readonly<Record<string, number>>;
  readonly grand: number;
}

export interface WeightedCarriers {
  readonly carriers: readonly Carrier[];
  readonly totals: WeightTotals;
  readonly context: {
    readonly silingStem: Stem;
    readonly silingSegment: 0 | 1 | 2;
    readonly silingApplied: boolean;
    readonly luckElapsedYears: number | null;
    readonly luckStemShare: number | null;
  };
}

/**
 * 大运天干占比随交运后经过的时间连续变化。
 *
 * 线性模式：0.70 → 0.30，**交叉点恰在第 5 年末**（elapsed = 5 时为 0.50）。
 * 与传统的硬切分不同，连续变化使同一步大运的第 4 年与第 6 年呈渐变而非阶跃，
 * 避免在运程曲线上制造人为的突变。
 */
export function luckStemShareAt(elapsedYears: number, p: Params): number {
  const L = p.weights.luck;
  if (L.mode === "step") return elapsedYears < 5 ? L.stepFirstHalf : L.stepSecondHalf;
  const t = Math.min(Math.max(elapsedYears, 0), 10) / 10;
  return L.stemShareStart + (L.stemShareEnd - L.stemShareStart) * t;
}

function makeCarrier(
  stem: Stem, position: Position, weight: number,
  hostBranch: Branch | null, role: Carrier["role"], rule: string,
  params: Record<string, number>,
): Carrier {
  return {
    id: carrierId(position),
    stem,
    element: elementOf(stem),
    polarity: polarityOf(stem),
    origin: position.layer === "stem" ? "revealed" : "hidden",
    position,
    hostBranch,
    role,
    weight,
    activity: 1,
    flags: [],
    trace: [{ layer: "L1", rule, from: 0, to: weight, cause: [], params }],
  };
}

/** 铺一柱：天干一个载体 + 地支藏干若干载体。 */
function layPillar(
  kind: PillarKind, pillar: Pillar, stemWeight: number, branchWeight: number,
  note: Record<string, number>,
): Carrier[] {
  const made: Carrier[] = [makeCarrier(
    pillar.stem, { pillar: kind, layer: "stem", hiddenIndex: null },
    stemWeight, null, null, "L1.stemShare", { ...note, stemWeight },
  )];
  for (const [i, h] of hiddenStemsOf(pillar.branch).entries()) {
    made.push(makeCarrier(
      h.stem, { pillar: kind, layer: "branch", hiddenIndex: i },
      branchWeight * h.share, pillar.branch, h.role,
      "L1.hiddenSplit", { ...note, branchWeight, share: h.share },
    ));
  }
  return made;
}

/**
 * 铺大运与流年。
 *
 * 与本命部分**完全分开** —— 基础盘只含本命的 L1，即时盘在它之上追加外部柱。
 * 这样「四柱的初始配重不随时点改变」是构造上的事实，而不是碰巧相等。
 */
export function layExternalCarriers(
  luck: LuckContext | null | undefined,
  annual: Pillar | null | undefined,
  params: Params = DEFAULT_PARAMS,
): { carriers: Carrier[]; luckStemShare: number | null } {
  const w = params.weights;
  const carriers: Carrier[] = [];
  let luckStemShare: number | null = null;

  // 大运：总量恒定，干支内部分配随经年变化
  if (luck != null) {
    luckStemShare = luckStemShareAt(luck.elapsedYears, params);
    carriers.push(...layPillar("luck", luck.pillar,
      w.luck.total * luckStemShare, w.luck.total * (1 - luckStemShare),
      { total: w.luck.total, stemShare: luckStemShare, elapsedYears: luck.elapsedYears }));
  }
  // 流年：干支为固定的 40:70，非本命的 40:60
  if (annual != null) {
    carriers.push(...layPillar("annual", annual, w.year.stem, w.year.branch,
      { total: w.year.total }));
  }
  return { carriers, luckStemShare };
}

export function assignWeights(input: AssignInput): WeightedCarriers {
  const p = input.params ?? DEFAULT_PARAMS;
  const w = p.weights;
  const chart = input.chart;
  const carriers: Carrier[] = [];

  const base = w.pillarBase;
  const stemW = base * w.stemShare;
  const branchW = base * w.branchShare;

  // ── 年柱 ──
  carriers.push(...layPillar("year", chart.year, stemW, branchW, { base }));

  // ── 月柱：月提放大 ──
  const monthStemW = stemW * w.monthCommand.stemMultiplier;
  const monthBranchW = branchW * w.monthCommand.branchMultiplier;
  const monthCarriers = layPillar("month", chart.month, monthStemW, monthBranchW,
    { base, stemMultiplier: w.monthCommand.stemMultiplier, branchMultiplier: w.monthCommand.branchMultiplier });

  // ── 司令加成后在月支内重归一：月支总量不变，只改内部结构 ──
  const siling = chart.siling;
  const allowBoost =
    w.monthCommand.useSilingTable
    && w.monthCommand.silingResolution !== "none"
    && siling.resolvedTo !== null
    && (w.monthCommand.silingResolution === "sameElement" || siling.resolution === "exact");

  if (allowBoost) {
    const hidden = monthCarriers.filter((c) => c.position.layer === "branch");
    const boosted = hidden.map((c) =>
      c.stem === siling.resolvedTo ? c.weight * w.monthCommand.silingBoost : c.weight);
    const sum = boosted.reduce((a, b) => a + b, 0);
    const norm = sum > 0 ? monthBranchW / sum : 1;
    for (const [i, c] of hidden.entries()) {
      addTrace(c, {
        layer: "L1", rule: "L1.silingBoost", cause: [],
        params: { silingBoost: w.monthCommand.silingBoost, renormalize: norm },
        note: c.stem === siling.resolvedTo
          ? `${siling.stem}司令（第${siling.segment + 1}段，${siling.resolution}）`
          : "司令加成后组内重归一",
      }, boosted[i]! * norm);
      if (c.stem === siling.resolvedTo) c.flags.push("SILING");
    }
  }
  carriers.push(...monthCarriers);

  // ── 日柱、时柱 ──
  carriers.push(...layPillar("day", chart.day, stemW, branchW, { base }));
  if (chart.hour !== null) {
    carriers.push(...layPillar("hour", chart.hour, stemW, branchW, { base }));
  }

  // ── 胎元（默认关闭）──
  if (w.includeTaiyuan) {
    const tW = w.taiyuanTotal;
    carriers.push(...layPillar("taiyuan", chart.taiyuan,
      tW * w.stemShare, tW * w.branchShare, { base: tW }));
  }

  // ── 大运与流年 ──
  const ext = layExternalCarriers(input.luck, input.annual, p);
  carriers.push(...ext.carriers);
  const luckStemShare = ext.luckStemShare;

  markFlags(carriers);

  return { carriers, totals: totalsOf(carriers), context: {
    silingStem: siling.stem,
    silingSegment: siling.segment,
    silingApplied: allowBoost,
    luckElapsedYears: input.luck?.elapsedYears ?? null,
    luckStemShare,
  } };
}

/** 本命一系的柱 —— 由出生时刻直接确定，与所处时点无关。 */
const NATAL_PILLARS: ReadonlySet<PillarKind> = new Set(
  ["year", "month", "day", "hour", "taiyuan"] as const,
);

const FLAGS_SET_HERE: readonly CarrierFlag[] = ["DAY_MASTER", "REVEALED", "EVOKED"];

/**
 * 标记日主、透干、引出。
 *
 * ## 透干只看本命天干
 *
 * 原实现把**全部**天干（含大运、流年）收进 `revealedStems`，于是流年天干
 * 会把本命藏干标成「透干」。这混淆了两个不同的概念：
 *
 * - **透干**：藏干在本命天干中现身。这是盘面的**恒定结构属性**
 * - **引出**：岁运带来同字天干。这是**当时的**引动，明年就没了
 *
 * 把后者标成前者，等于宣称一个并不存在的永久属性；
 * 也让四柱的 L1 配重不再与时点无关，基础盘就无从冻结复用。
 * 故拆成两个标记，二者可并存（本命已透，岁运再遇）。
 *
 * 此改动**不影响任何权重** —— `weights.revealedResonance` 刻意置 1.00，
 * 透干效应由 L3 的距离模型承担。两个标记只用于展示与叙述。
 *
 * **幂等**：先清后设，故基础盘与即时盘可对同一批载体重复调用。
 */
export function markFlags(carriers: readonly Carrier[]): void {
  const stemsOf = (natal: boolean) => new Set(
    carriers
      .filter((c) => c.position.layer === "stem" && NATAL_PILLARS.has(c.position.pillar) === natal)
      .map((c) => c.stem),
  );
  const natalStems = stemsOf(true);
  const externalStems = stemsOf(false);

  for (const c of carriers) {
    c.flags = c.flags.filter((f) => !FLAGS_SET_HERE.includes(f));
    if (c.position.pillar === "day" && c.position.layer === "stem") c.flags.push("DAY_MASTER");
    if (c.position.layer === "branch") {
      if (natalStems.has(c.stem)) c.flags.push("REVEALED");
      if (externalStems.has(c.stem)) c.flags.push("EVOKED");
    }
  }
}

export function totalsOf(carriers: readonly Carrier[]): WeightTotals {
  const byPillar: Partial<Record<PillarKind, number>> = {};
  const byElement: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const byPolarity: Record<string, number> = { 阳: 0, 阴: 0 };
  let grand = 0;
  for (const c of carriers) {
    byPillar[c.position.pillar] = (byPillar[c.position.pillar] ?? 0) + c.weight;
    byElement[c.element] = (byElement[c.element] ?? 0) + c.weight;
    byPolarity[c.polarity] = (byPolarity[c.polarity] ?? 0) + c.weight;
    grand += c.weight;
  }
  return { byPillar, byElement, byPolarity, grand };
}

/**
 * L5c 生命曲线 —— 以基础盘为固定基准，按月采样的多条序列。
 *
 * ## 为什么按月，而流月又不加权
 *
 * 曲线本来就是连续的，有三个来源：
 *
 * | 来源 | 形态 |
 * | 流年 | **阶跃**，立春换柱 |
 * | 大运 | **斜坡**，天干占比自 0.70 线性降到 0.30，每年约 5.2 单位由干移向支 |
 * | 结构 | **可能翻转** —— 冲的裁决依赖相对权重，而权重在运内推移 |
 *
 * 第三条是实测的，不是推想：528 步运里 191 次出现同一组参与者的事件结局翻转，
 * 形态如「冲而拔根 ⇄ 相冲」（强弱比穿过 2.50 门槛）、
 * 「合解冲 ⇄ 相冲」（冲合裁决整个反转）。年度采样会把这些整个抹掉。
 *
 * **但流月仍不参与权重。**月度上之所以有变化，是大运份额在推移，不是流月加了分。
 * 流月只入符号层：它进扰动序列，不进权重序列。这一点由参数校验强制，
 * 也必须写进报告 —— 否则读者会误以为流月在加权。
 *
 * ## 关于 `deltas` 的一条要紧的说明
 *
 * `delta = value − baseValue`。对**权重类**的序列（十神、五行、宫位、日主权重），
 * 这个差里**大半是大运流年带来的新质量**，不是「涨了」——
 * 实测本命盘总量约 435，加上大运流年约 696，涨了六成。
 * 所以 `element.水` 的 delta 中位数 +44.9 **不能读作「水旺了一倍」**。
 *
 * 规格初稿说「统计节点跑在 delta 上，不跑在 value 上，因为前者的零点有意义」——
 * 这条推理是错的：`z = (q − μ)/σ` 对常数平移不变，q 取 value 还是 delta，
 * 算出来的 z 一模一样。零点对节点检出**毫无影响**。
 *
 * 零点真正有影响的地方是**叙述**：「较本命高出多少」这句话若用权重类的 delta 来说，
 * 就把新增质量说成了增长。要说这句话，得用已有的、去稀释的份额偏离
 * （`views.ts` 的 `shareDeltaOf`）。此处不另造一套。
 *
 * 比例类的序列（同党占比、留存、流通、域张力、顺逆指数）没有这个问题。
 * 扰动类在基础盘上无对应物，零点即 0。
 *
 * ## 成本
 *
 * 60 年 × 12 = 720 次 `evaluateAt`，每次约 1.2 ms。基础盘只算一次。
 * 立春每年解一次（60 次牛顿求根），不是每个采样点解一次。
 */

import {
  ELEMENTS, TEN_GODS,
  type Branch, type Element, type Pillar, type Polarity, type TenGod,
} from "../types/ganzhi.js";
import {
  BRANCH_CLASHES, BRANCH_DESTRUCTIONS, BRANCH_HARMS, BRANCH_SIX_COMBINATIONS,
  CONTROLS, DIRECTIONALS, GENERATES, MONTH_BRANCH_ORDER, PUNISHMENTS, TRINITIES,
} from "../ganzhi/tables.js";
import { controlledBy, generatedBy, monthStemOf } from "../ganzhi/algebra.js";
import { GOD_GROUPS, tenGodOf } from "../conclude/tenGods.js";
import { TROPICAL_YEAR_DAYS } from "../chart/qiyun.js";
import type { BaseChart } from "../chart/baseChart.js";
import type { SeriesParams } from "../params/types.js";
import { DOMAIN_LABEL, type Domain } from "../yingqi/types.js";
import { aggregateDomains } from "../yingqi/domains.js";
import { runYingqi } from "../yingqi/engine.js";
import { evaluateAt, type EvaluatedChart } from "./evaluate.js";
import { annualPillarOf, lichunJdOf, favorIndexOf } from "./views.js";
import { PALACE, type PalaceName } from "../shensha/scan.js";
import type { PillarKind } from "../weights/carrier.js";

// ─────────────────────────────────────────────────────────

export type SeriesKind =
  | "tenGod" | "element" | "palace" | "dayMaster"
  | "innerOuter" | "domain" | "metric" | "agitation";

export interface SeriesFrame {
  /** 采样时刻（儒略日 UT）。 */
  readonly jd: number;
  /** 立春年。 */
  readonly year: number;
  /** 该立春年内的第几个节气月，0 = 寅月。 */
  readonly monthIndex: number;
  readonly luckIndex: number | null;
  readonly luckPillar: Pillar | null;
  readonly elapsedYears: number;
  readonly annual: Pillar;
  /** 流月柱。**只入符号层。** */
  readonly fleetingMonth: Pillar;
  /** 该点是否落在统计基准窗内。 */
  readonly inStatsWindow: boolean;
}

export interface Series {
  /** 如 `tenGod.正官`、`palace.配偶宫`、`agitation.命宫`。 */
  readonly id: string;
  readonly kind: SeriesKind;
  readonly label: string;
  /** 该量在基础盘上的值 —— delta 的零点。扰动类无基础盘对应物，取 0。 */
  readonly baseValue: number;
  readonly values: readonly number[];
  /**
   * `values[i] − baseValue`。
   *
   * ⚠️ 权重类序列的 delta 含大运流年带来的新质量，**不是净增长**。见模块头。
   * 节点检出用 z 分数，对平移不变，故用 values 或 deltas 结果相同。
   */
  readonly deltas: readonly number[];
  /** 该量是用神向、忌神向，还是不判方向（宫位、域张力）。 */
  readonly polarity: "favorable" | "adverse" | "neutral";
  /**
   * 流月是否真的进入这条序列 —— 决定节点报到年还是报到月。
   *
   * 流月**只入符号层**（`fleetingMonthInWeights: false`，硬约束）。
   * 于是立春年内唯一在动的权重来源是大运斜坡，而它是缓慢单调的；
   * 真正的跳变全部发生在立春换柱那一刻。实测后果很直白：
   * 权重类序列的节点有 **81%–100% 起于寅月**，而扰动序列只有 27%。
   *
   * 所以对权重类序列写「2046 年寅月起」是伪精度 ——
   * 它说的其实是「2046 这个立春年」。报告据此改写措辞，不是把这件事藏起来。
   *
   * 应期域取 `scope: "year"`，按构造也是年尺度，故同样为 false。
   */
  readonly monthResolving: boolean;
}

export interface SeriesSet {
  readonly base: BaseChart;
  readonly frames: readonly SeriesFrame[];
  readonly series: readonly Series[];
  readonly statsFrom: number;
  readonly statsTo: number;
  readonly samplesPerYear: number;
}

export interface SeriesOptions {
  /** 起始立春年。默认起运所在的年。 */
  readonly fromYear?: number;
  /** 绘制年数。默认 `series.drawYears`。 */
  readonly years?: number;
  /** 统计基准窗年数。默认 `series.spanYears`。 */
  readonly statsYears?: number;
}

// ─────────────────────────────────────────────────────────
// 扰动
// ─────────────────────────────────────────────────────────

const pairIn = (
  t: readonly (readonly [Branch, Branch] | readonly [Branch, Branch, Element])[],
  a: Branch, b: Branch,
) => t.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const sameTrinity = (a: Branch, b: Branch) =>
  a !== b && TRINITIES.some((t) => [t.sheng, t.wang, t.mu].includes(a)
    && [t.sheng, t.wang, t.mu].includes(b));

const sameDirectional = (a: Branch, b: Branch) =>
  a !== b && DIRECTIONALS.some((d) => (d.branches as readonly Branch[]).includes(a)
    && (d.branches as readonly Branch[]).includes(b));

const inPunishment = (a: Branch, b: Branch) =>
  PUNISHMENTS.some((p) => p.branches.includes(a) && p.branches.includes(b)
    && (a !== b || p.kind === "自刑"));

/**
 * 两支之间的关系强度。
 *
 * 只取**一条**，不叠加 —— 同一对关系被数两遍会让扰动虚高。
 *
 * 次序沿用 L2 的 `structure.precedence`（三会 > 三合 > 半合 > 六合 > 冲 > 刑 > 害 > 破），
 * 但把冲提到最前 —— 此处量的是「被引动的程度」，冲是最强的引动。
 *
 * ⚠️ **有两对支同时属于两类**：子丑（六合，又在亥子丑三会内）、
 * 午未（六合，又在巳午未三会内）。此处按局论，与 L2 的优先级一致 ——
 * 不是因为局一定比合强，而是因为**同一份判断在两处必须给同一个答案**。
 */
export function relationStrength(a: Branch, b: Branch, p: SeriesParams["agitation"]): number {
  if (pairIn(BRANCH_CLASHES, a, b)) return p.chong;
  if (sameTrinity(a, b) || sameDirectional(a, b)) return p.sanheSanhui;
  if (pairIn(BRANCH_SIX_COMBINATIONS, a, b)) return p.liuhe;
  if (inPunishment(a, b)) return p.xing;
  if (pairIn(BRANCH_HARMS, a, b)) return p.hai;
  if (pairIn(BRANCH_DESTRUCTIONS, a, b)) return p.po;
  return 0;
}

/**
 * 某个固定支在某一时点被引动的程度。
 *
 * 流月**可以**参与这里 —— 扰动是符号层的量，不是权重。
 * 这正是「年月神煞入命」在曲线上的落法。
 */
function agitationAt(
  fixed: Branch, f: SeriesFrame, p: SeriesParams["agitation"],
): number {
  let sum = 0;
  if (f.luckPillar !== null) sum += relationStrength(f.luckPillar.branch, fixed, p) * p.layerLuck;
  sum += relationStrength(f.annual.branch, fixed, p) * p.layerAnnual;
  sum += relationStrength(f.fleetingMonth.branch, fixed, p) * p.layerMonth;
  return sum;
}

// ─────────────────────────────────────────────────────────

function framesOf(base: BaseChart, opts: SeriesOptions): SeriesFrame[] {
  const sp = base.params.series;
  const startAge = base.chart.luck.startAgeYears;
  const birthYear = base.chart.input.year;
  const fromYear = opts.fromYear ?? Math.floor(birthYear + startAge);
  const years = opts.years ?? sp.drawYears;
  const statsYears = Math.min(opts.statsYears ?? sp.spanYears, years);
  const per = sp.samplesPerYear;
  const step = TROPICAL_YEAR_DAYS / per;

  const out: SeriesFrame[] = [];
  for (let k = 0; k < years; k++) {
    const year = fromYear + k;
    // 立春每年解一次，不是每个采样点解一次
    const lichun = lichunJdOf(year);
    const annual = annualPillarOf(year);
    for (let m = 0; m < per; m++) {
      const jd = lichun + m * step;
      const lp = base.chart.luck.pillars.find((x) => jd >= x.startJd && jd < x.endJd) ?? null;
      const branch = MONTH_BRANCH_ORDER[m % 12]!;
      out.push({
        jd, year, monthIndex: m,
        luckIndex: lp?.index ?? null,
        luckPillar: lp?.pillar ?? null,
        elapsedYears: lp === null ? 0 : (jd - lp.startJd) / TROPICAL_YEAR_DAYS,
        annual,
        fleetingMonth: { stem: monthStemOf(annual.stem, branch), branch },
        inStatsWindow: k < statsYears,
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────

export function buildSeries(base: BaseChart, opts: SeriesOptions = {}): SeriesSet {
  const sp = base.params.series;
  const frames = framesOf(base, opts);
  const y = base.conclusions.yongshen.value;
  const favorable = new Set<Element>([y.primary, ...y.xishen]);
  const adverse = new Set<Element>([...y.jishen, ...y.choushen]);

  // 逐点求解。基础盘不重算 —— evaluateAt 收的正是它。
  const evs: EvaluatedChart[] = frames.map((f) => evaluateAt(base, {
    luck: f.luckPillar === null ? null
      : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
    annual: f.annual,
    fleetingMonth: f.fleetingMonth,
  }));

  // 域需要跑一遍应期规则
  const domainsAt = evs.map((ev, i) => {
    const f = frames[i]!;
    return aggregateDomains(runYingqi({
      chart: base.chart, natal: base, now: ev,
      luck: f.luckPillar, annual: f.annual, scope: "year",
      shareDelta: shareDeltaOf(base, ev),
    }, "year"));
  });

  const out: Series[] = [];
  // 除扰动外一律 monthResolving: false —— 流月不加权，见 Series.monthResolving
  const push = (
    id: string, kind: SeriesKind, label: string, baseValue: number,
    polarity: Series["polarity"], pick: (ev: EvaluatedChart, i: number) => number,
  ) => {
    const values = evs.map(pick);
    out.push({ id, kind, label, baseValue, values,
      deltas: values.map((v) => v - baseValue), polarity, monthResolving: false });
  };

  // ── 十神 10 条 ──
  // 十神有用忌方向：先换算到五行，再看它落在喜用还是忌仇。
  // 初版一律给 neutral，于是全部节点都报「只报变动」，方向那一栏形同虚设。
  for (const g of TEN_GODS) {
    const el = godElementOf(base.conclusions.dayMaster.element, g);
    push(`tenGod.${g}`, "tenGod", g, base.conclusions.tenGods[g],
      favorable.has(el) ? "favorable" : adverse.has(el) ? "adverse" : "neutral",
      (ev) => ev.conclusions.tenGods[g]);
  }
  // ── 五行 5 条 ──
  for (const e of ELEMENTS) {
    push(`element.${e}`, "element", e, base.propagation.byElement[e],
      favorable.has(e) ? "favorable" : adverse.has(e) ? "adverse" : "neutral",
      (ev) => ev.propagation.byElement[e]);
  }
  // ── 宫位权重 8 条（不判方向）──
  for (const [key, name] of Object.entries(PALACE) as [string, PalaceName][]) {
    const [pillar, layer] = key.split(".") as [PillarKind, "stem" | "branch"];
    if (layer === undefined) continue;
    const sumAt = (cs: EvaluatedChart["carriers"]) => cs
      .filter((c) => c.position.pillar === pillar && c.position.layer === layer)
      .reduce((a, c) => a + c.weight, 0);
    const bv = sumAt(base.carriers);
    if (bv === 0) continue;
    push(`palace.${name}.${layer}`, "palace", `${name}（${layer === "stem" ? "干" : "支"}）`,
      bv, "neutral", (ev) => sumAt(ev.carriers));
  }
  // ── 日主 3 条 ──
  push("dayMaster.weight", "dayMaster", "日主权重",
    base.conclusions.dayMaster.weight, "favorable", (ev) => ev.conclusions.dayMaster.weight);
  push("dayMaster.party", "dayMaster", "同党占比",
    base.conclusions.party.ratio, "neutral", (ev) => ev.conclusions.party.ratio);
  push("dayMaster.rootScore", "dayMaster", "通根评分",
    base.conclusions.rootScore, "favorable", (ev) => ev.conclusions.rootScore);
  // ── 内外 2 条 ──
  push("innerOuter.revealRatio", "innerOuter", "显隐比",
    base.persona.revealRatio, "neutral", (ev) => revealRatioOf(ev));
  push("innerOuter.tension", "innerOuter", "内外张力",
    base.persona.innerOuterTension, "neutral",
    (ev) => innerOuterTensionOf(ev, base.conclusions.dayMaster));
  // ── 域 18 条（张力恒不判方向）──
  const domains = Object.keys(DOMAIN_LABEL) as Domain[];
  for (const d of domains) {
    push(`domain.${d}.tension`, "domain", `${DOMAIN_LABEL[d]}·张力`, 0, "neutral",
      (_ev, i) => domainsAt[i]!.find((x) => x.domain === d)?.tension ?? 0);
    push(`domain.${d}.net`, "domain", `${DOMAIN_LABEL[d]}·净值`, 0, "neutral",
      (_ev, i) => domainsAt[i]!.find((x) => x.domain === d)?.net ?? 0);
  }
  // ── 综合 3 条 ──
  push("metric.vitality", "metric", "单轮留存",
    base.propagation.vitality, "favorable", (ev) => ev.propagation.vitality);
  push("metric.circulation", "metric", "流通度",
    base.conclusions.metrics.circulation, "favorable", (ev) => ev.conclusions.metrics.circulation);
  // 顺逆指数的零点是 50（tanh 的中点），不是基础盘上的某个值
  push("metric.favorIndex", "metric", "顺逆指数",
    50, "favorable", (ev) => favorIndexOf(base, ev, [], base.params).index);
  // ── 扰动：命宫、胎元，以及本命四支 ──
  const fixed: [string, Branch][] = [];
  if (base.chart.mingGong !== null) fixed.push(["命宫", base.chart.mingGong.branch]);
  fixed.push(["胎元", base.chart.taiyuan.branch]);
  for (const [k, pil] of [["年支", base.chart.year], ["月支", base.chart.month],
    ["日支", base.chart.day], ["时支", base.chart.hour]] as const) {
    if (pil !== null) fixed.push([k, pil.branch]);
  }
  for (const [name, br] of fixed) {
    const values = frames.map((f) => agitationAt(br, f, sp.agitation));
    out.push({
      id: `agitation.${name}`, kind: "agitation", label: `${name}扰动`,
      // 扰动在基础盘上无对应物 —— 本命自身不引动自身，零点即 0
      baseValue: 0, values, deltas: values, polarity: "neutral",
      // 唯一吃流月的一类：`agitationAt` 收 `f.fleetingMonth`
      monthResolving: true,
    });
  }

  const statsFrames = frames.filter((f) => f.inStatsWindow);
  return {
    base, frames, series: out,
    statsFrom: statsFrames[0]?.year ?? frames[0]?.year ?? 0,
    statsTo: statsFrames[statsFrames.length - 1]?.year ?? 0,
    samplesPerYear: sp.samplesPerYear,
  };
}

// ─────────────────────────────────────────────────────────

/**
 * 某一时点的内外张力。按五组算，与 L4p 同一形式。
 *
 * 初版此处直接返回基础盘的值 —— 那条序列于是全程恒定，
 * 既没有信息，又会成为统计节点的假阳性温床（σ≈0 时任何抖动都放大成大 z）。
 */
function innerOuterTensionOf(
  ev: EvaluatedChart, dm: { element: Element; polarity: Polarity },
): number {
  const inner = Object.fromEntries(TEN_GODS.map((g) => [g, 0])) as Record<TenGod, number>;
  const outer = Object.fromEntries(TEN_GODS.map((g) => [g, 0])) as Record<TenGod, number>;
  for (const c of ev.carriers) {
    if (c.flags.includes("DAY_MASTER")) continue;
    const g = tenGodOf(dm.element, dm.polarity, c.element, c.polarity);
    if (c.origin === "hidden") inner[g] += c.weight; else outer[g] += c.weight;
  }
  const norm = (v: Record<TenGod, number>) => {
    const sum = TEN_GODS.reduce((a, g) => a + v[g], 0);
    return (k: keyof typeof GOD_GROUPS) =>
      (sum > 0 ? GOD_GROUPS[k].reduce((a, g) => a + v[g], 0) / sum : 0);
  };
  const gi = norm(inner); const go = norm(outer);
  return 0.5 * (Object.keys(GOD_GROUPS) as (keyof typeof GOD_GROUPS)[])
    .reduce((a, k) => a + Math.abs(gi(k) - go(k)), 0);
}

function revealRatioOf(ev: EvaluatedChart): number {
  let inner = 0; let outer = 0;
  for (const c of ev.carriers) {
    if (c.flags.includes("DAY_MASTER")) continue;
    if (c.origin === "hidden") inner += c.weight; else outer += c.weight;
  }
  return inner + outer > 0 ? outer / (inner + outer) : 0;
}

/** 十神 → 五行。与 report/assemble.ts 的同名函数同一张表。 */
function godElementOf(D: Element, god: TenGod): Element {
  switch (god) {
    case "比肩": case "劫财": return D;
    case "食神": case "伤官": return GENERATES[D];
    case "正财": case "偏财": return CONTROLS[D];
    case "正官": case "七杀": return controlledBy(D);
    default: return generatedBy(D);
  }
}

/** 与 views.ts 的同名函数一致：相对「中性的一年」，不是相对本命盘。 */
function shareDeltaOf(
  natal: { propagation: { byElement: Readonly<Record<Element, number>> } },
  now: { propagation: { byElement: Readonly<Record<Element, number>> } },
): Record<Element, number> {
  const a = natal.propagation.byElement;
  const b = now.propagation.byElement;
  const massN = ELEMENTS.reduce((t, e) => t + a[e], 0);
  const massNow = ELEMENTS.reduce((t, e) => t + b[e], 0);
  if (massNow <= 0) return Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  const added = (massNow - massN) / ELEMENTS.length;
  return Object.fromEntries(
    ELEMENTS.map((e) => [e, (b[e] - a[e] - added) / massNow])) as Record<Element, number>;
}

/**
 * 大运 · 流年 · 流月 · 流日 四层视图。
 */

import { ELEMENTS, type Branch, type Element, type Pillar } from "../types/ganzhi.js";
import {
  branchAt, elementOf, monthStemOf, mod, polarityOf, stepBranch, stepStem,
} from "../ganzhi/algebra.js";
import { BRANCH_CLASHES, BRANCH_HARMS, BRANCH_DESTRUCTIONS, BRANCH_SIX_COMBINATIONS, MONTH_BRANCH_ORDER } from "../ganzhi/tables.js";
import { fromJulianDay, julianDayNumber, toJulianDay } from "../astro/julian.js";
import { enclosingTermOf, utToTT } from "../chart/pillars.js";
import { solveSolarTerm, SOLAR_TERMS } from "../astro/solarTerms.js";
import { asTT } from "../astro/julian.js";
import { TROPICAL_YEAR_DAYS } from "../chart/qiyun.js";
import type { NatalChart } from "../chart/types.js";
import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import { luckStemShareAt } from "../weights/assign.js";
import { tenGodOf } from "../conclude/tenGods.js";
import { scanShensha } from "../shensha/scan.js";
import { runYingqi } from "../yingqi/engine.js";
import { aggregateDomains } from "../yingqi/domains.js";
import type { YingqiContext } from "../yingqi/types.js";
import { evaluateAt, type EvaluatedChart } from "./evaluate.js";
import { toBaseChart, type BaseChart, type SolvedChart } from "../chart/baseChart.js";
import type {
  DayView, ElementConflict, Interaction, LuckStep, MonthView, YearView,
} from "./types.js";

const PALACE_OF: Readonly<Record<string, string>> = Object.freeze({
  year: "祖上根基", month: "父母门户", day: "自身配偶", hour: "子女晚境",
});

/** 柱名的中文标签 —— 叙述文本中不得漏出英文键名。 */
const PILLAR_LABEL: Readonly<Record<string, string>> = Object.freeze({
  year: "年", month: "月", day: "日", hour: "时",
});

/**
 * 五行占比的变化 —— **相对于「中性的一年」，不是相对于本命盘**。
 *
 * ## 为什么不能直接作差
 *
 * 本命盘约 400 单位、加上大运流年约 640。直接比较两者的占比，量到的主要是**稀释**：
 * 份额之和恒为 1，新增的载体必然把各五行的占比拉向均匀。
 * 而用神之所以是用神，正因为它在本命盘里弱；忌神之所以是忌神，正因为它强。
 * 于是「用神占比上升、忌神占比下降」成了**加载体这个动作本身**的必然结果，
 * 与那两根柱子究竟是什么干支无关。
 *
 * 实测这条偏置：现行作差法下 base 的中位数为 +0.054、61.7% 的年份为正；
 * 「用神得力」触发率 63%，而对称的「忌神转旺」只有 38%。
 *
 * ## 零假设
 *
 * 取「新增的力量在五行上均摊」为中性的一年。某五行只有偏离这个均摊，
 * 才算这一年真的带来了什么：
 *
 *     期望份额(e) = (W本命(e) + 新增/5) / 总量_now
 *     实际份额(e) = W_now(e) / 总量_now
 *     delta(e)   = 实际 − 期望
 *
 * 五行求和恒为 0，故不再有整体漂移。无大运流年时 delta 恒为 0。
 */
function shareDeltaOf(natal: SolvedChart, now: SolvedChart): Record<Element, number> {
  const a = natal.propagation.byElement;
  const b = now.propagation.byElement;
  const massN = ELEMENTS.reduce((t, e) => t + a[e], 0);
  const massNow = ELEMENTS.reduce((t, e) => t + b[e], 0);
  if (massNow <= 0) return Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  const addedPerElement = (massNow - massN) / ELEMENTS.length;
  return Object.fromEntries(ELEMENTS.map(
    (e) => [e, (b[e] - a[e] - addedPerElement) / massNow],
  )) as Record<Element, number>;
}

/** 某公历年的年柱。以立春为界，此处取该年立春之后的干支。 */
export function annualPillarOf(year: number): Pillar {
  return { stem: stepStem("甲", year - 4), branch: stepBranch("子", year - 4) };
}

// ─────────────────────────────────────────────────────────
// 大运
// ─────────────────────────────────────────────────────────

export function luckTimeline(
  from: BaseChart | NatalChart, params?: Params,
): LuckStep[] {
  const base = toBaseChart(from, params);
  const { chart } = base;
  return chart.luck.pillars.map((lp) => {
    const samples = ([["start", 0], ["mid", 5], ["end", 9.99]] as const).map(([at, elapsed]) => {
      const ev = evaluateAt(base, { luck: { pillar: lp.pillar, elapsedYears: elapsed } });
      const idx = favorIndexOf(base, ev, [], base.params);
      return {
        at, elapsedYears: elapsed,
        stemShare: luckStemShareAt(elapsed, base.params),
        favorIndex: idx.index,
        strength: ev.conclusions.strength.value,
      };
    });
    return {
      index: lp.index, pillar: lp.pillar,
      startJd: lp.startJd, endJd: lp.endJd,
      startCalendar: lp.startCalendar, startAgeYears: lp.startAgeYears,
      samples,
      stemPhaseSummary: `前段重天干 ${lp.pillar.stem}（占比 0.70→0.50）`,
      branchPhaseSummary: `后段重地支 ${lp.pillar.branch}（占比 0.50→0.70）`,
    };
  });
}

// ─────────────────────────────────────────────────────────
// 顺逆指数
// ─────────────────────────────────────────────────────────

/**
 * 顺逆指数 ∈ (0,100)。
 *
 * tanh 保证有界且中段近似线性、两端饱和 —— 避免极端盘产出 −300 这类无法解释的数值。
 *
 * ⚠️ 这条曲线衡量的是**当年五行结构与本命用神的契合程度**，不是运气好坏，
 * 更不是生活质量。低分意味着结构性张力大，在传统语境中同样对应变动与转折。
 */
export function favorIndexOf(
  natal: SolvedChart, now: EvaluatedChart,
  events: readonly { polarity: -1 | 0 | 1; weight: number }[],
  params: Params = DEFAULT_PARAMS,
): { index: number; base: number; eventDelta: number; raw: number } {
  const d = shareDeltaOf(natal, now);
  const y = natal.conclusions.yongshen.value;
  const fav = [y.primary, ...y.xishen];
  const adv = [...y.jishen, ...y.choushen];
  const base = fav.reduce((a, e) => a + d[e], 0) - adv.reduce((a, e) => a + d[e], 0);
  const ed = events.reduce((a, e) => a + e.polarity * e.weight, 0);
  const raw = params.temporal.index.a * base + params.temporal.index.b * ed;
  return { index: 50 + 50 * Math.tanh(raw), base, eventDelta: ed, raw };
}

// ─────────────────────────────────────────────────────────
// 流年
// ─────────────────────────────────────────────────────────

export function yearView(
  from: BaseChart | NatalChart, year: number, params?: Params,
): YearView {
  // 传 BaseChart 时基准不再重算。原实现每调一次就重解一遍本命盘，
  // 一条 120 年曲线就是 120 遍 —— 这是 buildReport 里最大的一块重复。
  const base = toBaseChart(from, params);
  const { chart } = base;
  const pillar = annualPillarOf(year);

  // 取样点：该年立春时刻
  const lichunJd = toJulianDay({ year, month: 2, day: 4, hour: 0, minute: 0, second: 0 });
  const step = chart.luck.pillars.find((p) => lichunJd >= p.startJd && lichunJd < p.endJd) ?? null;
  const elapsed = step === null ? 0 : (lichunJd - step.startJd) / TROPICAL_YEAR_DAYS;

  const now = evaluateAt(base, {
    luck: step === null ? null : { pillar: step.pillar, elapsedYears: elapsed },
    annual: pillar,
  });

  const ctx: YingqiContext = {
    chart, natal: base, now,
    luck: step?.pillar ?? null, annual: pillar,
    scope: "year", shareDelta: shareDeltaOf(base, now),
  };
  const events = runYingqi(ctx, "year");
  const idx = favorIndexOf(base, now, events, base.params);

  // 换运年：分段返回，不做加权平均 —— 两步大运的气象不可线性混合
  const nextLichun = lichunJd + TROPICAL_YEAR_DAYS;
  const segments: { fromJd: number; toJd: number; luckIndex: number | null }[] = [];
  const switching = chart.luck.pillars.find((p) => p.startJd > lichunJd && p.startJd < nextLichun);
  if (switching !== undefined) {
    segments.push({ fromJd: lichunJd, toJd: switching.startJd, luckIndex: step?.index ?? null });
    segments.push({ fromJd: switching.startJd, toJd: nextLichun, luckIndex: switching.index });
  } else {
    segments.push({ fromJd: lichunJd, toJd: nextLichun, luckIndex: step?.index ?? null });
  }

  const total = ELEMENTS.reduce((a, e) => a + now.propagation.byElement[e], 0);
  return {
    year, pillar,
    luckPillar: step?.pillar ?? null, luckIndex: step?.index ?? null,
    evaluated: now,
    favorIndex: idx.index,
    indexParts: { base: idx.base, eventDelta: idx.eventDelta, raw: idx.raw },
    vitality: now.propagation.vitality,
    dayMasterShare: total > 0 ? now.conclusions.party.supporting / total : 0,
    events, domains: aggregateDomains(events), segments,
  };
}

// ─────────────────────────────────────────────────────────
// 流月 —— 不重算权重
// ─────────────────────────────────────────────────────────

const pairHit = (t: readonly (readonly [Branch, Branch])[], a: Branch, b: Branch) =>
  t.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * 节气月的精确起讫。
 *
 * `monthIndex` 自寅月起（0 = 寅），所属为 `year` 这一**立春年**：
 * 索引 0 起于该年立春，索引 11（丑月）起于次年小寒。
 *
 * ## 为什么不能估算
 *
 * 原先取「2 月 4 日 + monthIndex × 30.4368 日」作近似，再问「这一刻落在哪个节里」。
 * 两处误差叠加：锚点用固定的 2 月 4 日而非真实立春；月长按均值，
 * 而真实的节气月自 29.4 日（近日点附近）到 31.4 日（远日点附近）不等。
 * 于是估算点可能落到真节**之前**，问出来的就是上一个月的节 ——
 * 实测索引 7（酉月）报出的是「立秋 → 白露」，即申月的区间。
 * 月柱与它自称的区间对不上，是这一层最难被发现的一类错：
 * 两个字段各自看都合理。
 *
 * 正解是直接按黄经求根：开启寅月的节是立春（λ = 315°），此后每月 +30°。
 * 均值只用来给牛顿法一个初值，不参与结果。
 */
export function lichunJdOf(year: number): number {
  const guess = toJulianDay({ year, month: 2, day: 4, hour: 0, minute: 0, second: 0 });
  return solveSolarTerm(315, asTT(utToTT(guess))).jdUT as number;
}

/** 节气月的起讫（UT 儒略日）。六爻应期也用它 —— 不另写一份。 */
export function jieMonthBounds(
  year: number, monthIndex: number,
): { openJd: number; closeJd: number; openName: string } {
  const i = mod(monthIndex, 12);
  const lonOf = (k: number) => mod(315 + 30 * k, 360);
  const nameOf = (lon: number) => {
    const d = SOLAR_TERMS.find((t) => t.longitude === lon && t.kind === "节");
    if (d === undefined) throw new Error(`黄经 ${lon}° 不是节`);
    return d.name;
  };

  const MEAN_MONTH = TROPICAL_YEAR_DAYS / 12;
  // 锚点取该立春年真实的立春，而非日历上的 2 月 4 日
  const lichunGuess = toJulianDay({ year, month: 2, day: 4, hour: 0, minute: 0, second: 0 });
  const lichun = solveSolarTerm(315, asTT(utToTT(lichunGuess)));

  const open = solveSolarTerm(lonOf(i), asTT((lichun.jdTT as number) + i * MEAN_MONTH));
  const close = solveSolarTerm(lonOf(i + 1), asTT((open.jdTT as number) + MEAN_MONTH));
  return {
    openJd: open.jdUT as number,
    closeJd: close.jdUT as number,
    openName: nameOf(lonOf(i)),
  };
}

export function monthView(
  from: BaseChart | NatalChart, year: number, monthIndex: number, params?: Params,
): MonthView {
  const base = toBaseChart(from, params);
  const { chart } = base;
  const p = base.params;
  const yearPillar = annualPillarOf(year);
  const monthBranch = MONTH_BRANCH_ORDER[mod(monthIndex, 12)]!;
  const pillar: Pillar = { stem: monthStemOf(yearPillar.stem, monthBranch), branch: monthBranch };

  const { openJd, closeJd, openName } = jieMonthBounds(year, monthIndex);
  const mid = (openJd + closeJd) / 2;

  const natal = base;
  const dm = natal.conclusions.dayMaster;
  const y = natal.conclusions.yongshen.value;
  const monthElement = elementOf(pillar.stem);
  const step = chart.luck.pillars.find((lp) => mid >= lp.startJd && mid < lp.endJd) ?? null;

  // ── 引动：月柱干支与本命四柱的合冲刑害 ──
  const interactions: Interaction[] = [];
  for (const [kind, p] of [["year", chart.year], ["month", chart.month],
    ["day", chart.day], ["hour", chart.hour]] as const) {
    if (p === null) continue;
    const push = (type: Interaction["type"], detail: string) => interactions.push({
      type, fromLayer: "branch", target: kind, targetPalace: PALACE_OF[kind] ?? "", detail,
    });
    const L = PILLAR_LABEL[kind] ?? kind;
    if (pairHit(BRANCH_CLASHES, pillar.branch, p.branch)) push("chong", `流月${pillar.branch}冲本命${L}支${p.branch}`);
    if (BRANCH_SIX_COMBINATIONS.some(([a, b]) =>
      (a === pillar.branch && b === p.branch) || (a === p.branch && b === pillar.branch))) {
      push("he", `流月${pillar.branch}合本命${L}支${p.branch}`);
    }
    if (pairHit(BRANCH_HARMS, pillar.branch, p.branch)) push("hai", `流月${pillar.branch}害本命${L}支${p.branch}`);
    if (pairHit(BRANCH_DESTRUCTIONS, pillar.branch, p.branch)) push("po", `流月${pillar.branch}破本命${L}支${p.branch}`);
    if (pillar.stem === p.stem && pillar.branch === p.branch) push("fuyin", `流月与本命${L}柱伏吟`);
  }

  // 流月单列一个落点，不冒充本命月柱 —— 否则流月的神煞会被标成「门户宫」。
  const shensha = scanShensha({
    chart, carriers: natal.carriers, events: natal.events, params: p.shensha,
    fleetingMonth: pillar,
  }).filter((h) => h.landsOn.pillar === "fleetingMonth");

  const relationToYongshen =
    monthElement === y.primary || y.xishen.includes(monthElement) ? "supports"
    : y.jishen.includes(monthElement) || y.choushen.includes(monthElement) ? "opposes"
    : "neutral";

  const narrative: string[] = [];
  narrative.push(`${monthBranch}月，月柱 ${pillar.stem}${pillar.branch}，其气属${monthElement}。`);
  narrative.push(relationToYongshen === "supports" ? "与本命喜用同气，本月的外部条件偏于顺应。"
    : relationToYongshen === "opposes" ? "与本命忌仇同气，本月的外部条件偏于牵制。"
    : "与本命用忌皆不直接相干，本月外部条件平缓。");
  for (const i of interactions.slice(0, p.temporal.monthLayer.maxInteractionsShown)) {
    narrative.push(`${i.detail}，牵动${i.targetPalace}。`);
  }

  return {
    year, monthIndex, pillar,
    range: { fromJd: openJd, toJd: closeJd },
    openedBy: openName,
    yearPillar, luckPillar: step?.pillar ?? null,
    shensha,
    interactions: interactions.slice(0, p.temporal.monthLayer.maxInteractionsShown),
    tone: {
      monthElement, relationToYongshen,
      relationToDayMaster: tenGodOf(dm.element, dm.polarity, monthElement, polarityOf(pillar.stem)),
    },
    events: [], narrative,
  };
}

// ─────────────────────────────────────────────────────────
// 流日 —— 不重算权重
// ─────────────────────────────────────────────────────────

export function dayView(
  from: BaseChart | NatalChart, y: number, m: number, d: number, params?: Params,
): DayView {
  const base = toBaseChart(from, params);
  const { chart } = base;
  const p = base.params;
  const jdn = julianDayNumber(y, m, d);
  const sx = mod(jdn + 49, 60);
  const pillar: Pillar = { stem: stepStem("甲", sx), branch: branchAt(sx) };

  const natal = base;
  const dm = natal.conclusions.dayMaster;
  const yong = natal.conclusions.yongshen.value.primary;
  const dayElement = elementOf(pillar.stem);

  const conflicts: ElementConflict[] = [];
  const add = (kind: ElementConflict["kind"], sev: ElementConflict["severity"],
    els: [Element, Element], palace: string | null, detail: string) =>
    conflicts.push({ kind, severity: sev, involvedElements: els, affectedPalace: palace, detail });

  if (stepBranch(pillar.branch, 6) === chart.day.branch) {
    add("chongDayBranch", "notable", [elementOf(pillar.stem), dm.element], "配偶宫",
      `日支${pillar.branch}冲本命日支${chart.day.branch}`);
  }
  if (pillar.stem === chart.day.stem && pillar.branch === chart.day.branch) {
    add("fuyinDayPillar", "notable", [dayElement, dm.element], "自身", "日柱伏吟");
  }
  const controlsDm = elementOf(pillar.stem) !== dm.element
    && ["木土", "土水", "水火", "火金", "金木"].includes(elementOf(pillar.stem) + dm.element);
  if (controlsDm) {
    add("keDayMaster", "mild", [dayElement, dm.element], "自身",
      `日干${pillar.stem}(${dayElement})克日主${dm.stem}(${dm.element})`);
  }
  const controlsYong = ["木土", "土水", "水火", "火金", "金木"].includes(dayElement + yong);
  if (controlsYong) {
    add("keYongshen", "mild", [dayElement, yong], null,
      `日干${dayElement}克用神${yong}`);
  }

  const harmonies: string[] = [];
  if (BRANCH_SIX_COMBINATIONS.some(([a, b]) =>
    (a === pillar.branch && b === chart.day.branch) || (a === chart.day.branch && b === pillar.branch))) {
    harmonies.push(`日支${pillar.branch}与本命日支${chart.day.branch}相合`);
  }

  const shensha = scanShensha({
    chart, carriers: natal.carriers, events: natal.events, params: p.shensha,
  }).filter((h) => h.branch === pillar.branch);

  const note = conflicts.length === 0
    ? "今日五行与本命无明显张力。"
    : `今日${conflicts.map((c) => c.detail).join("；")}。`;

  const monthTerm = enclosingTermOf(toJulianDay({ year: y, month: m, day: d, hour: 12, minute: 0, second: 0 }), "节");
  const mb = monthTerm.prev.def.opensMonthBranch as Branch;
  const yp = annualPillarOf(y);

  return {
    date: fromJulianDay(jdn - 0.5),
    pillar,
    monthPillar: { stem: monthStemOf(yp.stem, mb), branch: mb },
    yearPillar: yp,
    conflicts, harmonies, shensha, note,
  };
}

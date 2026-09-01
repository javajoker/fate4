/**
 * 大运 · 流年 · 流月 · 流日 四层视图。
 */

import { ELEMENTS, type Branch, type Element, type Pillar } from "../types/ganzhi.js";
import {
  branchAt, elementOf, monthStemOf, mod, polarityOf, stepBranch, stepStem,
} from "../ganzhi/algebra.js";
import { BRANCH_CLASHES, BRANCH_HARMS, BRANCH_DESTRUCTIONS, BRANCH_SIX_COMBINATIONS, MONTH_BRANCH_ORDER } from "../ganzhi/tables.js";
import { fromJulianDay, julianDayNumber, toJulianDay } from "../astro/julian.js";
import { enclosingTermOf } from "../chart/pillars.js";
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
import { evaluate, type EvaluatedChart } from "./evaluate.js";
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

function shareOf(by: Readonly<Record<Element, number>>): Record<Element, number> {
  const total = ELEMENTS.reduce((a, e) => a + by[e], 0);
  return Object.fromEntries(ELEMENTS.map((e) => [e, total > 0 ? by[e] / total : 0])) as Record<Element, number>;
}

function shareDeltaOf(natal: EvaluatedChart, now: EvaluatedChart): Record<Element, number> {
  const a = shareOf(natal.propagation.byElement);
  const b = shareOf(now.propagation.byElement);
  return Object.fromEntries(ELEMENTS.map((e) => [e, b[e] - a[e]])) as Record<Element, number>;
}

/** 某公历年的年柱。以立春为界，此处取该年立春之后的干支。 */
export function annualPillarOf(year: number): Pillar {
  return { stem: stepStem("甲", year - 4), branch: stepBranch("子", year - 4) };
}

// ─────────────────────────────────────────────────────────
// 大运
// ─────────────────────────────────────────────────────────

export function luckTimeline(chart: NatalChart, params: Params = DEFAULT_PARAMS): LuckStep[] {
  const natal = evaluate({ chart, params });
  return chart.luck.pillars.map((lp) => {
    const samples = ([["start", 0], ["mid", 5], ["end", 9.99]] as const).map(([at, elapsed]) => {
      const ev = evaluate({ chart, luck: { pillar: lp.pillar, elapsedYears: elapsed }, params });
      const idx = favorIndexOf(natal, ev, [], params);
      return {
        at, elapsedYears: elapsed,
        stemShare: luckStemShareAt(elapsed, params),
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
  natal: EvaluatedChart, now: EvaluatedChart,
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
  chart: NatalChart, year: number, params: Params = DEFAULT_PARAMS,
): YearView {
  const natal = evaluate({ chart, params });
  const pillar = annualPillarOf(year);

  // 取样点：该年立春时刻
  const lichunJd = toJulianDay({ year, month: 2, day: 4, hour: 0, minute: 0, second: 0 });
  const step = chart.luck.pillars.find((p) => lichunJd >= p.startJd && lichunJd < p.endJd) ?? null;
  const elapsed = step === null ? 0 : (lichunJd - step.startJd) / TROPICAL_YEAR_DAYS;

  const now = evaluate({
    chart, params,
    luck: step === null ? null : { pillar: step.pillar, elapsedYears: elapsed },
    annual: pillar,
  });

  const ctx: YingqiContext = {
    chart, natal, now,
    luck: step?.pillar ?? null, annual: pillar,
    scope: "year", shareDelta: shareDeltaOf(natal, now),
  };
  const events = runYingqi(ctx, "year");
  const idx = favorIndexOf(natal, now, events, params);

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

export function monthView(
  chart: NatalChart, year: number, monthIndex: number, params: Params = DEFAULT_PARAMS,
): MonthView {
  const yearPillar = annualPillarOf(year);
  const monthBranch = MONTH_BRANCH_ORDER[mod(monthIndex, 12)]!;
  const pillar: Pillar = { stem: monthStemOf(yearPillar.stem, monthBranch), branch: monthBranch };

  // 该月的节界。由黄经直接定位，不枚举全年。
  const approx = toJulianDay({ year, month: 2, day: 4, hour: 0, minute: 0, second: 0 })
    + monthIndex * (TROPICAL_YEAR_DAYS / 12);
  const term = enclosingTermOf(approx, "节");

  const natal = evaluate({ chart, params });
  const dm = natal.conclusions.dayMaster;
  const y = natal.conclusions.yongshen.value;
  const monthElement = elementOf(pillar.stem);
  const step = chart.luck.pillars.find((lp) => approx >= lp.startJd && approx < lp.endJd) ?? null;

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

  const shensha = scanShensha({
    chart: { ...chart, month: pillar } as NatalChart,
    carriers: natal.carriers, events: natal.events, params: params.shensha,
  }).filter((h) => h.branch === pillar.branch || h.stem === pillar.stem);

  const relationToYongshen =
    monthElement === y.primary || y.xishen.includes(monthElement) ? "supports"
    : y.jishen.includes(monthElement) || y.choushen.includes(monthElement) ? "opposes"
    : "neutral";

  const narrative: string[] = [];
  narrative.push(`${monthBranch}月，月柱 ${pillar.stem}${pillar.branch}，其气属${monthElement}。`);
  narrative.push(relationToYongshen === "supports" ? "与本命喜用同气，本月的外部条件偏于顺应。"
    : relationToYongshen === "opposes" ? "与本命忌仇同气，本月的外部条件偏于牵制。"
    : "与本命用忌皆不直接相干，本月外部条件平缓。");
  for (const i of interactions.slice(0, params.temporal.monthLayer.maxInteractionsShown)) {
    narrative.push(`${i.detail}，牵动${i.targetPalace}。`);
  }

  return {
    year, monthIndex, pillar,
    range: { fromJd: term.prev.jdUT, toJd: term.next.jdUT },
    openedBy: term.prev.def.name,
    yearPillar, luckPillar: step?.pillar ?? null,
    shensha,
    interactions: interactions.slice(0, params.temporal.monthLayer.maxInteractionsShown),
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
  chart: NatalChart, y: number, m: number, d: number, params: Params = DEFAULT_PARAMS,
): DayView {
  const jdn = julianDayNumber(y, m, d);
  const sx = mod(jdn + 49, 60);
  const pillar: Pillar = { stem: stepStem("甲", sx), branch: branchAt(sx) };

  const natal = evaluate({ chart, params });
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
    chart, carriers: natal.carriers, events: natal.events, params: params.shensha,
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

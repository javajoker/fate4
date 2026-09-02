/**
 * P21 当日运程 —— 四柱流日 ∥ 六爻日卦，**并列不合并**。
 *
 * ## 为什么并列
 *
 * 两侧都是当日干支的确定性函数（见 `divination/claim.ts`）。它们一致不构成印证，
 * 不一致也不代表哪个错了。合成一个「今日综合分」是最自然的冲动，也是最坏的做法：
 * 它把两个体系各自的判据抹平成一个数，而那个数没有任何一家典籍为它背书。
 *
 * ## 日卦起在哪一刻
 *
 * 按时起卦的卦属于时刻。当日运程需要一个**该日的代表时刻** ——
 * 取用户当日首次查看的时刻最贴合「应机」之义，但那不可复现。
 * 故默认取**该日子时初**（真太阳时 23:00 起的那一刻）作为代表：
 * 它是该日的起点，且对同一日恒定，报告可复算。
 * 想按应机起卦的，传 `at` 覆盖 —— 那时得到的是另一份报告，`meta` 里记着时刻。
 */

import type { Params } from "../params/types.js";
import type { BaseChart } from "../chart/baseChart.js";
import type { NatalChart } from "../chart/types.js";
import { toBaseChart } from "../chart/baseChart.js";
import { dayView } from "../temporal/views.js";
import type { DayView } from "../temporal/types.js";
import { branchElement, elementOf } from "../ganzhi/algebra.js";
import type { StructuralClaim, AxisComparison } from "../divination/claim.js";
import { crossref, summarizeCrossref } from "../divination/claim.js";
import { castMomentOf, type MomentOptions } from "./moment.js";
import { cast } from "./cast.js";
import { dress, type DressedGua } from "./dress.js";
import { pickYongshen } from "./yongshen.js";
import { judge, type Judgement } from "./judge.js";
import { strengthOf } from "./strength.js";
import { renderTemplate, type NarrativeLine } from "../report/render.js";
import type { Locale } from "../report/templates.js";
import { SYSTEM_LABEL, AXIS_DIRECTIONAL } from "../divination/claim.js";

export interface DailyOptions extends MomentOptions {
  readonly timeZone?: string;
  readonly longitude?: number;
  /** 起日卦的时刻（当地钟表时的小时与分）。默认子时初，见模块头。 */
  readonly at?: { readonly hour: number; readonly minute: number };
}

export interface DailyOutlook {
  readonly date: { readonly year: number; readonly month: number; readonly day: number };
  /** 四柱侧 —— 流日事件匹配，不重算权重。 */
  readonly bazi: DayView;
  /** 六爻侧 —— 该日的日卦。 */
  readonly liuyao: { readonly gua: DressedGua; readonly judgement: Judgement };
  readonly claims: readonly StructuralClaim[];
  readonly comparisons: readonly AxisComparison[];
  readonly summary: string;
}

// ─────────────────────────────────────────────────────────

/** 四柱侧的结构断言。 */
function baziClaims(base: BaseChart, dv: DayView): StructuralClaim[] {
  const y = base.conclusions.yongshen.value;
  const fav = new Set([y.primary, ...y.xishen]);
  const adv = new Set([...y.jishen, ...y.choushen]);
  const dayEls = [elementOf(dv.pillar.stem), branchElement(dv.pillar.branch)];
  const favN = dayEls.filter((e) => fav.has(e)).length;
  const advN = dayEls.filter((e) => adv.has(e)).length;

  const out: StructuralClaim[] = [{
    system: "bazi", axis: "我方位置",
    polarity: favN > advN ? "顺" : advN > favN ? "逆" : "中性",
    evidence: `流日 ${dv.pillar.stem}${dv.pillar.branch}，干支五行为 ${dayEls.join("、")}；`
      + `本命取用为 ${y.primary}（喜 ${y.xishen.join("")}、忌 ${y.jishen.join("")}）`,
    confidence: base.conclusions.yongshen.confidence,
  }];

  const notable = dv.conflicts.filter((c) => c.severity === "notable");
  out.push({
    system: "bazi", axis: "阻碍来源",
    polarity: notable.length > 0 ? "逆" : "中性",
    evidence: notable.length > 0
      ? notable.map((c) => `${c.kind}：${c.involvedElements.join("与")}`
        + `${c.affectedPalace === null ? "" : `，涉 ${c.affectedPalace}`}`).join("；")
      : "流日与本命四柱之间无显著的冲克",
    confidence: 0.7,
  });

  const stir = dv.conflicts.length + dv.harmonies.length;
  out.push({
    system: "bazi", axis: "事之动静",
    polarity: "中性",
    evidence: stir === 0
      ? "流日与本命无合冲刑害，事象层面安静"
      : `流日引动 ${stir} 处：冲克 ${dv.conflicts.length}、合会 ${dv.harmonies.length}`,
    confidence: 0.75,
  });
  return out;
}

/** 六爻侧的结构断言。日卦以自身运势为题，用神取世爻。 */
function liuyaoClaims(gua: DressedGua, j: Judgement, params: Params): StructuralClaim[] {
  const shi = gua.yaos[gua.shi - 1]!;
  const st = strengthOf(gua, shi, params.liuyao);
  const out: StructuralClaim[] = [{
    system: "liuyao", axis: "我方位置",
    polarity: st.value.band === "有力" || st.value.band === "偏有力" ? "顺"
      : st.value.band === "无力" || st.value.band === "偏无力" ? "逆" : "中性",
    evidence: `世爻在第${gua.shi}爻（${shi.liuqin}${shi.branch}），力量为${st.value.band}，`
      + `判据为「${st.value.rung}」`,
    confidence: st.confidence,
  }];

  // 阻碍：动爻（含暗动）克世者
  const attackers = gua.yaos.filter(
    (o) => (o.moving || o.chongState === "暗动") && o.pos !== gua.shi
      && st.value.fromDong.some((d) => d.from.pos === o.pos && d.kind === "克"));
  out.push({
    system: "liuyao", axis: "阻碍来源",
    polarity: attackers.length > 0 ? "逆" : "中性",
    evidence: attackers.length > 0
      ? attackers.map((o) => `第${o.pos}爻${o.liuqin}${o.branch}${
        o.moving ? "发动" : "暗动"}克世`).join("；")
      : "卦中无动爻克世",
    confidence: 0.75,
  });

  const dong = gua.yaos.filter((o) => o.moving).length;
  out.push({
    system: "liuyao", axis: "事之动静",
    polarity: "中性",
    evidence: dong === 0
      ? `${gua.ben.name}，六爻皆静，传统视为事在酝酿`
      : `${gua.ben.name} → ${gua.bian!.name}，${dong} 爻发动`
        + (gua.flags.length > 0 ? `，${gua.flags.join("、")}` : ""),
    confidence: 0.85,
  });
  void j;
  return out;
}

// ─────────────────────────────────────────────────────────

export function dailyOutlook(
  from: BaseChart | NatalChart,
  date: { readonly year: number; readonly month: number; readonly day: number },
  params?: Params,
  options: DailyOptions = {},
): DailyOutlook {
  const base = toBaseChart(from, params);
  const p = base.params;
  const dv = dayView(base, date.year, date.month, date.day, p);

  // 日卦：默认取该日子时初 —— 该日的起点，对同一日恒定，故报告可复算
  const at = options.at ?? { hour: 0, minute: 0 };
  const moment = castMomentOf({
    year: date.year, month: date.month, day: date.day,
    hour: at.hour, minute: at.minute,
    timeZone: options.timeZone ?? base.chart.input.timeZone,
    longitude: options.longitude ?? base.chart.input.longitude,
  }, options);

  const gua = dress(cast(moment, castInputFor(p), p.liuyao), p.liuyao);
  const ys = pickYongshen(gua, "self.fortune");
  const j = judge(gua, ys, p.liuyao);

  const claims = [...baziClaims(base, dv), ...liuyaoClaims(gua, j, p)];
  const comparisons = crossref(claims);

  return {
    date, bazi: dv, liuyao: { gua, judgement: j },
    claims: Object.freeze(claims),
    comparisons: Object.freeze(comparisons),
    summary: summarizeCrossref(comparisons),
  };
}

/**
 * 当日运程只支持按时起卦。
 *
 * 报数与掷钱都需要人当场给输入，而当日运程是**每日自动生成**的一页 ——
 * 没有人报数，也没有人掷钱。硬要替用户掷一把，得到的是伪造的随机性。
 */
function castInputFor(p: Params): { method: "time" } {
  if (p.liuyao.castMethod !== "time") {
    throw new Error(
      `当日运程只支持按时起卦，而参数声明的是 ${p.liuyao.castMethod}。`
      + "报数与掷钱都要人当场给输入；替用户代掷得到的是伪造的随机性。",
    );
  }
  return { method: "time" };
}

// ─────────────────────────────────────────────────────────
// 叙述
// ─────────────────────────────────────────────────────────

/**
 * 当日运程的叙述。
 *
 * 走模板层，故与四柱报告共用同一套措辞守卫与繁体转换 ——
 * crossref 的 note 是会到达读者的散文，不能绕过守卫直出。
 */
export function dailyNarrative(
  o: DailyOutlook, locale: Locale = "zh-Hans",
): NarrativeLine[] {
  const out: NarrativeLine[] = [];
  const add = (id: string, slots: Record<string, string | number>, ref: string) =>
    out.push(renderTemplate(id, slots, {
      locale, confidence: 1, source: { kind: "data", ref },
    }));

  add("daily.header", {
    date: `${o.date.year} 年 ${o.date.month} 月 ${o.date.day} 日`,
    pillar: `${o.bazi.pillar.stem}${o.bazi.pillar.branch}`,
    gua: `${o.liuyao.gua.ben.name}${
      o.liuyao.gua.bian === null ? "（六爻皆静）" : ` → ${o.liuyao.gua.bian.name}`}`,
  }, "daily.date");
  add("daily.caveat", {}, "daily.crossref");

  for (const c of o.comparisons) {
    const bz = c.claims.find((x) => x.system === "bazi");
    const ly = c.claims.find((x) => x.system === "liuyao");
    if (bz === undefined || ly === undefined) {
      const only = c.claims[0]!;
      add("daily.axis.one", {
        axis: c.axis, system: SYSTEM_LABEL[only.system],
        evidence: only.evidence, note: c.note,
      }, `daily.axis.${c.axis}`);
      continue;
    }
    // 不判方向的轴上，「中性」不是「未表态」—— 那条轴本就没有方向可表。
    // 照搬「未表态」会把两侧确实说了的话说成没说。
    const side = (x: typeof bz) => AXIS_DIRECTIONAL[c.axis]
      ? `${x.polarity === "中性" ? "未表态" : x.polarity}，${x.evidence}`
      : x.evidence;
    add("daily.axis", {
      axis: c.axis, kind: c.kind,
      bazi: side(bz), liuyao: side(ly), note: c.note,
    }, `daily.axis.${c.axis}`);
  }

  add("daily.summary", { summary: o.summary }, "daily.crossref");
  return out;
}

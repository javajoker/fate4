/**
 * L6 两层结论 —— 默认一句话，展开才给依据。
 *
 * ## 一条不变量：摘要里的每个数字，都必须在展开层的证据里找得到
 *
 * 这是本文件存在的主要理由。分两层写的报告有一个特有的失真方式：
 * 摘要写「财运向好」，展开写「财星被劫、比劫夺财」，而**读者通常只看一层**。
 * 两层各自都不算错，合起来却把一个有保留的判断变成了一句无保留的断言。
 *
 * `auditFinding` 把摘要里出现的每一个数字抠出来，逐个要求它等于某条
 * `Evidence` 的规范化取值。数字对不上即报错 —— 这不是风格检查，
 * 是**摘要不得引入展开层没有的量**这条硬约束的机械实现。
 *
 * 它拦不住形容词层面的失真（这需要语义判断），但拦得住数字层面的：
 * 而分两层写的报告出问题，十有八九是摘要里多出一个展开层没有的数。
 *
 * ## 为什么摘要也走模板
 *
 * §0 的硬约束是「报告层不做新判断」。摘要是最容易破这条规矩的地方 ——
 * 它短、要好读、又最显眼。故摘要与展开走同一套模板机制，
 * 同样受置信度降级与措辞守卫管辖。
 *
 * ## 趋吉避凶为什么每条都那么啰嗦
 *
 * 因为**它是全份报告里最容易被单独复制走的一块**。一句孤零零的
 * 「宜守不宜攻」就是建议，无论它原来挂在多少免责声明底下。
 * 故每条 guidance 自带传统框定与免责导向，由 `zh.guidance.framing`
 * 按**段**判定强制 —— 与脏腑段同一个理由，同一种做法。
 */

import type { NodeInterval, NodeScale, NodeSet, TimeMark } from "../temporal/nodes.js";
import { DIRECTION_LABEL, SCALE_LABEL, SHAPE_LABEL } from "../temporal/nodes.js";
import type { SeriesSet } from "../temporal/series.js";
import { MONTH_BRANCH_ORDER } from "../ganzhi/tables.js";
import { DOMAIN_LABEL, type Domain } from "../yingqi/types.js";
import { renderTemplate, type NarrativeLine } from "./render.js";
import type { Locale } from "./templates.js";

// ─────────────────────────────────────────────────────────

/**
 * 证据的量纲 —— 决定它如何被格式化成字符串。
 *
 * 同一个量在摘要与展开里必须格式化成同一个串，否则不变量形同虚设：
 * 摘要写 `3.5`、展开写 `3.54`，机械比对便认不出它们是同一个数。
 */
export type EvidenceUnit = "sigma" | "weight" | "share" | "count" | "year" | "months";

export interface Evidence {
  readonly label: string;
  readonly value: number;
  readonly unit: EvidenceUnit;
  /** 溯源串。如 `node:tenGod.正财`、`shensha:羊刃`、`luck:4`。 */
  readonly ref: string;
}

export interface Guidance {
  /** 可能遇到的问题 —— 只写「哪一域、什么形态」，不写具体事件。 */
  readonly problem: string;
  /** 神煞诱因。没有可对照的神煞时为空串，模板另走一支。 */
  readonly trigger: string;
  /** 规避方案。传统趋避之说，不是行动指令。 */
  readonly line: NarrativeLine;
}

export interface FindingDetail {
  readonly narrative: readonly NarrativeLine[];
  readonly evidence: readonly Evidence[];
}

export interface Finding {
  readonly id: string;
  readonly kind: "node";
  readonly scale: NodeScale;
  /** 默认只显示这一句。 */
  readonly summary: NarrativeLine;
  readonly detail: FindingDetail;
  readonly confidence: number;
  readonly guidance: readonly Guidance[];
}

export interface FindingSet {
  readonly findings: readonly Finding[];
  /** 一条 guidance 也没有时的说明。**必须出现** —— 见 `guidance.none` 的措辞。 */
  readonly guidanceEmptyNote: NarrativeLine | null;
}

// ─────────────────────────────────────────────────────────
// 格式化 —— 全系统唯一一处把 Evidence 变成串的地方
// ─────────────────────────────────────────────────────────

export function formatEvidence(e: Evidence): string {
  switch (e.unit) {
    case "sigma": return e.value.toFixed(2);
    case "weight": return e.value.toFixed(1);
    case "share": return (e.value * 100).toFixed(1);
    case "count": case "year": case "months": return String(Math.round(e.value));
  }
}

/**
 * 摘要里出现的数字全集。
 *
 * 前顾断言排掉区间连字符：「2003–2004 年」里的 `–2004` 是范围，不是负数 ——
 * 第一版把破折号一并半角化，于是它被读成 `-2004`，审计当场报警。
 * 那次报警是对的：审计确实认出了一个证据里没有的数，只是原因在自己身上。
 * 只把真正的减号（U+2212）半角化，破折号留着。
 */
const NUMBERS = /(?<![\d.\u2013\u2014-])-?\d+(?:\.\d+)?/g;
const normalize = (s: string) => s.replace(/\u2212/g, "-");

/**
 * 摘要 ⊆ 证据。返回违规说明，空数组即通过。
 *
 * 只查数字。形容词层面的失真需要语义判断，此处不假装能做到 ——
 * 但数字层面的失真是分层报告最常见的一种，而它可以机械杜绝。
 */
export function auditFinding(f: Finding): readonly string[] {
  const known = new Set(f.detail.evidence.map(formatEvidence));
  const out: string[] = [];
  for (const m of normalize(f.summary.text).matchAll(NUMBERS)) {
    if (!known.has(m[0])) {
      out.push(`${f.id}：摘要里的 ${m[0]} 在展开层的证据里找不到`
        + `（现有证据：${[...known].join("、") || "无"}）`);
    }
  }
  return out;
}

export class SummaryEvidenceMismatch extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`摘要引入了展开层没有的数值：\n  ${problems.join("\n  ")}`);
    this.name = "SummaryEvidenceMismatch";
  }
}

// ─────────────────────────────────────────────────────────
// 时点
// ─────────────────────────────────────────────────────────

const monthLabel = (m: TimeMark) => `${MONTH_BRANCH_ORDER[m.monthIndex]!}月`;

/**
 * 区间的可读写法。
 *
 * `monthResolved` 为 false 时**只报到年** —— 权重类序列在立春年内近乎恒定，
 * 边界恒为寅起丑止，写成某月是它没有的精度。见 `Series.monthResolving`。
 */
export function spanText(n: NodeInterval): string {
  if (!n.monthResolved) {
    return n.enter.year === n.exit.year
      ? `${n.enter.year} 年`
      : `${n.enter.year}–${n.exit.year} 年`;
  }
  return n.enter.year === n.exit.year
    ? `${n.enter.year} 年 ${monthLabel(n.enter)}至${monthLabel(n.exit)}`
    : `${n.enter.year} 年${monthLabel(n.enter)}至 ${n.exit.year} 年${monthLabel(n.exit)}`;
}

// ─────────────────────────────────────────────────────────
// 趋吉避凶
// ─────────────────────────────────────────────────────────

/**
 * 形态 → 趋避模板。每条都是完整成句的模板，不是可插拔的短语片段 ——
 * 见 `templates.ts` 中 `guidance.item.*` 上方的注释。
 */
const GUIDANCE_BY_SHAPE = Object.freeze({
  sustained: "guidance.item.hold",   // 一段状态：长期偏离 → 缓图
  swift: "guidance.item.watch",      // 一次转折：变得快 → 留回旋
  surge: "guidance.item.settle",     // 两者兼有 → 先安内
});

const domainOf = (seriesId: string): Domain | null => {
  const m = /^domain\.([a-z]+)\./.exec(seriesId);
  const d = m?.[1];
  return d !== undefined && d in DOMAIN_LABEL ? (d as Domain) : null;
};

/**
 * 一条节点的趋避条目。
 *
 * 只对**压力向**的节点产出 —— 「趋吉避凶」的避凶那一半有具体所指，
 * 趋吉那一半在本系统里只能说成「此段顺遂」，那是同一句话换个说法，
 * 不另立一条。不判方向的节点（宫位、域张力）同样不产出：
 * 张力本就是顺逆并存的度量，给它派一个规避方案等于把已经拆开的东西又合回去。
 */
function guidanceOf(n: NodeInterval, locale: Locale): Guidance | null {
  if (n.direction !== "pressure") return null;
  const dom = domainOf(n.seriesId);
  const triggers = n.reasons.filter((r) => r.kind === "shensha").map((r) => r.text);

  return {
    problem: `${n.label}·${SHAPE_LABEL[n.shape]}`,
    trigger: triggers.join("、"),
    line: renderTemplate(GUIDANCE_BY_SHAPE[n.shape], {
      // 「伤官域」不是一个域。非应期域的序列用它自己的标签，不硬安一个「域」字。
      domain: dom === null ? n.label : `${DOMAIN_LABEL[dom]}域`,
      span: spanText(n),
      trigger: triggers.length > 0 ? triggers.slice(0, 3).join("、") : "无",
    }, { locale, confidence: 1, source: { kind: "data", ref: `node:${n.seriesId}` } }),
  };
}

// ─────────────────────────────────────────────────────────

/**
 * 把节点摊成两层结论。
 *
 * 摘要的每个槽位都取自 `evidence`，故不变量按构造成立；
 * `auditFinding` 是防止后来的改动破坏它的那道闸，构建期即执行。
 */
export function buildFindings(
  S: SeriesSet, sets: Readonly<Record<NodeScale, NodeSet>>,
  locale: Locale = "zh-Hans",
): FindingSet {
  const findings: Finding[] = [];

  for (const scale of ["large", "medium", "small"] as const) {
    const set = sets[scale];
    for (const n of set.nodes) {
      const evidence: Evidence[] = [
        { label: `${n.label}·峰值偏离`, value: n.peakZ, unit: "sigma", ref: `node:${n.seriesId}` },
        { label: `${n.label}·变化率偏离`, value: n.peakRateZ, unit: "sigma", ref: `node:${n.seriesId}` },
        { label: `${n.label}·峰值`, value: n.peakValue, unit: "weight", ref: `node:${n.seriesId}` },
        { label: `${n.label}·基准均值`, value: n.mean, unit: "weight", ref: `node:${n.seriesId}` },
        { label: "进入", value: n.enter.year, unit: "year", ref: `node:${n.seriesId}` },
        { label: "退出", value: n.exit.year, unit: "year", ref: `node:${n.seriesId}` },
        { label: "统计窗起", value: S.statsFrom, unit: "year", ref: "series:window" },
        { label: "统计窗止", value: S.statsTo, unit: "year", ref: "series:window" },
        { label: "时长", value: n.durationMonths, unit: "months", ref: `node:${n.seriesId}` },
      ];
      const ev = (label: string) =>
        formatEvidence(evidence.find((x) => x.label.endsWith(label))!);
      const src = { kind: "data" as const, ref: `node:${n.seriesId}@${n.enter.year}` };

      const narrative: NarrativeLine[] = [
        renderTemplate("node.scaleNote", {
          scale: SCALE_LABEL[scale], from: ev("统计窗起"), to: ev("统计窗止"),
        }, { locale, source: src }),
        renderTemplate("node.level", {
          peakValue: ev("峰值"), mean: ev("基准均值"), z: ev("峰值偏离"),
        }, { locale, source: src }),
        renderTemplate("node.rate", { rateZ: ev("变化率偏离") }, { locale, source: src }),
        renderTemplate(`node.shape.${n.shape}`, {}, { locale, source: src }),
      ];
      if (!n.monthResolved) {
        narrative.push(renderTemplate("node.monthNote", { label: n.label },
          { locale, source: src }));
      }
      narrative.push(n.reasons.length > 0
        ? renderTemplate("node.reasons",
          { items: n.reasons.slice(0, 3).map((r) => r.text).join("；") }, { locale, source: src })
        : renderTemplate("node.noReasons", {}, { locale, source: src }));

      const g = guidanceOf(n, locale);
      const f: Finding = {
        // 月序必须进 id：同一条序列在同一个立春年内可以有两段互不相连的穿越，
        // 只用年份会撞号。区间彼此不相交，故「序列 + 进入时点」唯一。
        id: `${scale}:${n.seriesId}@${n.enter.year}.${n.enter.monthIndex}`,
        kind: "node", scale,
        summary: renderTemplate("node.summary", {
          label: n.label, span: spanText(n), z: ev("峰值偏离"),
          shape: SHAPE_LABEL[n.shape], direction: DIRECTION_LABEL[n.direction],
        }, { locale, source: src }),
        detail: { narrative, evidence },
        // 节点是确定性序列上的排序，不是带不确定性的判定 —— 故恒为 1。
        // 给它派一个小于 1 的「置信度」等于凭空造出一个此处并不存在的量。
        confidence: 1,
        guidance: g === null ? [] : [g],
      };

      const problems = auditFinding(f);
      if (problems.length > 0) throw new SummaryEvidenceMismatch(problems);
      findings.push(f);
    }
  }

  const any = findings.some((f) => f.guidance.length > 0);
  return {
    findings,
    guidanceEmptyNote: any ? null : renderTemplate("guidance.none", {}, { locale }),
  };
}

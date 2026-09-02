/**
 * Q5 应期 —— **只报区间，不报时点**。
 *
 * ## 为什么只到月建
 *
 * 传统应期取法（旬空取出空、被合取冲开、发动取逢合、安静取逢值逢冲……）
 * 给出的是**干支之候**：「应在申」。落到日历上，一个地支在未来一年里对应
 * 一个节气月、若干日、若干时辰 —— 它天然是**一族候选**，不是一个时点。
 *
 * 报「未来十二个月内，申、酉两个月建为传统所指的候选时段」是可以的；
 * 报「应在 2027 年 8 月 13 日」是伪精度，且由 `zh.liuyao.yingqiPoint` 强制拦下。
 * 与统计节点那一层同一条纪律。
 *
 * ## 候选按时间远近排，不按可能性高低
 *
 * 确定性的规则给出的候选，没有可言的概率。把它们排成「最可能→次可能」，
 * 是给读者一个规则本身给不出的东西。故一律按距今的月数升序。
 *
 * ## 健康类不产出时间窗
 *
 * `liuyao.topics.health.emitYingqi` 是硬约束。「病在某月」是本系统绝不输出的句式，
 * 也是最容易被当真的一句。此处直接不产出，并写明为什么不产出。
 */

import type { DerivationStep } from "../conclude/types.js";
import type { Branch } from "../types/ganzhi.js";
import type { LiuyaoParams } from "../params/types.js";
import { BRANCH_CLASHES, BRANCH_SIX_COMBINATIONS, MONTH_BRANCH_ORDER } from "../ganzhi/tables.js";
import { branchIndex, mod } from "../ganzhi/algebra.js";
import { jieMonthBounds } from "../temporal/views.js";
import type { DressedGua } from "./dress.js";
import type { Yongshen } from "./yongshen.js";
import type { YaoStrength } from "./strength.js";

const CLASH_OF = new Map<Branch, Branch>();
for (const [a, b] of BRANCH_CLASHES) { CLASH_OF.set(a, b); CLASH_OF.set(b, a); }
const HE_OF = new Map<Branch, Branch>();
for (const [a, b] of BRANCH_SIX_COMBINATIONS) { HE_OF.set(a, b); HE_OF.set(b, a); }

export interface YingqiWindow {
  /** 立春年。 */
  readonly year: number;
  /** 节气月序，0 = 寅月。 */
  readonly monthIndex: number;
  readonly branch: Branch;
  readonly fromJd: number;
  readonly toJd: number;
  /** 距起卦之月的月数，0 为当月。 */
  readonly monthsAhead: number;
  /** 传统上何以指向这一段 —— 可能多条同时命中。 */
  readonly reasons: readonly string[];
}

export interface YingqiResult {
  readonly windows: readonly YingqiWindow[];
  /** 不产出时的理由。健康类恒不产出。 */
  readonly suppressed: string | null;
  readonly derivation: readonly DerivationStep[];
}

interface Candidate { readonly branch: Branch; readonly reason: string }

/**
 * 由用神的状态推出候选地支。
 *
 * 每条规则给出一组地支与一句理由。规则之间**不排优先级** ——
 * 多条同时命中即多条并列，那正是卦象含糊时该有的样子。
 */
function candidatesOf(ys: Yongshen, st: YaoStrength | null): Candidate[] {
  const out: Candidate[] = [];
  const yao = ys.yao;

  if (yao === null) {
    if (ys.fu !== null) {
      out.push({ branch: ys.fu.branch, reason: "用神伏藏，传统以伏神值月为出伏之候" });
      const c = CLASH_OF.get(ys.fu.feiBranch);
      if (c !== undefined) {
        out.push({ branch: c, reason: `飞神 ${ys.fu.feiBranch} 逢冲则伏神得出` });
      }
    }
    return out;
  }

  const b = yao.branch;
  const clash = CLASH_OF.get(b)!;
  const he = HE_OF.get(b)!;

  if (yao.xunkong && yao.xunkongNullified === null) {
    out.push({ branch: b, reason: "用神旬空，传统以值其支为填实出空之候" });
    out.push({ branch: clash, reason: "用神旬空，传统以冲之为冲空则实之候" });
  }
  if (yao.yuepo && yao.yuepoNullified === null) {
    out.push({ branch: b, reason: "用神月破，传统以出月而值其支为填实之候" });
  }
  if (yao.moving) {
    out.push({ branch: he, reason: "用神发动，传统以逢合为合住之候" });
  } else if (yao.chongState !== "暗动") {
    out.push({ branch: b, reason: "用神安静，传统以逢值为候" });
    out.push({ branch: clash, reason: "用神安静，传统以逢冲为引发之候" });
  } else {
    out.push({ branch: he, reason: "用神暗动，传统以逢合为候" });
  }
  if (st !== null && (st.band === "无力" || st.band === "偏无力") && ys.gods !== null) {
    for (const y of ys.yuanYaos) {
      out.push({ branch: y.branch, reason: `用神力弱，传统以原神${ys.gods.yuan}${y.branch}值月为得生之候` });
    }
  }
  return out;
}

/**
 * 应期候选时段。
 *
 * `horizonMonths` 之内的节气月里，凡月建落在候选地支上的，皆为候选。
 */
export function yingqiWindows(
  gua: DressedGua, ys: Yongshen, st: YaoStrength | null, p: LiuyaoParams,
): YingqiResult {
  const derivation: DerivationStep[] = [];

  if (ys.topic.restricted === true && !p.topics.health.emitYingqi) {
    return {
      windows: [],
      suppressed: "健康类占事不产出时间窗。「病在某月」是本系统绝不输出的句式 ——"
        + "它最容易被当真，而卦象给不出这种精度。",
      derivation: [{
        step: "应期", detail: `占事「${ys.topic.label}」属受限类目，`
          + "按硬约束 liuyao.topics.health.emitYingqi 不产出候选时段。",
      }],
    };
  }

  const cands = candidatesOf(ys, st);
  if (cands.length === 0) {
    return {
      windows: [], suppressed: "卦象未指向任何候选时段。",
      derivation: [{ step: "应期", detail: "诸条取候之法皆未命中。" }],
    };
  }

  const byBranch = new Map<Branch, string[]>();
  for (const c of cands) {
    byBranch.set(c.branch, [...(byBranch.get(c.branch) ?? []), c.reason]);
  }
  derivation.push({
    step: "取候",
    detail: [...byBranch].map(([b, rs]) => `${b}：${rs.join("；")}`).join("　｜　"),
  });

  // 自起卦之月起，逐节气月向后扫
  const startIndex = MONTH_BRANCH_ORDER.indexOf(gua.casting.moment.pillars.month.branch);
  const startYear = yearOfCasting(gua);

  const windows: YingqiWindow[] = [];
  for (let k = 0; k < p.yingqi.horizonMonths; k++) {
    const idx = startIndex + k;
    const monthIndex = mod(idx, 12);
    const year = startYear + Math.floor(idx / 12);
    const branch = MONTH_BRANCH_ORDER[monthIndex]!;
    const reasons = byBranch.get(branch);
    if (reasons === undefined) continue;
    const { openJd, closeJd } = jieMonthBounds(year, monthIndex);
    windows.push({
      year, monthIndex, branch, fromJd: openJd, toJd: closeJd,
      monthsAhead: k, reasons: Object.freeze([...new Set(reasons)]),
    });
  }

  derivation.push({
    step: "候选",
    detail: windows.length === 0
      ? `未来 ${p.yingqi.horizonMonths} 个节气月内无月建落在候选之支上`
      : `${windows.length} 个候选时段，按距今远近排列 —— `
        + "确定性的规则给不出可能性高低，故不作此排序",
  });

  return { windows: Object.freeze(windows), suppressed: null, derivation };
}

/** 起卦所在的立春年。由年柱干支反推 —— 年柱本就是以立春为界的。 */
function yearOfCasting(gua: DressedGua): number {
  const { year } = gua.casting.moment.pillars;
  // 公元 4 年为甲子。由干支还原到年份，取距起卦公历年最近的那个解。
  const target = mod(branchIndex(year.branch) - branchIndex("子"), 12);
  const approx = gua.casting.moment.lunar.year;
  for (let y = approx - 1; y <= approx + 1; y++) {
    if (mod(y - 4, 12) === target) return y;
  }
  return approx;
}

/** 节气月的名目，供叙述。 */
export const monthLabel = (w: YingqiWindow): string =>
  `${w.year} 年${w.branch}月`;

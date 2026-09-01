/**
 * 时间层的四种视图。
 *
 * | 层 | 载体数 | 重算 L1–L4？ | 产出 |
 * | 大运 | 5 柱 | ✅ 全量 | 每步三个取样点的完整盘面 |
 * | 流年 | 6 柱 | ✅ 全量 | 每年盘面 + 顺逆指数 |
 * | 流月 | — | ❌ **不重算** | 神煞 + 引动事件 + 定性 |
 * | 流日 | — | ❌ **不重算** | 五行冲突提示 |
 *
 * 月与日是**引动的扳机**，不是力量的来源。把流月加进权重迭代，
 * 等于让一个 30 天的短期因素与终生不变的月令同台竞争数值 ——
 * 既无理论依据，也会让年度曲线被高频噪声淹没。
 *
 * **MonthView 与 DayView 的类型中不得出现任何 weight 字段**，
 * 由 test/temporal.spec.ts 从输出 JSON 层面强制。
 */

import type { Element, Pillar, TenGod } from "../types/ganzhi.js";
import type { CalendarDateTime } from "../astro/julian.js";
import type { PillarKind } from "../weights/carrier.js";
import type { ShenshaHit } from "../shensha/scan.js";
import type { DomainOutlook, YingqiEvent } from "../yingqi/types.js";
import type { EvaluatedChart } from "./evaluate.js";

export interface LuckStep {
  readonly index: number;
  readonly pillar: Pillar;
  readonly startJd: number;
  readonly endJd: number;
  readonly startCalendar: CalendarDateTime;
  readonly startAgeYears: number;
  /** 一步之内取三个样本点 —— 前五年重天干、后五年重地支，气象本就不同。 */
  readonly samples: readonly {
    readonly at: "start" | "mid" | "end";
    readonly elapsedYears: number;
    readonly stemShare: number;
    readonly favorIndex: number;
    readonly strength: string;
  }[];
  readonly stemPhaseSummary: string;
  readonly branchPhaseSummary: string;
}

export interface YearView {
  readonly year: number;
  readonly pillar: Pillar;
  readonly luckPillar: Pillar | null;
  readonly luckIndex: number | null;
  readonly evaluated: EvaluatedChart;
  /** 顺逆指数 ∈ (0,100)。衡量当年五行结构与本命用神的契合度，**不是运气好坏**。 */
  readonly favorIndex: number;
  readonly indexParts: { readonly base: number; readonly eventDelta: number; readonly raw: number };
  readonly vitality: number;
  readonly dayMasterShare: number;
  readonly events: readonly YingqiEvent[];
  readonly domains: readonly DomainOutlook[];
  /** 若该年内换运，分段返回，前端渲染为分段柱。**不做加权平均。** */
  readonly segments: readonly { readonly fromJd: number; readonly toJd: number; readonly luckIndex: number | null }[];
}

export type InteractionType =
  | "chong" | "he" | "xing" | "hai" | "po" | "sanhe" | "sanhui" | "fuyin" | "fanyin";

export interface Interaction {
  readonly type: InteractionType;
  readonly fromLayer: "stem" | "branch";
  readonly target: PillarKind;
  readonly targetPalace: string;
  readonly detail: string;
}

/** 流月视图 —— **无任何权重字段**。 */
export interface MonthView {
  readonly year: number;
  readonly monthIndex: number;
  readonly pillar: Pillar;
  readonly range: { readonly fromJd: number; readonly toJd: number };
  readonly openedBy: string;
  readonly yearPillar: Pillar;
  readonly luckPillar: Pillar | null;
  readonly shensha: readonly ShenshaHit[];
  readonly interactions: readonly Interaction[];
  readonly tone: {
    readonly monthElement: Element;
    readonly relationToYongshen: "supports" | "neutral" | "opposes";
    readonly relationToDayMaster: TenGod;
  };
  readonly events: readonly YingqiEvent[];
  readonly narrative: readonly string[];
}

export type ConflictKind =
  | "chongDayBranch" | "chongYongshen" | "keDayMaster" | "keYongshen"
  | "xing" | "hai" | "fuyinDayPillar";

export interface ElementConflict {
  readonly kind: ConflictKind;
  /** 只有两档 —— 日层的分辨率本就不支持更细的判断，给五档只是伪精度。 */
  readonly severity: "mild" | "notable";
  readonly involvedElements: readonly [Element, Element];
  readonly affectedPalace: string | null;
  readonly detail: string;
}

/** 流日视图 —— **无任何权重字段**。 */
export interface DayView {
  readonly date: CalendarDateTime;
  readonly pillar: Pillar;
  readonly monthPillar: Pillar;
  readonly yearPillar: Pillar;
  readonly conflicts: readonly ElementConflict[];
  readonly harmonies: readonly string[];
  readonly shensha: readonly ShenshaHit[];
  /** 一到两句，描述今日五行与本命的张力所在。**不出宜忌、不作预测。** */
  readonly note: string;
}

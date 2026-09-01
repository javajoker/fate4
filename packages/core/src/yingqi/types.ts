/** 应期规则与事件。 */

import type { Element, Pillar } from "../types/ganzhi.js";
import type { NatalChart } from "../chart/types.js";
import type { EvaluatedChart } from "../temporal/evaluate.js";

export type Domain =
  | "career" | "wealth" | "marriage" | "health"
  | "study" | "kin" | "relocation" | "legal" | "social";

export const DOMAIN_LABEL: Readonly<Record<Domain, string>> = Object.freeze({
  career: "事业", wealth: "财运", marriage: "婚姻感情", health: "健康",
  study: "学业", kin: "六亲", relocation: "迁动", legal: "法律", social: "人际",
});

export type Scope = "luck" | "year" | "month" | "day";

export interface YingqiContext {
  readonly chart: NatalChart;
  /** 本命盘（不含大运流年）—— 用神、忌神、六亲星的基准。 */
  readonly natal: EvaluatedChart;
  /** 当前瞬时（含大运流年）。 */
  readonly now: EvaluatedChart;
  readonly luck: Pillar | null;
  readonly annual: Pillar | null;
  readonly scope: Scope;
  /** 各五行占比的变化：当前 − 本命。 */
  readonly shareDelta: Readonly<Record<Element, number>>;
}

export interface YingqiRule {
  readonly id: string;
  readonly name: string;
  readonly scope: readonly Scope[];
  readonly priority: number;
  /**
   * 极性。**0 是刻意保留的一档 —— 「应事」不等于「吉」或「凶」。**
   * 驿马逢冲是「动」，动是好是坏取决于用忌。
   * 把所有事件二分为吉凶，是命理软件最常见的失真来源。
   */
  readonly polarity: -1 | 0 | 1;
  readonly weight: number;
  readonly domains: readonly Domain[];
  readonly narrativeTag: string;
  readonly when: (ctx: YingqiContext) => boolean | string;
}

export interface YingqiEvent {
  readonly ruleId: string;
  readonly name: string;
  readonly polarity: -1 | 0 | 1;
  readonly weight: number;
  readonly domains: readonly Domain[];
  readonly narrativeTag: string;
  /** 触发时的现场依据 —— 每条事件都必须能回溯到「为什么触发」。 */
  readonly evidence: string;
}

export interface DomainOutlook {
  readonly domain: Domain;
  readonly label: string;
  readonly supporting: readonly YingqiEvent[];
  readonly opposing: readonly YingqiEvent[];
  readonly neutral: readonly YingqiEvent[];
  /** min(Σ支持, Σ反对) / max(...)。越接近 1 张力越大 —— 该域有实质变动。 */
  readonly tension: number;
  readonly net: number;
}

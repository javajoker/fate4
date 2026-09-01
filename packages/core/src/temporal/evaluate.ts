/**
 * 在某一**瞬时**求解全盘 —— L1 → L2 → L3 → L4 的完整管线。
 *
 * 每次调用都从 L1 重跑，不做增量更新。理由：L2 的结构判定是全局的
 * （一个流年支的加入可能促成三合，从而改变整盘），增量更新在这里既不安全也不省事。
 *
 * 成本：载体约 24 个 → 有序对 552 → 3 轮不到 2 千次浮点运算。逐年算 120 年也在毫秒级。
 */

import type { Pillar } from "../types/ganzhi.js";
import type { NatalChart } from "../chart/types.js";
import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import { assignWeights } from "../weights/assign.js";
import type { Carrier } from "../weights/carrier.js";
import { applyStructure } from "../structure/apply.js";
import type { StructureEvent } from "../structure/types.js";
import { propagate, type PropagationResult } from "../propagate/iterate.js";
import { conclude } from "../conclude/conclude.js";
import type { Conclusions } from "../conclude/types.js";
import { scanShensha, type ShenshaHit } from "../shensha/scan.js";

export interface EvaluateInput {
  readonly chart: NatalChart;
  readonly luck?: { readonly pillar: Pillar; readonly elapsedYears: number } | null;
  readonly annual?: Pillar | null;
  readonly params?: Params;
}

export interface EvaluatedChart {
  readonly carriers: readonly Carrier[];
  readonly events: readonly StructureEvent[];
  readonly propagation: PropagationResult;
  readonly conclusions: Conclusions;
  readonly shensha: readonly ShenshaHit[];
}

export function evaluate(input: EvaluateInput): EvaluatedChart {
  const params = input.params ?? DEFAULT_PARAMS;
  const { chart } = input;

  const w = assignWeights({
    chart,
    luck: input.luck ?? null,
    annual: input.annual ?? null,
    params,
  });
  // 深拷贝：L2/L3 会就地改写，不得污染调用方
  const carriers: Carrier[] = w.carriers.map((c) => ({
    ...c, flags: [...c.flags], trace: [...c.trace],
  }));

  const st = applyStructure(carriers, chart.month.branch, params);
  const pr = propagate(st.carriers, params.propagation);
  const conclusions = conclude({
    carriers: pr.carriers, monthBranch: chart.month.branch,
    gender: chart.input.gender, vitality: pr.vitality, flows: pr.flows, params,
  });
  const shensha = scanShensha({
    chart, carriers: pr.carriers, events: st.events,
    // 大运与流年一并纳入扫描 —— 「流年驿马」「流年桃花」正是最典型的应期
    luck: input.luck?.pillar ?? null,
    annual: input.annual ?? null,
    params: params.shensha,
    changsheng: {
      school: params.conclusion.changshengSchool,
      earth: params.conclusion.earthChangsheng,
    },
  });

  return { carriers: pr.carriers, events: st.events, propagation: pr, conclusions, shensha };
}

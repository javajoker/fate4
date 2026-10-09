/**
 * 即时盘 —— 在某一瞬时求解全盘。
 *
 * ## 与基础盘的分工
 *
 * ```
 * 基础盘（buildBaseChart，算一次即冻结）
 *   四柱的 L1 配重 → L2 → L3 → L4 → 神煞
 *
 * 即时盘（evaluateAt，每个时点一次）
 *   拷贝基础盘的 L1  +  铺大运流年  →  L2 全局重检测  →  L3 全局重传导  →  L4
 * ```
 *
 * **四柱的 L1 配重复用不重算**：`base.l1` 拷一份即用。于是「四柱的初始配重
 * 不随时点改变」是构造上的事实，而不是碰巧相等。
 *
 * **结构与生克必须全局重算**，两条理由：
 *
 * 一、三合要全部地支同时在场才看得见。本命有寅、午，本身只成半合；
 *     流年来一个戌，寅午戌三合火局立成。只看基础盘的结果，永远看不到这个局。
 *
 * 二、冲的裁决依赖相对权重。大运的天干占比自 0.70 线性降到 0.30，
 *     同一步运里某个冲的强弱比会穿过 1.20 或 2.50 的门槛 ——
 *     **冲的结局会在运程中途改变**。把结构冻结在换运那一刻，这类变化就消失了。
 *
 * 每次调用都从 L2 重跑，不做增量更新：L2 的结构判定是全局的，
 * 增量在这里既不安全也不省事。成本：载体约 24 个 → 有序对 552 →
 * 3 轮不到 2 千次浮点运算，逐月算 720 个点也在秒级。
 */

import type { Pillar } from "../types/ganzhi.js";
import type { NatalChart } from "../chart/types.js";
import { toBaseChart, type BaseChart, type SolvedChart } from "../chart/baseChart.js";
import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import { layExternalCarriers, markFlags } from "../weights/assign.js";
import { cloneCarriers, type Carrier } from "../weights/carrier.js";
import { structureOf } from "../structure/apply.js";
import { propagate } from "../propagate/iterate.js";
import { conclude } from "../conclude/conclude.js";
import { scanShensha } from "../shensha/scan.js";

/** 一个时点。三者皆可缺省 —— 全缺省时即为本命盘的重算。 */
export interface Instant {
  readonly luck?: { readonly pillar: Pillar; readonly elapsedYears: number } | null;
  readonly annual?: Pillar | null;
  /** 流月**只入符号层**，不参与权重。硬约束。 */
  readonly fleetingMonth?: Pillar | null;
}

export interface EvaluateInput extends Instant {
  readonly chart: NatalChart;
  readonly params?: Params;
}

export interface EvaluatedChart extends SolvedChart {
  /**
   * 指回基础盘。同一次报告 / 同一条曲线内，全部即时盘引用**同一个对象** ——
   * 这一点可以用引用相等直接断言，见 test/baseChart.spec.ts。
   */
  readonly base: BaseChart;
  readonly at: Instant;
}

export function evaluateAt(base: BaseChart, at: Instant = {}): EvaluatedChart {
  const { chart, params } = base;

  // 四柱：拷贝基础盘的 L1，不重新配重
  const carriers: Carrier[] = cloneCarriers(base.l1);
  // 大运与流年：另铺
  carriers.push(...layExternalCarriers(at.luck, at.annual, params).carriers);
  // 日主 / 透干 / 引出 —— 在合并后的集合上重标（幂等）
  markFlags(carriers);

  // 与 `buildBaseChart` 共用同一个开关 —— 两条路径不允许各走各的。
  const st = structureOf(carriers, chart.month.branch, params);
  const pr = propagate(st.carriers, params.propagation);
  const conclusions = conclude({
    carriers: pr.carriers, monthBranch: chart.month.branch,
    gender: chart.input.gender, vitality: pr.vitality, flows: pr.flows, params,
  });
  const shensha = scanShensha({
    chart, carriers: pr.carriers, events: st.events,
    luck: at.luck?.pillar ?? null,
    annual: at.annual ?? null,
    fleetingMonth: at.fleetingMonth ?? null,
    params: params.shensha,
    changsheng: {
      school: params.conclusion.changshengSchool,
      earth: params.conclusion.earthChangsheng,
    },
  });

  return {
    base, at,
    carriers: pr.carriers, events: st.events,
    propagation: pr, conclusions, shensha,
  };
}

/**
 * 便捷入口 —— 自建基础盘再求解。
 *
 * 单次查询用它无妨；但**曲线与报告不要走这条**：每次调用都会重建一遍基础盘，
 * 720 个采样点就是 720 遍。那种场合先 `buildBaseChart` 一次，再逐点 `evaluateAt`。
 */
export function evaluate(input: EvaluateInput): EvaluatedChart {
  const base = toBaseChart(input.chart, input.params ?? DEFAULT_PARAMS);
  return evaluateAt(base, {
    luck: input.luck ?? null,
    annual: input.annual ?? null,
    fleetingMonth: input.fleetingMonth ?? null,
  });
}

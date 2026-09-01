/**
 * 基础盘 —— **算一次，冻结，作一切时点偏离的分母**。
 *
 * ## 为什么要成为一等对象
 *
 * 在此之前，`evaluate({ chart })` 在多处被反复调用：`yearView` 每年一次、
 * `monthView` 每月一次、`buildReport` 又一次。它们算的是同一张基础盘，
 * 彼此之间却没有「同一个对象」的保证，只有「同一个函数应该给同样结果」的**期待**。
 *
 * 画一条 60 年的曲线因此要把基础盘重算 60 遍；更要紧的是，
 * 「以基础盘为基准」这句话在类型上无从表达 —— 谁都可以拿另一张盘当基准。
 *
 * 改成一等对象之后，`evaluateAt` 收 `BaseChart` 而非 `NatalChart`，
 * 于是「基准算过一次」成为**类型层面的事实**，而不是调用方需要记得的纪律。
 * 每张即时盘都持有指回基础盘的引用，同一次报告内引用同一个对象 ——
 * 这一点可以用引用相等直接断言。
 *
 * ## 只取四柱
 *
 * 胎元由月柱推得、命宫由月支与时支推得，二者的信息已大部分蕴含在四柱里；
 * 而月令本已有 2.0 倍放大与司令加成。给它们等同一柱的权重，
 * 等于把月柱一系的信息数两遍。故基础盘只取四柱，
 * 胎元命宫保留三项辅助职责（呈现、神煞落点、扰动序列）。
 * 见 docs/03-weights.md 与 docs/12-persona-curves-nodes.md §2.1。
 *
 * ## 「不重算」与「重算」各指什么
 *
 * | | |
 * | --- | --- |
 * | **不重算** | 四柱的 L1 配重；`carriers`（基础盘终态）作为一切偏离的分母 |
 * | **重算** | 即时盘的结构与生克 —— **必须全局重跑** |
 *
 * 结构必须重跑，因为三合要全部地支同时在场才看得见（本命寅午只成半合，
 * 流年来戌才成局）；生克必须重跑，因为冲的裁决依赖相对权重，
 * 而大运份额在运内连续推移，冲的结局会中途翻转。
 * 只在基础盘上做加法，新来的干支就没有作用于命的通道，「运」也就不成其为运。
 */

import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import { loadParams, paramsHash } from "../params/load.js";
import { assignWeights } from "../weights/assign.js";
import { cloneCarriers, type Carrier } from "../weights/carrier.js";
import { applyStructure } from "../structure/apply.js";
import type { StructureEvent } from "../structure/types.js";
import { propagate, type PropagationResult } from "../propagate/iterate.js";
import { conclude } from "../conclude/conclude.js";
import type { Conclusions } from "../conclude/types.js";
import { scanShensha, type ShenshaHit } from "../shensha/scan.js";
import { personaOf, type Persona } from "../conclude/persona.js";
import type { NatalChart } from "./types.js";

/**
 * 已解出权重终态与结论的盘面 —— 基础盘与即时盘共有的形状。
 *
 * 有了它，「以某盘为基准」的函数（顺逆指数、应期规则、份额偏离）
 * 就不必区分传进来的是基础盘还是另一张即时盘。
 */
export interface SolvedChart {
  readonly carriers: readonly Carrier[];
  readonly events: readonly StructureEvent[];
  readonly propagation: PropagationResult;
  readonly conclusions: Conclusions;
  readonly shensha: readonly ShenshaHit[];
}

export interface BaseChart extends SolvedChart {
  readonly chart: NatalChart;
  /**
   * 人格层。**只由基础盘导出** —— 个性是命的属性，不随流年改变。
   * 时间层追踪的是它的两个标量（显隐比、内外张力）随时点的变化，
   * 而不是整个 Persona 每年重算一遍。
   */
  readonly persona: Persona;
  readonly params: Params;
  /** 随盘的参数快照。半年后有人拿旧报告来问「为什么不一样」，这是唯一的依据。 */
  readonly paramsHash: string;

  /**
   * 四柱的 **L1 初始配重**（不含大运流年）。
   * 即时盘拷贝这一份再追加外部柱，故「四柱的配重不随时点改变」是构造上的事实。
   */
  readonly l1: readonly Carrier[];
}

export function buildBaseChart(chart: NatalChart, params: Params = DEFAULT_PARAMS): BaseChart {
  // L1 —— 只铺四柱。不传 luck / annual，故 REVEALED 只认本命天干。
  const w = assignWeights({ chart, params });
  const l1 = cloneCarriers(w.carriers);

  // L2 / L3 就地改写，故另拷一份走管线，`l1` 保持初始态
  const carriers = cloneCarriers(w.carriers);
  const st = applyStructure(carriers, chart.month.branch, params);
  const pr = propagate(st.carriers, params.propagation);
  const conclusions = conclude({
    carriers: pr.carriers, monthBranch: chart.month.branch,
    gender: chart.input.gender, vitality: pr.vitality, flows: pr.flows, params,
  });
  const shensha = scanShensha({
    chart, carriers: pr.carriers, events: st.events, params: params.shensha,
    changsheng: {
      school: params.conclusion.changshengSchool,
      earth: params.conclusion.earthChangsheng,
    },
  });

  const persona = personaOf({
    carriers: pr.carriers, events: st.events, flows: pr.flows, shensha,
    conclusions, silingStem: chart.siling.stem, monthBranch: chart.month.branch,
    params: params.persona,
  });

  return Object.freeze({
    chart, params, paramsHash: paramsHash(params),
    persona,
    l1: Object.freeze(l1),
    events: st.events,
    carriers: pr.carriers,
    propagation: pr,
    conclusions,
    shensha,
  });
}

/**
 * 归一到基础盘。
 *
 * 时间层的各视图既接受 `NatalChart`（自建基准，用于单次查询与既有调用点），
 * 也接受 `BaseChart`（共用基准，报告与曲线走这条）。
 *
 * **传入 BaseChart 时若同时给了不同的 params，直接抛错**，
 * 不静默丢弃 —— 那会让调用方以为参数生效了，而盘面纹丝不动。
 */
export function toBaseChart(from: BaseChart | NatalChart, params?: Params): BaseChart {
  if (isBaseChart(from)) {
    if (params !== undefined && params !== from.params
        && paramsHash(params) !== from.paramsHash) {
      throw new Error(
        "已给定 BaseChart，又传入了另一套参数。基础盘一经构建即冻结，"
        + "换参数须重新 buildBaseChart —— 此处不静默丢弃参数。",
      );
    }
    return from;
  }
  return buildBaseChart(from, params ?? DEFAULT_PARAMS);
}

export function isBaseChart(x: BaseChart | NatalChart): x is BaseChart {
  return (x as BaseChart).l1 !== undefined && (x as BaseChart).paramsHash !== undefined;
}

/** 便捷入口：由 BirthInput 之外的调用方直接给参数覆盖。 */
export function baseChartOf(chart: NatalChart, overrides?: Parameters<typeof loadParams>[0]): BaseChart {
  return buildBaseChart(chart, loadParams(overrides));
}

/**
 * L3 生克传导 —— 多轮同步迭代至收敛。
 *
 * ## 三条建模决策
 *
 * **一、生是「流」，不是「加」。**
 * 木生火不是凭空给火加分，而是木的一部分流向火。母生子，母泄气 —— 传统的明确表述。
 *     W_木 −= F ；  W_火 += η·F （η = 0.85）
 * (1−η) 是传输损耗，不进入任何载体。于是生准守恒，不会引发数值爆炸。
 *
 * **二、克是「毁」，不是「转移」。**
 * 金克木不是金拿走木的分，是金削掉木的分，且金自己也耗力。
 *     W_木 −= D ；  W_金 −= D · keCost
 * 双方都减 → 严格收缩，天然收敛。
 *
 * **三、同类不加权，改为抗性。**见 resistance.ts。
 *
 * ## 为何同步而非依次
 *
 * 每轮基于上一轮的**完整状态**计算全部增量，一次性施加。结果与载体的遍历顺序无关，
 * 可复现、可单测。「依次计算」会让先算的柱影响后算的柱，换个顺序结论就变。
 */

import { ELEMENTS, POLARITIES, type Element, type Polarity } from "../types/ganzhi.js";
import type { PropagationParams } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import type { Carrier } from "../weights/carrier.js";
import { propagationDistance } from "./distance.js";
import { kernelOf, polarityCoefOf, relationOf } from "./relations.js";
import { computeResistance } from "./resistance.js";

export interface FlowRecord {
  readonly from: string;
  readonly to: string;
  readonly kind: "sheng" | "ke";
  /** 全部轮次累加的流量（克为破坏量，取正）。 */
  totalAmount: number;
  readonly coefficients: {
    readonly K: number; readonly Y: number; readonly Dist: number;
    readonly resistance?: number;
  };
}

export interface ConvergenceReport {
  readonly converged: boolean;
  readonly rounds: number;
  readonly finalResidual: number;
  readonly history: readonly { round: number; total: number; maxDelta: number }[];
}

export interface PropagationResult {
  readonly carriers: readonly Carrier[];
  /** 归一前的终态总量。 */
  readonly rawTotal: number;
  /** **单轮**留存率（几何平均）。高＝五行流通，低＝战克交加。与轮数无关。 */
  readonly vitality: number;
  /** 累计留存 = rawTotal / M0。随轮数变化，仅供诊断。 */
  readonly cumulativeRetention: number;
  readonly convergence: ConvergenceReport;
  readonly byElement: Readonly<Record<Element, number>>;
  readonly byPolarity: Readonly<Record<Polarity, number>>;
  /** 供桑基图：谁在生谁、谁在克谁、流量多大。 */
  readonly flows: readonly FlowRecord[];
}

interface Effect {
  readonly toIndex: number;
  cost: number;       // 施方付出（恒为正，从 i 扣）
  gainToJ: number;    // 受方所得（生为正、克为负）
  readonly kind: "sheng" | "ke";
  readonly K: number;
  readonly Y: number;
  readonly Dist: number;
  readonly resistance?: number;
}

export function propagate(
  input: readonly Carrier[],
  paramsIn?: PropagationParams,
): PropagationResult {
  const p = paramsIn ?? DEFAULT_PARAMS.propagation;
  const carriers = input as Carrier[];
  const n = carriers.length;

  const M0 = carriers.reduce((a, c) => a + c.weight, 0);
  const initial = carriers.map((c) => c.weight);
  const flowMap = new Map<string, FlowRecord>();
  const history: { round: number; total: number; maxDelta: number }[] = [];

  let converged = false;
  let residual = Number.NaN;
  let round = 0;

  for (; round < p.maxRounds; round++) {
    const M = carriers.reduce((a, c) => a + c.weight, 0);
    if (M <= 0) { converged = true; residual = 0; break; }

    const resistance = computeResistance(carriers, M, p);
    const outgoing: Effect[][] = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      const ci = carriers[i]!;
      if (ci.weight <= 0) continue;

      // ── 按关系分组，**对目标集归一** ──
      //
      // 若对每个目标独立求和，一个载体的流出率就会正比于目标个数 ——
      // 而目标个数取决于藏干记账（火有 4 个土载体可生，木只有 1 个），
      // 纯属artifact。实测该写法下流出率中位数达 63%、最大 102%，
      // 人人撞上限，全盘等比塌缩，且稳态形状由载体个数而非命理结构决定。
      //
      // 正确的语义是：**流出速率是施方的属性，多个受方是分摊而非倍增**。
      // 速率取最强耦合（有一个近邻受方即可全速流出），流量按耦合强度分摊。
      const buckets: Record<"生" | "克" | "同", { j: number; w: number }[]> = { 生: [], 克: [], 同: [] };
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const rel = relationOf(ci, carriers[j]!);
        // 「无」表示 i 在此方向不施力（j 生 i 或 j 克 i），其作用由 (j,i) 方向计入。
        // 在同一方向同时计入正反两种作用，是这类实现最常见的重复计数 bug。
        if (rel === "无") continue;
        const Y = rel === "同" ? 1 : polarityCoefOf(ci, carriers[j]!, rel, p);
        buckets[rel].push({ j, w: Y * propagationDistance(ci, carriers[j]!, p) });
      }

      for (const rel of ["生", "克"] as const) {
        const ts = buckets[rel];
        if (ts.length === 0) continue;
        const sumW = ts.reduce((a, t) => a + t.w, 0);
        const maxW = ts.reduce((a, t) => Math.max(a, t.w), 0);
        if (sumW <= 0 || maxW <= 0) continue;

        const K = kernelOf(rel, p);
        const totalOut = ci.weight * ci.activity * K * maxW;   // 速率由最强耦合定
        for (const t of ts) {
          const share = t.w / sumW;
          const B = totalOut * share;
          if (B <= 0) continue;
          if (rel === "生") {
            outgoing[i]!.push({ toIndex: t.j, cost: B, gainToJ: p.shengEfficiency * B, kind: "sheng", K, Y: t.w / maxW, Dist: maxW });
          } else {
            const r = resistance.get(carriers[t.j]!.id) ?? 1;
            const damage = B * r;
            outgoing[i]!.push({ toIndex: t.j, cost: damage * p.keCost, gainToJ: -damage, kind: "ke", K, Y: t.w / maxW, Dist: maxW, resistance: r });
          }
        }
      }

      // 加分式同党：已知会引入正反馈而发散，仅供对照实验，不作默认
      if (p.tongdang.mode === "additive") {
        for (const t of buckets["同"]) {
          const B = ci.weight * ci.activity * p.tongdang.additiveKernel * t.w;
          if (B > 0) outgoing[i]!.push({ toIndex: t.j, cost: 0, gainToJ: B, kind: "sheng", K: p.tongdang.additiveKernel, Y: 1, Dist: t.w });
        }
      }
    }

    // ── 流出上限：任一载体单轮不得付出超过其权重的 outflowCap ──
    // 缩放必须**同时**作用于 cost 与 gainToJ。只缩其一会凭空制造或销毁质量，
    // 破坏审计不变量。
    for (let i = 0; i < n; i++) {
      const eff = outgoing[i]!;
      const O = eff.reduce((a, e) => a + e.cost, 0);
      const cap = p.outflowCap * carriers[i]!.weight;
      if (O > cap && O > 0) {
        const s = cap / O;
        for (const e of eff) { e.cost *= s; e.gainToJ *= s; }
      }
    }

    // ── 受克上限：与流出上限对称 ──
    // 缺了它，金 123 单位的全部克力会砸在唯一的 4 单位乙木上，一轮蒸发。
    // 克应当削弱，不应当汽化。
    const incomingDamage = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (const e of outgoing[i]!) if (e.kind === "ke") incomingDamage[e.toIndex]! -= e.gainToJ;
    }
    for (let j = 0; j < n; j++) {
      const cap = p.inflowDamageCap * carriers[j]!.weight;
      if (incomingDamage[j]! > cap && incomingDamage[j]! > 0) {
        const s2 = cap / incomingDamage[j]!;
        for (let i = 0; i < n; i++) {
          for (const e of outgoing[i]!) {
            if (e.kind === "ke" && e.toIndex === j) { e.cost *= s2; e.gainToJ *= s2; }
          }
        }
      }
    }

    const delta = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (const e of outgoing[i]!) {
        delta[i] = delta[i]! - e.cost;
        delta[e.toIndex] = delta[e.toIndex]! + e.gainToJ;

        const key = `${carriers[i]!.id}>${carriers[e.toIndex]!.id}:${e.kind}`;
        const rec = flowMap.get(key);
        const amount = e.kind === "sheng" ? e.gainToJ : -e.gainToJ;
        if (rec === undefined) {
          flowMap.set(key, {
            from: carriers[i]!.id, to: carriers[e.toIndex]!.id, kind: e.kind,
            totalAmount: amount * p.damping,
            coefficients: { K: e.K, Y: e.Y, Dist: e.Dist, ...(e.resistance !== undefined ? { resistance: e.resistance } : {}) },
          });
        } else {
          rec.totalAmount += amount * p.damping;
        }
      }
    }

    const before = carriers.map((c) => c.weight);
    const beforeTotal = M;
    for (let i = 0; i < n; i++) {
      carriers[i]!.weight = Math.max(p.floor, before[i]! + p.damping * delta[i]!);
    }
    const afterTotal = carriers.reduce((a, c) => a + c.weight, 0);

    // 收敛判据用归一分布 —— 关心的是力量结构，不是标度
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      const pOld = beforeTotal > 0 ? before[i]! / beforeTotal : 0;
      const pNew = afterTotal > 0 ? carriers[i]!.weight / afterTotal : 0;
      maxDelta = Math.max(maxDelta, Math.abs(pNew - pOld));
    }
    history.push({ round, total: afterTotal, maxDelta });
    residual = maxDelta;
    if (maxDelta < p.epsilon) { converged = true; round += 1; break; }
  }

  const rawTotal = carriers.reduce((a, c) => a + c.weight, 0);
  /**
   * vitality 定义为**单轮留存率**（几何平均），而非累计留存。
   *
   * 累计留存 ≈ ρ^rounds，会随轮数任意变化，不是命局的属性。
   * 单轮留存 ρ 才是：它衡量这盘每一轮交互中有多少力量被内耗掉 ——
   * 高（近 1）＝五行流通、相生为主；低＝战克交加，力量消耗在内部。
   */
  const vitality = M0 > 0 && round > 0 ? Math.pow(rawTotal / M0, 1 / round)
    : M0 > 0 ? rawTotal / M0 : 0;
  const cumulativeRetention = M0 > 0 ? rawTotal / M0 : 0;

  // 形状归一回 L2 总量；标度的变化由 vitality 单独承载
  if (rawTotal > 0 && M0 > 0) {
    const k = M0 / rawTotal;
    for (const c of carriers) c.weight *= k;
  }

  for (const [i, c] of carriers.entries()) {
    c.trace.push({
      layer: "L3", round, rule: "L3.propagate",
      from: initial[i]!, to: c.weight, cause: [],
      params: { rounds: round, damping: p.damping, vitality },
      ...(converged ? {} : { note: `未收敛，残差 ${residual.toFixed(5)}` }),
    });
  }

  const byElement = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  const byPolarity = Object.fromEntries(POLARITIES.map((e) => [e, 0])) as Record<Polarity, number>;
  for (const c of carriers) {
    byElement[c.element] += c.weight;
    byPolarity[c.polarity] += c.weight;
  }

  return {
    carriers, rawTotal, vitality, cumulativeRetention,
    convergence: { converged, rounds: round, finalResidual: residual, history },
    byElement, byPolarity,
    flows: [...flowMap.values()].sort((a, b) => b.totalAmount - a.totalAmount),
  };
}

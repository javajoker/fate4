/**
 * L2 施加层 —— 把检测出的结构变成权重与活性的改写。
 *
 * ## 为何在 L3 之前
 *
 * 合冲刑害改变的是「场上有什么」，生克计算的是「场上的东西如何互相作用」。
 * 顺序颠倒会得到错误结果：对一个已被合化成土的甲木，再按木去算生克，是错的。
 *
 * ## 施加次序
 *
 * 检测 → 争合裁定 → 墓库定态 → 互解裁决 → 局的增减 → 合化/合绊 → 冲 → 刑 → 害 → 破
 *
 * 墓库的开闭**只施加一次**：闭库乘 sealedFactor，开库乘 releaseGain。
 * 先闭后开会把同一件事算两遍。
 */

import { FOUR_TOMBS } from "../ganzhi/tables.js";
import type { Branch } from "../types/ganzhi.js";
import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import { cloneCarriers, type Carrier, type PillarKind } from "../weights/carrier.js";
import { detectClash, detectHe, detectXing, type ClashCandidate, type HeCandidate } from "./detect.js";
import { chongDistanceCoef, heDistanceCoef } from "./distance.js";
import { arbitrate, chongStrength, heStrength } from "./arbitrate.js";
import { judgeTransform } from "./transform.js";
import type { BranchSlot, StemSlot, StructureEvent, StructureResult } from "./types.js";

/** 由载体集合还原出场上的支位与干位。 */
export function slotsOf(carriers: readonly Carrier[]): {
  branches: BranchSlot[]; stems: StemSlot[];
} {
  const byPillar = new Map<PillarKind, Carrier[]>();
  for (const c of carriers) {
    const list = byPillar.get(c.position.pillar) ?? [];
    list.push(c);
    byPillar.set(c.position.pillar, list);
  }
  const branches: BranchSlot[] = [];
  const stems: StemSlot[] = [];
  for (const [pillar, list] of byPillar) {
    const hidden = list.filter((c) => c.position.layer === "branch");
    const stem = list.find((c) => c.position.layer === "stem");
    if (stem !== undefined) stems.push({ pillar, stem: stem.stem, carrier: stem });
    if (hidden.length > 0 && hidden[0]!.hostBranch !== null) {
      branches.push({
        pillar, branch: hidden[0]!.hostBranch,
        carriers: hidden,
        weight: hidden.reduce((a, c) => a + c.weight, 0),
      });
    }
  }
  return { branches, stems };
}

/** 缩放一个载体并记录增量。距离系数把效果向「无操作」衰减。 */
function scale(c: Carrier, factor: number, rule: string, delta: Record<string, number>,
                params: Record<string, number>): void {
  const to = c.weight * factor;
  delta[c.id] = (delta[c.id] ?? 0) + (to - c.weight);
  c.trace.push({ layer: "L2", rule, from: c.weight, to, cause: [], params });
  c.weight = to;
}

/** 距离衰减：coef=1 时全效，coef=0 时无效。 */
const attenuate = (factor: number, coef: number): number => 1 + (factor - 1) * coef;

function damp(c: Carrier, factor: number, delta: Record<string, number>): void {
  const to = c.activity * factor;
  delta[c.id] = (delta[c.id] ?? 0) + (to - c.activity);
  c.activity = to;
}

export function applyStructure(
  carriers: readonly Carrier[],
  monthBranch: Branch,
  paramsIn?: Params,
): StructureResult {
  const params = paramsIn ?? DEFAULT_PARAMS;
  const p = params.structure;
  const events: StructureEvent[] = [];
  const { branches, stems } = slotsOf(carriers);

  const heCands = detectHe(branches, stems);
  const clashes = detectClash(branches, stems);
  const xings = detectXing(branches);

  // ── 争合妒合：同一支/干进入两个及以上同类合 ──
  const heCount = new Map<string, number>();
  const keyOf = (pillar: PillarKind, layer: string) => `${pillar}.${layer}`;
  for (const h of heCands) {
    for (const s of h.slots) heCount.set(keyOf(s.pillar, "branch"), (heCount.get(keyOf(s.pillar, "branch")) ?? 0) + 1);
    for (const s of h.stemSlots ?? []) heCount.set(keyOf(s.pillar, "stem"), (heCount.get(keyOf(s.pillar, "stem")) ?? 0) + 1);
  }
  const isContested = (h: HeCandidate): boolean =>
    h.slots.some((s) => (heCount.get(keyOf(s.pillar, "branch")) ?? 0) > 1)
    || (h.stemSlots ?? []).some((s) => (heCount.get(keyOf(s.pillar, "stem")) ?? 0) > 1);

  // ── 墓库定态：被冲或被刑则开 ──
  const chongOnly = clashes.filter((c) => c.kind === "chong");
  const tombOpened = new Set<PillarKind>();
  for (const b of branches) {
    if (!(FOUR_TOMBS as readonly Branch[]).includes(b.branch)) continue;
    const hitByChong = p.tomb.openOnChong && chongOnly.some(
      (c) => (c.a as BranchSlot).pillar === b.pillar || (c.b as BranchSlot).pillar === b.pillar);
    const hitByXing = p.tomb.openOnXing && xings.some(
      (x) => x.complete && x.slots.some((s) => s.pillar === b.pillar));
    if (hitByChong || hitByXing) tombOpened.add(b.pillar);
  }
  for (const b of branches) {
    if (!(FOUR_TOMBS as readonly Branch[]).includes(b.branch)) continue;
    const opened = tombOpened.has(b.pillar);
    const factor = opened ? p.tomb.releaseGain : p.tomb.sealedFactor;
    const delta: Record<string, number> = {};
    // 本气是墙本身，不受开闭影响；只有中气与余气是「库里的东西」
    for (const c of b.carriers) {
      if ((c.position.hiddenIndex ?? 0) === 0) continue;
      scale(c, factor, opened ? "L2.tomb.open" : "L2.tomb.sealed", delta, { factor });
      c.flags.push(opened ? "TOMB_OPENED" : "TOMB_SEALED");
    }
    if (Object.keys(delta).length > 0) {
      events.push({
        kind: opened ? "tombOpen" : "tombSealed",
        outcome: "applied",
        participants: Object.keys(delta),
        pillars: [b.pillar], branches: [b.branch],
        distanceCoef: 1, weightDelta: delta,
        narrativeTag: opened ? "库已冲开" : "库中之物未动",
        note: opened ? "刑冲开库，库中六亲财官得以显现" : "闭库，中气余气按存量计",
      });
    }
  }

  // ── 互解裁决：同一支既入合又逢冲 ──
  const brokenHe = new Set<HeCandidate>();
  /** 被合解掉的冲 → 裁决依据。「合解冲」的事件必须带分数，否则无法回答「为什么不冲」。 */
  const neutralizedChong = new Map<ClashCandidate, { he: number; chong: number; by: HeCandidate }>();
  const mutualChong = new Set<ClashCandidate>();
  const scoreOf = new Map<HeCandidate, { he: number; chong: number }>();

  for (const h of heCands) {
    for (const cl of chongOnly) {
      const pillarsInHe = new Set(h.slots.map((s) => s.pillar));
      const a = cl.a as BranchSlot; const b = cl.b as BranchSlot;
      if (!pillarsInHe.has(a.pillar) && !pillarsInHe.has(b.pillar)) continue;
      const he = heStrength(h, p);
      const chong = chongStrength(cl, p);
      const r = arbitrate(he, chong, p);
      scoreOf.set(h, { he, chong });
      if (r.verdict === "heWins") neutralizedChong.set(cl, { he, chong, by: h });
      else if (r.verdict === "chongWins") brokenHe.add(h);
      else { brokenHe.add(h); mutualChong.add(cl); }
    }
  }

  // ── 局的增减：其气专于一行 ──
  const gainDecayOf = (h: HeCandidate) => {
    switch (h.kind) {
      case "sanhui": return p.sanhui;
      case "sanhe": return p.sanhe;
      case "banhe": return h.banheKind === "wangMu" ? p.banhe.wangMu : p.banhe.shengWang;
      case "gong": return p.banhe.gong;
      default: return null;
    }
  };
  for (const h of heCands) {
    const gd = gainDecayOf(h);
    if (gd === null) continue;
    const coef = heDistanceCoef(h.slots.map((s) => s.pillar), p.heDistance, p.externalHeFactor);
    const delta: Record<string, number> = {};
    for (const s of h.slots) {
      for (const c of s.carriers) {
        scale(c, attenuate(c.element === h.element ? gd.gain : gd.decay, coef),
          `L2.${h.kind}`, delta, { gain: gd.gain, decay: gd.decay, coef });
      }
    }
    events.push({
      kind: h.kind, outcome: "applied",
      participants: h.slots.flatMap((s) => s.carriers.map((c) => c.id)),
      pillars: h.slots.map((s) => s.pillar),
      branches: h.slots.map((s) => s.branch),
      transformedTo: h.element,
      distanceCoef: coef, weightDelta: delta,
      narrativeTag: h.kind === "gong" ? "拱而不合" : `${h.element}局`,
      note: h.kind === "gong" ? "缺旺神，只作拱，力最弱" : "其气专于一行",
    });
  }

  // ── 优先级：范围大者优先。会局或三合已成，其内的六合不再论 ──
  //
  // 「巳午未三会火，那午未还算不算合土？」—— 传统的答案是不算：会局优先，
  // 二支之私合已被方局吞没。只把它降级为争合是不够的，须整条annul。
  const consumedByBigger = new Set<PillarKind>();
  for (const h of heCands) {
    if (h.kind === "sanhui" || h.kind === "sanhe") {
      for (const s of h.slots) consumedByBigger.add(s.pillar);
    }
  }

  // ── 六合与天干五合：化 或 绊 ──
  for (const h of heCands) {
    if (h.kind !== "liuhe" && h.kind !== "ganhe") continue;

    if (h.kind === "liuhe" && h.slots.every((s) => consumedByBigger.has(s.pillar))) {
      events.push({
        kind: "liuhe", outcome: "neutralized",
        participants: [], pillars: h.slots.map((s) => s.pillar),
        branches: h.slots.map((s) => s.branch), transformedTo: h.element,
        distanceCoef: 0, weightDelta: {},
        narrativeTag: "会局夺合",
        note: "二支已入会局或三合，范围大者优先，六合不再论",
      });
      continue;
    }

    const contested = isContested(h);
    const verdict = judgeTransform(h, {
      monthBranch, allCarriers: carriers, contested, brokenByChong: brokenHe.has(h),
    }, p);
    const parts: Carrier[] = [
      ...h.slots.flatMap((s) => s.carriers),
      ...(h.stemSlots ?? []).map((s) => s.carrier),
    ];
    const pillars = [...h.slots.map((s) => s.pillar), ...(h.stemSlots ?? []).map((s) => s.pillar)];
    const coef = heDistanceCoef(pillars, p.heDistance, p.externalHeFactor);
    const wDelta: Record<string, number> = {};
    const aDelta: Record<string, number> = {};

    if (verdict.transforms) {
      for (const c of parts) {
        scale(c, attenuate(p.transform.gainOnSuccess, coef), "L2.transform", wDelta,
          { gainOnSuccess: p.transform.gainOnSuccess, coef });
        c.element = h.element;
        c.flags.push("TRANSFORMED");
      }
    } else {
      const f = contested ? p.transform.contentionFactor : p.transform.bindFactorOnFailure;
      for (const c of parts) {
        damp(c, f, aDelta);
        c.flags.push(contested ? "CONTESTED" : "BOUND");
      }
    }

    const score = scoreOf.get(h);
    events.push({
      kind: h.kind,
      outcome: verdict.transforms ? "transformed"
        : brokenHe.has(h) ? "broken"
        : contested ? "contested" : "bound",
      participants: parts.map((c) => c.id),
      pillars,
      ...(h.slots.length > 0 ? { branches: h.slots.map((s) => s.branch) } : {}),
      ...((h.stemSlots ?? []).length > 0 ? { stems: (h.stemSlots ?? []).map((s) => s.stem) } : {}),
      transformedTo: h.element,
      ...(score !== undefined ? { strengthScores: score } : {}),
      distanceCoef: coef,
      weightDelta: wDelta, activityDelta: aDelta,
      narrativeTag: verdict.transforms ? `合化${h.element}` : "合而不化",
      ...(verdict.transforms ? {} : { note: verdict.failedConditions.join("；") }),
    });
  }

  // ── 冲：强弱不对称 ──
  for (const cl of chongOnly) {
    const neutral = neutralizedChong.get(cl);
    if (neutral !== undefined) {
      const by = neutral.by.slots.map((s2) => s2.branch).join("");
      events.push({
        kind: "chong", outcome: "neutralized",
        participants: [], pillars: [(cl.a as BranchSlot).pillar, (cl.b as BranchSlot).pillar],
        branches: [(cl.a as BranchSlot).branch, (cl.b as BranchSlot).branch],
        strengthScores: { he: neutral.he, chong: neutral.chong },
        distanceCoef: 0, weightDelta: {},
        narrativeTag: "合解冲",
        note: `合力 ${neutral.he.toFixed(1)} 胜冲力 ${neutral.chong.toFixed(1)}（${by}${neutral.by.kind === "liuhe" ? "六合" : "合局"}），冲不成立`,
      });
      continue;
    }
    const a = cl.a as BranchSlot; const b = cl.b as BranchSlot;
    const wa = a.carriers.reduce((s, c) => s + c.weight, 0);
    const wb = b.carriers.reduce((s, c) => s + c.weight, 0);
    const ratio = Math.max(wa, wb) / Math.max(Math.min(wa, wb), 1e-9);
    const coefBase = chongDistanceCoef(a.pillar, b.pillar, p.chong.distance);
    const coef = mutualChong.has(cl) ? coefBase * p.arbitration.mutualDamageFactor : coefBase;

    let lossStrong: number; let lossWeak: number;
    if (ratio >= p.chong.uprootThreshold) { lossStrong = p.chong.strongLoss; lossWeak = p.chong.weakLossUproot; }
    else if (ratio >= p.chong.equalBandRatio) { lossStrong = p.chong.strongLoss; lossWeak = p.chong.weakLoss; }
    else { lossStrong = p.chong.equalLoss; lossWeak = p.chong.equalLoss; }

    const strongSide = wa >= wb ? a : b;
    const weakSide = wa >= wb ? b : a;
    const delta: Record<string, number> = {};
    for (const c of strongSide.carriers) scale(c, 1 - lossStrong * coef, "L2.chong.strong", delta, { loss: lossStrong, coef });
    for (const c of weakSide.carriers) scale(c, 1 - lossWeak * coef, "L2.chong.weak", delta, { loss: lossWeak, coef });

    events.push({
      kind: "chong", outcome: "applied",
      participants: [...a.carriers, ...b.carriers].map((c) => c.id),
      pillars: [a.pillar, b.pillar], branches: [a.branch, b.branch],
      distanceCoef: coef, weightDelta: delta,
      narrativeTag: ratio >= p.chong.uprootThreshold ? "冲而拔根" : "相冲",
      note: `强弱比 ${ratio.toFixed(2)}，${strongSide.branch}损 ${(lossStrong * coef * 100).toFixed(0)}%、${weakSide.branch}损 ${(lossWeak * coef * 100).toFixed(0)}%`,
    });
  }

  // ── 天干相冲：为虚，整体折半，且须相邻 ──
  for (const cl of clashes) {
    if (cl.kind !== "ganchong") continue;
    const a = cl.a as StemSlot; const b = cl.b as StemSlot;
    const coef = chongDistanceCoef(a.pillar, b.pillar, p.chong.distance) * p.ganchong.factor;
    if (p.ganchong.requireAdjacent && chongDistanceCoef(a.pillar, b.pillar, p.chong.distance) < p.chong.distance.adjacent) continue;
    const delta: Record<string, number> = {};
    for (const c of [a.carrier, b.carrier]) scale(c, 1 - p.chong.equalLoss * coef, "L2.ganchong", delta, { coef });
    events.push({
      kind: "ganchong", outcome: "applied",
      participants: [a.carrier.id, b.carrier.id],
      pillars: [a.pillar, b.pillar], stems: [a.stem, b.stem],
      distanceCoef: coef, weightDelta: delta, narrativeTag: "天干相冲",
    });
  }

  // ── 刑 ──
  for (const x of xings) {
    const factor = !x.complete ? p.xing.partialFactor
      : x.punishment === "自刑" ? p.xing.selfFactor
      : x.punishment === "无礼之刑" ? p.xing.ziMaoFactor
      : p.xing.fullFactor;
    const coef = heDistanceCoef(x.slots.map((s) => s.pillar), p.chong.distance, 1);
    const delta: Record<string, number> = {};
    for (const s of x.slots) for (const c of s.carriers) {
      scale(c, attenuate(factor, coef), "L2.xing", delta, { factor, coef });
    }
    events.push({
      kind: "xing", outcome: x.complete ? "applied" : "partial",
      participants: x.slots.flatMap((s) => s.carriers.map((c) => c.id)),
      pillars: x.slots.map((s) => s.pillar), branches: x.slots.map((s) => s.branch),
      distanceCoef: coef, weightDelta: delta,
      narrativeTag: x.punishment,
      ...(x.complete ? {} : { note: "只见两支，有刑意无刑局" }),
    });
  }

  // ── 害与破：数值影响刻意做得极小，价值在叙事与应期 ──
  for (const cl of clashes) {
    if (cl.kind !== "hai" && cl.kind !== "po") continue;
    if (cl.kind === "po" && !p.po.enabled) continue;
    const a = cl.a as BranchSlot; const b = cl.b as BranchSlot;
    const factor = cl.kind === "hai" ? p.hai.factor : p.po.factor;
    const coef = chongDistanceCoef(a.pillar, b.pillar, p.chong.distance);
    const delta: Record<string, number> = {};
    for (const c of [...a.carriers, ...b.carriers]) {
      scale(c, attenuate(factor, coef), `L2.${cl.kind}`, delta, { factor, coef });
    }
    events.push({
      kind: cl.kind, outcome: "applied",
      participants: [...a.carriers, ...b.carriers].map((c) => c.id),
      pillars: [a.pillar, b.pillar], branches: [a.branch, b.branch],
      distanceCoef: coef, weightDelta: delta,
      narrativeTag: cl.kind === "hai" ? "六害（穿）" : "六破",
    });
  }

  for (const c of carriers) {
    c.activity = Math.max(0, Math.min(1, c.activity));
    c.weight = Math.max(0, c.weight);
  }

  return { carriers, events };
}

/**
 * 按参数决定「察」还是「察 + 改」。
 *
 * 关掉改写时，仍在**一份拷贝**上跑完整的 `applyStructure` 来取事件，
 * 再把拷贝丢掉。这样做而不是另写一条只察不改的路径，是因为事件的产生
 * 并非全然独立于改写：合化是否成局要看墓库开闭之后的权重
 * （`apply.ts` 里比较 `wa`/`wb` 的那一处）。跑同一段代码，
 * 得到的事件才与开着改写时**逐条相同** —— 否则这个开关就成了两套断法。
 */
export function structureOf(
  carriers: readonly Carrier[], monthBranch: Branch, params: Params,
): StructureResult {
  if (params.structure.rewriteCarriers) {
    return applyStructure(carriers, monthBranch, params);
  }
  const probe = applyStructure(cloneCarriers(carriers), monthBranch, params);
  return { carriers, events: probe.events };
}

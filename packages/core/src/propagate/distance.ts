/**
 * L3 的距离模型 —— 与 L2 的不同，不可复用。
 *
 * L2 问的是「两个支离多远、冲得动吗」；L3 问的是「这个载体施力于那个载体，
 * 途中衰减多少」。后者需要区分同柱、同支内、跨层，还需要**方向不对称**。
 *
 * ## 外部层的不对称是本模型的立场
 *
 *   大运 → 本命 0.80    本命 → 大运 0.60
 *   流年 → 本命 0.70    本命 → 流年 0.50
 *
 * 环境作用于人强，人作用于环境弱。一个身强的人在坏流年里受损较小，
 * 但不会把坏流年变成好流年。
 */

import type { PropagationParams } from "../params/types.js";
import type { Carrier, PillarKind } from "../weights/carrier.js";

const NATAL_ORDER: Partial<Record<PillarKind, number>> = {
  year: 0, month: 1, day: 2, hour: 3, taiyuan: 1,
};

export function isNatalPillar(p: PillarKind): boolean {
  return NATAL_ORDER[p] !== undefined;
}

/** 载体 from 施力于载体 to 的距离系数。 */
export function propagationDistance(
  from: Carrier, to: Carrier, p: PropagationParams,
): number {
  const a = from.position;
  const b = to.position;
  const pa = a.pillar;
  const pb = b.pillar;

  const ia = NATAL_ORDER[pa];
  const ib = NATAL_ORDER[pb];

  // ── 外部层：查方向表，不走柱序 ──
  if (ia === undefined || ib === undefined) {
    const e = p.external;
    let base: number;
    if (pa === "luck" && pb === "annual") base = e.luckToAnnual;
    else if (pa === "annual" && pb === "luck") base = e.luckToAnnual;
    else if (pa === "luck") base = e.luckToNatal;
    else if (pa === "annual") base = e.annualToNatal;
    else if (pb === "luck") base = e.natalToLuck;
    else if (pb === "annual") base = e.natalToAnnual;
    else base = p.distance.adjacent;

    // 流年施于日主另加成 —— 太岁君临，直冲本人
    if (pa === "annual" && to.flags.includes("DAY_MASTER")) {
      base *= e.annualToDayMasterBonus;
    }
    return base;
  }

  // ── 本命层 ──
  if (pa === pb) {
    // 同柱：天干 ↔ 本柱藏干。通根与坐下之支的特殊重要性由此表达，L1 不再另加系数。
    if (a.layer !== b.layer) return p.distance.samePillar;
    // 同一地支内的藏干之间。巳中丙火克庚金是真实的 —— 庚在巳虽长生却受制，
    // 故不可设为 0；但同处一支、气机未分，也不该按满力计。
    if (a.layer === "branch") return p.distance.sameBranchHidden;
    return p.distance.samePillar;
  }

  const gap = Math.abs(ia - ib);
  const base = gap === 1 ? p.distance.adjacent
    : gap === 2 ? p.distance.gap1
    : p.distance.gap2;

  // 跨层（天干 ↔ 异柱地支）再打折：干支异层，需通根才能感应
  return a.layer === b.layer ? base : base * p.distance.crossLayerFactor;
}

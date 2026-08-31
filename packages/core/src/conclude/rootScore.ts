/**
 * 通根评分 —— 从格判定的必要条件之一。
 *
 * ⚠️ **本模块直接受流派开关影响**：
 *   changshengSchool（阳顺阴逆 / 阴阳同生同死）
 *   earthChangsheng（火土同宫 / 水土同宫）
 * 二者改变十二长生的排布，从而改变禄、刃、长生、墓的落点，
 * 进而改变通根分级与旺衰判定。结论会因此分叉，故随盘声明。
 */

import { HIDDEN_STEMS } from "../ganzhi/tables.js";
import { elementOf } from "../ganzhi/algebra.js";
import { rootKindOf, type ChangshengOptions } from "../ganzhi/changsheng.js";
import type { Branch, RootKind, Stem } from "../types/ganzhi.js";
import type { ConclusionParams } from "../params/types.js";
import type { Carrier } from "../weights/carrier.js";
import { propagationDistance } from "../propagate/distance.js";
import type { PropagationParams } from "../params/types.js";

export interface RootEntry {
  readonly branch: Branch;
  readonly kind: RootKind;
  readonly coef: number;
  readonly distance: number;
  readonly contribution: number;
}

export interface RootResult {
  readonly score: number;
  readonly detail: readonly RootEntry[];
  readonly rootless: boolean;
}

/**
 * 日主的通根评分。
 *
 * 同一支只取**最强**的一个根，不累加 —— 一个支给一份根，不因藏了两个同五行而翻倍。
 * 距离系数复用 L3 的模型：日支同柱最强（1.00），年支最远。
 */
export function rootScoreOf(
  dayMaster: Carrier,
  carriers: readonly Carrier[],
  cp: ConclusionParams,
  pp: PropagationParams,
): RootResult {
  const dmElement = elementOf(dayMaster.stem);
  const byBranch = new Map<string, { branch: Branch; carriers: Carrier[] }>();
  for (const c of carriers) {
    if (c.position.layer !== "branch" || c.hostBranch === null) continue;
    const key = `${c.position.pillar}.${c.hostBranch}`;
    const e = byBranch.get(key) ?? { branch: c.hostBranch, carriers: [] };
    e.carriers.push(c);
    byBranch.set(key, e);
  }

  const opts: ChangshengOptions = {
    school: cp.changshengSchool,
    earth: cp.earthChangsheng,
  };
  const coefOf: Record<RootKind, number> = {
    luRen: cp.rootCoef.luRen, changsheng: cp.rootCoef.changsheng,
    ku: cp.rootCoef.ku, yuqi: cp.rootCoef.yuqi, none: 0,
  };

  const detail: RootEntry[] = [];
  for (const { branch, carriers: hidden } of byBranch.values()) {
    const hasSame = HIDDEN_STEMS[branch].some((h: Stem) => elementOf(h) === dmElement);
    if (!hasSame) continue;
    const kind = rootKindOf(dayMaster.stem, branch, opts);
    if (kind === "none") continue;
    // 距离取该支任一藏干到日主的最近者
    const distance = Math.max(...hidden.map((h) => propagationDistance(h, dayMaster, pp)));
    const coef = coefOf[kind];
    detail.push({ branch, kind, coef, distance, contribution: coef * distance });
  }

  const score = detail.reduce((a, d) => a + d.contribution, 0);
  return { score, detail, rootless: score === 0 };
}

/**
 * 胎元与胎息。
 */
import { branchAt, branchIndex, mod, stepBranch, stepStem } from "../ganzhi/algebra.js";
import { STEM_COMBINATIONS } from "../ganzhi/tables.js";
import type { Branch, Pillar, Stem } from "../types/ganzhi.js";

/**
 * 胎元 —— 月干进一位、月支进三位。
 *
 * 例：月柱甲子 → 胎元乙卯；月柱丙寅 → 胎元丁巳。
 *
 * 胎元主先天禀赋与母体环境。默认**不参与**权重计算
 * （params.weights.includeTaiyuan = false），只作展示与神煞落点。
 */
export function taiyuanOf(monthPillar: Pillar): Pillar {
  return {
    stem: stepStem(monthPillar.stem, 1),
    branch: stepBranch(monthPillar.branch, 3),
  };
}

/** 与某天干相合者（天干五合，间隔 5 位）。 */
export function stemPartnerOf(stem: Stem): Stem {
  const pair = STEM_COMBINATIONS.find(([a, b]) => a === stem || b === stem);
  if (pair === undefined) throw new RangeError(`${stem} 无合`);
  return pair[0] === stem ? pair[1] : pair[0];
}

/**
 * 与某地支相合者（地支六合）。
 *
 * 六合二支的序号之和恒为 1（mod 12）—— 以子丑为轴的对称，
 * 故 partner(i) = 1 − i。此性质由 test/relations.spec.ts 断言。
 */
export function branchPartnerOf(branch: Branch): Branch {
  return branchAt(mod(1 - branchIndex(branch), 12));
}

/**
 * 胎息 —— 日干之合配日支之合。默认关闭（chart.includeTaiXi）。
 * 例：日柱甲子 → 胎息己丑（甲合己、子合丑）。
 */
export function taixiOf(dayPillar: Pillar): Pillar {
  return {
    stem: stemPartnerOf(dayPillar.stem),
    branch: branchPartnerOf(dayPillar.branch),
  };
}

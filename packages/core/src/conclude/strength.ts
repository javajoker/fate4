/**
 * 旺衰判定。
 *
 * ## 置信度不是装饰
 *
 * r 距最近阈值越远，判定越可靠。落在临界带内时，报告必须写明「接近临界，
 * 两种取用皆需参考」并给出另一档下的结论 —— 而不是把 0.4537 强行归档为「中和」
 * 然后据此选用神。**临界盘就是临界盘，不该被强行归类**，这是本系统与市面工具
 * 的主要区别之一。
 */

import type { ConclusionParams } from "../params/types.js";
import type { DerivationStep, StrengthBand, Verdict } from "./types.js";

export const BAND_LABEL: Readonly<Record<StrengthBand, string>> = Object.freeze({
  VERY_STRONG: "极旺", STRONG: "身旺", BALANCED: "中和", WEAK: "身弱", VERY_WEAK: "极弱",
});

export function bandOf(r: number, p: ConclusionParams): StrengthBand {
  const b = p.strengthBands;
  if (r >= b.veryStrong) return "VERY_STRONG";
  if (r >= b.strong) return "STRONG";
  if (r >= b.balancedLow) return "BALANCED";
  if (r >= b.weak) return "WEAK";
  return "VERY_WEAK";
}

/** 各档的边界值，用于求距离。 */
function edgesOf(p: ConclusionParams): number[] {
  const b = p.strengthBands;
  return [b.weak, b.balancedLow, b.strong, b.veryStrong];
}

export function confidenceOf(r: number, p: ConclusionParams): number {
  const d = Math.min(...edgesOf(p).map((e) => Math.abs(r - e)));
  return Math.max(p.confidence.floor, Math.min(1, d / p.confidence.bandMargin));
}

export function strengthVerdict(
  r: number, supporting: number, opposing: number, p: ConclusionParams,
): Verdict<StrengthBand> {
  const value = bandOf(r, p);
  const confidence = confidenceOf(r, p);
  const edges = edgesOf(p);
  const nearest = edges.reduce((a, e) => (Math.abs(r - e) < Math.abs(r - a) ? e : a), edges[0]!);
  const distance = Math.abs(r - nearest);

  const derivation: DerivationStep[] = [
    { step: "党势", detail: `同党 ${supporting.toFixed(2)}，异党 ${opposing.toFixed(2)}`,
      values: { supporting, opposing } },
    { step: "比值", detail: `r = 同党 / 总量 = ${r.toFixed(4)}`, values: { r } },
    // detail 是给人看的散文，values 是给机器看的。
    // 枚举标识放 values，不放 detail —— 否则中文报告里会漏出一截英文。
    { step: "分档", detail: `落入 ${BAND_LABEL[value]}`,
      values: { band: value,
        veryStrong: p.strengthBands.veryStrong, strong: p.strengthBands.strong,
        balancedLow: p.strengthBands.balancedLow, weak: p.strengthBands.weak } },
    { step: "置信", detail: `距最近阈值 ${nearest} 有 ${distance.toFixed(4)}，置信度 ${confidence.toFixed(2)}`,
      values: { nearest, distance, confidence } },
  ];

  // 低置信度必须给出替代判定 —— 否则报告无法如实呈现临界状态
  const alternatives: { value: StrengthBand; reason: string }[] = [];
  if (confidence < 0.5) {
    const other = r >= nearest
      ? bandOf(nearest - p.confidence.bandMargin, p)
      : bandOf(nearest + p.confidence.bandMargin, p);
    if (other !== value) {
      alternatives.push({
        value: other,
        reason: `r = ${r.toFixed(4)} 距阈值 ${nearest} 仅 ${distance.toFixed(4)}，`
          + `略作取舍即判为${BAND_LABEL[other]}。此盘属临界格局，两种取法各有依据。`,
      });
    }
  }

  return { value, confidence, derivation, alternatives };
}

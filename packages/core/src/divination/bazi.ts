/**
 * 四柱流日 → 跨体系结构断言。
 *
 * 自 `liuyao/daily.ts` 提出来，好让四家合参与两家合参共用同一份四柱侧断言 ——
 * 否则两处会各写一份，而它们迟早会不一样。
 */

import type { BaseChart } from "../chart/baseChart.js";
import type { DayView } from "../temporal/types.js";
import { branchElement, elementOf } from "../ganzhi/algebra.js";
import type { StructuralClaim } from "./claim.js";

export function baziDayClaims(base: BaseChart, dv: DayView): StructuralClaim[] {
  const y = base.conclusions.yongshen.value;
  const fav = new Set([y.primary, ...y.xishen]);
  const adv = new Set([...y.jishen, ...y.choushen]);
  const dayEls = [elementOf(dv.pillar.stem), branchElement(dv.pillar.branch)];
  const favN = dayEls.filter((e) => fav.has(e)).length;
  const advN = dayEls.filter((e) => adv.has(e)).length;

  const out: StructuralClaim[] = [{
    system: "bazi", axis: "我方位置",
    polarity: favN > advN ? "顺" : advN > favN ? "逆" : "中性",
    evidence: `流日 ${dv.pillar.stem}${dv.pillar.branch}，干支五行为 ${dayEls.join("、")}；`
      + `本命取用为 ${y.primary}（喜 ${y.xishen.join("")}、忌 ${y.jishen.join("")}）`,
    confidence: base.conclusions.yongshen.confidence,
  }];

  const notable = dv.conflicts.filter((c) => c.severity === "notable");
  out.push({
    system: "bazi", axis: "阻碍来源",
    polarity: notable.length > 0 ? "逆" : "中性",
    evidence: notable.length > 0
      ? notable.map((c) => `${c.kind}：${c.involvedElements.join("与")}`
        + `${c.affectedPalace === null ? "" : `，涉 ${c.affectedPalace}`}`).join("；")
      : "流日与本命四柱之间无显著的冲克",
    confidence: 0.7,
  });

  const stir = dv.conflicts.length + dv.harmonies.length;
  out.push({
    system: "bazi", axis: "事之动静",
    polarity: "中性",
    evidence: stir === 0
      ? "流日与本命无合冲刑害，事象层面安静"
      : `流日引动 ${stir} 处：冲克 ${dv.conflicts.length}、合会 ${dv.harmonies.length}`,
    confidence: 0.75,
  });
  return out;
}

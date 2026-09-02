/**
 * 六爻 → 跨体系结构断言。
 *
 * 自 `daily.ts` 提出来，好让四家合参与两家合参共用同一份 —— 否则两处会各写一份，
 * 而它们迟早会不一样。这与 `divination/bazi.ts` 是同一条理由。
 *
 * ## 我方取用神，不取世爻
 *
 * 初版一律取世爻，于是 `--topic` 换了个占事，六爻这一侧的断言纹丝不动 ——
 * 「问求财」与「问求职」得出同一句话。那不是简化，是把六爻最要紧的一步
 * （取用神）整个丢了。
 *
 * 现在按占事取：世应类的占事（近期运势、谋望）用神本就是世爻，
 * 六亲类的占事用神是那一爻。用神伏藏时**判中性并写明** ——
 * 伏藏是「结构上找不到对应位置」，不是「不利」。
 */

import type { Params } from "../params/types.js";
import type { StructuralClaim } from "../divination/claim.js";
import type { DressedGua } from "./dress.js";
import type { Judgement } from "./judge.js";
import { strengthOf } from "./strength.js";

export function liuyaoClaims(
  gua: DressedGua, j: Judgement, params: Params,
): StructuralClaim[] {
  const ys = j.yongshen;
  const yao = ys.yao;
  const topic = ys.topic.label;

  // ── 我方位置：用神力量 ──
  if (yao === null) {
    // 伏藏 —— 判中性。它是「找不到位置」，不是「不利」
    const claims: StructuralClaim[] = [{
      system: "liuyao", axis: "我方位置",
      polarity: "中性",
      evidence: `占「${topic}」，用神${ys.fu === null ? "不上卦且本宫亦无"
        : `${ys.fu.liuqin}${ys.fu.branch}不上卦，伏于第${ys.fu.pos}爻${ys.fu.feiLiuqin}之下`}`
        + " —— 结构上找不到对应位置，不作强弱之判",
      confidence: 0.5,
    }, {
      system: "liuyao", axis: "阻碍来源",
      polarity: "中性",
      evidence: "用神伏藏，无从论其受克",
      confidence: 0.5,
    }];
    claims.push(dynamicsClaim(gua));
    return claims;
  }

  const st = strengthOf(gua, yao, params.liuyao);
  const out: StructuralClaim[] = [{
    system: "liuyao", axis: "我方位置",
    polarity: st.value.band === "有力" || st.value.band === "偏有力" ? "顺"
      : st.value.band === "无力" || st.value.band === "偏无力" ? "逆" : "中性",
    evidence: `占「${topic}」，用神${yao.liuqin}${yao.branch}在第${yao.pos}爻`
      + `${yao.pos === gua.shi ? "（持世）" : ""}，力量为${st.value.band}，`
      + `判据为「${st.value.rung}」`,
    confidence: st.confidence,
  }];

  // ── 阻碍来源：动爻（含暗动）克用神者 ──
  const attackers = gua.yaos.filter(
    (o) => (o.moving || o.chongState === "暗动") && o.pos !== yao.pos
      && st.value.fromDong.some((d) => d.from.pos === o.pos && d.kind === "克"));
  out.push({
    system: "liuyao", axis: "阻碍来源",
    polarity: attackers.length > 0 ? "逆" : "中性",
    evidence: attackers.length > 0
      ? attackers.map((o) => `第${o.pos}爻${o.liuqin}${o.branch}${
        o.moving ? "发动" : "暗动"}克用神`).join("；")
      : "卦中无动爻克用神",
    confidence: 0.75,
  });

  out.push(dynamicsClaim(gua));
  return out;
}

function dynamicsClaim(gua: DressedGua): StructuralClaim {
  const dong = gua.yaos.filter((o) => o.moving).length;
  return {
    system: "liuyao", axis: "事之动静",
    polarity: "中性",
    evidence: dong === 0
      ? `${gua.ben.name}，六爻皆静，传统视为事在酝酿`
      : `${gua.ben.name} → ${gua.bian!.name}，${dong} 爻发动`
        + (gua.flags.length > 0 ? `，${gua.flags.join("、")}` : ""),
    confidence: 0.85,
  };
}

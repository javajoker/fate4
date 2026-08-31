/**
 * 月令取格（子平格局法）。
 *
 * 格局与用神是**两条独立的判定线**，可能给出不同的取用建议。
 * 本系统同时输出二者，并在不一致时于报告中并列，不做强行统一 ——
 * 子平格局法与旺衰扶抑法本就是两个流派，人为调和只会产出两边都不认的结论。
 */

import { HIDDEN_STEMS } from "../ganzhi/tables.js";
import { elementOf, polarityOf } from "../ganzhi/algebra.js";
import type { Branch, TenGod } from "../types/ganzhi.js";
import type { Carrier } from "../weights/carrier.js";
import { tenGodOf } from "./tenGods.js";
import type { DerivationStep, Geju, GejuName, Verdict } from "./types.js";

/** 四吉神顺用（生之护之），四凶神逆用（制之化之）。 */
const AUSPICIOUS: readonly TenGod[] = Object.freeze(["正官", "正财", "偏财", "正印", "食神"]);

const GEJU_OF_GOD: Readonly<Record<TenGod, GejuName | null>> = Object.freeze({
  正官: "正官格", 七杀: "七杀格", 正财: "正财格", 偏财: "偏财格",
  正印: "正印格", 偏印: "偏印格", 食神: "食神格", 伤官: "伤官格",
  比肩: null, 劫财: null,   // 建禄 / 月刃，另行处理
});

const XIANGSHEN: Readonly<Record<GejuName, { xiang: TenGod[]; break: TenGod[] }>> = Object.freeze({
  正官格: { xiang: ["正财", "偏财", "正印"], break: ["伤官", "七杀"] },
  七杀格: { xiang: ["食神", "正印", "偏印"], break: ["正财", "偏财"] },
  正财格: { xiang: ["食神", "伤官", "比肩"], break: ["劫财"] },
  偏财格: { xiang: ["食神", "伤官"], break: ["劫财", "比肩"] },
  正印格: { xiang: ["正官", "七杀"], break: ["正财", "偏财"] },
  偏印格: { xiang: ["七杀"], break: ["正财", "偏财"] },
  食神格: { xiang: ["正财", "偏财"], break: ["偏印"] },
  伤官格: { xiang: ["正印", "正财", "偏财"], break: ["正官"] },
  建禄格: { xiang: ["正官", "七杀", "正财", "偏财"], break: ["劫财"] },
  月刃格: { xiang: ["七杀", "正官"], break: ["正财", "偏财"] },
  月劫格: { xiang: ["正官", "七杀"], break: ["正财", "偏财"] },
});

export interface GejuInput {
  readonly monthBranch: Branch;
  readonly dayMaster: Carrier;
  /** 年、月、时三处的天干 —— 日干即日主本身，不算「透」。 */
  readonly revealedStems: readonly Carrier[];
}

export function gejuVerdict(input: GejuInput): Verdict<Geju> {
  const { monthBranch, dayMaster, revealedStems } = input;
  const hidden = HIDDEN_STEMS[monthBranch];
  const derivation: DerivationStep[] = [];

  const godOfHidden = (i: number): TenGod => {
    const h = hidden[i]!;
    return tenGodOf(dayMaster.element, dayMaster.polarity, elementOf(h), polarityOf(h));
  };

  // 依次查本气、中气、余气是否透干
  const labels = ["benqiRevealed", "zhongqiRevealed", "yuqiRevealed"] as const;
  const names = ["本气", "中气", "余气"];
  let god: TenGod | null = null;
  let source: Geju["source"] = "notRevealed";

  for (let i = 0; i < hidden.length; i++) {
    if (revealedStems.some((c) => c.stem === hidden[i]!)) {
      god = godOfHidden(i);
      source = labels[i]!;
      derivation.push({ step: "取格", detail: `月支${monthBranch}的${names[i]} ${hidden[i]} 透干，以${god}定格` });
      break;
    }
  }
  if (god === null) {
    god = godOfHidden(0);
    source = "notRevealed";
    derivation.push({ step: "取格", detail: `月支${monthBranch}藏干皆不透，取本气 ${hidden[0]} 的十神${god}定格` });
  }

  let name: GejuName;
  if (god === "比肩") {
    name = "建禄格";
    derivation.push({ step: "禄刃", detail: "所定十神为比肩，作建禄格" });
  } else if (god === "劫财") {
    name = dayMaster.polarity === "阳" ? "月刃格" : "月劫格";
    derivation.push({ step: "禄刃", detail: `所定十神为劫财，日主${dayMaster.polarity}干，作${name}` });
  } else {
    name = GEJU_OF_GOD[god]!;
  }

  const isAuspicious = AUSPICIOUS.includes(god);
  const rel = XIANGSHEN[name];

  derivation.push({
    step: "顺逆", detail: isAuspicious
      ? `${god}属四吉神，顺用 —— 生之护之`
      : `${god}属四凶神，逆用 —— 制之化之`,
  });

  return {
    value: {
      name, god, source, isAuspicious,
      usage: isAuspicious ? "顺用" : "逆用",
      xiangshen: rel.xiang, breakers: rel.break,
    },
    confidence: source === "notRevealed" ? 0.65 : 0.85,
    derivation,
    alternatives: [],
  };
}

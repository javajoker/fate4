/**
 * L4 总装 —— 权重翻译为命理判定。
 *
 * 这是最后一个确定性层：全是阈值与查表，无自由发挥。
 * 叙述生成在 L6，不在这里。
 *
 * 每个判定产出 Verdict，带 value / confidence / derivation / alternatives。
 * **低置信度必须给出 alternatives** —— 临界盘就是临界盘，不该被强行归类。
 */

import { ELEMENTS, type Element } from "../types/ganzhi.js";
import type { Branch } from "../types/ganzhi.js";
import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import type { Carrier } from "../weights/carrier.js";
import type { FlowRecord } from "../propagate/iterate.js";
import { tenGodVector } from "./tenGods.js";
import { rootScoreOf } from "./rootScore.js";
import { strengthVerdict } from "./strength.js";
import { specialPatternVerdict } from "./specialPattern.js";
import { yongshenVerdict } from "./yongshen.js";
import { gejuVerdict } from "./geju.js";
import { kinReadings } from "./kin.js";
import { flowMetrics, keDamageMatrix } from "./metrics.js";
import type { Conclusions } from "./types.js";

export interface ConcludeInput {
  readonly carriers: readonly Carrier[];
  readonly monthBranch: Branch;
  readonly gender: "male" | "female";
  readonly vitality: number;
  readonly flows: readonly FlowRecord[];
  readonly params?: Params;
}

export function conclude(input: ConcludeInput): Conclusions {
  const params = input.params ?? DEFAULT_PARAMS;
  const cp = params.conclusion;
  const { carriers, monthBranch, gender } = input;

  const dayMaster = carriers.find((c) => c.flags.includes("DAY_MASTER"));
  if (dayMaster === undefined) throw new Error("载体集合中找不到日主 —— L1 未正确标记");

  const tg = tenGodVector(carriers, dayMaster);
  const root = rootScoreOf(dayMaster, carriers, cp, params.propagation);

  const byElement = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  for (const c of carriers) byElement[c.element] += c.weight;

  const strength = strengthVerdict(tg.ratio, tg.supporting, tg.opposing, cp);

  const specialPattern = specialPatternVerdict({
    ratio: tg.ratio, rootScore: root.score, tenGods: tg.vector,
    dayMaster, monthBranch, carriers,
  }, cp);

  // 克流量矩阵 —— 病药法的门槛判在流量上，不在权重上。人格层也用同一份。
  const keDamage = keDamageMatrix(carriers, input.flows);

  const yongshen = yongshenVerdict({
    dayMasterElement: dayMaster.element, monthBranch, byElement,
    tenGods: tg.vector, strength: strength.value, special: specialPattern.value,
    keDamage,
  }, cp);

  // 定格只看年、月、时三处天干 —— 日干即日主本身，不算「透」
  const revealedStems = carriers.filter(
    (c) => c.position.layer === "stem" && c.position.pillar !== "day"
      && (["year", "month", "hour"] as const).includes(c.position.pillar as never));
  const geju = gejuVerdict({ monthBranch, dayMaster, revealedStems });

  const kin = kinReadings(carriers, dayMaster, gender, cp);
  const metrics = flowMetrics(input.vitality, input.flows, byElement);

  return {
    dayMaster: {
      stem: dayMaster.stem, element: dayMaster.element,
      polarity: dayMaster.polarity, weight: tg.dayMasterWeight,
    },
    tenGods: tg.vector,
    party: { supporting: tg.supporting, opposing: tg.opposing, ratio: tg.ratio },
    rootScore: root.score,
    rootDetail: root.detail.map((d) => ({
      branch: d.branch, kind: d.kind, contribution: d.contribution,
    })),
    strength, specialPattern, yongshen, geju, kin, metrics,
    schoolsUsed: {
      changshengSchool: cp.changshengSchool,
      earthChangsheng: cp.earthChangsheng,
      tiaohouSource: cp.yongshen.tiaohou.source,
      femaleChildStarVariant: cp.femaleChildStarVariant,
    },
  };
}

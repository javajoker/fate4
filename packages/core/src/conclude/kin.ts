/**
 * 宫位与六亲 —— **宫星同参**。
 *
 * 只看星不看宫，或只看宫不看星，都是残缺的读法。
 * 引擎两者都算，报告两者都列。
 */

import type { TenGod } from "../types/ganzhi.js";
import type { ConclusionParams } from "../params/types.js";
import type { Carrier, PillarKind } from "../weights/carrier.js";
import { tenGodOf } from "./tenGods.js";
import type { KinName, KinReading, Quadrant } from "./types.js";

interface KinSpec {
  readonly kin: KinName;
  readonly label: string;
  readonly male: TenGod;
  readonly female: TenGod;
  readonly palace: { readonly pillar: PillarKind; readonly layer: "stem" | "branch" };
  readonly palaceLabel: string;
}

const SPECS: readonly KinSpec[] = Object.freeze([
  { kin: "father", label: "父", male: "偏财", female: "偏财",
    palace: { pillar: "month", layer: "stem" }, palaceLabel: "月干（父/兄弟宫）" },
  { kin: "mother", label: "母", male: "正印", female: "正印",
    palace: { pillar: "month", layer: "branch" }, palaceLabel: "月支（母/门户宫）" },
  { kin: "spouse", label: "配偶", male: "正财", female: "正官",
    palace: { pillar: "day", layer: "branch" }, palaceLabel: "日支（配偶宫）" },
  { kin: "siblings", label: "兄弟姐妹", male: "比肩", female: "比肩",
    palace: { pillar: "month", layer: "branch" }, palaceLabel: "月支（门户宫）" },
  { kin: "children", label: "子女", male: "七杀", female: "食神",
    palace: { pillar: "hour", layer: "branch" }, palaceLabel: "时支（子女宫）" },
]);

export function kinReadings(
  carriers: readonly Carrier[],
  dayMaster: Carrier,
  gender: "male" | "female",
  p: ConclusionParams,
): KinReading[] {
  const total = carriers.reduce((a, c) => a + c.weight, 0);
  const mean = carriers.length > 0 ? total / carriers.length : 0;

  return SPECS.map((spec) => {
    let starGod = gender === "male" ? spec.male : spec.female;
    // ⚠️ 女命子女星的男女分配存在反向记载，报告中不强调男女之别
    if (spec.kin === "children" && gender === "female"
        && p.femaleChildStarVariant === "reversed") {
      starGod = "伤官";
    }
    const starCarriers = carriers.filter(
      (c) => c.id !== dayMaster.id
        && tenGodOf(dayMaster.element, dayMaster.polarity, c.element, c.polarity) === starGod);
    const starWeight = starCarriers.reduce((a, c) => a + c.weight, 0);
    const starFlags = [...new Set(starCarriers.flatMap((c) => c.flags))];

    const palaceCarriers = carriers.filter(
      (c) => c.position.pillar === spec.palace.pillar && c.position.layer === spec.palace.layer);
    const palaceWeight = palaceCarriers.reduce((a, c) => a + c.weight, 0);
    const palaceFlags = [...new Set(palaceCarriers.flatMap((c) => c.flags))];
    const palaceBranch = palaceCarriers[0]?.hostBranch ?? null;

    const starStrong = starWeight >= mean;
    const palaceOk = palaceWeight >= mean
      && !palaceFlags.some((f) => f === "TOMB_SEALED" || f === "BOUND" || f === "CONTESTED");

    const quadrant: Quadrant =
      starStrong && palaceOk ? "both-favorable"
      : palaceOk ? "palace-only"
      : starStrong ? "star-only"
      : "neither";

    // 星或宫任一为零时，判定不可靠
    const confidence = starWeight === 0 || palaceWeight === 0 ? 0.4
      : Math.min(1, 0.5 + Math.min(starWeight, palaceWeight) / (mean * 2));

    return {
      kin: spec.kin, label: spec.label, starGod, starWeight, starFlags,
      palace: spec.palace, palaceLabel: spec.palaceLabel,
      palaceWeight, palaceBranch, palaceFlags, quadrant, confidence,
    };
  });
}

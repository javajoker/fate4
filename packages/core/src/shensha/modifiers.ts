/**
 * 神煞的状态修饰。
 *
 * 同一个神煞，落在不同状态的支上，语义相反：
 * 吉神被冲则受损，凶神被冲反而动而应事；吉神落空大打折扣，凶神落空反得解。
 *
 * **这一层必须计算，否则神煞只是一堆标签。**
 *
 * 注意方向：力量影响神煞的解读强度（坐旺/坐衰），
 * **神煞不反过来影响力量** —— 这是 L2/L3 与符号层之间唯一的单向输出，不可逆转。
 */

import type { StructureEvent } from "../structure/types.js";
import type { Carrier, PillarKind } from "../weights/carrier.js";
import type { ShenshaParams } from "../params/types.js";

export type ShenshaModifier =
  | "逢冲" | "逢合" | "逢刑" | "落空亡" | "坐旺" | "坐衰" | "重见";

export interface ModifierContext {
  readonly events: readonly StructureEvent[];
  readonly carriers: readonly Carrier[];
  readonly kongwang: readonly string[];
  /** 同一神煞出现的次数。 */
  readonly occurrences: number;
}

export function modifiersFor(
  pillar: PillarKind,
  layer: "stem" | "branch",
  branch: string | null,
  ctx: ModifierContext,
  p: ShenshaParams,
): { modifiers: ShenshaModifier[]; hostWeight: number } {
  const mods: ShenshaModifier[] = [];

  const hostCarriers = ctx.carriers.filter(
    (c) => c.position.pillar === pillar && c.position.layer === layer);
  const hostWeight = hostCarriers.reduce((a, c) => a + c.weight, 0);

  const hit = (kinds: readonly string[]) => ctx.events.some(
    (e) => kinds.includes(e.kind) && e.outcome !== "neutralized" && e.pillars.includes(pillar));

  if (hit(["chong", "ganchong"])) mods.push("逢冲");
  if (hit(["liuhe", "ganhe", "sanhe", "sanhui", "banhe"])) mods.push("逢合");
  if (hit(["xing"])) mods.push("逢刑");
  if (branch !== null && ctx.kongwang.includes(branch)) mods.push("落空亡");

  const total = ctx.carriers.reduce((a, c) => a + c.weight, 0);
  const pillars = new Set(ctx.carriers.map((c) => c.position.pillar));
  const mean = pillars.size > 0 ? total / (pillars.size * 2) : 0;
  if (mean > 0) {
    if (hostWeight >= mean * p.modifiers.zuowangThreshold) mods.push("坐旺");
    else if (hostWeight <= mean * p.modifiers.zuoshuaiThreshold) mods.push("坐衰");
  }

  if (ctx.occurrences > 1) mods.push("重见");
  return { modifiers: mods, hostWeight };
}

/**
 * 修饰后的实际语义方向。
 *
 * 吉神被冲/落空 → 打折；凶神被冲 → 由静转动（应事，未必是坏事）；
 * 凶神落空 → 反解。
 */
export function effectiveTone(
  polarity: "auspicious" | "inauspicious" | "neutral",
  mods: readonly ShenshaModifier[],
): { tone: "strengthened" | "weakened" | "activated" | "neutralized"; why: string } {
  const void_ = mods.includes("落空亡");
  const chong = mods.includes("逢冲");
  const he = mods.includes("逢合");
  const wang = mods.includes("坐旺");

  if (polarity === "auspicious") {
    if (void_) return { tone: "neutralized", why: "吉神落空亡，大打折扣" };
    if (chong) return { tone: "weakened", why: "吉神逢冲受损" };
    if (he) return { tone: "weakened", why: "吉神被合住，其力不发" };
    if (wang) return { tone: "strengthened", why: "坐旺，力量增强" };
    return { tone: "strengthened", why: "常态" };
  }
  if (polarity === "inauspicious") {
    if (void_) return { tone: "neutralized", why: "凶神落空亡，反得其解" };
    if (he) return { tone: "weakened", why: "凶神被合住，其性受制" };
    if (chong) return { tone: "activated", why: "凶神逢冲而动，主应事" };
    if (wang) return { tone: "strengthened", why: "坐旺，力量增强" };
    return { tone: "weakened", why: "常态" };
  }
  // 中性神煞：冲则动、合则牵，本身不论吉凶
  if (chong) return { tone: "activated", why: "逢冲而动" };
  if (he) return { tone: "activated", why: "逢合而牵动" };
  if (void_) return { tone: "neutralized", why: "落空亡" };
  return { tone: wang ? "strengthened" : "weakened", why: wang ? "坐旺" : "常态" };
}

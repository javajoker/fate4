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
import type { Carrier } from "../weights/carrier.js";
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

/** 作用于天干层的结构事件。其余一律作用于地支层。 */
const STEM_KINDS: ReadonlySet<string> = new Set(["ganhe", "ganchong"]);

/**
 * 某结构事件是否真的打到了这个神煞所在的位置。
 *
 * **必须落到「层」与「字」，不能只落到「柱」。**
 * 原先只判 `e.pillars.includes(pillar)`：于是年干的一个天干五合，
 * 会把坐在**年支**上的每一个神煞都标成「逢合」—— 而天干合根本没碰到地支。
 * 实测后果：天乙贵人出现 360 次，其中 299 次被标为逢合、272 次逢刑。
 * 修饰一旦近乎恒真，它就不再是修饰；且因 effectiveTone 先判合后判冲，
 * 虚假的「逢合」会把真正的「逢冲」整个盖掉，令四条应期规则永不触发。
 */
export function eventTouches(
  e: StructureEvent, pillar: string, layer: "stem" | "branch",
  stem: string | null, branch: string | null,
): boolean {
  if (e.outcome === "neutralized") return false;
  if (!(e.pillars as readonly string[]).includes(pillar)) return false;
  // 层不符即无关：天干的合冲不动地支，反之亦然
  if (STEM_KINDS.has(e.kind) !== (layer === "stem")) return false;
  if (layer === "branch") {
    return branch !== null && (e.branches === undefined || e.branches.includes(branch as never));
  }
  return stem !== null && (e.stems === undefined || e.stems.includes(stem as never));
}

export function modifiersFor(
  // 宽到 string 是为了容纳命宫：它没有载体、也不出现在任何结构事件里，
  // 于是 hostWeight 为 0、除落空亡外无修饰 —— 正是命宫应有的行为。
  pillar: string,
  layer: "stem" | "branch",
  branch: string | null,
  ctx: ModifierContext,
  p: ShenshaParams,
  stem: string | null = null,
): { modifiers: ShenshaModifier[]; hostWeight: number } {
  const mods: ShenshaModifier[] = [];

  const hostCarriers = ctx.carriers.filter(
    (c) => (c.position.pillar as string) === pillar && c.position.layer === layer);
  const hostWeight = hostCarriers.reduce((a, c) => a + c.weight, 0);

  const hit = (kinds: readonly string[]) => ctx.events.some(
    (e) => kinds.includes(e.kind) && eventTouches(e, pillar, layer, stem, branch));

  if (hit(["chong", "ganchong"])) mods.push("逢冲");
  if (hit(["liuhe", "ganhe", "sanhe", "sanhui", "banhe"])) mods.push("逢合");
  if (hit(["xing"])) mods.push("逢刑");
  if (branch !== null && ctx.kongwang.includes(branch)) mods.push("落空亡");

  const total = ctx.carriers.reduce((a, c) => a + c.weight, 0);
  const pillars = new Set(ctx.carriers.map((c) => c.position.pillar));
  const mean = pillars.size > 0 ? total / (pillars.size * 2) : 0;
  // 宿主没有载体（命宫、未计入配重的胎元）时不论坐旺坐衰 ——
  // 权重为 0 会被判成「坐衰」，而那不是衰，是压根不参与力量层。
  if (mean > 0 && hostCarriers.length > 0) {
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
export interface ToneResult {
  readonly tone: "strengthened" | "weakened" | "activated" | "neutralized";
  readonly why: string;
  /**
   * 无任何修饰命中，`tone` 取的是该吉凶倾向的**缺省值**。
   *
   * 缺省不是结论。吉神的缺省是 strengthened，若照 tone 直接渲染，
   * 报告里会冒出「天乙贵人落命宫，状态为坐旺得势：常态」——
   * 一句既无信息又自相矛盾的话。叙述层据此跳过它们。
   */
  readonly fromDefault: boolean;
}

export function effectiveTone(
  polarity: "auspicious" | "inauspicious" | "neutral",
  mods: readonly ShenshaModifier[],
): ToneResult {
  const void_ = mods.includes("落空亡");
  const chong = mods.includes("逢冲");
  const he = mods.includes("逢合");
  const wang = mods.includes("坐旺");
  const D = { fromDefault: false } as const;

  if (polarity === "auspicious") {
    if (void_) return { tone: "neutralized", why: "吉神落空亡，大打折扣", ...D };
    if (chong) return { tone: "weakened", why: "吉神逢冲受损", ...D };
    if (he) return { tone: "weakened", why: "吉神被合住，其力不发", ...D };
    if (wang) return { tone: "strengthened", why: "坐旺，力量增强", ...D };
    return { tone: "strengthened", why: "常态", fromDefault: true };
  }
  if (polarity === "inauspicious") {
    if (void_) return { tone: "neutralized", why: "凶神落空亡，反得其解", ...D };
    if (he) return { tone: "weakened", why: "凶神被合住，其性受制", ...D };
    if (chong) return { tone: "activated", why: "凶神逢冲而动，主应事", ...D };
    if (wang) return { tone: "strengthened", why: "坐旺，力量增强", ...D };
    return { tone: "weakened", why: "常态", fromDefault: true };
  }
  // 中性神煞：冲则动、合则牵，本身不论吉凶
  if (chong) return { tone: "activated", why: "逢冲而动", ...D };
  if (he) return { tone: "activated", why: "逢合而牵动", ...D };
  if (void_) return { tone: "neutralized", why: "落空亡", ...D };
  if (wang) return { tone: "strengthened", why: "坐旺", ...D };
  return { tone: "weakened", why: "常态", fromDefault: true };
}

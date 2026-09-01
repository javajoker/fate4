/** 规则谓词的公共判据。 */

import { stepBranch, controls, elementOf } from "../ganzhi/algebra.js";
import type { Branch, Element, Pillar, TenGod } from "../types/ganzhi.js";
import type { StructureEvent } from "../structure/types.js";
import type { PillarKind } from "../weights/carrier.js";
import type { YingqiContext } from "./types.js";

/** 与 shensha/rules 的 chongOf 同义；此处独立导出以免跨层依赖。 */
export const opposingBranch = (b: Branch): Branch => stepBranch(b, 6);

/** 天克地冲：干克且支冲。 */
export function tianKeDiChong(a: Pillar, b: Pillar): boolean {
  return controls(elementOf(a.stem), elementOf(b.stem)) && opposingBranch(a.branch) === b.branch;
}

export function samePillar(a: Pillar | null, b: Pillar | null): boolean {
  return a !== null && b !== null && a.stem === b.stem && a.branch === b.branch;
}

/** 某类结构事件是否命中指定柱。 */
export function eventHits(
  events: readonly StructureEvent[], kinds: readonly string[], pillars: readonly PillarKind[],
): StructureEvent | undefined {
  return events.find(
    (e) => kinds.includes(e.kind) && e.outcome !== "neutralized"
      && pillars.some((p) => e.pillars.includes(p)));
}

/** 流年（或大运）之支所冲的本命柱。 */
export function chongTargets(ctx: YingqiContext, from: Pillar | null): PillarKind[] {
  if (from === null) return [];
  const target = opposingBranch(from.branch);
  const out: PillarKind[] = [];
  for (const [k, p] of [["year", ctx.chart.year], ["month", ctx.chart.month],
    ["day", ctx.chart.day], ["hour", ctx.chart.hour]] as const) {
    if (p !== null && p.branch === target) out.push(k);
  }
  return out;
}

/** 用神/忌神的五行集合。 */
export function favorableElements(ctx: YingqiContext): Element[] {
  const y = ctx.natal.conclusions.yongshen.value;
  return [y.primary, ...y.xishen];
}
export function adverseElements(ctx: YingqiContext): Element[] {
  const y = ctx.natal.conclusions.yongshen.value;
  return [...y.jishen, ...y.choushen];
}

/** 某十神的当前总权重。 */
export function godWeight(ctx: YingqiContext, god: TenGod): number {
  return ctx.now.conclusions.tenGods[god];
}

/** 神煞是否命中且带指定修饰。 */
export function shenshaWith(
  ctx: YingqiContext, name: string, modifier: string,
): boolean {
  return ctx.now.shensha.some((h) => h.name === name && h.modifiers.includes(modifier as never));
}

/** 用神所居之支（该五行权重最大的那个支）。 */
export function elementHomeBranches(ctx: YingqiContext, el: Element): Branch[] {
  const out = new Set<Branch>();
  for (const c of ctx.now.carriers) {
    if (c.element === el && c.hostBranch !== null) out.add(c.hostBranch);
  }
  return [...out];
}

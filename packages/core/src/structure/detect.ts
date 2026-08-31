/**
 * 结构检测 —— 纯函数，只找出候选，不改任何权重。
 *
 * 检测与施加严格分离：候选找齐后才做争夺裁决与互解，
 * 边找边改会让结果依赖遍历顺序。
 */

import {
  BRANCH_CLASHES, BRANCH_DESTRUCTIONS, BRANCH_HARMS, BRANCH_SIX_COMBINATIONS,
  DIRECTIONALS, PUNISHMENTS, STEM_CLASHES, STEM_COMBINATIONS, TRINITIES,
  type PunishmentKind,
} from "../ganzhi/tables.js";
import type { Branch, Element, Stem } from "../types/ganzhi.js";
import type { BranchSlot, StemSlot } from "./types.js";

export type BanheKind = "shengWang" | "wangMu" | "gong";

export interface HeCandidate {
  readonly kind: "sanhui" | "sanhe" | "banhe" | "gong" | "liuhe" | "ganhe";
  readonly slots: readonly BranchSlot[];
  readonly stemSlots?: readonly StemSlot[];
  readonly element: Element;
  readonly banheKind?: BanheKind;
}

export interface ClashCandidate {
  readonly kind: "chong" | "ganchong" | "hai" | "po";
  readonly a: BranchSlot | StemSlot;
  readonly b: BranchSlot | StemSlot;
}

export interface XingCandidate {
  readonly punishment: PunishmentKind;
  readonly slots: readonly BranchSlot[];
  readonly complete: boolean;
}

/** 枚举 k 元组合。场上至多 6 个支，组合数极小，直接穷举。 */
function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i <= items.length - k; i++) {
    for (const rest of combinations(items.slice(i + 1), k - 1)) {
      out.push([items[i]!, ...rest]);
    }
  }
  return out;
}

export function detectHe(branches: readonly BranchSlot[], stems: readonly StemSlot[]): HeCandidate[] {
  const out: HeCandidate[] = [];

  // 三会方：三支全见且互不相同
  for (const trio of combinations(branches, 3)) {
    const set = new Set(trio.map((s) => s.branch));
    if (set.size !== 3) continue;
    const d = DIRECTIONALS.find((x) => x.branches.every((b) => set.has(b)));
    if (d !== undefined) out.push({ kind: "sanhui", slots: trio, element: d.element });
  }

  // 三合局：生旺墓全见
  for (const trio of combinations(branches, 3)) {
    const set = new Set(trio.map((s) => s.branch));
    if (set.size !== 3) continue;
    const t = TRINITIES.find((x) => set.has(x.sheng) && set.has(x.wang) && set.has(x.mu));
    if (t !== undefined) out.push({ kind: "sanhe", slots: trio, element: t.element });
  }

  // 半合与拱：两支。**旺神是三合的必要条件** —— 缺旺神只成拱，不成半合。
  for (const pair of combinations(branches, 2)) {
    const [x, y] = pair as [BranchSlot, BranchSlot];
    if (x.branch === y.branch) continue;
    for (const t of TRINITIES) {
      const has = (b: Branch) => x.branch === b || y.branch === b;
      const inSet = [t.sheng, t.wang, t.mu].filter(has);
      if (inSet.length !== 2) continue;
      if (has(t.wang)) {
        const banheKind: BanheKind = has(t.sheng) ? "shengWang" : "wangMu";
        out.push({ kind: "banhe", slots: pair, element: t.element, banheKind });
      } else {
        // 生 + 墓，缺中神 —— 只记为拱
        out.push({ kind: "gong", slots: pair, element: t.element, banheKind: "gong" });
      }
    }
  }

  // 六合
  for (const pair of combinations(branches, 2)) {
    const [x, y] = pair as [BranchSlot, BranchSlot];
    const c = BRANCH_SIX_COMBINATIONS.find(
      ([a, b]) => (a === x.branch && b === y.branch) || (a === y.branch && b === x.branch));
    if (c !== undefined) out.push({ kind: "liuhe", slots: pair, element: c[2] });
  }

  // 天干五合
  for (const pair of combinations(stems, 2)) {
    const [x, y] = pair as [StemSlot, StemSlot];
    const c = STEM_COMBINATIONS.find(
      ([a, b]) => (a === x.stem && b === y.stem) || (a === y.stem && b === x.stem));
    if (c !== undefined) out.push({ kind: "ganhe", slots: [], stemSlots: pair, element: c[2] });
  }

  return out;
}

export function detectClash(branches: readonly BranchSlot[], stems: readonly StemSlot[]): ClashCandidate[] {
  const out: ClashCandidate[] = [];
  const pairMatch = (t: readonly (readonly [Branch, Branch])[], a: Branch, b: Branch) =>
    t.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  for (const pair of combinations(branches, 2)) {
    const [x, y] = pair as [BranchSlot, BranchSlot];
    if (pairMatch(BRANCH_CLASHES, x.branch, y.branch)) out.push({ kind: "chong", a: x, b: y });
    if (pairMatch(BRANCH_HARMS, x.branch, y.branch)) out.push({ kind: "hai", a: x, b: y });
    if (pairMatch(BRANCH_DESTRUCTIONS, x.branch, y.branch)) out.push({ kind: "po", a: x, b: y });
  }
  for (const pair of combinations(stems, 2)) {
    const [x, y] = pair as [StemSlot, StemSlot];
    const hit = STEM_CLASHES.some(([a, b]) =>
      (a === x.stem && b === y.stem) || (a === y.stem && b === x.stem));
    if (hit) out.push({ kind: "ganchong", a: x, b: y });
  }
  return out;
}

export function detectXing(branches: readonly BranchSlot[]): XingCandidate[] {
  const out: XingCandidate[] = [];
  const present = (b: Branch) => branches.filter((s) => s.branch === b);

  for (const p of PUNISHMENTS) {
    if (p.kind === "自刑") {
      const same = present(p.branches[0]!);
      if (same.length >= 2) out.push({ punishment: p.kind, slots: same, complete: true });
      continue;
    }
    if (p.kind === "无礼之刑") {
      const zi = present("子"); const mao = present("卯");
      if (zi.length > 0 && mao.length > 0) {
        out.push({ punishment: p.kind, slots: [zi[0]!, mao[0]!], complete: true });
      }
      continue;
    }
    // 无恩、恃势：三支全见方成局，只见两支为「有刑意无刑局」
    const found = p.branches.map((b) => present(b)[0]).filter((s): s is BranchSlot => s !== undefined);
    if (found.length === 3) out.push({ punishment: p.kind, slots: found, complete: true });
    else if (found.length === 2) out.push({ punishment: p.kind, slots: found, complete: false });
  }
  return out;
}

export { combinations };
export type { Stem, Element };

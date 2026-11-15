/**
 * 流月引动了什么 —— 作为**应期**展示，不改权重。
 *
 * ## 为什么有这个模块
 *
 * 流月进权重（默认，流年的一半）之后，有三条规则只看「有没有」、不读权重：
 *
 *   墓库被冲刑则开 · 会局夺合 · 争合妒合
 *
 * 它们对流月照旧成立，但**不该改权重**：实测它们受影响的帧数在比例 10% 与 1/3 下
 * 完全相同，权重根本不是它们的输入，而单次改动却不小（开库一次动 7.35 分，
 * 比 10% 时流月自己的全部分量还多）。所以结构层（`structure/apply.ts`）对流月
 * 看不见这三条。
 *
 * 但信息不该丢。流月冲开墓库、流月成局夺合、流月引起争合 —— 这些正是传统说的
 * **引动**：月、日是扳机，不是力量的来源。本模块把它们单独算出来，供神煞一栏展示，
 * 并一律注明是**流年大运应期**。
 *
 * ## 为什么是「流年大运应期」
 *
 * 流月不是独立的力量。它引动的，是当前流年、大运已经摆好的局面：
 * 库在本命、在大运、在流年里；局的另两支也在这几处。拿掉流年大运的背景，
 * 流月单独什么也引动不了。所以它的触发要放回那个背景里读，而不是当作一股新的力。
 *
 * ## 怎么算
 *
 * 复用结构层的侦测函数（`detectHe` / `detectClash` / `detectXing`），不另写一套。
 * 它们只看支与干，不看载体与权重，所以不需要先把盘算一遍。
 * 每条触发都是**差分**：带流月侦测一遍、不带流月侦测一遍，只报「因为流月在场
 * 才成立」的那些 —— 本命、大运、流年自己已经成立的，不算流月引动的。
 *
 * 不依赖 `series.fleetingMonthInWeights`：实验开关关着时也能算、能展示。
 */

import type { Branch, Pillar } from "../types/ganzhi.js";
import type { NatalChart } from "../chart/types.js";
import type { PillarKind } from "../weights/carrier.js";
import type { BranchSlot, StemSlot } from "../structure/types.js";
import {
  detectClash, detectHe, detectXing, type HeCandidate,
} from "../structure/detect.js";
import { FOUR_TOMBS } from "../ganzhi/tables.js";
import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";

/** 展示时一律带上的框定。 */
export const MONTH_TRIGGER_FRAME = "流年大运应期";

export interface MonthTrigger {
  readonly kind: "kuOpen" | "juDuoHe" | "zhengHe";
  /** 一句话。只说触发了什么，不说结果好坏，也不说改了多少分。 */
  readonly text: string;
}

const LABEL: Readonly<Record<PillarKind, string>> = {
  year: "年柱", month: "月柱", day: "日柱", hour: "时柱",
  luck: "大运", annual: "流年", fleetingMonth: "流月", taiyuan: "胎元",
};

type Placed = readonly [PillarKind, Pillar];

interface Detected {
  readonly he: readonly HeCandidate[];
  readonly clashes: ReturnType<typeof detectClash>;
  readonly xings: ReturnType<typeof detectXing>;
}

/** 侦测只看支与干。载体与权重给占位 —— 侦测函数不读它们。 */
function detectOver(ps: readonly Placed[]): Detected {
  const branches: BranchSlot[] = ps.map(([k, p]) => ({
    pillar: k, branch: p.branch, carriers: [], weight: 1,
  }));
  const stems: StemSlot[] = ps.map(([k, p]) => ({
    pillar: k, stem: p.stem, carrier: undefined as never,
  }));
  return {
    he: detectHe(branches, stems),
    clashes: detectClash(branches, stems),
    xings: detectXing(branches),
  };
}

const isM = (k: PillarKind): boolean => k === "fleetingMonth";
const involvesM = (h: HeCandidate): boolean =>
  h.slots.some((s) => isM(s.pillar)) || (h.stemSlots ?? []).some((s) => isM(s.pillar));

const slotKeys = (h: HeCandidate): string[] => [
  ...h.slots.map((s) => `${s.pillar}.branch`),
  ...(h.stemSlots ?? []).map((s) => `${s.pillar}.stem`),
];

function countOf(cands: readonly HeCandidate[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const h of cands) for (const k of slotKeys(h)) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

/**
 * 流月在这一刻引动了什么。
 *
 * @param luck   当下大运柱；起运前为 null。
 * @param annual 当年流年柱。
 */
export function fleetingTriggers(
  chart: Pick<NatalChart, "year" | "month" | "day" | "hour">,
  luck: Pillar | null,
  annual: Pillar | null,
  month: Pillar,
  params: Params = DEFAULT_PARAMS,
): readonly MonthTrigger[] {
  const base: Placed[] = [];
  const add = (k: PillarKind, p: Pillar | null | undefined) => { if (p != null) base.push([k, p]); };
  add("year", chart.year); add("month", chart.month);
  add("day", chart.day); add("hour", chart.hour);
  add("luck", luck); add("annual", annual);

  const without = detectOver(base);
  const withM = detectOver([...base, ["fleetingMonth", month]]);
  const pil = (k: PillarKind): Pillar => (k === "fleetingMonth" ? month : base.find(([x]) => x === k)![1]);
  const out: MonthTrigger[] = [];

  // ── 一、墓库被冲刑则开 ──
  // 与 apply.ts 同一判据：带流月时开、不带流月时不开，才算流月引动的。
  const tomb = params.structure.tomb;
  const openedBy = (d: Detected, k: PillarKind): "chong" | "xing" | null => {
    if (tomb.openOnChong && d.clashes.some((c) => c.kind === "chong"
      && ((c.a as BranchSlot).pillar === k || (c.b as BranchSlot).pillar === k))) return "chong";
    if (tomb.openOnXing && d.xings.some((x) => x.complete && x.slots.some((s) => s.pillar === k))) return "xing";
    return null;
  };
  for (const [k, p] of base) {
    if (!(FOUR_TOMBS as readonly Branch[]).includes(p.branch)) continue;
    if (openedBy(without, k) !== null) continue;      // 本来就开着 —— 不是流月引动的
    const how = openedBy(withM, k);
    if (how === null) continue;
    const verb = how === "chong"
      ? `流月${month.branch}冲${LABEL[k]}${p.branch}`
      : `流月${month.branch}与${LABEL[k]}${p.branch}成刑`;
    out.push({ kind: "kuOpen", text: `${verb}，${p.branch}为墓库，库被引动而开` });
  }

  // ── 二、会局夺合 ──
  // 与 apply.ts 同一语义：判的是「六合的**每个柱**是否被**某个局**吞过」，
  // 各局吞过的柱取**并集** —— 不要求两支落在同一个局里。
  // 所以可以是：月柱被流月成的局吞、大运被另一个本来就有的局吞，
  // 两个柱合起来都被吞了，这个六合就不论。
  //
  // （第一版要求两支同在一个流月局内，实测只数到 4 帧，旧结构层是 9 帧 ——
  //  漏掉的 5 帧全是这种「一个柱一个局」的情形。）
  const bigOf = (d: Detected) => d.he.filter((h) => h.kind === "sanhui" || h.kind === "sanhe");
  const consumedWith = new Set<PillarKind>();
  for (const h of bigOf(withM)) for (const s of h.slots) consumedWith.add(s.pillar);
  const consumedWithout = new Set<PillarKind>();
  for (const h of bigOf(without)) for (const s of h.slots) consumedWithout.add(s.pillar);
  const swallowed = new Set<HeCandidate>();
  for (const h of without.he) {
    if (h.kind !== "liuhe" || h.slots.length === 0) continue;
    if (!h.slots.every((s) => consumedWith.has(s.pillar))) continue;
    if (h.slots.every((s) => consumedWithout.has(s.pillar))) continue;   // 本来就被夺
    // 是哪个含流月的局，补上了「本来没被吞」的那个柱
    const fresh = h.slots.filter((s) => !consumedWithout.has(s.pillar));
    const big = bigOf(withM).find((g) => involvesM(g)
      && fresh.some((s) => g.slots.some((x) => x.pillar === s.pillar)));
    if (big === undefined) continue;
    swallowed.add(h);
    const name = `${big.kind === "sanhui" ? "三会" : "三合"}${big.element}局`;
    const pair = h.slots.map((s) => `${LABEL[s.pillar]}${s.branch}`).join("");
    out.push({ kind: "juDuoHe", text: `流月${month.branch}成${name}，夺去${pair}之六合` });
  }

  // ── 三、争合妒合 ──
  // 本命等已成的六合 / 天干合，因流月另合其中一支或一干而变成「争合」。
  const cWithout = countOf(without.he);
  const cWith = countOf(withM.he);
  const contested = (c: Map<string, number>, h: HeCandidate) => slotKeys(h).some((k) => (c.get(k) ?? 0) > 1);
  for (const h of without.he) {
    if (h.kind !== "liuhe" && h.kind !== "ganhe") continue;
    if (swallowed.has(h)) continue;      // 已被局夺走的六合不再论，也就谈不上争合
    if (contested(cWithout, h) || !contested(cWith, h)) continue;
    const mine = new Set(slotKeys(h));
    const rival = withM.he.find((m) => involvesM(m) && slotKeys(m).some((k) => mine.has(k) && !isM(k.split(".")[0] as PillarKind)));
    const shared = rival === undefined ? undefined : slotKeys(rival).find((k) => mine.has(k));
    const sharedPil = shared === undefined ? undefined : (shared.split(".")[0] as PillarKind);
    const pair = h.kind === "ganhe"
      ? (h.stemSlots ?? []).map((s) => `${LABEL[s.pillar]}${s.stem}`).join("")
      : h.slots.map((s) => `${LABEL[s.pillar]}${s.branch}`).join("");
    const what = shared !== undefined && shared.endsWith(".stem")
      ? `流月${month.stem}亦合${LABEL[sharedPil!]}${pil(sharedPil!).stem}`
      : `流月${month.branch}亦合${sharedPil === undefined ? "其中一支" : `${LABEL[sharedPil]}${pil(sharedPil).branch}`}`;
    out.push({ kind: "zhengHe", text: `${what}，${pair}之合遭争合妒合` });
  }

  return out;
}

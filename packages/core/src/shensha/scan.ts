/**
 * 神煞扫描。
 *
 * ## 神煞不参与权重计算
 *
 * L1–L3 是力量模型，神煞是符号层。把神煞折算成分数加进旺衰，是把两套不同来源、
 * 不同抽象层级的东西混在一起，必然产出既不符合古法也不符合量化的结果。
 *
 * 神煞的作用只有三个：叙述素材、应期触发器、宫位定性。
 *
 * **唯二例外**：禄与羊刃 —— 它们本质是十二长生的临官位与帝旺位，
 * 已通过通根评分进入 L4 的力量模型。此处只作展示，**不得二次计入**。
 */

import { luOf, yangRenOf, type ChangshengOptions } from "../ganzhi/changsheng.js";
import { xunKongOf, sexagenaryIndexOf } from "../ganzhi/algebra.js";
import type { Branch, Stem } from "../types/ganzhi.js";
import type { NatalChart } from "../chart/types.js";
import type { ShenshaParams } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import type { Carrier, PillarKind } from "../weights/carrier.js";
import type { StructureEvent } from "../structure/types.js";
import {
  BAZHUAN, GULUAN, HONGYAN, JINSHEN, JIUCHOU, KUIGANG, LIUXIA, RIDE, RIGUI,
  SANQI, SHENSHA_DEFS, SHIE_DABAI, TAIJI, TIANDE, TIANYI, WENCHANG,
  YINCHA_YANGCUO, type ShenshaCategory, type ShenshaDef,
} from "./tables.js";
import {
  guchenGuasuOf, hongluanOf, jinyuOf, tianxiOf, tianyiMedOf,
  trinityShensha, xuetangOf, yuedeOf,
} from "./rules.js";
import { effectiveTone, modifiersFor, type ShenshaModifier } from "./modifiers.js";

export type PalaceName =
  | "祖上宫" | "根基宫" | "父母兄弟宫" | "门户宫"
  | "自身" | "配偶宫" | "志向宫" | "子女宫" | "外部";

const PALACE: Readonly<Record<string, PalaceName>> = Object.freeze({
  "year.stem": "祖上宫", "year.branch": "根基宫",
  "month.stem": "父母兄弟宫", "month.branch": "门户宫",
  "day.stem": "自身", "day.branch": "配偶宫",
  "hour.stem": "志向宫", "hour.branch": "子女宫",
});

export interface ShenshaHit {
  readonly name: string;
  readonly category: ShenshaCategory;
  readonly base: ShenshaDef["base"];
  /** 起例所依：日干起还是年干起。二者可能落在不同支，都保留。 */
  readonly basis: "day" | "year";
  readonly landsOn: { readonly pillar: PillarKind; readonly layer: "stem" | "branch" };
  /** **强制字段**。「有华盖」是废话，「华盖在时支子女宫且逢空」才是信息。 */
  readonly palace: PalaceName;
  readonly branch: Branch | null;
  readonly stem: Stem | null;
  readonly modifiers: readonly ShenshaModifier[];
  readonly hostWeight: number;
  readonly polarity: ShenshaDef["polarity"];
  readonly tone: "strengthened" | "weakened" | "activated" | "neutralized";
  readonly toneReason: string;
  readonly narrativeTags: readonly string[];
}

export interface ScanInput {
  readonly chart: NatalChart;
  readonly carriers: readonly Carrier[];
  readonly events: readonly StructureEvent[];
  readonly params?: ShenshaParams;
  readonly changsheng?: ChangshengOptions;
}

interface Slot { pillar: PillarKind; layer: "stem" | "branch"; stem: Stem | null; branch: Branch | null }

function slotsOfChart(chart: NatalChart): Slot[] {
  const out: Slot[] = [];
  const add = (pillar: PillarKind, p: { stem: Stem; branch: Branch } | null) => {
    if (p === null) return;
    out.push({ pillar, layer: "stem", stem: p.stem, branch: null });
    out.push({ pillar, layer: "branch", stem: null, branch: p.branch });
  };
  add("year", chart.year); add("month", chart.month);
  add("day", chart.day); add("hour", chart.hour);
  return out;
}

const defOf = (name: string): ShenshaDef => {
  const d = SHENSHA_DEFS.find((x) => x.name === name);
  if (d === undefined) throw new Error(`神煞定义缺失：${name}`);
  return d;
};

export function scanShensha(input: ScanInput): ShenshaHit[] {
  const p = input.params ?? DEFAULT_PARAMS.shensha;
  const { chart, carriers, events } = input;
  const cs = input.changsheng ?? {};
  const slots = slotsOfChart(chart);

  const kongwang = [...xunKongOf(sexagenaryIndexOf(chart.day.stem, chart.day.branch))] as string[];

  /** name → 命中的 (slot, basis) 列表。先收集，后统一算修饰（重见须知总数）。 */
  const raw: { name: string; slot: Slot; basis: "day" | "year" }[] = [];
  const mark = (name: string, target: Branch | Stem | readonly (Branch | Stem)[], basis: "day" | "year") => {
    const targets = Array.isArray(target) ? target : [target];
    for (const s of slots) {
      const v = s.layer === "stem" ? s.stem : s.branch;
      if (v !== null && (targets as unknown[]).includes(v)) raw.push({ name, slot: s, basis });
    }
  };

  for (const basis of (["day", "year"] as const)) {
    if (basis === "year" && !p.alsoComputeYearBase) continue;
    if (basis === "day" && p.primaryBase !== "day" && !p.alsoComputeYearBase) continue;
    const stem = basis === "day" ? chart.day.stem : chart.year.stem;
    const branch = basis === "day" ? chart.day.branch : chart.year.branch;

    // ── 以天干起 ──
    mark("天乙贵人", TIANYI[stem], basis);
    mark("太极贵人", TAIJI[stem], basis);
    mark("文昌贵人", WENCHANG[stem], basis);
    mark("金舆", jinyuOf(stem, cs), basis);
    mark("禄神", luOf(stem, cs), basis);
    mark("学堂", xuetangOf(stem, cs), basis);
    mark("红艳煞", HONGYAN[stem], basis);
    mark("流霞", LIUXIA[stem], basis);
    const ren = yangRenOf(stem, cs);
    if (ren !== null) mark("羊刃", ren, basis);

    // ── 以地支起（三合局类，全部推导）──
    const t = trinityShensha(branch, cs);
    mark("将星", t.将星, basis); mark("华盖", t.华盖, basis);
    mark("桃花", t.桃花, basis); mark("驿马", t.驿马, basis);
    mark("亡神", t.亡神, basis); mark("劫煞", t.劫煞, basis);
    mark("灾煞", t.灾煞, basis); mark("六厄", t.六厄, basis);

    const gg = guchenGuasuOf(branch);
    mark("孤辰", gg.gu, basis); mark("寡宿", gg.gua, basis);
    mark("红鸾", hongluanOf(branch), basis);
    mark("天喜", tianxiOf(branch), basis);
  }

  // ── 以月支起 ──
  mark("天德贵人", TIANDE[chart.month.branch] as Branch | Stem, "day");
  mark("月德贵人", yuedeOf(chart.month.branch), "day");
  mark("天医", tianyiMedOf(chart.month.branch), "day");

  // ── 整柱定 ──
  const pillarSets: [string, readonly string[], readonly PillarKind[]][] = [
    ["魁罡", KUIGANG, ["day"]], ["日德", RIDE, ["day"]], ["日贵", RIGUI, ["day"]],
    ["十恶大败", SHIE_DABAI, ["day"]], ["阴差阳错", YINCHA_YANGCUO, ["day"]],
    ["八专", BAZHUAN, ["day"]], ["九丑", JIUCHOU, ["day"]], ["孤鸾", GULUAN, ["day"]],
    ["金神", JINSHEN, ["hour"]],
  ];
  for (const [name, set, pillars] of pillarSets) {
    for (const pk of pillars) {
      const pil = pk === "day" ? chart.day : chart.hour;
      if (pil === null) continue;
      if (set.includes(pil.stem + pil.branch)) {
        raw.push({ name, slot: { pillar: pk, layer: "branch", stem: null, branch: pil.branch }, basis: "day" });
      }
    }
  }

  // ── 组合型：三奇须年月日或月日时**顺次连续** ──
  const stemSeq = [chart.year.stem, chart.month.stem, chart.day.stem,
    ...(chart.hour === null ? [] : [chart.hour.stem])];
  for (const q of SANQI) {
    for (let i = 0; i + 3 <= stemSeq.length; i++) {
      if (stemSeq.slice(i, i + 3).every((s, k) => s === q.stems[k])) {
        raw.push({ name: "三奇", slot: { pillar: "day", layer: "stem", stem: chart.day.stem, branch: null }, basis: "day" });
      }
    }
  }

  // ── 空亡 ──
  for (const s of slots) {
    if (s.branch !== null && kongwang.includes(s.branch)) {
      raw.push({ name: "空亡", slot: s, basis: "day" });
    }
  }

  // ── 统一算修饰并组装 ──
  const counts = new Map<string, number>();
  for (const r of raw) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);

  return raw.map((r) => {
    const def = defOf(r.name);
    const { modifiers, hostWeight } = modifiersFor(
      r.slot.pillar, r.slot.layer, r.slot.branch,
      { events, carriers, kongwang, occurrences: counts.get(r.name) ?? 1 },
      p,
    );
    const { tone, why } = effectiveTone(def.polarity, modifiers);
    const key = `${r.slot.pillar}.${r.slot.layer}`;
    return {
      name: r.name, category: def.category, base: def.base, basis: r.basis,
      landsOn: { pillar: r.slot.pillar, layer: r.slot.layer },
      palace: PALACE[key] ?? "外部",
      branch: r.slot.branch, stem: r.slot.stem,
      modifiers, hostWeight,
      polarity: def.polarity, tone, toneReason: why,
      narrativeTags: def.narrativeTags,
    };
  });
}

/**
 * L4p 人格层 —— 由基础盘导出个性、原始偏好与亲人环境的**结构描述**。
 *
 * ## 内与外：透干为显，藏支为隐
 *
 * 这个划分不是新造的概念，它**已经在数据里** —— 载体的 `origin` 字段。
 * 藏而不透的是心里那一面，透干显用的是外人看见的那一面。
 *
 * 由此得出一个有意思的量：**内外张力 T**（两个分布的总变差距离）。
 * 它把「表里不一」变成一个可算的数，且**不带褒贬** ——
 * T 高只表示内在构成与外在构成差异大，传统上既可解为含蓄内敛、
 * 也可解为言行不一，取决于分歧落在哪几个十神上。
 * 所以本层必须同时报出**分歧十神**，只报一个 T 值是没有信息的。
 *
 * ## 这一层不做的事
 *
 * - 不给心理学量表词汇（外向、宜人性、大五）—— 那会制造虚假的科学感
 * - 不给形体与脏腑 —— 那在 P13，且有单独的措辞约束
 * - 不给价值判断 —— 「偏枯」不是缺陷，偏枯而成格成局者不在少数
 */

import { ELEMENTS, TEN_GODS, type Element, type Stem, type TenGod } from "../types/ganzhi.js";
import { elementOf, polarityOf } from "../ganzhi/algebra.js";
import type { PersonaParams } from "../params/types.js";
import type { Carrier, PillarKind } from "../weights/carrier.js";
import type { StructureEvent } from "../structure/types.js";
import { eventTouches } from "../shensha/modifiers.js";
import { PALACE, type PalaceName, type ShenshaHit } from "../shensha/scan.js";
import { attackOn, keDamageMatrix } from "./metrics.js";
import type { FlowRecord } from "../propagate/iterate.js";
import { GOD_GROUPS, tenGodOf } from "./tenGods.js";
import type { Conclusions, DerivationStep, Verdict } from "./types.js";

// ─────────────────────────────────────────────────────────

export type GodGroup = keyof typeof GOD_GROUPS;

export interface GroupDivergence {
  readonly group: GodGroup;
  readonly inner: number;
  readonly outer: number;
  readonly delta: number;
}

export interface GodDivergence {
  readonly god: TenGod;
  readonly inner: number;
  readonly outer: number;
  /** 外 − 内。正数表示这一面外显多于内蕴。 */
  readonly delta: number;
}

export interface PalaceState {
  readonly palace: PalaceName;
  readonly pillar: PillarKind;
  readonly layer: "stem" | "branch";
  readonly weight: number;
  readonly share: number;
  /**
   * 宫中十神构成。**日主自身不计入** —— 与 L4 的十神向量同一条规矩：
   * 日主是参照点，不是自己的比肩。破了这条，自身宫会凭空多出一个比肩。
   */
  readonly gods: Readonly<Record<TenGod, number>>;
  /** 该宫是否即日主所在（日干）。 */
  readonly isDayMaster: boolean;
  /** 该宫位参与的冲刑害破。按**层**匹配，天干的合冲不算到地支头上。 */
  readonly afflicted: readonly StructureEvent[];
  readonly shensha: readonly ShenshaHit[];
}

export interface ElementProfile {
  readonly share: Readonly<Record<Element, number>>;
  /** 偏枯度 = 1 − 归一化熵。0 为五行均分，越接近 1 越偏。**不是缺陷指标。** */
  readonly skew: number;
  readonly strongest: Element;
  readonly weakest: Element;
  /** 受克流量最大者。与「最弱」常常不是同一个。 */
  readonly mostAttacked: Element;
  readonly attack: Readonly<Record<Element, number>>;
}

export interface Persona {
  /** 归一化后的内在十神分布（藏干）。日主自身不计入。 */
  readonly inner: Readonly<Record<TenGod, number>>;
  /** 归一化后的外在十神分布（天干）。日主自身不计入。 */
  readonly outer: Readonly<Record<TenGod, number>>;
  readonly innerTotal: number;
  readonly outerTotal: number;
  /** 显隐比 = 外 / (内 + 外)。外显程度。 */
  readonly revealRatio: number;
  /**
   * 内外张力 = ½·Σ|内 − 外| ∈ [0,1]，**按五组算**。**不带褒贬。**
   *
   * 按十档算会顶格：外在只有三个天干，与八九个藏干的分布本就难重叠 ——
   * 实测十档下中位数 0.737、5.1% 恰为 1.000，那量的是「外在档位少」，
   * 不是「表里不一」。按比劫/印星/食伤/财星/官杀五组算，
   * 中位数 0.562、顶格率 1.1%，散布可用。
   *
   * 五组也是更恰当的粒度：正印与偏印之别对「表里是否一致」太细。
   */
  readonly innerOuterTension: number;
  /** 十档下的同一个量。会顶格，只作明细，不作头条。 */
  readonly innerOuterTensionByGod: number;
  /** 内外差异最大的三组。T 高时必须连它们一起报，只报一个 T 值是没有信息的。 */
  readonly divergentGroups: readonly GroupDivergence[];
  readonly divergentGods: readonly GodDivergence[];
  readonly dominantInner: Verdict<readonly TenGod[]>;
  readonly dominantOuter: Verdict<readonly TenGod[]>;
  /** 月令当权者 —— 禀气的底色。是标注，不是加权。 */
  readonly silingStem: Stem;
  readonly silingGod: TenGod | "日主";
  /** 过旺。 */
  readonly excess: readonly TenGod[];
  /**
   * **真缺** —— 占比恰为 0，四柱与藏干中一个都没有。
   * 这是传统上「四柱缺某神」的准确所指，无歧义。
   * 实测每盘均值 2.56 个，各档分布均匀，是个有分辨力的量。
   */
  readonly absent: readonly TenGod[];
  /** 弱而未绝 —— 0 < 占比 < 门槛。与「真缺」分开报，二者含义不同。 */
  readonly deficient: readonly TenGod[];
  readonly elements: ElementProfile;
  readonly palaces: readonly PalaceState[];
  readonly source: PersonaParams["source"];
}

export interface PersonaInput {
  readonly carriers: readonly Carrier[];
  readonly events: readonly StructureEvent[];
  readonly flows: readonly FlowRecord[];
  readonly shensha: readonly ShenshaHit[];
  readonly conclusions: Conclusions;
  readonly silingStem: Stem;
  readonly params: PersonaParams;
}

// ─────────────────────────────────────────────────────────

const zeroGods = (): Record<TenGod, number> =>
  Object.fromEntries(TEN_GODS.map((g) => [g, 0])) as Record<TenGod, number>;

const normalize = (v: Readonly<Record<TenGod, number>>): Record<TenGod, number> => {
  const sum = TEN_GODS.reduce((a, g) => a + v[g], 0);
  return Object.fromEntries(
    TEN_GODS.map((g) => [g, sum > 0 ? v[g] / sum : 0]),
  ) as Record<TenGod, number>;
};

/**
 * 主导十神的置信度。
 *
 * `0.45 + 0.15 × gap / dominantMargin` —— 与并列门槛**由构造对齐**：
 * `gap = dominantMargin` 时恰得 0.60，即模板的 `confidenceFloor`。
 * 于是「判为并列」与「改用留有余地的措辞」永远同进同出，
 * 且这一点与 `dominantMargin` 取多少无关。
 */
function dominantOf(
  dist: Readonly<Record<TenGod, number>>, margin: number, side: "内" | "外",
): Verdict<readonly TenGod[]> {
  const ranked = [...TEN_GODS].sort((a, b) => dist[b] - dist[a]);
  const first = ranked[0]!;
  const second = ranked[1]!;
  const gap = dist[first] - dist[second];
  const tied = gap < margin;
  const confidence = Math.min(0.95, 0.45 + (0.15 * gap) / margin);

  const derivation: DerivationStep[] = [
    { step: "分布", detail: `${side}在分布前二：${first} ${(dist[first] * 100).toFixed(1)}%、`
      + `${second} ${(dist[second] * 100).toFixed(1)}%`,
      values: { first: dist[first], second: dist[second] } },
    { step: "并列判据", detail: `差距 ${(gap * 100).toFixed(1)}% ${tied ? "小于" : "不小于"} `
      + `门槛 ${(margin * 100).toFixed(1)}%，${tied ? "判为并列" : "判为单一主导"}`,
      values: { gap, margin, confidence } },
  ];

  const alternatives = tied
    ? []   // 已经并列进 value，不必再列一次
    : [{ value: [second] as readonly TenGod[],
        reason: `${second} 仅次于 ${first}（差 ${(gap * 100).toFixed(1)}%），亦可参看` }];

  return {
    value: tied ? [first, second] : [first],
    confidence, derivation, alternatives,
  };
}

// ─────────────────────────────────────────────────────────

export function personaOf(input: PersonaInput): Persona {
  const { carriers, events, flows, shensha, conclusions, params } = input;
  const dm = conclusions.dayMaster;

  // ── 内外分布：透干为显，藏支为隐。日主自身不计入任一侧 ──
  const inner = zeroGods();
  const outer = zeroGods();
  for (const c of carriers) {
    if (c.flags.includes("DAY_MASTER")) continue;
    const g = tenGodOf(dm.element, dm.polarity, c.element, c.polarity);
    if (c.origin === "hidden") inner[g] += c.weight;
    else outer[g] += c.weight;
  }
  const innerTotal = TEN_GODS.reduce((a, g) => a + inner[g], 0);
  const outerTotal = TEN_GODS.reduce((a, g) => a + outer[g], 0);
  const iN = normalize(inner);
  const eN = normalize(outer);

  const revealRatio = innerTotal + outerTotal > 0
    ? outerTotal / (innerTotal + outerTotal) : 0;
  // 总变差距离 ∈ [0,1]
  const innerOuterTensionByGod = 0.5 * TEN_GODS.reduce((a, g) => a + Math.abs(iN[g] - eN[g]), 0);

  // 五组聚合 —— 见 innerOuterTension 的注释
  const groups = Object.keys(GOD_GROUPS) as GodGroup[];
  const sumGroup = (d: Readonly<Record<TenGod, number>>, k: GodGroup) =>
    GOD_GROUPS[k].reduce((a, g) => a + d[g], 0);
  const innerOuterTension = 0.5 * groups.reduce(
    (a, k) => a + Math.abs(sumGroup(iN, k) - sumGroup(eN, k)), 0);

  const divergentGroups: GroupDivergence[] = groups
    .map((k) => ({ group: k, inner: sumGroup(iN, k), outer: sumGroup(eN, k),
      delta: sumGroup(eN, k) - sumGroup(iN, k) }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  const divergentGods: GodDivergence[] = TEN_GODS
    .map((g) => ({ god: g, inner: iN[g], outer: eN[g], delta: eN[g] - iN[g] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  // ── 过旺 / 过弱：按内外合并后的分布判 ──
  const combined = normalize(
    Object.fromEntries(TEN_GODS.map((g) => [g, inner[g] + outer[g]])) as Record<TenGod, number>);
  const excess = TEN_GODS.filter((g) => combined[g] > params.excessShare);
  // 真缺与「弱而未绝」分开：前者无歧义（一个都没有），后者是程度问题。
  // 合在一起报，平均会标出四个「过弱」—— 十档里标四档等于没标。
  const absent = TEN_GODS.filter((g) => combined[g] === 0);
  const deficient = TEN_GODS.filter(
    (g) => combined[g] > 0 && combined[g] < params.deficientShare);

  // ── 五行 ──
  const byElement = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  for (const c of carriers) byElement[c.element] += c.weight;
  const total = ELEMENTS.reduce((a, e) => a + byElement[e], 0);
  const share = Object.fromEntries(
    ELEMENTS.map((e) => [e, total > 0 ? byElement[e] / total : 0])) as Record<Element, number>;
  const ranked = [...ELEMENTS].sort((a, b) => share[b] - share[a]);
  const keDamage = keDamageMatrix(carriers, flows);
  const attack = Object.fromEntries(
    ELEMENTS.map((e) => [e, attackOn(keDamage, e)])) as Record<Element, number>;
  const mostAttacked = [...ELEMENTS].sort((a, b) => attack[b] - attack[a])[0]!;

  const elements: ElementProfile = {
    share,
    // 单一来源：偏枯度就是均匀度的补，不另算一遍熵
    skew: 1 - conclusions.metrics.evenness,
    strongest: ranked[0]!,
    weakest: ranked[ranked.length - 1]!,
    mostAttacked,
    attack,
  };

  // ── 宫位 ──
  const palaces: PalaceState[] = [];
  for (const [key, name] of Object.entries(PALACE)) {
    const [pillar, layer] = key.split(".") as [PillarKind, "stem" | "branch"];
    if (layer === undefined) continue;
    const here = carriers.filter(
      (c) => c.position.pillar === pillar && c.position.layer === layer);
    if (here.length === 0) continue;
    const weight = here.reduce((a, c) => a + c.weight, 0);
    const gods = zeroGods();
    let isDayMaster = false;
    for (const c of here) {
      if (c.flags.includes("DAY_MASTER")) { isDayMaster = true; continue; }
      gods[tenGodOf(dm.element, dm.polarity, c.element, c.polarity)] += c.weight;
    }
    const stem = layer === "stem" ? here[0]!.stem : null;
    const branch = here[0]!.hostBranch;
    palaces.push({
      palace: name, pillar, layer, weight,
      share: total > 0 ? weight / total : 0,
      gods, isDayMaster,
      // 按层匹配 —— 天干的合冲不算到地支头上。同 07-shensha §9.2 的教训。
      afflicted: events.filter(
        (e) => ["chong", "ganchong", "xing", "hai", "po"].includes(e.kind)
          && eventTouches(e, pillar, layer, stem, branch)),
      shensha: shensha.filter((h) => h.landsOn.pillar === pillar && h.landsOn.layer === layer),
    });
  }

  // 司令干取**原始的**五行阴阳，不查载体 —— 载体的 element 可能已被 L2 合化改写，
  // 而「禀何气而生」问的是那个干本身。
  const silingGod = input.silingStem === dm.stem
    ? "日主" as const
    : tenGodOf(dm.element, dm.polarity,
        elementOf(input.silingStem), polarityOf(input.silingStem));

  return {
    inner: iN, outer: eN, innerTotal, outerTotal,
    revealRatio, innerOuterTension, innerOuterTensionByGod,
    divergentGroups, divergentGods,
    dominantInner: dominantOf(iN, params.dominantMargin, "内"),
    dominantOuter: dominantOf(eN, params.dominantMargin, "外"),
    silingStem: input.silingStem, silingGod,
    excess, absent, deficient, elements, palaces,
    source: params.source,
  };
}

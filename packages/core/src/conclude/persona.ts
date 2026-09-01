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

import {
  ELEMENTS, TEN_GODS, type Branch, type Element, type Stem, type TenGod,
} from "../types/ganzhi.js";
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

/**
 * 虚实六档。
 *
 * 规格初稿只列五档，「平」那一档不看受克 —— 于是一个占比适中、
 * 却承担了全盘 2.6 倍份额克流量的五行，会被报成一个干净的「平」。
 * 那恰恰是这张盘最值得说的一件事，却被埋掉了。故补「平而受制」。
 *
 * 「虚而被伐」与「平而受制」是需要单独措辞的两档：前者量已不足又持续受克，
 * 后者看似无恙而实为众矢之的。
 */
export type ElementState =
  | "实" | "实而受制" | "平" | "平而受制" | "虚" | "虚而被伐";

export interface ElementDetail {
  readonly element: Element;
  readonly share: number;
  /** 相对五行均分（0.20）的偏离。 */
  readonly deviation: number;
  readonly attack: number;
  /** 受克流量 / 自身权重 —— 「被削掉了自身的几成」。作明细呈现。 */
  readonly attackRatio: number;
  /**
   * 全盘克流量中落在本五行头上的份额，相对均分（0.20）的偏离。
   *
   * **判「被伐」用这个，不用 `attackRatio`。**后者等于「受克 / 自身权重」，
   * 而低权重必然高比值 —— 虚与被伐会由构造耦合，「虚而被伐」只是在复述「虚」。
   * 实测按 attackRatio 判时该档占 32%，成了最常见的一档，与「值得单独措辞」相悖。
   */
  readonly attackDeviation: number;
  readonly state: ElementState;
  /**
   * 该五行中阳干所占的份额。
   *
   * ⚠️ **这是天干的形式阴阳，不是中医的阴阳。**
   * 甲阳乙阴是干支系统里的奇偶，中医的阴阳是阴液与阳气 —— 同名而异指。
   * 故报告措辞为「以阳干为主」，**不为**「阳虚」。
   * 「阴阳虚实」四字的意思由本字段与 `state` **并列**给出，不合成中医证型名。
   */
  readonly yangShare: number;
}

export interface BodyAxes {
  /** 寒热轴 = 热势 − 寒势，含月令修正。正为偏热。 */
  readonly heat: number;
  /** 燥湿轴 = 燥势 − 湿势。正为偏燥。 */
  readonly dryness: number;
  readonly heatLabel: "偏热" | "平" | "偏寒";
  readonly drynessLabel: "偏燥" | "平" | "偏湿";
}

export interface BodyCorrespondence {
  readonly axes: BodyAxes;
  readonly details: Readonly<Record<Element, ElementDetail>>;
  /** 入选的五行：最旺、最弱、受克最重，去重后至多三个。不逐一罗列 —— 全说等于没说。 */
  readonly focus: readonly Element[];
  readonly wuqiaoSource: PersonaParams["wuqiaoSource"];
  readonly neijingSource: PersonaParams["neijingSource"];
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
  /**
   * 形体与脏腑的传统对照。`bodyCorrespondence` 关闭或 `subject: other` 时为 null ——
   * 这两项都是对一个人身体的描述，结构性略去，不靠措辞扫描兜底。
   */
  readonly body: BodyCorrespondence | null;
}

export interface PersonaInput {
  readonly carriers: readonly Carrier[];
  readonly events: readonly StructureEvent[];
  readonly flows: readonly FlowRecord[];
  readonly shensha: readonly ShenshaHit[];
  readonly conclusions: Conclusions;
  readonly silingStem: Stem;
  readonly monthBranch: Branch;
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

/** 燥土藏于未、戌；湿土藏于辰、丑。命理的通行划分。 */
const DRY_EARTH: ReadonlySet<string> = new Set(["未", "戌"]);
const WET_EARTH: ReadonlySet<string> = new Set(["辰", "丑"]);
const WINTER: ReadonlySet<string> = new Set(["亥", "子", "丑"]);
const SUMMER: ReadonlySet<string> = new Set(["巳", "午", "未"]);

/**
 * 三条可算的轴。
 *
 * 不直接输出「阴虚」「阳虚」这类中医证型 —— 那需要一次未经声明的概念跳跃
 * （见 `ElementDetail.yangShare` 的注释）。此处只给三个能回溯到具体权重的量：
 *
 * - **虚实**：占比相对五行均分的偏离，叠加受克强度。五档
 * - **阴阳**：该五行内阳干的份额。**形式阴阳**
 * - **寒热燥湿**：命理自有的轴，与内经五气对接
 *
 * 燥土（未戌）与湿土（辰丑）的划分本项目已有 `hostBranch` 可直接分；
 * 天干之土与生地之土（寅申巳中的戊）不计入任一侧 —— 它们本就不偏。
 */
function bodyOf(
  carriers: readonly Carrier[], share: Readonly<Record<Element, number>>,
  byElement: Readonly<Record<Element, number>>,
  attack: Readonly<Record<Element, number>>,
  monthBranch: Branch, p: PersonaParams,
): BodyCorrespondence {
  const yangWeight = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  let dryEarth = 0; let wetEarth = 0;
  for (const c of carriers) {
    if (c.polarity === "阳") yangWeight[c.element] += c.weight;
    if (c.element === "土" && c.hostBranch !== null) {
      if (DRY_EARTH.has(c.hostBranch)) dryEarth += c.weight;
      else if (WET_EARTH.has(c.hostBranch)) wetEarth += c.weight;
    }
  }
  const total = ELEMENTS.reduce((a, e) => a + byElement[e], 0);
  const norm = (x: number) => (total > 0 ? x / total : 0);

  const heatRaw = (share["火"] + 0.5 * share["木"]) - (share["水"] + 0.5 * share["金"]);
  const seasonal = WINTER.has(monthBranch) ? -p.seasonAdjust
    : SUMMER.has(monthBranch) ? p.seasonAdjust : 0;
  const heat = heatRaw + seasonal;
  const dryness = (share["火"] + norm(dryEarth)) - (share["水"] + norm(wetEarth));

  const totalAttack = ELEMENTS.reduce((a, e) => a + attack[e], 0);
  const details = Object.fromEntries(ELEMENTS.map((e) => {
    const deviation = (share[e] - 0.2) / 0.2;
    const attackRatio = byElement[e] > 0 ? attack[e] / byElement[e] : 0;
    const attackShare = totalAttack > 0 ? attack[e] / totalAttack : 0.2;
    const attackDeviation = (attackShare - 0.2) / 0.2;
    const struck = attackDeviation > p.attackedBand;
    const state: ElementState =
      deviation >= p.excessBand ? (struck ? "实而受制" : "实")
      : deviation <= -p.deficientBand ? (struck ? "虚而被伐" : "虚")
      : (struck ? "平而受制" : "平");
    return [e, {
      element: e, share: share[e], deviation,
      attack: attack[e], attackRatio, attackDeviation, state,
      yangShare: byElement[e] > 0 ? yangWeight[e] / byElement[e] : 0,
    } satisfies ElementDetail];
  })) as Record<Element, ElementDetail>;

  const ranked = [...ELEMENTS].sort((a, b) => share[b] - share[a]);
  const mostAttacked = [...ELEMENTS].sort((a, b) => attack[b] - attack[a])[0]!;
  const focus = [...new Set([ranked[0]!, ranked[ranked.length - 1]!, mostAttacked])];

  const lab = <H extends string, L extends string>(v: number, hi: H, lo: L): H | L | "平" =>
    (v > p.axisBand ? hi : v < -p.axisBand ? lo : "平");

  return {
    axes: {
      heat, dryness,
      heatLabel: lab(heat, "偏热", "偏寒"),
      drynessLabel: lab(dryness, "偏燥", "偏湿"),
    },
    details, focus,
    wuqiaoSource: p.wuqiaoSource,
    neijingSource: p.neijingSource,
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
    body: params.bodyCorrespondence
      ? bodyOf(carriers, share, byElement, attack, input.monthBranch, params)
      : null,
  };
}

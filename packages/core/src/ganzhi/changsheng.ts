/**
 * 十二长生与通根。
 *
 * 不硬编码 10 × 12 矩阵 —— 只记长生起点与行进方向，其余推导。
 * test/changsheng.spec.ts 用一份独立转录的字面量矩阵反向断言，
 * 两份表述吻合才算这层是对的。
 *
 * 自洽性（测试中断言）：
 *   · 每干的十二位恰为十二支的一个排列
 *   · 阴干长生 = 同五行阳干的「死」位
 *   · 禄 = 临官位；羊刃 = 阳干帝旺位
 */

import {
  CHANGSHENG_PHASES,
  type Branch, type ChangshengPhase, type ChangshengSchool,
  type EarthChangsheng, type RootKind, type Stem,
} from "../types/ganzhi.js";
import {
  CHANGSHENG_ORIGIN, CHANGSHENG_ORIGIN_WATER_EARTH,
  FOUR_TOMBS, HIDDEN_STEMS, PHASE_INDEX,
} from "./tables.js";
import { branchAt, branchIndex, elementOf, polarityOf } from "./algebra.js";

export interface ChangshengOptions {
  readonly school?: ChangshengSchool;
  readonly earth?: EarthChangsheng;
}

const DEFAULTS = {
  school: "yangForwardYinReverse" as const,
  earth: "fireEarthSame" as const,
};

/** 该干的长生起点，随土的流派而变。 */
export function originOf(stem: Stem, opts: ChangshengOptions = {}): Branch {
  const earth = opts.earth ?? DEFAULTS.earth;
  const table = earth === "waterEarthSame" ? CHANGSHENG_ORIGIN_WATER_EARTH : CHANGSHENG_ORIGIN;
  return table[stem];
}

/**
 * 行进方向：+1 顺行，−1 逆行。
 *
 * 阳顺阴逆（默认）：阳干顺、阴干逆。
 * 阴阳同生同死：阴干与其同五行阳干同起点、同方向，一律顺行。
 */
export function directionOf(stem: Stem, opts: ChangshengOptions = {}): 1 | -1 {
  const school = opts.school ?? DEFAULTS.school;
  if (school === "sameBirthDeath") return 1;
  return polarityOf(stem) === "阳" ? 1 : -1;
}

/** 同五行的阳干（阴阳同生同死流派下，阴干借它的起点）。 */
function yangSiblingOf(stem: Stem): Stem {
  return polarityOf(stem) === "阳" ? stem : (["甲", "丙", "戊", "庚", "壬"] as const)[
    (["木", "火", "土", "金", "水"] as const).indexOf(elementOf(stem))
  ]!;
}

function effectiveOrigin(stem: Stem, opts: ChangshengOptions): Branch {
  const school = opts.school ?? DEFAULTS.school;
  return school === "sameBirthDeath"
    ? originOf(yangSiblingOf(stem), opts)
    : originOf(stem, opts);
}

/** 某干某阶段落在哪一支。 */
export function branchOfPhase(stem: Stem, phase: ChangshengPhase, opts: ChangshengOptions = {}): Branch {
  const start = branchIndex(effectiveOrigin(stem, opts));
  return branchAt(start + directionOf(stem, opts) * PHASE_INDEX[phase]);
}

/** 某干在某支处于哪一阶段。 */
export function phaseOf(stem: Stem, branch: Branch, opts: ChangshengOptions = {}): ChangshengPhase {
  const start = branchIndex(effectiveOrigin(stem, opts));
  const dir = directionOf(stem, opts);
  const delta = (branchIndex(branch) - start) * dir;
  return CHANGSHENG_PHASES[((delta % 12) + 12) % 12]!;
}

/** 某干的完整十二长生序列，索引即 PHASE_INDEX。 */
export function changshengSequence(stem: Stem, opts: ChangshengOptions = {}): readonly Branch[] {
  return CHANGSHENG_PHASES.map((p) => branchOfPhase(stem, p, opts));
}

// ─────────────────────────────────────────────────────────
// 禄 · 刃
// ─────────────────────────────────────────────────────────

/** 禄神 = 临官位。推导而非查表。 */
export function luOf(stem: Stem, opts: ChangshengOptions = {}): Branch {
  return branchOfPhase(stem, "临官", opts);
}

/**
 * 羊刃 = 阳干帝旺位。阴干羊刃有分歧，默认不取（params.shensha.yinYangRen = false）。
 */
export function yangRenOf(stem: Stem, opts: ChangshengOptions = {}): Branch | null {
  if (polarityOf(stem) !== "阳") return null;
  return branchOfPhase(stem, "帝旺", opts);
}

// ─────────────────────────────────────────────────────────
// 通根
// ─────────────────────────────────────────────────────────

/**
 * 天干在某支的通根强度。系数见 params.conclusion.rootCoef。
 *
 * 分级依据：
 *   luRen      临官或帝旺 —— 最强根
 *   changsheng 长生
 *   ku         该干自身的墓位，且墓中确有同五行藏干
 *   yuqi       仅通至中气或余气
 *   none       该支藏干中无同五行者
 *
 * 「临官或帝旺皆作 luRen」不分阴阳 —— 此处论的是根之强弱，
 * 不是羊刃这一神煞的成立与否，二者不可混。
 */
export function rootKindOf(stem: Stem, branch: Branch, opts: ChangshengOptions = {}): RootKind {
  const el = elementOf(stem);
  const hasSameElement = HIDDEN_STEMS[branch].some((h) => elementOf(h) === el);
  if (!hasSameElement) return "none";

  const phase = phaseOf(stem, branch, opts);
  if (phase === "临官" || phase === "帝旺") return "luRen";
  if (phase === "长生") return "changsheng";
  if (phase === "墓" && (FOUR_TOMBS as readonly Branch[]).includes(branch)) return "ku";
  return "yuqi";
}

export const ROOT_COEF: Readonly<Record<RootKind, number>> = Object.freeze({
  luRen: 1.0,
  changsheng: 0.7,
  ku: 0.5,
  yuqi: 0.3,
  none: 0.0,
});

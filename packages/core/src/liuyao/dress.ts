/**
 * Q1 装卦 —— 把一个卦装成可断的对象。
 *
 * 六爻不做权重传导，**没有 L3**。四柱的旺衰是连续量（`number`），
 * 六爻的力量是**分档 + 关系集合**。这个差异写进类型里，不糊在一起：
 * `YaoInfo.monthPhase` 是五档枚举，`dayRelations` 是一组具名关系。
 * 合成一个「爻力分数」是很自然的冲动，但那会把「日辰冲之」与「月建生之」
 * 这两件性质完全不同的事压成同一个数 —— 断卦恰恰要分开看它们。
 *
 * ## 伏神不是边角情形
 *
 * 六爻只有六个位置，六亲有五类，**缺类是常态**：实测 64 卦中十余卦六亲不全。
 * 用神不上卦时到本宫的**本宫卦（八纯卦）同位**取之，谓伏神；压其上的本卦爻为飞神。
 * 故装卦阶段就把五类六亲的伏神一次备齐，而不是等断卦时临时找。
 *
 * ## 变爻的六亲仍按本卦的宫
 *
 * 这是初学最易错的一处：变卦有它自己的宫，但**变爻的六亲要按本卦宫定**。
 * 理由是变爻描述的是「本卦这一爻的去向」，不是另起一卦。
 * 若按变卦宫定，同一个变爻在两处会得出两个六亲名 —— 那就没法说「化回头生」了。
 */

import type { Branch, Element, Pillar, Stem } from "../types/ganzhi.js";
import {
  branchElement, branchIndex, generates, controls,
  sexagenaryIndexOf, xunKongOf,
} from "../ganzhi/algebra.js";
import { BRANCH_CLASHES, BRANCH_SIX_COMBINATIONS } from "../ganzhi/tables.js";
import { hexagramOf, composeHexagram, type HexagramInfo } from "../yijing/hexagrams.js";
import {
  NAJIA, liuqinOfBranch, liushenOf, type Liuqin, type Liushen,
} from "../yijing/najia.js";
import type { LiuyaoParams } from "../params/types.js";
import type { Casting } from "./cast.js";

/** 月建对爻的五档。 */
export type MonthPhase = "旺" | "相" | "休" | "囚" | "死";

/** 日辰与爻之间的具名关系。**不合成分数。** */
export type DayRelation = "日生" | "日克" | "日冲" | "日合" | "日比" | "临日";

/**
 * 变爻对动爻的生克 —— **穷尽五种**，恒有其一。
 *
 * 初稿写成 if/else 链且漏了「动爻克变爻」一支，于是那种局面下关系列表是空的 ——
 * 看起来像没算，实际是没写。改成穷尽枚举，类型上就不允许漏。
 * 「动克变」在传统里没有「回头」系的专名，故照实叫，不硬凑一个。
 */
export type BianShengke = "回头生" | "回头克" | "比和" | "泄气" | "动克变";

/** 变爻的附加标记 —— 可有可无，与生克正交。 */
export type BianFlag = "化进神" | "化退神" | "化空" | "化破";

export interface FuShen {
  readonly liuqin: Liuqin;
  /** 位置 1–6。 */
  readonly pos: number;
  readonly stem: Stem;
  readonly branch: Branch;
  readonly element: Element;
  /** 压在它上面的本卦爻的地支 —— 飞神。 */
  readonly feiBranch: Branch;
  readonly feiLiuqin: Liuqin;
}

export interface YaoInfo {
  /** 1–6，1 为初爻。 */
  readonly pos: number;
  readonly yao: 0 | 1;
  readonly moving: boolean;
  readonly stem: Stem;
  readonly branch: Branch;
  readonly element: Element;
  readonly liuqin: Liuqin;
  readonly liushen: Liushen;
  readonly isShi: boolean;
  readonly isYing: boolean;
  /** 落在日柱旬空之内。 */
  readonly xunkong: boolean;
  /** 旬空但因动、因冲而不以空论 —— 判据进参数。 */
  readonly xunkongNullified: "动而不空" | "冲空则实" | null;
  /** 与月建相冲。 */
  readonly yuepo: boolean;
  readonly yuepoNullified: "破而逢动" | null;
  readonly monthPhase: MonthPhase;
  readonly dayRelations: readonly DayRelation[];
  /** 动爻才有。 */
  readonly bian: {
    readonly stem: Stem; readonly branch: Branch; readonly element: Element;
    /** ⚠️ 按**本卦**的宫定，不按变卦的宫。 */
    readonly liuqin: Liuqin;
    /** 变爻对动爻的生克，恒有其一。 */
    readonly shengke: BianShengke;
    readonly flags: readonly BianFlag[];
  } | null;
}

export interface DressedGua {
  readonly casting: Casting;
  readonly ben: HexagramInfo;
  readonly bian: HexagramInfo | null;
  readonly yaos: readonly YaoInfo[];
  /** 本卦缺的六亲，到本宫卦同位取。 */
  readonly fushen: readonly FuShen[];
  readonly shi: number;
  readonly ying: number;
  /** 日柱旬空的两支。 */
  readonly kongBranches: readonly [Branch, Branch];
  /** 与月建相冲之支。 */
  readonly poBranch: Branch;
  /** 整卦级别的标记。 */
  readonly flags: readonly ("六冲" | "六合" | "反吟" | "伏吟")[];
}

// ─────────────────────────────────────────────────────────

/** 某卦某位的干支。位取 1–6。 */
function ganzhiAt(h: HexagramInfo, pos: number): { stem: Stem; branch: Branch } {
  const half = pos <= 3 ? NAJIA[h.lower].inner : NAJIA[h.upper].outer;
  return { stem: half.stem, branch: half.branches[(pos - 1) % 3]! };
}

/** 月建五档。以月建五行为令。 */
export function monthPhaseOf(monthElement: Element, yaoElement: Element): MonthPhase {
  if (yaoElement === monthElement) return "旺";
  if (generates(monthElement, yaoElement)) return "相";
  if (generates(yaoElement, monthElement)) return "休";
  if (controls(yaoElement, monthElement)) return "囚";
  return "死";
}

/** 冲、合的双向查表 —— 表里存的是无序对。 */
const CLASH_OF = new Map<Branch, Branch>();
for (const [a, b] of BRANCH_CLASHES) { CLASH_OF.set(a, b); CLASH_OF.set(b, a); }
const HE_OF = new Map<Branch, Branch>();
for (const [a, b] of BRANCH_SIX_COMBINATIONS) { HE_OF.set(a, b); HE_OF.set(b, a); }

function dayRelationsOf(day: Pillar, b: Branch): DayRelation[] {
  const out: DayRelation[] = [];
  const d = day.branch;
  const de = branchElement(d); const ye = branchElement(b);
  if (d === b) out.push("临日");
  if (CLASH_OF.get(d) === b) out.push("日冲");
  if (HE_OF.get(d) === b) out.push("日合");
  if (generates(de, ye)) out.push("日生");
  if (controls(de, ye)) out.push("日克");
  if (de === ye && d !== b) out.push("日比");
  return out;
}

/** 十二支中「进一位而同五行」的对子 —— 化进神的判据。 */
const ADVANCE: Readonly<Record<Branch, Branch | undefined>> = Object.freeze({
  寅: "卯", 巳: "午", 申: "酉", 亥: "子",
  丑: "辰", 辰: "未", 未: "戌", 戌: "丑",
  卯: undefined, 午: undefined, 酉: undefined, 子: undefined,
});

/** 变爻对动爻的生克 —— 五种穷尽，恒返回其一。 */
function bianShengkeOf(from: Branch, to: Branch): BianShengke {
  const fe = branchElement(from); const te = branchElement(to);
  if (te === fe) return "比和";
  if (generates(te, fe)) return "回头生";
  if (controls(te, fe)) return "回头克";
  if (generates(fe, te)) return "泄气";
  return "动克变";
}

function bianFlagsOf(
  from: Branch, to: Branch, kong: readonly Branch[], po: Branch,
): BianFlag[] {
  const out: BianFlag[] = [];
  if (ADVANCE[from] === to) out.push("化进神");
  else if (ADVANCE[to] === from) out.push("化退神");
  if (kong.includes(to)) out.push("化空");
  if (to === po) out.push("化破");
  return out;
}

/**
 * 六冲、六合 —— **由纳甲推出，不转录卦名**。
 *
 * 判据就是定义本身：初与四、二与五、三与上，三对爻支**全部相冲**为六冲卦，
 * **全部相合**为六合卦。初稿抄了一份卦名表，抄错了 —— 把四个六合卦
 * （天地否、地天泰、水山蹇、火风鼎）混进了六冲，还漏了天雷无妄。
 * 推出来的结果是十个六冲、八个六合，与典籍相符，且由测试锁住个数与名目。
 */
function pairedBy(h: HexagramInfo, rel: ReadonlyMap<Branch, Branch>): boolean {
  for (let i = 1; i <= 3; i++) {
    if (rel.get(ganzhiAt(h, i).branch) !== ganzhiAt(h, i + 3).branch) return false;
  }
  return true;
}
export const isSixClash = (h: HexagramInfo): boolean => pairedBy(h, CLASH_OF);
export const isSixHarmony = (h: HexagramInfo): boolean => pairedBy(h, HE_OF);

/**
 * 装卦。
 *
 * 输出是**冻结的一等对象**，与 `BaseChart` 同构：算一次，后续只读。
 */
export function dress(casting: Casting, p: LiuyaoParams): DressedGua {
  const ben = hexagramOf(casting.benGua);
  const bian = casting.bianGua === null ? null : hexagramOf(casting.bianGua);
  const { month, day } = casting.moment.pillars;
  const kong = xunKongOf(sexagenaryIndexOf(day.stem, day.branch));
  const po = CLASH_OF.get(month.branch)!;
  const monthEl = branchElement(month.branch);
  const shen = liushenOf(day.stem);
  const movingSet = new Set(casting.moving);

  const yaos: YaoInfo[] = [];
  for (let i = 0; i < 6; i++) {
    const pos = i + 1;
    const { stem, branch } = ganzhiAt(ben, pos);
    const moving = movingSet.has(i);
    const rels = dayRelationsOf(day, branch);
    const isKong = kong.includes(branch);
    const isPo = branch === po;

    // 旬空与月破的解除判据 —— 各家不一，进参数
    const kongNull = !isKong ? null
      : moving && p.xunkong.dongBuKong ? "动而不空" as const
        : rels.includes("日冲") && p.xunkong.chongKongZeShi ? "冲空则实" as const
          : null;
    const poNull = isPo && moving && p.yuepo.dongErBuPo ? "破而逢动" as const : null;

    let bianInfo: YaoInfo["bian"] = null;
    if (moving && bian !== null) {
      const b = ganzhiAt(bian, pos);
      bianInfo = {
        stem: b.stem, branch: b.branch, element: branchElement(b.branch),
        // ⚠️ 按本卦的宫定 —— 见模块头
        liuqin: liuqinOfBranch(ben.palaceElement, b.branch),
        shengke: bianShengkeOf(branch, b.branch),
        flags: bianFlagsOf(branch, b.branch, kong, po),
      };
    }

    yaos.push({
      pos, yao: casting.benGua[i]!, moving, stem, branch,
      element: branchElement(branch),
      liuqin: liuqinOfBranch(ben.palaceElement, branch),
      liushen: shen[i]!,
      isShi: pos === ben.shi, isYing: pos === ben.ying,
      xunkong: isKong, xunkongNullified: kongNull,
      yuepo: isPo, yuepoNullified: poNull,
      monthPhase: monthPhaseOf(monthEl, branchElement(branch)),
      dayRelations: rels,
      bian: bianInfo,
    });
  }

  // 伏神：本卦缺的六亲，到本宫卦同位取
  const present = new Set(yaos.map((y) => y.liuqin));
  const pure = hexagramOf(composeHexagram(ben.palace, ben.palace));
  const fushen: FuShen[] = [];
  for (let pos = 1; pos <= 6; pos++) {
    const { stem, branch } = ganzhiAt(pure, pos);
    const q = liuqinOfBranch(ben.palaceElement, branch);
    if (present.has(q)) continue;
    if (fushen.some((f) => f.liuqin === q)) continue;
    const fei = yaos[pos - 1]!;
    fushen.push({
      liuqin: q, pos, stem, branch, element: branchElement(branch),
      feiBranch: fei.branch, feiLiuqin: fei.liuqin,
    });
  }

  const flags: DressedGua["flags"] = Object.freeze([
    ...(isSixClash(ben) ? ["六冲" as const] : []),
    ...(isSixHarmony(ben) ? ["六合" as const] : []),
    ...(fanyinOf(ben, bian) ? ["反吟" as const] : []),
    ...(fuyinOf(ben, bian) ? ["伏吟" as const] : []),
  ]);

  return Object.freeze({
    casting, ben, bian, yaos: Object.freeze(yaos), fushen: Object.freeze(fushen),
    shi: ben.shi, ying: ben.ying, kongBranches: kong, poBranch: po, flags,
  });
}

/**
 * 伏吟与反吟 —— **按纳甲地支比对，不按卦名**。
 *
 * 初稿写的是「本卦与变卦上下卦相同即伏吟」，方向正好反了：
 * 上下卦相同意味着那半边**根本没爻动**，那不是伏吟，是什么也没发生。
 * 伏吟的真正判据是：**变了，但变出来的三支与原来的三支逐位相同**
 * （乾与震的内卦同为子寅辰，故乾↔震即伏吟）。反吟则是逐位相冲。
 *
 * 故只检**确实变了的那一半**。
 */
function xunOf(ben: HexagramInfo, bian: HexagramInfo | null, kind: "伏" | "反"): boolean {
  if (bian === null) return false;
  for (const half of [[1, 2, 3], [4, 5, 6]] as const) {
    const t0 = half[0] === 1 ? ben.lower : ben.upper;
    const t1 = half[0] === 1 ? bian.lower : bian.upper;
    if (t0 === t1) continue;                       // 这一半没爻动，不论
    const a = half.map((i) => ganzhiAt(ben, i).branch);
    const b = half.map((i) => ganzhiAt(bian, i).branch);
    const hit = kind === "伏"
      ? a.every((x, k) => x === b[k])               // 变了，纳甲却逐位相同
      : a.every((x, k) => CLASH_OF.get(x) === b[k]); // 变了，纳甲逐位相冲
    if (hit) return true;
  }
  return false;
}
const fuyinOf = (b: HexagramInfo, x: HexagramInfo | null): boolean => xunOf(b, x, "伏");
const fanyinOf = (b: HexagramInfo, x: HexagramInfo | null): boolean => xunOf(b, x, "反");

/** 供叙述：爻位的传统指代。只作素材，不参与计算。 */
export const YAO_POSITION_IMAGE: readonly string[] = Object.freeze([
  "初爻 —— 事之始、基础、足",
  "二爻 —— 宅、内、股",
  "三爻 —— 门户、内外之交、腰",
  "四爻 —— 门、外之始、身",
  "五爻 —— 尊位、主事者、心",
  "上爻 —— 事之终、极、首",
]);

/** 地支序 —— 供测试比对。 */
export const branchOrder = branchIndex;

/**
 * 四柱合盘 —— 两张盘的结构关系。
 *
 * ## ⚠️ 这是整个项目里最该小心的一个功能
 *
 * 合盘是一个人最可能拿去**对另一个人下判断**的地方，
 * 而那个人多半不在场。前面所有功能都只描述一张盘；这里涉及两个人，
 * 其中一个从没同意过。
 *
 * 本模块因此有两条额外的纪律，比别处都严：
 *
 * ### 一、**不给合盘分数，一个都不给**
 *
 * 这与本项目别处的做法不同 —— 流年那边是给顺逆指数的。为什么这里不给：
 *
 * 流年的那个数说的是**一个人与一段时间**的结构契合度，抽象，
 * 而且那个人可以明年再看一次。
 * 合盘的数说的是**两个具体的人**。无论措辞怎么框，
 * 「我们合盘 42 分」只会被读成一句关于这段关系的判决 ——
 * 因为读者正是为那句判决来的。
 *
 * 而它可能促成的决定**不可撤回**，且牵连一个没有参与的人。
 *
 * 所以这里只给**逐条的结构关系**：哪两个干相合、哪两个支相冲、
 * 一方的用神在另一方盘里占多少权重。读者自己看，自己判断。
 * **不替他加总，因为加总就是替他下结论。**
 *
 * ### 二、不出人格描述
 *
 * 报告层对 `subject: "other"` 已有先例：人格、身心、六亲几节
 * **结构性略去**，不靠措辞扫描兜底。合盘沿用同一条线 ——
 * 本模块只产出两张盘之间的**关系**，不产出对任何一方的描述。
 * 想看某一方的描述，就去单独排那一张盘，并且自己清楚那是谁的盘。
 */

import type { Element, Stem, Branch } from "../types/ganzhi.js";
import {
  STEM_COMBINATIONS, STEM_CLASHES, BRANCH_SIX_COMBINATIONS,
  BRANCH_CLASHES, BRANCH_HARMS, TRINITIES,
  CONTROLS, GENERATES, STEM_ELEMENT,
} from "../ganzhi/tables.js";
import { totalsOf } from "../weights/assign.js";
import type { BaseChart } from "../chart/baseChart.js";

export type PillarKey = "年" | "月" | "日" | "时";

export const PILLAR_KEYS: readonly PillarKey[] = Object.freeze(["年", "月", "日", "时"]);

/** 柱位各自传统上关联的面向。**这是取象，不是断语。** */
export const PILLAR_DOMAIN: Readonly<Record<PillarKey, string>> = Object.freeze({
  年: "出身与家世的那一柱", 月: "成长环境与同辈的那一柱",
  日: "本人与配偶的那一柱", 时: "晚辈与晚年的那一柱",
});

export type RelationKind =
  | "天干五合" | "天干相冲" | "地支六合" | "地支相冲" | "地支相害" | "地支三合";

export interface PairRelation {
  readonly kind: RelationKind;
  /** 甲方的柱位。 */
  readonly from: PillarKey;
  /** 乙方的柱位。 */
  readonly to: PillarKey;
  readonly a: string;
  readonly b: string;
  /** 合化之神（仅合有）。 */
  readonly transformsTo?: Element;
  /** 这一条凭什么成立 —— 与报告层的推导链同一用途。 */
  readonly why: string;
}

export interface DayMasterRelation {
  readonly aStem: Stem;
  readonly bStem: Stem;
  readonly aElement: Element;
  readonly bElement: Element;
  /** 甲方日主对乙方日主的五行关系。 */
  readonly relation: "同" | "生出" | "被生" | "克出" | "被克";
  readonly combines: boolean;
  readonly clashes: boolean;
  readonly why: string;
}

export interface ElementSupply {
  /** 甲方的用神。 */
  readonly element: Element;
  readonly role: "用神" | "喜神";
  /** 该五行在乙方盘里占的权重比例 0–1。 */
  readonly shareInOther: number;
  /** 该五行在甲方自己盘里占的比例，供对照 —— 没有对照这个数读不出意思。 */
  readonly shareInSelf: number;
}

export interface BaziPairing {
  readonly dayMaster: DayMasterRelation;
  readonly relations: readonly PairRelation[];
  /** 甲方用神在乙方盘里的供给。 */
  readonly aNeedsFromB: readonly ElementSupply[];
  /** 乙方用神在甲方盘里的供给。 */
  readonly bNeedsFromA: readonly ElementSupply[];
  /** **恒为 null。** 见文件头：不给合盘分数。 */
  readonly score: null;
  readonly notes: readonly string[];
}

const pairIn = (
  table: readonly (readonly [string, string, ...unknown[]])[], x: string, y: string,
): readonly unknown[] | null => {
  for (const row of table) {
    if ((row[0] === x && row[1] === y) || (row[0] === y && row[1] === x)) return row;
  }
  return null;
};

/**
 * 两张盘之间的干支关系。
 *
 * 四柱对四柱共十六组。全部列出而不只看日柱 —— 只看日柱是一种取法，
 * 但那是**取法**，不是全部，而本模块的职责是把结构摆出来，不是替人选取法。
 */
function relationsBetween(a: BaseChart, b: BaseChart): readonly PairRelation[] {
  const out: PairRelation[] = [];
  const pillarsOf = (c: BaseChart): readonly (readonly [PillarKey, Stem | null, Branch])[] => [
    ["年", c.chart.year.stem, c.chart.year.branch],
    ["月", c.chart.month.stem, c.chart.month.branch],
    ["日", c.chart.day.stem, c.chart.day.branch],
    ...(c.chart.hour === null
      ? [] : [["时", c.chart.hour.stem, c.chart.hour.branch] as const]),
  ];
  for (const [ka, sa, ba] of pillarsOf(a)) {
    for (const [kb, sb, bb] of pillarsOf(b)) {
      if (sa !== null && sb !== null) {
        const c = pairIn(STEM_COMBINATIONS, sa, sb);
        if (c !== null) {
          out.push({
            kind: "天干五合", from: ka, to: kb, a: sa, b: sb,
            transformsTo: c[2] as Element,
            why: `${sa}${sb}相合，化${c[2] as string}`,
          });
        }
        if (pairIn(STEM_CLASHES, sa, sb) !== null) {
          out.push({
            kind: "天干相冲", from: ka, to: kb, a: sa, b: sb,
            why: `${sa}${sb}相冲 —— 同阴阳、相隔六位且五行相克`,
          });
        }
      }
      const bc = pairIn(BRANCH_SIX_COMBINATIONS, ba, bb);
      if (bc !== null) {
        out.push({
          kind: "地支六合", from: ka, to: kb, a: ba, b: bb,
          transformsTo: bc[2] as Element,
          why: `${ba}${bb}六合，化${bc[2] as string}`,
        });
      }
      if (pairIn(BRANCH_CLASHES, ba, bb) !== null) {
        out.push({
          kind: "地支相冲", from: ka, to: kb, a: ba, b: bb,
          why: `${ba}${bb}相冲 —— 相隔六位，方位相对`,
        });
      }
      if (pairIn(BRANCH_HARMS, ba, bb) !== null) {
        out.push({
          kind: "地支相害", from: ka, to: kb, a: ba, b: bb,
          why: `${ba}${bb}相害`,
        });
      }
      for (const tri of TRINITIES) {
        const set: readonly Branch[] = [tri.sheng, tri.wang, tri.mu];
        if (set.includes(ba) && set.includes(bb) && ba !== bb) {
          out.push({
            kind: "地支三合", from: ka, to: kb, a: ba, b: bb,
            transformsTo: tri.element,
            why: `${ba}${bb}同属${set.join("")}三合局，化${tri.element}（半合）`,
          });
        }
      }
    }
  }
  return Object.freeze(out);
}

function dayMasterRelation(a: BaseChart, b: BaseChart): DayMasterRelation {
  const aStem = a.chart.day.stem;
  const bStem = b.chart.day.stem;
  const ae = STEM_ELEMENT[aStem];
  const be = STEM_ELEMENT[bStem];
  let relation: DayMasterRelation["relation"];
  if (ae === be) relation = "同";
  else if (GENERATES[ae] === be) relation = "生出";
  else if (GENERATES[be] === ae) relation = "被生";
  else if (CONTROLS[ae] === be) relation = "克出";
  else relation = "被克";
  const combines = pairIn(STEM_COMBINATIONS, aStem, bStem) !== null;
  const clashes = pairIn(STEM_CLASHES, aStem, bStem) !== null;
  const verb = {
    同: "同为", 生出: "生", 被生: "受生于", 克出: "克", 被克: "受克于",
  }[relation];
  return {
    aStem, bStem, aElement: ae, bElement: be, relation, combines, clashes,
    why: `甲方日主${aStem}（${ae}）${verb}乙方日主${bStem}（${be}）`
      + (combines ? `；两干相合` : "") + (clashes ? `；两干相冲` : ""),
  };
}

function supplyOf(self: BaseChart, other: BaseChart, report: {
  readonly primary: Element; readonly xishen: readonly Element[];
}): readonly ElementSupply[] {
  // 五行占比由 L1 配重汇总 —— 走内核现成的 totalsOf，不另写一份加法
  const share = (c: BaseChart, e: Element): number => {
    const t = totalsOf(c.l1);
    return t.grand === 0 ? 0 : (t.byElement[e] ?? 0) / t.grand;
  };
  const items: ElementSupply[] = [{
    element: report.primary, role: "用神",
    shareInOther: share(other, report.primary),
    shareInSelf: share(self, report.primary),
  }];
  for (const e of report.xishen) {
    if (e === report.primary) continue;
    items.push({
      element: e, role: "喜神",
      shareInOther: share(other, e), shareInSelf: share(self, e),
    });
  }
  return Object.freeze(items);
}

export interface PairInput {
  readonly chart: BaseChart;
  /** 该方的用神 —— 由调用方自报告层取来，本模块不重算。 */
  readonly yongshen: { readonly primary: Element; readonly xishen: readonly Element[] };
}

/**
 * 两张四柱盘的结构关系。
 *
 * **不给分数**（`score` 恒为 `null`，由类型锁住），不出人格描述。
 * 见文件头。
 */
export function baziPairing(a: PairInput, b: PairInput): BaziPairing {
  return {
    dayMaster: dayMasterRelation(a.chart, b.chart),
    relations: relationsBetween(a.chart, b.chart),
    aNeedsFromB: supplyOf(a.chart, b.chart, a.yongshen),
    bNeedsFromA: supplyOf(b.chart, a.chart, b.yongshen),
    score: null,
    notes: Object.freeze([
      "这里列出的是两张盘之间的结构关系，不是对两个人的判断，"
      + "更不是对一段关系的判断。",
      "本项目不给合盘分数。流年那边给顺逆指数，是因为那个数说的是"
      + "一个人与一段时间；合盘说的是两个具体的人，而一个总分无论怎么框，"
      + "都会被读成一句关于这段关系的判决。",
      "相冲相害在传统取象里也不等于「不好」—— 冲是动，合是牵绊，"
      + "两者各有各的用处，取决于要办什么事。把它们读成吉凶，是把取象读成了判决。",
      "⚠️ 第二张盘是另一个人的生辰。本项目的数据始终不出本机 —— "
      + "但那是技术上的保证，与那个人知不知道这件事无关。两者是两回事。",
    ]),
  };
}

/**
 * 占事分类与用神取法。
 *
 * ## 原神、忌神、仇神是推出来的，不是抄的
 *
 * 四者由用神一位推出，与四柱 `conclude/yongshen.ts` 的 `assemble` 同一套反向查表：
 *
 * ```
 * 原神 = 生用神者   忌神 = 克用神者   仇神 = 生忌神者
 * ```
 *
 * 落到六亲空间上是一个固定的旋转（以卦宫五行为「我」时）：
 *
 * | 用神 | 原神 | 忌神 | 仇神 |
 * | 兄弟 | 父母 | 官鬼 | 妻财 |
 * | 子孙 | 兄弟 | 父母 | 官鬼 |
 * | 妻财 | 子孙 | 兄弟 | 父母 |
 * | 官鬼 | 妻财 | 子孙 | 兄弟 |
 * | 父母 | 官鬼 | 妻财 | 子孙 |
 *
 * 这张表**不写进代码**，由生克推出并由测试对账 —— 抄一张能推出来的表，
 * 只是给自己多一个抄错的机会。四柱那边的忌神方向就错过三次。
 *
 * ## 32 类占事
 *
 * 取用神是六爻里标准化程度最高的部分，各家分歧很小。
 * 大类供界面选择，具体占事决定用神。
 */

import type { Element } from "../types/ganzhi.js";
import { GENERATES, CONTROLS } from "../ganzhi/tables.js";
import { controlledBy, generatedBy } from "../ganzhi/algebra.js";
import { liuqinOf, type Liuqin } from "../yijing/najia.js";

/** 用神的取法。 */
export type UseSpec =
  | { readonly kind: "liuqin"; readonly value: Liuqin }
  /** 以世爻为用 —— 占自身。 */
  | { readonly kind: "shi" }
  /** 以应爻为用 —— 占对方。 */
  | { readonly kind: "ying" }
  /** 世应关系为主，无单一用神爻。 */
  | { readonly kind: "shiYing" }
  /** 用神随所问的人而定，须由调用方指明六亲。 */
  | { readonly kind: "caller" };

export type TopicCategory =
  | "自身" | "财" | "事业" | "文书学业" | "婚恋" | "亲属" | "出行" | "健康" | "其他";

export interface Topic {
  readonly id: string;
  readonly category: TopicCategory;
  readonly label: string;
  readonly use: UseSpec;
  /** 该类占事的输出受限，见 docs/13-liuyao.md §5.4。 */
  readonly restricted?: true;
}

export const TOPICS: readonly Topic[] = Object.freeze([
  // ── 自身 ──
  { id: "self.fortune", category: "自身", label: "近期运势", use: { kind: "shi" } },
  { id: "self.mood", category: "自身", label: "心境状态", use: { kind: "shi" } },
  { id: "self.wish", category: "自身", label: "谋望能否遂意", use: { kind: "shiYing" } },
  // ── 财 ──
  { id: "wealth.seek", category: "财", label: "求财、经营", use: { kind: "liuqin", value: "妻财" } },
  { id: "wealth.salary", category: "财", label: "薪资报酬", use: { kind: "liuqin", value: "妻财" } },
  { id: "wealth.invest", category: "财", label: "投资置业", use: { kind: "liuqin", value: "妻财" } },
  { id: "wealth.debt", category: "财", label: "借贷讨债", use: { kind: "liuqin", value: "妻财" } },
  { id: "wealth.lost", category: "财", label: "失物财货", use: { kind: "liuqin", value: "妻财" } },
  // ── 事业 ──
  { id: "career.job", category: "事业", label: "求职应聘", use: { kind: "liuqin", value: "官鬼" } },
  { id: "career.promotion", category: "事业", label: "升迁考核", use: { kind: "liuqin", value: "官鬼" } },
  { id: "career.project", category: "事业", label: "项目立项", use: { kind: "liuqin", value: "官鬼" } },
  { id: "career.partner", category: "事业", label: "合伙共事", use: { kind: "liuqin", value: "兄弟" } },
  { id: "career.lawsuit", category: "事业", label: "官非讼事", use: { kind: "liuqin", value: "官鬼" } },
  // ── 文书学业 ──
  { id: "doc.exam", category: "文书学业", label: "考试", use: { kind: "liuqin", value: "父母" } },
  { id: "doc.license", category: "文书学业", label: "证照资质", use: { kind: "liuqin", value: "父母" } },
  { id: "doc.contract", category: "文书学业", label: "合同契约", use: { kind: "liuqin", value: "父母" } },
  { id: "doc.house", category: "文书学业", label: "房产", use: { kind: "liuqin", value: "父母" } },
  { id: "doc.vehicle", category: "文书学业", label: "车辆", use: { kind: "liuqin", value: "父母" } },
  { id: "doc.news", category: "文书学业", label: "消息音信", use: { kind: "liuqin", value: "父母" } },
  // ── 婚恋 ──
  { id: "love.female", category: "婚恋", label: "男占女方", use: { kind: "liuqin", value: "妻财" } },
  { id: "love.male", category: "婚恋", label: "女占男方", use: { kind: "liuqin", value: "官鬼" } },
  { id: "love.harmony", category: "婚恋", label: "婚姻和合", use: { kind: "shiYing" } },
  // ── 亲属 ──
  { id: "kin.parents", category: "亲属", label: "占父母长辈", use: { kind: "liuqin", value: "父母" } },
  { id: "kin.children", category: "亲属", label: "占子女晚辈", use: { kind: "liuqin", value: "子孙" } },
  { id: "kin.siblings", category: "亲属", label: "占兄弟同辈", use: { kind: "liuqin", value: "兄弟" } },
  { id: "kin.subordinate", category: "亲属", label: "占下属", use: { kind: "liuqin", value: "子孙" } },
  // ── 出行 ──
  { id: "travel.trip", category: "出行", label: "行程", use: { kind: "shi" } },
  { id: "travel.return", category: "出行", label: "行人归期", use: { kind: "caller" } },
  { id: "travel.direction", category: "出行", label: "方位选择", use: { kind: "shi" } },
  // ── 健康 ──
  { id: "health.body", category: "健康", label: "身体状况", use: { kind: "liuqin", value: "官鬼" }, restricted: true },
  // ── 其他 ──
  { id: "other.findPerson", category: "其他", label: "寻人", use: { kind: "caller" } },
  { id: "other.counterparty", category: "其他", label: "合作方意向", use: { kind: "ying" } },
]);

export const TOPIC_BY_ID: ReadonlyMap<string, Topic> = new Map(TOPICS.map((t) => [t.id, t]));

export const TOPIC_CATEGORIES: readonly TopicCategory[] = Object.freeze([
  "自身", "财", "事业", "文书学业", "婚恋", "亲属", "出行", "健康", "其他",
]);

// ─────────────────────────────────────────────────────────

/** 用神所属五行（以卦宫五行为我时）→ 该六亲。 */
export function elementOfLiuqin(palaceElement: Element, q: Liuqin): Element {
  switch (q) {
    case "兄弟": return palaceElement;
    case "子孙": return GENERATES[palaceElement];
    case "妻财": return CONTROLS[palaceElement];
    case "官鬼": return controlledBy(palaceElement);
    case "父母": return generatedBy(palaceElement);
  }
}

export interface FourGods {
  readonly yong: Liuqin;
  /** 生用神者。 */
  readonly yuan: Liuqin;
  /** 克用神者。 */
  readonly ji: Liuqin;
  /** 生忌神者。 */
  readonly chou: Liuqin;
}

/**
 * 由用神一位推出四神。
 *
 * 用一个具体的卦宫五行做中转即可 —— 六亲之间的关系与选哪个宫无关，
 * 因为五种六亲恰好是五行环上的五个相对位置。测试对五个宫逐一验证这一点。
 */
export function fourGodsOf(yong: Liuqin, palaceElement: Element = "金"): FourGods {
  const e = elementOfLiuqin(palaceElement, yong);
  const yuan = liuqinOf(palaceElement, generatedBy(e));   // 生用神者
  const ji = liuqinOf(palaceElement, controlledBy(e));    // 克用神者
  const chou = liuqinOf(palaceElement, generatedBy(controlledBy(e))); // 生忌神者
  return { yong, yuan, ji, chou };
}

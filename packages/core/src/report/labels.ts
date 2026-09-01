/**
 * 枚举 → 中文标签。
 *
 * 内核里的枚举一律用英文标识（`weakened`、`both-favorable`、`luRen`、
 * `yangForwardYinReverse`…），它们是**代码的词汇**，不是读者的词汇。
 * 少映射一个，中文报告里就会冒出一截英文 —— 这类漏网在 P7b 已经发生过一次
 * （流月叙述里的「月支寅害 month 支巳」），故此处集中一处，并由
 * test/report.spec.ts 扫描报告全文中的连续拉丁字母来兜底。
 */

import type { Carrier } from "../weights/carrier.js";

const freeze = <T extends Record<string, string>>(o: T): Readonly<T> => Object.freeze(o);

/** 神煞的状态修饰。 */
export const TONE_LABEL = freeze({
  strengthened: "坐旺得势",
  weakened: "坐衰减力",
  activated: "被引动",
  neutralized: "落空得解",
});

/** 宫星同参的四象限。 */
export const QUADRANT_LABEL = freeze({
  "both-favorable": "宫星两得力",
  "palace-only": "宫得力而星不足",
  "star-only": "星得力而宫不足",
  neither: "宫星俱不得力",
});

/** 通根的等级。 */
export const ROOT_KIND_LABEL = freeze({
  luRen: "禄刃", changsheng: "长生", ku: "库根", yuqi: "余气", none: "无根",
});

/** 取用之法。 */
export const YONGSHEN_METHOD_LABEL = freeze({
  tiaohou: "调候", fuyi: "扶抑", tongguan: "通关", bingyao: "病药",
});

/** 旺衰五档。 */
export const BAND_LABEL_ZH = freeze({
  VERY_STRONG: "身极旺", STRONG: "身旺", BALANCED: "中和",
  WEAK: "身弱", VERY_WEAK: "身极弱",
});

/** 流派开关的取值。 */
export const SCHOOL_LABEL = freeze({
  // 日界
  lateZiNextDay: "晚子换日", earlyZiSameDay: "早子不换", split: "折衷（日柱不换、时干进位）",
  // 命宫月界
  jie: "以节为界", zhongqi: "以中气为界",
  // 十二长生
  yangForwardYinReverse: "阳顺阴逆", sameBirthDeath: "阴阳同生同死",
  // 土的长生
  fireEarthSame: "火土同宫", waterEarthSame: "水土同宫",
  // 调候来源
  heuristic: "可计算的降级规则（《穷通宝鉴》表未录入）", table: "《穷通宝鉴》120 格表",
  // 女命子女星
  standard: "常规取法", reversed: "反取",
  // 起运换算
  continuous: "连续换算", traditionalDiscrete: "传统离散口诀",
});

/** 结构事件的结局。 */
export const OUTCOME_LABEL = freeze({
  transformed: "合化成", bound: "合而不化（合绊）", contested: "争合妒合",
  neutralized: "被裁为不成立", broken: "合被冲破", applied: "生效", partial: "只见两支",
});

export const SEVERITY_LABEL = freeze({ mild: "轻微", notable: "明显" });

export const label = (map: Readonly<Record<string, string>>, key: string): string =>
  map[key] ?? key;

// ─────────────────────────────────────────────────────────
// 载体 id → 可读标签
// ─────────────────────────────────────────────────────────

const PILLAR_SHORT: Readonly<Record<string, string>> = Object.freeze({
  year: "年", month: "月", day: "日", hour: "时",
  luck: "运", annual: "岁", taiyuan: "胎",
});

/**
 * `month.branch.0` → `月支丙(本气)`。
 * 桑基图与流量表若直接显示 id，读者无从对照盘面。
 */
export function carrierLabel(c: Carrier): string {
  const p = PILLAR_SHORT[c.position.pillar] ?? c.position.pillar;
  if (c.position.layer === "stem") return `${p}干${c.stem}`;
  return `${p}支${c.stem}${c.role === null ? "" : `(${c.role})`}`;
}

export function carrierLabelMap(cs: readonly Carrier[]): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(cs.map((c) => [c.id, carrierLabel(c)])));
}

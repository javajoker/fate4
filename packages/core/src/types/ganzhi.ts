/**
 * 干支基础类型。
 *
 * 设计取向：以汉字本身作为字面量类型，不引入英文别名层。
 * 命理领域的每个概念都有精确且唯一的汉字名，任何翻译层都只会引入歧义与查表成本。
 */

export const ELEMENTS = ["木", "火", "土", "金", "水"] as const;
export type Element = (typeof ELEMENTS)[number];

export const POLARITIES = ["阳", "阴"] as const;
export type Polarity = (typeof POLARITIES)[number];

export const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
export type Stem = (typeof STEMS)[number];

export const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;
export type Branch = (typeof BRANCHES)[number];

export const TEN_GODS = [
  "比肩", "劫财", "食神", "伤官", "偏财",
  "正财", "七杀", "正官", "偏印", "正印",
] as const;
export type TenGod = (typeof TEN_GODS)[number];

/** 十二长生，顺序即为运行次序。索引对应 §01-foundations 表列。 */
export const CHANGSHENG_PHASES = [
  "长生", "沐浴", "冠带", "临官", "帝旺", "衰",
  "病", "死", "墓", "绝", "胎", "养",
] as const;
export type ChangshengPhase = (typeof CHANGSHENG_PHASES)[number];

/** 藏干在其宿主地支中的位次。 */
export type HiddenRole = "本气" | "中气" | "余气";

/**
 * 载体 i 施于载体 j 的作用关系（有向）。
 * `无` 表示 i 在此方向上不施力（即 j 生 i 或 j 克 i），
 * 其作用由遍历 (j, i) 这一有序对时计入 —— 绝不可在同一方向重复计算。
 */
export type ActingRelation = "生" | "克" | "同" | "无";

/** 通根强度分级，系数见 params.conclusion.rootCoef。 */
export type RootKind = "luRen" | "changsheng" | "ku" | "yuqi" | "none";

/** 十二长生流派。切换会显著改变通根与旺衰判定。 */
export type ChangshengSchool = "yangForwardYinReverse" | "sameBirthDeath";

/** 土的长生归属流派。 */
export type EarthChangsheng = "fireEarthSame" | "waterEarthSame";

export interface HiddenStem {
  readonly stem: Stem;
  readonly role: HiddenRole;
  /** 该藏干在本支 60 分中所占比例，来自 params.weights.hiddenSplit。 */
  readonly share: number;
}

export interface Pillar {
  readonly stem: Stem;
  readonly branch: Branch;
}

/** 六十甲子序号，0 = 甲子，59 = 癸亥。 */
export type SexagenaryIndex = number;

/**
 * 参数类型。
 *
 * **默认值的真源在 `defaults.ts`（TypeScript）**，`params/default.yaml` 是与之平行的
 * 文档表述。二者由 `test/params.spec.ts` 断言逐项一致 —— 任一处漂移即构建失败。
 *
 * 之所以不让 YAML 作真源：core 需在浏览器、Node、Worker 中跑同一份代码且零运行时依赖，
 * 而读 YAML 要么引入解析器，要么加一道代码生成。TS 作真源则天然有编译期类型保证。
 */

export interface WeightParams {
  readonly pillarBase: number;
  /** 天干占一柱的比例；地支得其余。二者之和须为 1。 */
  readonly stemShare: number;
  readonly branchShare: number;
  /** 地支分数下发给藏干的比例，按藏干个数取用。每组之和须为 1。 */
  readonly hiddenSplit: {
    readonly 1: readonly [number];
    readonly 2: readonly [number, number];
    readonly 3: readonly [number, number, number];
  };
  readonly monthCommand: {
    readonly branchMultiplier: number;
    readonly stemMultiplier: number;
    readonly silingBoost: number;
    readonly useSilingTable: boolean;
    readonly silingResolution: "exact" | "sameElement" | "none";
    readonly silingPolarityOverride: boolean;
  };
  readonly luck: {
    readonly total: number;
    readonly mode: "linear" | "step";
    readonly stemShareStart: number;
    readonly stemShareEnd: number;
    readonly stepFirstHalf: number;
    readonly stepSecondHalf: number;
  };
  readonly year: {
    readonly total: number;
    readonly stem: number;
    readonly branch: number;
    readonly stemBranchSwing: boolean;
  };
  readonly kongwang: {
    readonly enabled: boolean;
    readonly factor: number;
    readonly releasedByChong: boolean;
    readonly releasedByHe: boolean;
    readonly applyToLuckAnnual: boolean;
  };
  /** 刻意置 1.00 —— 透干效应由 L3 的距离模型承担，此处再加即重复计入。 */
  readonly revealedResonance: number;
  readonly includeTaiyuan: boolean;
  readonly taiyuanTotal: number;
}

export type HeKind = "sanhui" | "sanhe" | "banhe" | "gong" | "liuhe" | "ganhe";

export interface GainDecay { readonly gain: number; readonly decay: number }

export interface StructureParams {
  readonly precedence: readonly string[];
  readonly sanhui: GainDecay;
  readonly sanhe: GainDecay;
  readonly banhe: {
    readonly shengWang: GainDecay;
    readonly wangMu: GainDecay;
    readonly gong: GainDecay;
  };
  readonly heDistance: { readonly adjacent: number; readonly gap1: number; readonly gap2: number };
  readonly externalHeFactor: number;
  readonly transform: {
    readonly requireMonthSupport: boolean;
    readonly requireCatalyst: boolean;
    readonly catalystThreshold: number;
    readonly blockOnContention: boolean;
    readonly blockOnChong: boolean;
    readonly gainOnSuccess: number;
    readonly bindFactorOnFailure: number;
    readonly contentionFactor: number;
    readonly ganheRequireAdjacent: boolean;
  };
  readonly chong: {
    readonly uprootThreshold: number;
    readonly strongLoss: number;
    readonly weakLoss: number;
    readonly weakLossUproot: number;
    readonly equalLoss: number;
    readonly equalBandRatio: number;
    readonly distance: {
      readonly adjacent: number; readonly gap1: number; readonly gap2: number;
      readonly luckToNatal: number; readonly annualToNatal: number; readonly luckToAnnual: number;
    };
  };
  readonly ganchong: { readonly factor: number; readonly requireAdjacent: boolean };
  readonly arbitration: {
    readonly heTypeCoef: Readonly<Record<"sanhui" | "sanhe" | "banhe" | "liuhe", number>>;
    readonly chongCoef: number;
    readonly decisiveMargin: number;
    readonly mutualDamageFactor: number;
  };
  readonly tomb: {
    readonly sealedFactor: number;
    readonly openOnChong: boolean;
    readonly openOnXing: boolean;
    readonly releaseGain: number;
  };
  readonly xing: {
    readonly fullFactor: number;
    readonly ziMaoFactor: number;
    readonly selfFactor: number;
    readonly partialFactor: number;
  };
  readonly hai: { readonly factor: number };
  readonly po: { readonly enabled: boolean; readonly factor: number };
}

export interface PropagationParams {
  readonly mode: "syncIterative";
  readonly damping: number;
  /**
   * 迭代轮数 —— **这是「交互深度」参数，不是收敛控制**。
   *
   * 本系统是齐次线性映射 W ← (I+λA)W，展开为 I + kλA + C(k,2)(λA)² + …：
   * 一阶项随 k **线性增长**，故轮数直接决定「让生克作用发生多少」，
   * 没有自然的截断点。迭代到「收敛」等于幂迭代，结果趋于主特征向量 ——
   * 那只由结构决定，会**完全遗忘 L1 的月提与司令分野**。故必须取小的定值。
   */
  readonly maxRounds: number;
  /** 提前停止的安全阀（归一分布几乎不动时）。**不是**主控制。 */
  readonly epsilon: number;
  /** 单轮任一载体的总流出上限，占其当前权重的比例。 */
  readonly outflowCap: number;
  /**
   * 单轮任一载体因受克而损失的上限，占其当前权重的比例。
   *
   * 与流出上限对称。缺了它，一个大载体的全部克力可能砸在唯一的小目标上，
   * 一轮之内把它蒸发 —— 克应当削弱，不应当汽化。
   */
  readonly inflowDamageCap: number;
  readonly floor: number;
  readonly kernel: { readonly sheng: number; readonly ke: number };
  /** 生的传输效率 η；(1−η) 为损耗，不进入任何载体。 */
  readonly shengEfficiency: number;
  /** 克者自耗，占其造成伤害的比例。 */
  readonly keCost: number;
  readonly polarity: {
    readonly shengCross: number; readonly shengSame: number;
    readonly keSame: number; readonly keCross: number;
  };
  readonly tongdang: {
    readonly mode: "resistance" | "additive";
    readonly beta: number;
    readonly additiveKernel: number;
  };
  readonly distance: {
    readonly samePillar: number;
    readonly sameBranchHidden: number;
    readonly adjacent: number;
    readonly gap1: number;
    readonly gap2: number;
    readonly crossLayerFactor: number;
  };
  readonly external: {
    readonly luckToNatal: number;
    readonly annualToNatal: number;
    readonly luckToAnnual: number;
    readonly natalToLuck: number;
    readonly natalToAnnual: number;
    readonly annualToDayMasterBonus: number;
  };
}

export type ChangshengSchoolName = "yangForwardYinReverse" | "sameBirthDeath";
export type EarthChangshengName = "fireEarthSame" | "waterEarthSame";

export interface ConclusionParams {
  /** ⚠️ 流派开关：直接改变通根评分，进而改变旺衰判定。 */
  readonly changshengSchool: ChangshengSchoolName;
  readonly earthChangsheng: EarthChangshengName;
  readonly strengthBands: {
    readonly veryStrong: number; readonly strong: number;
    readonly balancedLow: number; readonly weak: number;
  };
  readonly confidence: { readonly bandMargin: number; readonly floor: number };
  readonly rootCoef: {
    readonly luRen: number; readonly changsheng: number;
    readonly ku: number; readonly yuqi: number;
  };
  readonly congge: {
    readonly ratioThreshold: number;
    readonly requireRootless: boolean;
    readonly yinThreshold: number;
  };
  readonly specialGe: {
    readonly zhuanwangThreshold: number;
    readonly suppressThreshold: number;
    readonly enableHuaqi: boolean;
    readonly huaqiConfidenceCap: number;
  };
  readonly yongshen: {
    readonly priority: readonly string[];
    readonly tiaohou: {
      /** heuristic = 可计算的极端气候降级；table = 《穷通宝鉴》120 格（待转录）。 */
      readonly source: "heuristic" | "table";
      readonly fireFloor: number;
      readonly waterFloor: number;
    };
    readonly weakYongshenThreshold: number;
    readonly tongguan: { readonly balanceBand: number; readonly dominanceFloor: number };
    readonly bingyao: { readonly damageThreshold: number };
  };
  readonly femaleChildStarVariant: "standard" | "reversed";
}

export interface ShenshaParams {
  /** 起例基准。现代通行以日干/日支为主，年为辅。 */
  readonly primaryBase: "day" | "year";
  readonly alsoComputeYearBase: boolean;
  readonly scanTargets: readonly string[];
  /** ⚠️ 福星/天厨/词馆 起例文献差异大，默认不启用。 */
  readonly includeDisputed: boolean;
  /** ⚠️ 阴干羊刃有分歧，默认不取。 */
  readonly yinYangRen: boolean;
  /** ⚠️ 元辰起例记载不一，默认关闭。 */
  readonly yuanchen: boolean;
  readonly tianluodiwang: { readonly enabled: boolean; readonly applyNayinFilter: boolean };
  readonly modifiers: {
    readonly zuowangThreshold: number;
    readonly zuoshuaiThreshold: number;
  };
}

export interface TemporalParams {
  readonly qiyun: { readonly mode: "continuous" | "traditionalDiscrete"; readonly daysPerYear: number; readonly reportBothModes: boolean };
  readonly luckPillarCount: number;
  readonly includeXiaoyun: boolean;
  readonly yearRangeYears: number;
  readonly sampleLuckAt: readonly string[];
  /** [硬约束] 流月不重算权重。改为 true 则构建期报错。 */
  readonly monthLayer: { readonly recomputeWeights: false; readonly maxInteractionsShown: number };
  /** [硬约束] 流日不重算权重。 */
  readonly dayLayer: { readonly recomputeWeights: false; readonly severityLevels: number };
  readonly index: { readonly a: number; readonly b: number };
}

export interface Params {
  readonly version: number;
  readonly weights: WeightParams;
  readonly structure: StructureParams;
  readonly propagation: PropagationParams;
  readonly conclusion: ConclusionParams;
  readonly shensha: ShenshaParams;
  readonly temporal: TemporalParams;
}

/** 递归可选，供覆盖用。 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K]
    : T[K] extends object ? DeepPartial<T[K]>
    : T[K];
};

export type PartialParams = DeepPartial<Params>;

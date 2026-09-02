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
    readonly bingyao: {
      /**
       * 病药的门槛是**尺度无关**的折损比，不是绝对流量：
       * `damage / (W_用神 + damage) > damageShare`。
       * 绝对门槛会让同一张盘因为算的是本命还是「本命+大运+流年」而改变取用法 ——
       * 载体多了，流量自然大，与病之轻重无关。
       */
      readonly damageShare: number;
      /** 绝对下限，挡住「用神本就不存在」的盘：折损比再高也只是两个小数在比。 */
      readonly damageFloor: number;
    };
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

/**
 * L0 排盘的开关。
 *
 * 这些原先只存在于 `params/default.yaml` 的文档里，TS 侧没有对应物 ——
 * 实际取值靠调用方逐项传 `ChartOptions`。于是参数校准面板拿不到它们，
 * 而其中四项恰是最需要人工择定的流派开关。补进真源。
 */
export interface ChartParams {
  readonly ziHourRule: "lateZiNextDay" | "earlyZiSameDay" | "split";
  readonly mingGongBoundary: "jie" | "zhongqi";
  readonly hiddenStemVariant: "standard" | "alt";
  readonly trueSolarTime: boolean;
  readonly equationOfTime: boolean;
  readonly handleDst: boolean;
  /** [硬约束] 传统不反转季节。南半球生人仍按北半球节气定月。 */
  readonly southernHemisphereFlip: boolean;
  readonly includeShenGong: boolean;
  readonly includeTaiXi: boolean;
}

/**
 * L4p 人格层。
 *
 * 两张知识表（十神特质、《内经》五行配属）按 `conventional`（通行表述）实现，
 * **允许经参数替换底本** —— 与《穷通宝鉴》调候表同样的处理：
 * 表在代码里，来源在参数里，随盘声明。
 */
export interface PersonaParams {
  /** [流派] 十神特质表的底本。 */
  readonly source: "conventional";
  /** [校准] 某十神占同侧分布的比例超此值判「过旺」。 */
  readonly excessShare: number;
  /** [校准] 低于此值判「过弱」；为 0 即「缺」。 */
  readonly deficientShare: number;
  /**
   * [校准] 主导十神的并列判据：前二名占比之差小于此值即并列，且置信度随之下调。
   *
   * 置信度公式 `0.45 + 0.15 × gap / dominantMargin` 与它**由构造对齐** ——
   * `gap = dominantMargin` 时恰好得 0.60，即模板的 `confidenceFloor`。
   * 于是「判为并列」与「改用留有余地的措辞」永远同进同出，与本值取多少无关。
   */
  readonly dominantMargin: number;

  // ── 形体与脏腑（§2.7）──
  /** [流派] 《内经》五行配属表的底本。 */
  readonly neijingSource: "conventional";
  /** [流派] 五窍配属。内经内部两篇不一致，见 conclude/neijing.ts。 */
  readonly wuqiaoSource: "yinyangYingxiang" | "jinguiZhenyan";
  /** `subject: other` 时强制关闭 —— 形体与脏腑都是对一个人身体的描述。 */
  readonly bodyCorrespondence: boolean;
  /** [校准] 相对五行均分的偏离超此值判「实」。 */
  readonly excessBand: number;
  /** [校准] 低于负此值判「虚」。 */
  readonly deficientBand: number;
  /**
   * [校准] **受克份额**相对均分的偏离，超此值判「受制」或「被伐」。
   *
   * 不用「受克 / 自身权重」—— 低权重必然高比值，虚与被伐会由构造耦合。
   */
  readonly attackedBand: number;
  /** [校准] 月令对寒热轴的修正幅度。 */
  readonly seasonAdjust: number;
  /** [校准] 寒热轴与燥湿轴判「偏」的门槛，|H| 或 |D| 小于此值即为平。 */
  readonly axisBand: number;
}

/** L5c 曲线层。 */
export interface SeriesParams {
  /** 统计基准窗的年数，自起运起算。 */
  readonly spanYears: number;
  /** 曲线绘制的年数。 */
  readonly drawYears: number;
  /**
   * [硬约束] 每年采样点数。
   *
   * 取月度而非年度：曲线本来就是连续的 —— 流年是阶跃、大运是斜坡
   * （天干占比自 0.70 线性降到 0.30），而**结构的结局也在运内变化**：
   * 实测 528 步运里 191 次出现同一组参与者的事件结局翻转
   * （冲而拔根 ⇄ 相冲、合解冲 ⇄ 相冲）。年度采样会把这些整个抹掉。
   *
   * 月度上有变化是因为大运份额在推移，**不是流月加了分** —— 后者由
   * `fleetingMonthInWeights` 硬约束禁止。
   */
  readonly samplesPerYear: number;
  /** [硬约束] 流月不参与权重。只入符号层（神煞、扰动）。 */
  readonly fleetingMonthInWeights: boolean;
  /** [校准] 扰动系数。 */
  readonly agitation: {
    readonly chong: number;
    readonly sanheSanhui: number;
    readonly liuhe: number;
    readonly xing: number;
    readonly hai: number;
    readonly po: number;
    readonly layerLuck: number;
    readonly layerAnnual: number;
    readonly layerMonth: number;
  };
}

/** L5n 统计节点。 */
export interface LiuyaoParams {
  /**
   * ⚠️ [流派] 起卦法。
   *
   * `coin` 是六爻本法；`time` 借的是梅花易数的时间起卦，
   * 与京房纳甲断卦是**混用**（见 docs/13-liuyao.md §1.3）。混用不静默，随卦声明。
   */
  readonly castMethod: "time" | "number" | "coin";
  readonly timeCast: {
    /** [硬约束] 按时起卦须用农历月日。改为其他即构建期报错 —— 那样得到的卦不属于任何传统排法。 */
    readonly calendar: "lunar";
    /**
     * ⚠️ [流派] 起卦公式里的「年」取哪条年界。
     *
     * 公式其余部分全在农历口径，故默认取农历年（正月初一为界）；
     * 另一说取立春年，与四柱同界。两者在正月初一与立春之间的那几周里不同。
     */
    readonly yearBoundary: "lunarNewYear" | "lichun";
  };
  readonly coin: {
    /** ⚠️ [流派] 铜钱以哪一面为阳。背为阳是通行做法，字为阳亦有传。 */
    readonly yangFace: "back" | "face";
  };
  readonly fushen: {
    /** ⚠️ [流派] 伏神能否「得出」的判据，各家不一。 */
    readonly rules: "conventional";
  };
  readonly guashen: {
    /** ⚠️ 卦身起法两大类且分歧大，默认关闭。 */
    readonly enabled: boolean;
  };
  readonly xunkong: {
    /** 动而不空 —— 空爻若发动，不以空论。 */
    readonly dongBuKong: boolean;
    /** 冲空则实 —— 空爻逢日辰冲，不以空论。 */
    readonly chongKongZeShi: boolean;
  };
  readonly yuepo: {
    /** 破而逢动，破而不破。 */
    readonly dongErBuPo: boolean;
  };
  readonly topics: {
    readonly health: {
      readonly enabled: boolean;
      /** [硬约束] 健康类不产出时间窗。「病在某月」是本系统绝不输出的句式。 */
      readonly emitYingqi: false;
    };
  };
  readonly yingqi: {
    readonly horizonMonths: number;
    /** [硬约束] 应期只到月建，不到日时 —— 与统计节点同一条纪律。 */
    readonly granularity: "month";
  };
  /** [硬约束] 一事不二占。允许重掷等于允许摇到满意为止。 */
  readonly oncePerQuestion: true;
}

export interface QimenParams {
  /**
   * ⚠️ [流派] 定局法。
   *
   * `chaibu` 拆补法：符头定三元，节气不足十五日者拆补。
   * `zhirun` 置闰法（超神接气）：另立闰奇。两法在部分日期给出不同的局，分歧不小。
   * 目前只实现拆补，`zhirun` 会在构建期报错 —— 声明了却没实现，比不声明更糟。
   */
  readonly juMethod: "chaibu" | "zhirun";
  /**
   * ⚠️ [流派] 盘式。
   *
   * `zhuan` 转盘：九星沿洛书圆序整体旋转，天禽寄坤二。
   * `fei` 飞盘：按宫数飞布，天禽入中不寄。两者是不同的流派，结论可以相反。
   * 目前只实现转盘。
   */
  readonly plate: "zhuan" | "fei";
}

export interface NodesParams {
  /** [校准] 主门槛。|z| 或 |ż| 超此值即进入穿越区间。 */
  readonly threshold: number;
  /** [校准] 次级门槛，供「值得注意」一档。 */
  readonly noticeThreshold: number;
  /**
   * [硬约束] 中尺度的估计量。
   *
   * 中节点的样本量只有六（六十年六步运）。样本标准差在 n=6 时极不稳 ——
   * 任何一步稍偏都会被放大成 2σ，中节点近乎恒有产出，也就等于没有产出。
   * 必须用中位数与绝对中位差：`0.6745 × (x − M) / MAD`。
   */
  readonly mediumEstimator: "robustMAD";
  /**
   * [硬约束] 交点的时间精度。
   *
   * 采样本就是月度，在两个相邻月之间线性插值到某一天是伪精度 ——
   * 流月不加权，序列在月内并无独立信息。
   */
  readonly interpolateTo: "month";
  /**
   * [校准] 峰值处的相对摆动下限。
   *
   * 近乎平直的序列里，σ 极小，任何抖动都会被放大成大 z。
   * 故除 σ>0 之外再加一条：峰值须真的动了 —— 相对自身量级至少这么多。
   */
  readonly minRelativeSwing: number;
  /** [校准] 两段同号穿越之间若只隔这么多个月，合并为一段。 */
  readonly bridgeGapMonths: number;
  /** 每个尺度呈现的最大条数。 */
  readonly maxShown: number;
}

export interface ReportParams {
  readonly locale: "zh-Hans" | "zh-Hant" | "en";
  readonly showConvergenceHistory: boolean;
  readonly showParamsSnapshot: boolean;
  readonly guard: {
    /** [硬约束] 措辞扫描不可关闭。 */
    readonly enforceBannedTerms: boolean;
    readonly scanExportBeforeWrite: boolean;
    /** [硬约束] 禁止红绿吉凶配色。低顺逆指数是结构描述，不是价值判断。 */
    readonly neutralPalette: boolean;
  };
}

export interface Params {
  readonly version: number;
  readonly chart: ChartParams;
  readonly weights: WeightParams;
  readonly structure: StructureParams;
  readonly propagation: PropagationParams;
  readonly conclusion: ConclusionParams;
  readonly shensha: ShenshaParams;
  readonly temporal: TemporalParams;
  readonly persona: PersonaParams;
  readonly series: SeriesParams;
  readonly nodes: NodesParams;
  readonly liuyao: LiuyaoParams;
  readonly qimen: QimenParams;
  readonly report: ReportParams;
}

/** 递归可选，供覆盖用。 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K]
    : T[K] extends object ? DeepPartial<T[K]>
    : T[K];
};

export type PartialParams = DeepPartial<Params>;

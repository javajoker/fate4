/**
 * 默认参数 —— **本文件是默认值的唯一真源**。
 * `params/default.yaml` 是平行的文档表述，由 test/params.spec.ts 断言一致。
 *
 * 每个数值的理由见 docs/03-weights.md。凡标 [校准] 者由金标准集拟合，
 * 标 [流派] 者为人工决策项，二者不可混（docs/11-validation.md §4.3）。
 */
import type { Params } from "./types.js";

export const DEFAULT_PARAMS: Params = Object.freeze({
  version: 1,
  chart: Object.freeze({
    ziHourRule: "lateZiNextDay",      // [流派] ⚠️ 待校准 #6
    mingGongBoundary: "jie",          // [流派] ⚠️ 待校准 #1
    hiddenStemVariant: "standard",    // [流派] ⚠️ 待校准 #5
    trueSolarTime: true,
    equationOfTime: true,
    handleDst: true,
    southernHemisphereFlip: false,    // [硬约束]
    includeShenGong: false,
    includeTaiXi: false,
  }),
  weights: Object.freeze({
    pillarBase: 100,
    stemShare: 0.40,
    branchShare: 0.60,
    hiddenSplit: Object.freeze({
      1: Object.freeze([1.0]),
      2: Object.freeze([0.70, 0.30]),
      3: Object.freeze([0.65, 0.25, 0.10]),
    }),
    monthCommand: Object.freeze({
      branchMultiplier: 2.00,   // [校准] 60 × 2.00 = 120
      stemMultiplier: 1.20,     // [校准] 40 × 1.20 = 48
      silingBoost: 1.50,        // [校准] 加成后在月支内重归一，总量不变
      useSilingTable: true,
      silingResolution: "sameElement",
      silingPolarityOverride: false,
    }),
    luck: Object.freeze({
      total: 130,               // [校准] 十年环境，力量大于任一本命柱
      mode: "linear",
      stemShareStart: 0.70,     // 交运时
      stemShareEnd: 0.30,       // 换运前；交叉点恰在第 5 年末
      stepFirstHalf: 0.65,
      stepSecondHalf: 0.35,
    }),
    year: Object.freeze({
      total: 110,               // [校准] 太岁君临，仅当年有效
      stem: 40,
      branch: 70,               // 注意 40:70，非本命的 40:60
      stemBranchSwing: false,
    }),
    kongwang: Object.freeze({
      enabled: true,
      factor: 0.80,
      releasedByChong: true,
      releasedByHe: true,
      applyToLuckAnnual: false,
    }),
    revealedResonance: 1.00,
    includeTaiyuan: false,
    taiyuanTotal: 40,
  }),
  structure: Object.freeze({
    // L2 只察不改 —— 见 StructureParams.rewriteCarriers 的说明与
    // docs/04-structure.md §0「察与改是两件事」里的实测影响。
    rewriteCarriers: false,
    // 范围大者优先、成局者优先、静者先于动者
    precedence: Object.freeze([
      "sanhui", "sanhe", "banhe", "liuhe", "ganhe",
      "chong", "ganchong", "xing", "hai", "po",
    ]),
    sanhui: Object.freeze({ gain: 1.40, decay: 0.50 }),
    sanhe: Object.freeze({ gain: 1.30, decay: 0.60 }),
    banhe: Object.freeze({
      shengWang: Object.freeze({ gain: 1.20, decay: 0.75 }),
      wangMu: Object.freeze({ gain: 1.15, decay: 0.80 }),
      gong: Object.freeze({ gain: 1.05, decay: 0.95 }),
    }),
    heDistance: Object.freeze({ adjacent: 1.00, gap1: 0.80, gap2: 0.60 }),
    externalHeFactor: 0.90,
    transform: Object.freeze({
      requireMonthSupport: true,
      requireCatalyst: true,
      catalystThreshold: 30,
      blockOnContention: true,
      blockOnChong: true,
      gainOnSuccess: 1.20,
      bindFactorOnFailure: 0.70,
      contentionFactor: 0.85,
      ganheRequireAdjacent: true,
    }),
    chong: Object.freeze({
      uprootThreshold: 2.50,
      strongLoss: 0.20,
      weakLoss: 0.50,
      weakLossUproot: 0.75,
      equalLoss: 0.35,
      equalBandRatio: 1.20,
      distance: Object.freeze({
        adjacent: 1.00, gap1: 0.60, gap2: 0.30,
        luckToNatal: 0.90, annualToNatal: 0.85, luckToAnnual: 1.00,
      }),
    }),
    ganchong: Object.freeze({ factor: 0.50, requireAdjacent: true }),
    arbitration: Object.freeze({
      heTypeCoef: Object.freeze({ sanhui: 1.00, sanhe: 0.85, banhe: 0.65, liuhe: 0.55 }),
      chongCoef: 2.00,
      decisiveMargin: 1.20,
      mutualDamageFactor: 0.60,
    }),
    tomb: Object.freeze({
      sealedFactor: 0.60, openOnChong: true, openOnXing: true, releaseGain: 1.30,
    }),
    xing: Object.freeze({
      fullFactor: 0.80, ziMaoFactor: 0.85, selfFactor: 0.90, partialFactor: 0.93,
    }),
    hai: Object.freeze({ factor: 0.93 }),
    po: Object.freeze({ enabled: true, factor: 0.97 }),
  }),
  propagation: Object.freeze({
    mode: "syncIterative",
    damping: 0.50,      // [校准] 与 maxRounds 共同决定交互深度
    maxRounds: 3,       // [校准] 交互深度，非收敛控制 —— 见 types.ts 说明
    epsilon: 0.002,     // 安全阀，非主控制
    outflowCap: 0.35,
    inflowDamageCap: 0.40,
    floor: 0.0,
    kernel: Object.freeze({ sheng: 0.30, ke: 0.40 }),   // 克重于生，是有意的
    shengEfficiency: 0.85,
    keCost: 0.30,
    polarity: Object.freeze({
      shengCross: 1.00,   // 正印 / 伤官 —— 有情之生，力大
      shengSame: 0.70,    // 偏印 / 食神 —— 同性相斥，生而不亲
      keSame: 1.00,       // 七杀 —— 无情之克，力猛
      keCross: 0.70,      // 正官 / 正财 —— 有情之克，制约而不摧折
    }),
    tongdang: Object.freeze({ mode: "resistance", beta: 0.60, additiveKernel: 0.20 }),
    distance: Object.freeze({
      samePillar: 1.00,
      sameBranchHidden: 0.60,
      adjacent: 0.80,
      gap1: 0.40,
      gap2: 0.20,
      crossLayerFactor: 0.70,
    }),
    external: Object.freeze({
      // 刻意不对称：环境作用于人强，人作用于环境弱
      luckToNatal: 0.80,
      annualToNatal: 0.70,
      luckToAnnual: 1.00,
      natalToLuck: 0.60,
      natalToAnnual: 0.50,
      annualToDayMasterBonus: 1.15,
    }),
  }),
  conclusion: Object.freeze({
    changshengSchool: "yangForwardYinReverse",   // [流派] ⚠️ 待校准 #3
    earthChangsheng: "fireEarthSame",            // [流派] ⚠️ 待校准 #4
    strengthBands: Object.freeze({
      veryStrong: 0.70, strong: 0.55, balancedLow: 0.45, weak: 0.30,
    }),
    confidence: Object.freeze({ bandMargin: 0.05, floor: 0.30 }),
    rootCoef: Object.freeze({ luRen: 1.00, changsheng: 0.70, ku: 0.50, yuqi: 0.30 }),
    congge: Object.freeze({ ratioThreshold: 0.30, requireRootless: true, yinThreshold: 25 }),
    specialGe: Object.freeze({
      zhuanwangThreshold: 0.78, suppressThreshold: 40,
      enableHuaqi: true, huaqiConfidenceCap: 0.60,   // ⚠️ #11 化气格实务争议大
    }),
    yongshen: Object.freeze({
      priority: Object.freeze(["tiaohou", "tongguan", "fuyi", "bingyao"]),
      tiaohou: Object.freeze({
        source: "table",       // 《穷通宝鉴》通行本 120 格；⚠️ 凭记忆转录，待实体书核对
        fireFloor: 0.08, waterFloor: 0.08,
      }),
      weakYongshenThreshold: 15,
      tongguan: Object.freeze({ balanceBand: 0.20, dominanceFloor: 0.45 }),
      bingyao: Object.freeze({ damageShare: 0.42, damageFloor: 8 }),
    }),
    femaleChildStarVariant: "standard",          // [流派] ⚠️ 待校准 #7
  }),
  shensha: Object.freeze({
    primaryBase: "day",
    alsoComputeYearBase: true,
    scanTargets: Object.freeze(["year", "month", "day", "hour", "luck", "annual", "taiyuan", "mingGong"]),
    includeDisputed: false,   // ⚠️ #9 福星/天厨/词馆
    yinYangRen: false,        // ⚠️ #10 阴干羊刃
    yuanchen: false,          // ⚠️ #8 元辰起例待定
    tianluodiwang: Object.freeze({ enabled: true, applyNayinFilter: true }),
    modifiers: Object.freeze({ zuowangThreshold: 1.30, zuoshuaiThreshold: 0.50 }),
  }),
  temporal: Object.freeze({
    qiyun: Object.freeze({ mode: "continuous", daysPerYear: 3, reportBothModes: true }),
    luckPillarCount: 12,
    includeXiaoyun: false,
    yearRangeYears: 120,
    sampleLuckAt: Object.freeze(["start", "mid", "end"]),
    // [硬约束] 月与日是引动的扳机，不是力量的来源
    monthLayer: Object.freeze({ recomputeWeights: false as const, maxInteractionsShown: 3 }),
    dayLayer: Object.freeze({ recomputeWeights: false as const, severityLevels: 2 }),
    index: Object.freeze({ a: 2.00, b: 0.20 }),   // [校准] 见 docs/08-temporal.md §5.2
  }),
  persona: Object.freeze({
    source: "conventional",   // [流派] 十神特质表底本，可替换
    excessShare: 0.35,        // [校准]
    deficientShare: 0.05,     // [校准]
    dominantMargin: 0.05,     // [校准] 与置信度公式由构造对齐，见 types.ts
    neijingSource: "conventional",       // [流派] ⚠️ 待校准 #15
    wuqiaoSource: "yinyangYingxiang",    // [流派] ⚠️ 待校准 #16，内经内部两篇不一致
    bodyCorrespondence: true,
    excessBand: 0.30,         // [校准]
    deficientBand: 0.30,      // [校准]
    attackedBand: 0.25,       // [校准]
    seasonAdjust: 0.15,       // [校准]
    axisBand: 0.12,           // [校准]
  }),
  series: Object.freeze({
    spanYears: 60,
    drawYears: 60,
    samplesPerYear: 12 as const,          // [硬约束] 月度
    fleetingMonthInWeights: false as const, // [硬约束]
    agitation: Object.freeze({            // [校准]
      chong: 1.00, sanheSanhui: 0.85, liuhe: 0.70,
      xing: 0.60, hai: 0.40, po: 0.25,
      layerLuck: 1.00, layerAnnual: 0.85, layerMonth: 0.45,
    }),
  }),
  nodes: Object.freeze({
    threshold: 2.0,                    // [校准]
    noticeThreshold: 1.5,              // [校准]
    mediumEstimator: "robustMAD" as const,  // [硬约束] n=6，样本 σ 不可用
    interpolateTo: "month" as const,        // [硬约束] 月内无独立信息
    minRelativeSwing: 0.05,            // [校准]
    bridgeGapMonths: 2,                // [校准]
    maxShown: 12,
  }),
  liuyao: Object.freeze({
    castMethod: "time" as const,                 // [流派] time | number | coin
    timeCast: Object.freeze({
      calendar: "lunar" as const,                // [硬约束]
      yearBoundary: "lunarNewYear" as const,     // [流派] 另一说取立春年
    }),
    coin: Object.freeze({ yangFace: "back" as const }),   // [流派]
    fushen: Object.freeze({ rules: "conventional" as const }), // [流派]
    guashen: Object.freeze({ enabled: false }),  // ⚠️ 起法分歧大，默认关闭
    xunkong: Object.freeze({ dongBuKong: true, chongKongZeShi: true }),
    yuepo: Object.freeze({ dongErBuPo: true }),
    topics: Object.freeze({
      health: Object.freeze({ enabled: true, emitYingqi: false as const }),
    }),
    yingqi: Object.freeze({ horizonMonths: 12, granularity: "month" as const }),
    oncePerQuestion: true as const,              // [硬约束]
  }),
  qimen: Object.freeze({
    juMethod: "chaibu" as const,   // ⚠️[流派] 另有置闰法（超神接气），未实现
    plate: "zhuan" as const,       // ⚠️[流派] 另有飞盘法，未实现
  }),
  report: Object.freeze({
    locale: "zh-Hans",
    showConvergenceHistory: false,
    showParamsSnapshot: true,
    guard: Object.freeze({
      enforceBannedTerms: true as const,   // [硬约束]
      scanExportBeforeWrite: true,
      neutralPalette: true as const,       // [硬约束]
    }),
  }),
}) as Params;

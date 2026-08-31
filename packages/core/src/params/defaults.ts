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
}) as Params;

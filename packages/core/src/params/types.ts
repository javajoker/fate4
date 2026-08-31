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

export interface Params {
  readonly version: number;
  readonly weights: WeightParams;
  readonly structure: StructureParams;
}

/** 递归可选，供覆盖用。 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K]
    : T[K] extends object ? DeepPartial<T[K]>
    : T[K];
};

export type PartialParams = DeepPartial<Params>;

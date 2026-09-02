/** L4 断论层的判定与输出。 */

import type { Element, Polarity, Stem, TenGod, Branch } from "../types/ganzhi.js";
import type { PillarKind } from "../weights/carrier.js";

export interface DerivationStep {
  readonly step: string;
  readonly detail: string;
  readonly values?: Readonly<Record<string, number | string>>;
}

/**
 * 带推导链与置信度的判定。
 *
 * `alternatives` 不是装饰：当 r 落在阈值边缘，报告必须写「接近临界」并给出
 * 另一种取法下的结论，而不是斩钉截铁地归档。这是本系统与市面工具的主要区别。
 */
export interface Verdict<T> {
  readonly value: T;
  readonly confidence: number;
  readonly derivation: readonly DerivationStep[];
  readonly alternatives: readonly { readonly value: T; readonly reason: string }[];
}

export type StrengthBand = "VERY_STRONG" | "STRONG" | "BALANCED" | "WEAK" | "VERY_WEAK";

export type SpecialPattern =
  | { readonly kind: "congge"; readonly subtype: string; readonly element: Element }
  | { readonly kind: "zhuanwang"; readonly name: string; readonly element: Element }
  | { readonly kind: "huaqi"; readonly element: Element };

export type YongshenMethod = "tiaohou" | "fuyi" | "tongguan" | "bingyao";

export interface YongshenVerdict {
  readonly method: YongshenMethod;
  readonly primary: Element;
  readonly secondary: Element | null;
  readonly xishen: readonly Element[];
  readonly jishen: readonly Element[];
  readonly choushen: readonly Element[];
  readonly xianshen: readonly Element[];
  readonly strength: number;
  /** 用神选对了但盘中不存在 —— 只能等大运送来。常被忽略的重要状态。 */
  readonly needsLuckSupport: boolean;
  /** 调候用神的来源：heuristic = 可计算的极端气候降级；table = 《穷通宝鉴》120 格。 */
  readonly tiaohouSource?: "heuristic" | "table";
  /**
   * 调候用神的**天干原貌**，仅 `table` 来源有。
   *
   * `primary` 只到五行，而调候正是靠丙丁（太阳与灯烛）、壬癸（江河与雨露）
   * 的分别立论的。丢掉的这一层要让读者看见，不是替他抹平。
   */
  readonly tiaohouStems?: readonly Stem[];
  /** 该格的转录信心：varies = 版本有出入，见 TIAOHOU_VARIANTS。 */
  readonly tiaohouTier?: "firm" | "varies";
}

export type GejuName =
  | "正官格" | "七杀格" | "正财格" | "偏财格" | "正印格" | "偏印格"
  | "食神格" | "伤官格" | "建禄格" | "月刃格" | "月劫格";

export interface Geju {
  readonly name: GejuName;
  /** 定格所依的十神。 */
  readonly god: TenGod;
  /** 定格来源：本气透 / 中气透 / 余气透 / 不透取本气。 */
  readonly source: "benqiRevealed" | "zhongqiRevealed" | "yuqiRevealed" | "notRevealed";
  readonly isAuspicious: boolean;
  /** 顺用（生护）或逆用（制化）。 */
  readonly usage: "顺用" | "逆用";
  readonly xiangshen: readonly TenGod[];
  readonly breakers: readonly TenGod[];
}

export type KinName = "father" | "mother" | "spouse" | "siblings" | "children";
export type Quadrant = "both-favorable" | "palace-only" | "star-only" | "neither";

export interface KinReading {
  readonly kin: KinName;
  readonly label: string;
  readonly starGod: TenGod;
  readonly starWeight: number;
  readonly starFlags: readonly string[];
  readonly palace: { readonly pillar: PillarKind; readonly layer: "stem" | "branch" };
  readonly palaceLabel: string;
  readonly palaceWeight: number;
  readonly palaceBranch: Branch | null;
  readonly palaceFlags: readonly string[];
  readonly quadrant: Quadrant;
  readonly confidence: number;
}

export interface FlowMetrics {
  /** 单轮留存率，来自 L3。 */
  readonly vitality: number;
  /** 生流量 / (生 + 克)。五行是否流通有情。 */
  readonly circulation: number;
  /** 五行权重的归一化熵 H / ln5。越接近 1 越均匀。 */
  readonly evenness: number;
}

export interface Conclusions {
  readonly dayMaster: {
    readonly stem: Stem; readonly element: Element;
    readonly polarity: Polarity; readonly weight: number;
  };
  readonly tenGods: Readonly<Record<TenGod, number>>;
  readonly party: { readonly supporting: number; readonly opposing: number; readonly ratio: number };
  readonly rootScore: number;
  readonly rootDetail: readonly { readonly branch: Branch; readonly kind: string; readonly contribution: number }[];
  readonly strength: Verdict<StrengthBand>;
  readonly specialPattern: Verdict<SpecialPattern | null>;
  readonly yongshen: Verdict<YongshenVerdict>;
  readonly geju: Verdict<Geju>;
  readonly kin: readonly KinReading[];
  readonly metrics: FlowMetrics;
  /** 流派开关的实际取值 —— 结论会因它们分叉，必须随盘声明。 */
  readonly schoolsUsed: {
    readonly changshengSchool: string;
    readonly earthChangsheng: string;
    readonly tiaohouSource: string;
    readonly femaleChildStarVariant: string;
  };
}

/** L6 报告树 —— [09-report](../../../../docs/09-report.md) §2 的结构对应。 */

import type {
  Branch, ChangshengPhase, Element, Pillar, Polarity, Stem, TenGod,
} from "../types/ganzhi.js";
import type { NatalChart, SilingInfo, TimeCorrections } from "../chart/types.js";
import type { PillarKind } from "../weights/carrier.js";
import type { StructureEvent } from "../structure/types.js";
import type { ConvergenceReport, FlowRecord } from "../propagate/iterate.js";
import type { Conclusions, KinReading } from "../conclude/types.js";
import type { ShenshaHit, PalaceName } from "../shensha/scan.js";
import type { DayView, LuckStep, MonthView, YearView } from "../temporal/types.js";
import type { Locale } from "./templates.js";
import type { NarrativeLine } from "./render.js";
import type { GuardViolation } from "./guard.js";

export interface HiddenCell {
  readonly stem: Stem;
  readonly role: string;
  readonly tenGod: TenGod | "日主";
  readonly weight: number;
  readonly siling: boolean;
  readonly revealed: boolean;
}

export interface PillarCell {
  readonly kind: PillarKind;
  readonly label: string;
  readonly stemPalace: string;
  readonly branchPalace: string;
  readonly stem: Stem;
  readonly branch: Branch;
  readonly stemTenGod: TenGod | "日主";
  readonly stemWeight: number;
  readonly branchWeight: number;
  readonly hidden: readonly HiddenCell[];
  readonly nayin: string;
  readonly xunKong: readonly [Branch, Branch];
  /** 日主在该支的十二长生位。 */
  readonly changsheng: ChangshengPhase;
  readonly shensha: readonly string[];
}

export interface ChartSection {
  readonly pillars: readonly PillarCell[];
  readonly taiyuan: Pillar;
  readonly mingGong: Pillar | null;
  readonly corrections: TimeCorrections;
  readonly siling: SilingInfo;
  readonly enclosingJie: NatalChart["enclosingJie"];
  readonly shenshaByPalace: readonly {
    readonly palace: PalaceName;
    readonly hits: readonly ShenshaHit[];
  }[];
  readonly narrative: readonly NarrativeLine[];
}

export interface ForceSection {
  readonly byElement: Readonly<Record<Element, number>>;
  readonly byPolarity: Readonly<Record<Polarity, number>>;
  readonly tenGods: Readonly<Record<TenGod, number>>;
  readonly metrics: Conclusions["metrics"];
  /** 供桑基图。按流量降序截断。 */
  readonly flows: readonly FlowRecord[];
  /** 载体 id → 可读标签。流量表若直接显示 id，读者无从对照盘面。 */
  readonly carrierLabels: Readonly<Record<string, string>>;
  /** 迭代收敛过程。调试与教学用，由 report.showConvergenceHistory 开启，默认不产出。 */
  readonly convergence?: ConvergenceReport;
  readonly events: readonly StructureEvent[];
  readonly narrative: readonly NarrativeLine[];
}

export interface StrengthSection {
  readonly strength: Conclusions["strength"];
  readonly rootScore: number;
  readonly rootDetail: Conclusions["rootDetail"];
  readonly specialPattern: Conclusions["specialPattern"];
  readonly yongshen: Conclusions["yongshen"];
  readonly geju: Conclusions["geju"];
  /** §3.6：取用与格局取向不一致时为 true，报告必须并列呈现。 */
  readonly yongshenGejuTension: boolean;
  readonly narrative: readonly NarrativeLine[];
}

export interface KinSection {
  readonly readings: readonly KinReading[];
  /** subject 为 other 时，六亲叙述整体略去，只留结构表。 */
  readonly narrativeOmitted: boolean;
  readonly narrative: readonly NarrativeLine[];
}

export interface LuckSection {
  readonly steps: readonly LuckStep[];
  readonly startAgeYears: number;
  readonly direction: "forward" | "reverse";
  readonly narrative: readonly NarrativeLine[];
}

export interface YearCurvePoint {
  readonly year: number;
  readonly pillar: Pillar;
  readonly luckIndex: number | null;
  readonly favorIndex: number;
  readonly vitality: number;
  readonly dayMasterShare: number;
}

export interface YearCard {
  readonly view: YearView;
  readonly narrative: readonly NarrativeLine[];
}

export interface YearsSection {
  readonly curve: readonly YearCurvePoint[];
  readonly cards: readonly YearCard[];
  /** 按 tension 降序 —— 净值近零而张力高的年份，正是最容易被读漏的。 */
  readonly highTension: readonly {
    readonly year: number; readonly domain: string; readonly tension: number;
  }[];
  readonly narrative: readonly NarrativeLine[];
}

export interface CurrentSection {
  readonly year: YearView;
  readonly month: MonthView;
  readonly day: DayView;
  readonly narrative: readonly NarrativeLine[];
}

export interface MethodSection {
  readonly rulesUsed: NatalChart["rulesUsed"];
  readonly schoolsUsed: Conclusions["schoolsUsed"];
  readonly paramsHash: string;
  readonly engineVersion: string;
  readonly pendingCalibration: readonly string[];
  readonly narrative: readonly NarrativeLine[];
}

export interface ReportMeta {
  readonly engineVersion: string;
  readonly paramsHash: string;
  readonly locale: Locale;
  readonly subject: "self" | "other";
  readonly warnings: readonly string[];
}

/** 措辞扫描的结果 —— §6.4.3：导出前扫一次，命中即记录。 */
export interface GuardReport {
  /** 扫过的字符串条数。0 说明扫描根本没跑到东西，是个应当报警的信号。 */
  readonly scanned: number;
  readonly violations: readonly GuardViolation[];
  /** 因置信度不足而自动降级为 hedged 的模板 id。 */
  readonly hedged: readonly string[];
}

export interface Report {
  readonly meta: ReportMeta;
  readonly disclaimerTop: string;
  readonly chart: ChartSection;
  readonly force: ForceSection;
  readonly strength: StrengthSection;
  readonly kin: KinSection;
  readonly luck: LuckSection;
  readonly years: YearsSection;
  readonly current: CurrentSection | null;
  readonly method: MethodSection;
  readonly disclaimerBottom: string;
  readonly guard: GuardReport;
}

"use client";

import {
  DEFAULT_PARAMS, DEFAULT_SPAN, isSpanYears,
  type Audience, type BirthInput, type PartialParams, type SpanYears,
} from "@fate/core";

/**
 * 移动版只记一份出生信息，存在本机。
 *
 * 桌面版用 IndexedDB 存多张盘；移动版是「看自己」的应用，一份就够。
 * **不上传、不同步** —— 与全站同一条隐私纪律。
 */
const KEY = "fate.m.birth.v1";

export function loadBirth(): BirthInput | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : (JSON.parse(raw) as BirthInput);
  } catch { return null; }
}

export function saveBirth(b: BirthInput): void {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* 隐私模式下写不进，无妨 */ }
}

export function clearBirth(): void {
  try { localStorage.removeItem(KEY); } catch { /* 同上 */ }
}

/**
 * 城市表：[名, 时区, 东经, 北纬]。
 *
 * **纬度是后加的那一项。** 四柱用不到它 —— 对出生地的依赖只到真太阳时
 * 那一层，用经度。但星盘的上升点要纬度，而且南北差一度就能差出几度。
 *
 * 在手机上让人填一个纬度数字是糟糕的交互，而选城市本来就要选。
 * 故把纬度并进这张表，选了城市就有了 —— 用户不必知道它的存在。
 */
export const CITIES: readonly (readonly [string, string, number, number])[] = [
  ["上海", "Asia/Shanghai", 121.47, 31.23], ["北京", "Asia/Shanghai", 116.41, 39.90],
  ["广州", "Asia/Shanghai", 113.26, 23.13], ["深圳", "Asia/Shanghai", 114.06, 22.54],
  ["成都", "Asia/Shanghai", 104.07, 30.57], ["西安", "Asia/Shanghai", 108.95, 34.34],
  ["台北", "Asia/Taipei", 121.56, 25.03], ["香港", "Asia/Hong_Kong", 114.17, 22.32],
  ["新加坡", "Asia/Singapore", 103.82, 1.35],
];

/**
 * 人话由谁生成。
 *
 * `code`（默认）：走 `plainCards` 的定值映射 —— 判定枚举查表，
 * 过人话守卫，逐条挂着技术依据。**全部在本机完成。**
 *
 * `ai`：交给 `bazi-plain` Skill 转述。它读得懂上下文，措辞更活，
 * 但它是**语言模型**，不是查表 —— 同一份判定两次转述未必一字不差。
 *
 * ⚠️ **AI 档不会自动把数据送出去。** 本站是纯静态、生辰数据不出本机；
 * 若在浏览器里直连模型接口，等于把出生信息发给第三方，与全站的隐私纪律相反。
 * 故 AI 档只把**技术报告**导出成一段可复制的文本，由你自己交给 Skill ——
 * 送不送、送给谁，是你的决定，不是这个应用替你做的。
 */
export type PlainSource = "code" | "ai";

const SRC_KEY = "fate.m.plainSource.v1";

export function loadPlainSource(): PlainSource {
  try {
    return localStorage.getItem(SRC_KEY) === "ai" ? "ai" : "code";
  } catch { return "code"; }
}

export function savePlainSource(v: PlainSource): void {
  try { localStorage.setItem(SRC_KEY, v); } catch { /* 同上 */ }
}

/**
 * 读者档。
 *
 * **它控制披露，不控制断言** —— 措辞守卫在三档下完全相同，
 * 见 `packages/core/src/report/audience.ts`。
 *
 * 默认取最严的 `lay`：反过来（默认全给、让人自己关）等于默认把最容易
 * 被读成预告的东西端出去。
 */
const AUD_KEY = "fate.m.audience.v1";

export function loadAudience(): Audience {
  try {
    const v = localStorage.getItem(AUD_KEY);
    return v === "student" || v === "practitioner" ? v : "lay";
  } catch { return "lay"; }
}

export function saveAudience(v: Audience): void {
  try { localStorage.setItem(AUD_KEY, v); } catch { /* 同上 */ }
}

/**
 * 时间跨度：60 / 120 / 180 年（自起运起算）。
 *
 * **与桌面版同一个键。**同一台设备上它是同一个偏好 —— 在手机上切了 120 年，
 * 打开桌面版也该是 120 年，而不是两边各记各的。与读者档同理，它是
 * 「看的人」的偏好，不是这张盘的参数，不随盘走。
 */
const SPAN_KEY = "fate.span.v1";

export function loadSpan(): SpanYears {
  try {
    const v = Number(localStorage.getItem(SPAN_KEY));
    return isSpanYears(v) ? v : DEFAULT_SPAN;
  } catch { return DEFAULT_SPAN; }
}

export function saveSpan(v: SpanYears): void {
  try { localStorage.setItem(SPAN_KEY, String(v)); } catch { /* 同上 */ }
}

// ─────────────────────────────────────────────────────────
// 回看的标注 —— 见 docs/15-engagement.md
// ─────────────────────────────────────────────────────────

export type Verdict = "hit" | "miss" | "unclear";

export interface Mark {
  /** 标的是哪一年，或哪一次问事的指纹。 */
  readonly key: string;
  readonly kind: "year" | "question";
  readonly verdict: Verdict;
  /** 模型当时给的置信度。汇总时按它分栏 —— 合成一个总数会抹掉最有意思的差别。 */
  readonly confidence: number;
  readonly at: string;
}

const MARK_KEY = "fate.m.marks.v1";

export function loadMarks(): Mark[] {
  try {
    const raw = localStorage.getItem(MARK_KEY);
    return raw === null ? [] : (JSON.parse(raw) as Mark[]);
  } catch { return []; }
}

/** 同一个 key 只留最后一次标注 —— 允许改主意，但不重复计数。 */
export function saveMark(m: Mark): Mark[] {
  const next = [...loadMarks().filter((x) => x.key !== m.key), m];
  try { localStorage.setItem(MARK_KEY, JSON.stringify(next)); } catch { /* 同上 */ }
  return next;
}

export function clearMarks(): void {
  try { localStorage.removeItem(MARK_KEY); } catch { /* 同上 */ }
}

/**
 * 样本量的门槛。
 *
 * 低于此数**不出百分数** —— 七次里中四次，在完全随机时也一点都不稀奇，
 * 把它写成 57% 会让一个说明不了什么的数字看起来像统计量。
 */
export const ENOUGH = 30;

/**
 * 合盘用的第二张盘 —— **与本人的生辰分开存**。
 *
 * 分开不是技术需要，是为了让它**看得见、删得掉**：
 * 它是另一个人的生辰，不该混进「我的资料」里悄悄留着。
 *
 * 桌面版的合盘页要求两张盘都已存在，并明说不另开输入表单 ——
 * 那会让人顺手填进一个随口问来的生辰。移动版只存一个人，
 * 那条要求没法照搬，故改为：表单在一段说明**之后**才出现，
 * 并且这一份随时可以单独清掉。
 */
const PARTNER_KEY = "fate.m.partner.v1";

export interface PartnerRecord {
  readonly label: string;
  readonly input: BirthInput;
}

export function loadPartner(): PartnerRecord | null {
  try {
    const raw = localStorage.getItem(PARTNER_KEY);
    return raw === null ? null : (JSON.parse(raw) as PartnerRecord);
  } catch { return null; }
}

export function savePartner(r: PartnerRecord): void {
  try { localStorage.setItem(PARTNER_KEY, JSON.stringify(r)); }
  catch { /* 隐私模式下写不进，无妨 */ }
}

export function clearPartner(): void {
  try { localStorage.removeItem(PARTNER_KEY); } catch { /* 同上 */ }
}

/**
 * 流月的分量：占流年的比例。可选 0 / 25% / 50%，默认取参数（50%）。
 *
 * **只存在移动版这一侧，与桌面版不共用。**桌面版的流月比例是**这张盘的参数**
 * （参数校准页里改，随盘保存、随分享链接走）；移动版只有一份出生信息、没有逐盘的参数，
 * 这里存的是「看的人」的偏好。两边各管各的，不让一边的改动悄悄改掉另一边的盘。
 */
const RATIO_KEY = "fate.m.monthRatio.v1";

export const MONTH_RATIOS: readonly number[] = Object.freeze([0, 0.25, 0.5]);

export const DEFAULT_MONTH_RATIO: number = DEFAULT_PARAMS.series.fleetingMonthInWeights
  ? DEFAULT_PARAMS.weights.fleetingMonth.ratioToYear : 0;

export function loadMonthRatio(): number {
  try {
    const raw = localStorage.getItem(RATIO_KEY);
    if (raw === null) return DEFAULT_MONTH_RATIO;
    const v = Number(raw);
    return MONTH_RATIOS.includes(v) ? v : DEFAULT_MONTH_RATIO;
  } catch { return DEFAULT_MONTH_RATIO; }
}

export function saveMonthRatio(v: number): void {
  try { localStorage.setItem(RATIO_KEY, String(v)); } catch { /* 隐私模式下写不进，无妨 */ }
}

/** 把比例变成参数覆盖。0 时连开关一起关 —— 与「不进」逐位相同。 */
export function monthParams(ratio: number): PartialParams {
  return {
    series: { fleetingMonthInWeights: ratio > 0 },
    weights: { fleetingMonth: { ratioToYear: ratio } },
  } as PartialParams;
}

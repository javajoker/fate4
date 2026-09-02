/**
 * 模板求值 —— 槽位填充、置信度降级、语言选取。
 *
 * 三条硬规则：
 * 1. 槽位缺值直接抛错，不静默留下 `{slot}`。报告里出现花括号是最难被发现的错误之一。
 * 2. `confidence < confidenceFloor` 自动切 hedged，调用方无从绕过。
 * 3. 繁体由 `toHant` 在**填槽之后**转换，遇到无法定夺的字抛错而非猜测。
 *
 * 第三条的顺序要紧。槽位值同样需要转换（十神名、神煞名、宫位名都是简体常量），
 * 而有些词条恰好跨模板与槽位的接缝 —— 「其华在{hua}」填入「发」之后才成词，
 * 那时才能判定它是「髮」不是「發」。先转模板再填槽，这个判断就永远做不出来。
 */

import { toHant } from "./hant.js";
import {
  DISCLAIMER, TEMPLATES_BY_ID,
  type LocalizedText, type Locale, type NarrativeTemplate,
} from "./templates.js";

export class MissingSlotError extends Error {
  constructor(readonly templateId: string, readonly slot: string) {
    super(`模板 ${templateId} 的槽位 {${slot}} 无值。`);
    this.name = "MissingSlotError";
  }
}

export type SlotValue = string | number;
export type Slots = Readonly<Record<string, SlotValue>>;

export interface NarrativeSource {
  readonly kind: "verdict" | "event" | "data";
  /** 指回来源 —— §0 的硬约束：报告不做新判断，每句话都要能溯源。 */
  readonly ref: string;
}

export interface NarrativeLine {
  readonly templateId: string;
  readonly text: string;
  /** 是否因置信度不足而降级为留有余地的措辞。 */
  readonly hedged: boolean;
  readonly confidence: number;
  readonly source: NarrativeSource;
}

const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** 取出一段文本中的全部占位符。测试用它与 `slots` 声明对账。 */
export function placeholdersOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER)) out.add(m[1]!);
  return out;
}

/**
 * 取某语言的模板文本。
 *
 * 繁体优先用手写的 `zhHant`；缺席则取简体，由调用方在填槽后交给 `toHant`。
 * 这**不是**静默回落 —— 转换器对一简对多繁的字要么有写明理由的定夺，要么抛错。
 */
export function localeText(t: LocalizedText, locale: Locale, _templateId: string): string {
  switch (locale) {
    case "zh-Hans": return t.zhHans;
    case "en": return t.en;
    case "zh-Hant": return t.zhHant ?? t.zhHans;
  }
}

/** 繁体时转换，其余语言原样。放在填槽之后 —— 理由见模块头。 */
const localize = (text: string, locale: Locale): string =>
  locale === "zh-Hant" ? toHant(text) : text;

function fill(text: string, slots: Slots, templateId: string): string {
  return text.replace(PLACEHOLDER, (_m, name: string) => {
    const v = slots[name];
    if (v === undefined) throw new MissingSlotError(templateId, name);
    return String(v);
  });
}

export interface RenderOptions {
  readonly locale?: Locale;
  readonly confidence?: number;
  readonly source?: NarrativeSource;
}

export function renderTemplate(
  templateId: string,
  slots: Slots,
  opts: RenderOptions = {},
): NarrativeLine {
  const tpl = TEMPLATES_BY_ID.get(templateId);
  if (tpl === undefined) throw new Error(`未知模板 ${templateId}`);
  return renderWith(tpl, slots, opts);
}

export function renderWith(
  tpl: NarrativeTemplate,
  slots: Slots,
  opts: RenderOptions = {},
): NarrativeLine {
  const locale = opts.locale ?? "zh-Hans";
  const confidence = opts.confidence ?? 1;
  const useHedged = confidence < tpl.confidenceFloor && tpl.hedged !== undefined;
  const body = useHedged ? tpl.hedged! : tpl.text;

  return {
    templateId: tpl.id,
    text: localize(fill(localeText(body, locale, tpl.id), slots, tpl.id), locale),
    hedged: useHedged,
    confidence,
    source: opts.source ?? { kind: tpl.appliesTo.source, ref: tpl.appliesTo.kind },
  };
}

export function disclaimerText(locale: Locale): string {
  return localize(localeText(DISCLAIMER, locale, "DISCLAIMER"), locale);
}

// ─────────────────────────────────────────────────────────
// 数值格式化 —— 报告里出现的每个数字都从这里过一遍，
// 免得同一个量在不同章节以不同精度出现。
// ─────────────────────────────────────────────────────────

export const fmtPct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`;
export const fmtNum = (x: number, digits = 1): string => x.toFixed(digits);
export const fmtIndex = (x: number): string => x.toFixed(1);

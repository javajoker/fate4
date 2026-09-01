/**
 * 模板求值 —— 槽位填充、置信度降级、语言选取。
 *
 * 三条硬规则：
 * 1. 槽位缺值直接抛错，不静默留下 `{slot}`。报告里出现花括号是最难被发现的错误之一。
 * 2. `confidence < confidenceFloor` 自动切 hedged，调用方无从绕过。
 * 3. 语言缺失抛 `UnsupportedLocaleError`，不回落。
 */

import {
  DISCLAIMER, TEMPLATES_BY_ID,
  type LocalizedText, type Locale, type NarrativeTemplate,
} from "./templates.js";

export class UnsupportedLocaleError extends Error {
  constructor(readonly locale: Locale, readonly templateId: string) {
    super(`模板 ${templateId} 缺少 ${locale} 文本。本系统不做简繁自动转换，故不回落 —— 静默回落等于对外谎称支持了该语言。`);
    this.name = "UnsupportedLocaleError";
  }
}

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

export function localeText(t: LocalizedText, locale: Locale, templateId: string): string {
  switch (locale) {
    case "zh-Hans": return t.zhHans;
    case "en": return t.en;
    case "zh-Hant": {
      const v = t.zhHant;
      if (v === undefined) throw new UnsupportedLocaleError(locale, templateId);
      return v;
    }
  }
}

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
    text: fill(localeText(body, locale, tpl.id), slots, tpl.id),
    hedged: useHedged,
    confidence,
    source: opts.source ?? { kind: tpl.appliesTo.source, ref: tpl.appliesTo.kind },
  };
}

export function disclaimerText(locale: Locale): string {
  return localeText(DISCLAIMER, locale, "DISCLAIMER");
}

// ─────────────────────────────────────────────────────────
// 数值格式化 —— 报告里出现的每个数字都从这里过一遍，
// 免得同一个量在不同章节以不同精度出现。
// ─────────────────────────────────────────────────────────

export const fmtPct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`;
export const fmtNum = (x: number, digits = 1): string => x.toFixed(digits);
export const fmtIndex = (x: number): string => x.toFixed(1);

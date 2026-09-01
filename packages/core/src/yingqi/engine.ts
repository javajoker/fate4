/**
 * 应期规则求值。
 *
 * ## 冲突裁决：并存不抵消
 *
 * 多条规则同时触发时，按 priority 降序排列；**同域内极性相反的规则并存，
 * 不做抵消**。「这一年既有 X 也有 Y」是真实的命理状态，不该被平均掉。
 *
 * 尤其**不做「综合评分取最高的那条」** —— 取最高会丢掉张力，
 * 而张力恰恰是应期分析中最有价值的部分。
 */

import type { Scope, YingqiContext, YingqiEvent } from "./types.js";
import { YINGQI_RULES } from "./rules.js";

export function runYingqi(ctx: YingqiContext, scope: Scope = ctx.scope): YingqiEvent[] {
  const out: YingqiEvent[] = [];
  for (const rule of YINGQI_RULES) {
    if (!rule.scope.includes(scope)) continue;
    let verdict: boolean | string;
    try {
      verdict = rule.when(ctx);
    } catch {
      // 规则求值失败不应拖垮整盘 —— 跳过并留待测试暴露
      continue;
    }
    if (verdict === false || verdict === "") continue;
    out.push({
      ruleId: rule.id, name: rule.name,
      polarity: rule.polarity, weight: rule.weight,
      domains: rule.domains, narrativeTag: rule.narrativeTag,
      evidence: typeof verdict === "string" ? verdict : rule.name,
    });
  }
  // 按 priority 降序；priority 存于规则表，此处按 id 回查
  const pri = new Map(YINGQI_RULES.map((r) => [r.id, r.priority]));
  return out.sort((a, b) => (pri.get(b.ruleId) ?? 0) - (pri.get(a.ruleId) ?? 0));
}

/** 事件对顺逆指数的净贡献。保留符号，由 tanh 做饱和。 */
export function eventDelta(events: readonly YingqiEvent[]): number {
  return events.reduce((a, e) => a + e.polarity * e.weight, 0);
}

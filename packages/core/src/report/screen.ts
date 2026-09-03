/**
 * 引文闸门 —— 把**外来文本**放到守卫底下过一遍，不过就不发。
 *
 * ## 为什么需要它
 *
 * 报告层的每一句都由模板生成，守卫在导出前统扫一遍，违规即是 bug，改模板即可。
 * 爻辞语料不一样：它是**外来的**，四百多条，而且不是本项目写的。
 * 遇到违规条目，可选的做法有三种：
 *
 * | 做法 | 问题 |
 * | 给引文开豁免 | 守卫立刻形同虚设 —— 任何一句都可以说「这是引文」 |
 * | 逐条改写语料 | 那就不是引文了，是我们借别人的口说自己的话 |
 * | **不通过就不发** | 少几条，但没有一条是坏的 |
 *
 * 取第三种。代价是读者偶尔看到「这一条没通过措辞检查」，而那句话本身是诚实的：
 * 它说出了发生过什么，也说得出是哪一条规则拦的。
 *
 * ## 为什么在读取时扫，而不在生成数据时扫
 *
 * 若在 `scripts/generate-yaoci.mjs` 里预先算好「哪些条目可发」，这份判断就冻在
 * 生成那一刻了 —— 此后守卫加严，旧条目照发；守卫修掉一处误杀，被误杀的条目也
 * 再不会回来。改成读取时扫、按条记忆：规则一变，结果当场跟着变。
 * 一次问卦只取出三五条，扫不了几个字。
 */

import { scanText, type GuardViolation } from "./guard.js";
import { scanPlain } from "../plain/guard.js";

/** 技术层用 `scanText`，人话层用 `scanPlain`（放开第二人称，另加六条）。 */
export type GuardLayer = "technical" | "plain";

export interface Screened {
  /** 通过守卫的原文；未通过为 null。 */
  readonly text: string | null;
  /** 未通过时，拦下它的规则 id（去重、有序）。通过时为空。 */
  readonly withheld: readonly string[];
}

const memo = new Map<string, Screened>();

/**
 * 过闸。同一段文字在同一层只扫一次。
 *
 * `where` 只进违规记录，不进缓存键 —— 同一段文字在两处出现，结论必然相同。
 */
export function screen(text: string, layer: GuardLayer, where = "quote"): Screened {
  // 分隔符取 NUL：层名里不可能有它，故拼不出两个不同 (layer, text) 撞同一个键。
  // 写成转义序列而不是字面量 —— 源文件里一个裸 NUL 会让 git 把整份当二进制。
  const key = `${layer}\u0000${text}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;

  const vs: readonly GuardViolation[] =
    layer === "technical" ? scanText(text, where) : scanPlain(text, where);
  const out: Screened = vs.length === 0
    ? Object.freeze({ text, withheld: Object.freeze([]) })
    : Object.freeze({
      text: null,
      withheld: Object.freeze([...new Set(vs.map((v) => v.ruleId))].sort()),
    });
  memo.set(key, out);
  return out;
}

/** 未通过时给读者的交代。**说清楚是什么被挡了、被谁挡的**，不含糊过去。 */
export function withheldNote(s: Screened, what: string): string {
  if (s.text !== null) return "";
  return `${what}未通过本项目的措辞检查（${s.withheld.join("、")}），故不显示。`;
}

/** 仅供测试与统计：清空记忆。 */
export const clearScreenMemo = (): void => { memo.clear(); };

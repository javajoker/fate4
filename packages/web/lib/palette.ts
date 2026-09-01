/**
 * 配色 —— [09-report](../../../docs/09-report.md) §4 的硬约束。
 *
 * **禁止红绿吉凶配色。**顺逆指数低不等于「凶」：它衡量的是当年五行结构与
 * 本命喜用的契合度。用红色去画一个结构性描述，会把它变成价值判断，
 * 而这正是本系统从头到尾在避免的事。
 *
 * 于是：
 * - 凡有序的量（顺逆指数、张力、权重）一律用**单色阶**，深浅表大小，不换色相。
 * - 凡分类的量（五行、阴阳、同党异党）才用色相区分。
 *
 * 五行用的是传统色（木青、火赤、土黄、金白、水黑）的低饱和版本。
 * 它们是**类别**标签，不是评价 —— 火之赤在这里与「凶」无关，
 * 正如木之青与「吉」无关。图例中会写明这一点。
 */

import type { Element } from "@fate/core";

export const ELEMENT_COLOR: Readonly<Record<Element, string>> = Object.freeze({
  木: "#4a7c6f",
  火: "#b5654a",
  土: "#a8874e",
  金: "#78889a",
  水: "#3f5d78",
});

/** 同党 / 异党。两个中性色相，无褒贬。 */
export const PARTY_COLOR = Object.freeze({
  supporting: "#5b6f82",
  opposing: "#a89070",
});

/** 生 / 克 的流向。仍是分类，不是好坏。 */
export const FLOW_COLOR = Object.freeze({
  sheng: "#6b8ba4",
  ke: "#8c7a95",
});

/**
 * 有序量的单色阶。t ∈ [0,1] → 由浅到深的同一色相。
 * 刻意不提供双端发散色阶：那正是红绿配色的入口。
 */
export function sequential(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  // #e6e9ec → #2f4858，同色相内插
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * x);
  return `rgb(${lerp(230, 47)}, ${lerp(233, 72)}, ${lerp(236, 88)})`;
}

/** 极性徽记。三档，不用红绿。 */
export const POLARITY_MARK = Object.freeze({
  "1": { glyph: "＋", label: "顺向", color: "#4a6b7c" },
  "0": { glyph: "○", label: "中性", color: "#7d7d7d" },
  "-1": { glyph: "－", label: "逆向", color: "#8a6f5c" },
});

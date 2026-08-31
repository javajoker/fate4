/**
 * 命宫。
 *
 * 传统口诀以「子起正月、子起子时，二数相加，和 ≤ 14 用 14 减、> 14 用 26 减」表述。
 * 本实现用统一的 mod-12 形式：
 *
 *     命宫支序 = ((14 − mZi − h − 1) mod 12) + 1        子 = 1
 *
 * 与两分支口诀等价，且消除了 n = 14 时结果为 0 的边界缺陷
 * （午月午时、亥月亥时恰落在此处）。
 *
 * ⚠️ **月界取法待定**（docs/11-validation.md 项 01）：
 *   'jie'     —— 与主流排盘软件一致（默认）
 *   'zhongqi' —— 命宫源自月将，而月将换于中气，理论上更自洽
 * 二者在节与中气之间出生的人身上给出相差一位的命宫。
 * 两种都已实现 —— 差别体现在**传入哪个月支**，故本函数不需要知道取法，
 * 由调用方按 rulesUsed 决定并声明。
 */

import { branchAt, branchIndex, mod, monthStemOf } from "../ganzhi/algebra.js";
import { MONTH_BRANCH_ORDER } from "../ganzhi/tables.js";
import type { Branch, Pillar, Stem } from "../types/ganzhi.js";

/**
 * 由中气黄经定月支。
 *
 * 中气位于 330 + 30k：雨水 330° 属寅月、春分 0° 属卯月 …… 大寒 300° 属丑月。
 * 每个中气恰在其节之后 15°，故中气月与节月错开半个月。
 */
export function monthBranchByZhongqi(zhongqiLongitude: number): Branch {
  const k = Math.floor(mod(zhongqiLongitude - 330, 360) / 30);
  const b = MONTH_BRANCH_ORDER[k];
  if (b === undefined) throw new RangeError(`黄经 ${zhongqiLongitude}° 不是中气`);
  return b;
}

/** 节气月序：寅 = 1 … 丑 = 12。 */
export function monthOrdinalOf(branch: Branch): number {
  const i = MONTH_BRANCH_ORDER.indexOf(branch);
  if (i < 0) throw new RangeError(`${branch} 不是合法的月支`);
  return i + 1;
}

export function mingGongOf(monthBranch: Branch, hourBranch: Branch, yearStem: Stem): Pillar {
  // 寅起的月序转为子起：寅(1) → 3
  const mZi = mod(monthOrdinalOf(monthBranch) + 1, 12) + 1;
  const h = branchIndex(hourBranch) + 1;
  const ordinal = mod(14 - mZi - h - 1, 12) + 1;   // 子 = 1
  const branch = branchAt(ordinal - 1);
  return { stem: monthStemOf(yearStem, branch), branch };
}

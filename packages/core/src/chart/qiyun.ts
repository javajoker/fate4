/**
 * 起运与大运。
 *
 * ## 换算率只有一条
 *
 * **3 日 = 1 年**。其余全部由它推出，不另立常数：
 *
 *     1 日   = 1/3 年 = 4 个月
 *     1 时辰 = 1/12 日 = 1/3 月 = 10 日（岁数）
 *     1 小时 = 5 日（岁数）
 *
 * ⚠️ 传统口诀里的「一时折五日」中，「时」指**小时**而非时辰。
 * 若读作时辰，则 1 日 = 12 × 5 = 60 日 = 2 月，与「1 日折 4 月」直接冲突。
 * 本实现只保留 3:1 这一条比率，其余现推 —— 从源头上杜绝这类自相矛盾。
 *
 * ## 顺逆
 *
 * 阳年男、阴年女顺行（向未来的节）；阴年男、阳年女逆行（向过去的节）。
 * 「阳年阴年」取**年干**的阴阳，不是年支。
 */

import { polarityOf, stepStem, stepBranch } from "../ganzhi/algebra.js";
import { fromJulianDay } from "../astro/julian.js";
import type { Pillar } from "../types/ganzhi.js";
import type { Gender, LuckInfo, LuckPillar } from "./types.js";

/** 回归年长度（日）—— 起运时长与实际历时的换算。 */
export const TROPICAL_YEAR_DAYS = 365.2421897;

/** 唯一的换算率：3 日折 1 年。 */
export const DAYS_PER_LUCK_YEAR = 3;

export function luckDirectionOf(yearStem: Pillar["stem"], gender: Gender): "forward" | "reverse" {
  const yang = polarityOf(yearStem) === "阳";
  return yang === (gender === "male") ? "forward" : "reverse";
}

/**
 * 传统离散换算，仅供与旧式排盘对照。
 * 逐级截断，误差可达数月 —— 不作默认。
 */
export function traditionalQiyun(daysToTerm: number): { years: number; months: number; days: number } {
  const years = Math.floor(daysToTerm / DAYS_PER_LUCK_YEAR);
  const remainderDays = daysToTerm - years * DAYS_PER_LUCK_YEAR;
  const totalMonths = remainderDays * 4;             // 1 日 = 4 月
  const months = Math.floor(totalMonths);
  const days = Math.round((totalMonths - months) * 30);
  return { years, months, days };
}

export interface QiyunInput {
  readonly birthJdUT: number;
  readonly monthPillar: Pillar;
  readonly yearStem: Pillar["stem"];
  readonly gender: Gender;
  /** 顺行取下一个节，逆行取上一个节。 */
  readonly prevJie: { readonly name: string; readonly jdUT: number };
  readonly nextJie: { readonly name: string; readonly jdUT: number };
  readonly pillarCount: number;
}

export function computeLuck(input: QiyunInput): LuckInfo {
  const direction = luckDirectionOf(input.yearStem, input.gender);
  const target = direction === "forward" ? input.nextJie : input.prevJie;
  const daysToTerm = Math.abs(target.jdUT - input.birthJdUT);

  // 连续换算：Δ 日 → Δ/3 岁 → 折回实际历时
  const startAgeYears = daysToTerm / DAYS_PER_LUCK_YEAR;
  const startJd = input.birthJdUT + startAgeYears * TROPICAL_YEAR_DAYS;

  const step = direction === "forward" ? 1 : -1;
  const pillars: LuckPillar[] = [];
  for (let n = 1; n <= input.pillarCount; n++) {
    const s = startJd + (n - 1) * 10 * TROPICAL_YEAR_DAYS;
    const e = startJd + n * 10 * TROPICAL_YEAR_DAYS;
    pillars.push({
      index: n,
      pillar: {
        stem: stepStem(input.monthPillar.stem, step * n),
        branch: stepBranch(input.monthPillar.branch, step * n),
      },
      startJd: s,
      endJd: e,
      startCalendar: fromJulianDay(s),
      startAgeYears: startAgeYears + (n - 1) * 10,
    });
  }

  return {
    direction,
    daysToTerm,
    targetTermName: target.name,
    startJd,
    startCalendar: fromJulianDay(startJd),
    startAgeYears,
    traditional: traditionalQiyun(daysToTerm),
    pillars,
  };
}

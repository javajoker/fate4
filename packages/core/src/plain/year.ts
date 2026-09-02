/**
 * 某一年的人话 —— 供「回看」用。
 *
 * ## 为什么单独一支
 *
 * `plainCards` 出的是「今年」那一档，只算当下这一年。回看要的是**任意一年**，
 * 且要能在不暴露年份的情况下先把说法给出来（见 `docs/15-engagement.md` §2.1）。
 *
 * ## 仍然不新造判断
 *
 * 全部来自 `yearView` 已经算好的东西：顺逆指数、域的张力与净值、应期事件。
 * 人话只是把这些枚举与数值查表换个说法 —— 与 `cards.ts` 同一条纪律。
 */

import type { BaseChart } from "../chart/baseChart.js";
import type { Params } from "../params/types.js";
import { yearView } from "../temporal/views.js";
import { DOMAIN_LABEL } from "../yingqi/types.js";
import { favorPlain } from "./vocab.js";

/** 域 → 它指向哪一类事。与 `GOD_DOMAIN_PLAIN` 同样只说类别。 */
export const DOMAIN_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  career: "工作与位置上的事",
  wealth: "钱与务实往来上的事",
  marriage: "亲密关系上的事",
  health: "身心状态上的事",
  study: "学业与文书上的事",
  kin: "家人与长辈上的事",
  relocation: "走动与环境变化上的事",
  legal: "纠纷与规则上的事",
  social: "人际与同辈上的事",
});

export interface PlainYear {
  readonly year: number;
  /** 一句总述。**不含年份** —— 回看时年份是折叠的。 */
  readonly headline: string;
  /** 张力最大的几个域，各一句。 */
  readonly domains: readonly { readonly label: string; readonly text: string }[];
  /** 顺逆指数原值，供技术版展开。 */
  readonly favorIndex: number;
  /** 模型自己的把握程度 —— 汇总时按它分栏。 */
  readonly confidence: number;
}

/**
 * 某一年的人话。
 *
 * `confidence` 取本命用神判定的置信度 —— 顺逆指数整条曲线都建在用神之上，
 * 用神取得不确定，这一年的说法就跟着不确定。这不是另立一个数，
 * 是把已有的那个如实带出来。
 */
export function plainYear(base: BaseChart, year: number, params?: Params): PlainYear {
  const v = yearView(base, year, params);

  // 张力最大的三个域。张力衡量的是「支持与反对势均力敌」——
  // 它高，说明该域有实质变动；它低，说明该域这一年没什么可说的。
  const top = [...v.domains]
    .filter((d) => d.tension > 0.25 || Math.abs(d.net) > 0.5)
    .sort((a, b) => b.tension - a.tension)
    .slice(0, 3)
    .map((d) => ({
      label: DOMAIN_PLAIN[d.domain] ?? DOMAIN_LABEL[d.domain] ?? d.label,
      text: d.tension > 0.6
        ? "这一路两头都有力，拉扯明显"
        : d.net > 0 ? "这一路推力多于阻力" : "这一路阻力多于推力",
    }));

  return {
    year,
    headline: `${favorPlain(v.favorIndex)}。这说的是这一年的结构与你本命的契合程度，`
      + "不是运气好坏，也不是生活质量。",
    domains: Object.freeze(top),
    favorIndex: v.favorIndex,
    confidence: base.conclusions.yongshen.confidence,
  };
}

/**
 * 星盘合盘（synastry）—— 两张星盘之间的相位与落宫。
 *
 * ## 与四柱合盘同一条纪律
 *
 * **不给分数。** 理由见 `bazi.ts` 开头 —— 那条理由与系统无关，
 * 是关于「两个具体的人」这件事本身的。
 *
 * ## 这一套比四柱更需要当心，因为它看起来更精确
 *
 * 相位带着度数（「差 0.3 度」），落宫带着宫位号。那些数看起来像测量，
 * 而它们确实是算出来的 —— **但「算得准」与「说得准」是两回事**。
 * 行星位置本项目实测误差 25 角秒；而「金星四分火星意味着什么」
 * 没有任何东西可以校验。
 *
 * 精确的输入不会让输出变得可靠。这一条[第 2 章](../../../book-compare/02-天文含量.md)
 * 末尾就写过，而合盘是它最容易被忘掉的地方。
 *
 * ## 落宫为什么不对称
 *
 * 「甲方的金星落在乙方的第七宫」与「乙方的金星落在甲方的第七宫」
 * 是两件**不同**的事，因为两张盘的上升点不同。
 * 故落宫要两个方向各算一遍 —— 只算一边是常见的实现错误。
 */

import { norm360 } from "../astro/angles.js";
import type { Params } from "../params/types.js";
import { DEFAULT_PARAMS } from "../params/defaults.js";
import { signIndexOf, wholeSignHouse } from "../sky/angles.js";
import { ASPECT_ANGLE, ASPECT_NAME, type AspectKind, type SkyChart } from "../sky/chart.js";
import { BODY_NAME, type ClassicalBody } from "../sky/dignities.js";

export interface CrossAspect {
  readonly a: ClassicalBody;
  readonly b: ClassicalBody;
  readonly aName: string;
  readonly bName: string;
  readonly kind: AspectKind;
  readonly kindName: string;
  /** 实际角距与正角之差，度。 */
  readonly orb: number;
  /** 按整宫成相 —— 古典本义，不带容许度。 */
  readonly byWholeSign: boolean;
}

export interface HousePlacement {
  readonly body: ClassicalBody;
  readonly name: string;
  /** 落在对方盘的第几宫（整宫制）。 */
  readonly house: number;
  readonly sign: string;
  readonly degree: number;
}

export interface Synastry {
  readonly crossAspects: readonly CrossAspect[];
  /** 甲方的星落在乙方盘的哪些宫。 */
  readonly aInBHouses: readonly HousePlacement[];
  /** 乙方的星落在甲方盘的哪些宫 —— **与上一项不同**，两张盘的上升点不同。 */
  readonly bInAHouses: readonly HousePlacement[];
  /** 两张盘上升点之间的角距，度。 */
  readonly ascendantGap: number;
  /** **恒为 null。** 见 `bazi.ts` 文件头：不给合盘分数。 */
  readonly score: null;
  readonly notes: readonly string[];
}

const SIGN_NAMES: readonly string[] = Object.freeze([
  "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
  "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼",
]);

/**
 * 两张星盘之间的相位与落宫。
 *
 * @param maxOrb 覆盖容许度；不给则取 `Params.sky.maxOrb` —— 与单盘同源。
 */
export function synastry(
  a: SkyChart, b: SkyChart, maxOrb?: number, params?: Params,
): Synastry {
  const orb = maxOrb ?? (params ?? DEFAULT_PARAMS).sky.maxOrb;
  const crossAspects: CrossAspect[] = [];
  for (const pa of a.bodies) {
    for (const pb of b.bodies) {
      const sep = Math.abs(((pa.longitude - pb.longitude + 540) % 360) - 180);
      const signGap = Math.abs(((pa.signIndex - pb.signIndex + 18) % 12) - 6);
      for (const kind of Object.keys(ASPECT_ANGLE) as AspectKind[]) {
        const exact = ASPECT_ANGLE[kind];
        const gap = Math.abs(sep - exact);
        const byWholeSign = signGap * 30 === exact;
        if (gap <= orb || byWholeSign) {
          crossAspects.push({
            a: pa.body, b: pb.body,
            aName: BODY_NAME[pa.body], bName: BODY_NAME[pb.body],
            kind, kindName: ASPECT_NAME[kind], orb: gap, byWholeSign,
          });
        }
      }
    }
  }

  const placeIn = (from: SkyChart, into: SkyChart): readonly HousePlacement[] =>
    Object.freeze(from.bodies.map((p) => ({
      body: p.body, name: BODY_NAME[p.body],
      house: wholeSignHouse(p.longitude, into.angles.ascendant),
      sign: SIGN_NAMES[signIndexOf(p.longitude)]!,
      degree: p.degree,
    })));

  return {
    crossAspects: Object.freeze(crossAspects),
    aInBHouses: placeIn(a, b),
    bInAHouses: placeIn(b, a),
    ascendantGap: Math.abs(
      ((norm360(a.angles.ascendant) - norm360(b.angles.ascendant) + 540) % 360) - 180),
    score: null,
    notes: Object.freeze([
      "落宫要两个方向各看一遍：「甲方的金星在乙方第七宫」与"
      + "「乙方的金星在甲方第七宫」是两件不同的事，因为两张盘的上升点不同。",
      "⚠️ 相位带着度数，看起来像测量 —— 它确实是算出来的，"
      + "行星位置的实测误差不超过 25 角秒。但「算得准」与「说得准」是两回事："
      + "一个相位意味着什么，没有任何东西可以校验。",
      "本项目不给合盘分数，理由与四柱那边相同。",
      "⚠️ 第二张盘是另一个人的生辰。数据始终不出本机 —— "
      + "但那是技术上的保证，与那个人知不知道这件事无关。两者是两回事。",
    ]),
  };
}

/**
 * 紫微合盘：**本项目不做。**
 *
 * 不是忘了。紫微的合盘法远不如四柱与星盘那样有通行的取法 ——
 * 各家做法差异极大，而本项目没有可靠底本。
 *
 * 收一个拿不准的合盘法，比不收坏得多：合盘本来就是最容易被当成判决的地方，
 * 再加上一套来历不明的规则，等于拿编的东西去影响一个人对另一个人的看法。
 */
export const ZIWEI_PAIRING_NOT_INCLUDED =
  "紫微合盘各家取法差异极大，本项目无可靠底本，故不收录。"
  + "想对照两张紫微盘，可以各排一张并排看 —— 那至少不会把编出来的规则当成传统。";

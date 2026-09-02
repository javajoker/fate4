/**
 * 跨体系的结构断言与对照层。
 *
 * ## ⚠️ 一致**不是**印证
 *
 * 六爻、六壬、奇门、四柱流日，全都是**同一时刻干支的确定性函数**。
 * 它们给出方向一致的结论，不构成独立证据 —— 没有抽样，就没有可言的独立性。
 * 这与 [12] §4 对统计节点的表述是同一条纪律：
 * 确定性序列上算出来的散布，不是概率。
 *
 * | | |
 * | ✅ 成立 | 「两个体系在这一轴上给出方向一致／不一致的结构判断」 |
 * | ❌ 不成立 | 「两个体系都说顺，所以更可信」 |
 *
 * 故本层**只报一致与分歧，不做加权合成**。三者分歧是信息，平均掉就把信息毁了 ——
 * 与调候／扶抑并列、《内经》五窍两说并列，同一处理。
 *
 * ## 「无从比对」不是「一致」
 *
 * 两侧都判中性时，看起来像一致，其实是**两边都没话说**。把它记成一致，
 * 会让「一致率」这个数字虚高，而虚高的那部分恰恰是最没有信息的那部分。
 * 故另立一档。
 *
 * ## 单侧也要报
 *
 * 某一轴只有一个体系说得上话（如时间窗只有六爻给），必须明写「单侧」，
 * 不能静默丢掉 —— 丢掉之后，读者会以为另一侧默认同意。
 */

export type DivinationSystem = "bazi" | "liuyao" | "liuren" | "qimen";

export const SYSTEM_LABEL: Readonly<Record<DivinationSystem, string>> = Object.freeze({
  bazi: "四柱", liuyao: "六爻", liuren: "六壬", qimen: "奇门",
});

/**
 * 可比对的轴。
 *
 * 轴要少而稳 —— 每加一轴，就多一处「两个体系其实在说不同的事，却被摆在一起比」的风险。
 */
export type ClaimAxis = "我方位置" | "阻碍来源" | "事之动静" | "时间窗" | "方位";

/**
 * 顺 / 逆 / 中性。
 *
 * **刻意不用吉凶。** 顺逆描述的是当下结构与本命取用的契合程度，
 * 与生活好坏之间没有本系统能担保的对应；吉凶则是对结果的断言，由措辞守卫拦下。
 * 这与四柱的「顺逆指数」用的是同一套词。
 */
export type ClaimPolarity = "顺" | "逆" | "中性";

export interface StructuralClaim {
  readonly system: DivinationSystem;
  readonly axis: ClaimAxis;
  readonly polarity: ClaimPolarity;
  /** 依据 —— 只述结构，不述结果。 */
  readonly evidence: string;
  readonly confidence: number;
}

export type AgreementKind =
  /** 两个以上体系都给出方向，且方向相同。 */
  | "一致"
  /** 两个以上体系给出相反的方向。 */
  | "分歧"
  /** 一方给出方向，另一方判中性 —— **这不是一致**，是另一方没话说。 */
  | "单侧表态"
  /** 两侧皆中性 —— 两边都没话说。 */
  | "无从比对"
  /** 该轴不判方向，两侧只作并列陈述。 */
  | "并列"
  /** 该轴只有一个体系产出了断言。 */
  | "单侧";

/**
 * 哪些轴判方向。
 *
 * 「事之动静」与「时间窗」本就不判顺逆 —— 动不等于好，静也不等于坏。
 * 初稿没分开，于是这两轴两侧都判中性时被记成「无从比对」，
 * 而它们其实**两边都说了话**，只是说的不是方向。两件事不该共用一个名目。
 */
export const AXIS_DIRECTIONAL: Readonly<Record<ClaimAxis, boolean>> = Object.freeze({
  我方位置: true, 阻碍来源: true, 方位: true,
  事之动静: false, 时间窗: false,
});

export interface AxisComparison {
  readonly axis: ClaimAxis;
  readonly kind: AgreementKind;
  readonly claims: readonly StructuralClaim[];
  readonly note: string;
}

/**
 * 逐轴对照。**不合成、不裁决、不打分。**
 *
 * 轴的次序按 {@link AXIS_ORDER} 固定，免得同一份数据两次调用给出两种排列。
 */
export function crossref(claims: readonly StructuralClaim[]): AxisComparison[] {
  const out: AxisComparison[] = [];
  for (const axis of AXIS_ORDER) {
    const on = claims.filter((c) => c.axis === axis);
    if (on.length === 0) continue;
    const systems = new Set(on.map((c) => c.system));
    if (systems.size === 1) {
      out.push({
        axis, kind: "单侧", claims: on,
        note: `此轴只有${SYSTEM_LABEL[on[0]!.system]}一侧说得上话。`
          + "另一侧未表态，不等于默认同意。",
      });
      continue;
    }
    if (!AXIS_DIRECTIONAL[axis]) {
      out.push({
        axis, kind: "并列", claims: on,
        note: "此轴不判顺逆 —— 动不等于好，静也不等于坏。两侧各述所见，并列陈述。",
      });
      continue;
    }
    const voiced = on.filter((c) => c.polarity !== "中性");
    if (voiced.length === 0) {
      out.push({
        axis, kind: "无从比对", claims: on,
        note: "两侧皆判中性 —— 这是两边都没话说，不是两边说到一处去了。",
      });
      continue;
    }
    const voicedSystems = new Set(voiced.map((c) => c.system));
    if (voicedSystems.size === 1) {
      out.push({
        axis, kind: "单侧表态", claims: on,
        note: `此轴只有${SYSTEM_LABEL[voiced[0]!.system]}给出了方向，另一侧判中性。`
          + "这不是一致 —— 另一侧没有表态，不等于它同意。",
      });
      continue;
    }
    if (new Set(voiced.map((c) => c.polarity)).size > 1) {
      out.push({
        axis, kind: "分歧", claims: on,
        note: "两侧方向相反。此处并列两说，不作裁决 —— "
          + "两个体系本就各有其判据，取一舍一等于替读者做了选择。",
      });
    } else {
      out.push({
        axis, kind: "一致", claims: on,
        note: "两侧方向相同。⚠️ 两者都是同一日干支的确定性函数，"
          + "方向一致不构成互相印证。",
      });
    }
  }
  return out;
}

export const AXIS_ORDER: readonly ClaimAxis[] = Object.freeze([
  "我方位置", "阻碍来源", "事之动静", "时间窗", "方位",
]);

/** 对照结果的一句话概括 —— 供报告摘要。**不给出「总体顺逆」这类合成判断。** */
export function summarizeCrossref(cs: readonly AxisComparison[]): string {
  const n = (k: AgreementKind) => cs.filter((c) => c.kind === k).length;
  const parts = [
    n("一致") > 0 ? `${n("一致")} 轴方向相同` : "",
    n("分歧") > 0 ? `${n("分歧")} 轴方向相反` : "",
    n("单侧表态") > 0 ? `${n("单侧表态")} 轴仅一侧给出方向` : "",
    n("无从比对") > 0 ? `${n("无从比对")} 轴两侧皆无话可说` : "",
    n("并列") > 0 ? `${n("并列")} 轴不判方向、只作并列陈述` : "",
    n("单侧") > 0 ? `${n("单侧")} 轴仅一侧有判据` : "",
  ].filter((x) => x !== "");
  return parts.length === 0 ? "两侧均未产出可比对的结构判断。" : parts.join("，") + "。";
}

/**
 * Q4 断论 —— 输出结构，不输出结果。
 *
 * ## 这一层是整个第二台引擎风险最高的地方
 *
 * 六爻典籍的断语是赤裸的结果预言：「用神旺相，主求财必得」「官鬼持世，病难愈」。
 * 而措辞守卫拦的正是「主体 + 情态 + 后果」这种形状。
 *
 * 不能靠改词绕过去 —— 把「必得」改成「多半能得」只是把强断言换成弱断言，形状没变。
 * 做法是**卦象层只出结构**：本模块产出的每条 `LiuyaoFinding` 都是对卦象的描述
 * （谁旺、谁动、谁克谁），叙述层再据此组织措辞。
 *
 * | 传统断语 | 本层输出 |
 * | 用神旺相得日辰生扶，主求财必得 | `用神力量: 有力`，evidence 为「临月建得令、日辰生之」 |
 * | 官鬼持世，病难愈 | `世应关系: 用神持世`，evidence 为「官鬼在世爻」 |
 *
 * **本模块不产出任何含成败、吉凶、时点的字符串。** 那些只能在报告层由模板生成，
 * 且逐条过措辞守卫。
 */

import type { Verdict, DerivationStep } from "../conclude/types.js";
import type { LiuyaoParams } from "../params/types.js";
import { generates, controls } from "../ganzhi/algebra.js";
import type { DressedGua, YaoInfo } from "./dress.js";
import { strengthOf, type YaoBand, type YaoStrength } from "./strength.js";
import type { Yongshen } from "./yongshen.js";

export type FindingAspect =
  | "用神力量" | "用神动静" | "世应关系" | "原神消长" | "忌神消长" | "卦象总体";

export interface LiuyaoFinding {
  readonly aspect: FindingAspect;
  /** 一句结构描述，如「用神妻财酉金临月建得令」。**不含成败与时点。** */
  readonly value: string;
  readonly confidence: number;
  readonly derivation: readonly DerivationStep[];
  readonly alternatives: readonly { readonly value: string; readonly reason: string }[];
}

export interface Judgement {
  readonly gua: DressedGua;
  /**
   * 用神的**完整判定**，不只是取中的那一个爻。
   *
   * 初版只存 `Yongshen` 的值，于是「妻财两现、按阶梯取了第四爻」这件事
   * 只活在 Verdict 的推导链里，报告层拿不到 —— 读者看到的是一个仿佛唯一的用神。
   * 报告不做新判断、每句话都要能溯源，靠的正是这条推导链，故整个 Verdict 都要带上。
   */
  readonly yongshenVerdict: Verdict<Yongshen>;
  readonly yongshen: Yongshen;
  /** 用神力量。用神伏藏时为 null。 */
  readonly strength: Verdict<YaoStrength> | null;
  readonly findings: readonly LiuyaoFinding[];
}

const nameOf = (y: YaoInfo) => `${y.liuqin}${y.branch}${y.element}`;

/** 某爻是否发动。伏神不入动静之论。 */
const movingLabel = (y: YaoInfo): string => {
  if (!y.moving) {
    return y.chongState === "暗动" ? "安静而逢日冲，旺相为暗动 —— 虽静而实动"
      : y.chongState === "冲散" ? "安静而逢日冲，衰弱为冲散"
        : "安静";
  }
  const b = y.bian!;
  return `发动，化${b.liuqin}${b.branch}（${b.shengke}${
    b.flags.length > 0 ? "、" + b.flags.join("、") : ""}）`;
};

export function judge(
  gua: DressedGua, ysv: Verdict<Yongshen>, p: LiuyaoParams,
): Judgement {
  const ys = ysv.value;
  const findings: LiuyaoFinding[] = [];
  const yao = ys.yao;
  const strength = yao === null ? null : strengthOf(gua, yao, p);

  // ── 用神力量 ──
  if (yao !== null && strength !== null) {
    findings.push({
      aspect: "用神力量",
      value: `用神${nameOf(yao)}在第${yao.pos}爻，力量为${strength.value.band}`,
      confidence: strength.confidence,
      derivation: strength.derivation,
      alternatives: [],
    });
  } else if (ys.fu !== null) {
    findings.push({
      aspect: "用神力量",
      value: `用神${ys.fu.liuqin}${ys.fu.branch}不上卦，伏于第${ys.fu.pos}爻`
        + `${ys.fu.feiLiuqin}${ys.fu.feiBranch}之下`,
      confidence: 0.55,
      derivation: [{
        step: "伏藏",
        detail: "用神不上卦，取本宫卦同位为伏神，压其上的本卦爻为飞神。"
          + "伏神能否得出，各家判据不一（见 liuyao.fushen.rules）；"
          + "此为结构上找不到对应位置，不作成败之论。",
      }],
      alternatives: [],
    });
  }

  // ── 用神动静 ──
  if (yao !== null) {
    findings.push({
      aspect: "用神动静",
      value: `用神${movingLabel(yao)}`,
      confidence: 0.85,
      derivation: [{
        step: "动静",
        detail: yao.moving
          ? `第${yao.pos}爻发动，变出${yao.bian!.liuqin}${yao.bian!.stem}${yao.bian!.branch}`
          : yao.chongState === "暗动"
            ? `第${yao.pos}爻卦面上安静，然旺相而逢日辰冲，为暗动 —— 与发动同论其能生克他爻`
            : `第${yao.pos}爻安静。安静之爻不生不克他爻，须待日辰或动爻引发`,
      }],
      alternatives: [],
    });
  }

  // ── 世应关系 ──
  {
    const shi = gua.yaos[gua.shi - 1]!;
    const ying = gua.yaos[gua.ying - 1]!;
    const rel = shi.element === ying.element ? "比和"
      : generates(shi.element, ying.element) ? "世生应"
        : generates(ying.element, shi.element) ? "应生世"
          : controls(shi.element, ying.element) ? "世克应" : "应克世";
    const steps: DerivationStep[] = [{
      step: "世应",
      detail: `世在第${gua.shi}爻（${nameOf(shi)}），应在第${gua.ying}爻（${nameOf(ying)}），${rel}`,
    }];
    if (yao !== null && yao.pos === gua.shi) {
      steps.push({ step: "用神持世", detail: "用神即在世爻 —— 所问之事与自身位置重合" });
    }
    findings.push({
      aspect: "世应关系",
      value: `${rel}${yao !== null && yao.pos === gua.shi ? "，且用神持世" : ""}`,
      confidence: 0.80, derivation: steps, alternatives: [],
    });
  }

  // ── 原神与忌神 ──
  if (ys.gods !== null) {
    for (const [aspect, list, role] of [
      ["原神消长", ys.yuanYaos, ys.gods.yuan],
      ["忌神消长", ys.jiYaos, ys.gods.ji],
    ] as const) {
      if (list.length === 0) {
        findings.push({
          aspect, value: `${role}不上卦`, confidence: 0.70,
          derivation: [{ step: aspect, detail: `${role}未见于六爻之中` }],
          alternatives: [],
        });
        continue;
      }
      const moved = list.filter((y) => y.moving);
      const strongest = [...list].sort(
        (a, b) => rank(strengthOf(gua, b, p).value.band) - rank(strengthOf(gua, a, p).value.band))[0]!;
      const s = strengthOf(gua, strongest, p);
      findings.push({
        aspect,
        value: `${role}见于第${list.map((y) => y.pos).join("、")}爻，`
          + `${moved.length > 0 ? `其中第${moved.map((y) => y.pos).join("、")}爻发动，` : "皆安静，"}`
          + `最有力者为${s.value.band}`,
        confidence: s.confidence,
        derivation: s.derivation,
        alternatives: [],
      });
    }
  }

  // ── 卦象总体 ──
  {
    const steps: DerivationStep[] = [];
    const dong = gua.yaos.filter((y) => y.moving);
    steps.push({
      step: "动静", detail: dong.length === 0
        ? "六爻皆静 —— 静卦，事在酝酿，须待日月引发"
        : `第 ${dong.map((y) => y.pos).join("、")} 爻发动，共 ${dong.length} 爻`,
    });
    for (const f of gua.flags) {
      steps.push({
        step: f,
        detail: {
          六冲: "初四、二五、三上三对爻支全冲，传统将此形态归入离散、变动一类",
          六合: "三对爻支全合，传统将此形态归入聚合、缠绵一类",
          反吟: "变出之爻与本爻逐位相冲，传统将此形态归入反覆一类",
          伏吟: "变出之爻与本爻逐位相同，传统将此形态归入停滞一类",
        }[f],
      });
    }
    steps.push({
      step: "旬空月破",
      detail: `日柱旬空 ${gua.kongBranches.join("、")}；月建所冲（月破）为 ${gua.poBranch}`,
    });
    findings.push({
      aspect: "卦象总体",
      value: `${gua.ben.name}（${gua.ben.palace}宫${gua.ben.rank}）`
        + `${gua.bian === null ? "，六爻皆静无变卦" : ` → ${gua.bian.name}`}`
        + `${gua.flags.length > 0 ? `，${gua.flags.join("、")}` : ""}`,
      confidence: 0.90, derivation: steps, alternatives: [],
    });
  }

  return { gua, yongshenVerdict: ysv, yongshen: ys, strength, findings: Object.freeze(findings) };
}

const rank = (b: YaoBand): number =>
  ["无力", "偏无力", "平", "偏有力", "有力"].indexOf(b);

/** 供测试：一条 finding 里不得出现成败、吉凶、时点的字眼。 */
export const OUTCOME_WORDS: readonly string[] = Object.freeze([
  "必得", "可成", "不成", "难成", "立至", "即至", "无妨", "主得", "主失",
  "吉", "凶", "痊愈", "难愈", "破财", "发财",
]);

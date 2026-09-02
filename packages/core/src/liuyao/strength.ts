/**
 * Q3 用神力量 —— 分档与关系，不是分数。
 *
 * ## 为什么不合成分数
 *
 * 把「月建旺相 +2、日辰生扶 +1、动爻回头克 −2」加起来得一个爻力分，
 * 是六爻软件的通行做法，也很诱人 —— 有了数就能排序、能画图。
 *
 * 但这些量**性质不同，不可通约**：「月破」是一种资格上的否定（该支这个月不成立），
 * 「日辰相冲」是一次具体的冲击，「化回头克」是趋势的反转。
 * 把它们压成同一个标量，等于宣称三者可以互相补偿 ——
 * 而断卦恰恰要分开看它们：月破的用神纵有百般生扶，传统上仍以待时论。
 *
 * 故这里走**有序的规则阶梯**：逐级判定，命中即止，并记下命中的是哪一级。
 * 输出是五档枚举加一条推导链，不是一个数。
 * 与四柱那边不同 —— 那边的旺衰本就是权重的连续量，这里本就不是。
 *
 * ## 阶梯的次序即是断语的优先级
 *
 * 次序不是随手排的，它就是传统断法的优先级：
 * 先看有没有「资格问题」（月破、真空），再看得令与否，最后看生克。
 */

import type { Verdict, DerivationStep } from "../conclude/types.js";
import type { LiuyaoParams } from "../params/types.js";
import { generates, controls } from "../ganzhi/algebra.js";
import type { DressedGua, YaoInfo } from "./dress.js";

/**
 * 爻力五档。
 *
 * **刻意不叫 `StrengthBand`** —— 四柱那边已有同名类型，指的是日主旺衰，
 * 是权重的连续量分档。此处是爻的力量，来自规则阶梯而非数值。
 * 两者语义不同、算法不同，共用一个名字迟早会有人把它们当同一回事。
 */
export type YaoBand = "有力" | "偏有力" | "平" | "偏无力" | "无力";

export const YAO_BAND_ORDER: readonly YaoBand[] = Object.freeze([
  "无力", "偏无力", "平", "偏有力", "有力",
]);

export interface DongInfluence {
  readonly from: YaoInfo;
  readonly kind: "生" | "克" | "冲" | "合" | "比";
}

export interface YaoStrength {
  readonly band: YaoBand;
  /** 命中的是阶梯的哪一级 —— 供审计。 */
  readonly rung: string;
  readonly monthPhase: YaoInfo["monthPhase"];
  readonly dayRelations: YaoInfo["dayRelations"];
  /** 卦中动爻对它的作用。静卦时为空。 */
  readonly fromDong: readonly DongInfluence[];
  /** 真空：旬空且未被解除且安静。 */
  readonly trulyEmpty: boolean;
  /** 真破：月破且未被解除。 */
  readonly trulyBroken: boolean;
}

/**
 * 动爻对某爻的作用。
 *
 * **静爻不生不克他爻** —— 但「暗动」是例外：旺相之爻逢日冲，虽静而实动，
 * 一样能生克。漏掉它，暗动之爻对全卦的作用就整个丢了。
 */
export function dongInfluencesOn(gua: DressedGua, target: YaoInfo): DongInfluence[] {
  const out: DongInfluence[] = [];
  for (const y of gua.yaos) {
    if (!(y.moving || y.chongState === "暗动") || y.pos === target.pos) continue;
    if (generates(y.element, target.element)) out.push({ from: y, kind: "生" });
    else if (controls(y.element, target.element)) out.push({ from: y, kind: "克" });
    else if (y.element === target.element) out.push({ from: y, kind: "比" });
  }
  return out;
}

/**
 * 用神力量。
 *
 * 阶梯自上而下，命中即止。每一级都写明理由，故结论恒可回溯到某一条规则。
 */
/** 日冲是否算作削弱 —— 暗动不算，冲散才算。 */
const chongSanOf = (y: YaoInfo): boolean =>
  y.dayRelations.includes("日冲") && y.chongState !== "暗动";

export function strengthOf(
  gua: DressedGua, yao: YaoInfo, p: LiuyaoParams,
): Verdict<YaoStrength> {
  const derivation: DerivationStep[] = [];
  const fromDong = dongInfluencesOn(gua, yao);
  const trulyBroken = yao.yuepo && yao.yuepoNullified === null;
  const trulyEmpty = yao.xunkong && yao.xunkongNullified === null && !yao.moving;

  const sheng = fromDong.filter((d) => d.kind === "生").length;
  const ke = fromDong.filter((d) => d.kind === "克").length;
  const dayGen = yao.dayRelations.includes("日生") || yao.dayRelations.includes("临日");
  const dayKe = yao.dayRelations.includes("日克") || chongSanOf(yao);
  const wang = yao.monthPhase === "旺" || yao.monthPhase === "相";
  const ruo = yao.monthPhase === "囚" || yao.monthPhase === "死";

  derivation.push({
    step: "月建", detail: `月建 ${gua.casting.moment.pillars.month.branch}，该爻 ${yao.branch}`
      + `（${yao.element}）为${yao.monthPhase}`,
  });
  derivation.push({
    step: "日辰", detail: (yao.dayRelations.length === 0
      ? `日辰 ${gua.casting.moment.pillars.day.branch} 与该爻无直接关系`
      : `日辰 ${gua.casting.moment.pillars.day.branch}：${yao.dayRelations.join("、")}`)
      + (yao.chongState === null ? ""
        : yao.chongState === "暗动"
          ? "。该爻旺相而逢冲，为暗动 —— 虽静而实动，能生克他爻"
          : "。该爻衰弱而逢冲，为**冲散**"),
  });
  // 空破状态恒记入推导，不论是否已解 —— 初稿只在「未解」时才提，
  // 于是「用神旬空但冲空则实」这件要紧的事在推导链里一个字都没有。
  if (yao.xunkong || yao.yuepo) {
    derivation.push({
      step: "空破",
      detail: [
        yao.xunkong ? `旬空（${gua.kongBranches.join("、")}）${
          yao.xunkongNullified === null ? "，未解" : `，但${yao.xunkongNullified}`}` : "",
        yao.yuepo ? `月破（冲月建 ${gua.casting.moment.pillars.month.branch}）${
          yao.yuepoNullified === null ? "，未解" : `，但${yao.yuepoNullified}`}` : "",
      ].filter((x) => x !== "").join("；"),
    });
  }
  if (fromDong.length > 0) {
    derivation.push({
      step: "动爻", detail: fromDong.map(
        (d) => `第${d.from.pos}爻${d.from.liuqin}${d.from.branch}${d.kind}之`).join("；"),
    });
  }
  if (yao.bian !== null) {
    derivation.push({
      step: "变爻", detail: `动而化 ${yao.bian.liuqin}${yao.bian.branch}，${yao.bian.shengke}`
        + (yao.bian.flags.length > 0 ? `（${yao.bian.flags.join("、")}）` : ""),
    });
  }

  // ── 阶梯 ──
  const rungs: readonly { readonly id: string; readonly hit: boolean; readonly band: YaoBand; readonly why: string }[] = [
    {
      id: "月破", hit: trulyBroken, band: "无力",
      why: `与月建相冲而未逢动，为真破。${p.yuepo.dongErBuPo ? "「破而逢动」的解法未命中。" : ""}`,
    },
    {
      id: "真空", hit: trulyEmpty, band: "无力",
      why: "旬空、安静、又无冲实，为真空 —— 传统以待出空论，非此刻之力。",
    },
    {
      id: "回头克", hit: yao.bian?.shengke === "回头克", band: "无力",
      why: "动而化出克己之爻，趋势自反。",
    },
    {
      id: "衰而受克", hit: ruo && (dayKe || ke > 0) && sheng === 0 && !dayGen, band: "无力",
      why: "月建失令，日辰或动爻又克之，且无生扶。",
    },
    {
      id: "得令得生", hit: wang && (dayGen || sheng > 0), band: "有力",
      why: "月建得令，日辰或动爻复生之。",
    },
    {
      id: "回头生", hit: yao.bian?.shengke === "回头生" && !ruo, band: "有力",
      why: "动而化出生己之爻，趋势自增。",
    },
    {
      id: "得一助", hit: wang || dayGen || sheng > 0, band: "偏有力",
      why: [wang ? `月建${yao.monthPhase}` : "", dayGen ? "得日辰生扶" : "",
        sheng > 0 ? `得 ${sheng} 个动爻生` : ""].filter((x) => x !== "").join("、") + "。",
    },
    {
      id: "受一制", hit: ruo || dayKe || ke > 0, band: "偏无力",
      why: [ruo ? `月建${yao.monthPhase}` : "", dayKe ? "受日辰克冲" : "",
        ke > 0 ? `受 ${ke} 个动爻克` : ""].filter((x) => x !== "").join("、") + "。",
    },
  ];

  const hit = rungs.find((r) => r.hit);
  const band: YaoBand = hit?.band ?? "平";
  const rung = hit?.id ?? "无显著生克";
  derivation.push({
    step: "判档", detail: `命中「${rung}」→ ${band}。${hit?.why ?? "既无明显生扶亦无明显克制。"}`,
  });

  // 伏藏、反吟伏吟之卦本就难断，置信度随之下调
  let confidence = 0.75;
  if (gua.flags.includes("反吟") || gua.flags.includes("伏吟")) confidence -= 0.15;
  if (fromDong.length >= 3) confidence -= 0.10;   // 众动难辨主从

  return {
    value: {
      band, rung, monthPhase: yao.monthPhase, dayRelations: yao.dayRelations,
      fromDong, trulyEmpty, trulyBroken,
    },
    confidence: Math.max(0.3, confidence),
    derivation,
    alternatives: [],
  };
}

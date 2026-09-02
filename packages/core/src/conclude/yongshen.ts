/**
 * 用神选取。
 *
 * ## 四法的求值次序，与文档原先的列举次序不同
 *
 * [06-conclusions](../../../../docs/06-conclusions.md) §5 原先把优先级写成
 * 「调候 → 扶抑 → 通关 → 病药」。若按短路顺序照此实现，**通关与病药都是死代码** ——
 * 扶抑是主路，任何盘面都会返回一个用神，轮不到后两者。
 *
 * 实际的求值次序按「特殊者先行、精修者后置」重排：
 *
 * | 次序 | 法 | 性质 |
 * | 1 | 调候 | 极端气候短路。气候不解，谈扶抑无益 |
 * | 2 | 通关 | 结构条件短路。两强相持且合占全盘 45% 以上，比扶抑更具体 |
 * | 3 | 扶抑 | 主路。恒有产出 |
 * | 4 | 病药 | **后置精修**，不是并列的第四条路 —— §5.4 的「直接损害用神」 |
 * |   |      | 一句已预设了用神的存在，它只能在前三者之后跑 |
 *
 * 文档 §5 已随之改正。
 *
 * ⚠️ **调候表尚未就位。**《穷通宝鉴》的完整调候表是 10 日干 × 12 月支 = 120 格，
 * 须逐格转录并双源校对。凭记忆转录 120 格必然出错，而错误的调候表比没有更糟。
 * 在它就位前，引擎使用可计算的极端气候规则作为降级方案，
 * 并在输出中标记 `tiaohouSource: 'heuristic'` —— 绝不冒充完整调候。
 */

import { ELEMENTS, type Element, type TenGod } from "../types/ganzhi.js";
import { CONTROLS, GENERATES } from "../ganzhi/tables.js";
import { controlledBy, generatedBy } from "../ganzhi/algebra.js";
import type { Branch, Stem } from "../types/ganzhi.js";
import { tiaohouElements, tiaohouOf } from "./tiaohou.js";
import type { ConclusionParams } from "../params/types.js";
import { godGroupElement } from "./specialPattern.js";
import { GOD_GROUPS, sumGods } from "./tenGods.js";
import type { DerivationStep, SpecialPattern, StrengthBand, Verdict, YongshenVerdict } from "./types.js";

const WINTER: readonly Branch[] = Object.freeze(["亥", "子", "丑"]);
const weakDayMaster = (b: StrengthBand): boolean => b === "WEAK" || b === "VERY_WEAK";
const SUMMER: readonly Branch[] = Object.freeze(["巳", "午", "未"]);

export interface YongshenInput {
  readonly dayMasterElement: Element;
  /** 日干本身 —— 调候表按日干查，不按五行：丙丁同为火，取用却不同。 */
  readonly dayStem: Stem;
  readonly monthBranch: Branch;
  readonly byElement: Readonly<Record<Element, number>>;
  readonly tenGods: Readonly<Record<TenGod, number>>;
  readonly strength: StrengthBand;
  readonly special: SpecialPattern | null;
  /**
   * L3 的克流量矩阵，`keDamage[受害五行][施克五行]`。
   * 病药法要判的是「这个忌神**实际上**打到用神多少」，而不是「它权重多大」——
   * 一个隔了两柱、被合绊、被通关引开的忌神，权重再高也不成病。
   */
  readonly keDamage: Readonly<Record<Element, Readonly<Record<Element, number>>>>;
}

function shareOf(el: Element, by: Readonly<Record<Element, number>>): number {
  const total = ELEMENTS.reduce((a, e) => a + by[e], 0);
  return total > 0 ? by[el] / total : 0;
}

/** 喜忌五组的组装：用神既定，其余四组随之而定。 */
function assemble(
  primary: Element, secondary: Element | null, method: YongshenVerdict["method"],
  by: Readonly<Record<Element, number>>, p: ConclusionParams,
  extra: Partial<YongshenVerdict> = {},
): YongshenVerdict {
  // 一律走反向查表的具名函数。写成 CONTROLS[primary] 会得到「用神所克者」——
  // 用神水会被标成忌神火（水克火，火对水毫无威胁），而真正的敌人土反倒落进闲神。
  const xishen = [generatedBy(primary)];         // 生用神者
  const jishen = [controlledBy(primary)];        // 克用神者
  const choushen = [generatedBy(jishen[0]!)];    // 生忌神者
  const xianshen = ELEMENTS.filter(
    (e) => e !== primary && !xishen.includes(e) && !jishen.includes(e) && !choushen.includes(e));
  const strength = by[primary];
  return {
    method, primary, secondary,
    xishen, jishen, choushen, xianshen,
    strength,
    needsLuckSupport: strength < p.yongshen.weakYongshenThreshold,
    ...extra,
  };
}

/** 前三法：调候短路 → 通关短路 → 扶抑主路。 */
function baseVerdict(
  input: YongshenInput, p: ConclusionParams,
): Verdict<YongshenVerdict> {
  const { dayMasterElement: dm, dayStem, monthBranch, byElement, tenGods, strength, special } = input;
  const derivation: DerivationStep[] = [];
  const alternatives: { value: YongshenVerdict; reason: string }[] = [];

  // ── 从格 / 专旺格：顺其势，不逆 ──
  if (special !== null && special.kind !== "huaqi") {
    const primary = special.element;
    derivation.push({
      step: "特殊格局", detail: `${special.kind === "congge" ? special.subtype : special.name}，顺其势而不逆`,
    });
    return {
      value: assemble(primary, null, "fuyi", byElement, p),
      confidence: 0.75, derivation, alternatives,
    };
  }

  // ── 调候：极端气候优先 ──
  const fireShare = shareOf("火", byElement);
  const waterShare = shareOf("水", byElement);
  const isWinter = WINTER.includes(monthBranch);
  const isSummer = SUMMER.includes(monthBranch);
  const tooCold = isWinter && fireShare < p.yongshen.tiaohou.fireFloor;
  const tooHot = isSummer && waterShare < p.yongshen.tiaohou.waterFloor;

  // ⚠️ 表决定「调候要什么」，门槛决定「调候是否压过扶抑」—— 这两件事是分开的。
  // 《穷通宝鉴》给每一张盘都开了调候用神；若照单全收，扶抑、通关、病药立刻全成死码。
  // 故取用查表，而是否短路仍由极端气候的粗判把关。这正是现代命书的通行做法。
  const useTable = p.yongshen.tiaohou.source === "table";
  const cell = useTable ? tiaohouOf(dayStem, monthBranch) : null;

  if (tooCold || tooHot) {
    // 用表时取表中首位用神的五行；否则退回「寒则火、燥则水」的粗判。
    // 两者常一致，但表能给出粗判给不出的答案 ——
    // 如壬水生于子月，寒而不取火，取戊土制水、丙火解冻，首位是戊。
    const tablePrimary = cell === null ? null : tiaohouElements(cell)[0]!;
    const primary: Element = tablePrimary ?? (tooCold ? "火" : "水");
    derivation.push({
      step: "调候", detail: tooCold
        ? `生于${monthBranch}月，火仅占 ${(fireShare * 100).toFixed(1)}% < ${p.yongshen.tiaohou.fireFloor * 100}%，极寒`
        : `生于${monthBranch}月，水仅占 ${(waterShare * 100).toFixed(1)}% < ${p.yongshen.tiaohou.waterFloor * 100}%，极燥`,
      values: { fireShare, waterShare },
    });
    derivation.push(cell === null
      ? { step: "来源", detail: "《穷通宝鉴》120 格调候表未启用，此处为可计算的极端气候降级规则" }
      : {
        step: "来源",
        detail: `《穷通宝鉴》通行本 ${dayStem}日生${monthBranch}月：调候取 ${cell.stems.join("、")}`
          + `（${cell.tier === "varies" ? "⚠️ 该格版本有出入" : "各本一致"}）。`
          + "该表为凭记忆转录，未经实体书逐格核对。",
      });
    // 调候与扶抑方向相反时，必须两存 ——
    // 「身弱却取克身之神」是真实的张力，不是矛盾；把它藏起来才是错的。
    if (weakDayMaster(strength)) {
      const yin = godGroupElement(dm, "印");
      const support = byElement[yin] >= byElement[dm] ? yin : dm;
      if (support !== primary) {
        alternatives.push({
          value: assemble(support, null, "fuyi", byElement, p),
          reason: `日主判为${strength === "VERY_WEAK" ? "极弱" : "身弱"}，扶抑一路当取 ${support} 生扶；`
            + `而调候取 ${primary}，方向相反。此为调候与扶抑的固有张力，报告须并列。`,
        });
        derivation.push({
          step: "张力", detail: `调候取 ${primary}，扶抑取 ${support}，二者相反 —— 已并列为替代取用`,
        });
      }
    }
    const second = cell === null ? null : (tiaohouElements(cell)[1] ?? null);
    // 置信度：表比降级规则高，但因未经实体书核对而封顶；异文格再降一档。
    const base = cell === null ? 0.55 : cell.tier === "firm" ? 0.72 : 0.62;
    // 调候与扶抑指向相反时**封在 0.50 以下**，与来源无关。
    // 两条都立得住的取用法给出相反答案，这就是真的两说 ——
    // 此时若还报出「多半如此」的置信度，等于替读者把选择做掉了。
    const confidence = alternatives.length > 0 ? Math.min(base - 0.10, 0.45) : base;
    return {
      value: assemble(primary, second, "tiaohou", byElement, p, {
        tiaohouSource: p.yongshen.tiaohou.source,
        ...(cell === null ? {} : { tiaohouStems: cell.stems, tiaohouTier: cell.tier }),
      }),
      confidence, derivation, alternatives,
    };
  }

  // 气候未到极端 —— 调候不短路，但表的取用仍记进推导，供读者自行对照。
  if (cell !== null) {
    derivation.push({
      step: "调候（未短路）",
      detail: `《穷通宝鉴》${dayStem}日生${monthBranch}月取 ${cell.stems.join("、")}；`
        + "本盘气候未达极端，故不以调候短路，仅备参照。",
    });
  }

  // ── 通关：两组势均力敌且相克 ──
  const total = ELEMENTS.reduce((a, e) => a + byElement[e], 0);
  for (const a of ELEMENTS) {
    const b = CONTROLS[a];
    const wa = byElement[a]; const wb = byElement[b];
    if (wa <= 0 || wb <= 0) continue;
    const diff = Math.abs(wa - wb) / Math.max(wa, wb);
    if (diff < p.yongshen.tongguan.balanceBand
        && (wa + wb) / total > p.yongshen.tongguan.dominanceFloor) {
      const middle = GENERATES[a];   // a 生 middle 生 b
      if (GENERATES[middle] !== b) continue;
      derivation.push({
        step: "通关", detail: `${a}(${wa.toFixed(1)}) 与 ${b}(${wb.toFixed(1)}) 相克而势均，取${middle}通关`,
        values: { [a]: wa, [b]: wb },
      });
      return { value: assemble(middle, null, "tongguan", byElement, p), confidence: 0.7, derivation, alternatives };
    }
  }

  // ── 扶抑：主路 ──
  const weakSide = strength === "WEAK" || strength === "VERY_WEAK";
  const strongSide = strength === "STRONG" || strength === "VERY_STRONG";

  if (weakSide) {
    const yin = godGroupElement(dm, "印");
    const bi = dm;
    const primary = byElement[yin] >= byElement[bi] ? yin : bi;
    derivation.push({ step: "扶抑", detail: `身弱，取印(${yin} ${byElement[yin].toFixed(1)}) 与比劫(${bi} ${byElement[bi].toFixed(1)}) 中较有力者` });
    return { value: assemble(primary, primary === yin ? bi : yin, "fuyi", byElement, p), confidence: 0.8, derivation, alternatives };
  }

  if (strongSide) {
    // 身旺三选一：不机械取最强者，而看流通是否通畅
    const candidates: [Element, number, string][] = [
      [godGroupElement(dm, "食伤"), sumGods(tenGods, GOD_GROUPS.食伤), "食伤泄秀"],
      [godGroupElement(dm, "财"), sumGods(tenGods, GOD_GROUPS.财星), "财耗"],
      [godGroupElement(dm, "官杀"), sumGods(tenGods, GOD_GROUPS.官杀), "官杀克身"],
    ];
    const scored = candidates.map(([el, w, label]) => {
      const fedBy = ELEMENTS.find((e) => GENERATES[e] === el)!;
      const attackedBy = ELEMENTS.find((e) => CONTROLS[e] === el)!;
      const flow = byElement[fedBy] / (byElement[attackedBy] + 1);
      return { el, w, label, score: w * flow };
    }).sort((a, b) => b.score - a.score);

    const top = scored[0]!;
    derivation.push({
      step: "扶抑", detail: `身旺，三选一按「权重 × 流通度」排序：`
        + scored.map((s) => `${s.label}(${s.el}) ${s.score.toFixed(1)}`).join("、"),
    });
    if (top.w < p.yongshen.weakYongshenThreshold) {
      derivation.push({ step: "用神无力", detail: `${top.el} 仅 ${top.w.toFixed(1)}，盘中不存在，须待大运送来` });
    }
    if (scored[1] !== undefined && scored[1].score > top.score * 0.8) {
      alternatives.push({
        value: assemble(scored[1].el, null, "fuyi", byElement, p),
        reason: `${scored[1].label} 得分 ${scored[1].score.toFixed(1)}，与首选 ${top.score.toFixed(1)} 接近，取用可两存`,
      });
    }
    return {
      value: assemble(top.el, scored[1]?.el ?? null, "fuyi", byElement, p),
      confidence: alternatives.length > 0 ? 0.6 : 0.8, derivation, alternatives,
    };
  }

  // ── 中和：补全局最弱的一环 ──
  const weakest = [...ELEMENTS].sort((a, b) => byElement[a] - byElement[b])[0]!;
  derivation.push({ step: "扶抑", detail: `中和，补全局最弱的 ${weakest}（${byElement[weakest].toFixed(1)}）` });
  return { value: assemble(weakest, null, "fuyi", byElement, p), confidence: 0.6, derivation, alternatives };
}

/**
 * 第四法 · 病药 —— 后置精修。
 *
 * §5.4：`病 = 忌神组中权重最大且对用神累计克流量 > damageThreshold 者；药 = 克病者`。
 * 「忌神组」由 `assemble` 定为克用神的那一行，故 argmax 落在唯一元素上；
 * 真正的门槛在**流量**，不在权重 —— 见 `keDamage` 的注释。
 *
 * 命中后用神改取药，原用神降为 secondary（药所护者），
 * 原判定进 alternatives。**不静默替换** —— 病药与扶抑给出的是两个不同的用神，
 * 只报一个而不说另一个存在过，正是本层最容易犯的那类错。
 */
function applyBingyao(
  v: Verdict<YongshenVerdict>, input: YongshenInput, p: ConclusionParams,
): Verdict<YongshenVerdict> {
  const base = v.value;
  // 调候短路与从格/专旺顺势，都不受病药改写：前者是气候刚性，后者已放弃扶抑逻辑。
  if (base.method !== "fuyi" && base.method !== "tongguan") return v;
  if (input.special !== null) return v;

  const yong = base.primary;
  const bing = base.jishen[0];
  if (bing === undefined) return v;

  const damage = input.keDamage[yong][bing];
  const B = p.yongshen.bingyao;
  if (damage < B.damageFloor) return v;
  // 折损比 —— 用神被削掉的那一份占它「本可有」的多少。尺度无关。
  const share = damage / (base.strength + damage);
  if (share <= B.damageShare) return v;

  const yao = controlledBy(bing);   // 克病者。不是 CONTROLS[bing] —— 那正是用神自己。
  if (yao === yong) return v;

  const derivation: DerivationStep[] = [...v.derivation, {
    step: "病药",
    detail: `${bing}对用神${yong}的累计克流量 ${damage.toFixed(1)}，折损比 ${share.toFixed(3)} > ${B.damageShare}，`
      + `${bing}成病；取制病之${yao}为药`,
    values: { damage, share, damageShare: B.damageShare, damageFloor: B.damageFloor },
  }];

  return {
    value: assemble(yao, yong, "bingyao", input.byElement, p),
    // 精修多加了一重条件，置信度不高于原判定，且封顶 0.65。
    confidence: Math.min(v.confidence, 0.65),
    derivation,
    alternatives: [...v.alternatives, {
      value: base,
      reason: `不计病药时，${base.method === "tongguan" ? "通关" : "扶抑"}一路取 ${yong}；`
        + `病药一路认为 ${yong} 正被 ${bing} 所伤，须先去病。两说并存。`,
    }],
  };
}

export function yongshenVerdict(
  input: YongshenInput, p: ConclusionParams,
): Verdict<YongshenVerdict> {
  return applyBingyao(baseVerdict(input, p), input, p);
}

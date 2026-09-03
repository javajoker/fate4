/**
 * Q6 问事报告 —— 与四柱报告共用同一套模板、守卫、繁体转换与 paramsHash。
 *
 * ## 免责在问事场景要比四柱更重
 *
 * 四柱说的是「这个人的结构」，六爻说的是「此事」。后者更容易被当作对结果的承诺，
 * 故声明**首尾各一次且不可折叠**，并额外说明「同一时辰所有问事同卦」这件事 ——
 * 不说清楚，用户会以为卦是为他这一问单独起的。
 *
 * ## 这一层不产生任何新判断
 *
 * 每一句都由 Q1–Q5 的产出填模板而来，`source.ref` 指回是哪一条。
 * 报告层若能自己下结论，措辞守卫就成了摆设 —— 因为可以绕过模板另写一句。
 */

import type { Params } from "../params/types.js";
import type { Locale } from "../report/templates.js";
import { renderTemplate, localeText, type NarrativeLine } from "../report/render.js";
import { QUESTION_DISCLAIMER } from "../report/templates.js";
import { scanText, type GuardViolation } from "../report/guard.js";
import { toHant } from "../report/hant.js";
import { ENGINE_VERSION } from "../report/assemble.js";
import { paramsHash } from "../params/load.js";
import type { DressedGua } from "./dress.js";
import type { Yongshen } from "./yongshen.js";
import type { Judgement } from "./judge.js";
import { CAST_METHOD_LABEL } from "./cast.js";
import { yingqiWindows, monthLabel, type YingqiResult } from "./yingqi.js";
import { strengthOf } from "./strength.js";
import { yaociReading, collectYaociText, type YaociReading } from "./yaoci.js";

export interface QuestionReport {
  readonly meta: {
    readonly engineVersion: string;
    readonly paramsHash: string;
    readonly locale: Locale;
    readonly castMethod: string;
    /** 问题文本的指纹 —— **只存哈希不存原文**，与生辰数据同一条隐私纪律。 */
    readonly questionFingerprint: string | null;
  };
  readonly disclaimerTop: string;
  readonly casting: { readonly narrative: readonly NarrativeLine[] };
  readonly gua: {
    readonly narrative: readonly NarrativeLine[];
    /** 供表格渲染的逐爻数据。 */
    readonly yaos: DressedGua["yaos"];
    readonly fushen: DressedGua["fushen"];
  };
  readonly topic: { readonly narrative: readonly NarrativeLine[] };
  readonly judgement: { readonly narrative: readonly NarrativeLine[] };
  readonly yingqi: { readonly narrative: readonly NarrativeLine[]; readonly result: YingqiResult };
  /**
   * 指事 —— 爻辞一路。
   *
   * ⚠️ `reading` 里的字**已经是目标语言的**：繁体取的是繁体语料原文，
   * 不经 `toHant`。这与报告其余部分相反，是刻意的 —— 那些是本项目自己写的话，
   * 机械转换是本分；这些是引文，代人改写不是。
   */
  readonly yaoci: { readonly narrative: readonly NarrativeLine[]; readonly reading: YaociReading };
  readonly disclaimerBottom: string;
  readonly guard: { readonly scanned: number; readonly violations: readonly GuardViolation[] };
}

class Lines {
  readonly items: NarrativeLine[] = [];
  constructor(private readonly locale: Locale) {}
  add(id: string, slots: Record<string, string | number>, confidence = 1, ref?: string): void {
    this.items.push(renderTemplate(id, slots, {
      locale: this.locale, confidence,
      ...(ref === undefined ? {} : { source: { kind: "verdict" as const, ref } }),
    }));
  }
}

export interface QuestionReportOptions {
  readonly locale?: Locale;
  /** 问题文本的哈希。调用方自行计算，**不要把原文传进来**。 */
  readonly questionFingerprint?: string;
}

export function buildQuestionReport(
  j: Judgement, params: Params, options: QuestionReportOptions = {},
): QuestionReport {
  const locale = options.locale ?? params.report.locale;
  const p = params.liuyao;
  const gua = j.gua;
  const ys: Yongshen = j.yongshen;
  const ysVerdict = j.yongshenVerdict;
  const T = (s: string) => (locale === "zh-Hant" ? toHant(s) : s);

  // ── 起卦 ──
  const L0 = new Lines(locale);
  L0.add("liuyao.cast", {
    method: CAST_METHOD_LABEL[gua.casting.method],
    pillars: Object.values(gua.casting.moment.pillars)
      .map((x) => `${x.stem}${x.branch}`).join(" "),
    gua: `${gua.ben.name}（${gua.ben.palace}宫${gua.ben.rank}）`
      + (gua.bian === null ? "" : ` → ${gua.bian.name}`),
    moving: gua.casting.moving.length === 0
      ? "六爻皆静"
      : `第 ${gua.casting.moving.map((i) => i + 1).join("、")} 爻动`,
  }, 1, "casting");
  if (gua.casting.method !== "coin") L0.add("liuyao.mix", {}, 1, "casting.method");

  // ── 占事与用神 ──
  const L1 = new Lines(locale);
  if (ys.gods === null) {
    L1.add("liuyao.topic.shiying", {
      topic: ys.topic.label,
      pos: ys.yao !== null && ys.yao.pos === gua.shi ? "世爻" : "应爻",
    }, 1, "yongshen");
  } else {
    L1.add("liuyao.topic", {
      topic: ys.topic.label, yong: ys.gods.yong, yuan: ys.gods.yuan, ji: ys.gods.ji,
    }, 1, "yongshen");
  }

  // 用神多现是断卦的要紧一步，不能只留在推导链里 —— 读者看不到「本来还有别的爻可取」，
  // 就会以为这个用神是唯一的。
  if (ys.candidates.length > 1 && ys.yao !== null && ys.gods !== null) {
    const why = ysVerdict.derivation
      .filter((d) => d.step === "多现取舍" || d.step === "多现未定")
      .map((d) => d.detail).join("；");
    L1.add("liuyao.yong.duoxian", {
      yong: ys.gods.yong,
      positions: ys.candidates.map((c) => c.pos).join("、"),
      taken: ys.yao.pos,
      why: why === "" ? "诸条判据逐级淘汰后所余。" : why,
    }, ysVerdict.confidence, "yongshen.多现");
  }

  // ── 断论 ──
  const L2 = new Lines(locale);
  const st = ys.yao === null ? null : strengthOf(gua, ys.yao, p);
  if (ys.yao !== null && st !== null) {
    L2.add("liuyao.yong.strength", {
      yong: `${ys.yao.liuqin}${ys.yao.branch}`, pos: ys.yao.pos,
      band: st.value.band, rung: st.value.rung,
    }, st.confidence, "judge.用神力量");
    if (ys.yao.moving) {
      L2.add("liuyao.yong.moving", {
        pos: ys.yao.pos,
        bian: `${ys.yao.bian!.liuqin}${ys.yao.bian!.branch}`,
        shengke: ys.yao.bian!.shengke,
      }, 1, "judge.用神动静");
    } else if (ys.yao.chongState === "暗动") {
      L2.add("liuyao.yong.andong", { pos: ys.yao.pos }, 1, "judge.用神动静");
    } else {
      L2.add("liuyao.yong.still", { pos: ys.yao.pos }, 1, "judge.用神动静");
    }
  } else if (ys.fu !== null) {
    L2.add("liuyao.yong.fu", {
      yong: `${ys.fu.liuqin}${ys.fu.branch}`, pos: ys.fu.pos,
      fei: `${ys.fu.feiLiuqin}${ys.fu.feiBranch}`,
    }, 0.55, "judge.用神力量");
  }
  const shiYing = j.findings.find((f) => f.aspect === "世应关系");
  if (shiYing !== undefined) {
    L2.add("liuyao.shiying", {
      shi: gua.shi, ying: gua.ying, rel: shiYing.value,
    }, shiYing.confidence, "judge.世应关系");
  }
  if (gua.casting.moving.length === 0) {
    L2.add("liuyao.gua.still", { gua: gua.ben.name }, 1, "judge.卦象总体");
  } else if (gua.flags.length > 0) {
    L2.add("liuyao.gua.flags", {
      gua: `${gua.ben.name} → ${gua.bian!.name}`,
      // ⚠️ 措辞守卫当场逮到过这里：初稿写的是「结构上主离散、主变动」，
      // 而「主X」正是 zh.liuyao.verbZhu 要拦的那种省略主语的结果断言 ——
      // 我自己写的模板撞上了自己刚立的规矩。改为陈述**传统的分类**，
      // 而不是陈述对命主的后果。
      flags: gua.flags.map((f) => ({
        六冲: "三对爻支全冲，传统将此形态归入离散、变动一类。",
        六合: "三对爻支全合，传统将此形态归入聚合、缠绵一类。",
        反吟: "变出之爻与本爻逐位相冲，传统将此形态归入反覆一类。",
        伏吟: "变出之爻与本爻逐位相同，传统将此形态归入停滞一类。",
      }[f])).join(""),
    }, 1, "judge.卦象总体");
  }

  // ── 应期 ──
  const L3 = new Lines(locale);
  // ⚠️ 应期的 reasons / suppressed / derivation 是**数据串**，不经模板层，
  // 因而不会被 renderWith 的繁体转换碰到 —— 与四柱那边 meta.warnings、
  // stemPhaseSummary 同一类的漏。此处显式补。
  const raw = yingqiWindows(gua, ys, st?.value ?? null, p);
  const yq: YingqiResult = locale !== "zh-Hant" ? raw : {
    windows: raw.windows.map((w) => ({ ...w, reasons: w.reasons.map(T) })),
    suppressed: raw.suppressed === null ? null : T(raw.suppressed),
    derivation: raw.derivation.map((d) => ({ ...d, step: T(d.step), detail: T(d.detail) })),
  };
  if (yq.suppressed !== null || yq.windows.length === 0) {
    L3.add("liuyao.yingqi.none", { why: yq.suppressed ?? "卦象未指向任何候选时段。" },
      1, "yingqi");
  } else {
    L3.add("liuyao.yingqi", {
      windows: yq.windows.map((w) => `${monthLabel(w)}（${w.monthsAhead} 个月后）`).join("、"),
    }, 1, "yingqi");
  }
  L3.add("liuyao.disclaimer.question", {}, 1, "disclaimer");

  // ── 指事 ──
  // locale 直接交给语料，不走 T() —— 引文按原文发，不代为转写。
  const L4 = new Lines(locale);
  const yc = yaociReading(gua, ys, { locale, layer: "technical" });
  if (yc.method === "动爻") {
    L4.add("liuyao.yaoci.moving", {
      positions: yc.picks.map((x) => x.pos).join("、"),
    }, 1, "yaoci");
  } else {
    L4.add("liuyao.yaoci.shiying", { shi: gua.shi, ying: gua.ying }, 1, "yaoci");
  }
  L4.add("liuyao.yaoci.yongshen", { state: yc.hitsYongshen ? "含" : "不含" }, 1, "yaoci");
  if (yc.withheldCount > 0) {
    L4.add("liuyao.yaoci.withheld", { n: yc.withheldCount, quoted: yc.quoted }, 1, "yaoci");
  }

  const report: QuestionReport = {
    meta: {
      engineVersion: ENGINE_VERSION,
      paramsHash: paramsHash(params),
      locale,
      castMethod: T(CAST_METHOD_LABEL[gua.casting.method]),
      questionFingerprint: options.questionFingerprint ?? null,
    },
    disclaimerTop: T(localeText(QUESTION_DISCLAIMER, locale, "QUESTION_DISCLAIMER")),
    casting: { narrative: L0.items },
    gua: { narrative: [], yaos: gua.yaos, fushen: gua.fushen },
    topic: { narrative: L1.items },
    judgement: { narrative: L2.items },
    yingqi: { narrative: L3.items, result: yq },
    yaoci: { narrative: L4.items, reading: yc },
    disclaimerBottom: T(localeText(QUESTION_DISCLAIMER, locale, "QUESTION_DISCLAIMER")),
    guard: { scanned: 0, violations: [] },
  };

  // ── 导出前扫描，与四柱报告同一套 ──
  const chunks = collectQuestionText(report);
  const violations = chunks.flatMap((c) => scanText(c.text, c.where));
  return { ...report, guard: { scanned: chunks.length, violations } };
}

/** 走遍问事报告，把每一条会到达读者的字符串扫一遍。 */
export function collectQuestionText(r: QuestionReport): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = [];
  const push = (t: string, w: string) => { if (t.length > 0) out.push({ text: t, where: w }); };
  push(r.disclaimerTop, "disclaimerTop");
  push(r.disclaimerBottom, "disclaimerBottom");
  for (const [name, sec] of [
    ["casting", r.casting], ["topic", r.topic],
    ["judgement", r.judgement], ["yingqi", r.yingqi],
  ] as const) {
    for (const l of sec.narrative) push(l.text, `${name}.${l.templateId}`);
  }
  for (const w of r.yingqi.result.windows) {
    for (const reason of w.reasons) push(reason, `yingqi.${w.year}.${w.branch}`);
  }
  // 引文与叙述一并扫。`screen` 已在取用时逐条筛过，此处是**第二道**：
  // 没有它，「引文过了闸」就只是 yaoci.ts 自己说了算。
  for (const l of r.yaoci.narrative) push(l.text, `yaoci.${l.templateId}`);
  for (const q of collectYaociText(r.yaoci.reading)) push(q.text, q.where);
  return out;
}

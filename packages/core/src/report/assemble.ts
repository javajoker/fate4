/**
 * L6 报告组装。
 *
 * ## 这一层不产生任何新判断
 *
 * 每条叙述都由模板 + 槽位生成，而槽位只能取自 L0–L5 的输出。
 * `NarrativeLine.source` 记录它指回哪个 Verdict / Event —— 报告里的每一句
 * 都必须能被追问「这是从哪来的」。
 *
 * ## 纯函数
 *
 * 无 `Date.now()`。§7「当前时段」的日期由调用方传入；不传则整节略去，
 * 而不是悄悄取系统时间 —— 后者会让同一份输入在不同时刻产出不同报告。
 */

import {
  ELEMENTS, type Branch, type Element, type Pillar, type TenGod,
} from "../types/ganzhi.js";
import {
  controlledBy, elementOf, generatedBy, nayinOf, polarityOf,
  sexagenaryIndexOf, xunKongOf,
} from "../ganzhi/algebra.js";
import { CONTROLS, GENERATES, MONTH_BRANCH_ORDER } from "../ganzhi/tables.js";
import { phaseOf } from "../ganzhi/changsheng.js";
import { toJulianDay } from "../astro/julian.js";
import { enclosingTermOf } from "../chart/pillars.js";
import type { NatalChart } from "../chart/types.js";
import type { Params } from "../params/types.js";

import type { Carrier, PillarKind } from "../weights/carrier.js";
import { tenGodOf } from "../conclude/tenGods.js";
import type { KinReading, Verdict } from "../conclude/types.js";
import { ELEMENT_TRAITS, GOD_TRAITS } from "../conclude/traits.js";
import { NEIJING, wuqiaoOf } from "../conclude/neijing.js";
import { PALACE, type PalaceName, type ShenshaHit } from "../shensha/scan.js";
import { toBaseChart, type BaseChart } from "../chart/baseChart.js";
import { dayView, luckTimeline, monthView, yearView } from "../temporal/views.js";
import type { YearView } from "../temporal/types.js";
import { DOMAIN_LABEL } from "../yingqi/types.js";
import type { Locale } from "./templates.js";
import { toHant } from "./hant.js";
import { buildSeries } from "../temporal/series.js";
import { allNodes } from "../temporal/nodes.js";
import { buildFindings } from "./finding.js";
import {
  disclaimerText, fmtIndex, fmtNum, fmtPct, renderTemplate,
  type NarrativeLine, type Slots,
} from "./render.js";
import { scanText, type GuardViolation } from "./guard.js";
import {
  carrierLabelMap, label, PILLAR_LABEL, ROOT_KIND_LABEL, SCHOOL_LABEL, TONE_LABEL,
} from "./labels.js";
import type {
  ChartSection, CurrentSection, ForceSection, GuardReport, HiddenCell, KinSection,
  LuckSection, MethodSection, PillarCell, Report, StrengthSection, YearCard,
  BodySection, NodesSection, PersonaSection, YearCurvePoint, YearsSection,
} from "./types.js";

export const ENGINE_VERSION = "0.1.0";

export interface ReportOptions {
  readonly locale?: Locale;
  readonly params?: Params;
  /**
   * 报告的对象。`other` 表示用户输入的是他人生辰 ——
   * 此时六亲叙述与神煞语义标签整体略去，只留结构表。
   * 这是**结构性**的约束，不是靠措辞扫描兜底：不生成，就不必扫。
   */
  readonly subject?: "self" | "other";
  /** §7 当前时段的日期。core 无 Date.now()，不传则该节为 null。 */
  readonly now?: { readonly year: number; readonly month: number; readonly day: number };
  /**
   * §6.2 逐年卡片的窗口（含端点）。
   *
   * 默认以 `now` 为中心取前一年至后四年；无 `now` 时自出生年起六年。
   * **默认值放在这里，而不是各调用方各写一份** —— Web 与 CLI 一旦各自
   * 决定窗口，「Skill 与 Web 结论逐字一致」就从构造保证退化成一条需要
   * 时时维护的约定。能由构造保证的事，不要交给约定。
   */
  readonly cardYears?: { readonly from: number; readonly to: number };
  /** §6.1 三线曲线的年数。默认取 params.temporal.yearRangeYears。 */
  readonly curveYears?: number;
  readonly maxFlows?: number;
  readonly engineVersion?: string;
  /**
   * §6.5 统计节点。**默认关闭。**
   *
   * 它要按月跑满六十年（720 次 `evaluateAt` 加一遍应期），约 1.5 秒 ——
   * 比其余全部章节加起来还久。不是每份报告都需要，故显式开启。
   * `subject: other` 时即便开了也不产出：节点的展开层逐条列出神煞与结构事件，
   * 那是对一个人一生时段的描述。
   */
  readonly includeNodes?: boolean;
  /** 节点判据门槛，单位为标准差。默认取 `params.nodes.threshold`（2）。 */
  readonly nodeThreshold?: number;
}

/** 尚待人工决策的条目 —— 它们直接改变上文的判定，故随报告声明。见 docs/11-validation.md §5。 */
const PENDING_CALIBRATION: readonly string[] = Object.freeze([
  "命宫月界（节 / 中气）",
  "十二长生（阳顺阴逆 / 阴阳同生同死）",
  "土的长生（火土同宫 / 水土同宫）",
  "子时规则（晚子换日 / 早子不换 / 折衷）",
  "《穷通宝鉴》120 格调候表（通行本，凭记忆转录，未经实体书逐格核对；31 格标为版本有出入）",
  "藏干变体（申 / 亥）",
  "女命子女星分配",
]);

// ─────────────────────────────────────────────────────────
// 小工具
// ─────────────────────────────────────────────────────────

/** 结构类型的中文标签。叙述文本里不得漏出 StructureKind 的英文键名。 */
const STRUCTURE_LABEL: Readonly<Record<string, string>> = Object.freeze({
  sanhui: "三会", sanhe: "三合", banhe: "半合", gong: "拱局",
  liuhe: "六合", ganhe: "天干五合", chong: "相冲", ganchong: "天干相冲",
  xing: "相刑", hai: "相害", po: "相破", tombOpen: "开库", tombSealed: "闭库",
});

/** base 中「from 克 to」的累计流量。 */
function keOnto(base: BaseChart, to: Element, from: Element): number {
  const elementById = new Map(base.carriers.map((c) => [c.id, c.element]));
  let sum = 0;
  for (const f of base.propagation.flows) {
    if (f.kind !== "ke") continue;
    if (elementById.get(f.to) === to && elementById.get(f.from) === from) sum += f.totalAmount;
  }
  return sum;
}

/** 从推导链里取一个数值。取不到返回 null —— 不编造。 */
function derivedNumber(v: Verdict<unknown>, step: string, key: string): number | null {
  const s = v.derivation.find((d) => d.step === step);
  const raw = s?.values?.[key];
  return typeof raw === "number" ? raw : null;
}

function derivedDetail(v: Verdict<unknown>, step: string): string | null {
  return v.derivation.find((d) => d.step === step)?.detail ?? null;
}

/** 累加器：一节的叙述行。 */
class Lines {
  readonly items: NarrativeLine[] = [];
  constructor(private readonly locale: Locale) {}

  add(id: string, slots: Slots, confidence?: number, ref?: string): void {
    this.items.push(renderTemplate(id, slots, {
      locale: this.locale,
      ...(confidence === undefined ? {} : { confidence }),
      ...(ref === undefined ? {} : { source: { kind: "verdict" as const, ref } }),
    }));
  }
}

// ─────────────────────────────────────────────────────────
// §1 盘面
// ─────────────────────────────────────────────────────────

function pillarCells(
  chart: NatalChart, carriers: readonly Carrier[], shensha: readonly ShenshaHit[],
  params: Params,
): PillarCell[] {
  const dm = carriers.find((c) => c.flags.includes("DAY_MASTER"))!;
  const cso = {
    school: params.conclusion.changshengSchool,
    earth: params.conclusion.earthChangsheng,
  };

  const cells: PillarCell[] = [];
  const source: readonly (readonly [PillarKind, Pillar | null])[] = [
    ["year", chart.year], ["month", chart.month], ["day", chart.day], ["hour", chart.hour],
  ];

  for (const [kind, p] of source) {
    if (p === null) continue;
    const sx = sexagenaryIndexOf(p.stem, p.branch);
    const stemCarrier = carriers.find((c) => c.id === `${kind}.stem`);
    const hiddenCarriers = carriers.filter(
      (c) => c.position.pillar === kind && c.position.layer === "branch");

    const hidden: HiddenCell[] = hiddenCarriers.map((c) => ({
      stem: c.stem,
      role: c.role ?? "本气",
      tenGod: tenGodOf(dm.element, dm.polarity, c.element, c.polarity),
      weight: c.weight,
      siling: c.flags.includes("SILING"),
      revealed: c.flags.includes("REVEALED"),
    }));

    cells.push({
      kind, label: PILLAR_LABEL[kind] ?? kind,
      stemPalace: PALACE[`${kind}.stem`] ?? "外部",
      branchPalace: PALACE[`${kind}.branch`] ?? "外部",
      stem: p.stem, branch: p.branch,
      stemTenGod: kind === "day" ? "日主"
        : tenGodOf(dm.element, dm.polarity, stemCarrier?.element ?? elementOf(p.stem), polarityOf(p.stem)),
      stemWeight: stemCarrier?.weight ?? 0,
      branchWeight: hiddenCarriers.reduce((a, c) => a + c.weight, 0),
      hidden,
      nayin: nayinOf(sx),
      xunKong: xunKongOf(sx),
      changsheng: phaseOf(dm.stem, p.branch, cso),
      shensha: shensha.filter((h) => h.landsOn.pillar === kind).map((h) => h.name),
    });
  }
  return cells;
}

function groupShenshaByPalace(hits: readonly ShenshaHit[]): ChartSection["shenshaByPalace"] {
  const map = new Map<PalaceName, ShenshaHit[]>();
  for (const h of hits) {
    const list = map.get(h.palace);
    if (list === undefined) map.set(h.palace, [h]); else list.push(h);
  }
  return [...map.entries()].map(([palace, hs]) => ({ palace, hits: hs }));
}

// ─────────────────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────────────────

export function buildReport(
  from: BaseChart | NatalChart, options: ReportOptions = {},
): Report {
  // **基础盘算一次。**下文全部时间层视图共用这一份 ——
  // 每张即时盘都持有指回它的引用，同一次报告内是同一个对象。
  const base = toBaseChart(from, options.params);
  const chart = base.chart;
  const params = base.params;
  const locale = options.locale ?? params.report.locale;
  const subject = options.subject ?? "self";
  const engineVersion = options.engineVersion ?? ENGINE_VERSION;
  const maxFlows = options.maxFlows ?? 14;

  const natal = base;
  const C = natal.conclusions;
  const dm = C.dayMaster;
  const carrierLabels = carrierLabelMap(natal.carriers);

  // ── §1 盘面 ──
  const L1 = new Lines(locale);
  if (chart.input.unknownHour === true) L1.add("warn.unknownHour", {});
  if (chart.corrections.resolution !== "unique") {
    L1.add("warn.ambiguousTime", {
      detail: chart.corrections.resolution === "ambiguous"
        ? "夏令时回拨，同一钟表时刻对应两个绝对时刻"
        : "夏令时前拨，该钟表时刻在当地并不存在",
    });
  }
  if (chart.siling.resolution === "unresolvable") {
    L1.add("warn.silingUnresolvable", {
      detail: `司令干 ${chart.siling.stem}，入节第 ${fmtNum(chart.siling.daysIntoJie)} 日`,
    });
  }
  if (subject === "self") {
    // 按宫位分组的清单已在 shenshaByPalace 里，叙述不复述表格 ——
    // 只讲表格讲不出的那一层：哪几个被引动或坐旺，以及凭什么。
    for (const h of natal.shensha) {
      // 只讲真的被修饰过的。缺省态没有信息，且照 tone 渲染会说出
      //「天乙贵人落命宫，状态为坐旺得势：常态」这种自相矛盾的话。
      if (h.toneIsDefault) continue;
      if (h.tone === "strengthened" || h.tone === "activated") {
        L1.add("shensha.tone", {
          name: h.name, palace: h.palace,
          tone: label(TONE_LABEL, h.tone), reason: h.toneReason,
        });
      }
    }
  }

  const chartSection: ChartSection = {
    pillars: pillarCells(chart, natal.carriers, natal.shensha, params),
    taiyuan: chart.taiyuan,
    mingGong: chart.mingGong,
    corrections: chart.corrections,
    siling: chart.siling,
    enclosingJie: chart.enclosingJie,
    shenshaByPalace: groupShenshaByPalace(natal.shensha),
    narrative: L1.items,
  };

  // ── §2 力量结构 ──
  const L2 = new Lines(locale);
  L2.add("metrics.summary", {
    vitality: fmtPct(C.metrics.vitality, 1),
    circulation: fmtPct(C.metrics.circulation, 1),
    evenness: fmtPct(C.metrics.evenness, 1),
  });
  L2.add(C.metrics.circulation >= 0.5 ? "metrics.flowing" : "metrics.contentious", {});
  for (const e of natal.events) {
    const parts = e.pillars.map((p) => PILLAR_LABEL[p] ?? p).join("、");
    if (e.outcome === "transformed" && e.transformedTo !== undefined) {
      L2.add("structure.transformed", { participants: parts, element: e.transformedTo });
    } else if (e.outcome === "bound") {
      L2.add("structure.bound", { participants: parts });
    } else if (e.kind === "chong" && e.outcome === "applied") {
      const worst = Object.entries(e.weightDelta).sort((a, b) => a[1] - b[1])[0];
      L2.add("structure.clash", {
        participants: parts,
        loser: worst === undefined ? parts : (carrierLabels[worst[0]] ?? worst[0]),
      });
    } else if (e.kind === "tombOpen") {
      L2.add("structure.tombOpen", {
        branch: e.branches?.[0] ?? "库",
        released: (e.stems ?? []).join("、") || "中气",
      });
    }
    if (e.strengthScores !== undefined) {
      L2.add("structure.arbitrated", {
        he: STRUCTURE_LABEL[e.kind] ?? e.kind, chong: "相冲",
        heScore: fmtNum(e.strengthScores.he), chongScore: fmtNum(e.strengthScores.chong),
        winner: e.outcome === "neutralized" ? "合解冲" : "冲破合",
      });
    }
  }

  const force: ForceSection = {
    ...(params.report.showConvergenceHistory
      ? { convergence: natal.propagation.convergence }
      : {}),
    byElement: natal.propagation.byElement,
    byPolarity: natal.propagation.byPolarity,
    tenGods: C.tenGods,
    metrics: C.metrics,
    flows: [...natal.propagation.flows]
      .sort((a, b) => b.totalAmount - a.totalAmount).slice(0, maxFlows),
    carrierLabels,
    events: natal.events,
    narrative: L2.items,
  };

  // ── §2.5 性格与偏好 ──
  //
  // subject 为 other 时**整节不生成** —— 这是对一个人的描述，
  // 结构性略去，不靠措辞扫描兜底。
  let personaSection: PersonaSection | null = null;
  if (subject === "self") {
    const P = base.persona;
    const LP = new Lines(locale);
    const traitsOf = (gs: readonly TenGod[], col: "inner" | "outer" | "excess" | "deficient") =>
      [...new Set(gs.flatMap((g) => GOD_TRAITS[g][col]))].join("、");

    LP.add("persona.innerOuter", {
      innerTop: P.dominantInner.value.join("、"),
      innerTraits: traitsOf(P.dominantInner.value, "inner"),
      outerTop: P.dominantOuter.value.join("、"),
      outerTraits: traitsOf(P.dominantOuter.value, "outer"),
    }, Math.min(P.dominantInner.confidence, P.dominantOuter.confidence), "persona.dominant");

    LP.add("persona.tension", {
      tension: fmtNum(P.innerOuterTension, 3),
      divergent: P.divergentGroups
        .map((d) => `${d.group}（${d.delta > 0 ? "外显" : "内蕴"} ${fmtPct(Math.abs(d.delta))}）`)
        .join("、"),
    });
    LP.add("persona.revealRatio", { ratio: fmtPct(P.revealRatio) });
    LP.add("persona.siling", { stem: P.silingStem, god: P.silingGod });

    if (P.excess.length > 0) {
      LP.add("persona.excess", {
        gods: P.excess.join("、"), traits: traitsOf(P.excess, "excess"),
      });
    }
    if (P.absent.length > 0) {
      LP.add("persona.absent", {
        gods: P.absent.join("、"), traits: traitsOf(P.absent, "deficient"),
      });
    }

    const E = P.elements;
    LP.add("persona.elements", {
      strongest: E.strongest,
      virtue: ELEMENT_TRAITS[E.strongest].virtue,
      traits: ELEMENT_TRAITS[E.strongest].strong.join("、"),
      weakest: E.weakest,
      skew: fmtNum(E.skew, 3),
    });
    const attackers = ELEMENTS
      .filter((e) => e !== E.mostAttacked)
      .map((e) => ({ e, v: keOnto(base, E.mostAttacked, e) }))
      .filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 2);
    if (attackers.length > 0) {
      LP.add("persona.mostAttacked", {
        element: E.mostAttacked, attack: fmtNum(E.attack[E.mostAttacked]),
        by: attackers.map((x) => x.e).join("、"),
      });
    }

    for (const pal of P.palaces) {
      const top = (Object.entries(pal.gods) as [TenGod, number][])
        .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2);
      if (top.length === 0 && !pal.isDayMaster) continue;
      LP.add("persona.palace", {
        palace: pal.palace, share: fmtPct(pal.share),
        gods: pal.isDayMaster
          ? `日主${dm.stem}`
          : top.map(([g, v]) => `${g} ${fmtNum(v)}`).join("、"),
        note: pal.afflicted.length === 0 ? ""
          : `；该宫参与${pal.afflicted.map((e) => e.narrativeTag).join("、")}`,
      });
    }
    personaSection = { persona: P, narrative: LP.items };
  }

  // ── §2.6 形体与脏腑对照 ──
  //
  // subject 为 other 时整节不生成 —— 形体与脏腑都是对一个人身体的描述。
  let bodySection: BodySection | null = null;
  const B = subject === "self" ? base.persona.body : null;
  if (B !== null) {
    const LB = new Lines(locale);
    const src = B.wuqiaoSource;

    const strongest = base.persona.elements.strongest;
    LB.add("body.form", {
      element: strongest,
      share: fmtPct(B.details[strongest].share),
      xingti: NEIJING[strongest].xingti,
    });

    LB.add("body.axes", {
      heat: B.axes.heatLabel, heatValue: fmtNum(B.axes.heat, 3),
      dryness: B.axes.drynessLabel, drynessValue: fmtNum(B.axes.dryness, 3),
    });

    // 只讲入选的三个五行 —— 逐一罗列五行等于什么也没说
    for (const e of B.focus) {
      const d = B.details[e];
      const row = NEIJING[e];
      const attackers = ELEMENTS.filter((x) => x !== e)
        .map((x) => ({ x, v: keOnto(base, e, x) }))
        .filter((x) => x.v > 0).sort((a, c) => c.v - a.v).slice(0, 2);
      LB.add("body.organ", {
        element: e,
        state: d.state,
        share: fmtPct(d.share),
        attackNote: d.state.endsWith("受制") || d.state.endsWith("被伐")
          ? `，受${attackers.map((a) => a.x).join("、")}克 ${fmtNum(d.attack)}`
          : "",
        yang: d.yangShare > 0.6 ? "以阳干为主"
          : d.yangShare < 0.4 ? "以阴干为主" : "阴阳干相当",
        heat: B.axes.heatLabel, dryness: B.axes.drynessLabel,
        zang: row.zang, fu: row.fu, qiao: wuqiaoOf(e, src),
        ti: row.ti, zhi: row.zhi, qi: row.qi,
      });
    }
    LB.add("body.yangNote", {});
    bodySection = { body: B, narrative: LB.items };
  }

  // ── §3 旺衰与取用 ──
  const L3 = new Lines(locale);
  const bandTpl: Readonly<Record<string, string>> = {
    VERY_STRONG: "strength.veryStrong", STRONG: "strength.strong",
    BALANCED: "strength.balanced", WEAK: "strength.weak", VERY_WEAK: "strength.veryWeak",
  };
  const margin = derivedNumber(C.strength, "置信", "distance");
  L3.add(bandTpl[C.strength.value]!, {
    dm: dm.stem, monthBranch: chart.month.branch,
    ratio: fmtPct(C.party.ratio), rootScore: fmtNum(C.rootScore),
    margin: margin === null ? "—" : margin.toFixed(4),
  }, C.strength.confidence, "conclusions.strength");

  if (C.rootDetail.length > 0) {
    L3.add("root.rooted", {
      detail: C.rootDetail
        .map((d) => `${d.branch}（${label(ROOT_KIND_LABEL, d.kind)} ${fmtNum(d.contribution)}）`)
        .join("、"),
      rootScore: fmtNum(C.rootScore),
    });
  } else {
    L3.add("root.rootless", { rootScore: fmtNum(C.rootScore) });
  }

  const sp = C.specialPattern;
  if (sp.value === null) {
    L3.add("pattern.none", {}, sp.confidence, "conclusions.specialPattern");
  } else if (sp.value.kind === "congge") {
    L3.add("pattern.congge", {
      subtype: sp.value.subtype, element: sp.value.element,
      ratio: fmtPct(1 - C.party.ratio),
    }, sp.confidence, "conclusions.specialPattern");
  } else if (sp.value.kind === "zhuanwang") {
    const total = ELEMENTS.reduce((a, e) => a + natal.propagation.byElement[e], 0);
    L3.add("pattern.zhuanwang", {
      name: sp.value.name, element: sp.value.element,
      ratio: fmtPct(total > 0 ? natal.propagation.byElement[sp.value.element] / total : 0),
    }, sp.confidence, "conclusions.specialPattern");
  } else {
    L3.add("pattern.huaqi", { element: sp.value.element }, sp.confidence, "conclusions.specialPattern");
  }

  const y = C.yongshen;
  const yv = y.value;
  const yref = "conclusions.yongshen";
  switch (yv.method) {
    case "tiaohou":
      L3.add("yongshen.tiaohou", {
        primary: yv.primary, reason: derivedDetail(y, "调候") ?? "极端气候",
      }, y.confidence, yref);
      break;
    case "tongguan":
      L3.add("yongshen.tongguan", {
        primary: yv.primary,
        sideA: generatedBy(yv.primary), sideB: GENERATES[yv.primary],
      }, y.confidence, yref);
      break;
    case "bingyao": {
      const guarded = yv.secondary ?? yv.primary;
      L3.add("yongshen.bingyao", {
        primary: yv.primary, bing: controlledBy(guarded),
      }, y.confidence, yref);
      break;
    }
    default:
      L3.add("yongshen.fuyi", {
        primary: yv.primary, secondary: yv.secondary ?? yv.xishen[0] ?? yv.primary,
      }, y.confidence, yref);
  }
  L3.add("yongshen.parties", {
    xishen: yv.xishen.join("、"), jishen: yv.jishen.join("、"),
    choushen: yv.choushen.join("、"), xianshen: yv.xianshen.join("、"),
  });
  if (yv.needsLuckSupport) {
    L3.add("yongshen.needsLuckSupport", { primary: yv.primary, strength: fmtNum(yv.strength) });
  }
  if (yv.tiaohouSource === "heuristic" && yv.method === "tiaohou") {
    L3.add("yongshen.heuristicSource", {});
  }

  const g = C.geju;
  L3.add(g.value.isAuspicious ? "geju.auspicious" : "geju.inauspicious", {
    name: g.value.name, god: g.value.god,
    source: {
      benqiRevealed: "本气透干", zhongqiRevealed: "中气透干",
      yuqiRevealed: "余气透干", notRevealed: "不透，取本气",
    }[g.value.source],
    xiangshen: g.value.xiangshen.join("、") || "—",
  }, g.confidence, "conclusions.geju");

  // §3.6 取用与格局取向不一致 —— 必须并列，不得合并
  const gejuElements = new Set(g.value.xiangshen.map(
    (god) => godElementOf(dm.element, god)));
  const tension = gejuElements.size > 0 && !gejuElements.has(yv.primary);
  if (tension) {
    L3.add("geju.tension", {
      yongshen: yv.primary, xiangshen: [...gejuElements].join("、"),
    });
  }

  const strengthSection: StrengthSection = {
    strength: C.strength, rootScore: C.rootScore, rootDetail: C.rootDetail,
    specialPattern: C.specialPattern, yongshen: C.yongshen, geju: C.geju,
    yongshenGejuTension: tension,
    narrative: L3.items,
  };

  // ── §4 宫位与六亲 ──
  const L4 = new Lines(locale);
  const kinOmitted = subject === "other";
  if (!kinOmitted) {
    const tpl: Readonly<Record<KinReading["quadrant"], string>> = {
      "both-favorable": "kin.bothFavorable", "palace-only": "kin.palaceOnly",
      "star-only": "kin.starOnly", neither: "kin.neither",
    };
    for (const k of C.kin) {
      L4.add(tpl[k.quadrant], {
        label: k.label, palaceLabel: k.palaceLabel, starGod: k.starGod,
        starWeight: fmtNum(k.starWeight), palaceWeight: fmtNum(k.palaceWeight),
      }, k.confidence, `conclusions.kin.${k.kin}`);
    }
  }
  const kinSection: KinSection = {
    readings: C.kin, narrativeOmitted: kinOmitted, narrative: L4.items,
  };

  // ── §5 大运 ──
  const L5 = new Lines(locale);
  const steps = luckTimeline(base);
  const birthYear = chart.input.year;
  for (const s of steps) {
    // LuckPillar.index 自 1 起（第一步即月柱的下一柱），此处不再加一。
    const at = (k: string) => s.samples.find((x) => x.at === k)?.favorIndex;
    L5.add("luck.step", {
      index: s.index, pillar: `${s.pillar.stem}${s.pillar.branch}`,
      fromAge: fmtNum(s.startAgeYears), toAge: fmtNum(s.startAgeYears + 10),
      stemPhase: s.stemPhaseSummary, branchPhase: s.branchPhaseSummary,
      start: fmtIndex(at("start") ?? 0), mid: fmtIndex(at("mid") ?? 0),
      end: fmtIndex(at("end") ?? 0),
    });
  }
  if (steps[0] !== undefined) {
    L5.add("luck.crossover", { pillar: `${steps[0].pillar.stem}${steps[0].pillar.branch}` });
  }
  const luckSection: LuckSection = {
    steps, startAgeYears: chart.luck.startAgeYears, direction: chart.luck.direction,
    narrative: L5.items,
  };

  // ── §6 流年 ──
  const L6 = new Lines(locale);
  const curveYears = options.curveYears ?? params.temporal.yearRangeYears;
  const curve: YearCurvePoint[] = [];
  const highTension: { year: number; domain: string; tension: number }[] = [];
  const centre = options.now?.year ?? birthYear;
  const cardFrom = options.cardYears?.from ?? (options.now === undefined ? centre : centre - 1);
  const cardTo = options.cardYears?.to ?? cardFrom + 5;
  const cards: YearCard[] = [];

  /*
   * 曲线与卡片是**两个产品，两个区间**，故各自成环。
   *
   * 原实现把卡片挂在曲线循环里 —— 卡片窗口一旦落在曲线跨度之外
   * （例如 `curveYears: 20` 而 now 在四十年后），§6.2 会**静默变空**：
   * 报告里那一节就没了，也不说为什么。两个区间各自算，就没有这种耦合。
   */
  const seen = new Map<number, YearView>();
  const viewOf = (yr: number): YearView => {
    const hit = seen.get(yr);
    if (hit !== undefined) return hit;
    const v = yearView(base, yr);
    seen.set(yr, v);
    return v;
  };

  for (let yr = birthYear; yr < birthYear + curveYears; yr++) {
    const v = viewOf(yr);
    curve.push({
      year: yr, pillar: v.pillar, luckIndex: v.luckIndex,
      favorIndex: v.favorIndex, vitality: v.vitality, dayMasterShare: v.dayMasterShare,
    });
    for (const d of v.domains) {
      if (d.tension >= 0.6) highTension.push({ year: yr, domain: d.label, tension: d.tension });
    }
  }
  for (let yr = cardFrom; yr <= cardTo; yr++) {
    cards.push({ view: viewOf(yr), narrative: yearLines(viewOf(yr), locale) });
  }
  highTension.sort((a, b) => b.tension - a.tension);
  // §6 章节层只作一次指数释义。高张力年份以**数据**形式给出（highTension），
  // 由前端排序渲染；逐年的支持/反对明细在该年的卡片里，不在这里重复编造槽位。
  L6.add("year.indexMeaning", {});
  const yearsSection: YearsSection = {
    curve, cards, highTension: highTension.slice(0, 20), narrative: L6.items,
  };

  // ── §6.5 统计节点 ──
  //
  // 走曲线层与节点层，与 §6.1 的逐年曲线不是同一套采样：那里是逐年的三条线，
  // 这里是逐月的五十五条。两者不合并 —— 逐年曲线是概览，随报告恒在；
  // 节点要按月跑满六十年，代价高一个量级，故按需开启。
  let nodesSection: NodesSection | null = null;
  if (options.includeNodes === true && subject === "self") {
    const S = buildSeries(base);
    const override = options.nodeThreshold === undefined
      ? undefined : { threshold: options.nodeThreshold };
    const sets = allNodes(S, override);
    const F = buildFindings(S, sets, locale);
    const L65 = new Lines(locale);
    L65.add("node.section", {
      count: String(F.findings.length),
      threshold: (override?.threshold ?? params.nodes.threshold).toFixed(1),
      from: String(S.statsFrom), to: String(S.statsTo),
      maxShown: String(params.nodes.maxShown),
    });
    nodesSection = {
      findings: F.findings,
      guidanceEmptyNote: F.guidanceEmptyNote,
      statsFrom: S.statsFrom, statsTo: S.statsTo,
      threshold: sets.large.threshold,
      narrative: L65.items,
    };
  }

  // ── §7 当前时段 ──
  let current: CurrentSection | null = null;
  if (options.now !== undefined) {
    const { year: ny, month: nm, day: nd } = options.now;
    const jd = toJulianDay({ year: ny, month: nm, day: nd, hour: 12, minute: 0, second: 0 });
    const mb = enclosingTermOf(jd, "节").prev.def.opensMonthBranch as Branch;
    const mi = MONTH_BRANCH_ORDER.indexOf(mb);
    const yv2 = yearView(base, ny);
    const mv = monthView(base, ny, mi);
    const dv = dayView(base, ny, nm, nd);

    const L7 = new Lines(locale);
    L7.add("month.summary", {
      month: `${ny} 年 ${mb}月`,
      pillar: `${mv.pillar.stem}${mv.pillar.branch}`,
      element: mv.tone.monthElement,
      relation: {
        supports: "与本命喜用同气，本月外部条件偏于顺应",
        opposes: "与本命忌仇同气，本月外部条件偏于牵制",
        neutral: "与本命用忌皆不直接相干，本月外部条件平缓",
      }[mv.tone.relationToYongshen],
    });
    L7.add("month.noWeightNote", {});
    if (dv.conflicts.length === 0) {
      L7.add("day.calm", { pillar: `${dv.pillar.stem}${dv.pillar.branch}` });
    } else {
      L7.add("day.conflicts", {
        pillar: `${dv.pillar.stem}${dv.pillar.branch}`,
        detail: dv.conflicts.map((c) => c.detail).join("；"),
      });
    }
    current = { year: yv2, month: mv, day: dv, narrative: L7.items };
  }

  // ── §8 方法与边界 ──
  const L8 = new Lines(locale);
  L8.add("method.schools", {
    ziHour: label(SCHOOL_LABEL, chart.rulesUsed.ziHourRule),
    mingGong: label(SCHOOL_LABEL, chart.rulesUsed.mingGongBoundary),
    changsheng: label(SCHOOL_LABEL, C.schoolsUsed.changshengSchool),
    earth: label(SCHOOL_LABEL, C.schoolsUsed.earthChangsheng),
    tiaohou: label(SCHOOL_LABEL, C.schoolsUsed.tiaohouSource),
    childStar: label(SCHOOL_LABEL, C.schoolsUsed.femaleChildStarVariant),
  });
  const hash = base.paramsHash;
  L8.add("method.provenance", {
    engineVersion, paramsHash: hash, solarProvider: chart.rulesUsed.solarProviderId,
  });
  L8.add("warn.pendingCalibration", { items: PENDING_CALIBRATION.join("；") });

  const method: MethodSection = {
    rulesUsed: chart.rulesUsed, schoolsUsed: C.schoolsUsed,
    paramsHash: hash, engineVersion, pendingCalibration: PENDING_CALIBRATION,
    narrative: L8.items,
  };

  const raw: Report = {
    meta: {
      engineVersion, paramsHash: hash, locale, subject,
      warnings: chart.warnings,
    },
    disclaimerTop: disclaimerText(locale),
    chart: chartSection, force, persona: personaSection, body: bodySection,
    strength: strengthSection, kin: kinSection,
    luck: luckSection, years: yearsSection, nodes: nodesSection, current, method,
    disclaimerBottom: disclaimerText(locale),
    guard: { scanned: 0, violations: [], hedged: [] },
  };

  // 模板文本在 renderWith 里就转过了；这一遍只补非模板来源的裸字符串。
  const report = locale === "zh-Hant" ? mapPlainText(raw, toHant) : raw;
  return { ...report, guard: guardReport(report) };
}

function yearLines(v: YearView, locale: Locale): NarrativeLine[] {
  const L = new Lines(locale);
  const luck = v.luckPillar === null ? "—" : `${v.luckPillar.stem}${v.luckPillar.branch}`;
  const pillar = `${v.pillar.stem}${v.pillar.branch}`;
  if (v.events.length === 0) {
    L.add("year.quiet", { year: v.year, pillar, luck, index: fmtIndex(v.favorIndex) });
  } else {
    L.add("year.summary", {
      year: v.year, pillar, luck, index: fmtIndex(v.favorIndex),
      top: v.events.slice(0, 4).map((e) => e.narrativeTag).join("、"),
    });
  }
  for (const d of v.domains) {
    if (d.tension < 0.6) continue;
    L.add("year.highTension", {
      domain: `${DOMAIN_LABEL[d.domain]}`, tension: fmtNum(d.tension, 2),
      supporting: d.supporting.map((e) => e.narrativeTag).join("、") || "—",
      opposing: d.opposing.map((e) => e.narrativeTag).join("、") || "—",
    });
  }
  return L.items;
}

/**
 * 十神 → 五行。
 * 相神以十神表述，用神以五行表述；§3.6 要比对二者取向，须先换算到同一空间。
 */
function godElementOf(D: Element, god: string): Element {
  switch (god) {
    case "比肩": case "劫财": return D;                  // 同我
    case "食神": case "伤官": return GENERATES[D];       // 我生
    case "正财": case "偏财": return CONTROLS[D];        // 我克
    case "正官": case "七杀": return controlledBy(D);    // 克我
    default:                  return generatedBy(D);     // 生我 —— 正印 / 偏印
  }
}

// ─────────────────────────────────────────────────────────
// §6.4.3 导出前的输出扫描
// ─────────────────────────────────────────────────────────

/**
 * 非模板来源的文本 —— 这些字段直接把数据层的字符串放进树里，不经 `renderWith`，
 * 因而也不会被那里的繁体转换碰到。
 *
 * 它与 `collectReportText` 末尾那一段是**同一份清单**，故两者紧挨着放：
 * 往其中一处添字段而忘了另一处，`hant.spec.ts` 的
 * 「报告树里的每一段文字都已转换」会当场指出是哪个字段。
 */
const PLAIN_TEXT_KEYS: ReadonlySet<string> = new Set([
  "warnings", "stemPhaseSummary", "branchPhaseSummary", "toneReason",
  "note", "detail", "evidence", "narrative", "indication", "narrativeTag",
]);

/** 按键名深度改写树里的裸字符串。只碰字符串叶子，对象与数组照结构走下去。 */
function mapPlainText<T>(v: T, f: (s: string) => string, keyed = false): T {
  if (typeof v === "string") return (keyed ? f(v) : v) as T;
  if (Array.isArray(v)) return v.map((x) => mapPlainText(x, f, keyed)) as T;
  if (v === null || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    out[k] = mapPlainText(val, f, keyed || PLAIN_TEXT_KEYS.has(k));
  }
  return out as T;
}

/** 走遍报告树，把每一条会到达读者的字符串都扫一遍。 */
export function collectReportText(r: Report): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = [];
  const push = (text: string, where: string) => { if (text.length > 0) out.push({ text, where }); };

  push(r.disclaimerTop, "disclaimerTop");
  push(r.disclaimerBottom, "disclaimerBottom");
  for (const w of r.meta.warnings) push(w, "meta.warnings");

  const sections: readonly (readonly [string, { readonly narrative: readonly NarrativeLine[] }])[] = [
    ["chart", r.chart], ["force", r.force], ["strength", r.strength],
    ["kin", r.kin], ["luck", r.luck], ["years", r.years], ["method", r.method],
    ...(r.persona === null ? [] : [["persona", r.persona] as const]),
    ...(r.body === null ? [] : [["body", r.body] as const]),
    ...(r.current === null ? [] : [["current", r.current] as const]),
    ...(r.nodes === null ? [] : [["nodes", r.nodes] as const]),
  ];
  for (const [name, s] of sections) {
    for (const l of s.narrative) push(l.text, `${name}.${l.templateId}`);
  }
  if (r.nodes !== null) {
    // 三层都要扫，**且各自单独扫**：摘要、展开、趋避各是一块可以被单独复制走的文本，
    // 拼起来扫会让展开层尾部的免责声明替摘要把关，而读者只看摘要。
    for (const f of r.nodes.findings) {
      push(f.summary.text, `nodes.${f.id}.summary`);
      for (const l of f.detail.narrative) push(l.text, `nodes.${f.id}.detail.${l.templateId}`);
      for (const g of f.guidance) push(g.line.text, `nodes.${f.id}.guidance.${g.line.templateId}`);
    }
    if (r.nodes.guidanceEmptyNote !== null) {
      push(r.nodes.guidanceEmptyNote.text, "nodes.guidanceEmptyNote");
    }
  }
  for (const c of r.years.cards) {
    for (const l of c.narrative) push(l.text, `years.card.${c.view.year}.${l.templateId}`);
  }
  // 非模板来源的文本 —— 它们同样会显示，同样要扫。
  for (const s of r.luck.steps) {
    push(s.stemPhaseSummary, `luck.step.${s.index}.stemPhase`);
    push(s.branchPhaseSummary, `luck.step.${s.index}.branchPhase`);
  }
  for (const h of r.chart.shenshaByPalace.flatMap((x) => x.hits)) {
    push(h.toneReason, `shensha.${h.name}.toneReason`);
  }
  if (r.current !== null) {
    for (const n of r.current.month.narrative) push(n, "current.month.narrative");
    push(r.current.day.note, "current.day.note");
    for (const c of r.current.day.conflicts) push(c.detail, "current.day.conflict");
    for (const i of r.current.month.interactions) push(i.detail, "current.month.interaction");
  }
  for (const c of r.years.cards) {
    for (const e of c.view.events) push(e.evidence, `years.card.${c.view.year}.evidence`);
  }
  return out;
}

export function guardReport(r: Report): GuardReport {
  const chunks = collectReportText(r);
  const violations: GuardViolation[] = [];
  for (const { text, where } of chunks) violations.push(...scanText(text, where));

  const hedged: string[] = [];
  const sections: readonly { narrative: readonly NarrativeLine[] }[] = [
    r.chart, r.force, r.strength, r.kin, r.luck, r.years, r.method,
    ...(r.persona === null ? [] : [r.persona]),
    ...(r.body === null ? [] : [r.body]),
    ...(r.current === null ? [] : [r.current]),
    ...(r.nodes === null ? [] : [r.nodes]),
  ];
  for (const s of sections) {
    for (const l of s.narrative) if (l.hedged) hedged.push(l.templateId);
  }
  for (const c of r.years.cards) {
    for (const l of c.narrative) if (l.hedged) hedged.push(l.templateId);
  }

  return { scanned: chunks.length, violations, hedged };
}

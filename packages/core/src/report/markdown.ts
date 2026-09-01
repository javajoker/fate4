/**
 * Markdown 导出。
 *
 * 与 Web、Skill 共用同一棵报告树 —— 三处的措辞逐字相同。
 * 若某处的文字与另一处对不上，说明有人在报告层之外又生成了一遍叙述，
 * 那正是 §1 要禁的事。
 *
 * 导出必产 `paramsHash` 与 `engineVersion`：半年后有人拿旧报告来问
 * 「为什么现在算出来不一样」，这两个字段是唯一能回答的依据。
 */

import { DOMAIN_LABEL } from "../yingqi/types.js";
import {
  BAND_LABEL_ZH, label, OUTCOME_LABEL, PILLAR_LABEL, QUADRANT_LABEL,
  SCHOOL_LABEL, SEVERITY_LABEL, TONE_LABEL, YONGSHEN_METHOD_LABEL,
} from "./labels.js";
import type { NarrativeLine } from "./render.js";
import type { Report } from "./types.js";

const nl = (lines: readonly NarrativeLine[]): string =>
  lines.map((l) => (l.hedged ? `- ${l.text}　_(低置信度，已改用留有余地的措辞)_` : `- ${l.text}`)).join("\n");

const pillarOf = (p: { stem: string; branch: string } | null): string =>
  p === null ? "—" : `${p.stem}${p.branch}`;



export function renderMarkdown(r: Report): string {
  const out: string[] = [];
  const h = (level: number, text: string) => out.push(`${"#".repeat(level)} ${text}\n`);
  const p = (text: string) => out.push(`${text}\n`);

  h(1, "四柱推演报告");
  p(`> ${r.disclaimerTop}`);

  if (r.meta.warnings.length > 0) {
    h(2, "提示");
    for (const w of r.meta.warnings) p(`- ${w}`);
  }

  // ── §1 ──
  h(2, "§1 盘面");
  out.push("| 柱 | 宫 | 天干 | 十神 | 地支 | 宫 | 藏干（十神 · 权重） | 纳音 | 空亡 | 长生 |");
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const c of r.chart.pillars) {
    const hidden = c.hidden
      .map((x) => `${x.stem}${x.siling ? "(司令)" : ""} ${x.tenGod} ${x.weight.toFixed(1)}`)
      .join("<br>");
    out.push(`| ${c.label} | ${c.stemPalace} | ${c.stem} | ${c.stemTenGod} | ${c.branch} | `
      + `${c.branchPalace} | ${hidden} | ${c.nayin} | ${c.xunKong.join("")} | ${c.changsheng} |`);
  }
  out.push("");
  p(`胎元 ${pillarOf(r.chart.taiyuan)}　命宫 ${pillarOf(r.chart.mingGong)}`);
  const co = r.chart.corrections;
  p(`时间校正：时区 ${co.tzOffsetMinutes} 分`
    + `${co.isDaylightSaving ? "（含夏令时）" : ""}`
    + `　经度 ${co.longitudeMinutes.toFixed(1)} 分`
    + `　均时差 ${co.equationOfTimeMinutes.toFixed(1)} 分`
    + `　合计相对民用钟表 ${co.netVsCivilMinutes.toFixed(1)} 分`);
  p(`节气区间：${r.chart.enclosingJie.prevName} → ${r.chart.enclosingJie.nextName}`);
  const silingNote = { exact: "藏干中确有该干", sameElement: "落到同五行藏干",
    unresolvable: "月支藏干中无落点" }[r.chart.siling.resolution];
  p(`司令：${r.chart.siling.stem}（第 ${r.chart.siling.segment + 1} 段，入节 ${r.chart.siling.daysIntoJie.toFixed(2)} 日，${silingNote}）`);
  if (r.chart.shenshaByPalace.length > 0) {
    h(3, "神煞（按宫位）");
    for (const g of r.chart.shenshaByPalace) {
      p(`- **${g.palace}**：${g.hits.map((x) => `${x.name}（${label(TONE_LABEL, x.tone)}）`).join("、")}`);
    }
  }
  if (r.chart.narrative.length > 0) { h(3, "说明"); p(nl(r.chart.narrative)); }

  // ── §2 ──
  h(2, "§2 力量结构");
  out.push("| 五行 | 权重 |");
  out.push("| --- | --- |");
  for (const [e, w] of Object.entries(r.force.byElement)) out.push(`| ${e} | ${w.toFixed(1)} |`);
  out.push("");
  out.push("| 十神 | 权重 |");
  out.push("| --- | --- |");
  for (const [g, w] of Object.entries(r.force.tenGods)) {
    if (w > 0) out.push(`| ${g} | ${w.toFixed(1)} |`);
  }
  out.push("");
  h(3, "五行流通（前 " + String(r.force.flows.length) + " 条）");
  out.push("| 自 | 至 | 关系 | 流量 |");
  out.push("| --- | --- | --- | --- |");
  for (const f of r.force.flows) {
    const from = r.force.carrierLabels[f.from] ?? f.from;
    const to = r.force.carrierLabels[f.to] ?? f.to;
    out.push(`| ${from} | ${to} | ${f.kind === "sheng" ? "生" : "克"} | ${f.totalAmount.toFixed(2)} |`);
  }
  out.push("");
  if (r.force.events.length > 0) {
    h(3, "结构事件");
    out.push("| 类型 | 结局 | 涉柱 | 距离系数 |");
    out.push("| --- | --- | --- | --- |");
    for (const e of r.force.events) {
      out.push(`| ${e.narrativeTag} | ${label(OUTCOME_LABEL, e.outcome)} | `
        + `${e.pillars.map((x) => label(PILLAR_LABEL, x)).join("、")} | ${e.distanceCoef.toFixed(2)} |`);
    }
    out.push("");
  }
  p(nl(r.force.narrative));

  // ── §3 ──
  h(2, "§3 旺衰与取用");
  p(nl(r.strength.narrative));
  if (r.strength.strength.alternatives.length > 0) {
    h(3, "替代判定");
    for (const a of r.strength.strength.alternatives) {
      p(`- ${label(BAND_LABEL_ZH, a.value)}：${a.reason}`);
    }
  }
  if (r.strength.yongshen.alternatives.length > 0) {
    h(3, "取用的替代解读");
    for (const a of r.strength.yongshen.alternatives) {
      p(`- 取 ${a.value.primary}（${label(YONGSHEN_METHOD_LABEL, a.value.method)}）：${a.reason}`);
    }
  }
  h(3, "推导链");
  for (const d of r.strength.strength.derivation) p(`1. **${d.step}** — ${d.detail}`);
  for (const d of r.strength.yongshen.derivation) p(`1. **${d.step}** — ${d.detail}`);

  // ── §4 ──
  h(2, "§4 宫位与六亲");
  if (r.kin.narrativeOmitted) {
    p("_报告对象为他人，六亲叙述整体略去，仅保留结构表。_");
  }
  out.push("| 六亲 | 宫 | 宫权重 | 星 | 星权重 | 象限 | 置信度 |");
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const k of r.kin.readings) {
    out.push(`| ${k.label} | ${k.palaceLabel} | ${k.palaceWeight.toFixed(1)} | ${k.starGod} | `
      + `${k.starWeight.toFixed(1)} | ${label(QUADRANT_LABEL, k.quadrant)} | ${k.confidence.toFixed(2)} |`);
  }
  out.push("");
  if (r.kin.narrative.length > 0) p(nl(r.kin.narrative));

  // ── §5 ──
  h(2, "§5 大运");
  p(`起运 ${r.luck.startAgeYears.toFixed(2)} 岁，${r.luck.direction === "forward" ? "顺行" : "逆行"}。`);
  out.push("| 步 | 干支 | 起岁 | 起 | 中 | 末 |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  for (const s of r.luck.steps) {
    const at = (k: string) => s.samples.find((x) => x.at === k);
    out.push(`| ${s.index} | ${s.pillar.stem}${s.pillar.branch} | ${s.startAgeYears.toFixed(1)} | `
      + `${at("start")?.favorIndex.toFixed(1) ?? "—"} | ${at("mid")?.favorIndex.toFixed(1) ?? "—"} | `
      + `${at("end")?.favorIndex.toFixed(1) ?? "—"} |`);
  }
  out.push("");
  p(nl(r.luck.narrative));

  // ── §6 ──
  h(2, "§6 流年");
  p(nl(r.years.narrative));
  if (r.years.highTension.length > 0) {
    h(3, "高张力年份（张力降序）");
    out.push("| 年 | 域 | 张力 |");
    out.push("| --- | --- | --- |");
    for (const t of r.years.highTension) {
      out.push(`| ${t.year} | ${t.domain} | ${t.tension.toFixed(2)} |`);
    }
    out.push("");
  }
  for (const c of r.years.cards) {
    h(3, `${c.view.year} ${c.view.pillar.stem}${c.view.pillar.branch}`);
    p(nl(c.narrative));
    if (c.view.events.length > 0) {
      out.push("| 应期规则 | 极性 | 域 | 依据 |");
      out.push("| --- | --- | --- | --- |");
      for (const e of c.view.events) {
        out.push(`| ${e.name} | ${e.polarity > 0 ? "＋" : e.polarity < 0 ? "－" : "○"} | `
          + `${e.domains.map((d) => DOMAIN_LABEL[d]).join("、")} | ${e.evidence} |`);
      }
      out.push("");
    }
  }

  // ── §7 ──
  if (r.current !== null) {
    h(2, "§7 当前时段");
    p(nl(r.current.narrative));
    if (r.current.month.shensha.length > 0) {
      p(`本月神煞：${r.current.month.shensha.map((x) => x.name).join("、")}`);
    }
    if (r.current.day.conflicts.length > 0) {
      out.push("| 冲突 | 程度 | 涉及五行 | 所在宫 |");
      out.push("| --- | --- | --- | --- |");
      for (const cf of r.current.day.conflicts) {
        out.push(`| ${cf.detail} | ${label(SEVERITY_LABEL, cf.severity)} | `
          + `${cf.involvedElements.join(" / ")} | ${cf.affectedPalace ?? "—"} |`);
      }
      out.push("");
    }
  }

  // ── §8 ──
  h(2, "§8 方法与边界");
  // 出处一行在下方以结构化形式给出（标识符裹进代码跨度），此处不重复。
  // 出处与待校准清单均在下方以结构化形式给出，此处不重复。
  p(nl(r.method.narrative.filter(
    (l) => l.templateId !== "method.provenance" && l.templateId !== "warn.pendingCalibration")));
  h(3, "待校准 —— 其取值直接影响上文判定");
  for (const i of r.method.pendingCalibration) out.push(`- ${i}`);
  out.push("");
  h(3, "所用流派");
  out.push("| 项 | 取值 |");
  out.push("| --- | --- |");
  out.push(`| 日界 | ${label(SCHOOL_LABEL, r.method.rulesUsed.ziHourRule)} |`);
  out.push(`| 命宫月界 | ${label(SCHOOL_LABEL, r.method.rulesUsed.mingGongBoundary)} |`);
  out.push(`| 起运换算 | ${label(SCHOOL_LABEL, r.method.rulesUsed.qiyunMode)} |`);
  out.push(`| 十二长生 | ${label(SCHOOL_LABEL, r.method.schoolsUsed.changshengSchool)} |`);
  out.push(`| 土的长生 | ${label(SCHOOL_LABEL, r.method.schoolsUsed.earthChangsheng)} |`);
  out.push(`| 调候来源 | ${label(SCHOOL_LABEL, r.method.schoolsUsed.tiaohouSource)} |`);
  out.push(`| 女命子女星 | ${label(SCHOOL_LABEL, r.method.schoolsUsed.femaleChildStarVariant)} |`);
  out.push("");
  p(`引擎 ${r.method.engineVersion}　参数快照 \`${r.method.paramsHash}\`　`
    + `太阳黄经 \`${r.method.rulesUsed.solarProviderId}\``);
  p(`措辞扫描：扫过 ${r.guard.scanned} 段，命中 ${r.guard.violations.length} 处，`
    + `因置信度不足降级 ${r.guard.hedged.length} 条。`);

  p(`> ${r.disclaimerBottom}`);
  return out.join("\n");
}

/**
 * 人读文本。
 *
 * 只做排版，不生成结论 —— 每一句叙述都取自 core 的模板输出或视图对象，
 * 与 Web 和 Markdown 导出同源。CLI 自己写一句命理判断，就等于开了第二个
 * 叙述来源，「Skill 与 Web 逐字一致」当场作废。
 *
 * 枚举一律经 core 的标签表转中文；本文件的输出同样跑措辞扫描（见 test/cli.spec.ts）。
 */

import {
  BAND_LABEL_ZH, DOMAIN_LABEL, label, OUTCOME_LABEL, PILLAR_LABEL,
  QUADRANT_LABEL, SEVERITY_LABEL, TONE_LABEL, YONGSHEN_METHOD_LABEL,
  fromJulianDay,
  type DayView, type MonthView, type NarrativeLine, type Report,
  type LuckStep, type YearView,
} from "@fate/core";

const pad = (s: string, n: number): string => {
  // 中日韩字符按两个西文宽度计
  let w = 0;
  for (const ch of s) w += /[⺀-鿿＀-｠]/.test(ch) ? 2 : 1;
  return s + " ".repeat(Math.max(0, n - w));
};

const pillar = (p: { stem: string; branch: string } | null): string =>
  p === null ? "—" : `${p.stem}${p.branch}`;

const bullets = (lines: readonly NarrativeLine[]): string[] =>
  lines.map((l) => (l.hedged ? `  · ${l.text}  〔低置信度，已改用留有余地的措辞〕` : `  · ${l.text}`));

const rule = (title: string): string => `\n── ${title} ${"─".repeat(Math.max(0, 56 - title.length * 2))}`;

export function renderChart(r: Report): string {
  const o: string[] = [];
  o.push(rule("盘面"));
  o.push("  " + ["柱", "干", "十神", "支", "藏干", "长生", "纳音", "空亡"]
    .map((h, i) => pad(h, [8, 4, 8, 4, 30, 6, 10, 6][i]!)).join(""));
  for (const c of r.chart.pillars) {
    const hidden = c.hidden.map((h) => `${h.stem}${h.siling ? "*" : ""}${h.tenGod}${h.weight.toFixed(0)}`).join(" ");
    o.push("  " + [
      pad(c.label, 8), pad(c.stem, 4), pad(String(c.stemTenGod), 8),
      pad(c.branch, 4), pad(hidden, 30), pad(c.changsheng, 6),
      pad(c.nayin, 10), pad(c.xunKong.join(""), 6),
    ].join(""));
  }
  o.push(`  胎元 ${pillar(r.chart.taiyuan)}　命宫 ${pillar(r.chart.mingGong)}　（* 表司令）`);

  const co = r.chart.corrections;
  o.push(rule("时间校正"));
  o.push(`  时区 ${co.tzOffsetMinutes} 分${co.isDaylightSaving ? "（行用夏令时）" : ""}`
    + `　经度 ${co.longitudeMinutes.toFixed(1)} 分　均时差 ${co.equationOfTimeMinutes.toFixed(1)} 分`);
  o.push(`  相对民用钟表合计 ${co.netVsCivilMinutes.toFixed(1)} 分`);
  o.push(`  节气区间 ${r.chart.enclosingJie.prevName} → ${r.chart.enclosingJie.nextName}`
    + `　司令 ${r.chart.siling.stem}（第 ${r.chart.siling.segment + 1} 段，入节 ${r.chart.siling.daysIntoJie.toFixed(2)} 日）`);

  if (r.chart.shenshaByPalace.length > 0) {
    o.push(rule("神煞（按宫位）"));
    for (const g of r.chart.shenshaByPalace) {
      o.push(`  ${pad(g.palace, 14)}${g.hits.map((h) =>
        `${h.name}${h.toneIsDefault ? "" : `(${label(TONE_LABEL, h.tone)})`}`).join(" ")}`);
    }
  }

  o.push(rule("力量结构"));
  o.push("  " + Object.entries(r.force.byElement).map(([e, w]) => `${e} ${w.toFixed(1)}`).join("　"));
  o.push(`  单轮留存 ${(r.force.metrics.vitality * 100).toFixed(1)}%`
    + `　流通度 ${(r.force.metrics.circulation * 100).toFixed(1)}%`
    + `　五行匀度 ${(r.force.metrics.evenness * 100).toFixed(1)}%`);
  for (const e of r.force.events) {
    o.push(`  ${pad(e.narrativeTag, 12)}${pad(label(OUTCOME_LABEL, e.outcome), 18)}`
      + e.pillars.map((p) => label(PILLAR_LABEL, p)).join("、"));
  }

  o.push(rule("旺衰与取用"));
  const S = r.strength;
  o.push(`  日主旺衰 ${label(BAND_LABEL_ZH, S.strength.value)}（置信度 ${S.strength.confidence.toFixed(2)}）`);
  o.push(`  用神 ${S.yongshen.value.primary}　法从${label(YONGSHEN_METHOD_LABEL, S.yongshen.value.method)}`
    + `（置信度 ${S.yongshen.confidence.toFixed(2)}）`);
  o.push(`  喜 ${S.yongshen.value.xishen.join("")}　忌 ${S.yongshen.value.jishen.join("")}`
    + `　仇 ${S.yongshen.value.choushen.join("")}　闲 ${S.yongshen.value.xianshen.join("")}`);
  o.push(`  月令格局 ${S.geju.value.name}（${S.geju.value.usage}，置信度 ${S.geju.confidence.toFixed(2)}）`);
  o.push(...bullets(S.narrative));

  o.push(rule("宫位六亲"));
  for (const k of r.kin.readings) {
    o.push(`  ${pad(k.label, 10)}${pad(k.palaceLabel, 20)}${pad(k.starGod, 6)}`
      + `${pad(label(QUADRANT_LABEL, k.quadrant), 20)}置信度 ${k.confidence.toFixed(2)}`);
  }
  return o.join("\n");
}

export function renderLuck(steps: readonly LuckStep[], startAge: number, dir: string): string {
  const o: string[] = [rule("大运")];
  o.push(`  起运 ${startAge.toFixed(2)} 岁，${dir === "forward" ? "顺行" : "逆行"}`);
  o.push("  " + ["步", "干支", "起岁", "起", "中", "末", "起·旺衰", "末·旺衰"]
    .map((h, i) => pad(h, [5, 7, 7, 7, 7, 7, 12, 12][i]!)).join(""));
  for (const s of steps) {
    const at = (k: string) => s.samples.find((x) => x.at === k);
    o.push("  " + [
      pad(String(s.index), 5), pad(pillar(s.pillar), 7), pad(s.startAgeYears.toFixed(1), 7),
      pad((at("start")?.favorIndex ?? 0).toFixed(1), 7),
      pad((at("mid")?.favorIndex ?? 0).toFixed(1), 7),
      pad((at("end")?.favorIndex ?? 0).toFixed(1), 7),
      pad(label(BAND_LABEL_ZH, at("start")?.strength ?? ""), 12),
      pad(label(BAND_LABEL_ZH, at("end")?.strength ?? ""), 12),
    ].join(""));
  }
  o.push("  一步之内天干占比自 0.70 线性降至 0.30，地支反向递增，恰在第 5 年末交叉。");
  o.push("  取样设在起、中、末三处正为呈现这一变化 —— 只取一点会把它整个抹掉。");
  return o.join("\n");
}

export function renderYear(v: YearView, narrative: readonly NarrativeLine[]): string {
  const o: string[] = [rule(`${v.year} 年`)];
  o.push(`  年柱 ${pillar(v.pillar)}　行运 ${pillar(v.luckPillar)}`);
  o.push(`  顺逆指数 ${v.favorIndex.toFixed(1)}`
    + `（结构项 ${v.indexParts.base.toFixed(3)}　事件项 ${v.indexParts.eventDelta.toFixed(2)}）`);
  o.push(`  单轮留存 ${(v.vitality * 100).toFixed(1)}%　日主党势 ${(v.dayMasterShare * 100).toFixed(1)}%`);
  o.push("  顺逆指数衡量的是当年五行结构与本命喜用的契合度，不是运气好坏。");
  if (v.segments.length > 1) o.push("  本年内换运，分段呈现，不作加权平均。");

  if (v.events.length > 0) {
    o.push("\n  应期");
    for (const e of v.events) {
      const mark = e.polarity > 0 ? "＋" : e.polarity < 0 ? "－" : "○";
      o.push(`    ${mark} ${pad(e.name, 16)}${pad(e.domains.map((d) => DOMAIN_LABEL[d]).join("、"), 24)}${e.evidence}`);
    }
    o.push("  极性三档，中性是刻意保留的一档：动是好是坏取决于用忌。");
  }

  const tense = v.domains.filter((d) => d.tension >= 0.6);
  if (tense.length > 0) {
    o.push("\n  高张力域（同域内极性相反者并存，不相抵消）");
    for (const d of tense) {
      o.push(`    ${pad(d.label, 10)}张力 ${d.tension.toFixed(2)}　净值 ${d.net.toFixed(2)}`);
      o.push(`      顺向 ${d.supporting.map((e) => e.narrativeTag).join("、") || "—"}`);
      o.push(`      逆向 ${d.opposing.map((e) => e.narrativeTag).join("、") || "—"}`);
    }
  }
  o.push(...bullets(narrative));
  return o.join("\n");
}

const ymd = (jd: number): string => {
  const c = fromJulianDay(jd);
  return `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
};

export function renderMonth(v: MonthView): string {
  const o: string[] = [rule(`${v.year} 年 ${v.pillar.branch}月`)];
  o.push(`  月柱 ${pillar(v.pillar)}　自${v.openedBy}起　年柱 ${pillar(v.yearPillar)}　行运 ${pillar(v.luckPillar)}`);
  // 节气月与公历月并不重合，故把实际起讫写出来 —— 省得读者自己去猜边界。
  o.push(`  实际起讫 ${ymd(v.range.fromJd)} → ${ymd(v.range.toJd)}`);
  for (const n of v.narrative) o.push(`  ${n}`);
  if (v.shensha.length > 0) {
    o.push("\n  神煞");
    for (const h of v.shensha) {
      o.push(`    ${pad(h.name, 12)}${pad(h.palace, 12)}`
        + `${h.toneIsDefault ? "常态" : `${label(TONE_LABEL, h.tone)}　${h.toneReason}`}`);
    }
  }
  o.push("\n  流月只作引动，不参与权重计算。");
  return o.join("\n");
}

export function renderDay(v: DayView): string {
  const o: string[] = [rule(
    `${v.date.year}-${String(v.date.month).padStart(2, "0")}-${String(v.date.day).padStart(2, "0")}`)];
  o.push(`  日柱 ${pillar(v.pillar)}　月柱 ${pillar(v.monthPillar)}　年柱 ${pillar(v.yearPillar)}`);
  o.push(`  ${v.note}`);
  for (const c of v.conflicts) {
    o.push(`    ${pad(label(SEVERITY_LABEL, c.severity), 6)}${pad(c.detail, 34)}`
      + `${c.involvedElements.join("/")}　${c.affectedPalace ?? "—"}`);
  }
  for (const h of v.harmonies) o.push(`    ${h}`);
  if (v.shensha.length > 0) {
    o.push(`  神煞 ${v.shensha.map((h) => h.name).join("、")}`);
  }
  o.push("  日层只分轻微与明显两档 —— 日层的分辨率本就不支持更细的判断。此处不出宜忌。");
  return o.join("\n");
}

/**
 * 问事与当日运程的 Markdown 导出。
 *
 * 放在 core 而非 CLI —— 与四柱报告同一条理由：Web 与命令行共用同一个函数，
 * 「两处结论逐字一致」才是**构造保证**而不是需要维护的约定。
 * 一旦让 CLI 自己拼一份 Markdown，两条路径就诞生了。
 */

import { toHant } from "../report/hant.js";
import type { QuestionReport } from "./report.js";
import type { DailyOutlook } from "./daily.js";
import { dailyNarrative } from "./daily.js";
import type { NarrativeLine } from "../report/render.js";
import type { Locale } from "../report/templates.js";
import { monthLabel } from "./yingqi.js";

const nl = (lines: readonly NarrativeLine[]): string =>
  lines.map((l) => (l.hedged
    ? `- ${l.text}　_(低置信度，已改用留有余地的措辞)_`
    : `- ${l.text}`)).join("\n");

export function renderQuestionMarkdown(r: QuestionReport): string {
  const out: string[] = [];
  const h = (n: number, t: string) => out.push(`${"#".repeat(n)} ${t}\n`);
  const p = (t: string) => out.push(`${t}\n`);
  // 表格行直接 push —— p() 会多带一个换行，join 之后行间就空出一行，表就散了。
  // 与 report/markdown.ts 的做法一致。
  const row = (t: string) => out.push(t);

  h(1, "六爻问事");
  p(`> ${r.disclaimerTop}`);

  h(2, "§1 起卦");
  p(nl(r.casting.narrative));

  h(2, "§2 卦象");
  // 六爻自上而下书写 —— 上爻在最前，与卦画的视觉次序一致
  row("| 爻 | 六神 | 六亲 | 干支 | 世应 | 动静 | 月建 | 空破 | 变爻 |");
  row("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const y of [...r.gua.yaos].reverse()) {
    const mark = y.isShi ? "世" : y.isYing ? "应" : "";
    const dong = y.moving ? "○ 动" : y.chongState === "暗动" ? "暗动" : "";
    const kb = [
      y.xunkong ? `空${y.xunkongNullified === null ? "" : `(${y.xunkongNullified})`}` : "",
      y.yuepo ? `破${y.yuepoNullified === null ? "" : `(${y.yuepoNullified})`}` : "",
    ].filter((x) => x !== "").join(" ");
    const bian = y.bian === null ? ""
      : `${y.bian.liuqin}${y.bian.stem}${y.bian.branch} ${y.bian.shengke}`
        + (y.bian.flags.length > 0 ? ` ${y.bian.flags.join(" ")}` : "");
    row(`| ${y.pos} | ${y.liushen} | ${y.liuqin} | ${y.stem}${y.branch} | ${mark} `
      + `| ${dong} | ${y.monthPhase} | ${kb} | ${bian} |`);
  }
  out.push("");
  if (r.gua.fushen.length > 0) {
    p("伏神：" + r.gua.fushen.map(
      (f) => `${f.liuqin}${f.stem}${f.branch}（伏于第 ${f.pos} 爻 ${f.feiLiuqin}${f.feiBranch} 之下）`)
      .join("、"));
  }

  h(2, "§3 占事与用神");
  p(nl(r.topic.narrative));

  h(2, "§4 断论");
  p(nl(r.judgement.narrative));

  h(2, "§5 应期");
  p(nl(r.yingqi.narrative));
  if (r.yingqi.result.windows.length > 0) {
    row("| 时段 | 距今 | 取候之由 |");
    row("| --- | --- | --- |");
    for (const w of r.yingqi.result.windows) {
      row(`| ${monthLabel(w)} | ${w.monthsAhead} 个月 | ${w.reasons.join("；")} |`);
    }
    out.push("");
  }

  h(2, "§6 方法");
  row("| 项 | 值 |");
  row("| --- | --- |");
  row(`| 起卦法 | ${r.meta.castMethod} |`);
  row(`| 引擎版本 | ${r.meta.engineVersion} |`);
  row(`| 参数指纹 | ${r.meta.paramsHash} |`);
  if (r.meta.questionFingerprint !== null) {
    row(`| 问题指纹 | ${r.meta.questionFingerprint} |`);
  }
  out.push("");
  p(`> ${r.disclaimerBottom}`);

  const md = out.join("\n");
  return r.meta.locale === "zh-Hant" ? toHant(md) : md;
}

export function renderDailyMarkdown(o: DailyOutlook, locale: Locale = "zh-Hans"): string {
  const out: string[] = [];
  const h = (n: number, t: string) => out.push(`${"#".repeat(n)} ${t}\n`);
  const p = (t: string) => out.push(`${t}\n`);
  const row = (t: string) => out.push(t);

  h(1, "当日运程");
  p(nl(dailyNarrative(o, locale)));

  h(2, "四柱侧");
  p(`流日 ${o.bazi.pillar.stem}${o.bazi.pillar.branch}　`
    + `月 ${o.bazi.monthPillar.stem}${o.bazi.monthPillar.branch}　`
    + `年 ${o.bazi.yearPillar.stem}${o.bazi.yearPillar.branch}`);
  p(o.bazi.note);
  if (o.bazi.conflicts.length > 0) {
    row("| 类型 | 程度 | 五行 | 涉宫 | 说明 |");
    row("| --- | --- | --- | --- | --- |");
    for (const c of o.bazi.conflicts) {
      row(`| ${c.kind} | ${c.severity === "notable" ? "显著" : "轻微"} `
        + `| ${c.involvedElements.join("、")} | ${c.affectedPalace ?? "—"} | ${c.detail} |`);
    }
    out.push("");
  }

  h(2, "六爻侧");
  const g = o.liuyao.gua;
  p(`${g.ben.name}（${g.ben.palace}宫${g.ben.rank}）`
    + `${g.bian === null ? "，六爻皆静" : ` → ${g.bian.name}`}`
    + `${g.flags.length > 0 ? `　${g.flags.join("、")}` : ""}`);
  row("| 爻 | 六亲 | 干支 | 世应 | 动静 |");
  row("| --- | --- | --- | --- | --- |");
  for (const y of [...g.yaos].reverse()) {
    row(`| ${y.pos} | ${y.liuqin} | ${y.stem}${y.branch} `
      + `| ${y.isShi ? "世" : y.isYing ? "应" : ""} `
      + `| ${y.moving ? "○ 动" : y.chongState === "暗动" ? "暗动" : ""} |`);
  }
  out.push("");

  const md = out.join("\n");
  return locale === "zh-Hant" ? toHant(md) : md;
}

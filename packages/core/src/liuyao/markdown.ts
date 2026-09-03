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
import { relayerYaoci } from "./yaoci.js";
import type { NarrativeLine } from "../report/render.js";
import type { Locale } from "../report/templates.js";
import { monthLabel } from "./yingqi.js";
import type { CrossReading } from "../divination/reading.js";
import { AXIS_DIRECTIONAL, SYSTEM_LABEL } from "../divination/claim.js";

const nl = (lines: readonly NarrativeLine[]): string =>
  lines.map((l) => (l.hedged
    ? `- ${l.text}　_(低置信度，已改用留有余地的措辞)_`
    : `- ${l.text}`)).join("\n");

/**
 * 引文的占位符。
 *
 * 本函数末尾把整份 Markdown 过一遍 `toHant` —— 那是给函数里硬写的简体标题、
 * 表头兜底的。而爻辞引文**已经是目标语言的原文**，不能再转一次：
 * 转了也许无害，但那是运气，不是保证。故先换成占位符，转完再换回来。
 *
 * 占位符取非汉字符号，`toHant` 原样放行。
 */
const QUOTE_SLOT = (i: number) => `⟦q${i}⟧`;
const QUOTE_SLOT_RE = /⟦q(\d+)⟧/g;

export function renderQuestionMarkdown(r: QuestionReport): string {
  const out: string[] = [];
  const quotes: string[] = [];
  /** 存起来，返回占位符。 */
  const keep = (s: string): string => `${QUOTE_SLOT(quotes.push(s) - 1)}`;
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

  h(2, "§6 指事");
  p(nl(r.yaoci.narrative));
  {
    const y = r.yaoci.reading;
    const q = (x: { text: string | null; withheld: readonly string[] } | null): string =>
      x === null ? "" : x.text === null
        ? `_（未通过措辞检查：${x.withheld.join("、")}）_`
        : keep(x.text);
    p(`本卦 **${y.gua.ben.name}**：${q(y.gua.ben.classic)}`
      + (y.gua.bian === null ? "" : `　→　变卦 **${y.gua.bian.name}**：${q(y.gua.bian.classic)}`));
    row("| 爻 | 位 | 爻辞 | 指事 |");
    row("| --- | --- | --- | --- |");
    for (const pk of y.picks) {
      const tag = pk.role + (pk.isYongshen ? "・用神位" : "");
      row(`| ${pk.pos} | ${tag} | ${q(pk.ben.classic)} | ${q(pk.ben.gist)} |`);
      if (pk.bian !== null) {
        row(`| ${pk.pos} | 变出 | ${q(pk.bian.classic)} | ${q(pk.bian.gist)} |`);
      }
    }
    out.push("");
  }

  h(2, "§7 方法");
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
  const conv = r.meta.locale === "zh-Hant" ? toHant(md) : md;
  return conv.replace(QUOTE_SLOT_RE, (_m, i: string) => quotes[Number(i)] ?? "");
}

export function renderDailyMarkdown(o: DailyOutlook, locale: Locale = "zh-Hans"): string {
  const out: string[] = [];
  const quotes: string[] = [];
  const keep = (s: string): string => `${QUOTE_SLOT(quotes.push(s) - 1)}`;
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

  h(2, "指事");
  {
    // ⚠️ 引文按**渲染时**要的语言重取，不能直接用 `o.liuyao.yaoci`。
    //
    // `DailyOutlook` 是数据，它里面那份读法建于 `params.report.locale`；
    // 而本函数的 `locale` 是调用方当场指定的（`fate daily --locale zh-Hant`）。
    // 两者不一致时，下面的占位符会忠实地保护住**简体**引文，让它原样穿过
    // 繁体转换 —— 于是繁体文档里嵌着简体爻辞。实测逮到，故在此对齐。
    const y = o.liuyao.yaoci.locale === locale
      ? o.liuyao.yaoci
      : relayerYaoci(o.liuyao.yaoci, o.liuyao.yaoci.layer, locale);
    const q = (x: { text: string | null; withheld: readonly string[] } | null): string =>
      x === null ? "" : x.text === null
        ? `_（未通过措辞检查：${x.withheld.join("、")}）_`
        : keep(x.text);
    p("以下是爻辞一路的说法 —— 引文，与上面的纳甲断法各说各的，不互相印证。");
    p(`${y.gua.ben.name}：${q(y.gua.ben.classic)}`
      + (y.gua.bian === null ? "" : `　→　${y.gua.bian.name}：${q(y.gua.bian.classic)}`));
    row("| 爻 | 位 | 爻辞 | 指事 |");
    row("| --- | --- | --- | --- |");
    for (const pk of y.picks) {
      row(`| ${pk.pos} | ${pk.role} | ${q(pk.ben.classic)} | ${q(pk.ben.gist)} |`);
      if (pk.bian !== null) {
        row(`| ${pk.pos} | 变出 | ${q(pk.bian.classic)} | ${q(pk.bian.gist)} |`);
      }
    }
    out.push("");
  }

  const md = out.join("\n");
  const conv = locale === "zh-Hant" ? toHant(md) : md;
  return conv.replace(QUOTE_SLOT_RE, (_m, i: string) => quotes[Number(i)] ?? "");
}

/** 四家合参的 Markdown。与 Web 共用 —— 两处结论逐字一致是构造保证。 */
export function renderCrossMarkdown(r: CrossReading, locale: Locale = "zh-Hans"): string {
  const out: string[] = [];
  const h = (n: number, t: string) => out.push(`${"#".repeat(n)} ${t}\n`);
  const p = (t: string) => out.push(`${t}\n`);
  const row = (t: string) => out.push(t);

  h(1, `${r.systems} 家合参`);
  p("以下各家并列陈述，**不作合并**。四柱流日、六爻、六壬、奇门都是同一时刻干支的"
    + "确定性函数 —— 方向一致不构成互相印证，方向相反也不代表哪一家有误。"
    + "此处不给出综合取向，也不排「哪一家更准」。");

  h(2, "各家所起");
  row("| 体系 | 所起 |");
  row("| --- | --- |");
  if (r.bazi !== null) {
    row(`| 四柱 | 流日 ${r.bazi.pillar.stem}${r.bazi.pillar.branch} |`);
  }
  const g = r.liuyao.judgement.gua;
  row(`| 六爻 | ${g.ben.name}${g.bian === null ? "（六爻皆静）" : ` → ${g.bian.name}`} |`);
  row(`| 六壬 | ${r.liuren.sanchuan.keti}课，三传 ${r.liuren.sanchuan.chu} → `
    + `${r.liuren.sanchuan.zhong} → ${r.liuren.sanchuan.mo} |`);
  row(`| 奇门 | ${r.qimen.term}${r.qimen.yuan}，${r.qimen.yin ? "阴" : "阳"}遁 ${r.qimen.ju} 局，`
    + `值符${r.qimen.zhifu}、值使${r.qimen.zhishi} |`);
  out.push("");

  h(2, "逐轴对照");
  for (const c of r.comparisons) {
    h(3, `${c.axis} —— ${c.kind}`);
    row("| 体系 | 取向 | 依据 |");
    row("| --- | --- | --- |");
    for (const x of c.claims) {
      row(`| ${SYSTEM_LABEL[x.system]} | ${AXIS_DIRECTIONAL[c.axis]
        ? (x.polarity === "中性" ? "未表态" : x.polarity) : "—"} | ${x.evidence} |`);
    }
    out.push("");
    p(`_${c.note}_`);
  }

  h(2, "小结");
  p(`逐轴对照：${r.summary}`);

  const md = out.join("\n");
  return locale === "zh-Hant" ? toHant(md) : md;
}

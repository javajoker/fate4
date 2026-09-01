"use client";

import { useMemo, useState } from "react";
import { buildReport, renderMarkdown, formatViolations, paramsHash } from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { useToday } from "../../../lib/today";
import { Narrative } from "../../../components/Narrative";
import { encodeShare } from "../../../lib/storage";

export default function ReportPage() {
  const { base, params, record, overrides } = useChart();
  const today = useToday();
  const [tab, setTab] = useState<"read" | "markdown" | "json">("read");
  const [subject, setSubject] = useState<"self" | "other">("self");
  const [copied, setCopied] = useState("");

  const r = useMemo(() => {
    if (base === null || today === null) return null;
    // 卡片窗口不在此处指定 —— 默认值在 core 里，Web 与 CLI 因此同源。
    return buildReport(base, { subject, now: today });
  }, [base, subject, today]);

  if (r === null || base === null || record === null) return <p className="sub">生成中…</p>;

  const md = renderMarkdown(r);
  const json = JSON.stringify(r, null, 2);

  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(""), 1600);
  };

  return (
    <>
      <h1>完整报告</h1>
      <div className="disclaimer">{r.disclaimerTop}</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        {(["read", "markdown", "json"] as const).map((t) => (
          <button key={t} className={tab === t ? undefined : "ghost"} onClick={() => setTab(t)}>
            {t === "read" ? "阅读" : t === "markdown" ? "Markdown" : "JSON"}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
          报告对象
          <select value={subject} onChange={(e) => setSubject(e.target.value as "self")}>
            <option value="self">本人</option>
            <option value="other">他人</option>
          </select>
        </label>
      </div>

      {subject === "other" && (
        <div className="card">
          六亲叙述与神煞语义标签已<b>整体略去</b>，仅保留结构表。
          这是结构性的略去 —— 不生成，而不是生成后再过滤。
        </div>
      )}

      <div className="card">
        <h3>措辞扫描</h3>
        <p className="mono">
          扫过 {r.guard.scanned} 段　命中 {r.guard.violations.length} 处　
          因置信度不足降级 {r.guard.hedged.length} 条
        </p>
        {r.guard.violations.length > 0 && (
          <pre className="export">{formatViolations(r.guard.violations)}</pre>
        )}
        <p className="dim" style={{ fontSize: 12 }}>
          扫的是断言的形状，不是词。「病药」是取用神法之一，「疾病」是神煞的传统语义标签 ——
          禁掉这些词等于禁掉术语表；而「二〇二七年会离婚」里没有任何一个词单独有问题。
        </p>
      </div>

      {tab === "read" && (
        <>
          {([["§1 盘面", r.chart.narrative], ["§2 力量结构", r.force.narrative],
            ["§3 旺衰与取用", r.strength.narrative], ["§4 宫位与六亲", r.kin.narrative],
            ["§5 大运", r.luck.narrative], ["§6 流年", r.years.narrative],
            ...(r.current === null ? [] : [["§7 当前时段", r.current.narrative] as const]),
            ["§8 方法与边界", r.method.narrative]] as const).map(([t, lines]) => (
            <section key={t}>
              <h2>{t}</h2>
              <Narrative lines={lines} />
            </section>
          ))}
          <h2>逐年卡片</h2>
          {r.years.cards.map((c) => (
            <div className="card" key={c.view.year}>
              <h3>{c.view.year} {c.view.pillar.stem}{c.view.pillar.branch}</h3>
              <Narrative lines={c.narrative} />
            </div>
          ))}
          <h2>待校准</h2>
          <ul>{r.method.pendingCalibration.map((i) => <li key={i}>{i}</li>)}</ul>
        </>
      )}

      {tab === "markdown" && (
        <>
          <button className="ghost" onClick={() => void copy(md, "markdown")}>
            {copied === "markdown" ? "已复制" : "复制 Markdown"}
          </button>
          <pre className="export">{md}</pre>
        </>
      )}

      {tab === "json" && (
        <>
          <button className="ghost" onClick={() => void copy(json, "json")}>
            {copied === "json" ? "已复制" : "复制 JSON"}
          </button>
          <p className="dim" style={{ fontSize: 12 }}>
            全量 <span className="mono">Report</span>，供二次分析。
            每条叙述都带 <span className="mono">templateId</span> 与来源指向 ——
            报告层不做新判断，任何一句都能追问「这是从哪来的」。
          </p>
          <pre className="export">{json.slice(0, 200000)}</pre>
        </>
      )}

      <h2>分享</h2>
      <div className="card">
        <p className="dim" style={{ fontSize: 13 }}>
          分享链接把生辰与参数编进 URL <b>片段</b>（<span className="mono">#</span> 之后）。
          片段不随请求发往服务器，也不进访问日志 —— 数据仍然只在收发双方的浏览器里。
        </p>
        <button className="ghost" onClick={() => void copy(
          `${location.origin}/chart#${encodeShare(record.input, overrides)}`, "share")}>
          {copied === "share" ? "已复制" : "复制分享链接"}
        </button>
      </div>

      <div className="card">
        <h3>可复算凭据</h3>
        <p className="mono">
          引擎 {r.method.engineVersion}　参数快照 {paramsHash(params)}　
          太阳黄经 {r.method.rulesUsed.solarProviderId}
        </p>
        <p className="dim" style={{ fontSize: 12 }}>
          半年后若同一生辰算出不同结果，这三项是唯一能回答「为什么」的依据。
        </p>
      </div>

      <div className="disclaimer">{r.disclaimerBottom}</div>
    </>
  );
}

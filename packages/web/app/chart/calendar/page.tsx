"use client";

import { useMemo, useState } from "react";
import {
  dayView, label, monthView, MONTH_BRANCH_ORDER, SEVERITY_LABEL, TONE_LABEL,
  type MonthView,
} from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { useToday } from "../../../lib/today";
import { dedupeByName, pillarText, shenshaKey } from "../../../lib/format";

const TONE_TEXT = {
  supports: "与本命喜用同气",
  neutral: "与本命用忌皆不直接相干",
  opposes: "与本命忌仇同气",
} as const;

export default function CalendarPage() {
  const { chart, base } = useChart();
  const today = useToday();
  const [pick, setPick] = useState<number | null>(null);

  const months = useMemo<MonthView[] | null>(() => {
    if (base === null || today === null) return null;
    return MONTH_BRANCH_ORDER.map((_, i) => monthView(base, today.year, i));
  }, [base, today]);

  const day = useMemo(() => {
    if (base === null || today === null) return null;
    return dayView(base, today.year, today.month, today.day);
  }, [base, today]);

  if (chart === null || base === null || today === null || months === null || day === null) {
    return <p className="sub">读取本机日期中…</p>;
  }

  const active = pick === null ? null : months[pick] ?? null;

  return (
    <>
      <h1>月历 · 今日</h1>
      <p className="sub">
        流月与流日<b>不参与权重计算</b>。把一个三十天的短期因素放进权重迭代，
        等于让它与终生不变的月令同台竞争数值 —— 既无理论依据，也会让年度曲线被高频噪声淹没。
        它们只作引动的扳机。
      </p>

      <h2>{today.year} 年逐月</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {months.map((m, i) => (
          <div key={i} className="card"
            onClick={() => setPick(i)}
            style={{
              margin: 0, cursor: "pointer",
              borderColor: pick === i ? "var(--accent)" : undefined,
              background: m.tone.relationToYongshen === "supports" ? "var(--accent-soft)" : undefined,
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <b style={{ fontFamily: "var(--serif)", fontSize: 17 }}>{pillarText(m.pillar)}</b>
              <span className="dim" style={{ fontSize: 11 }}>{m.openedBy}</span>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>
              {m.tone.monthElement}　{TONE_TEXT[m.tone.relationToYongshen]}
            </div>
            <div style={{ marginTop: 6 }}>
              {dedupeByName(m.shensha).slice(0, 3).map((s) => (
                <span key={shenshaKey(s)} className="pill" title={s.toneReason}>{s.name}</span>
              ))}
            </div>
            <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
              {m.interactions.slice(0, 2).map((x, k) => <div key={k}>{x.detail}</div>)}
            </div>
          </div>
        ))}
      </div>

      {active !== null && (
        <div className="card">
          <h3>{pillarText(active.pillar)}　{active.openedBy}起</h3>
          {active.narrative.map((n, i) => <p key={i}>{n}</p>)}
          {active.shensha.length > 0 && (
            <table style={{ marginTop: 8 }}>
              <thead><tr><th>神煞</th><th>宫</th><th>状态</th><th>缘由</th></tr></thead>
              <tbody>
                {active.shensha.map((s) => (
                  <tr key={shenshaKey(s)}>
                    <td>{s.name}</td><td>{s.palace}</td>
                    <td>{s.toneIsDefault ? "常态" : label(TONE_LABEL, s.tone)}</td>
                    <td className="dim">{s.toneReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="dim" style={{ fontSize: 12 }}>
            本月视图的类型里不含任何权重字段 —— 由类型系统与测试双重强制。
          </p>
        </div>
      )}

      <h2>今日 {today.year}-{String(today.month).padStart(2, "0")}-{String(today.day).padStart(2, "0")}</h2>
      <div className="card">
        <p style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "0 0 8px" }}>
          {pillarText(day.pillar)}
          <span className="dim" style={{ fontSize: 13, marginLeft: 12 }}>
            月柱 {pillarText(day.monthPillar)}　年柱 {pillarText(day.yearPillar)}
          </span>
        </p>
        <p>{day.note}</p>
        {day.conflicts.length > 0 && (
          <table>
            <thead><tr><th>五行冲突</th><th>程度</th><th>涉及</th><th>所在宫</th></tr></thead>
            <tbody>
              {day.conflicts.map((c, i) => (
                <tr key={i}>
                  <td>{c.detail}</td>
                  <td>{label(SEVERITY_LABEL, c.severity)}</td>
                  <td>{c.involvedElements.join(" / ")}</td>
                  <td>{c.affectedPalace ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {day.harmonies.length > 0 && (
          <p className="dim">{day.harmonies.join("；")}</p>
        )}
        <p className="dim" style={{ fontSize: 12, marginTop: 10 }}>
          日层只分「轻微」与「明显」两档。日层的分辨率本就不支持更细的判断，
          给五档只是伪精度。此处不出宜忌，不作预测。
        </p>
      </div>
    </>
  );
}

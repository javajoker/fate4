"use client";

import { useMemo, useState } from "react";
import { buildReport, label, BAND_LABEL_ZH } from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { Narrative } from "../../../components/Narrative";
import { LuckBars } from "../../../components/charts";
import { num, pillarText } from "../../../lib/format";

export default function LuckPage() {
  const { chart, base } = useChart();
  const [pick, setPick] = useState<number | null>(null);
  const r = useMemo(
    () => (base === null ? null : buildReport(base, { curveYears: 1 })),
    [base],
  );
  if (r === null || chart === null) return null;

  const bars = r.luck.steps.map((s) => ({
    index: s.index, label: pillarText(s.pillar), fromAge: s.startAgeYears,
    samples: s.samples.map((x) => ({ at: x.at, favorIndex: x.favorIndex })),
  }));
  const step = pick === null ? null : r.luck.steps.find((s) => s.index === pick) ?? null;

  return (
    <>
      <h1>大运</h1>
      <p className="sub">
        起运 <b className="mono">{num(chart.luck.startAgeYears, 2)}</b> 岁，
        {chart.luck.direction === "forward" ? "顺行" : "逆行"}；
        至交{chart.luck.targetTermName} <span className="mono">{num(chart.luck.daysToTerm, 2)}</span> 日。
        传统离散口诀作 {chart.luck.traditional.years} 岁 {chart.luck.traditional.months} 个月
        {chart.luck.traditional.days} 日，两者并列，不取其一。
      </p>

      <LuckBars bars={bars} onPick={setPick} />

      <h2>逐步展开</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>步</th><th>干支</th><th className="num">起岁</th><th>交运</th>
              <th className="num">起</th><th className="num">中</th><th className="num">末</th>
              <th>起 · 旺衰</th><th>末 · 旺衰</th>
            </tr>
          </thead>
          <tbody>
            {r.luck.steps.map((s) => {
              const at = (k: string) => s.samples.find((x) => x.at === k);
              return (
                <tr key={s.index} onClick={() => setPick(s.index)}
                  style={{ cursor: "pointer", background: pick === s.index ? "var(--accent-soft)" : undefined }}>
                  <td className="num">{s.index}</td>
                  <td>{pillarText(s.pillar)}</td>
                  <td className="num">{num(s.startAgeYears)}</td>
                  <td className="mono dim">
                    {s.startCalendar.year}-{String(s.startCalendar.month).padStart(2, "0")}
                  </td>
                  <td className="num">{num(at("start")?.favorIndex ?? 0)}</td>
                  <td className="num">{num(at("mid")?.favorIndex ?? 0)}</td>
                  <td className="num">{num(at("end")?.favorIndex ?? 0)}</td>
                  <td>{label(BAND_LABEL_ZH, at("start")?.strength ?? "")}</td>
                  <td>{label(BAND_LABEL_ZH, at("end")?.strength ?? "")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {step !== null && (
        <div className="card">
          <h3>第 {step.index} 步 {pillarText(step.pillar)}</h3>
          <p>{step.stemPhaseSummary}</p>
          <p>{step.branchPhaseSummary}</p>
          <p className="dim" style={{ fontSize: 13 }}>
            一步之内天干占比自 0.70 线性降至 0.30，地支反向递增，二者恰在第 5 年末交叉。
            取样点设在起、中、末三处，正为呈现这一变化 —— 只取一点会把它整个抹掉。
          </p>
        </div>
      )}

      <Narrative lines={r.luck.narrative} />
    </>
  );
}

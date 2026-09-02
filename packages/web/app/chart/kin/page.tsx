"use client";

import { useMemo } from "react";
import { buildReport, label, QUADRANT_LABEL } from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { Narrative } from "../../../components/Narrative";
import { num } from "../../../lib/format";

export default function KinPage() {
  const { base } = useChart();
  const r = useMemo(
    () => (base === null ? null : buildReport(base, { curveYears: 1 })),
    [base],
  );
  if (r === null) return null;

  return (
    <>
      <h1>宫位与六亲</h1>
      <p className="sub">
        宫与星两条线同参，四象限如实呈现，不合并成一句话 ——
        宫得力而星不足，与两者俱不得力，是完全不同的两回事。
      </p>

      <h2>四柱八宫</h2>
      <div className="scroll">
        <table>
          <thead><tr><th></th>{r.chart.pillars.map((c) => <th key={c.kind}>{c.label}</th>)}</tr></thead>
          <tbody>
            <tr><th>天干宫</th>{r.chart.pillars.map((c) => <td key={c.kind}>{c.stemPalace}</td>)}</tr>
            <tr><th>地支宫</th>{r.chart.pillars.map((c) => <td key={c.kind}>{c.branchPalace}</td>)}</tr>
          </tbody>
        </table>
      </div>

      <h2>逐六亲 · 宫星同参</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>六亲</th><th>宫</th><th className="num">宫权重</th>
              <th>星</th><th className="num">星权重</th>
              <th>象限</th><th className="num">置信度</th><th>标记</th>
            </tr>
          </thead>
          <tbody>
            {r.kin.readings.map((k) => (
              <tr key={k.kin}>
                <td>{k.label}</td>
                <td>{k.palaceLabel}</td>
                <td className="num">{num(k.palaceWeight)}</td>
                <td>{k.starGod}</td>
                <td className="num">{num(k.starWeight)}</td>
                <td>{label(QUADRANT_LABEL, k.quadrant)}</td>
                <td className="num">{num(k.confidence, 2)}</td>
                <td>
                  {/* 宫与星各有自己的标记，同一个标记（REVEALED、TOMB_OPENED…）
                      两边都可能出现。合并后不去重会撞 React 的 key，
                      而且读者也分不清这一条是宫的还是星的 —— 故带上来源。 */}
                  {[
                    ...k.palaceFlags.map((f) => [`palace:${f}`, f, "宫"] as const),
                    ...k.starFlags.map((f) => [`star:${f}`, f, "星"] as const),
                  ].map(([key, f, from]) => (
                    <span key={key} className="pill" title={`${from}的标记`}>
                      {from}·{f}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.kin.narrativeOmitted
        ? <p className="sub">报告对象为他人，六亲叙述整体略去，仅保留结构表。</p>
        : <Narrative lines={r.kin.narrative} />}

      <p className="sub">
        女命子女星的分配尚属待校准项，相关判定的置信度已相应下调。
      </p>
    </>
  );
}

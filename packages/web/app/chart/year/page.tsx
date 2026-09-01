"use client";

import { useMemo, useState } from "react";
import { buildReport, DOMAIN_LABEL, type Element } from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { Narrative } from "../../../components/Narrative";
import { aggregateFlows, ElementRadar, SankeyFlow, YearLines } from "../../../components/charts";
import { POLARITY_MARK, sequential } from "../../../lib/palette";
import { num, pillarText } from "../../../lib/format";
import { useToday } from "../../../lib/today";

export default function YearPage() {
  const { chart, base } = useChart();
  const today = useToday();
  const [picked, setPicked] = useState<number | null>(null);
  // 构建期预渲染时没有「今天」，故当前年份只能在客户端确定。
  const year = picked ?? today?.year ?? null;
  const setYear = setPicked;

  // 曲线与卡片各自成环，故换年份只重算那一张卡片，整条曲线不动。
  const r = useMemo(() => {
    if (base === null || year === null) return null;
    return buildReport(base, {
      curveYears: base.params.temporal.yearRangeYears,
      cardYears: { from: year, to: year },
    });
  }, [base, year]);

  const detail = useMemo(() => {
    if (base === null || r === null) return null;
    const card = r.years.cards[0];
    if (card === undefined) return null;
    const ev = card.view.evaluated;
    const elementById = Object.fromEntries(
      ev.carriers.map((c) => [c.id, c.element])) as Record<string, Element>;
    // 本命参照直接取基础盘，不再重解
    return { card, ev, natal: base, elementById };
  }, [base, r]);

  if (r === null || chart === null || detail === null || year === null) {
    return <p className="sub">计算中…</p>;
  }
  const { card, ev, natal, elementById } = detail;
  const v = card.view;
  const y0 = r.years.curve[0]?.year ?? year;
  const yn = r.years.curve[r.years.curve.length - 1]?.year ?? year;

  return (
    <>
      <h1>流年</h1>
      <p className="sub">
        顺逆指数衡量的是当年五行结构与本命喜用的契合度，<b>不是运气好坏</b>。
        指数低表示结构与取用相左、需要更多调适 —— 在传统语境中它同样对应变动与转折。
      </p>

      <YearLines points={r.years.curve} mark={year} onPick={(y) => setYear(Math.min(yn, Math.max(y0, y)))} />

      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "16px 0" }}>
        <button className="ghost" onClick={() => setYear(Math.max(y0, year - 1))}>◀</button>
        <input type="number" value={year} min={y0} max={yn} style={{ width: 110 }}
          onChange={(e) => setYear(Number(e.target.value))} />
        <button className="ghost" onClick={() => setYear(Math.min(yn, year + 1))}>▶</button>
        <span className="dim">可取范围 {y0}–{yn}</span>
      </div>

      <h2>{v.year} {pillarText(v.pillar)}　行运 {pillarText(v.luckPillar)}</h2>

      <div className="grid3">
        <div className="card">
          <h3>顺逆指数</h3>
          {/* 色阶给色块，不给文字 —— 浅端的字会低到读不出来 */}
          <p style={{ fontSize: 30, fontFamily: "var(--mono)", margin: 0 }}>{num(v.favorIndex)}</p>
          <div aria-hidden style={{
            height: 6, borderRadius: 3, marginTop: 6,
            background: "var(--surface-2)", overflow: "hidden",
          }}>
            <div style={{
              width: `${v.favorIndex}%`, height: "100%",
              background: sequential(0.35 + v.favorIndex / 200),
            }} />
          </div>
          <p className="dim" style={{ fontSize: 12 }}>
            结构项 {num(v.indexParts.base, 3)}　事件项 {num(v.indexParts.eventDelta, 2)}
          </p>
        </div>
        <div className="card">
          <h3>单轮留存</h3>
          <p style={{ fontSize: 30, fontFamily: "var(--mono)", margin: 0 }}>{num(v.vitality * 100)}%</p>
        </div>
        <div className="card">
          <h3>日主党势</h3>
          <p style={{ fontSize: 30, fontFamily: "var(--mono)", margin: 0 }}>{num(v.dayMasterShare * 100)}%</p>
        </div>
      </div>

      {v.segments.length > 1 && (
        <div className="card">
          <h3>本年换运</h3>
          <p>该年内大运更替，分段呈现，<b>不作加权平均</b> —— 换运前后两柱的气象本就不同。</p>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h3>五行：本命 vs 当年</h3>
          <ElementRadar layers={[
            { name: "本命", values: natal.propagation.byElement },
            { name: `${v.year} 年`, values: ev.propagation.byElement, dash: "5 3" },
          ]} />
        </div>
        <div className="card">
          <h3>当年流通</h3>
          <SankeyFlow flows={aggregateFlows(ev.propagation.flows, elementById).slice(0, 18)} height={250} />
        </div>
      </div>

      <h2>触发的应期规则</h2>
      {v.events.length === 0 ? <p className="sub">本年无应期规则触发。</p> : (
        <div className="scroll">
          <table>
            <thead><tr><th>规则</th><th>极性</th><th>域</th><th className="num">权重</th><th>依据</th></tr></thead>
            <tbody>
              {v.events.map((e) => {
                const m = POLARITY_MARK[String(e.polarity) as "1" | "0" | "-1"];
                return (
                  <tr key={e.ruleId}>
                    <td>{e.name}</td>
                    <td style={{ color: m.color }} title={m.label}>{m.glyph}</td>
                    <td className="dim">{e.domains.map((d) => DOMAIN_LABEL[d]).join("、")}</td>
                    <td className="num">{num(e.weight, 2)}</td>
                    <td className="dim">{e.evidence}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="sub">
        极性有三档，中性是刻意保留的一档：驿马逢冲是「动」，动是好是坏取决于用忌。
        把所有事件二分为吉凶，是命理软件最常见的失真来源。
      </p>

      <h2>按域聚合</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>域</th><th className="num">张力</th><th className="num">净值</th>
            <th>顺向</th><th>逆向</th><th>中性</th></tr></thead>
          <tbody>
            {v.domains.map((d) => (
              <tr key={d.domain}>
                <td>{d.label}</td>
                <td className="num" style={{
                  background: d.tension >= 0.6 ? "var(--accent-soft)" : undefined,
                  fontWeight: d.tension >= 0.6 ? 600 : undefined,
                }}>
                  {num(d.tension, 2)}
                </td>
                <td className="num">{num(d.net, 2)}</td>
                <td className="dim">{d.supporting.map((e) => e.narrativeTag).join("、") || "—"}</td>
                <td className="dim">{d.opposing.map((e) => e.narrativeTag).join("、") || "—"}</td>
                <td className="dim">{d.neutral.map((e) => e.narrativeTag).join("、") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sub">
        张力 = min(Σ顺向, Σ逆向) / max(…)。同域内极性相反的事件并存，<b>不相抵消</b> ——
        净值近零而张力高，与「无事」是两回事：前者是大起大落，后者是平淡。
      </p>

      <Narrative lines={card.narrative} />

      <h2>高张力年份</h2>
      <div className="scroll">
        <table>
          <thead><tr><th className="num">年</th><th>域</th><th className="num">张力</th></tr></thead>
          <tbody>
            {r.years.highTension.slice(0, 15).map((t, i) => (
              <tr key={i} onClick={() => setYear(t.year)} style={{ cursor: "pointer" }}>
                <td className="num">{t.year}</td><td>{t.domain}</td>
                <td className="num">{num(t.tension, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

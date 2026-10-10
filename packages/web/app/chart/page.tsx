"use client";

import { useMemo } from "react";
import { buildReport, type Element } from "@fate/core";
import { useChart } from "../../lib/chartContext";
import { Narrative } from "../../components/Narrative";
import { PillarTable } from "../../components/PillarTable";
import { aggregateFlows, ElementRadar, SankeyFlow, TenGodBars } from "../../components/charts";
import { num, pct, pillarText, shenshaKey } from "../../lib/format";
import { OUTCOME_LABEL, PILLAR_LABEL, TONE_LABEL, label } from "@fate/core";

export default function ChartPage() {
  const { base } = useChart();
  const data = useMemo(() => {
    if (base === null) return null;
    // 基础盘来自上下文，此处不重解；本页展示的正是它本身
    const r = buildReport(base, { curveYears: 1 });
    const elementById = Object.fromEntries(
      base.carriers.map((c) => [c.id, c.element])) as Record<string, Element>;
    return { r, ev: base, elementById };
  }, [base]);

  if (base === null || data === null) return null;
  const { r, ev, elementById } = data;

  return (
    <>
      <h1>盘面</h1>
      <p className="sub">
        年柱月柱以绝对时刻与节气比较定；时支与日界以真太阳时定。两把尺子量两件事，不可混用。
      </p>

      {r.meta.warnings.length > 0 && (

        <div className="card">

          <h3>这张盘是怎么定下来的</h3>

          <p className="dim">

            下面几条影响的是盘本身，不是对盘的解读 —— 换一条规则，盘就不是这一张了。

          </p>

          <ul>{r.meta.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>

        </div>

      )}

      <PillarTable cells={r.chart.pillars} />

      <div className="grid3">
        <div className="card">
          <h3>胎元 · 命宫</h3>
          <p>胎元 <b>{pillarText(r.chart.taiyuan)}</b>　命宫 <b>{pillarText(r.chart.mingGong)}</b></p>
          <p className="dim" style={{ fontSize: 12 }}>
            命宫月界取「{r.method.rulesUsed.mingGongBoundary === "jie" ? "节" : "中气"}」，
            此为待校准项，可在参数页切换。
          </p>
        </div>
        <div className="card">
          <h3>时间校正</h3>
          <table>
            <tbody>
              <tr><th>时区偏移</th><td className="num">{r.chart.corrections.tzOffsetMinutes} 分</td></tr>
              <tr><th>夏令时</th><td>{r.chart.corrections.isDaylightSaving ? "行用中" : "未行用"}</td></tr>
              <tr><th>经度时差</th><td className="num">{num(r.chart.corrections.longitudeMinutes)} 分</td></tr>
              <tr><th>均时差</th><td className="num">{num(r.chart.corrections.equationOfTimeMinutes)} 分</td></tr>
              <tr><th>相对钟表</th><td className="num">{num(r.chart.corrections.netVsCivilMinutes)} 分</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>节气 · 司令</h3>
          <p>{r.chart.enclosingJie.prevName} → {r.chart.enclosingJie.nextName}</p>
          <p>司令 <b>{r.chart.siling.stem}</b>　第 {r.chart.siling.segment + 1} 段　
            入节 <span className="mono">{num(r.chart.siling.daysIntoJie, 2)}</span> 日</p>
          {r.chart.siling.resolution === "unresolvable" && (
            <p className="dim" style={{ fontSize: 12 }}>
              司令干在月支藏干中无落点。此为亥月前七日戊土司令的固有情形，非计算错误。
            </p>
          )}
        </div>
      </div>

      <h2>神煞（按宫位）</h2>
      <p className="sub">
        「有华盖」是废话，「华盖在时支子女宫且逢空」才是信息。神煞不进入力量模型，
        只作叙述素材、应期触发器与宫位定性三用。
      </p>
      <div className="scroll">
        <table>
          <thead><tr><th>宫</th><th>神煞</th></tr></thead>
          <tbody>
            {r.chart.shenshaByPalace.map((g) => (
              <tr key={g.palace}>
                <th>{g.palace}</th>
                <td>{g.hits.map((h) => (
                  <span key={shenshaKey(h)} className="pill" title={h.toneReason}>
                    {h.name} · {h.toneIsDefault ? "常态" : label(TONE_LABEL, h.tone)}
                  </span>
                ))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Narrative lines={r.chart.narrative} />

      <h1 style={{ marginTop: 44 }}>力量结构</h1>

      <div className="grid2">
        <div className="card">
          <h3>五行权重</h3>
          <ElementRadar layers={[{ name: "本命", values: r.force.byElement }]} />
          <p className="sub" style={{ fontSize: 12 }}>
            日主 <b>{base.conclusions.dayMaster.stem}</b> 属{base.conclusions.dayMaster.polarity}
            <b>{base.conclusions.dayMaster.element}</b> —— 这一角就是「自己」，
            其余四角相对它才有生我、我生、克我、我克之分。
          </p>
        </div>
        <div className="card">
          <h3>十神权重</h3>
          <TenGodBars values={r.force.tenGods} />
        </div>
      </div>

      <h2>五行流通</h2>
      <p className="sub">
        生是「流」不是「加」——母泄气，子得力，其间有 15% 传输损耗。
        克是「毁」不是「转移」——双方俱损。故整套传导严格收缩，不会数值爆炸。
      </p>
      <SankeyFlow flows={aggregateFlows(ev.propagation.flows, elementById)} />

      <div className="grid3">
        {([["单轮留存", r.force.metrics.vitality], ["流通度", r.force.metrics.circulation],
          ["五行匀度", r.force.metrics.evenness]] as const).map(([k, v]) => (
          <div className="card" key={k}>
            <h3>{k}</h3>
            <p style={{ fontSize: 26, fontFamily: "var(--mono)", margin: 0 }}>{pct(v)}</p>
          </div>
        ))}
      </div>

      <h2>结构事件</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>事件</th><th>结局</th><th>涉柱</th><th className="num">距离系数</th></tr></thead>
          <tbody>
            {r.force.events.map((e, i) => (
              <tr key={i}>
                <td>{e.narrativeTag}</td>
                <td>{label(OUTCOME_LABEL, e.outcome)}
                  {e.strengthScores !== undefined && (
                    <span className="dim"> 合 {num(e.strengthScores.he)} / 冲 {num(e.strengthScores.chong)}</span>
                  )}
                </td>
                <td className="dim">{e.pillars.map((x) => label(PILLAR_LABEL, x)).join("、")}</td>
                <td className="num">{num(e.distanceCoef, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Narrative lines={r.force.narrative} />
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { buildSeries } from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { LifeCurves } from "../../../components/charts";
import { num, pillarText } from "../../../lib/format";

const GROUPS: readonly [string, string][] = [
  ["tenGod", "十神"], ["element", "五行"], ["palace", "宫位"],
  ["dayMaster", "日主"], ["innerOuter", "内外"], ["domain", "域"],
  ["metric", "综合"], ["agitation", "扰动"],
];

export default function CurvesPage() {
  const { base } = useChart();
  const [group, setGroup] = useState("tenGod");
  const [picked, setPicked] = useState<number | null>(null);

  const S = useMemo(() => (base === null ? null : buildSeries(base)), [base]);
  if (base === null || S === null) return <p className="sub">曲线计算中…</p>;

  const shown = S.series.filter((s) => s.kind === group).slice(0, 4);
  const years = S.frames.map((f) => f.year);
  const breaks = S.frames
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => i > 0 && f.luckIndex !== S.frames[i - 1]!.luckIndex)
    .map(({ i }) => i);
  const at = picked === null ? null : S.frames[picked] ?? null;

  return (
    <>
      <h1>生命曲线</h1>
      <p className="sub">
        以基础盘为固定基准，<b>按月</b>采样 {S.frames.length} 点（{S.statsFrom}–{S.statsTo}）。
        曲线本来就是连续的：流年是阶跃、大运是斜坡（天干占比自 0.70 线性降到 0.30），
        而结构的结局也在运内变化 —— 实测 528 步运里 191 次出现
        「冲而拔根 ⇄ 相冲」「合解冲 ⇄ 相冲」这类翻转。年度采样会把它们整个抹掉。
      </p>
      <p className="sub">
        <b>流月不参与权重。</b>月度上之所以有变化，是大运份额在推移，不是流月加了分。
        流月只进符号层：它在扰动序列里，不在权重序列里。
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
        {GROUPS.map(([k, name]) => (
          <button key={k} className={group === k ? undefined : "ghost"} onClick={() => setGroup(k)}>
            {name}
          </button>
        ))}
      </div>

      <LifeCurves
        series={shown.map((s) => ({ id: s.id, label: s.label, values: s.values }))}
        years={years} luckBreaks={breaks}
        {...(picked === null ? {} : { mark: picked })}
        onPick={setPicked}
      />
      <p className="sub" style={{ fontSize: 12 }}>
        每条各自归一到 [0,1] 再画 —— 十神权重与域张力量纲差着两个数量级，同轴直接画
        会让后者变成一条贴底的直线。归一之后比的是<b>形状</b>：哪一段在动、哪几条一起动。
        具体数值见下表；图上不标纵轴刻度，因为归一后的纵轴没有单位。
      </p>

      {at !== null && (
        <div className="card">
          <h3>
            {at.year} 年 {at.fleetingMonth.branch}月
            <span className="dim" style={{ fontSize: 13, marginLeft: 10 }}>
              流年 {pillarText(at.annual)}　
              大运 {at.luckPillar === null ? "未交运" : pillarText(at.luckPillar)}
              {at.luckPillar !== null && `（已行 ${num(at.elapsedYears, 2)} 年）`}　
              流月 {pillarText(at.fleetingMonth)}
            </span>
          </h3>
          <div className="scroll">
            <table>
              <thead><tr><th>序列</th><th className="num">此刻</th><th className="num">基础盘</th><th className="num">差</th></tr></thead>
              <tbody>
                {S.series.filter((s) => s.kind === group).map((s) => (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td className="num">{num(s.values[picked!]!, 2)}</td>
                    <td className="num">{num(s.baseValue, 2)}</td>
                    <td className="num">{num(s.deltas[picked!]!, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(group === "tenGod" || group === "element" || group === "palace") && (
            <p className="dim" style={{ fontSize: 12 }}>
              ⚠️ 「差」这一列里大半是大运流年带来的<b>新质量</b>，不是净增长：
              基础盘总量约 435，加上大运流年约 696，涨了六成。
              要说「较本命高出多少」，得看去过稀释的份额偏离，不是这一列。
            </p>
          )}
        </div>
      )}

      <h2>全部序列</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>组</th><th>序列</th><th className="num">基础盘</th><th className="num">最小</th><th className="num">中位</th><th className="num">最大</th><th>用忌</th></tr></thead>
          <tbody>
            {S.series.map((s) => {
              const sorted = [...s.values].sort((a, b) => a - b);
              return (
                <tr key={s.id}>
                  <td className="dim">{GROUPS.find(([k]) => k === s.kind)?.[1] ?? s.kind}</td>
                  <td>{s.label}</td>
                  <td className="num">{num(s.baseValue, 2)}</td>
                  <td className="num">{num(sorted[0]!, 2)}</td>
                  <td className="num">{num(sorted[Math.floor(sorted.length / 2)]!, 2)}</td>
                  <td className="num">{num(sorted[sorted.length - 1]!, 2)}</td>
                  <td className="dim">
                    {s.polarity === "favorable" ? "用神向"
                      : s.polarity === "adverse" ? "忌神向" : "不判方向"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sub">
        域张力<b>恒不判方向</b> —— 张力本身就是「顺逆并存」的度量，给它定吉凶
        等于把已经拆开的东西又合回去。宫位权重同理，只报「该宫变动」。
      </p>
    </>
  );
}

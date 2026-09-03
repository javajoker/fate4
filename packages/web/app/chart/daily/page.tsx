"use client";

import { useMemo, useState } from "react";
import { dailyOutlook, dailyNarrative, AXIS_DIRECTIONAL, SYSTEM_LABEL } from "@fate/core";
import { useChart } from "../../../lib/chartContext";

const KIND_NOTE: Readonly<Record<string, string>> = {
  一致: "两侧方向相同。两者都是同一日干支的确定性函数，方向一致不构成互相印证。",
  分歧: "两侧方向相反。此处并列两说，不作裁决。",
  单侧表态: "一方给出方向，另一方判中性。这不是一致 —— 沉默不等于同意。",
  无从比对: "两侧皆判中性 —— 两边都没话说。",
  并列: "此轴不判顺逆：动不等于好，静也不等于坏。",
  单侧: "此轴只有一侧说得上话。另一侧未表态，不等于默认同意。",
};

export default function DailyPage() {
  const { base } = useChart();
  const today = useMemo(() => new Date(), []);
  const [d, setD] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-`
    + `${String(today.getDate()).padStart(2, "0")}`);

  const o = useMemo(() => {
    if (base === null) return null;
    const [Y, M, D] = d.split("-").map(Number);
    if (Y === undefined || M === undefined || D === undefined) return null;
    try { return dailyOutlook(base, { year: Y, month: M, day: D }); } catch { return null; }
  }, [base, d]);

  if (base === null) return <p className="dim">载入中…</p>;

  return (
    <>
      <h1>当日运程</h1>
      <p className="sub">
        四柱流日与六爻日卦并列陈述，不作合并。两者都是当日干支的确定性函数 ——
        方向一致不构成互相印证，方向相反也不代表哪一侧有误。此处不给出「今日总体如何」
        的合成判断：那个数没有任何一家典籍为它背书。
      </p>

      <div className="card">
        <input type="date" value={d} onChange={(e) => setD(e.target.value)} />
      </div>

      {o === null ? <p className="dim">日期无效。</p> : (
        <>
          <div className="card">
            <h3>逐轴对照</h3>
            {o.comparisons.map((c) => (
              <div key={c.axis} style={{ marginBottom: 14 }}>
                <strong>{c.axis}</strong>　<span className="dim">{c.kind}</span>
                <ul>
                  {c.claims.map((x) => (
                    <li key={x.system}>
                      {SYSTEM_LABEL[x.system]}
                      {AXIS_DIRECTIONAL[c.axis]
                        ? `　${x.polarity === "中性" ? "未表态" : x.polarity}`
                        : ""}
                      　{x.evidence}
                    </li>
                  ))}
                </ul>
                <p className="dim">{KIND_NOTE[c.kind] ?? c.note}</p>
              </div>
            ))}
            <p className="dim">{o.summary}</p>
          </div>

          <div className="card">
            <h3>四柱侧</h3>
            <p>
              流日 {o.bazi.pillar.stem}{o.bazi.pillar.branch}　
              月 {o.bazi.monthPillar.stem}{o.bazi.monthPillar.branch}　
              年 {o.bazi.yearPillar.stem}{o.bazi.yearPillar.branch}
            </p>
            <p>{o.bazi.note}</p>
            {o.bazi.conflicts.length > 0 && (
              <table>
                <thead><tr><th>类型</th><th>程度</th><th>五行</th><th>涉宫</th><th>说明</th></tr></thead>
                <tbody>
                  {o.bazi.conflicts.map((c, i) => (
                    <tr key={i}>
                      <td>{c.kind}</td>
                      <td>{c.severity === "notable" ? "显著" : "轻微"}</td>
                      <td>{c.involvedElements.join("、")}</td>
                      <td>{c.affectedPalace ?? "—"}</td>
                      <td>{c.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>六爻侧</h3>
            <p>
              {o.liuyao.gua.ben.name}（{o.liuyao.gua.ben.palace}宫{o.liuyao.gua.ben.rank}）
              {o.liuyao.gua.bian === null ? "，六爻皆静" : ` → ${o.liuyao.gua.bian.name}`}
              {o.liuyao.gua.flags.length > 0 && `　${o.liuyao.gua.flags.join("、")}`}
            </p>
            <table>
              <thead><tr><th>爻</th><th>六亲</th><th>干支</th><th>世应</th><th>动静</th></tr></thead>
              <tbody>
                {[...o.liuyao.gua.yaos].reverse().map((y) => (
                  <tr key={y.pos}>
                    <td>{y.pos}</td><td>{y.liuqin}</td><td>{y.stem}{y.branch}</td>
                    <td>{y.isShi ? "世" : y.isYing ? "应" : ""}</td>
                    <td>{y.moving ? "○ 动" : y.chongState === "暗动" ? "暗动" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dim">
              日卦起在该日子时初 —— 应机之义当取首次查看的时刻，但那不可复现；
              子时初对同一日恒定，故此页可复算。
            </p>
          </div>

          <div className="card">
            <h3>指事</h3>
            <p className="dim">
              爻辞一路的说法 —— 引文。与上面的纳甲断法各说各的，不互相印证。
            </p>
            <p>
              {o.liuyao.yaoci.gua.ben.name}：{o.liuyao.yaoci.gua.ben.classic.text}
              {o.liuyao.yaoci.gua.bian !== null && (
                <>　→　{o.liuyao.yaoci.gua.bian.name}：{o.liuyao.yaoci.gua.bian.classic.text}</>
              )}
            </p>
            <table>
              <thead><tr><th>爻</th><th>位</th><th>爻辞</th><th>指事</th></tr></thead>
              <tbody>
                {o.liuyao.yaoci.picks.flatMap((pk) => [
                  <tr key={`${pk.pos}-b`}>
                    <td>{pk.pos}</td><td>{pk.role}</td>
                    <td>{pk.ben.classic.text}</td>
                    <td>{pk.ben.gist?.text ?? <span className="dim">—</span>}</td>
                  </tr>,
                  ...(pk.bian === null ? [] : [
                    <tr key={`${pk.pos}-v`}>
                      <td>{pk.pos}</td><td className="dim">变出</td>
                      <td>{pk.bian.classic.text}</td>
                      <td>{pk.bian.gist?.text ?? <span className="dim">—</span>}</td>
                    </tr>,
                  ]),
                ])}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>叙述</h3>
            <ul>{dailyNarrative(o).map((l, i) => <li key={i}>{l.text}</li>)}</ul>
          </div>
        </>
      )}
    </>
  );
}

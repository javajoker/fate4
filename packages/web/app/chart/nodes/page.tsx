"use client";

import { useMemo, useState } from "react";
import {
  buildFindings, buildSeries, findNodes, formatEvidence,
  SCALE_LABEL, type NodeScale,
  discloses, isFutureWindow, FUTURE_WITHHELD_NOTE,
} from "@fate/core";
import { useChart } from "../../../lib/chartContext";

const SCALES: readonly NodeScale[] = ["large", "medium", "small"];

const SCALE_NOTE: Readonly<Record<NodeScale, string>> = {
  large: "起运后六十年整段为基准，问的是「这在一生里有多异常」。",
  medium: "每步大运一个均值，六十年只有六个样本 —— 故用中位数与绝对中位差，样本标准差在 n=6 时会被离群的那一步自己撑大。",
  small: "基准是所在的那一步大运，问的是「这个月在本运中有多异常」。区间不跨步：跨步的两点参照的是不同基准。",
};

export default function NodesPage() {
  const { base, audience } = useChart();
  const [threshold, setThreshold] = useState(2);
  const [scale, setScale] = useState<NodeScale>("large");
  const [open, setOpen] = useState<string | null>(null);

  // 两段记忆化分开：曲线只随命盘变（约 700 ms），节点随尺度与门槛变（约 300 ms）。
  // 合成一个 useMemo 会让每次点门槛都重跑曲线，实测主线程一次卡住 1.6 秒。
  const S = useMemo(() => (base === null ? null : buildSeries(base)), [base]);
  // 节点是「指向某个时段」的输出。普通读者档只给已经过去的那些 ——
  // 与 plainCards 同一条线，同一个判据（当前年本身算当下）。
  const nowYear = new Date().getFullYear();
  const F = useMemo(() => {
    if (S === null) return null;
    // 只算当前选中的那一个尺度 —— 另外两个此刻不显示
    const set = findNodes(S, scale, { threshold });
    return { set, findings: buildFindings(S, [set]) };
  }, [S, scale, threshold]);

  if (base === null || S === null || F === null) return <p className="sub">节点计算中…</p>;
  const all = F.findings.findings;
  const enteredYear = (f: (typeof all)[number]) => {
    const v = f.detail.evidence.find((e) => e.label === "进入")?.value;
    return typeof v === "number" ? v : null;
  };
  const future = discloses(audience, "futureWindows")
    ? []
    : all.filter((f) => { const y = enteredYear(f); return y !== null && isFutureWindow(y, nowYear); });
  const shown = discloses(audience, "futureWindows")
    ? all : all.filter((f) => !future.includes(f));

  return (
    <>
      <h1>统计节点</h1>
      <p className="sub">
        本命日主 <b>{base.conclusions.dayMaster.stem}</b>（{base.conclusions.dayMaster.polarity}
        {base.conclusions.dayMaster.element}）。下列节点里，
        十神与五行的顺逆方向都是<b>相对它</b>定的 —— 同一条曲线换个日主，
        用忌就反过来了。
      </p>
      <p className="sub">
        每条曲线越过 ±{threshold.toFixed(1)} 个标准差的<b>时段</b>，基准取
        {" "}{S.statsFrom}–{S.statsTo} 年这一段本身的散布。
      </p>
      <p className="sub">
        <b>这是排序，不是概率。</b>命盘的时间序列由出生时刻完全决定，是确定性的准周期序列，
        不是从某个分布里抽出的随机样本。对它算标准差，得到的是这条序列自身的经验散布 ——
        越阈的采样点在任何一张盘上都是那么多。「本命六十年中最偏离常态的三段」成立；
        「这一年发生巨变的概率是 5%」不成立。
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0", alignItems: "center" }}>
        {SCALES.map((s) => (
          <button key={s} className={scale === s ? undefined : "ghost"} onClick={() => setScale(s)}>
            {SCALE_LABEL[s]}
          </button>
        ))}
        <span className="dim" style={{ fontSize: 13, marginLeft: 12 }}>门槛</span>
        {[1.5, 2, 2.5, 3].map((t) => (
          <button key={t} className={threshold === t ? undefined : "ghost"} onClick={() => setThreshold(t)}>
            {t.toFixed(1)}σ
          </button>
        ))}
      </div>
      <p className="sub" style={{ fontSize: 12 }}>{SCALE_NOTE[scale]}</p>
      <p className="sub" style={{ fontSize: 12 }}>
        越阈 <b>{F.set.total}</b> 段，按偏离程度列前 {shown.length} 条
        {F.set.excluded.length > 0 && <> · 另有 {F.set.excluded.length} 条序列因散布为零而不参与</>}。
        门槛是取舍旋钮，不是显著性水平 —— 序列由出生时刻完全决定，
        越阈的采样点在任何一张盘上都是那么多；调门槛改的是列出几条。
      </p>

      {future.length > 0 && (
        <div className="card" style={{ margin: "10px 0" }}>
          <p className="sub" style={{ margin: 0 }}>
            另有 <b>{future.length}</b> 段落在今年之后。{FUTURE_WITHHELD_NOTE}
          </p>
        </div>
      )}

      {shown.length === 0 && <p className="sub">此尺度下没有越过门槛的时段。</p>}

      {shown.map((f) => (
        <div key={f.id} className="card" style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span>{f.summary.text}</span>
            <button className="ghost" style={{ fontSize: 12, padding: "2px 8px" }}
              onClick={() => setOpen(open === f.id ? null : f.id)}>
              {open === f.id ? "收起" : "查看依据"}
            </button>
          </div>

          {open === f.id && (
            <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              {f.detail.narrative.map((l, i) => (
                <p key={i} className="sub" style={{ fontSize: 13 }}>{l.text}</p>
              ))}
              <table style={{ marginTop: 8 }}>
                <thead>
                  <tr><th>证据</th><th>取值</th><th>出处</th></tr>
                </thead>
                <tbody>
                  {f.detail.evidence.map((e, i) => (
                    <tr key={i}>
                      <td>{e.label}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {formatEvidence(e)}
                      </td>
                      <td className="dim" style={{ fontSize: 12 }}>{e.ref}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {f.guidance.map((g, i) => (
                <p key={i} className="sub" style={{ fontSize: 13, marginTop: 10 }}>{g.line.text}</p>
              ))}
            </div>
          )}
        </div>
      ))}

      {F.findings.guidanceEmptyNote !== null && (
        <p className="sub">{F.findings.guidanceEmptyNote.text}</p>
      )}

      <p className="sub" style={{ fontSize: 12, marginTop: 18 }}>
        摘要里出现的每个数字，都能在展开层的证据表里找到同一个值 —— 这一条由内核在构建期强制。
        分两层写的报告有一种特有的失真：摘要说一件事、展开说另一件，而读者通常只看一层。
      </p>
    </>
  );
}

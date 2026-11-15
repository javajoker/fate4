"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildFindings, buildSeries, scanNodes, formatEvidence,
  SCALE_LABEL, NODE_ORDER_LABEL, type NodeScale, type NodeOrder,
  discloses, isFutureWindow, FUTURE_WITHHELD_NOTE,
} from "@fate/core";
import { useChart } from "../../../lib/chartContext";

const SCALES: readonly NodeScale[] = ["large", "medium", "small"];
const ORDERS: readonly NodeOrder[] = ["deviation", "time"];

/**
 * 基准窗固定为起运后 60 年，**不随跨度变**；跨度只决定扫多远。
 * 说明里要把这两件事分开写，否则切到 120 / 180 年时读者会以为尺子也换了。
 */
const scaleNote = (span: number): Readonly<Record<NodeScale, string>> => ({
  large: "起运后 60 年整段为基准，问的是「这在这 60 年里有多异常」。"
    + (span > 60
      ? `跨度 ${span} 年，基准窗之外的年份也被扫描，用的是同一把尺子；`
        + "它们超出了任何人的寿数，反映的是这套方法本身的结构。"
      : ""),
  medium: "每步大运一个均值，基准是起运后 60 年的那 6 步 —— 故用中位数与绝对中位差，样本标准差在 n=6 时会被离群的那一步自己撑大。"
    + (span > 60 ? `跨度 ${span} 年时后面的步也被扫描，同样用头 6 步的尺子。` : ""),
  small: "基准是所在的那一步大运，问的是「这个月在本运中有多异常」。区间不跨步：跨步的两点参照的是不同基准。"
    + (span > 60 ? "这一尺度的基准是那一步自己，与那 60 年无关，所以窗外的步各用各的。" : ""),
});

export default function NodesPage() {
  const { base, spanBase, span, audience } = useChart();
  const [threshold, setThreshold] = useState(2);
  const [scale, setScale] = useState<NodeScale>("large");
  const [open, setOpen] = useState<string | null>(null);

  // 两段记忆化分开：曲线只随命盘变（约 700 ms），节点随尺度与门槛变（约 300 ms）。
  // 合成一个 useMemo 会让每次点门槛都重跑曲线，实测主线程一次卡住 1.6 秒。
  // 扫描覆盖整个跨度，基准窗仍是起运后 60 年：μ 与 σ 不随跨度变
  const S = useMemo(
    () => (spanBase === null ? null : buildSeries(spanBase, { years: span })),
    [spanBase, span]);
  // 节点是「指向某个时段」的输出。普通读者档只给已经过去的那些 ——
  // 与 plainCards 同一条线，同一个判据（当前年本身算当下）。
  const nowYear = new Date().getFullYear();
  const withhold = !discloses(audience, "futureWindows");

  // 扫描一次，之后翻页、换排序都不重扫。只算当前选中的那一个尺度 ——
  // 另外两个此刻不显示（每个约 300 ms，120 / 180 年更久）。
  const scan = useMemo(
    () => (S === null ? null : scanNodes(S, scale, { threshold })),
    [S, scale, threshold]);

  // 「略去未到来的」必须在排序与切页**之前**做：先切页再略去，
  // 一页 12 条里略去 5 条，读者看到的是一页 7 条，总页数还按没略去的算。
  const filter = useMemo(
    () => (withhold ? (n: { enter: { year: number } }) => !isFutureWindow(n.enter.year, nowYear) : undefined),
    [withhold, nowYear]);

  const [order, setOrder] = useState<NodeOrder>("deviation");
  const [page, setPage] = useState(0);
  // 换尺度、门槛、排序、跨度、读者档，页码都回到第一页 —— 旧页码指向的已是另一份清单
  useEffect(() => { setPage(0); setOpen(null); }, [scale, threshold, order, span, withhold]);

  const size = S?.base.params.nodes.maxShown ?? 12;
  const matched = scan === null ? 0 : scan.count(filter);
  const pages = Math.max(1, Math.ceil(matched / size));
  const pageIdx = Math.min(page, pages - 1);

  // 只给当前这一页生成依据（每条约 4 ms）；翻回来的页内核有缓存
  const F = useMemo(() => {
    if (S === null || scan === null) return null;
    const set = scan.page({ order, offset: pageIdx * size, size, ...(filter === undefined ? {} : { filter }) });
    return { set, findings: buildFindings(S, [set]) };
  }, [S, scan, order, pageIdx, size, filter]);

  if (base === null || S === null || scan === null || F === null) {
    return <p className="sub">节点计算中…</p>;
  }
  const shown = F.findings.findings;
  const withheldCount = scan.total - matched;
  const from = matched === 0 ? 0 : pageIdx * size + 1;
  const to = pageIdx * size + shown.length;

  /** 页码条 —— 顶上与底下各一条，翻到底不必滚回去 */
  const Pager = () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "10px 0" }}>
      <button className="ghost" disabled={pageIdx === 0} onClick={() => setPage(pageIdx - 1)}>‹ 上一页</button>
      <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
        第
        <select value={pageIdx} onChange={(e) => setPage(Number(e.target.value))}>
          {Array.from({ length: pages }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
        </select>
        / {pages} 页
      </label>
      <button className="ghost" disabled={pageIdx >= pages - 1} onClick={() => setPage(pageIdx + 1)}>下一页 ›</button>
      <span className="dim" style={{ fontSize: 12 }}>
        本页第 {from}–{to} 条，共 {matched} 条
      </span>
    </div>
  );

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
        {" "}{S.statsFrom}–{S.statsTo} 年这 60 年的散布。
        时间跨度是 {span} 年：{span > 60
          ? "基准窗之外的年份也被扫描，用的是同一把尺子 —— 所以同一年的 z 分数在 60 / 120 / 180 年下相同，只是看得更远。"
          : "与基准窗一样长。切到 120 / 180 年可看窗外的年份，尺子不变。"}
      </p>
      <p className="sub">
        <b>这是排序，不是概率。</b>命盘的时间序列由出生时刻完全决定，是确定性的准周期序列，
        不是从某个分布里抽出的随机样本。对它算标准差，得到的是这条序列自身的经验散布 ——
        越阈的采样点在任何一张盘上都是那么多。「本命这一段里最偏离常态的三段」成立；
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
        <span className="dim" style={{ fontSize: 13, marginLeft: 12 }}>排序</span>
        {ORDERS.map((o) => (
          <button key={o} className={order === o ? undefined : "ghost"} onClick={() => setOrder(o)}>
            {NODE_ORDER_LABEL[o]}
          </button>
        ))}
      </div>
      <p className="sub" style={{ fontSize: 12 }}>{scaleNote(span)[scale]}</p>
      <p className="sub" style={{ fontSize: 12 }}>
        越阈 <b>{scan.total}</b> 段，{NODE_ORDER_LABEL[order]}，每页 {size} 条
        {F.set.excluded.length > 0 && <> · 另有 {F.set.excluded.length} 条序列因散布为零而不参与</>}。
        {order === "deviation"
          ? "偏离程度 = 峰值偏离的绝对值，大者在前。"
          : "年份先后 = 进入那一刻，早者在前；同一时刻进入的，偏离大的在前。"}
        门槛是取舍旋钮，不是显著性水平 —— 序列由出生时刻完全决定，
        越阈的采样点在任何一张盘上都是那么多；调门槛改的是列出几条。
      </p>

      {withheldCount > 0 && (
        <div className="card" style={{ margin: "10px 0" }}>
          <p className="sub" style={{ margin: 0 }}>
            另有 <b>{withheldCount}</b> 段落在今年之后。{FUTURE_WITHHELD_NOTE}
          </p>
        </div>
      )}

      {matched === 0 && <p className="sub">此尺度下没有越过门槛的时段。</p>}

      {matched > size && <Pager />}

      {shown.map((f, i) => (
        <div key={f.id} className="card" style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="dim mono" style={{ fontSize: 12, minWidth: "2.2em" }}>
              {pageIdx * size + i + 1}
            </span>
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

      {matched > size && <Pager />}

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

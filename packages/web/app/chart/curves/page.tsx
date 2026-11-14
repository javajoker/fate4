"use client";

import { useMemo, useState } from "react";
import {
  buildSeries, curveStats, evaluateAt, buildChart, buildBaseChart,
  chartOptionsOf, loadParams, precisionBandOf,
} from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { LifeCurves } from "../../../components/charts";
import { num, pillarText } from "../../../lib/format";

/**
 * 可选的绘制跨度。
 *
 * ## 为什么换跨度要连大运一起换
 *
 * 大运的柱数由 `temporal.luckPillarCount` 定，默认 12 柱 = 120 年。
 * 若只把绘制年数拉到 180 而不加柱，**最后六十年根本没有大运那一层** ——
 * 曲线照画，但它少了一整层，而那个断口看起来像一个真实的转折。
 * 实测：180 年里有三分之一的帧 `luckPillar === null`。
 *
 * 故每一档都带上它需要的柱数：跨度 N 年要 ⌈N/10⌉ 柱。
 *
 * ## σ 的基准窗**不随跨度变**
 *
 * `series.spanYears` 恒为 60，`buildSeries` 里取 `min(spanYears, years)`。
 * 这是对的，而且重要：若基准窗跟着跨度走，同一年的 z 分数就会随
 * **你把滑块拖到哪里**而变 —— 一个节点会因为显示选择而出现或消失。
 * 统计节点必须是盘的性质，不是界面状态的函数。
 */
const SPANS: readonly { readonly years: number; readonly pillars: number;
  readonly label: string }[] = [
  { years: 60, pillars: 6, label: "60 年" },
  { years: 120, pillars: 12, label: "120 年" },
  { years: 180, pillars: 18, label: "180 年" },
];

const GROUPS: readonly [string, string][] = [
  ["tenGod", "十神"], ["element", "五行"], ["palace", "宫位"],
  ["dayMaster", "日主"], ["innerOuter", "内外"], ["domain", "域"],
  ["metric", "综合"], ["agitation", "扰动"],
];

export default function CurvesPage() {
  const { base, record, params: ctxParams } = useChart();
  const [span, setSpan] = useState(60);
  const [group, setGroup] = useState("tenGod");
  const [sel, setSel] = useState<readonly string[] | null>(null); // null = 全部
  const [picked, setPicked] = useState<number | null>(null);
  const [mode, setMode] = useState<"sigma" | "weight">("sigma");
  const [threshold, setThreshold] = useState(2);
  const [density, setDensity] = useState<"year" | "month">("year");

  const spanDef = SPANS.find((x) => x.years === span) ?? SPANS[0]!;

  /**
   * 跨度超过默认柱数能覆盖的范围时，**另建一份带足够大运柱的基础盘**。
   * 不改全局参数 —— 那会连带改掉大运页、报告与节点页的范围，
   * 而用户只是想把这一张图拉长。
   */
  const spanBase = useMemo(() => {
    if (base === null || record === null) return base;
    if (spanDef.pillars <= ctxParams.temporal.luckPillarCount) return base;
    const p = loadParams({
      ...ctxParams, temporal: { luckPillarCount: spanDef.pillars },
    } as never);
    try {
      return buildBaseChart(buildChart(record.input, chartOptionsOf(p)), p);
    } catch { return base; }
  }, [base, record, ctxParams, spanDef.pillars]);

  const S = useMemo(
    () => (spanBase === null ? null : buildSeries(spanBase, { years: span })),
    [spanBase, span]);

  // 取点处的即时盘 —— 神煞与结构事件由它来，解释曲线为何在此处变化
  const atFrame = useMemo(() => {
    if (spanBase === null || S === null || picked === null) return null;
    const f = S.frames[picked];
    if (f === undefined) return null;
    return {
      f,
      ev: evaluateAt(spanBase, {
        luck: f.luckPillar === null ? null
          : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
        annual: f.annual, fleetingMonth: f.fleetingMonth,
      }),
    };
  }, [spanBase, S, picked]);

  if (base === null || spanBase === null || S === null) {
    return <p className="sub">曲线计算中…</p>;
  }

  const lastYear = S.frames[S.frames.length - 1]!.year;
  const lastAge = Math.round(lastYear - spanBase.chart.input.year);
  const band = precisionBandOf(lastYear);

  // 本命日主 —— 五行曲线里哪一条是「自己」，不标出来就得靠读者自己数
  const dm = spanBase.conclusions.dayMaster;
  const inGroup = S.series.filter((s) => s.kind === group);
  const shown = sel === null ? inGroup : inGroup.filter((s) => sel.includes(s.id));

  // 采样密度。月度 720 点压在 860px 上是一把梳子 —— 那些锯齿是立春换柱的真实阶跃
  // （权重类序列在立春年内近乎恒定），数据没错，可读性却没了。
  // 故默认按年抽首点；要看年内的推移再切回月度。
  const keep = density === "year"
    ? S.frames.map((f, i) => ({ f, i }))
      .filter(({ f, i }) => i === 0 || S.frames[i - 1]!.year !== f.year)
      .map(({ i }) => i)
    : S.frames.map((_, i) => i);

  const specs = shown.map((s) => {
    const st = curveStats(S, s);
    return {
      id: s.id, label: s.label,
      values: keep.map((i) => s.values[i]!),
      center: st.center, sigma: st.sigma,
    };
  });
  // picked 是**帧下标**（S.frames 里的位置），而图上的横坐标是抽稀之后的下标 ——
  // 按年采样时两者差十二倍。两处都要经 keep 换算，否则标记线画错位置、
  // 取点面板干脆出不来。
  const markIndex = picked === null ? -1 : keep.indexOf(picked);
  const years = keep.map((i) => S.frames[i]!.year);
  const breaks = keep
    .map((i, k) => ({ i, k }))
    .filter(({ i, k }) => k > 0 && S.frames[i]!.luckIndex !== S.frames[keep[k - 1]!]!.luckIndex)
    .map(({ k }) => k);

  const toggle = (id: string) => {
    const cur = sel ?? inGroup.map((s) => s.id);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setSel(next.length === inGroup.length ? null : next);
  };

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
        <b>本命日主 {dm.stem}</b> —— {dm.polarity}{dm.element}，
        基础盘权重 {num(dm.weight, 1)}。五行一组里，
        <b>{dm.element}</b> 那一条就是「自己」这一路；
        其余四行相对它才有生我、我生、克我、我克之分。
        十神一组里的<b>比肩</b>与<b>劫财</b>同属{dm.element}，是同一路的两个面。
      </p>
      <p className="sub">
        <b>流月不参与权重。</b>月度上之所以有变化，是大运份额在推移，不是流月加了分。
        流月只进符号层：它在扰动序列里，不在权重序列里。
      </p>

      {span > 60 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 14.5, marginBottom: 6 }}>
            拉到 {span} 年之后，这张图在画什么
          </h3>
          <p className="sub">
            <strong>它不再是「一生」。</strong>这张盘上第 {lastAge} 岁那一端，
            没有人活到那里。超过百岁之后，曲线显示的是<strong>这套方法本身的结构</strong> ——
            大运十年一柱地推下去、流年六十年一轮回 —— 而不是一个人。
          </p>
          <p className="sub">
            看长跨度有一个正当用处：<strong>看出周期</strong>。
            流年是六十年一个整轮，大运是十年一步；
            拉到 120 或 180 年，这两个周期的叠合关系才显出来，
            而 60 年只够看见其中一轮。
          </p>
          <p className="sub">
            <strong>σ 的基准窗仍是头 60 年，不随跨度变。</strong>
            若基准跟着跨度走，同一年的 z 分数就会随你把跨度拖到哪里而变 ——
            一个节点会因为显示选择而出现或消失。那不该发生：
            统计节点是盘的性质，不是界面状态的函数。
          </p>
          <p className="sub">
            大运柱数也跟着加到 {spanDef.pillars} 柱。
            不加的话最后那几十年<strong>根本没有大运这一层</strong>，
            曲线照画，而那个断口看起来像一个真实的转折。
          </p>
          {band !== "guaranteed" && (
            <p className="sub">
              ⚠️ 这张图算到 <span className="mono">{lastYear}</span> 年
              {band === "beyondSpan"
                ? "，已超出本引擎声明并测试过的跨度（至 2100 年）。"
                : "，已越过本引擎承诺 60 秒节气容差的上界（2050 年）。"}
              {" "}受影响的只是「换柱的那一刻」—— 整年整月的柱走六十甲子定序推进，
              与节气时刻无关，不因此改变。曲线的形状不受影响。
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
        {GROUPS.map(([k, name]) => (
          <button key={k} className={group === k ? undefined : "ghost"}
            onClick={() => { setGroup(k); setSel(null); }}>
            {name}（{S.series.filter((s) => s.kind === k).length}）
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            纵轴
            <select value={mode} onChange={(e) => setMode(e.target.value as "sigma" | "weight")}>
              <option value="sigma">σ 对齐（各条各按自己的常态换算）</option>
              <option value="weight">权重对齐（同一把尺，看谁大谁小）</option>
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            跨度
            <select value={span} onChange={(e) => {
              setSpan(Number(e.target.value)); setPicked(null);
            }}>
              {SPANS.map((x) => (
                <option key={x.years} value={x.years}>
                  {x.label}（{x.pillars} 柱大运）
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            采样
            <select value={density}
              onChange={(e) => setDensity(e.target.value as "year" | "month")}>
              <option value="year">按年（{span} 点，看形状）</option>
              <option value="month">按月（{S.frames.length} 点，看年内推移）</option>
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            门槛
            <select value={threshold} disabled={mode !== "sigma"}
              onChange={(e) => setThreshold(Number(e.target.value))}>
              <option value={1.5}>±1.5σ</option>
              <option value={2}>±2σ</option>
              <option value={2.5}>±2.5σ</option>
              <option value={3}>±3σ</option>
            </select>
          </label>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="ghost" onClick={() => setSel(null)}>全选</button>
            <button className="ghost" onClick={() => setSel([])}>清空</button>
          </span>
        </div>
        <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>
          σ 对齐时全部曲线共用同一条 ±θσ 界线，穿越点一眼可读；
          权重对齐时不画界线 —— 各条的 σ 不同，画出来是若干条不同高度的横线，
          除了糊成一片没有别的作用。
          μ 与 σ 取自与<b>节点层同一个估计量</b>（按<b>月度全样本</b>算，
          与采样密度无关），故图上的穿越点与 §6.5 列出的节点对得上。
          按年采样只是抽稀了画的点，没有换一把尺子。
          月度视图里那些锯齿是<b>立春换柱的真实阶跃</b> —— 权重类序列在一个立春年内
          近乎恒定，跳变都发生在换柱那一刻。
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {inGroup.map((s) => {
          const on = sel === null || sel.includes(s.id);
          const isSelf = s.id === `element.${dm.element}`;
          return (
            <button key={s.id} className={on ? undefined : "ghost"}
              style={{ fontSize: 12, padding: "3px 9px" }}
              title={isSelf ? "日主所属五行 —— 这一条就是「自己」" : undefined}
              onClick={() => toggle(s.id)}>
              {s.label}{isSelf ? "（本命）" : ""}
            </button>
          );
        })}
      </div>

      {specs.length === 0 ? <p className="sub">未选中任何曲线。</p> : (
        <LifeCurves
          series={specs} years={years} luckBreaks={breaks}
          mode={mode} threshold={threshold}
          {...(markIndex < 0 ? {} : { mark: markIndex })}
          onPick={(k) => setPicked(keep[k] ?? null)}
        />
      )}

      {atFrame !== null && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3>
            {atFrame.f.year} 年 · {"寅卯辰巳午未申酉戌亥子丑"[atFrame.f.monthIndex]}月
            　<span className="sub" style={{ fontSize: 12 }}>
              流年 {pillarText(atFrame.f.annual)}
              {atFrame.f.luckPillar === null ? "" : `　大运 ${pillarText(atFrame.f.luckPillar)}`}
              　流月 {pillarText(atFrame.f.fleetingMonth)}
            </span>
          </h3>
          <p className="sub" style={{ fontSize: 12 }}>
            曲线为何在此处变化 —— 神煞与结构事件是<b>解释</b>，不参与检出：
            曲线说「这里变了」，它们说「大概是因为这个」。
          </p>

          <h4 style={{ fontSize: 13, margin: "10px 0 4px" }}>此刻被引动的神煞</h4>
          {atFrame.ev.shensha.filter((h) => h.tone === "activated").length === 0
            ? <p className="sub">无。</p>
            : (
              <ul className="tight">
                {atFrame.ev.shensha.filter((h) => h.tone === "activated").map((h) => (
                  <li key={`${h.name}-${h.palace}-${h.basis}`}>
                    <b>{h.name}</b> 落{h.palace}　{h.toneReason}
                    {h.narrativeTags.length === 0 ? ""
                      : `　—— 传统上与「${h.narrativeTags.join("、")}」一类的事相联系`}
                  </li>
                ))}
              </ul>
            )}

          <h4 style={{ fontSize: 13, margin: "12px 0 4px" }}>牵动大运流年的结构事件</h4>
          {atFrame.ev.events.filter(
            (e) => e.pillars.includes("luck") || e.pillars.includes("annual")).length === 0
            ? <p className="sub">无。</p>
            : (
              <ul className="tight">
                {atFrame.ev.events
                  .filter((e) => e.pillars.includes("luck") || e.pillars.includes("annual"))
                  .map((e, i) => (
                    <li key={`${e.narrativeTag}-${i}`}>
                      {e.narrativeTag}　<span className="sub">（{e.pillars.join("、")}）</span>
                    </li>
                  ))}
              </ul>
            )}
        </div>
      )}

      {atFrame !== null && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3>此刻的权重　<span className="sub" style={{ fontSize: 12 }}>
            {atFrame.f.year} 年 {atFrame.f.fleetingMonth.branch}月
          </span></h3>
          <div className="scroll">
            <table>
              <thead><tr>
                <th>序列</th><th className="num">此刻</th>
                <th className="num">基础盘</th><th className="num">差</th>
              </tr></thead>
              <tbody>
                {inGroup.map((s) => (
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
            <p className="sub" style={{ fontSize: 12 }}>
              ⚠️ 「差」这一列里大半是大运流年带来的<b>新质量</b>，不是净增长：
              基础盘总量约 435，加上大运流年约 696，涨了六成。
              要说「较本命高出多少」，得看去过稀释的份额偏离，不是这一列。
            </p>
          )}
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>
        {GROUPS.find(([k]) => k === group)?.[1] ?? group}的全部序列
      </h2>
      <div className="scroll">
        <table>
          <thead><tr>
            <th>序列</th><th className="num">基础盘</th><th className="num">最小</th>
            <th className="num">中位</th><th className="num">最大</th>
            <th className="num">μ</th><th className="num">σ</th><th>用忌</th>
          </tr></thead>
          <tbody>
            {inGroup.map((s) => {
              const sorted = [...s.values].sort((a, b) => a - b);
              const st = curveStats(S, s);
              return (
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td className="num">{num(s.baseValue, 2)}</td>
                  <td className="num">{num(sorted[0]!, 2)}</td>
                  <td className="num">{num(sorted[Math.floor(sorted.length / 2)]!, 2)}</td>
                  <td className="num">{num(sorted[sorted.length - 1]!, 2)}</td>
                  <td className="num">{num(st.center, 2)}</td>
                  <td className="num">{num(st.sigma, 2)}</td>
                  <td className="sub">
                    {s.polarity === "favorable" ? "用神向"
                      : s.polarity === "adverse" ? "忌神向" : "不判方向"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sub" style={{ fontSize: 12 }}>
        μ 与 σ 即图上 ±θσ 界线所依的那两个量，按<b>统计窗内的月度全样本</b>算。
        域张力<b>恒不判方向</b> —— 张力本身就是「顺逆并存」的度量，给它定吉凶
        等于把已经拆开的东西又合回去。宫位权重同理，只报「该宫变动」。
      </p>

      <p className="sub" style={{ fontSize: 12, marginTop: 14 }}>
        点击图上任意位置可取该时点，下方随即列出当时的神煞与结构事件。
        曲线用 Catmull-Rom 平滑 —— 采样是月度的，而底下的量本就连续，
        折线会把每个采样点画成拐点，那是采样的伪影，不是数据的性质。
      </p>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  buildSeries, curveStats, evaluateAt, buildChart, buildBaseChart,
  chartOptionsOf, loadParams, precisionBandOf, thresholdCrossings,
} from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { LifeCurves, type CurveWindow } from "../../../components/charts";
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

/** 可开关的面板。顺序即并排时右栏的堆叠顺序。 */
const PANELS: readonly (readonly [string, string])[] = [
  ["cross", "±σ 交点"], ["reason", "该时点的神煞与结构"],
  ["weights", "该时点的权重"], ["stats", "全部序列统计"], ["notes", "说明文字"],
];

export default function CurvesPage() {
  const { base, record, params: ctxParams } = useChart();
  const [span, setSpan] = useState(60);
  // 取景窗。null = 全幅。下标在**抽稀之后**那个空间里，与 keep 同一口径。
  const [win, setWin] = useState<CurveWindow | null>(null);
  const [group, setGroup] = useState("tenGod");
  const [sel, setSel] = useState<readonly string[] | null>(null); // null = 全部
  const [picked, setPicked] = useState<number | null>(null);
  const [mode, setMode] = useState<"sigma" | "weight">("sigma");
  const [threshold, setThreshold] = useState(2);
  const [density, setDensity] = useState<"year" | "month">("year");
  /**
   * 哪几块面板出，以及图与表是上下还是并排。
   *
   * 这一页本来是一条长栏：图、交点表、神煞、权重、全序列统计，一路往下。
   * 每一块单独看都有用，合起来的后果是**图与你正在读的那张表永远不在同一屏** ——
   * 点一行跳到某个时点，再滚回去看图，图上那条标记线早已滚出视野。
   *
   * 所以给两个开关：出哪几块，以及要不要并排。默认全出、单列 —— 与原先一致，
   * 不替读者决定他该看什么。
   */
  const [panels, setPanels] = useState<readonly string[]>(
    () => PANELS.map(([k]) => k));
  const [layout, setLayout] = useState<"stack" | "split">("stack");
  const on = (k: string) => panels.includes(k);
  const flip = (k: string) => setPanels((cur) =>
    cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);

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
  /** 与 ±θσ 的交点。只算选中的序列，并跟随当前取景窗。 */
  const crossings = shown.flatMap((sr) => thresholdCrossings(
    S, sr, threshold,
    win === null ? undefined : { from: keep[win.from]!, to: keep[win.to]! },
  )).sort((a, b) => a.enter.year - b.enter.year
    || a.enter.monthIndex - b.enter.monthIndex);

  /** 时间文本。⚠️ 月序不携带信息时只写年 —— 见表下那段说明。 */
  /**
   * 交点报到**日**。
   *
   * 这一列与「穿入 / 穿出」那两列说的不是同一件事，所以分开放：
   * 那两列是**采样点**（权重类只到年，见下方说明），这一列是交点本身那一刻。
   * 四种来历的「日」是四种不同的东西，故一律把来历与误差半径一起给出 ——
   * 一个不带来历的日期，读者没法知道它是算出来的还是插出来的。
   */
  const BASIS_TEXT: Record<string, string> = {
    pillarStep: "换柱",
    jieStep: "交节",
    chord: "插值",
    interval: "区间内",
  };
  const uncText = (d: number) =>
    d < 1 / 1440 ? "秒级"
      : d < 1 / 24 ? `±${Math.round(d * 1440)} 分`
        : d < 1 ? `±${(d * 24).toFixed(1)} 时`
          : `±${d.toFixed(1)} 日`;
  const dayText = (at: { year: number; month: number; day: number } | null) =>
    at === null ? null : `${at.year}-${String(at.month).padStart(2, "0")}-${String(at.day).padStart(2, "0")}`;

  const timeText = (mk: { year: number; monthIndex: number }, resolved: boolean) =>
    resolved ? `${mk.year} 年 ${"寅卯辰巳午未申酉戌亥子丑"[mk.monthIndex]}月` : `${mk.year} 年`;

  /** 表里的时刻 → 帧下标，供点行跳转。 */
  const frameIndexOf = (mk: { year: number; monthIndex: number }) =>
    S.frames.findIndex((f) => f.year === mk.year && f.monthIndex === mk.monthIndex);

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
      {!on("notes") ? (
        <p className="sub">
          以基础盘为固定基准，按月采样 {S.frames.length} 点（{S.statsFrom}–{S.statsTo}）。
          本命日主 <b>{dm.stem}</b>（{dm.polarity}{dm.element}）。
          <span className="dim">　说明文字已收起。</span>
        </p>
      ) : (<>
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
      </>)}

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
              // ⚠️ 跨度一变，抽稀之后的下标空间就变了 —— 旧窗口的下标
              // 指向的是另一段时间。必须清掉，不能留着「看起来还能用」。
              setSpan(Number(e.target.value)); setPicked(null); setWin(null);
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
              onChange={(e) => {
                // 同上：按年与按月的下标相差十二倍
                setDensity(e.target.value as "year" | "month");
                setPicked(null); setWin(null);
              }}>
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
        {on("notes") && (
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
        )}
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

      <div className="panelbar">
        <span className="label">面板</span>
        {PANELS.map(([k, name]) => (
          <button key={k} className={on(k) ? undefined : "ghost"}
            aria-pressed={on(k)} onClick={() => flip(k)}>{name}</button>
        ))}
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <button className={layout === "split" ? undefined : "ghost"}
            aria-pressed={layout === "split"}
            onClick={() => setLayout(layout === "split" ? "stack" : "split")}>
            图表并排
          </button>
          <button className="ghost" onClick={() => {
            setPanels(["cross"]); setLayout("split");
          }}>只看图与交点</button>
          <button className="ghost" onClick={() => {
            setPanels(PANELS.map(([k]) => k)); setLayout("stack");
          }}>还原</button>
        </span>
      </div>

      <div className={layout === "split" ? "split" : undefined}>
      <div className={layout === "split" ? "split-chart" : undefined}>
      {specs.length === 0 ? <p className="sub">未选中任何曲线。</p> : (
        <>
          <LifeCurves
            series={specs} years={years} luckBreaks={breaks}
            mode={mode} threshold={threshold}
            {...(markIndex < 0 ? {} : { mark: markIndex })}
            onPick={(k) => setPicked(keep[k] ?? null)}
            window={win} onWindow={setWin}
          />
          <div className="zoombar">
            <span className="dim">
              {win === null
                ? "在图上横向拖一段即可放大；拖不足三格算点选。"
                : `当前窗口 ${years[win.from]}–${years[win.to]} 年（共 ${
                  years[win.to]! - years[win.from]! + 1} 年）`}
            </span>
            {/* 全幅里的位置。缩进去之后不给这一条，人会不知道自己在哪儿 */}
            <svg className="zoommini" viewBox="0 0 200 10" preserveAspectRatio="none"
              role="img" aria-label="当前窗口在全幅中的位置">
              <rect x={0} y={3} width={200} height={4} fill="var(--surface-2)" />
              <rect y={3} height={4} fill="var(--accent)" opacity={0.55}
                x={win === null ? 0 : (win.from / Math.max(1, years.length - 1)) * 200}
                width={win === null ? 200
                  : Math.max(2, ((win.to - win.from) / Math.max(1, years.length - 1)) * 200)} />
            </svg>
            <button className="ghost" disabled={win === null}
              onClick={() => setWin(null)}>全幅</button>
          </div>
          {on("notes") && (
          <p className="sub" style={{ marginTop: 6 }}>
            <strong>放大只改横轴。</strong>纵轴按全幅算，不随窗口变 ——
            否则同一个 z 值会因为你缩放到哪里而落在不同高度，
            而「纵向位置 = 离这条序列自己的常态有多远」这个意思就没了。
            缩进一段平静的时期线会接近平直，那是实情。
          </p>
          )}
        </>
      )}
      </div>

      <div>
      {specs.length > 0 && on("cross") && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>
            与 ±{threshold}σ 的交点
            {win !== null && (
              <span className="dim" style={{ fontSize: 12, fontWeight: 400 }}>
                　（只看当前窗口 {years[win.from]}–{years[win.to]}）
              </span>
            )}
          </h3>
          <p className="sub">
            曲线穿出那两条虚线的时刻。<strong>相邻的穿越并成一段</strong> ——
            一条在门槛附近摆动的曲线能穿出几十个交点，逐个都真，
            合起来却什么也说不出；并成一段之后，两个端点正是穿入与穿出的那两个交点。
          </p>
          {crossings.length === 0 ? (
            <p className="sub">
              选中的曲线在这一段里<strong>没有越过 ±{threshold}σ</strong>。
              那不是「没事」—— 是这几条在这段时间里都待在自己的常态范围内。
            </p>
          ) : (
            <div className="scroll crosstable">
              <table>
                <thead>
                  <tr>
                    <th>序列</th><th>方向</th><th>穿入</th><th>穿出</th>
                    <th>穿入那一日</th><th>来历</th>
                    <th style={{ textAlign: "right" }}>峰值 z</th><th>用意</th>
                  </tr>
                </thead>
                <tbody>
                  {crossings.map((c, k) => (
                    <tr key={`${c.seriesId}-${k}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => setPicked(frameIndexOf(c.peak))}>
                      <td>{c.label}</td>
                      <td>{c.sign > 0 ? `高于 +${threshold}σ` : `低于 −${threshold}σ`}</td>
                      <td className="mono">{timeText(c.enter, c.monthResolved)}</td>
                      <td className="mono">
                        {c.exit === null
                          ? <span className="dim">到末尾仍未回</span>
                          : !c.monthResolved && c.exit.year === c.enter.year
                            ? `${c.exit.year} 年内`
                            : timeText(c.exit, c.monthResolved)}
                      </td>
                      <td className="mono">
                        {c.enterAt === null
                          ? <span className="dim">在窗口之前</span>
                          : dayText(c.enterAt)}
                      </td>
                      <td className="dim" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {c.enterAt === null ? "—"
                          : `${BASIS_TEXT[c.enterAt.basis] ?? c.enterAt.basis}　${uncText(c.enterAt.uncertaintyDays)}`}
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {c.peakZ > 0 ? `+${c.peakZ.toFixed(2)}` : c.peakZ.toFixed(2)}
                      </td>
                      <td className="dim">
                        {c.polarity === "favorable" ? "用神向"
                          : c.polarity === "adverse" ? "忌神向" : "不判方向"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {on("notes") && (<>
          <p className="sub" style={{ marginTop: 10 }}>
            <strong>「穿入那一日」与左边那两列不是同一件事。</strong>
            左边报的是<strong>采样点</strong>（权重类只到年，见下）；
            这一列报的是<strong>交点本身那一刻</strong>。
            要把它定到日，就得先回答「两个采样点之间曲线是什么」——
            图上画的是直线，而那条直线是<strong>画出来的，不是算出来的</strong>。
            真正的形状有四种，对应四种完全不同的「日」，所以每一行都把来历摆出来：
          </p>
          <div className="scroll">
            <table>
              <thead><tr><th>来历</th><th>这一刻由什么定</th><th>误差来自哪里</th></tr></thead>
              <tbody>
                <tr>
                  <td className="mono">换柱</td>
                  <td>立春，或大运换柱那一刻 —— 曲线在那里是<strong>真的阶跃</strong></td>
                  <td>节气求解容差（60 秒）；大运边界按构造精确</td>
                </tr>
                <tr>
                  <td className="mono">交节</td>
                  <td>流月换支那一刻，即那个<strong>节</strong>（只有扰动类吃流月）</td>
                  <td>同上，60 秒</td>
                </tr>
                <tr>
                  <td className="mono">插值</td>
                  <td>运内斜坡：两采样连线与门槛的交点</td>
                  <td>曲线偏离那条弦的程度，逐行现算</td>
                </tr>
                <tr>
                  <td className="mono">区间内</td>
                  <td><strong>定不出来</strong>：区间里确有跳变，但没有可归因的边界</td>
                  <td>半个采样间隔，约 15 日</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="sub">
            <strong>「交节」为什么不直接取采样点那一天。</strong>
            采样点是「立春 + m × 30.44 日」——<strong>回归年的等分，不是真节</strong>。
            实测 1960–2060 共 252 个节，等分与真节相差
            <strong>中位 0.96 日、最大 3.00 日</strong>（寒露），
            而且是系统性的：立春处为零，春季偏正，寒露偏负近三日，再回零 ——
            来历是地球轨道偏心，近日点附近太阳走得快，等时长的格子装不下等黄经的月。
            报到月时这三天看不见；报到日时它就是全部误差。所以这一列去解真节。
          </p>
          <p className="sub">
            <strong>⚠️ 「穿入 2008 年」旁边却写着 2008-08-07，这不是自相矛盾。</strong>
            左边那一列只报到年，理由是<strong>采样网格的月不携带信息</strong> ——
            权重类在一个立春年内只有大运斜坡在动，拿网格的月当证据是伪精度。
            但这一行的交点落在<strong>大运换柱</strong>那一刻，
            而那一刻是算出来的、精确到秒的，不是从网格上读的。
            所以它比年更精确，而且不违反那条规矩：
            那条规矩从来不是「真相只到年」，而是<strong>「网格的月不算证据」</strong>。
            凡是来历写着「换柱」或「交节」的行，日期都不出自网格。
          </p>
          <p className="sub">
            <strong>「插值」那几行为什么敢给到分钟。</strong>
            因为运内权重<strong>对时间是线性的</strong>——
            大运天干占比线性推移，权重是它的线性组合，于是那条弦就是函数本身
            （实测块内 z 的二阶差分 ≤ 6e-3，而域与扰动是 1.8–3.4，差三个量级）。
            但曲线若近乎相切地擦过门槛，同样的偏差折成的日期误差会放大 ——
            那时误差半径自己会涨上去，而<strong>那种情况下「哪一天」本就没有意义</strong>：
            曲线在门槛上趴着，等于问一条水平线哪天穿过自己。
          </p>
          </>)}
          <p className="sub" style={{ marginTop: 10 }}>
            <strong>⚠️ 权重类序列只报到年，不报到月。</strong>
            流月不进权重，真正的跳变全发生在立春换柱那一刻 ——
            对它们写「某年某月穿越」是伪精度，说的其实是「那一个立春年」。
            只有扰动类的流月真的进了序列，才报得到月。
          </p>
          {on("notes") && (<>
          <p className="sub">
            <strong>点一行会跳到该段 |z| 最大的那个采样点</strong>，「此刻的权重」随之打开。
            注意那里会显示到月（如<span className="mono">2008 年 酉月</span>）——
            那是<strong>被取出的那一个采样点</strong>，不是「峰在酉月」：
            权重类在立春年内只有大运斜坡在动，年内取哪个月都代表同一个立春年。
            要看月真的有意义的峰，看扰动类那一组。
          </p>
          <p className="sub">
            所以权重类那几行会出现<span className="mono">穿出「某年内」</span> ——
            那<strong>不是零长度的事件</strong>：曲线在那一年里穿了出去又落回来，
            大运份额在年内是连续移动的，所以年内摆回门槛以内是常事。
            压成同一个年份是分辨率的结果，不是时间的结果。
          </p>
          <p className="sub">
            <strong>穿越不等于吉凶。</strong>高于与低于都算穿越；
            「用意」那一栏说的是这条序列<strong>本身</strong>偏用神还是偏忌神，
            而不是这一次穿越是好是坏。点任意一行可跳到那个峰值点看当时的神煞。
          </p>
          <p className="sub">
            这与「统计节点」页不是一回事：那边取 max(|z|, |ż|)，
            把「一直很极端」与「正在急速穿过」都算节点；
            这里只看 |z| 本身，是曲线与那两条横线的<strong>几何交点</strong>。
            两者给出不同的区间，那不是矛盾 —— 问的不是同一个问题。
          </p>
          </>)}
        </div>
      )}

      {atFrame !== null && on("reason") && (
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

      {atFrame !== null && on("weights") && (
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

      {on("stats") && (<>
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
      {on("notes") && (
      <p className="sub" style={{ fontSize: 12 }}>
        μ 与 σ 即图上 ±θσ 界线所依的那两个量，按<b>统计窗内的月度全样本</b>算。
        域张力<b>恒不判方向</b> —— 张力本身就是「顺逆并存」的度量，给它定吉凶
        等于把已经拆开的东西又合回去。宫位权重同理，只报「该宫变动」。
      </p>
      )}
      </>)}
      </div>
      </div>

      {on("notes") && (
      <p className="sub" style={{ fontSize: 12, marginTop: 14 }}>
        点击图上任意位置可取该时点，右侧（或下方）随即列出当时的神煞与结构事件。
        曲线用 Catmull-Rom 平滑 —— 采样是月度的，而底下的量本就连续，
        折线会把每个采样点画成拐点，那是采样的伪影，不是数据的性质。
      </p>
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  buildSeries, curveStats, evaluateAt, buildChart, buildBaseChart,
  chartOptionsOf, loadParams, precisionBandOf, drawnCrossings,
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
   * 🧪 实验分支（exp/fleeting-month-weights）：让流月进权重。
   *
   * 主线上这是硬约束 —— 月、日是引动的扳机，不是力量的来源。这里放开它，
   * 只为在实盘上看一眼：把流月按流年的一个比例铺成权重之后，曲线长什么样。
   * 它**不进**命盘、报告与参数指纹之外的任何地方，只改这一页的曲线。
   */
  const [fmw, setFmw] = useState(false);
  const [fmwRatio, setFmwRatio] = useState(0.25);

  /**
   * 跨度超过默认柱数能覆盖的范围时，**另建一份带足够大运柱的基础盘**。
   * 不改全局参数 —— 那会连带改掉大运页、报告与节点页的范围，
   * 而用户只是想把这一张图拉长。
   */
  const spanBase = useMemo(() => {
    if (base === null || record === null) return base;
    const needSpan = spanDef.pillars > ctxParams.temporal.luckPillarCount;
    if (!needSpan && !fmw) return base;
    // 实验改动按字段叠在用户**当前参数**之上，不整段替换 ——
    // 否则用户校准过的权重会被悄悄换回默认值
    const p = loadParams({
      ...ctxParams,
      ...(needSpan ? { temporal: { luckPillarCount: spanDef.pillars } } : {}),
      ...(fmw ? {
        series: { ...ctxParams.series, fleetingMonthInWeights: true },
        weights: { ...ctxParams.weights, fleetingMonth: { ratioToYear: fmwRatio } },
      } : {}),
    } as never);
    try {
      return buildBaseChart(buildChart(record.input, chartOptionsOf(p)), p);
    } catch { return base; }
  }, [base, record, ctxParams, spanDef.pillars, fmw, fmwRatio]);

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
  /**
   * 与 ±θσ 的交点 —— **图上那条曲线**穿过虚线的位置，换算成大致日期。
   *
   * 在画图用的同一份采样（keep）、同一条平滑曲线上求，所以表上的日期
   * 与肉眼在图上看到的位置一致。窗口下标与 keep 同一空间，直接传。
   */
  const crossings = shown.flatMap((sr) => drawnCrossings(
    S, sr, threshold, keep, win === null ? undefined : { from: win.from, to: win.to },
  )).sort((a, b) => (a.enterAt?.jd ?? -Infinity) - (b.enterAt?.jd ?? -Infinity));

  /** 「约 2026-03-12 · Q1」。只给大致日期，不给时分，也不给误差半径。 */
  const spotText = (at: { year: number; month: number; day: number }) =>
    `${at.year}-${String(at.month).padStart(2, "0")}-${String(at.day).padStart(2, "0")}`
    + `　Q${Math.ceil(at.month / 3)}`;

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
      {fmw ? (
        <p className="sub">
          <b>🧪 实验中：流月已进权重。</b>总量为流年的 {Math.round(fmwRatio * 100)}%。
          月度上的变化现在有两个来源：大运份额的推移，和流月自己的权重。
        </p>
      ) : (
      <p className="sub">
        <b>流月不参与权重。</b>月度上之所以有变化，是大运份额在推移，不是流月加了分。
        流月只进符号层：它在扰动序列里，不在权重序列里。
      </p>
      )}
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
          {fmw
            ? <>🧪 实验中：月度视图里权重类序列<b>年内每个月都会跳一次</b>（流月在加权），
              不再只有立春那一下。</>
            : <>月度视图里那些锯齿是<b>立春换柱的真实阶跃</b> —— 权重类序列在一个立春年内
              近乎恒定，跳变都发生在换柱那一刻。</>}
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

      <div className="card" style={{
        marginTop: 14, borderColor: fmw ? "var(--accent)" : undefined,
      }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <strong style={{ fontSize: 13 }}>🧪 实验</strong>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={fmw}
              onChange={(e) => setFmw(e.target.checked)} />
            让流月进权重
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            总量占流年
            <select value={fmwRatio} disabled={!fmw}
              onChange={(e) => setFmwRatio(Number(e.target.value))}>
              <option value={0.1}>10%</option>
              <option value={0.25}>25%（≈ 1/4）</option>
              <option value={0.5}>50%</option>
              <option value={1}>100%（与流年等量）</option>
            </select>
          </label>
          {fmw && (
            <span className="dim" style={{ fontSize: 12 }}>
              流月 {num(110 * fmwRatio, 1)}（流年 110 × {fmwRatio}），干支按 40:70 同比缩放；
              距离系数借流年的
            </span>
          )}
        </div>
        {fmw && (
          <p className="sub" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            <strong>⚠️ 这违反主线的硬约束，下面凡写着「流月不参与权重」的说明在此模式下都不成立。</strong>
            此时权重类序列年内每个月都会跳一次，月才真的携带信息 ——
            所以权重类的交点与节点按月报，不再只报到年。
            这只改这一页的曲线，不进命盘、报告与其他页面；
            参数指纹与主线不同，数不可与主线的报告相比。
          </p>
        )}
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
                    <th>序列</th><th>方向</th>
                    <th>穿入（大致日期）</th><th>穿出（大致日期）</th>
                    <th style={{ textAlign: "right" }}>峰值 z</th><th>用意</th>
                  </tr>
                </thead>
                <tbody>
                  {crossings.map((c, k) => (
                    <tr key={`${c.seriesId}-${k}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => setPicked(c.peakFrame)}>
                      <td>{c.label}</td>
                      <td>{c.sign > 0 ? `高于 +${threshold}σ` : `低于 −${threshold}σ`}</td>
                      <td className="mono">
                        {c.enterAt === null
                          ? <span className="dim">窗口之前就已越线</span>
                          : <>约 {spotText(c.enterAt)}</>}
                      </td>
                      <td className="mono">
                        {c.exitAt === null
                          ? <span className="dim">到末尾仍未回</span>
                          : <>约 {spotText(c.exitAt)}</>}
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
            <strong>日期是图上那条线穿过虚线的位置，换算出来的大致日子。</strong>
            穿入与穿出各一个，都按这一段两端采样点的日期折算：
            按年采样时两端是相邻两个立春（寅月起点，约 2 月 4 日），
            按月采样时是相邻两个月的起点。只到「哪一周」的量级，不求真节。
            <span className="mono">Q1</span>–<span className="mono">Q4</span> 是公历季度，
            读法上更稳 —— 日子可以差几天，季度一般不会错。
          </p>
          <p className="sub">
            <strong>⚠️ 这是「图上」的交点，不是「模型里某一天发生了什么」。</strong>
            {fmw
              ? <>🧪 实验中，权重类序列年内每个月都在跳，所以按年画的平滑线与模型更不像 ——
                  它只穿过每年立春那一个点，月内的起伏全被抽掉了；想看实情请切到按月。</>
              : <>权重类序列在立春那一刻<strong>真的阶跃</strong>，年内几乎不动；</>}
            但按年采样时，图上画的是相邻两个立春之间一条平滑的坡。
            于是一次阶跃在图上会被画成「上一个立春与下一个立春之间某处穿过」——
            表上给的是前者，模型里它发生在后一个立春。
            两个日期都对，回答的是两个问题。
            想看阶跃本身，把采样切到<strong>按月</strong>，它就原样画出来了。
          </p>
          <p className="sub">
            <strong>相邻的穿越并成一段。</strong>
            一条在门槛附近摆动的曲线能穿出几十个交点，逐个都真，合起来什么也说不出；
            并成一段之后，两个端点正是穿入与穿出。
            另外，平滑曲线会在两个采样点之间轻微鼓出一点 ——
            若一段「越线」的曲线里<strong>一个采样点都没越线</strong>，那是平滑画出来的，
            数据里没有，表上不列。
          </p>
          <p className="sub">
            <strong>穿越不等于吉凶。</strong>高于与低于都算穿越；
            「用意」那一栏说的是这条序列<strong>本身</strong>偏用神还是偏忌神，
            而不是这一次穿越是好是坏。点任意一行可跳到峰值那个采样点，看当时的神煞。
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

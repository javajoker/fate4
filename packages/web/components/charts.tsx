"use client";

/**
 * 自绘 SVG 图表。刻意不引图表库 ——
 * 本项目的核心可视化（桑基、雷达、月历）都是高度定制的，
 * 通用库的抽象在这里只增加阻力。三线曲线三十行就够了。
 *
 * 全部遵守 §4 配色约束：有序量走单色阶，分类量才用色相，无红绿吉凶色。
 */

import { ELEMENTS, type Element } from "@fate/core";
import { seriesColor, ELEMENT_COLOR, FLOW_COLOR, PARTY_COLOR, sequential } from "../lib/palette";

// ─────────────────────────────────────────────────────────
// 五行雷达 —— 可叠加「本命 / 大运 / 流年」三层
// ─────────────────────────────────────────────────────────

export interface RadarLayer {
  readonly name: string;
  readonly values: Readonly<Record<Element, number>>;
  readonly dash?: string;
}

export function ElementRadar({ layers, size = 260 }: { layers: readonly RadarLayer[]; size?: number }) {
  const R = size / 2 - 34;
  const cx = size / 2; const cy = size / 2;
  const max = Math.max(1, ...layers.flatMap((l) => ELEMENTS.map((e) => l.values[e])));
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  };

  return (
    <div>
      <svg width={size} height={size} role="img" aria-label="五行权重雷达">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={ELEMENTS.map((_, i) => pt(i, R * f).join(",")).join(" ")}
            fill="none" stroke="var(--line)" strokeWidth={1}
          />
        ))}
        {ELEMENTS.map((e, i) => {
          const [x, y] = pt(i, R);
          const [lx, ly] = pt(i, R + 18);
          return (
            <g key={e}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fontSize={13} fill={ELEMENT_COLOR[e]}>{e}</text>
            </g>
          );
        })}
        {layers.map((l, li) => (
          <polygon
            key={l.name}
            points={ELEMENTS.map((e, i) => pt(i, (l.values[e] / max) * R).join(",")).join(" ")}
            fill={li === 0 ? "var(--accent)" : "none"}
            fillOpacity={li === 0 ? 0.12 : 0}
            stroke="var(--accent)"
            strokeOpacity={1 - li * 0.3}
            strokeWidth={2}
            strokeDasharray={l.dash}
          />
        ))}
      </svg>
      <div className="legend">
        {layers.map((l, i) => (
          <span key={l.name}>
            <i style={{ background: "var(--accent)", opacity: 1 - i * 0.3 }} />{l.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 十神柱状 —— 同党 / 异党分色
// ─────────────────────────────────────────────────────────

const SUPPORTING = new Set(["比肩", "劫财", "正印", "偏印"]);

export function TenGodBars({ values }: { values: Readonly<Record<string, number>> }) {
  const rows = Object.entries(values);
  const max = Math.max(1, ...rows.map(([, v]) => v));
  const W = 320; const rowH = 22;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W + 120} ${rows.length * rowH + 8}`} role="img" aria-label="十神权重">
        {rows.map(([g, v], i) => (
          <g key={g} transform={`translate(0,${i * rowH + 4})`}>
            <text x={48} y={12} textAnchor="end" fontSize={12} fill="var(--ink-2)">{g}</text>
            <rect x={56} y={3} width={(v / max) * W} height={13} rx={2}
              fill={SUPPORTING.has(g) ? PARTY_COLOR.supporting : PARTY_COLOR.opposing} />
            <text x={60 + (v / max) * W} y={13} fontSize={11} fill="var(--ink-3)"
              style={{ fontVariantNumeric: "tabular-nums" }}>{v.toFixed(1)}</text>
          </g>
        ))}
      </svg>
      <div className="legend">
        <span><i style={{ background: PARTY_COLOR.supporting }} />同党（比劫 · 印）</span>
        <span><i style={{ background: PARTY_COLOR.opposing }} />异党（食伤 · 财 · 官杀）</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 五行流通桑基图 —— 最有解释力的一张
// ─────────────────────────────────────────────────────────

export interface ElementFlow {
  readonly from: Element; readonly to: Element;
  readonly kind: "sheng" | "ke"; readonly amount: number;
}

/** 载体级的流量按五行聚合 —— 24 个载体的桑基图无法阅读，五行的可以。 */
export function aggregateFlows(
  flows: readonly { from: string; to: string; kind: "sheng" | "ke"; totalAmount: number }[],
  elementById: Readonly<Record<string, Element>>,
): ElementFlow[] {
  const acc = new Map<string, ElementFlow>();
  for (const f of flows) {
    const a = elementById[f.from]; const b = elementById[f.to];
    if (a === undefined || b === undefined) continue;
    const key = `${a}>${b}:${f.kind}`;
    const prev = acc.get(key);
    acc.set(key, {
      from: a, to: b, kind: f.kind,
      amount: (prev?.amount ?? 0) + f.totalAmount,
    });
  }
  return [...acc.values()].sort((x, y) => y.amount - x.amount);
}

export function SankeyFlow({ flows, height = 300 }: { flows: readonly ElementFlow[]; height?: number }) {
  const W = 560; const pad = 26; const colW = 60;
  const left = pad; const right = W - pad - colW;
  const nodeH = (height - pad * 2) / 5 - 12;
  const total = Math.max(1, ...flows.map((f) => f.amount));
  const yOf = (e: Element) => pad + ELEMENTS.indexOf(e) * ((height - pad * 2) / 5);

  // 每个节点的进出偏移，避免带子重叠
  const outOff = new Map<Element, number>();
  const inOff = new Map<Element, number>();

  return (
    <div className="scroll">
      <svg width="100%" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="五行流通桑基图">
        {flows.map((f, i) => {
          const w = Math.max(1.2, (f.amount / total) * (nodeH * 0.9));
          const o = outOff.get(f.from) ?? 0; outOff.set(f.from, o + w);
          const n = inOff.get(f.to) ?? 0; inOff.set(f.to, n + w);
          const y1 = yOf(f.from) + o + w / 2;
          const y2 = yOf(f.to) + n + w / 2;
          const x1 = left + colW; const x2 = right;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
              stroke={FLOW_COLOR[f.kind]} strokeWidth={w} fill="none" strokeOpacity={0.45}
            >
              <title>{`${f.from} ${f.kind === "sheng" ? "生" : "克"} ${f.to}：${f.amount.toFixed(2)}`}</title>
            </path>
          );
        })}
        {ELEMENTS.map((e) => (
          <g key={`l${e}`}>
            <rect x={left} y={yOf(e)} width={colW} height={nodeH} rx={2}
              fill={ELEMENT_COLOR[e]} fillOpacity={0.85} />
            <text x={left + colW / 2} y={yOf(e) + nodeH / 2} textAnchor="middle"
              dominantBaseline="middle" fontSize={13} fill="#fff">{e}</text>
          </g>
        ))}
        {ELEMENTS.map((e) => (
          <g key={`r${e}`}>
            <rect x={right} y={yOf(e)} width={colW} height={nodeH} rx={2}
              fill={ELEMENT_COLOR[e]} fillOpacity={0.85} />
            <text x={right + colW / 2} y={yOf(e) + nodeH / 2} textAnchor="middle"
              dominantBaseline="middle" fontSize={13} fill="#fff">{e}</text>
          </g>
        ))}
        <text x={left} y={14} fontSize={11} fill="var(--ink-3)">施力方</text>
        <text x={right} y={14} fontSize={11} fill="var(--ink-3)">受力方</text>
      </svg>
      <div className="legend">
        <span><i style={{ background: FLOW_COLOR.sheng }} />生 —— 母泄气，子得力，含 15% 传输损耗</span>
        <span><i style={{ background: FLOW_COLOR.ke }} />克 —— 双方俱损，非转移</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 大运长条 —— 色深表顺逆指数（单色阶）
// ─────────────────────────────────────────────────────────

export interface LuckBar {
  readonly index: number; readonly label: string;
  readonly fromAge: number; readonly samples: readonly { at: string; favorIndex: number }[];
}

export function LuckBars({ bars, onPick }: {
  bars: readonly LuckBar[]; onPick?: (i: number) => void;
}) {
  const W = 700; const h = 34;
  const span = bars.length * 10;
  return (
    <div className="scroll">
      <svg width="100%" viewBox={`0 0 ${W} ${h + 46}`} role="img" aria-label="大运顺逆指数">
        {bars.map((b, i) => {
          const x = (i / bars.length) * W;
          const w = W / bars.length;
          // 一步内取三段，前后气象本就不同，不作平均
          return (
            <g key={b.index} onClick={() => onPick?.(b.index)} style={{ cursor: onPick ? "pointer" : "default" }}>
              {b.samples.map((s, si) => (
                <rect key={s.at} x={x + (si * w) / 3} y={18} width={w / 3} height={h}
                  fill={sequential(s.favorIndex / 100)}>
                  <title>{`${b.label} ${s.at}：${s.favorIndex.toFixed(1)}`}</title>
                </rect>
              ))}
              <rect x={x} y={18} width={w} height={h} fill="none" stroke="var(--surface)" strokeWidth={1} />
              <text x={x + w / 2} y={14} textAnchor="middle" fontSize={11} fill="var(--ink-2)">{b.label}</text>
              <text x={x + w / 2} y={h + 34} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
                {b.fromAge.toFixed(0)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          顺逆指数
          <span style={{ display: "inline-flex" }}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <i key={t} style={{ background: sequential(t), width: 16, borderRadius: 0, margin: 0 }} />
            ))}
          </span>
          低 → 高（单色阶，非吉凶色）
        </span>
        <span>每步分三段：前五年重天干，后五年重地支，气象本不相同，故不作平均。</span>
        <span className="dim">跨度约 {span} 年</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 流年三线
// ─────────────────────────────────────────────────────────

export interface YearPoint {
  readonly year: number; readonly favorIndex: number;
  readonly vitality: number; readonly dayMasterShare: number;
}

export function YearLines({ points, mark, onPick }: {
  points: readonly YearPoint[]; mark?: number; onPick?: (y: number) => void;
}) {
  if (points.length === 0) return null;
  const W = 760; const H = 190; const padL = 34; const padB = 22; const padT = 10;
  const y0 = points[0]!.year;
  const yn = points[points.length - 1]!.year;
  const X = (y: number) => padL + ((y - y0) / Math.max(1, yn - y0)) * (W - padL - 10);
  const Y = (v: number) => padT + (1 - v) * (H - padT - padB);

  const line = (get: (p: YearPoint) => number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.year).toFixed(1)},${Y(get(p)).toFixed(1)}`).join(" ");

  const ticks = points.filter((p) => p.year % 10 === 0);

  return (
    <div className="scroll">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="流年三线"
        onClick={(e) => {
          if (onPick === undefined) return;
          const r = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
          if (r === undefined) return;
          const f = (e.clientX - r.left) / r.width;
          onPick(Math.round(y0 + f * (yn - y0)));
        }}
        style={{ cursor: onPick ? "crosshair" : "default" }}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} y1={Y(f)} x2={W - 10} y2={Y(f)} stroke="var(--line)" />
            <text x={padL - 6} y={Y(f) + 4} textAnchor="end" fontSize={10} fill="var(--ink-3)">
              {(f * 100).toFixed(0)}
            </text>
          </g>
        ))}
        {ticks.map((p) => (
          <text key={p.year} x={X(p.year)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
            {p.year}
          </text>
        ))}
        {mark !== undefined && (
          <line x1={X(mark)} y1={padT} x2={X(mark)} y2={H - padB}
            stroke="var(--accent)" strokeDasharray="3 3" />
        )}
        <path d={line((p) => p.favorIndex / 100)} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
        <path d={line((p) => p.vitality)} fill="none" stroke={PARTY_COLOR.opposing} strokeWidth={1.2} />
        <path d={line((p) => p.dayMasterShare)} fill="none" stroke={PARTY_COLOR.supporting}
          strokeWidth={1.2} strokeDasharray="4 3" />
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--accent)" }} />顺逆指数 —— 结构与喜用的契合度，非运气好坏</span>
        <span><i style={{ background: PARTY_COLOR.opposing }} />单轮留存</span>
        <span><i style={{ background: PARTY_COLOR.supporting }} />日主党势</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 内外十神对照 —— 同一个十神的「藏」与「透」并排
// ─────────────────────────────────────────────────────────

export interface InnerOuterRow {
  readonly god: string;
  readonly inner: number;   // 归一化
  readonly outer: number;
}

/**
 * 背靠背横条：左内右外，中轴对齐。
 *
 * 用同一色相的两个深浅，**不用两个色相** —— 内与外没有好坏之分，
 * 换色相会暗示一优一劣。差异最大的几行加一条中轴标记，
 * 因为「哪几个十神分歧最大」才是这张图要说的，而不是「张力是 0.55」。
 */
export function InnerOuterBars({ rows, highlight = [] }: {
  rows: readonly InnerOuterRow[]; highlight?: readonly string[];
}) {
  const shown = rows.filter((r) => r.inner > 0 || r.outer > 0);
  const max = Math.max(0.01, ...shown.map((r) => Math.max(r.inner, r.outer)));
  const H = 22; const W = 420; const mid = W / 2; const half = mid - 46;
  return (
    <div className="scroll">
      <svg width="100%" viewBox={`0 0 ${W} ${shown.length * H + 26}`} role="img"
        aria-label="内外十神对照">
        <text x={mid - half} y={12} fontSize={11} fill="var(--ink-3)">藏（内）</text>
        <text x={mid + half} y={12} textAnchor="end" fontSize={11} fill="var(--ink-3)">透（外）</text>
        {shown.map((r, i) => {
          const y = 20 + i * H;
          const on = highlight.includes(r.god);
          const li = (r.inner / max) * half;
          const lo = (r.outer / max) * half;
          return (
            <g key={r.god}>
              <rect x={mid - li} y={y + 3} width={li} height={13} rx={2}
                fill="var(--accent)" fillOpacity={0.35} />
              <rect x={mid} y={y + 3} width={lo} height={13} rx={2}
                fill="var(--accent)" fillOpacity={0.8} />
              <text x={mid} y={y + 13} textAnchor="middle" fontSize={11}
                fill={on ? "var(--ink)" : "var(--ink-3)"}
                fontWeight={on ? 600 : 400}
                style={{ paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>
                {r.god}
              </text>
              <text x={mid - li - 4} y={y + 13} textAnchor="end" fontSize={10} fill="var(--ink-3)"
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {r.inner > 0 ? `${(r.inner * 100).toFixed(0)}%` : ""}
              </text>
              <text x={mid + lo + 4} y={y + 13} fontSize={10} fill="var(--ink-3)"
                style={{ fontVariantNumeric: "tabular-nums" }}>
                {r.outer > 0 ? `${(r.outer * 100).toFixed(0)}%` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--accent)", opacity: 0.35 }} />藏支为隐 —— 心里的那一面</span>
        <span><i style={{ background: "var(--accent)", opacity: 0.8 }} />透干为显 —— 外人看见的那一面</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 生命曲线 —— 月度采样的多序列叠加
// ─────────────────────────────────────────────────────────

export interface CurveSeries {
  readonly id: string;
  readonly label: string;
  readonly values: readonly number[];
}

/**
 * 多序列折线。
 *
 * 每条各自归一到 [0,1] 再画 —— 十神权重与域张力量纲差着两个数量级，
 * 同轴直接画会让后者变成一条贴底的直线。归一之后比的是**形状**，
 * 而形状正是这张图要说的：哪一段在动、哪几条一起动。
 * 具体数值在下方的表里给，图上不标 —— 归一后的纵轴没有单位，标了是骗人。
 *
 * 换运处画竖线：那是曲线上唯一的真实断点，其余起伏都是连续的。
 */
/**
 * 生命曲线。
 *
 * ## 两种对齐，各回答一个不同的问题
 *
 * | 模式 | 纵轴 | 回答的问题 |
 * | `sigma` | z = (v − μ) / σ | 「这个量此刻偏离它自己的常态多远」 |
 * | `weight` | 原始值 | 「这几个量之间，谁大谁小」 |
 *
 * σ 对齐时全部曲线共用同一条 ±θ 界线，穿越点一眼可读；
 * 权重对齐时界线不画 —— 各条的 σ 不同，画出来会是十条不同高度的横线，
 * 除了糊成一片没有别的作用。
 *
 * μ 与 σ 取自 `curveStats`，与节点层检出用的是同一个估计量 ——
 * 否则图上看到的穿越点对不上报告里列的节点。
 *
 * ## 为什么是平滑曲线
 *
 * 采样是月度的，而底下的量（大运份额的推移）本就连续。折线把每个采样点
 * 画成拐点，看上去像是每月都有一次转折，那是采样的伪影不是数据的性质。
 * 用 Catmull-Rom 转三次贝塞尔：过每一个采样点，点之间平滑。
 */
export interface CurveSpec {
  readonly id: string;
  readonly label: string;
  readonly values: readonly number[];
  /** 统计窗内的中心与散布。σ 模式用它换算 z。 */
  readonly center: number;
  readonly sigma: number;
}

/** Catmull-Rom → 三次贝塞尔。张力 0.5 为通行取值。 */
function smoothPath(pts: readonly (readonly [number, number])[]): string {
  if (pts.length === 0) return "";
  if (pts.length < 3) {
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  }
  const out: string[] = [`M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    out.push(`C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} `
      + `${p2[0].toFixed(1)},${p2[1].toFixed(1)}`);
  }
  return out.join(" ");
}

export function LifeCurves({
  series, years, luckBreaks, mark, onPick, mode = "sigma", threshold = 2,
}: {
  series: readonly CurveSpec[];
  years: readonly number[];
  luckBreaks: readonly number[];
  mark?: number;
  onPick?: (index: number) => void;
  mode?: "sigma" | "weight";
  threshold?: number;
}) {
  const n = years.length;
  if (n === 0 || series.length === 0) return null;
  const W = 860; const H = 300; const padL = 34; const padB = 22; const padT = 10;
  const X = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - 8);

  // σ 模式：纵轴是 z，范围取 ±max(threshold+1, 实际极值)，两模式都不裁剪数据
  const zOf = (s: CurveSpec, v: number) => (s.sigma <= 0 ? 0 : (v - s.center) / s.sigma);
  let lo: number; let hi: number;
  if (mode === "sigma") {
    let m = threshold + 0.6;
    for (const s of series) for (const v of s.values) m = Math.max(m, Math.abs(zOf(s, v)));
    lo = -m; hi = m;
  } else {
    lo = Infinity; hi = -Infinity;
    for (const s of series) for (const v of s.values) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!(hi > lo)) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.06;
    lo -= pad; hi += pad;
  }
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const val = (s: CurveSpec, i: number) =>
    mode === "sigma" ? zOf(s, s.values[i]!) : s.values[i]!;

  const ticks = years
    .map((y, i) => ({ y, i }))
    .filter(({ y, i }) => y % 10 === 0 && (i === 0 || years[i - 1] !== y));

  const axisLabels = mode === "sigma"
    ? [threshold, 0, -threshold]
    : [hi - (hi - lo) * 0.06, (lo + hi) / 2, lo + (hi - lo) * 0.06];

  return (
    <div className="scroll">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="生命曲线"
        style={{ cursor: onPick ? "crosshair" : "default" }}
        onClick={(e) => {
          if (onPick === undefined) return;
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round((((e.clientX - r.left) / r.width) * W - padL)
            / (W - padL - 8) * (n - 1));
          onPick(Math.min(n - 1, Math.max(0, i)));
        }}>
        {/* ±θσ 界线。只在 σ 模式画 —— 权重模式下各条 σ 不同，画出来是十条横线 */}
        {mode === "sigma" && [threshold, -threshold].map((t) => (
          <g key={`s${t}`}>
            <line x1={padL} y1={Y(t)} x2={W - 8} y2={Y(t)}
              stroke="var(--line-strong)" strokeWidth={1} strokeDasharray="5 4" />
            <text x={padL - 4} y={Y(t) + 3} textAnchor="end" fontSize={9.5} fill="var(--ink-3)">
              {t > 0 ? `+${t}σ` : `−${threshold}σ`}
            </text>
          </g>
        ))}
        {mode === "sigma" && (
          <line x1={padL} y1={Y(0)} x2={W - 8} y2={Y(0)}
            stroke="var(--line)" strokeWidth={1} />
        )}
        {mode === "weight" && axisLabels.map((v, k) => (
          <text key={`a${k}`} x={padL - 4} y={Y(v) + 3} textAnchor="end"
            fontSize={9.5} fill="var(--ink-3)">{v.toFixed(0)}</text>
        ))}

        {luckBreaks.map((i) => (
          <line key={`b${i}`} x1={X(i)} y1={padT} x2={X(i)} y2={H - padB}
            stroke="var(--line)" strokeWidth={1} strokeDasharray="2 4" />
        ))}
        {ticks.map(({ y, i }) => (
          <text key={y} x={X(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-3)">
            {y}
          </text>
        ))}
        {mark !== undefined && (
          <line x1={X(mark)} y1={padT} x2={X(mark)} y2={H - padB}
            stroke="var(--accent)" strokeWidth={1.5} />
        )}
        {series.map((s, si) => (
          <path key={s.id}
            d={smoothPath(s.values.map((_, i) => [X(i), Y(val(s, i))] as const))}
            fill="none" stroke={seriesColor(si)} strokeWidth={1.4}
            strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="legend">
        {series.map((s, i) => (
          <span key={s.id}>
            <i style={{ background: seriesColor(i) }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

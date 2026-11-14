/**
 * L5n 统计节点 —— 曲线与 2σ 线的穿越区间。
 *
 * ## ⚠️ 这是排序工具，不是概率陈述
 *
 * 命盘的时间序列是**确定性的准周期序列**：大运十年一换、流年六十年一轮、
 * 大运份额线性推移，全部由出生时刻决定。它不是从某个分布里抽出的随机样本。
 *
 * 对它算 μ 与 σ，得到的是**这条序列自身的经验散布**。后果：
 * `|z| ≥ 2` 的采样点**必然**约占 5%，与这张盘是什么盘无关。
 *
 * | | |
 * | ✅ 成立 | 「这是本命六十年中，该指标最偏离常态的三段时期」——排序 |
 * | ❌ 不成立 | 「这一年发生巨变的概率是 5%」——概率 |
 *
 * 措辞由 `zh.stats.probability` 规则拦截。
 *
 * ## 两个量：变化量与变化率
 *
 * ```
 * z(t)  = (q(t) − μ) / σ                   水平偏离 —— 变化量
 * ż(t)  = (q(t) − q(t−P) − μ_Δ) / σ_Δ      同比差分的偏离 —— 变化率
 * ```
 *
 * **差分的步长 P 是一整年（月度序列取 12），不是一个月。**
 * 月度序列被一个周期为 12 的确定性阶跃主导 —— 每年立春换流年柱，曲线必跳一次。
 * 对月度一阶差分做 z 分数，量到的是「立春跳变比月内漂移大」，
 * 而这**永远成立**，与这张盘是什么盘无关：实测几乎每一个节点都起于寅月。
 * 取同比差分则两端处于同一年内相位，立春的跳变相消，剩下的才是真的趋势变化。
 * 中尺度的序列本就是每步一值，步长取 1。
 *
 * 判据取 `max(|z|, |ż|) ≥ θ`。两种情形都是「变动」，但含义完全不同：
 *
 * | 形态 | 判据 | 含义 |
 * | 持续极端 | 高 \|z\|、低 \|ż\| | 长期处于偏离态 |
 * | 急速穿越 | 低 \|z\|、高 \|ż\| | 量不极端但变得很快 —— 换运前后的典型形态 |
 * | 突入极端 | 两者皆高 | 最强 |
 *
 * 只报一个合成分数，会把「一直如此」与「突然变成这样」混为一谈。
 *
 * ## 节点是区间，不是时点
 *
 * 报「2031 年 3 月至 2033 年 8 月，2032 年 5 月最甚」比报「2032 年」
 * 既准确、又不给虚假的时点精度。**插值只到月** —— 采样本就是月度，
 * 流月又不加权，序列在月内并无独立信息，插到某一天是伪精度。
 *
 * ## 门槛 θ 是参数，不是常数
 *
 * 默认 θ = 2。这个值没有任何理论地位 —— 它是**取多少条**的旋钮：
 * θ 越小报得越多，θ 越大只剩最偏的几段。`nodes.threshold` 可改，
 * `findNodes(S, scale, { threshold: 1.5 })` 亦可就地覆盖。
 * 因序列是确定性的，改 θ 改的是入选条数，不是「显著性水平」。
 *
 * ## 三条反向护栏
 *
 * σ 为 0 的序列不产出节点；近乎平直的序列（σ 极小，任何抖动都放大成大 z）
 * 由 `minRelativeSwing` 挡下 —— 峰值须真的动了；
 * 中尺度采样不足的那一「步」不参与统计 —— 起运前的残段只有几个月，
 * 它的均值与整整十年的均值不可比，实测能把一条纯直线撑出 −2.23σ 的假节点。
 * 没有这三条，「检出了 N 个节点」可能只是噪声。
 *
 * ## 为什么没有「覆盖率上限」这条护栏
 *
 * 初版有一条 `maxCoverage`：一段穿越若占满大半个基准窗，就不是偏离，
 * 是基准取错了。它已删除 —— **它永远不会触发**，而永不触发的护栏
 * 只会让人以为有一层其实不存在的保护。
 *
 * 中尺度可证：MAD 是偏差的中位数，若有超过一半的点满足 `d ≥ 2.965·MAD`，
 * 则 `MAD ≥ 2.965·MAD`，只能 `MAD = 0` —— 而那时 σ=0，序列本就被排除。
 * 故越阈点不超过一半，桥距在中尺度又折算为 0，覆盖率恒 ≤ 0.5。
 *
 * 小、大两个尺度用样本标准差，`Σz² = n` 强制 `|z|≥2` 的点不超过 n/4，
 * 变化率一路同理，合并也不到一半；且**桥接不跨号**，
 * 而尖峰序列的变化率必然一升一降成对出现，链条总被异号段打断。
 * 这条性质由 `nodes.spec.ts` 当作不变量断言，不再当作运行期过滤。
 */

import type { NodesParams } from "../params/types.js";
import type { BaseChart } from "../chart/baseChart.js";
import { evaluateAt } from "./evaluate.js";
import { runYingqi } from "../yingqi/engine.js";
import { DOMAIN_LABEL } from "../yingqi/types.js";
import { ELEMENTS, type Element } from "../types/ganzhi.js";
import { elementOf } from "../ganzhi/algebra.js";
import type { Series, SeriesFrame, SeriesSet } from "./series.js";
import { jieMonthBounds, lichunJdOf } from "./views.js";
import { fromJulianDay } from "../astro/julian.js";
import { precisionBandOf } from "../astro/horizon.js";

// ─────────────────────────────────────────────────────────

export type NodeScale = "small" | "medium" | "large";
export type NodeShape = "sustained" | "swift" | "surge";
export type NodeDirection = "opportunity" | "pressure" | "neutral";

export const SCALE_LABEL: Readonly<Record<NodeScale, string>> = Object.freeze({
  small: "小节点", medium: "中节点", large: "大节点",
});
export const SHAPE_LABEL: Readonly<Record<NodeShape, string>> = Object.freeze({
  sustained: "持续极端", swift: "急速穿越", surge: "突入极端",
});
export const DIRECTION_LABEL: Readonly<Record<NodeDirection, string>> = Object.freeze({
  opportunity: "偏机会", pressure: "偏压力", neutral: "只报变动",
});

export interface NodeReason {
  readonly kind: "shensha" | "structure" | "yingqi";
  readonly text: string;
  /** 与进入点的距离（月）。越近越像是引发它的。 */
  readonly distanceMonths: number;
}

export interface TimeMark {
  readonly year: number;
  /** 节气月序，0 = 寅月。 */
  readonly monthIndex: number;
}

export interface NodeInterval {
  readonly seriesId: string;
  readonly label: string;
  readonly scale: NodeScale;
  readonly shape: NodeShape;
  readonly direction: NodeDirection;
  /** 水平偏离的方向。+1 高于常态，−1 低于常态。**两者都是节点。** */
  readonly sign: 1 | -1;
  /**
   * 定吉凶所依的方向 —— 取**驱动这个峰的那一个分量**。
   *
   * 峰按 `max(|z|, |ż|)` 取。若驱动它的是 ż（急速穿越），
   * 该点的水平往往正处在常态附近，`sign` 便无意义 ——
   * 用它判吉凶等于掷硬币。此时改用变化率的方向：升即 +1。
   * 持续极端与突入极端两种形态下，两者相同。
   */
  readonly driveSign: 1 | -1;
  readonly enter: TimeMark;
  readonly peak: TimeMark;
  readonly exit: TimeMark;
  /**
   * 三个时点的月序是否携带信息。
   *
   * 取自 `Series.monthResolving`。为 false 时（权重类的全部序列），
   * 区间实际是「若干个立春年」，月序恒为寅起丑止，报到月即伪精度。
   */
  readonly monthResolved: boolean;
  readonly durationMonths: number;
  readonly peakZ: number;
  readonly peakRateZ: number;
  /** ∫(max(|z|,|ż|) − θ)，超出门槛的面积 —— 「变化量」的积分形态。 */
  readonly area: number;
  readonly peakValue: number;
  readonly mean: number;
  readonly sigma: number;
  /** 该区间所在基准窗的采样点数。中尺度即大运步数。 */
  readonly groupSize: number;
  /**
   * 基准窗内 `|z| < 1` 的采样点数 —— 「有多少点挤在常态附近」。
   *
   * 中尺度需要它才能把话说清楚：`57.1σ` 这个比值无从解读，
   * 「六步里有四步都在中位附近，这一步不是」则一读就懂，而且说的是同一件事。
   */
  readonly nearBaseline: number;
  readonly reasons: readonly NodeReason[];
}

export interface NodeSet {
  readonly base: BaseChart;
  readonly scale: NodeScale;
  /**
   * 越阈的总段数 —— **截断之前**的数目。
   *
   * `nodes` 只留前 `maxShown` 条。少了这个数，门槛就成了一个看不出效果的旋钮：
   * θ 从 2 提到 3，越阈段从 221 落到 28，而列出来的仍是同样的 12 条。
   * 读者会以为控件坏了，而它其实一直在工作。
   */
  readonly total: number;
  readonly nodes: readonly NodeInterval[];
  /** 因 σ 为 0 或摆动过小而被排除的序列 —— 明写出来，免得「没有节点」被误读为「一切平稳」。 */
  readonly excluded: readonly { readonly seriesId: string; readonly why: string }[];
  readonly threshold: number;
}

// ─────────────────────────────────────────────────────────
// 估计量
// ─────────────────────────────────────────────────────────

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

function stdev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const h = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[h]! : (s[h - 1]! + s[h]!) / 2;
};

/**
 * 稳健标准差 —— 绝对中位差换算而来。
 *
 * `0.6745 = Φ⁻¹(0.75)`，使 MAD 在正态下等于 σ。
 * 样本量只有六时，它比样本标准差稳定得多。
 * MAD 为 0（取值全同）时返回 0，调用方据此**不产出节点** —— 不作任何回退，
 * 没有散布就没有偏离可言。
 */
export function robustSigma(xs: readonly number[]): { center: number; sigma: number } {
  const M = median(xs);
  const mad = median(xs.map((x) => Math.abs(x - M)));
  return { center: M, sigma: mad / 0.6745 };
}

// ─────────────────────────────────────────────────────────
// 穿越区间
// ─────────────────────────────────────────────────────────

interface Run { from: number; to: number; peak: number; sign: 1 | -1 }

/** `m[i] ≥ θ` 的极大连续段。同号者若只隔 ≤ bridge 个点则并作一段。 */
function runsOf(
  m: readonly number[], signs: readonly (1 | -1)[], theta: number, bridge: number,
): Run[] {
  const raw: Run[] = [];
  let start = -1;
  for (let i = 0; i <= m.length; i++) {
    const on = i < m.length && m[i]! >= theta;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      let peak = start;
      for (let k = start; k < i; k++) if (m[k]! > m[peak]!) peak = k;
      raw.push({ from: start, to: i - 1, peak, sign: signs[peak]! });
      start = -1;
    }
  }
  // 桥接：同号且间隔够短
  const out: Run[] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last !== undefined && last.sign === r.sign && r.from - last.to - 1 <= bridge) {
      last.to = r.to;
      if (m[r.peak]! > m[last.peak]!) last.peak = r.peak;
    } else out.push({ ...r });
  }
  return out;
}

function shapeOf(z: number, rz: number, theta: number): NodeShape {
  const hiZ = Math.abs(z) >= theta;
  const hiR = Math.abs(rz) >= theta;
  if (hiZ && hiR) return "surge";
  if (hiZ) return "sustained";
  return "swift";
}

function directionOf(polarity: Series["polarity"], sign: 1 | -1): NodeDirection {
  // 域张力与宫位恒不判方向 —— 张力本就是「顺逆并存」的度量，
  // 给它定吉凶等于把已经拆开的东西又合回去。
  if (polarity === "neutral") return "neutral";
  const good = polarity === "favorable" ? sign > 0 : sign < 0;
  return good ? "opportunity" : "pressure";
}

// ─────────────────────────────────────────────────────────
// 理由
// ─────────────────────────────────────────────────────────

function shareDeltaOf(
  a: Readonly<Record<Element, number>>, b: Readonly<Record<Element, number>>,
): Record<Element, number> {
  const mA = ELEMENTS.reduce((t, e) => t + a[e], 0);
  const mB = ELEMENTS.reduce((t, e) => t + b[e], 0);
  if (mB <= 0) return Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
  const add = (mB - mA) / ELEMENTS.length;
  return Object.fromEntries(
    ELEMENTS.map((e) => [e, (b[e] - a[e] - add) / mB])) as Record<Element, number>;
}

/**
 * 节点的理由 —— **检出之后**才去找，神煞不参与检出。
 *
 * 这是「神煞更多是给盘面变化一个解释」的直接实现：
 * 曲线说「这里变了」，神煞与结构事件说「大概是因为这个」。
 * 按与进入点的时间距离升序 —— 最靠近进入点的，最像是引发它的。
 */
function reasonsAt(base: BaseChart, frames: readonly SeriesFrame[], enterIndex: number): NodeReason[] {
  const out: NodeReason[] = [];
  const window = [enterIndex - 1, enterIndex, enterIndex + 1].filter(
    (i) => i >= 0 && i < frames.length);

  for (const i of window) {
    const f = frames[i]!;
    const dist = Math.abs(i - enterIndex);
    const ev = evaluateAt(base, {
      luck: f.luckPillar === null ? null
        : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
      annual: f.annual, fleetingMonth: f.fleetingMonth,
    });

    for (const h of ev.shensha) {
      if (h.tone !== "activated") continue;
      out.push({ kind: "shensha", distanceMonths: dist,
        text: `${h.name}落${h.palace}被引动（${h.toneReason}）` });
    }
    for (const e of ev.events) {
      // 只取牵动大运或流年的 —— 纯本命的结构在基础盘里就有，不是这一刻的变化
      if (!e.pillars.includes("luck") && !e.pillars.includes("annual")) continue;
      out.push({ kind: "structure", distanceMonths: dist,
        text: `${e.narrativeTag}（${e.pillars.join("、")}）` });
    }
    for (const y of runYingqi({
      chart: base.chart, natal: base, now: ev,
      luck: f.luckPillar, annual: f.annual, scope: "year",
      shareDelta: shareDeltaOf(base.propagation.byElement, ev.propagation.byElement),
    }, "year")) {
      out.push({ kind: "yingqi", distanceMonths: dist,
        text: `${y.name}：${y.evidence}（${y.domains.map((d) => DOMAIN_LABEL[d]).join("、")}）` });
    }
  }

  const seen = new Set<string>();
  return out
    .filter((r) => { if (seen.has(r.text)) return false; seen.add(r.text); return true; })
    .sort((a, b) => a.distanceMonths - b.distanceMonths)
    .slice(0, 6);
}

// ─────────────────────────────────────────────────────────

interface Scaled {
  readonly values: readonly number[];
  /** 差分步长。月度序列取 12（同比），每步一值的中尺度取 1。 */
  readonly diffLag: number;
  /**
   * 一个采样点折合多少个月。
   *
   * `bridgeGapMonths` 的单位是**月**，而 `runsOf` 的单位是**采样点**，
   * 两者只在月度尺度上碰巧相等。中尺度一个点是一整步大运（120 月），
   * 若把 2 直接当作 2 个点，就成了「隔二十年也算同一段」。故此处折算。
   */
  readonly monthsPerSample: number;
  readonly frameOf: (i: number) => SeriesFrame;
  readonly lastFrameOf: (i: number) => SeriesFrame;
  readonly robust: boolean;
  readonly groups: readonly (readonly number[])[];
}

/** 把一条序列按尺度整理成「取值 + 分组 + 索引到时点的映射」。 */
function scaleView(s: Series, S: SeriesSet, scale: NodeScale): Scaled {
  const inWin = S.frames.map((f, i) => ({ f, i })).filter((x) => x.f.inStatsWindow);
  const idx = inWin.map((x) => x.i);

  if (scale === "medium") {
    // 每步大运一个均值。六十年六步 —— 故必须用稳健估计。
    const byStep = new Map<number | null, number[]>();
    const order: (number | null)[] = [];
    const first = new Map<number | null, number>();
    const last = new Map<number | null, number>();
    for (const i of idx) {
      const k = S.frames[i]!.luckIndex;
      if (!byStep.has(k)) { byStep.set(k, []); order.push(k); first.set(k, i); }
      byStep.get(k)!.push(s.values[i]!);
      last.set(k, i);
    }
    // 采样不足的那一「步」要丢掉 —— 它的均值与整步的均值不可比。
    //
    // 窗口起点通常落在起运之前，于是 `luckIndex` 为 null 的那一段只有几个月，
    // 均值却与整整十年的均值并列参与统计。实测：对一条纯线性上升的序列，
    // 这个残段自己就撑出一个 −2.23σ 的假中节点 —— 一条直线报出了「节点」。
    // 门槛取最长一步的一半，随采样密度自适应，不另设参数。
    const full = Math.max(...order.map((k) => byStep.get(k)!.length));
    const kept = order.filter((k) => byStep.get(k)!.length * 2 >= full);
    const values = kept.map((k) => mean(byStep.get(k)!));
    return {
      values,
      frameOf: (i) => S.frames[first.get(kept[i]!)!]!,
      lastFrameOf: (i) => S.frames[last.get(kept[i]!)!]!,
      robust: true, diffLag: 1, monthsPerSample: 120,
      groups: [values.map((_, i) => i)],
    };
  }

  const values = idx.map((i) => s.values[i]!);
  if (scale === "large") {
    return {
      values,
      frameOf: (i) => S.frames[idx[i]!]!,
      lastFrameOf: (i) => S.frames[idx[i]!]!,
      robust: false, diffLag: S.samplesPerYear, monthsPerSample: 12 / S.samplesPerYear,
      groups: [values.map((_, i) => i)],
    };
  }
  // small：基准窗是所在的那一步大运 —— 问的是「这个月在本运中有多异常」。
  // 区间不跨步：跨步的两点参照的是不同的基准，接成一段没有意义。
  const groups: number[][] = [];
  let cur: number[] = []; let prev: number | null | undefined;
  for (const [j, i] of idx.entries()) {
    const k = S.frames[i]!.luckIndex;
    if (prev !== undefined && k !== prev) { groups.push(cur); cur = []; }
    cur.push(j); prev = k;
  }
  if (cur.length > 0) groups.push(cur);
  return {
    values,
    frameOf: (i) => S.frames[idx[i]!]!,
    lastFrameOf: (i) => S.frames[idx[i]!]!,
    robust: false, diffLag: S.samplesPerYear, monthsPerSample: 12 / S.samplesPerYear,
    groups,
  };
}

// ─────────────────────────────────────────────────────────

const EMPTY: readonly NodeReason[] = Object.freeze([]);

/** 检出期的中间形态：理由还没找，只带一个能找它的闭包。 */
interface Pending extends NodeInterval {
  readonly resolve: () => NodeReason[];
}

/**
 * 检出一个尺度上的全部穿越区间。
 *
 * `override` 逐字段盖在盘的 `params.nodes` 之上 —— 调门槛只需 `{ threshold: 1.5 }`，
 * 不必凑齐整份参数。默认门槛 θ = 2（`params/default.yaml` 的 `nodes.threshold`）。
 */
export function findNodes(
  S: SeriesSet, scale: NodeScale, override?: Partial<NodesParams>,
): NodeSet {
  const p: NodesParams = { ...S.base.params.nodes, ...override };
  const nodes: Pending[] = [];
  const excluded: { seriesId: string; why: string }[] = [];

  for (const s of S.series) {
    const view = scaleView(s, S, scale);
    if (view.values.length < 3) { excluded.push({ seriesId: s.id, why: "采样点不足" }); continue; }

    let anyGroup = false;
    for (const g of view.groups) {
      if (g.length < 3) continue;
      const vs = g.map((i) => view.values[i]!);
      const { center, sigma } = view.robust
        ? robustSigma(vs)
        : { center: mean(vs), sigma: stdev(vs) };
      if (sigma <= 0) continue;
      anyGroup = true;

      // 同比差分。步长取一整年，以消掉立春换柱那个确定性的年周期阶跃。
      const P = view.diffLag;
      const d = vs.map((v, i) => (i < P ? Number.NaN : v - vs[i - P]!));
      const dReal = d.filter((x) => Number.isFinite(x));
      const dSigma = stdev(dReal);
      const dCenter = mean(dReal);

      const z = vs.map((v) => (v - center) / sigma);
      const rz = d.map((v) => (!Number.isFinite(v) || dSigma <= 0 ? 0 : (v - dCenter) / dSigma));
      const m = z.map((v, i) => Math.max(Math.abs(v), Math.abs(rz[i]!)));
      const signs = z.map((v) => (v >= 0 ? 1 : -1) as 1 | -1);

      const bridge = Math.floor(p.bridgeGapMonths / view.monthsPerSample);
      for (const r of runsOf(m, signs, p.threshold, bridge)) {
        const peakLocal = r.peak;
        const peakValue = vs[peakLocal]!;
        // 峰是被水平驱动的还是被变化率驱动的 —— 定吉凶只认驱动它的那一个
        const drive = Math.abs(z[peakLocal]!) >= Math.abs(rz[peakLocal]!)
          ? z[peakLocal]! : rz[peakLocal]!;
        const driveSign: 1 | -1 = drive >= 0 ? 1 : -1;
        // 反向护栏之二：峰值须真的动了，否则近乎平直的序列会刷出满屏节点
        const refScale = Math.max(Math.abs(center), Math.abs(s.baseValue), 1e-9);
        if (Math.abs(peakValue - center) < p.minRelativeSwing * refScale) continue;

        const enterF = view.frameOf(g[r.from]!);
        const exitF = view.lastFrameOf(g[r.to]!);
        const peakF = view.frameOf(g[peakLocal]!);
        const area = Array.from({ length: r.to - r.from + 1 },
          (_, k) => m[r.from + k]! - p.threshold).reduce((a, b) => a + b, 0);

        nodes.push({
          seriesId: s.id, label: s.label, scale,
          shape: shapeOf(z[peakLocal]!, rz[peakLocal]!, p.threshold),
          direction: directionOf(s.polarity, driveSign),
          sign: r.sign, driveSign,
          monthResolved: s.monthResolving,
          enter: { year: enterF.year, monthIndex: enterF.monthIndex },
          peak: { year: peakF.year, monthIndex: peakF.monthIndex },
          exit: { year: exitF.year, monthIndex: exitF.monthIndex },
          durationMonths: (r.to - r.from + 1) * view.monthsPerSample,
          peakZ: z[peakLocal]!, peakRateZ: rz[peakLocal]!,
          area, peakValue, mean: center, sigma,
          groupSize: g.length,
          nearBaseline: z.reduce((a, v) => a + (Math.abs(v) < 1 ? 1 : 0), 0),
          // 理由**在截断之后**才填 —— 见下方 fillReasons
          reasons: EMPTY,
          resolve: scale === "medium"
            // 中尺度的「理由」就是那几步大运本身 —— 十年之变，因在运不在年
            ? () => luckReasons(S, g.slice(r.from, r.to + 1).map((i) => view.frameOf(i)))
            : () => reasonsAt(S.base, S.frames, indexOfFrame(S, enterF)),
        });
      }
    }
    if (!anyGroup) {
      excluded.push({ seriesId: s.id, why: "散布为零 —— 全程取值不变，无偏离可言" });
    }
  }

  nodes.sort((a, b) => Math.abs(b.peakZ) - Math.abs(a.peakZ));
  // 理由要跑 evaluateAt 与一遍应期，每条约 4 ms。对全部越阈段都算，
  // 而后只留前十二条，就是把九成五的工作丢掉 —— 实测浏览器里主线程
  // 因此卡住近一秒。故先排序截断，再给留下来的那几条找理由。
  const kept = nodes.slice(0, p.maxShown).map(({ resolve, ...n }): NodeInterval =>
    ({ ...n, reasons: resolve() }));
  return {
    base: S.base, scale, total: nodes.length,
    nodes: kept, excluded, threshold: p.threshold,
  };
}

/** 中尺度的理由：涉及的大运柱及其与用神的关系。 */
function luckReasons(S: SeriesSet, frames: readonly SeriesFrame[]): NodeReason[] {
  const y = S.base.conclusions.yongshen.value;
  const fav = new Set<Element>([y.primary, ...y.xishen]);
  const adv = new Set<Element>([...y.jishen, ...y.choushen]);
  const seen = new Set<number>();
  const out: NodeReason[] = [];
  for (const f of frames) {
    if (f.luckPillar === null || f.luckIndex === null || seen.has(f.luckIndex)) continue;
    seen.add(f.luckIndex);
    const el = elementOf(f.luckPillar.stem);
    const rel = fav.has(el) ? "属喜用" : adv.has(el) ? "属忌仇" : "为闲神";
    out.push({
      kind: "structure", distanceMonths: 0,
      text: `第 ${f.luckIndex} 步大运 ${f.luckPillar.stem}${f.luckPillar.branch}，天干之${el}${rel}`,
    });
  }
  return out;
}

function indexOfFrame(S: SeriesSet, f: SeriesFrame): number {
  const i = S.frames.indexOf(f);
  return i >= 0 ? i : 0;
}

/**
 * 一条序列在统计窗内的中心与散布 —— **与大尺度节点检出用的是同一个估计量**。
 *
 * 供绘图：曲线上画的 ±θσ 界线若与节点层算的不是同一个 σ，
 * 图上看到的穿越点就对不上报告里列的节点 —— 那比不画还糟。
 */
export function curveStats(
  S: SeriesSet, s: Series,
): { readonly center: number; readonly sigma: number; readonly inWindow: readonly number[] } {
  const vs = S.frames.map((f, i) => ({ f, i }))
    .filter((x) => x.f.inStatsWindow)
    .map((x) => s.values[x.i]!);
  return { center: mean(vs), sigma: stdev(vs), inWindow: vs };
}

/** 三个尺度一次算齐。`override` 同 {@link findNodes}。 */
export function allNodes(
  S: SeriesSet, override?: Partial<NodesParams>,
): Readonly<Record<NodeScale, NodeSet>> {
  return Object.freeze({
    small: findNodes(S, "small", override),
    medium: findNodes(S, "medium", override),
    large: findNodes(S, "large", override),
  });
}

// ═════════════════════════════════════════════════════════
// 门槛穿越 —— 曲线与 ±θσ 两条横线的交点
// ═════════════════════════════════════════════════════════

/**
 * 一段**越过门槛的时期**，以及它的两个端点（即曲线与 ±θσ 的交点）。
 *
 * ## 为什么报区间而不报一串点
 *
 * 一条在门槛附近摆动的曲线，几十个采样点里能穿出几十次交点 ——
 * 那串点逐个都是真的，合起来却什么也说不出。
 * 把相邻的穿越并成**一段**，两个端点正是穿入与穿出的那两个交点，
 * 中间再给一个峰值点。这样既没丢掉交点，也没把抖动当成几十件事。
 *
 * ## ⚠️ 时间报到哪一级，由序列自己决定
 *
 * 权重类序列**流月不进权重**，真正的跳变全在立春换柱那一刻。
 * 对它们写「2046 年午月穿越」是伪精度 —— 说的其实是「2046 这个立春年」。
 * 故 `monthResolved` 取自 `Series.monthResolving`，为 false 时上层**只许报到年**。
 *
 * 这与 `NodeInterval` 同一条规矩，不是另立一套。
 *
 * ## 与 `findNodes` 的分别
 *
 * `findNodes` 取 `max(|z|, |ż|)` —— 它把「一直很极端」与「正在急速穿过」
 * 都算作节点，那是两层结论要的东西。
 *
 * 这里只看 **|z| 本身**：曲线与那两条横线的交点，一条几何事实。
 * 两者会给出不同的区间，而那不是矛盾 —— 它们问的不是同一个问题。
 */
/**
 * 交点落在**哪一刻**，以及那个「哪一刻」是怎么来的。
 *
 * 要把交点报到日，就必须先回答一个问题：**两个采样点之间，曲线是什么？**
 * 图上画的是直线，但那条直线是画出来的，不是算出来的。真正的形状有三种，
 * 对应的「日」是三种完全不同的东西 —— 混成一个数字报出去，才是伪精度。
 *
 * | basis | 这一刻由什么定 | 误差来源 |
 * | -- | -- | -- |
 * | `"pillarStep"` | 换柱那一刻：立春，或大运边界 | 立春本身的求解容差（60 秒，且 2050 年后不承诺）；大运边界按构造精确 |
 * | `"jieStep"` | 流月符号换支那一刻：那个**节** | 同上，节气求解容差 |
 * | `"chord"` | 相邻两采样连线与门槛的交点 | 曲线偏离那条弦的程度 —— 逐个交点现算，不给全局常数 |
 * | `"interval"` | **定不出来**：区间内有跳变，但无可归因的边界 | 半个采样间隔（约 15 日） |
 *
 * ## 为什么 `jieStep` 不直接取采样点的 jd
 *
 * 采样点是 `立春 + m × 30.44 日`——**回归年的等分**，不是真节。
 * 实测（1960–2060，每 5 年一取，252 个节）：
 *
 * ```
 * |等分 − 真节|   中位 0.96 日   90% 2.76 日   最大 3.00 日（寒露）
 * ```
 *
 * 偏差是**系统性**的，不是随机的：立春处为 0（锚点），春季渐正至 +0.93，
 * 盛夏转负，寒露达 −2.96，再回零。来历是地球轨道偏心 ——
 * 近日点附近太阳视黄经走得快，等时长的格子装不下等黄经的月。
 *
 * 报到月时这 3 天看不见；报到日时它就是全部误差。所以 `jieStep` 去解真节
 * （`jieMonthBounds`，六爻应期在用的同一份），不用采样网格。
 *
 * ## 为什么 `chord` 的误差要逐个算
 *
 * 块内线性的序列上，弦插值**就是函数本身**（实测二阶差分 ≤ 6e-3，见
 * `Series.withinBlock`）。但曲线若近乎相切地擦过门槛，`|Δz|` 趋零，
 * 同样的 z 误差折成的日期误差就会放大。实测这个上界的分布：
 *
 * ```
 * 中位 0.004 日   90% 0.036 日   99% 1.12 日   最大 105 日
 * ```
 *
 * 那个 105 日不是算错，是**那一处的「日」本就没有意义** ——
 * 曲线在门槛上趴着，问它哪一天穿过去等于问一条水平线哪一天穿过自己。
 * 所以每个交点带自己的 `uncertaintyDays`，由局部几何现算。
 */
export type CrossingBasis = "pillarStep" | "jieStep" | "chord" | "interval";

export interface CrossingInstant {
  /** 儒略日（UT）。 */
  readonly jd: number;
  /** 公历年月日 —— 上层不必再解一次。 */
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly basis: CrossingBasis;
  /**
   * 这个日期的误差半径（日）。**来历不同，这个数的来源完全不同** —— 见 CrossingBasis。
   * 它不是置信区间，没有分布假设；它是「这个日子最多能差多少」的量级。
   */
  readonly uncertaintyDays: number;
}

export interface ThresholdCrossing {
  readonly seriesId: string;
  readonly label: string;
  /** +1 高于 +θσ；−1 低于 −θσ。**两者都是穿越**，不分吉凶。 */
  readonly sign: 1 | -1;
  /** 穿入的那一个采样点 —— 第一个落在门槛之外的点。 */
  readonly enter: TimeMark;
  /** 穿出的那一个采样点。`null` 表示到绘制末尾仍未回到门槛以内。 */
  readonly exit: TimeMark | null;
  /** 区间内 |z| 最大的那一点。 */
  readonly peak: TimeMark;
  readonly peakZ: number;
  /** 采样点数。月采样时即月数。 */
  readonly samples: number;
  /**
   * 时间是否报得到月。false 时上层**只许报到年** —— 见上文。
   */
  readonly monthResolved: boolean;
  /** 该序列是用神向、忌神向，还是不判方向。穿越本身不含吉凶。 */
  readonly polarity: Series["polarity"];
  /**
   * 穿入那一刻，报到日。`null` 表示穿越发生在窗口**之前** ——
   * 第一个采样点就已在门槛之外，没有前一点可据，定不出时刻。
   */
  readonly enterAt: CrossingInstant | null;
  /** 穿出那一刻，报到日。`null` 表示到末尾仍未回到门槛以内。 */
  readonly exitAt: CrossingInstant | null;
}

/**
 * 一条序列与 ±θσ 的全部交点，按区间归并。
 *
 * @param theta 门槛，单位标准差。与界面上那两条虚线同一个值。
 * @param from  只看这一段（显示窗口）。不给即全段。
 */
export function thresholdCrossings(
  S: SeriesSet, s: Series, theta: number,
  range?: { readonly from: number; readonly to: number },
): readonly ThresholdCrossing[] {
  const { center, sigma } = curveStats(S, s);
  // σ 为 0 即这条序列在基准窗里纹丝不动 —— 此时任何 z 都没有意义，
  // 返回空而不是返回一堆 0/0。
  if (!(sigma > 0)) return [];
  const lo = Math.max(0, range?.from ?? 0);
  const hi = Math.min(S.frames.length - 1, range?.to ?? S.frames.length - 1);

  const markOf = (i: number): TimeMark => ({
    year: S.frames[i]!.year, monthIndex: S.frames[i]!.monthIndex,
  });
  const zAt = (i: number) => (s.values[i]! - center) / sigma;

  /**
   * 把一个「从 i−1 到 i 之间穿过了 targetZ」的事实定到某一日。
   * 四条分支的理由见 CrossingBasis 的注释 —— 这里只写判别顺序为何如此。
   */
  const instantAt = (i: number, targetZ: number): CrossingInstant | null => {
    if (i <= lo) return null;          // 窗口第一点就在外面：穿越在窗口之前
    const f = S.frames[i]!;
    const p = S.frames[i - 1]!;
    const mk = (jd: number, basis: CrossingBasis, unc: number): CrossingInstant => {
      const c = fromJulianDay(jd);
      return { jd, year: c.year, month: c.month, day: c.day, basis, uncertaintyDays: unc };
    };
    // 节气求解的容差是 60 秒。越过 `horizon.ts` 那条地平线之后引擎不再承诺这一条，
    // 故按档放宽 —— 门槛取自 horizon.ts，不在这里另写一个年份。
    // 这不是「那以后算不准」：柱序走六十甲子定序推进，不受影响；
    // 受影响的只有「哪一刻换柱」，而这里报的恰好就是那一刻，所以必须跟着放宽。
    const band = precisionBandOf(f.year);
    const termUnc = band === "guaranteed" ? 60 / 86400
      : band === "beyondTolerance" ? 0.01 : 0.1;

    // ① 先把这个区间内**能解释这次跳变**的边界全收起来，再看有几个。
    //    不要一判到就返回 —— 两个独立边界落在同一区间时，归因并不唯一，
    //    而先判到的那一个会把这件事盖掉。
    const cands: { jd: number; basis: CrossingBasis; unc: number }[] = [];
    if (s.monthResolving) {
      // 吃流月的序列：符号在**节**上换，所以跳变就在那个节。
      // 用真节，不用采样网格 —— 两者最多差 3.00 日。
      // 寅月那一格的节正是立春，于是「换年柱」与「换流月」是同一刻，不另记。
      cands.push({
        jd: jieMonthBounds(f.year, f.monthIndex).openJd, basis: "jieStep", unc: termUnc,
      });
    } else if (f.monthIndex === 0 && f.year !== p.year) {
      // 权重类不吃流月，年内唯一的阶跃是立春换年柱
      cands.push({ jd: lichunJdOf(f.year), basis: "pillarStep", unc: termUnc });
    }
    if (f.luckIndex !== p.luckIndex) {
      const lp = S.base.chart.luck.pillars.find((x) => x.index === f.luckIndex);
      // 大运边界按构造精确（起运时刻 + 整数倍回归年），不带节气容差
      if (lp !== undefined) cands.push({ jd: lp.startJd, basis: "pillarStep", unc: 1 / 86400 });
    }
    if (cands.length === 1) {
      const c = cands[0]!;
      return mk(c.jd, c.basis, c.unc);
    }
    if (cands.length > 1) {
      // 一个区间里换了柱又换了流月 —— 两刻都足以解释，而序列只给了一个跳变。
      // 报晚的那一刻，误差半径取两刻之间的跨度：说「是这两者之一」，
      // 而不是挑一个装作确定。十年一遇，但遇上时不许含糊。
      const jds = cands.map((c) => c.jd);
      const late = Math.max(...jds);
      const early = Math.min(...jds);
      return mk(late, "interval", Math.max(late - early, ...cands.map((c) => c.unc)));
    }
    // ② 块内线性：弦插值即函数本身。误差由局部二阶差分现算。
    if (s.withinBlock === "linear") {
      const zp = zAt(i - 1);
      const zc = zAt(i);
      const dz = zc - zp;
      if (Math.abs(dz) > 1e-12) {
        const t = (targetZ - zp) / dz;
        const jd = p.jd + Math.min(1, Math.max(0, t)) * (f.jd - p.jd);
        // 弦与真曲线的最大偏离约 |z''|h²/8，折成横坐标 ≈ h·|Δ²z|/(8|Δz|)。
        // 取 i 两侧可得的二阶差分；取不到就按线性当作无偏。
        const z2 = (i + 1 <= hi) ? Math.abs(zAt(i + 1) - 2 * zc + zp) : 0;
        const h = f.jd - p.jd;
        return mk(jd, "chord", Math.min(h / 2, h * z2 / (8 * Math.abs(dz))));
      }
    }
    // ③ 块内是阶梯而又无边界可归因（域序列：应期规则离散触发）。
    //    跳变确实发生在这个区间内，但发生在哪一刻定不出来 —— 给中点与半区间，
    //    而不是拿弦插值假装算得出来。
    const h = f.jd - p.jd;
    return mk(p.jd + h / 2, "interval", h / 2);
  };

  const out: ThresholdCrossing[] = [];
  let run: { sign: 1 | -1; start: number; peak: number; peakZ: number } | null = null;

  const flush = (endExclusive: number) => {
    if (run === null) return;
    out.push({
      seriesId: s.id, label: s.label, sign: run.sign,
      enter: markOf(run.start),
      // 跑到窗口末尾还没回来 —— 给 null，不要拿末点冒充穿出点
      exit: endExclusive > hi ? null : markOf(endExclusive),
      peak: markOf(run.peak), peakZ: run.peakZ,
      samples: Math.min(endExclusive, hi + 1) - run.start,
      monthResolved: s.monthResolving,
      polarity: s.polarity,
      enterAt: instantAt(run.start, run.sign * theta),
      exitAt: endExclusive > hi ? null : instantAt(endExclusive, run.sign * theta),
    });
    run = null;
  };

  for (let i = lo; i <= hi; i++) {
    const z = (s.values[i]! - center) / sigma;
    const side: 1 | -1 | 0 = z >= theta ? 1 : z <= -theta ? -1 : 0;
    if (side === 0) { flush(i); continue; }
    if (run === null || run.sign !== side) {
      flush(i);
      run = { sign: side, start: i, peak: i, peakZ: z };
    } else if (Math.abs(z) > Math.abs(run.peakZ)) {
      run.peak = i; run.peakZ = z;
    }
  }
  flush(hi + 1);
  return Object.freeze(out);
}

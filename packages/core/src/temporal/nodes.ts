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

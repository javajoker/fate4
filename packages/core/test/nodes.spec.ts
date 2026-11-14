import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildSeries, type Series, type SeriesSet } from "../src/temporal/series.js";
import { evaluateAt } from "../src/temporal/evaluate.js";
import {
  allNodes, findNodes, robustSigma, curveStats, thresholdCrossings,
} from "../src/temporal/nodes.js";
import { loadParams } from "../src/params/load.js";
import { aggregateDomains } from "../src/yingqi/domains.js";
import { runYingqi } from "../src/yingqi/engine.js";
import { ELEMENTS, type Element } from "../src/types/ganzhi.js";
import type { BirthInput } from "../src/chart/types.js";

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const base = buildBaseChart(buildChart(EXAMPLE));
const S = buildSeries(base);
const N = allNodes(S, { maxShown: 9999 });
const SCALES = ["small", "medium", "large"] as const;

/** 把 S 的时间骨架保留，只换掉序列 —— 索引到时点的映射照旧成立。 */
function synth(specs: readonly Partial<Series>[]): SeriesSet {
  return {
    ...S,
    series: specs.map((sp, k) => {
      const values = sp.values ?? [];
      expect(values, "合成序列长度须与采样点数一致").toHaveLength(S.frames.length);
      return {
        id: sp.id ?? `synth.${k}`, kind: "metric", label: sp.id ?? `合成${k}`,
        baseValue: sp.baseValue ?? 0, values, deltas: values.map((v) => v - (sp.baseValue ?? 0)),
        polarity: sp.polarity ?? "neutral", monthResolving: sp.monthResolving ?? false,
        withinBlock: sp.withinBlock ?? "linear",
      } satisfies Series;
    }),
  };
}
const fill = (f: (i: number) => number) => S.frames.map((_, i) => f(i));

// ═══════════════════════════════════════════════════════════

describe("估计量", () => {
  it("**n=6 时 MAD 与样本 σ 给出的答案根本不同 —— 这就是中尺度必须用 MAD 的理由**", () => {
    // 六步大运里有一步离群。样本 σ 被这一步自己撑大，于是它自己不再离群。
    const xs = [10, 10, 11, 11, 12, 60];
    const { center, sigma } = robustSigma(xs);
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sampleSigma = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);

    expect(sampleSigma / sigma, "样本 σ 被离群点自身撑大了一个量级").toBeGreaterThan(10);
    expect((60 - center) / sigma, "稳健标度下这一步显然离群").toBeGreaterThan(20);
    expect(Math.abs(60 - m) / sampleSigma, "样本标度下它勉强够 2σ —— 掩蔽效应").toBeLessThan(2.5);
  });

  it("散布为零时返回 0，不作任何回退", () => {
    expect(robustSigma([5, 5, 5, 5, 5, 5]).sigma).toBe(0);
    // 过半取值相同 → MAD 为 0。此时确实没有可言的「常态散布」，宁可不报
    expect(robustSigma([1, 1, 1, 1, 5, 9]).sigma).toBe(0);
  });
});

describe("**反向对照 —— 没有这几条，「检出了 N 个节点」可能只是噪声**", () => {
  it("平直序列一条节点不出，且明写进 excluded", () => {
    for (const scale of SCALES) {
      const set = findNodes(synth([{ id: "flat", values: fill(() => 42) }]), scale);
      expect(set.nodes, `${scale}：全程恒定却报出了节点`).toHaveLength(0);
      expect(set.excluded.map((e) => e.seriesId)).toContain("flat");
    }
  });

  it("**六十年单调线性上升也不是节点** —— 水平最多 √3 σ，一阶差分又恒定", () => {
    const ramp = synth([{ id: "ramp", values: fill((i) => i) }]);
    for (const scale of SCALES) {
      expect(findNodes(ramp, scale).nodes, `${scale}：把一条直线报成了节点`).toHaveLength(0);
    }
  });

  it("近乎平直加一个微抖：σ>0、z≈11，仍被 minRelativeSwing 挡下", () => {
    const spike = synth([{ id: "spike", baseValue: 100,
      values: fill((i) => (i === 300 ? 100.0001 : 100)) }]);
    expect(findNodes(spike, "large").nodes, "微抖被报成了节点").toHaveLength(0);
    const loose = findNodes(spike, "large", { minRelativeSwing: 0 });
    expect(loose.nodes.length, "把护栏放开就该出现 —— 否则这条测试什么也没证明")
      .toBeGreaterThan(0);
    expect(Math.abs(loose.nodes[0]!.peakZ)).toBeGreaterThan(5);
  });

  it("护栏在真盘上确有咬合率，不是摆设", () => {
    const on = findNodes(S, "large", { maxShown: 9999 }).nodes.length;
    const off = findNodes(S, "large", { maxShown: 9999, minRelativeSwing: 0 }).nodes.length;
    expect(off, "minRelativeSwing 在真盘上一条都没挡下 —— 那它是死码").toBeGreaterThan(on);
  });

  it("**没有一段穿越占得下半个基准窗 —— 这是算得出来的，故不设护栏**", () => {
    // 中尺度用 MAD：若过半的点满足 d ≥ 2.965·MAD，则 MAD ≥ 2.965·MAD，只能 MAD=0，
    // 而那时 σ=0，序列本就被排除。小、大两尺度用样本 σ：Σz²=n 强制 |z|≥2 的点不超过 n/4。
    // 桥接不跨号，而尖峰的变化率必一升一降成对出现，链条总被异号段打断。
    for (const scale of SCALES) {
      const win = scale === "medium" ? 6 : S.frames.length;
      for (const t of [1.5, 2, 3]) {
        for (const n of findNodes(S, scale, { threshold: t, maxShown: 9999 }).nodes) {
          const span = n.durationMonths / (scale === "medium" ? 120 : 1);
          expect(span / win, `${scale} θ=${t}：${n.seriesId} 占了 ${span}/${win} 个基准窗`)
            .toBeLessThanOrEqual(0.5);
        }
      }
    }
  });

  it("桥接不跨号 —— 一列周期尖峰不会被接成一条覆盖全窗的假节点", () => {
    // 每二十个月一根尖峰，单看每根都够 4σ。桥距放到 20 也不该把它们串起来：
    // 每根尖峰的变化率一升一降，中间隔着异号的段。
    const teeth = synth([{ id: "teeth", values: fill((i) => (i % 20 === 0 ? 1 : 0)) }]);
    const ns = findNodes(teeth, "large", { bridgeGapMonths: 20, maxShown: 9999 }).nodes;
    expect(ns.length, "尖峰各自成节点，不该串成一条").toBeGreaterThan(30);
    expect(Math.max(...ns.map((n) => n.durationMonths)), "串起来了").toBeLessThan(20);
  });

  it("**采样不足的那一「步」不参与中尺度统计** —— 起运前的残段撑得出假节点", () => {
    const counts = new Map<number | null, number>();
    for (const f of S.frames) {
      if (f.inStatsWindow) counts.set(f.luckIndex, (counts.get(f.luckIndex) ?? 0) + 1);
    }
    expect(counts.get(null), "这张盘的窗口起点本该落在起运之前，残段只有几个月")
      .toBeLessThan(12);
    // 若残段参与，一条纯直线会被它撑出 −2.23σ 的中节点
    expect(findNodes(synth([{ id: "ramp", values: fill((i) => i) }]), "medium").nodes)
      .toHaveLength(0);
  });
});

describe("门槛", () => {
  it("默认 2σ，且回写在结果里", () => {
    expect(base.params.nodes.threshold).toBe(2);
    for (const scale of SCALES) expect(N[scale].threshold).toBe(2);
    expect(findNodes(S, "large", { threshold: 1.5 }).threshold).toBe(1.5);
  });

  it("**门槛单调：调高只会更少** —— 它是「取多少条」的旋钮，不是显著性水平", () => {
    for (const scale of SCALES) {
      const n = [1.5, 2.0, 2.5, 3.0].map(
        (t) => findNodes(S, scale, { threshold: t, maxShown: 9999 }).nodes.length);
      for (let i = 1; i < n.length; i++) {
        expect(n[i]!, `${scale}：θ 从 ${[1.5, 2, 2.5, 3][i - 1]} 提到 ${[1.5, 2, 2.5, 3][i]} 反而多了`)
          .toBeLessThanOrEqual(n[i - 1]!);
      }
      expect(n[0]!, `${scale}：θ 完全不起作用`).toBeGreaterThan(n[3]!);
    }
  });

  it("覆盖是逐字段的 —— 只给门槛，其余仍取盘上的参数", () => {
    const set = findNodes(S, "large", { threshold: 3 });
    expect(set.threshold).toBe(3);
    // maxShown 未覆盖，仍是盘上的 12
    expect(set.nodes.length).toBeLessThanOrEqual(base.params.nodes.maxShown);
  });
});

describe("区间", () => {
  it("进入 ≤ 峰 ≤ 退出，且时长与两端对得上", () => {
    for (const scale of SCALES) {
      for (const n of N[scale].nodes) {
        const key = (t: { year: number; monthIndex: number }) => t.year * 12 + t.monthIndex;
        expect(key(n.enter), `${n.seriesId} 峰落在进入之前`).toBeLessThanOrEqual(key(n.peak));
        expect(key(n.peak), `${n.seriesId} 峰落在退出之后`).toBeLessThanOrEqual(key(n.exit));
        expect(n.durationMonths).toBeGreaterThan(0);
      }
    }
  });

  it("中尺度的时长恒为整步大运 —— 桥接门槛按月折算，2 月折不出一步", () => {
    for (const n of N.medium.nodes) expect(n.durationMonths % 120).toBe(0);
    // 若不折算，bridgeGapMonths=2 会被当作「隔两步大运也算同一段」
    const wide = findNodes(S, "medium", { maxShown: 9999, bridgeGapMonths: 240 });
    const tight = findNodes(S, "medium", { maxShown: 9999, bridgeGapMonths: 2 });
    expect(wide.nodes.length, "把门槛提到 240 月（两步）才该开始合并")
      .toBeLessThan(tight.nodes.length);
  });

  it("**上下两侧都算节点** —— 低于常态与高于常态同样入选", () => {
    for (const scale of SCALES) {
      const signs = new Set(N[scale].nodes.map((n) => n.sign));
      expect(signs, `${scale}：只报了单侧偏离`).toEqual(new Set([1, -1]));
    }
  });

  it("同号相邻两段按 bridgeGapMonths 合并", () => {
    // 两个正向鼓包，中间隔 15 个月
    const two = synth([{ id: "two",
      values: fill((i) => ((i >= 300 && i < 330) || (i >= 345 && i < 375) ? 10 : 0)) }]);
    const split = findNodes(two, "large", { bridgeGapMonths: 0 }).nodes;
    const merged = findNodes(two, "large", { bridgeGapMonths: 24 }).nodes;
    expect(split.length, "隔十五个月本该是两段").toBeGreaterThan(merged.length);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.durationMonths).toBeGreaterThan(
      Math.max(...split.map((n) => n.durationMonths)));
  });
});

describe("方向与形态", () => {
  it("不判方向的序列恒不判方向 —— 宫位、域张力、显隐比", () => {
    for (const scale of SCALES) {
      for (const n of N[scale].nodes) {
        const s = S.series.find((x) => x.id === n.seriesId)!;
        if (s.polarity === "neutral") {
          expect(n.direction, `${n.seriesId} 给了一个它没有的吉凶`).toBe("neutral");
        } else {
          expect(n.direction).not.toBe("neutral");
        }
      }
    }
    expect(N.small.nodes.some((n) => n.direction === "neutral"), "一条不判方向的都没有").toBe(true);
  });

  it("用神向升为机会、降为压力；忌神向相反", () => {
    const up = fill((i) => (i >= 300 && i < 340 ? 10 : 0));
    const down = up.map((v) => -v);
    const pick = (values: number[], polarity: Series["polarity"]) => {
      const ns = findNodes(synth([{ id: "d", values, polarity }]), "large").nodes;
      expect(ns.length).toBeGreaterThan(0);
      return ns.filter((n) => n.shape !== "swift")[0] ?? ns[0]!;
    };
    expect(pick(up, "favorable").direction).toBe("opportunity");
    expect(pick(down, "favorable").direction).toBe("pressure");
    expect(pick(up, "adverse").direction).toBe("pressure");
    expect(pick(down, "adverse").direction).toBe("opportunity");
  });

  it("**急速穿越的方向取变化率，不取水平** —— 峰处水平就在常态上，用它判吉凶等于掷硬币", () => {
    for (const scale of SCALES) {
      for (const n of N[scale].nodes) {
        if (n.shape === "swift") {
          expect(Math.abs(n.peakZ), "急速穿越的水平不该达到门槛").toBeLessThan(N[scale].threshold);
          expect(n.driveSign, "急速穿越应由变化率定向")
            .toBe(n.peakRateZ >= 0 ? 1 : -1);
        } else {
          expect(Math.abs(n.peakZ)).toBeGreaterThanOrEqual(N[scale].threshold);
          expect(n.driveSign).toBe(n.sign);
        }
      }
    }
  });

  it("形态三分与 |z|、|ż| 自洽，且三种都出得来", () => {
    const seen = new Set(SCALES.flatMap((s) => N[s].nodes.map((n) => n.shape)));
    expect(seen).toEqual(new Set(["sustained", "swift", "surge"]));
    for (const scale of SCALES) {
      for (const n of N[scale].nodes) {
        const hiZ = Math.abs(n.peakZ) >= N[scale].threshold;
        const hiR = Math.abs(n.peakRateZ) >= N[scale].threshold;
        expect(n.shape).toBe(hiZ && hiR ? "surge" : hiZ ? "sustained" : "swift");
      }
    }
  });
});

describe("**立春 —— 月序何时携带信息，何时是伪精度**", () => {
  it("只有扰动序列吃流月；权重类与应期域换个流月毫无变化", () => {
    const f = S.frames[300]!;
    const at = (fm: typeof f.fleetingMonth) => evaluateAt(base, {
      luck: f.luckPillar === null ? null : { pillar: f.luckPillar, elapsedYears: f.elapsedYears },
      annual: f.annual, fleetingMonth: fm,
    });
    const other = S.frames[303]!.fleetingMonth;
    const a = at(f.fleetingMonth); const b = at(other);
    expect(b.conclusions.tenGods, "换个流月，十神权重变了 —— 流月不该加权").toEqual(a.conclusions.tenGods);
    expect(b.propagation.byElement).toEqual(a.propagation.byElement);

    const dom = (ev: typeof a) => aggregateDomains(runYingqi({
      chart: base.chart, natal: base, now: ev, luck: f.luckPillar, annual: f.annual,
      scope: "year",
      shareDelta: Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<Element, number>,
    }, "year"));
    expect(dom(b).map((d) => [d.domain, d.net, d.tension]))
      .toEqual(dom(a).map((d) => [d.domain, d.net, d.tension]));

    for (const s of S.series) {
      expect(s.monthResolving, `${s.id} 的 monthResolving 与它是不是扰动序列对不上`)
        .toBe(s.kind === "agitation");
    }
  });

  it("**权重类节点绝大多数起于寅月 —— 这是模型的直陈，不是噪声**", () => {
    const kindOf = new Map(S.series.map((s) => [s.id, s]));
    const split = (want: boolean) => {
      const ns = findNodes(S, "large", { maxShown: 9999 }).nodes
        .filter((n) => kindOf.get(n.seriesId)!.monthResolving === want);
      return ns.filter((n) => n.enter.monthIndex === 0).length / ns.length;
    };
    expect(split(false), "权重类若不集中在寅月，说明流月悄悄进了权重").toBeGreaterThan(0.6);
    expect(split(true), "扰动类也集中在寅月，说明流月其实没进符号层").toBeLessThan(0.6);
  });

  it("monthResolved 随序列走 —— 报告据此决定报到年还是报到月", () => {
    for (const scale of SCALES) {
      for (const n of N[scale].nodes) {
        expect(n.monthResolved).toBe(S.series.find((s) => s.id === n.seriesId)!.monthResolving);
      }
    }
    expect(N.small.nodes.some((n) => n.monthResolved)).toBe(true);
    expect(N.small.nodes.some((n) => !n.monthResolved)).toBe(true);
  });
});

describe("理由", () => {
  it("**神煞不入权重，故换一套神煞开关，权重类的节点逐字不变**", () => {
    // 神煞只在符号层。多开三种有争议的起例，权重类序列一动不动；
    // 会动的只有应期域 —— 而域本来就是「解释」那一层。
    const more = buildBaseChart(buildChart(EXAMPLE), loadParams({
      shensha: { includeDisputed: true, yinYangRen: true, yuanchen: true },
    }));
    const S2 = buildSeries(more);
    const weightOnly = (set: SeriesSet, scale: "large") =>
      findNodes(set, scale, { maxShown: 9999 }).nodes
        .filter((n) => !n.seriesId.startsWith("domain."))
        .map((n) => [n.seriesId, n.enter, n.exit, n.peakZ.toFixed(9)]);
    expect(weightOnly(S2, "large")).toEqual(weightOnly(S, "large"));

  });

  it("神煞确实到得了「理由」这一层 —— 它解释，不检出", () => {
    const kinds = new Set(N.small.nodes.flatMap((n) => n.reasons.map((r) => r.kind)));
    expect(kinds, "小节点一条神煞理由都没有 —— 那「神煞给盘面变化一个解释」是空话")
      .toContain("shensha");
    for (const n of N.small.nodes) {
      for (const r of n.reasons) {
        if (r.kind === "shensha") expect(r.text).toMatch(/落.+被引动（/);
      }
    }
  });

  it("中尺度的理由是那几步大运本身，且逐步不重", () => {
    for (const n of N.medium.nodes) {
      const texts = n.reasons.map((r) => r.text);
      expect(new Set(texts).size).toBe(texts.length);
      for (const t of texts) expect(t).toMatch(/^第 \d+ 步大运/);
    }
    expect(N.medium.nodes.some((n) => n.reasons.length > 0), "中节点一条理由都没有").toBe(true);
  });

  it("小尺度的理由按与进入点的距离升序，且不超过三个月", () => {
    for (const n of N.small.nodes) {
      for (let i = 1; i < n.reasons.length; i++) {
        expect(n.reasons[i]!.distanceMonths).toBeGreaterThanOrEqual(n.reasons[i - 1]!.distanceMonths);
      }
      for (const r of n.reasons) expect(r.distanceMonths).toBeLessThanOrEqual(1);
    }
  });
});

describe("整体", () => {
  it("三个尺度都有产出，且按 |z| 降序截断", () => {
    for (const scale of SCALES) {
      const set = findNodes(S, scale);
      expect(set.nodes.length, `${scale} 一条节点也没有`).toBeGreaterThan(0);
      expect(set.nodes.length).toBeLessThanOrEqual(base.params.nodes.maxShown);
      for (let i = 1; i < set.nodes.length; i++) {
        expect(Math.abs(set.nodes[i]!.peakZ)).toBeLessThanOrEqual(Math.abs(set.nodes[i - 1]!.peakZ));
      }
    }
  });

  it("**z 分数对平移不变 —— 用 values 还是 deltas 检出结果相同**", () => {
    const shifted = synth(S.series.map((s) => ({ ...s, values: s.deltas, baseValue: 0 })));
    // 只比不受 baseValue 影响的那部分：peakZ 与区间
    const a = findNodes(S, "large", { minRelativeSwing: 0, maxShown: 9999 }).nodes;
    const b = findNodes(shifted, "large", { minRelativeSwing: 0, maxShown: 9999 }).nodes;
    expect(b.map((n) => [n.seriesId, n.enter, n.exit, n.peakZ.toFixed(9)]))
      .toEqual(a.map((n) => [n.seriesId, n.enter, n.exit, n.peakZ.toFixed(9)]));
  });
});

describe("**门槛穿越：曲线与 ±θσ 的交点**", () => {
  const BASE = buildBaseChart(buildChart({
    year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
  }), loadParams());
  const S = buildSeries(BASE, { years: 60 });
  const pick = (kind: string) => S.series.find((s) => s.kind === kind)!;

  const zAt = (s: typeof S.series[number], i: number) => {
    const { center, sigma } = curveStats(S, s);
    return (s.values[i]! - center) / sigma;
  };
  const indexOf = (mk: { year: number; monthIndex: number }) =>
    S.frames.findIndex((f) => f.year === mk.year && f.monthIndex === mk.monthIndex);

  it("**每一段的端点确实是交点** —— 入点在门槛外，入点前一点在门槛内", () => {
    const s = pick("tenGod");
    const cs = thresholdCrossings(S, s, 2);
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      const i = indexOf(c.enter);
      expect(Math.abs(zAt(s, i)), `入点 ${c.enter.year}`).toBeGreaterThanOrEqual(2);
      if (i > 0) {
        // 入点的前一点必须在门槛以内，否则这一段没有在这里开始
        expect(Math.abs(zAt(s, i - 1)), `入点前一点 ${c.enter.year}`).toBeLessThan(2);
      }
      if (c.exit !== null) {
        const j = indexOf(c.exit);
        expect(Math.abs(zAt(s, j)), `出点 ${c.exit.year}`).toBeLessThan(2);
        expect(Math.abs(zAt(s, j - 1)), `出点前一点`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("峰值点确实是区间内 |z| 最大的那一点", () => {
    for (const kind of ["tenGod", "element", "agitation"]) {
      const s = pick(kind);
      for (const c of thresholdCrossings(S, s, 2)) {
        const a = indexOf(c.enter);
        const b = c.exit === null ? S.frames.length - 1 : indexOf(c.exit) - 1;
        let best = -Infinity;
        for (let i = a; i <= b; i++) best = Math.max(best, Math.abs(zAt(s, i)));
        expect(Math.abs(c.peakZ), `${kind} ${c.enter.year}`).toBeCloseTo(best, 9);
      }
    }
  });

  it("**门槛抬高，穿越只会更少** —— 它是「取多少条」的旋钮", () => {
    const s = pick("tenGod");
    let prev = Infinity;
    for (const th of [1.5, 2, 2.5, 3]) {
      const n = thresholdCrossings(S, s, th).length;
      expect(n, `θ=${th}`).toBeLessThanOrEqual(prev);
      prev = n;
    }
  });

  it("**时间报到哪一级由序列自己定** —— 权重类只许报到年", () => {
    // 流月不进权重，故权重类序列的月序不携带信息
    for (const kind of ["tenGod", "element", "palace", "dayMaster"]) {
      for (const c of thresholdCrossings(S, pick(kind), 2)) {
        expect(c.monthResolved, `${kind} 不该声称报得到月`).toBe(false);
      }
    }
    // 扰动类流月真的进来了，故报得到月
    const ag = thresholdCrossings(S, pick("agitation"), 2);
    expect(ag.length).toBeGreaterThan(0);
    for (const c of ag) expect(c.monthResolved).toBe(true);
  });

  it("**权重类的穿越段起于寅月** —— 跳变全在立春那一刻，这是同一件事的另一面", () => {
    let total = 0; let atYin = 0;
    for (const kind of ["tenGod", "element"]) {
      for (const s of S.series.filter((x) => x.kind === kind)) {
        for (const c of thresholdCrossings(S, s, 2)) {
          total++;
          if (c.enter.monthIndex === 0) atYin++;
        }
      }
    }
    expect(total, "样本量").toBeGreaterThan(5);
    expect(atYin / total, `${atYin}/${total} 起于寅月`).toBeGreaterThan(0.8);
  });

  it("**跑到末尾仍未回来时 exit 为 null** —— 不拿末点冒充穿出点", () => {
    // 构造一条恒在门槛外的序列：拿真序列但把门槛压到 0
    const s = pick("tenGod");
    const cs = thresholdCrossings(S, s, 0);
    expect(cs.length).toBeGreaterThan(0);
    const last = cs[cs.length - 1]!;
    expect(last.exit).toBeNull();
  });

  it("σ 为 0 时返回空，而不是返回一堆 0/0", () => {
    const flat = { ...pick("tenGod"), values: S.frames.map(() => 42) };
    expect(thresholdCrossings(S, flat, 2)).toEqual([]);
  });

  it("**限定窗口只看那一段** —— 与界面上的缩放同一口径", () => {
    const s = pick("tenGod");
    const all = thresholdCrossings(S, s, 2);
    expect(all.length).toBeGreaterThan(1);
    const first = all[0]!;
    const i = indexOf(first.enter);
    const sub = thresholdCrossings(S, s, 2, { from: i, to: i + 11 });
    expect(sub).toHaveLength(1);
    expect(sub[0]!.enter).toEqual(first.enter);
  });

  it("**高于与低于都算穿越，不分吉凶**", () => {
    let up = 0; let down = 0;
    for (const s of S.series) {
      for (const c of thresholdCrossings(S, s, 1.5)) {
        if (c.sign > 0) up++; else down++;
      }
    }
    expect(up, "应当两侧都有").toBeGreaterThan(0);
    expect(down, "应当两侧都有").toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════

describe("±θσ 交点报到日", () => {
  const pick = (kind: string) => S.series.find((x) => x.kind === kind)!;
  const indexOf = (mk: { year: number; monthIndex: number }) =>
    S.frames.findIndex((f) => f.year === mk.year && f.monthIndex === mk.monthIndex);
  const all = S.series.flatMap((s) => thresholdCrossings(S, s, 2));
  const withEnter = all.filter((c) => c.enterAt !== null);

  it("每个交点都给得出一个具体日期，且落在两个采样点之间", () => {
    expect(withEnter.length).toBeGreaterThan(20);
    for (const c of withEnter) {
      const at = c.enterAt!;
      expect(Number.isFinite(at.jd)).toBe(true);
      expect(at.month).toBeGreaterThanOrEqual(1);
      expect(at.month).toBeLessThanOrEqual(12);
      expect(at.day).toBeGreaterThanOrEqual(1);
      expect(at.day).toBeLessThanOrEqual(31);
      // 时刻必须落在 [穿入点前一采样, 穿入点] 之内 —— 否则报的是别处的日子
      const i = indexOf(c.enter);
      expect(i).toBeGreaterThan(0);
      const left = S.frames[i - 1]!.jd;
      const right = S.frames[i]!.jd;
      // 真节可能比等分网格早 3 日，故左边界放宽 4 日
      expect(at.jd).toBeGreaterThanOrEqual(left - 4);
      expect(at.jd).toBeLessThanOrEqual(right + 4);
    }
  });

  it("**窗口第一点就在门槛外时给 null，而不是拿窗口起点冒充穿越时刻**", () => {
    const s = pick("tenGod");
    const c0 = thresholdCrossings(S, s, 2)[0]!;
    const i = indexOf(c0.peak);
    // 从峰那一点开始取窗口 —— 第一点必然已在门槛之外
    const sub = thresholdCrossings(S, s, 2, { from: i, to: i + 5 });
    expect(sub).toHaveLength(1);
    expect(sub[0]!.enterAt, "穿越发生在窗口之前，定不出时刻").toBeNull();
  });

  it("**权重类的交点绝大多数是换柱阶跃，不是运内斜坡** —— 这是模型的直陈", () => {
    const weight = all.filter((c) => !c.monthResolved && c.enterAt !== null);
    const byBasis = new Map<string, number>();
    for (const c of weight) {
      byBasis.set(c.enterAt!.basis, (byBasis.get(c.enterAt!.basis) ?? 0) + 1);
    }
    const step = byBasis.get("pillarStep") ?? 0;
    expect(step / weight.length,
      "流月不进权重，立春换柱是唯一的跳变来源").toBeGreaterThan(0.6);
    expect(byBasis.get("jieStep") ?? 0, "权重类不吃流月，不该走节分支").toBe(0);
  });

  it("**扰动类一律落在真节上，而真节与等分采样点差得到 3 日**", () => {
    const ag = all.filter((c) => c.monthResolved && c.enterAt !== null);
    expect(ag.length).toBeGreaterThan(5);
    let maxGap = 0;
    for (const c of ag) {
      expect(c.enterAt!.basis).toBe("jieStep");
      const i = indexOf(c.enter);
      maxGap = Math.max(maxGap, Math.abs(c.enterAt!.jd - S.frames[i]!.jd));
    }
    // 若误用采样点的 jd 而非真节，这个差会恒为 0 —— 这条就是那个错法的反向对照
    expect(maxGap, "真节与等分网格必须真的不同，否则说明没去解节").toBeGreaterThan(0.5);
    expect(maxGap, "但也不该超过 3 日 —— 超过说明解到了隔壁的节").toBeLessThan(3.5);
  });

  it("**域序列定不出时刻，给的是区间中点与半区间** —— 阶梯上没有插值可言", () => {
    const dom = all.filter((c) => c.seriesId.startsWith("domain.") && c.enterAt !== null);
    if (dom.length === 0) return;      // 该盘可能没有域交点
    for (const c of dom) {
      expect(["interval", "pillarStep"]).toContain(c.enterAt!.basis);
      if (c.enterAt!.basis === "interval") {
        expect(c.enterAt!.uncertaintyDays).toBeGreaterThan(10);
      }
    }
  });

  it("**阶跃的误差半径比插值小几个量级** —— 两个「日」不是同一种东西", () => {
    const steps = withEnter.filter((c) => c.enterAt!.basis === "pillarStep");
    expect(steps.length).toBeGreaterThan(0);
    for (const c of steps) {
      expect(c.enterAt!.uncertaintyDays,
        "换柱那一刻是算出来的，不是插出来的").toBeLessThan(0.02);
    }
    const intervals = withEnter.filter((c) => c.enterAt!.basis === "interval");
    for (const c of intervals) {
      expect(c.enterAt!.uncertaintyDays).toBeGreaterThan(10);
    }
  });

  it("**穿出的时刻必在穿入之后** —— 两端各自定日，不保证顺序，所以必须断言", () => {
    for (const c of all) {
      if (c.enterAt === null || c.exitAt === null) continue;
      expect(c.exitAt.jd).toBeGreaterThan(c.enterAt.jd);
    }
  });

  it("**块内线性这件事是实测的** —— 二阶差分比阶梯类小三个量级", () => {
    const worst = new Map<string, number>();
    for (const s of S.series) {
      const { center, sigma } = curveStats(S, s);
      if (!(sigma > 0)) continue;
      const z = (i: number) => (s.values[i]! - center) / sigma;
      let w = 0;
      for (let i = 1; i < S.frames.length - 1; i++) {
        const a = S.frames[i - 1]!; const b = S.frames[i]!; const c = S.frames[i + 1]!;
        if (b.year !== a.year || c.year !== b.year) continue;
        if (b.luckIndex !== a.luckIndex || c.luckIndex !== b.luckIndex) continue;
        w = Math.max(w, Math.abs(z(i + 1) - 2 * z(i) + z(i - 1)));
      }
      worst.set(s.withinBlock, Math.max(worst.get(s.withinBlock) ?? 0, w));
    }
    expect(worst.get("linear")!, "线性类块内二阶差分须近零").toBeLessThan(0.05);
    expect(worst.get("step")!, "阶梯类必须显著不同 —— 否则这个标注是摆设")
      .toBeGreaterThan(0.5);
  });
});

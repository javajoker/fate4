import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { assignWeights } from "../src/weights/assign.js";
import { applyStructure } from "../src/structure/apply.js";
import { propagate } from "../src/propagate/iterate.js";
import { propagationDistance } from "../src/propagate/distance.js";
import { computeResistance } from "../src/propagate/resistance.js";
import { kernelOf, polarityCoefOf, relationOf } from "../src/propagate/relations.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { loadParams } from "../src/params/load.js";
import type { Carrier } from "../src/weights/carrier.js";
import type { BirthInput } from "../src/chart/types.js";

const PP = DEFAULT_PARAMS.propagation;
const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};

/** 走完 L1→L2，得到 L3 的输入。每次调用都是全新副本。 */
function l2Carriers(input: BirthInput = EXAMPLE, params = DEFAULT_PARAMS): Carrier[] {
  const chart = buildChart(input);
  const w = assignWeights({ chart, params });
  const cs = w.carriers.map((c) => ({ ...c, flags: [...c.flags], trace: [...c.trace] }));
  return applyStructure(cs, chart.month.branch, params).carriers as Carrier[];
}

describe("顺序无关性 —— 「多轮同步迭代」这一架构承诺的唯一证明", () => {
  it("随机打乱载体 200 次，结果差异 < 1e-9", () => {
    // 这条测试一旦挂了，说明实现里混进了顺序依赖，整个模型的可复现性就没了。
    // 注意：它不是靠内部排序保证的 —— 那样会让断言变成同义反复，
    // 也就无法再区分「算法本身顺序无关」与「算法是顺序敏感的流水线」。
    const base = propagate(l2Carriers());
    const baseline = new Map(base.carriers.map((c) => [c.id, c.weight]));

    let worst = 0;
    for (let k = 0; k < 200; k++) {
      const cs = l2Carriers();
      for (let i = cs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cs[i], cs[j]] = [cs[j]!, cs[i]!];
      }
      const r = propagate(cs);
      for (const c of r.carriers) {
        worst = Math.max(worst, Math.abs(c.weight - (baseline.get(c.id) ?? NaN)));
      }
    }
    expect(worst, `最大差异 ${worst.toExponential(3)}`).toBeLessThan(1e-9);
  });

  it("总量、vitality、轮数亦不随顺序变", () => {
    const a = propagate(l2Carriers());
    const cs = l2Carriers().reverse();
    const b = propagate(cs);
    expect(b.rawTotal).toBeCloseTo(a.rawTotal, 9);
    expect(b.vitality).toBeCloseTo(a.vitality, 9);
    expect(b.convergence.rounds).toBe(a.convergence.rounds);
  });
});

describe("L3 不变量（docs/05-propagation.md §10）", () => {
  const input = l2Carriers();
  const M0 = input.reduce((a, c) => a + c.weight, 0);
  const r = propagate(input);

  it("② 任意载体权重非负", () => {
    for (const c of r.carriers) expect(c.weight, c.id).toBeGreaterThanOrEqual(0);
  });

  it("③ 质量非增 —— 生有损耗、克有销毁，总量只减不增", () => {
    let prev = M0;
    for (const h of r.convergence.history) {
      expect(h.total, `第 ${h.round} 轮`).toBeLessThanOrEqual(prev + 1e-9);
      prev = h.total;
    }
    expect(r.rawTotal).toBeLessThanOrEqual(M0 + 1e-9);
  });

  it("⑦ 归一后总量回到 L2 总量", () => {
    const after = r.carriers.reduce((a, c) => a + c.weight, 0);
    expect(Math.abs(after - M0)).toBeLessThan(1e-9);
  });

  it("⑧ vitality ∈ (0,1]，且为单轮留存（与轮数无关）", () => {
    expect(r.vitality).toBeGreaterThan(0);
    expect(r.vitality).toBeLessThanOrEqual(1);
    // 单轮留存不随轮数漂移；累计留存则会
    const few = propagate(l2Carriers(), { ...PP, maxRounds: 2, epsilon: 0 });
    const many = propagate(l2Carriers(), { ...PP, maxRounds: 8, epsilon: 0 });
    expect(Math.abs(few.vitality - many.vitality)).toBeLessThan(0.06);
    expect(many.cumulativeRetention).toBeLessThan(few.cumulativeRetention - 0.1);
  });

  it("④ 单轮流出不超过 outflowCap × 权重", () => {
    // 逐轮跑一轮，检查任一载体的单轮跌幅不超过 (流出上限 + 受克上限) × 阻尼
    const one = propagate(l2Carriers(), { ...PP, maxRounds: 1, epsilon: 0 });
    const before = new Map(l2Carriers().map((c) => [c.id, c.weight]));
    const maxDrop = (PP.outflowCap + PP.inflowDamageCap) * PP.damping;
    for (const c of one.carriers) {
      const b = before.get(c.id)!;
      if (b <= 0) continue;
      // one 的权重已归一，故用原始比例还原
      const raw = c.weight * (one.rawTotal / (one.carriers.reduce((a, x) => a + x.weight, 0)));
      expect((b - raw) / b, c.id).toBeLessThanOrEqual(maxDrop + 1e-9);
    }
  });

  it("⑤ 审计闭合：每个载体都留下 L3 trace，且终值一致", () => {
    for (const c of r.carriers) {
      const l3 = c.trace.filter((t) => t.layer === "L3");
      expect(l3, c.id).toHaveLength(1);
      expect(l3[0]!.to).toBeCloseTo(c.weight, 9);
    }
  });

  it("⑥ 收敛与否如实上报", () => {
    expect(typeof r.convergence.converged).toBe("boolean");
    expect(Number.isFinite(r.convergence.finalResidual)).toBe(true);
    expect(r.convergence.history.length).toBe(r.convergence.rounds);
  });
});

describe("三条建模决策", () => {
  it("一、生是流：施方减、受方增，且总量因 (1−η) 而净减", () => {
    // 构造：只有一对生关系
    const cs = l2Carriers();
    const one = propagate(cs.slice(), { ...PP, kernel: { sheng: 0.3, ke: 0 }, maxRounds: 1, epsilon: 0 });
    expect(one.rawTotal).toBeLessThan(cs.reduce((a, c) => a + c.weight, 0));
    // 损耗率不超过 (1−η)
    const loss = 1 - one.rawTotal / cs.reduce((a, c) => a + c.weight, 0);
    expect(loss).toBeLessThan(1 - PP.shengEfficiency + 1e-9);
  });

  it("二、克是毁：双方同减，故纯克局面损耗大于纯生局面", () => {
    const cs = () => l2Carriers();
    const shengOnly = propagate(cs(), { ...PP, kernel: { sheng: 0.3, ke: 0 }, maxRounds: 3, epsilon: 0 });
    const keOnly = propagate(cs(), { ...PP, kernel: { sheng: 0, ke: 0.4 }, maxRounds: 3, epsilon: 0 });
    expect(keOnly.cumulativeRetention).toBeLessThan(shengOnly.cumulativeRetention);
  });

  it("三、同类走抗性：加分式确实发散，这正是不采用它的理由", () => {
    const res = propagate(l2Carriers(), { ...PP, maxRounds: 20, epsilon: 0 });
    const add = propagate(l2Carriers(), {
      ...PP, tongdang: { ...PP.tongdang, mode: "additive" }, maxRounds: 20, epsilon: 0,
    });
    // 抗性模式：质量单调不增
    expect(res.cumulativeRetention).toBeLessThanOrEqual(1);
    // 加分模式：正反馈使总量反超初值 —— 数值发散
    expect(add.cumulativeRetention, "加分式应当发散").toBeGreaterThan(1.5);
  });

  it("抗性只作用于克，不作用于生", () => {
    const cs = l2Carriers();
    const M = cs.reduce((a, c) => a + c.weight, 0);
    const rr = computeResistance(cs, M, PP);
    for (const v of rr.values()) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // 同党越厚，抗性系数越小（受克越轻）
    const byEl = new Map<string, number>();
    for (const c of cs) byEl.set(c.element, (byEl.get(c.element) ?? 0) + c.weight);
    const strongest = [...byEl.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const weakest = [...byEl.entries()].sort((a, b) => a[1] - b[1])[0]![0];
    const rOf = (el: string) => {
      const c = cs.find((x) => x.element === el)!;
      return rr.get(c.id)!;
    };
    expect(rOf(strongest)).toBeLessThan(rOf(weakest));
  });
});

describe("阴阳的不对称 —— 生取异性为强，克取同性为强", () => {
  const mk = (stem: string, element: string, polarity: string): Carrier => ({
    id: stem, stem: stem as never, element: element as never, polarity: polarity as never,
    origin: "revealed", position: { pillar: "day", layer: "stem", hiddenIndex: null },
    hostBranch: null, role: null, weight: 100, activity: 1, flags: [], trace: [],
  });

  it("生：异性 1.00 > 同性 0.70", () => {
    const jia = mk("甲", "木", "阳");
    const bing = mk("丙", "火", "阳");
    const ding = mk("丁", "火", "阴");
    expect(polarityCoefOf(jia, ding, "生", PP)).toBe(PP.polarity.shengCross);
    expect(polarityCoefOf(jia, bing, "生", PP)).toBe(PP.polarity.shengSame);
    expect(PP.polarity.shengCross).toBeGreaterThan(PP.polarity.shengSame);
  });

  it("克：同性 1.00 > 异性 0.70", () => {
    const jia = mk("甲", "木", "阳");
    const wu = mk("戊", "土", "阳");
    const ji = mk("己", "土", "阴");
    expect(polarityCoefOf(jia, wu, "克", PP)).toBe(PP.polarity.keSame);
    expect(polarityCoefOf(jia, ji, "克", PP)).toBe(PP.polarity.keCross);
    expect(PP.polarity.keSame).toBeGreaterThan(PP.polarity.keCross);
  });

  it("方向与关系判定正确，「无」不施力", () => {
    const jia = mk("甲", "木", "阳");
    const bing = mk("丙", "火", "阳");
    expect(relationOf(jia, bing)).toBe("生");
    expect(relationOf(bing, jia)).toBe("无");
    expect(kernelOf("无", PP)).toBe(0);
  });
});

describe("距离模型", () => {
  const at = (pillar: string, layer: string, hiddenIndex: number | null, flags: string[] = []): Carrier => ({
    id: `${pillar}.${layer}.${hiddenIndex ?? "s"}`, stem: "甲", element: "木", polarity: "阳",
    origin: layer === "stem" ? "revealed" : "hidden",
    position: { pillar: pillar as never, layer: layer as never, hiddenIndex },
    hostBranch: layer === "branch" ? "寅" : null, role: null,
    weight: 10, activity: 1, flags: flags as never, trace: [],
  });

  it("同柱干支最强，同支藏干次之", () => {
    expect(propagationDistance(at("day", "stem", null), at("day", "branch", 0), PP)).toBe(PP.distance.samePillar);
    expect(propagationDistance(at("day", "branch", 0), at("day", "branch", 1), PP)).toBe(PP.distance.sameBranchHidden);
  });

  it("跨柱按间隔衰减，跨层再打折", () => {
    expect(propagationDistance(at("year", "branch", 0), at("month", "branch", 0), PP)).toBe(PP.distance.adjacent);
    expect(propagationDistance(at("year", "branch", 0), at("hour", "branch", 0), PP)).toBe(PP.distance.gap2);
    expect(propagationDistance(at("year", "stem", null), at("month", "branch", 0), PP))
      .toBeCloseTo(PP.distance.adjacent * PP.distance.crossLayerFactor, 9);
  });

  it("**外部层刻意不对称**：环境作用于人强，人作用于环境弱", () => {
    expect(propagationDistance(at("luck", "stem", null), at("day", "stem", null), PP)).toBe(PP.external.luckToNatal);
    expect(propagationDistance(at("day", "stem", null), at("luck", "stem", null), PP)).toBe(PP.external.natalToLuck);
    expect(PP.external.luckToNatal).toBeGreaterThan(PP.external.natalToLuck);
    expect(PP.external.annualToNatal).toBeGreaterThan(PP.external.natalToAnnual);
  });

  it("流年施于日主另有加成", () => {
    const plain = propagationDistance(at("annual", "stem", null), at("day", "stem", null), PP);
    const dm = propagationDistance(at("annual", "stem", null), at("day", "stem", null, ["DAY_MASTER"]), PP);
    expect(dm).toBeCloseTo(plain * PP.external.annualToDayMasterBonus, 9);
  });
});

describe("轮数是交互深度，不是收敛控制", () => {
  it("轮数越多，L2 的初始信息被冲刷得越彻底", () => {
    // 齐次线性映射迭代到「收敛」即幂迭代，结果趋于主特征向量 ——
    // 那只由结构决定，会完全遗忘 L1 的月提与司令分野。故默认取小值。
    const l2 = l2Carriers();
    const l2Share = l2.filter((c) => c.element === "火").reduce((a, c) => a + c.weight, 0)
      / l2.reduce((a, c) => a + c.weight, 0);

    const shallow = propagate(l2Carriers(), { ...PP, maxRounds: 3, epsilon: 0 });
    const deep = propagate(l2Carriers(), { ...PP, maxRounds: 30, epsilon: 0 });
    const share = (r: typeof shallow) => r.byElement["火"] / Object.values(r.byElement).reduce((a, b) => a + b, 0);

    expect(Math.abs(share(shallow) - l2Share)).toBeLessThan(0.12);
    expect(Math.abs(share(deep) - l2Share)).toBeGreaterThan(0.35);
  });

  it("默认轮数取小值", () => {
    expect(PP.maxRounds).toBeLessThanOrEqual(5);
  });
});

describe("形状的命理合理性", () => {
  const cases: [string, BirthInput, string, string][] = [
    ["火旺", EXAMPLE, "火", "土"],
    ["木旺", { year:1987,month:3,day:15,hour:8,minute:0,gender:"male",timeZone:"Asia/Shanghai",longitude:121.47 }, "木", "火"],
    ["金旺", { year:1980,month:9,day:20,hour:18,minute:0,gender:"female",timeZone:"Asia/Shanghai",longitude:121.47 }, "金", "水"],
  ];

  for (const [name, input, dominant, generated] of cases) {
    it(`${name}：主导五行泄于其所生者，占比上升`, () => {
      const l2 = l2Carriers(input);
      const tot = (cs: readonly Carrier[]) => cs.reduce((a, c) => a + c.weight, 0);
      const el = (cs: readonly Carrier[], e: string) =>
        cs.filter((c) => c.element === e).reduce((a, c) => a + c.weight, 0) / tot(cs);
      const beforeGen = el(l2, generated);
      const r = propagate(l2Carriers(input));
      const afterGen = r.byElement[generated as never] / Object.values(r.byElement).reduce((a, b) => a + b, 0);
      expect(afterGen, `${name} 的${generated}应因受生而上升`).toBeGreaterThan(beforeGen);
      // 主导者仍占相当份额，未被冲刷掉
      const afterDom = r.byElement[dominant as never] / Object.values(r.byElement).reduce((a, b) => a + b, 0);
      expect(afterDom, `${name} 的${dominant}不应被冲刷殆尽`).toBeGreaterThan(0.15);
    });
  }

  it("受克上限使弱者被削弱而非蒸发", () => {
    // 该盘金 123 单位，其克的唯一目标是 4 单位的乙木。
    // 无受克上限时乙木一轮归零；有上限则应显著削弱而仍在场。
    const r = propagate(l2Carriers());
    expect(r.byElement["木"]).toBeGreaterThan(0);
    const noCap = propagate(l2Carriers(), { ...PP, inflowDamageCap: 10 });
    expect(noCap.byElement["木"]).toBeLessThan(r.byElement["木"]);
  });
});

describe("流量记录（供桑基图）", () => {
  const r = propagate(l2Carriers());
  it("每条流都带完整系数，可复算", () => {
    expect(r.flows.length).toBeGreaterThan(0);
    for (const f of r.flows) {
      expect(f.totalAmount).toBeGreaterThan(0);
      expect(["sheng", "ke"]).toContain(f.kind);
      expect(f.coefficients.K).toBeGreaterThan(0);
      if (f.kind === "ke") expect(f.coefficients.resistance).toBeDefined();
      else expect(f.coefficients.resistance).toBeUndefined();
    }
  });
  it("按流量降序，便于取最强的几条作解读", () => {
    for (let i = 1; i < r.flows.length; i++) {
      expect(r.flows[i]!.totalAmount).toBeLessThanOrEqual(r.flows[i - 1]!.totalAmount);
    }
  });
});

describe("参数可调", () => {
  it("提高克的核使内耗加剧", () => {
    const lo = propagate(l2Carriers(), loadParams({ propagation: { kernel: { ke: 0.2 } } }).propagation);
    const hi = propagate(l2Carriers(), loadParams({ propagation: { kernel: { ke: 0.8 } } }).propagation);
    expect(hi.vitality).toBeLessThan(lo.vitality);
  });
  it("提高 β 使同党更抗克", () => {
    const lo = propagate(l2Carriers(), { ...PP, tongdang: { ...PP.tongdang, beta: 0.1 } });
    const hi = propagate(l2Carriers(), { ...PP, tongdang: { ...PP.tongdang, beta: 3.0 } });
    expect(hi.vitality).toBeGreaterThan(lo.vitality);
  });
});

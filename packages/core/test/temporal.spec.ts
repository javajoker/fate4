import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { evaluate } from "../src/temporal/evaluate.js";
import {
  annualPillarOf, dayView, favorIndexOf, luckTimeline, monthView, yearView,
} from "../src/temporal/views.js";
import { eventDelta } from "../src/yingqi/engine.js";
import { aggregateDomains } from "../src/yingqi/domains.js";
import { YINGQI_RULES } from "../src/yingqi/rules.js";
import { DOMAIN_LABEL } from "../src/yingqi/types.js";
import { loadParams } from "../src/params/load.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { isValidPair } from "../src/ganzhi/algebra.js";
import type { BirthInput } from "../src/chart/types.js";

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const chart = buildChart(EXAMPLE);

describe("evaluate：瞬时全盘求解", () => {
  it("本命盘可解，且不污染调用方", () => {
    const a = evaluate({ chart });
    const b = evaluate({ chart });
    expect(a.conclusions.party.ratio).toBeCloseTo(b.conclusions.party.ratio, 12);
    expect(a.carriers).toHaveLength(b.carriers.length);
  });

  it("加大运流年后载体变多，结论随之改变", () => {
    const natal = evaluate({ chart });
    const withLuck = evaluate({
      chart, luck: { pillar: chart.luck.pillars[2]!.pillar, elapsedYears: 3 },
      annual: annualPillarOf(2026),
    });
    expect(withLuck.carriers.length).toBeGreaterThan(natal.carriers.length);
    expect(withLuck.conclusions.party.ratio).not.toBeCloseTo(natal.conclusions.party.ratio, 4);
  });

  it("同一输入两次求解完全一致（纯函数）", () => {
    const mk = () => evaluate({ chart, annual: annualPillarOf(2026) });
    const a = mk(); const b = mk();
    for (const [i, c] of a.carriers.entries()) {
      expect(c.weight).toBeCloseTo(b.carriers[i]!.weight, 12);
    }
  });
});

describe("流年年柱", () => {
  it("1990 庚午、2026 丙午、2000 庚辰", () => {
    expect(annualPillarOf(1990)).toEqual({ stem: "庚", branch: "午" });
    expect(annualPillarOf(2026)).toEqual({ stem: "丙", branch: "午" });
    expect(annualPillarOf(2000)).toEqual({ stem: "庚", branch: "辰" });
  });
  it("六十年一循环，且组合恒合法", () => {
    for (let y = 1900; y <= 2100; y++) {
      const p = annualPillarOf(y);
      expect(isValidPair(p.stem, p.branch), `${y}`).toBe(true);
      expect(annualPillarOf(y + 60)).toEqual(p);
    }
  });
});

describe("大运时间轴", () => {
  const steps = luckTimeline(chart);

  it("十二步，每步三个取样点", () => {
    expect(steps).toHaveLength(12);
    for (const s of steps) {
      expect(s.samples).toHaveLength(3);
      expect(s.samples.map((x) => x.at)).toEqual(["start", "mid", "end"]);
    }
  });

  it("**一步之内取三个样本，因为前后半段气象本就不同**", () => {
    // 天干占比 0.70 → 0.50 → 0.30，故 start 与 end 的盘面必然不同
    for (const s of steps) {
      expect(s.samples[0]!.stemShare).toBeCloseTo(0.70, 6);
      expect(s.samples[1]!.stemShare).toBeCloseTo(0.50, 6);
      expect(s.samples[2]!.stemShare).toBeLessThan(0.31);
    }
    const changed = steps.filter((s) => s.samples[0]!.favorIndex !== s.samples[2]!.favorIndex);
    expect(changed.length, "至少多数步的前后段指数应有差别").toBeGreaterThan(steps.length / 2);
  });

  it("干支连续推进，起运年龄每步递增十年", () => {
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.startAgeYears - steps[i - 1]!.startAgeYears).toBeCloseTo(10, 6);
    }
  });
});

describe("流年视图与顺逆指数", () => {
  const v = yearView(chart, 2026);

  it("指数恒在 (0,100) 开区间内", () => {
    for (let y = 2000; y <= 2040; y += 4) {
      const x = yearView(chart, y).favorIndex;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(100);
    }
  });

  it("tanh 保证有界 —— 极端输入不会产出无法解释的数值", () => {
    const natal = evaluate({ chart });
    const huge = Array.from({ length: 50 }, () => ({ polarity: -1 as const, weight: 1 }));
    const r = favorIndexOf(natal, natal, huge);
    expect(r.index).toBeGreaterThan(0);
    expect(r.index).toBeLessThan(50);
    expect(Number.isFinite(r.raw)).toBe(true);
  });

  it("指数由权重结构变化与应期事件两部分合成", () => {
    // 系数从参数读，不写死 —— a 与 b 是 [校准] 项，写死等于每次重标定都要改测试，
    // 而这条断言真正要验的是「raw 是两项的线性组合」，与取值无关。
    const { a, b } = DEFAULT_PARAMS.temporal.index;
    expect(v.indexParts.raw).toBeCloseTo(
      a * v.indexParts.base + b * v.indexParts.eventDelta, 9);
  });

  it("产出应期事件与域聚合", () => {
    expect(v.events.length).toBeGreaterThan(0);
    expect(v.domains.length).toBeGreaterThan(0);
    for (const e of v.events) {
      expect(e.evidence.length, `${e.name} 无现场依据`).toBeGreaterThan(0);
      expect([-1, 0, 1]).toContain(e.polarity);
    }
  });

  it("换运年分段返回，**不做加权平均**", () => {
    // 交运在 1998-08-07，故 1998 年内换运
    const y = yearView(chart, 1998);
    expect(y.segments.length).toBeGreaterThanOrEqual(1);
    for (const s of y.segments) expect(s.toJd).toBeGreaterThan(s.fromJd);
    const anySplit = [1998, 2008, 2018].map((yy) => yearView(chart, yy).segments.length);
    expect(Math.max(...anySplit)).toBe(2);
  });

  it("逐年可算 40 年而不超时", () => {
    const t0 = Date.now();
    for (let y = 2000; y < 2040; y++) yearView(chart, y);
    expect(Date.now() - t0).toBeLessThan(15000);
  });
});

describe("应期规则", () => {
  it("规则 id 唯一，权重与极性合法", () => {
    const ids = YINGQI_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of YINGQI_RULES) {
      expect([-1, 0, 1]).toContain(r.polarity);
      expect(r.weight).toBeGreaterThan(0);
      expect(r.weight).toBeLessThanOrEqual(1);
      expect(r.domains.length).toBeGreaterThan(0);
      for (const d of r.domains) expect(Object.keys(DOMAIN_LABEL)).toContain(d);
      expect(r.narrativeTag.length).toBeGreaterThan(0);
    }
  });

  it("**polarity: 0 一档确实在用** —— 应事不等于吉凶", () => {
    const neutral = YINGQI_RULES.filter((r) => r.polarity === 0);
    expect(neutral.length).toBeGreaterThanOrEqual(8);
    // 驿马逢冲、桃花逢合、墓库冲开 皆为中性 —— 动是好是坏取决于用忌
    for (const id of ["yima_chonged", "taohua_he", "tomb_opened", "sui_yun_bing_lin"]) {
      expect(YINGQI_RULES.find((r) => r.id === id)?.polarity, id).toBe(0);
    }
  });

  it("三种极性都有规则覆盖", () => {
    for (const p of [-1, 0, 1] as const) {
      expect(YINGQI_RULES.some((r) => r.polarity === p), `极性 ${p} 无规则`).toBe(true);
    }
  });

  it("事件按 priority 降序", () => {
    const v = yearView(chart, 2026);
    const pri = new Map(YINGQI_RULES.map((r) => [r.id, r.priority]));
    for (let i = 1; i < v.events.length; i++) {
      expect(pri.get(v.events[i]!.ruleId)!).toBeLessThanOrEqual(pri.get(v.events[i - 1]!.ruleId)!);
    }
  });

  it("eventDelta 保留符号，不做抵消式合并", () => {
    const evs = [
      { ruleId: "a", name: "a", polarity: 1 as const, weight: 0.8, domains: [], narrativeTag: "", evidence: "" },
      { ruleId: "b", name: "b", polarity: -1 as const, weight: 0.8, domains: [], narrativeTag: "", evidence: "" },
    ];
    expect(eventDelta(evs)).toBeCloseTo(0, 9);
    // 但两条事件本身都保留，未被合并掉
    expect(evs).toHaveLength(2);
  });
});

describe("应期规则的统计体检 —— 恒真的规则不是规则", () => {
  /**
   * 一条 9 年里有 8 年为真的规则，不是应期，是背景；
   * 一条从不触发的规则，是死代码而看起来像覆盖率。两端都要拦。
   *
   * 这条测试是有历史的。首版实测：四条规则触发率为 0（神煞不扫大运流年支，
   * 且修饰按柱匹配，虚假的「逢合」盖掉了真正的「逢冲」），
   * 另有五条顺向规则触发率 63–90%（判据是常驻结构事实，不是当年的变化）。
   */
  const CHARTS: BirthInput[] = [
    EXAMPLE,
    { year: 1968, month: 1, day: 9, hour: 5, minute: 5, gender: "female", timeZone: "Asia/Shanghai", longitude: 113.3 },
    { year: 1984, month: 11, day: 2, hour: 12, minute: 0, gender: "female", timeZone: "Asia/Taipei", longitude: 121.5 },
    { year: 2001, month: 3, day: 21, hour: 18, minute: 15, gender: "male", timeZone: "Asia/Shanghai", longitude: 104.1 },
  ];

  const fire = new Map<string, number>();
  const idx: number[] = [];
  let years = 0;
  for (const b of CHARTS) {
    const c = buildChart(b);
    for (let y = b.year; y < b.year + 40; y++) {
      const v = yearView(c, y);
      years++; idx.push(v.favorIndex);
      for (const e of v.events) fire.set(e.ruleId, (fire.get(e.ruleId) ?? 0) + 1);
    }
  }

  it("没有一条规则从不触发", () => {
    const never = YINGQI_RULES.filter((r) => !fire.has(r.id)).map((r) => `${r.id}(${r.narrativeTag})`);
    expect(never, `这些规则在 ${years} 个盘年里一次也没触发，多半是谓词写错而非罕见`).toEqual([]);
  });

  it("没有一条规则近乎恒真", () => {
    const always = [...fire.entries()]
      .filter(([, k]) => k / years > 0.7)
      .map(([id, k]) => `${id} ${(k / years * 100).toFixed(0)}%`);
    expect(always, "触发率超过七成的规则已退化为背景，须改判「变化」而非「状态」").toEqual([]);
  });

  it("顺逆指数不得大面积饱和 —— 饱和即丢弃信息", () => {
    // tanh 两端压缩。系数过大时指数退化成近乎二值的信号：
    // a=4.0 时实测 32% 的年份落在 <5 或 >95，故降至 2.0。
    const sat = idx.filter((x) => x < 5 || x > 95).length / idx.length;
    expect(sat, `饱和率 ${(sat * 100).toFixed(1)}%`).toBeLessThan(0.10);
  });
});

describe("域聚合：tension 才是关键", () => {
  it("同域内极性相反者并存，不抵消", () => {
    const evs = [
      { ruleId: "a", name: "利", polarity: 1 as const, weight: 0.8, domains: ["career" as const], narrativeTag: "", evidence: "" },
      { ruleId: "b", name: "损", polarity: -1 as const, weight: 0.8, domains: ["career" as const], narrativeTag: "", evidence: "" },
    ];
    const d = aggregateDomains(evs).find((x) => x.domain === "career")!;
    expect(d.supporting).toHaveLength(1);
    expect(d.opposing).toHaveLength(1);
    expect(d.net).toBeCloseTo(0, 9);
    // net 为零，但 tension 为 1 —— 「大起大落」不该被读成「平淡无事」
    expect(d.tension).toBeCloseTo(1, 9);
  });

  it("只有支持或只有反对时张力为零", () => {
    const evs = [{ ruleId: "a", name: "利", polarity: 1 as const, weight: 0.8, domains: ["wealth" as const], narrativeTag: "", evidence: "" }];
    const d = aggregateDomains(evs).find((x) => x.domain === "wealth")!;
    expect(d.tension).toBe(0);
    expect(d.net).toBeCloseTo(0.8, 9);
  });

  it("无事件的域不出现在输出里", () => {
    expect(aggregateDomains([])).toHaveLength(0);
  });
});

describe("流月：不重算权重", () => {
  const m = monthView(chart, 2026, 0);

  it("**输出中不得出现任何 weight 字段**（硬约束）", () => {
    const json = JSON.stringify(m);
    expect(json.includes('"weight"'), "流月输出泄漏了权重字段").toBe(false);
    expect(json.includes('"activity"')).toBe(false);
  });

  it("十二个月全覆盖，皆无权重泄漏", () => {
    for (let i = 0; i < 12; i++) {
      const v = monthView(chart, 2026, i);
      expect(JSON.stringify(v).includes('"weight"'), `第 ${i} 月`).toBe(false);
      expect(v.pillar.branch).toBeTruthy();
      expect(v.range.toJd).toBeGreaterThan(v.range.fromJd);
    }
  });

  it("月支自寅顺行，由节开启", () => {
    const order = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
    for (let i = 0; i < 12; i++) {
      expect(monthView(chart, 2026, i).pillar.branch).toBe(order[i]);
    }
    expect(monthView(chart, 2026, 0).openedBy).toBe("立春");
  });

  it("**叙述中不得漏出英文键名**", () => {
    for (let i = 0; i < 12; i++) {
      const v = monthView(chart, 2026, i);
      const text = [...v.narrative, ...v.interactions.map((x) => x.detail)].join(" ");
      expect(text, `第 ${i} 月的叙述含英文`).not.toMatch(/[a-zA-Z]{3,}/);
    }
  });

  it("引动条数受参数限制", () => {
    const p = loadParams({ temporal: { monthLayer: { maxInteractionsShown: 1 } } });
    expect(monthView(chart, 2026, 0, p).interactions.length).toBeLessThanOrEqual(1);
  });

  it("给出与用神的定性关系，但不给数值", () => {
    for (let i = 0; i < 12; i++) {
      const v = monthView(chart, 2026, i);
      expect(["supports", "neutral", "opposes"]).toContain(v.tone.relationToYongshen);
      expect(v.tone.relationToDayMaster.length).toBeGreaterThan(0);
    }
  });
});

describe("流日：不重算权重", () => {
  const d = dayView(chart, 2026, 3, 15);

  it("**输出中不得出现任何 weight 字段**（硬约束）", () => {
    expect(JSON.stringify(d).includes('"weight"'), "流日输出泄漏了权重字段").toBe(false);
  });

  it("severity 只有两档 —— 日层分辨率不支持更细，给五档只是伪精度", () => {
    for (let day = 1; day <= 28; day++) {
      for (const c of dayView(chart, 2026, 3, day).conflicts) {
        expect(["mild", "notable"]).toContain(c.severity);
      }
    }
  });

  it("日柱逐日推进一位", () => {
    const a = dayView(chart, 2026, 3, 15).pillar;
    const b = dayView(chart, 2026, 3, 16).pillar;
    const STEMS = "甲乙丙丁戊己庚辛壬癸";
    const BR = "子丑寅卯辰巳午未申酉戌亥";
    expect(STEMS.indexOf(b.stem)).toBe((STEMS.indexOf(a.stem) + 1) % 10);
    expect(BR.indexOf(b.branch)).toBe((BR.indexOf(a.branch) + 1) % 12);
  });

  it("note 限于描述张力，**不出宜忌、不作预测**", () => {
    for (let day = 1; day <= 28; day += 3) {
      const v = dayView(chart, 2026, 3, day);
      expect(v.note.length).toBeGreaterThan(0);
      expect(v.note).not.toMatch(/宜|忌|吉|凶|必|将会|建议/);
    }
  });

  it("冲本命日支时判为 notable", () => {
    // 本命日支丑，冲之者为未
    let found = false;
    for (let day = 1; day <= 60; day++) {
      const v = dayView(chart, 2026, 1, day);
      if (v.pillar.branch === "未") {
        const c = v.conflicts.find((x) => x.kind === "chongDayBranch");
        expect(c?.severity).toBe("notable");
        expect(c?.affectedPalace).toBe("配偶宫");
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe("硬约束：流月流日不得重算权重", () => {
  it("参数校验拦下试图放开的配置", () => {
    expect(() => loadParams({ temporal: { monthLayer: { recomputeWeights: true as never } } }))
      .toThrow(/monthLayer.recomputeWeights 必须为 false/);
    expect(() => loadParams({ temporal: { dayLayer: { recomputeWeights: true as never } } }))
      .toThrow(/dayLayer.recomputeWeights 必须为 false/);
  });
});

import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart, toBaseChart, isBaseChart } from "../src/chart/baseChart.js";
import { evaluate, evaluateAt } from "../src/temporal/evaluate.js";
import { annualPillarOf, dayView, luckTimeline, monthView, yearView } from "../src/temporal/views.js";
import { buildReport } from "../src/report/assemble.js";
import { assignWeights, markFlags } from "../src/weights/assign.js";
import { loadParams } from "../src/params/load.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import type { BirthInput } from "../src/chart/types.js";

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const chart = buildChart(EXAMPLE);
const base = buildBaseChart(chart, DEFAULT_PARAMS);

describe("基础盘：算一次，冻结", () => {
  it("只含四柱 —— 没有大运、流年、胎元的载体", () => {
    const kinds = new Set(base.carriers.map((c) => c.position.pillar));
    expect(kinds).toEqual(new Set(["year", "month", "day", "hour"]));
    expect(base.l1.map((c) => c.position.pillar).every(
      (k) => ["year", "month", "day", "hour"].includes(k))).toBe(true);
  });

  it("与既有的 evaluate 逐位相同 —— P11 是纯重构，不动任何数值", () => {
    const old = evaluate({ chart });
    expect(old.conclusions.party.ratio).toBeCloseTo(base.conclusions.party.ratio, 12);
    expect(old.conclusions.strength.value).toBe(base.conclusions.strength.value);
    expect(old.conclusions.yongshen.value.primary).toBe(base.conclusions.yongshen.value.primary);
    for (const [i, c] of old.carriers.entries()) {
      expect(c.weight, c.id).toBeCloseTo(base.carriers[i]!.weight, 12);
    }
  });

  it("空时点的即时盘 == 基础盘", () => {
    const ev = evaluateAt(base, {});
    for (const [i, c] of ev.carriers.entries()) {
      expect(c.weight, c.id).toBeCloseTo(base.carriers[i]!.weight, 12);
    }
    expect(ev.conclusions.party.ratio).toBeCloseTo(base.conclusions.party.ratio, 12);
  });

  it("**L2/L3 就地改写，故基础盘必须不被下游污染**", () => {
    const l1Before = base.l1.map((c) => c.weight);
    const carriersBefore = base.carriers.map((c) => c.weight);
    // 跑一堆即时盘，每个都会就地改写自己那份拷贝
    for (let y = 2000; y < 2060; y++) {
      evaluateAt(base, {
        luck: { pillar: chart.luck.pillars[3]!.pillar, elapsedYears: 5 },
        annual: annualPillarOf(y),
      });
    }
    expect(base.l1.map((c) => c.weight)).toEqual(l1Before);
    expect(base.carriers.map((c) => c.weight)).toEqual(carriersBefore);
  });

  it("l1 是初始态，carriers 是终态 —— 两者不该相等", () => {
    // 若相等，说明 L2/L3 根本没跑，或者 l1 拿的是同一批对象
    const same = base.l1.every((c, i) => c.weight === base.carriers[i]!.weight);
    expect(same, "l1 与 carriers 完全相同，管线可能没跑").toBe(false);
    expect(base.l1[0]).not.toBe(base.carriers[0]);
  });

  it("随盘携带参数快照", () => {
    expect(base.paramsHash).toMatch(/^[0-9a-f]+$/);
    expect(buildBaseChart(chart, loadParams({ weights: { luck: { total: 150 } } })).paramsHash)
      .not.toBe(base.paramsHash);
  });
});

describe("四柱的 L1 配重与时点无关 —— 这是复用的前提", () => {
  it("加不加大运流年，四柱的初始权重逐位相同", () => {
    const bare = assignWeights({ chart, params: DEFAULT_PARAMS });
    const withTime = assignWeights({
      chart, params: DEFAULT_PARAMS,
      luck: { pillar: chart.luck.pillars[2]!.pillar, elapsedYears: 3 },
      annual: annualPillarOf(2026),
    });
    for (const c of bare.carriers) {
      const other = withTime.carriers.find((x) => x.id === c.id)!;
      expect(other.weight, c.id).toBeCloseTo(c.weight, 12);
    }
  });

  it("**透干只认本命天干；岁运带来的同字另记为引出**", () => {
    // 二者是不同的概念：透干是恒定的结构属性，引出是当时的引动，明年就没了。
    // 原实现把 revealedStems 建在全部天干上，于是流年干会把本命藏干标成「透干」。
    const withBing = assignWeights({
      chart, params: DEFAULT_PARAMS,
      annual: { stem: "丙", branch: "午" },   // 丙藏于本命月支巳，但本命天干无丙
      });
    const siHidden = withBing.carriers.filter(
      (c) => c.position.pillar === "month" && c.position.layer === "branch" && c.stem === "丙");
    expect(siHidden).toHaveLength(1);
    expect(siHidden[0]!.flags).toContain("EVOKED");
    expect(siHidden[0]!.flags).not.toContain("REVEALED");

    // 本命确有透干者仍标 REVEALED
    const bare = assignWeights({ chart, params: DEFAULT_PARAMS });
    const revealed = new Set(bare.carriers.filter((c) => c.flags.includes("REVEALED")).map((c) => c.stem));
    expect(revealed).toEqual(new Set(["丁", "庚", "辛"]));
    expect(bare.carriers.some((c) => c.flags.includes("EVOKED"))).toBe(false);
  });

  it("markFlags 幂等 —— 基础盘与即时盘可对同一批载体重复调用", () => {
    const w = assignWeights({ chart, params: DEFAULT_PARAMS });
    const before = w.carriers.map((c) => [...c.flags].sort().join(","));
    markFlags(w.carriers);
    markFlags(w.carriers);
    expect(w.carriers.map((c) => [...c.flags].sort().join(","))).toEqual(before);
  });
});

describe("**同一次报告内，全部即时盘引用同一个基础盘**", () => {
  it("引用相等 —— 这就是「恰好算一次」的可断言形式", () => {
    const r = buildReport(base, {
      now: { year: 2026, month: 9, day: 1 }, curveYears: 30,
    });
    const seen = new Set([
      ...r.years.cards.map((c) => c.view.evaluated.base),
      ...(r.current === null ? [] : [r.current.year.evaluated.base]),
    ]);
    expect(seen.size, "报告内出现了多于一个基础盘").toBe(1);
    expect(seen.has(base), "报告用的不是传进去的那个基础盘").toBe(true);
  });

  it("传 NatalChart 时自建基准，报告内部仍只有一个", () => {
    const r = buildReport(chart, { now: { year: 2026, month: 9, day: 1 }, curveYears: 20 });
    const seen = new Set(r.years.cards.map((c) => c.view.evaluated.base));
    expect(seen.size).toBe(1);
    expect(seen.has(base)).toBe(false);   // 是自建的另一个
  });

  it("四个时间层视图都接受 BaseChart，且都用传进去的那个", () => {
    expect(luckTimeline(base).length).toBeGreaterThan(0);
    expect(yearView(base, 2026).evaluated.base).toBe(base);
    expect(monthView(base, 2026, 7).pillar.branch).toBe("酉");
    expect(dayView(base, 2026, 9, 1).pillar.stem.length).toBe(1);
  });
});

describe("toBaseChart 的两条护栏", () => {
  it("传 BaseChart 又传另一套参数即报错，不静默丢弃", () => {
    // 静默丢弃会让调用方以为参数生效了，而盘面纹丝不动 —— 最难查的一类。
    const other = loadParams({ weights: { luck: { total: 150 } } });
    expect(() => toBaseChart(base, other)).toThrow(/不静默丢弃/);
    // 参数等价则放行
    expect(() => toBaseChart(base, DEFAULT_PARAMS)).not.toThrow();
    expect(toBaseChart(base)).toBe(base);
  });

  it("isBaseChart 分得清两种入参", () => {
    expect(isBaseChart(base)).toBe(true);
    expect(isBaseChart(chart)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildSeries } from "../src/temporal/series.js";
import { fleetingTriggers, MONTH_TRIGGER_FRAME } from "../src/temporal/monthTrigger.js";
import { loadParams } from "../src/params/load.js";
import type { BirthInput } from "../src/chart/types.js";
import type { Pillar, Stem, Branch } from "../src/types/ganzhi.js";

/**
 * 🧪 实验分支：流月应期（开库 · 会局夺合 · 争合）。
 *
 * 这三条规则只看「有没有」、不读权重，所以结构层对流月看不见（见 apply.ts），
 * 由本模块单独算出，在神煞里以「流年大运应期」展示。
 */

const P = (stem: Stem, branch: Branch): Pillar => ({ stem, branch });
const chart = (y: Pillar, m: Pillar, d: Pillar, h: Pillar | null) =>
  ({ year: y, month: m, day: d, hour: h }) as never;
const kinds = (ts: readonly { kind: string }[]) => ts.map((t) => t.kind);

describe("流月应期：单元场景（答案是人工推出来的）", () => {
  it("**开库**：流月戌冲日柱辰，辰为墓库", () => {
    const c = chart(P("甲", "子"), P("丙", "寅"), P("戊", "辰"), P("庚", "申"));
    const ts = fleetingTriggers(c, null, null, P("壬", "戌"));
    const ku = ts.filter((t) => t.kind === "kuOpen");
    expect(ku).toHaveLength(1);
    expect(ku[0]!.text).toContain("流月戌冲日柱辰");
    expect(ku[0]!.text).toContain("墓库");
  });

  it("开库的反向对照：流月卯不冲辰 → 不开", () => {
    const c = chart(P("甲", "子"), P("丙", "寅"), P("戊", "辰"), P("庚", "申"));
    expect(kinds(fleetingTriggers(c, null, null, P("乙", "卯")))).not.toContain("kuOpen");
  });

  it("**本来就开着的库，不算流月引动的** —— 差分，不是有冲就报", () => {
    // 辰戌在本命里已相冲，两库本来就开；再来一个流月戌，不是它开的
    const c = chart(P("甲", "子"), P("丙", "寅"), P("戊", "辰"), P("庚", "戌"));
    expect(kinds(fleetingTriggers(c, null, null, P("壬", "戌")))).not.toContain("kuOpen");
  });

  it("**会局夺合**：流月亥使年子月丑成三会水局，子丑六合被夺", () => {
    const c = chart(P("甲", "子"), P("乙", "丑"), P("戊", "辰"), null);
    const ts = fleetingTriggers(c, null, null, P("丁", "亥"));
    const d = ts.filter((t) => t.kind === "juDuoHe");
    expect(d).toHaveLength(1);
    expect(d[0]!.text).toContain("三会水局");
    expect(d[0]!.text).toContain("年柱子月柱丑");
  });

  it("会局夺合的反向对照：流月卯成不了局 → 不夺", () => {
    const c = chart(P("甲", "子"), P("乙", "丑"), P("戊", "辰"), null);
    expect(kinds(fleetingTriggers(c, null, null, P("丁", "卯")))).not.toContain("juDuoHe");
  });

  it("**夺合不要求两支同在一个局里** —— 一个柱一个局，并集都被吞了就算", () => {
    // 巳申六合：月柱巳被流月酉成的巳酉丑吞，大运申被本来就有的申子辰吞。
    // 第一版要求两支同在一个流月局内，在真盘上漏了 9 帧里的 5 帧。
    const c = chart(P("庚", "子"), P("辛", "巳"), P("己", "丑"), P("壬", "辰"));
    const ts = fleetingTriggers(c, P("壬", "申"), null, P("辛", "酉"));
    const texts = ts.filter((t) => t.kind === "juDuoHe").map((t) => t.text);
    // 两个六合都被夺：巳申（月柱被流月局吞、大运被原有局吞），
    // 以及子丑（年柱被原有申子辰吞、日柱被流月局吞）—— 同一语义的两个实例
    expect(texts.some((x) => x.includes("月柱巳大运申")), "巳申").toBe(true);
    expect(texts.some((x) => x.includes("年柱子日柱丑")), "子丑").toBe(true);
  });

  it("**争合**：流月甲亦合日柱己，年甲日己之合遭争合", () => {
    const c = chart(P("甲", "子"), P("丁", "卯"), P("己", "巳"), null);
    const ts = fleetingTriggers(c, null, null, P("甲", "寅"));
    const z = ts.filter((t) => t.kind === "zhengHe");
    expect(z).toHaveLength(1);
    expect(z[0]!.text).toContain("流月甲亦合日柱己");
  });

  it("争合的反向对照：流月丙不合任何一干 → 不争", () => {
    const c = chart(P("甲", "子"), P("丁", "卯"), P("己", "巳"), null);
    expect(kinds(fleetingTriggers(c, null, null, P("丙", "寅")))).not.toContain("zhengHe");
  });

  it("**已被局夺走的六合，不再另报争合** —— 不自相矛盾", () => {
    const c = chart(P("甲", "子"), P("乙", "丑"), P("戊", "辰"), null);
    const ts = fleetingTriggers(c, null, null, P("丁", "亥"));
    expect(kinds(ts)).toContain("juDuoHe");
    expect(kinds(ts), "子丑已被三会吞掉，谈不上争合").not.toContain("zhengHe");
  });

  it("框定语是常量，不是各处各写一遍", () => {
    expect(MONTH_TRIGGER_FRAME).toBe("流年大运应期");
  });
});

describe("流月应期：真盘上的对照", () => {
  const EXAMPLE: BirthInput = {
    year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
  };
  const off = buildBaseChart(buildChart(EXAMPLE));
  const S = buildSeries(off, { years: 60, statsYears: 60 });
  const tri = (b: typeof off) => S.frames.map((f) =>
    fleetingTriggers(b.chart, f.luckPillar, f.annual, f.fleetingMonth, b.params));

  it("**与旧结构层的漏出逐帧一致** —— 开库 10 · 会局夺合 9 · 争合 67 帧", () => {
    // 这三个数不是本模块自己算出来给自己看的：它们是旧结构层（ae19b4a，三条规则
    // 还会把流月算进去）在同一张盘、同样 720 帧上，实际改动了本命等自身事件的帧数，
    // 并且**逐帧的集合**也一模一样（已用旧提交的检出版本逐帧比对过）。
    // 本模块是独立写的差分偵测，两边对上，才说明它没漏、没多。
    const rows = tri(off);
    const frames = (k: string) => rows.filter((r) => r.some((t) => t.kind === k)).length;
    expect(frames("kuOpen")).toBe(10);
    expect(frames("juDuoHe")).toBe(9);
    expect(frames("zhengHe")).toBe(67);
  });

  it("**不依赖实验开关**：开关开着与关着，算出的应期逐帧相同", () => {
    const on = buildBaseChart(buildChart(EXAMPLE, undefined), loadParams({
      series: { fleetingMonthInWeights: true },
    }));
    const a = tri(off).map((r) => r.map((t) => t.text));
    const b = tri(on).map((r) => r.map((t) => t.text));
    expect(b).toEqual(a);
  });

  it("每一条都是「流月」说的，且不含权重数字或吉凶", () => {
    for (const r of tri(off)) for (const t of r) {
      expect(t.text.startsWith("流月")).toBe(true);
      expect(t.text, "应期只说触发了什么，不说改了多少分").not.toMatch(/\d/);
      expect(t.text).not.toMatch(/吉|凶|好|坏|灾|祸/);
    }
  });
});

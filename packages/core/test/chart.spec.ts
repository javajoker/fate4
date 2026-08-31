import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { dayAndHourPillarOf, enclosingTermOf, lichunOf } from "../src/chart/pillars.js";
import { taiyuanOf, taixiOf, branchPartnerOf, stemPartnerOf } from "../src/chart/taiyuan.js";
import { mingGongOf } from "../src/chart/mingGong.js";
import { silingOf } from "../src/chart/siling.js";
import { luckDirectionOf, traditionalQiyun } from "../src/chart/qiyun.js";
import { fromJulianDay, julianDayNumber } from "../src/astro/julian.js";
import { julianDayToMillis } from "../src/time/timezone.js";
import { isValidPair, stepBranch, stepStem } from "../src/ganzhi/algebra.js";
import { BRANCHES, STEMS, type Branch } from "../src/types/ganzhi.js";

const P = (p: { stem: string; branch: string } | null) => (p ? p.stem + p.branch : "—");

/** 由 UT 儒略日构造一份「以 UTC 为时区、经度 0」的出生输入 —— 使 birthJdUT 精确等于目标时刻。 */
function atUtc(jd: number, extra: Partial<Parameters<typeof buildChart>[0]> = {}) {
  const d = new Date(julianDayToMillis(jd));
  return buildChart({
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
    gender: "male", timeZone: "UTC", longitude: 0, ...extra,
  });
}

describe("工作例 1990-05-12 14:30 上海", () => {
  const c = buildChart({
    year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
  });

  it("四柱 庚午 辛巳 丁丑 丁未", () => {
    expect([P(c.year), P(c.month), P(c.day), P(c.hour)]).toEqual(["庚午", "辛巳", "丁丑", "丁未"]);
  });

  it("胎元壬申 —— 月干进一、月支进三", () => {
    expect(P(c.taiyuan)).toBe("壬申");
    expect(c.taiyuan.stem).toBe(stepStem(c.month.stem, 1));
    expect(c.taiyuan.branch).toBe(stepBranch(c.month.branch, 3));
  });

  it("命宫丁亥", () => { expect(P(c.mingGong)).toBe("丁亥"); });

  it("夏令时已识别并扣除，真太阳时 13:39", () => {
    expect(c.corrections.isDaylightSaving).toBe(true);
    expect(c.corrections.tzOffsetMinutes).toBe(540);
    expect(c.corrections.netVsCivilMinutes).toBeCloseTo(-50.4, 0);
    expect(c.trueSolarCalendar.hour).toBe(13);
    expect(c.warnings.some((w) => w.includes("夏令时"))).toBe(true);
  });

  it("立夏后 6.45 日，庚金司令（第二段）", () => {
    expect(c.enclosingJie.prevName).toBe("立夏");
    expect(c.enclosingJie.nextName).toBe("芒种");
    expect(c.birthJdUT - c.enclosingJie.prevJd).toBeCloseTo(6.454, 2);
    expect(c.siling.stem).toBe("庚");
    expect(c.siling.segment).toBe(1);
    expect(c.siling.resolution).toBe("exact");
  });

  it("阳年男顺行，起运 8.24 岁，大运自壬午起", () => {
    expect(c.luck.direction).toBe("forward");
    expect(c.luck.targetTermName).toBe("芒种");
    expect(c.luck.startAgeYears).toBeCloseTo(8.24, 2);
    expect(c.luck.pillars.slice(0, 4).map((p) => P(p.pillar)))
      .toEqual(["壬午", "癸未", "甲申", "乙酉"]);
  });

  it("rulesUsed 完整声明所用规则", () => {
    expect(c.rulesUsed.ziHourRule).toBe("lateZiNextDay");
    expect(c.rulesUsed.mingGongBoundary).toBe("jie");
    expect(c.rulesUsed.solarProviderId).toBe("vsop87d-truncated");
    expect(c.rulesUsed.solarProviderMeetsTolerance).toBe(true);
  });
});

describe("日柱：73000 日连续推进无一错位", () => {
  it("每日恰进一位，且干支组合恒合法", () => {
    // 不走 buildChart —— 日柱只依历法，无需天文，故可穷举整个 1900–2100
    let prev = dayAndHourPillarOf(
      { year: 1900, month: 1, day: 1, hour: 12, minute: 0, second: 0 }, "lateZiNextDay").day;
    const start = julianDayNumber(1900, 1, 1);
    const end = julianDayNumber(2100, 12, 31);
    expect(end - start).toBeGreaterThan(73000);

    for (let jdn = start + 1; jdn <= end; jdn++) {
      const cal = fromJulianDay(jdn - 0.5 + 0.5);  // 该 JDN 的当日正午
      const got = dayAndHourPillarOf(
        { year: cal.year, month: cal.month, day: cal.day, hour: 12, minute: 0, second: 0 },
        "lateZiNextDay").day;
      expect(got.stem, `${cal.year}-${cal.month}-${cal.day}`).toBe(stepStem(prev.stem, 1));
      expect(got.branch).toBe(stepBranch(prev.branch, 1));
      expect(isValidPair(got.stem, got.branch)).toBe(true);
      prev = got;
    }
  });

  it("锚点：1949-10-01 甲子、2000-01-01 戊午", () => {
    const at = (y: number, m: number, d: number) =>
      P(dayAndHourPillarOf({ year: y, month: m, day: d, hour: 12, minute: 0, second: 0 }, "lateZiNextDay").day);
    expect(at(1949, 10, 1)).toBe("甲子");
    expect(at(2000, 1, 1)).toBe("戊午");
    expect(at(1990, 5, 12)).toBe("丁丑");
  });
});

describe("三种子时规则的差别只在 23–24 时显现", () => {
  const at = (hour: number, rule: "lateZiNextDay" | "earlyZiSameDay" | "split") =>
    dayAndHourPillarOf({ year: 1990, month: 5, day: 12, hour, minute: 30, second: 0 }, rule);

  it("22:30 三规则完全一致", () => {
    const [a, b, c] = (["lateZiNextDay", "earlyZiSameDay", "split"] as const).map((r) => at(22, r));
    expect(P(a!.day)).toBe(P(b!.day));
    expect(P(b!.day)).toBe(P(c!.day));
    expect(P(a!.hour)).toBe(P(c!.hour));
  });

  it("23:30 三规则两两不同", () => {
    const late = at(23, "lateZiNextDay");
    const early = at(23, "earlyZiSameDay");
    const split = at(23, "split");

    // 晚子换日：日柱进位
    expect(late.dayAdvanced).toBe(true);
    expect(P(late.day)).toBe("戊寅");        // 丁丑之次日
    // 早子不换：日柱不动，时干由当日日干起
    expect(early.dayAdvanced).toBe(false);
    expect(P(early.day)).toBe("丁丑");
    // 折衷：日柱不动，但时干借次日日干
    expect(P(split.day)).toBe("丁丑");
    expect(P(split.hour)).toBe(P(late.hour));   // 时柱同晚子
    expect(P(split.hour)).not.toBe(P(early.hour));
    // 三支皆为子
    for (const r of [late, early, split]) expect(r.hour.branch).toBe("子");
  });

  it("时支覆盖十二时辰且边界正确", () => {
    const expected: [number, Branch][] = [
      [23, "子"], [0, "子"], [1, "丑"], [3, "寅"], [5, "卯"], [7, "辰"], [9, "巳"],
      [11, "午"], [13, "未"], [15, "申"], [17, "酉"], [19, "戌"], [21, "亥"],
    ];
    for (const [h, b] of expected) {
      expect(at(h, "earlyZiSameDay").hour.branch, `${h} 时`).toBe(b);
    }
  });
});

describe("年柱以立春为界", () => {
  it("立春前后一分钟，年柱恰进一位", () => {
    for (const year of [1950, 1990, 2000, 2026, 2050]) {
      const lc = lichunOf(year);
      const before = atUtc(lc - 1 / 1440);
      const after = atUtc(lc + 1 / 1440);
      expect(before.year.stem, `${year} 立春前`).toBe(stepStem(after.year.stem, -1));
      expect(before.year.branch).toBe(stepBranch(after.year.branch, -1));
      // 月柱同时自丑转寅
      expect(before.month.branch).toBe("丑");
      expect(after.month.branch).toBe("寅");
    }
  });

  it("元旦不是年柱边界 —— 1 月 1 日仍属前一立春年", () => {
    const jan1 = atUtc(lichunOf(2026) - 34);   // 2026-01-01 前后
    const feb5 = atUtc(lichunOf(2026) + 1);
    expect(jan1.year.stem).toBe(stepStem(feb5.year.stem, -1));
  });

  it("公元 4 年为甲子年的锚点仍成立", () => {
    const c = atUtc(lichunOf(2044) + 10);   // 2044 = 4 + 60×34
    expect(P(c.year)).toBe("甲子");
  });
});

describe("月柱以节为界，十二节各开一支", () => {
  it("每个节的前后一分钟，月支恰进一位", () => {
    const year = 2026;
    for (let k = 0; k < 12; k++) {
      const lon = (315 + 30 * k) % 360;
      const probe = enclosingTermOf(lichunOf(year) + k * 30.4, "节");
      if (probe.prev.def.longitude !== lon) continue;
      const t = probe.prev.jdUT;
      const before = atUtc(t - 1 / 1440);
      const after = atUtc(t + 1 / 1440);
      expect(after.month.branch, `${probe.prev.def.name}`)
        .toBe(stepBranch(before.month.branch, 1));
      expect(after.month.stem).toBe(stepStem(before.month.stem, 1));
    }
  });
});

describe("命宫", () => {
  it("docs/02-chart.md §6 的五个算例", () => {
    const cases: [Branch, Branch, Branch][] = [
      ["寅", "子", "酉"], ["卯", "卯", "巳"], ["子", "子", "亥"],
      ["午", "午", "亥"], ["亥", "亥", "丑"],
    ];
    for (const [m, h, want] of cases) {
      expect(mingGongOf(m, h, "甲").branch, `${m}月${h}时`).toBe(want);
    }
  });

  it("午月午时与亥月亥时是边界例 —— 传统两分支口诀在此得 0", () => {
    expect(mingGongOf("午", "午", "甲").branch).toBe("亥");
    expect(mingGongOf("亥", "亥", "甲").branch).toBe("丑");
  });

  it("两种月界都可用，且在 rulesUsed 中声明", () => {
    const base = {
      year: 1990, month: 5, day: 12, hour: 14, minute: 30,
      gender: "male" as const, timeZone: "Asia/Shanghai", longitude: 121.47,
    };
    const jie = buildChart(base, { mingGongBoundary: "jie" });
    const zq = buildChart(base, { mingGongBoundary: "zhongqi" });
    expect(jie.rulesUsed.mingGongBoundary).toBe("jie");
    expect(zq.rulesUsed.mingGongBoundary).toBe("zhongqi");
    expect(jie.mingGong).not.toBeNull();
    expect(zq.mingGong).not.toBeNull();
  });

  it("命宫支覆盖全部十二支（遍历月×时）", () => {
    const got = new Set<Branch>();
    for (const m of BRANCHES) for (const h of BRANCHES) got.add(mingGongOf(m, h, "甲").branch);
    expect(got.size).toBe(12);
  });
});

describe("胎元与胎息", () => {
  it("月柱甲子 → 胎元乙卯；丙寅 → 丁巳", () => {
    expect(P(taiyuanOf({ stem: "甲", branch: "子" }))).toBe("乙卯");
    expect(P(taiyuanOf({ stem: "丙", branch: "寅" }))).toBe("丁巳");
  });

  it("胎元干支组合恒合法", () => {
    for (const s of STEMS) for (const b of BRANCHES) {
      if (!isValidPair(s, b)) continue;
      const t = taiyuanOf({ stem: s, branch: b });
      expect(isValidPair(t.stem, t.branch), `${s}${b}`).toBe(true);
    }
  });

  it("胎息 = 日干之合配日支之合：甲子 → 己丑", () => {
    expect(P(taixiOf({ stem: "甲", branch: "子" }))).toBe("己丑");
    expect(stemPartnerOf("甲")).toBe("己");
    expect(branchPartnerOf("子")).toBe("丑");
  });

  it("合是对合 —— partner(partner(x)) == x", () => {
    for (const s of STEMS) expect(stemPartnerOf(stemPartnerOf(s))).toBe(s);
    for (const b of BRANCHES) expect(branchPartnerOf(branchPartnerOf(b))).toBe(b);
  });
});

describe("司令分野", () => {
  it("巳月：0–5 日戊、5–14 日庚、14–30 日丙", () => {
    expect(silingOf("巳", 2).stem).toBe("戊");
    expect(silingOf("巳", 6.454).stem).toBe("庚");
    expect(silingOf("巳", 20).stem).toBe("丙");
  });

  it("亥月前 7 日是唯一无解的情形", () => {
    const early = silingOf("亥", 3);
    expect(early.stem).toBe("戊");
    expect(early.resolution).toBe("unresolvable");
    expect(early.resolvedTo).toBeNull();
    // 同月第二、三段则有解
    expect(silingOf("亥", 9).resolution).toBe("exact");
    expect(silingOf("亥", 20).resolution).toBe("exact");
  });

  it("四正支的首段按同五行回退", () => {
    for (const [b, cmd, to] of [["子", "壬", "癸"], ["卯", "甲", "乙"], ["午", "丙", "丁"], ["酉", "庚", "辛"]] as const) {
      const r = silingOf(b, 2);
      expect(r.stem, b).toBe(cmd);
      expect(r.resolution).toBe("sameElement");
      expect(r.resolvedTo).toBe(to);
    }
  });
});

describe("大运顺逆与起运", () => {
  it("阳男顺、阴女顺、阴男逆、阳女逆", () => {
    expect(luckDirectionOf("甲", "male")).toBe("forward");    // 阳男
    expect(luckDirectionOf("乙", "female")).toBe("forward");  // 阴女
    expect(luckDirectionOf("乙", "male")).toBe("reverse");    // 阴男
    expect(luckDirectionOf("甲", "female")).toBe("reverse");  // 阳女
  });

  it("同一时刻，男女大运反向且首步互为月柱两侧", () => {
    const base = {
      year: 1990, month: 5, day: 12, hour: 14, minute: 30,
      timeZone: "Asia/Shanghai", longitude: 121.47,
    };
    const m = buildChart({ ...base, gender: "male" });
    const f = buildChart({ ...base, gender: "female" });
    expect(m.luck.direction).toBe("forward");
    expect(f.luck.direction).toBe("reverse");
    expect(P(m.luck.pillars[0]!.pillar)).toBe("壬午");
    expect(P(f.luck.pillars[0]!.pillar)).toBe("庚辰");
    // 二者所趋之节相反
    expect(m.luck.targetTermName).toBe("芒种");
    expect(f.luck.targetTermName).toBe("立夏");
    // 距节之和即该月的节间距
    expect(m.luck.daysToTerm + f.luck.daysToTerm).toBeCloseTo(
      m.enclosingJie.nextJd - m.enclosingJie.prevJd, 6);
  });

  it("起运岁数恒为距节天数的三分之一", () => {
    for (const g of ["male", "female"] as const) {
      const c = buildChart({
        year: 1990, month: 5, day: 12, hour: 14, minute: 30,
        gender: g, timeZone: "Asia/Shanghai", longitude: 121.47,
      });
      expect(c.luck.startAgeYears).toBeCloseTo(c.luck.daysToTerm / 3, 9);
    }
  });

  it("传统离散口诀自洽：由 3日=1年 推出 1日=4月", () => {
    expect(traditionalQiyun(3)).toEqual({ years: 1, months: 0, days: 0 });
    expect(traditionalQiyun(1)).toEqual({ years: 0, months: 4, days: 0 });
    expect(traditionalQiyun(6)).toEqual({ years: 2, months: 0, days: 0 });
    // 1 时辰（1/12 日）= 10 日；即 1 小时 = 5 日
    const oneShichen = traditionalQiyun(1 / 12);
    expect(oneShichen.years).toBe(0);
    expect(oneShichen.months).toBe(0);
    expect(oneShichen.days).toBe(10);
  });

  it("大运十二步干支连续，且组合恒合法", () => {
    const c = buildChart({
      year: 1990, month: 5, day: 12, hour: 14, minute: 30,
      gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    expect(c.luck.pillars).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      const p = c.luck.pillars[i]!;
      expect(isValidPair(p.pillar.stem, p.pillar.branch)).toBe(true);
      expect(p.startAgeYears).toBeCloseTo(c.luck.startAgeYears + i * 10, 6);
      if (i > 0) {
        expect(p.pillar.stem).toBe(stepStem(c.luck.pillars[i - 1]!.pillar.stem, 1));
      }
    }
  });
});

describe("时辰未知", () => {
  const c = buildChart({
    year: 1990, month: 5, day: 12, hour: 0, minute: 0,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47, unknownHour: true,
  });

  it("时柱与命宫留白，不作猜测", () => {
    expect(c.hour).toBeNull();
    expect(c.mingGong).toBeNull();
    expect(c.warnings.some((w) => w.includes("时辰未知"))).toBe(true);
  });

  it("年月日柱不受影响", () => {
    expect([P(c.year), P(c.month)]).toEqual(["庚午", "辛巳"]);
  });
});

describe("盘面自洽的不变量", () => {
  it("四柱干支组合恒合法，且月干由年干推出、时干由日干推出", () => {
    const samples = [
      { year: 1900, month: 3, day: 15, hour: 5, minute: 0 },
      { year: 1949, month: 10, day: 1, hour: 15, minute: 0 },
      { year: 1988, month: 7, day: 15, hour: 23, minute: 30 },
      { year: 2000, month: 2, day: 29, hour: 12, minute: 0 },
      { year: 2026, month: 12, day: 21, hour: 20, minute: 50 },
      { year: 2050, month: 6, day: 1, hour: 0, minute: 30 },
    ];
    for (const s of samples) {
      const c = buildChart({ ...s, gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47 });
      for (const p of [c.year, c.month, c.day, c.hour!, c.taiyuan, c.mingGong!]) {
        expect(isValidPair(p.stem, p.branch), `${JSON.stringify(s)} ${P(p)}`).toBe(true);
      }
      expect(c.birthJdUT).toBeGreaterThan(c.enclosingJie.prevJd);
      expect(c.birthJdUT).toBeLessThan(c.enclosingJie.nextJd);
      expect(c.rulesUsed.solarProviderMeetsTolerance).toBe(true);
    }
  });
});

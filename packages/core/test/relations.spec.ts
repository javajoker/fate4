import { describe, expect, it } from "vitest";
import { BRANCHES, STEMS, type Branch, type Stem } from "../src/types/ganzhi.js";
import {
  BRANCH_CLASHES, BRANCH_DESTRUCTIONS, BRANCH_HARMS, BRANCH_SIX_COMBINATIONS,
  DIRECTIONALS, FOUR_BIRTHS, FOUR_PEAKS, FOUR_TOMBS, HIDDEN_STEMS,
  PUNISHMENTS, STEM_CLASHES, STEM_COMBINATIONS, TRINITIES,
} from "../src/ganzhi/tables.js";
import {
  branchIndex, controls, elementOf, mod, polarityOf, stemIndex, stepBranch,
} from "../src/ganzhi/algebra.js";
import { branchOfPhase } from "../src/ganzhi/changsheng.js";

describe("天干五合", () => {
  it("五组，覆盖十干各一次", () => {
    expect(STEM_COMBINATIONS).toHaveLength(5);
    const all = STEM_COMBINATIONS.flatMap(([a, b]) => [a, b]);
    expect(new Set(all).size).toBe(10);
    expect(new Set(all)).toEqual(new Set(STEMS));
  });

  it("每组间隔恒为 5 位", () => {
    for (const [a, b] of STEM_COMBINATIONS) {
      expect(mod(stemIndex(b) - stemIndex(a), 10), `${a}${b}`).toBe(5);
    }
  });

  it("合者必一阳一阴", () => {
    for (const [a, b] of STEM_COMBINATIONS) {
      expect(polarityOf(a)).not.toBe(polarityOf(b));
    }
  });

  it("合者原本相克 —— 相克而合，故谓之「合」", () => {
    for (const [a, b] of STEM_COMBINATIONS) {
      const ea = elementOf(a), eb = elementOf(b);
      expect(controls(ea, eb) || controls(eb, ea), `${a}${b}`).toBe(true);
    }
  });

  it("化神五行逐组正确", () => {
    expect(STEM_COMBINATIONS.map(([, , e]) => e)).toEqual(["土", "金", "水", "木", "火"]);
  });
});

describe("天干相冲", () => {
  it("四组，间隔 6 位、同阴阳、且相克；戊己不与焉", () => {
    expect(STEM_CLASHES).toHaveLength(4);
    for (const [a, b] of STEM_CLASHES) {
      expect(mod(stemIndex(b) - stemIndex(a), 10), `${a}${b} 间隔`).toBe(6);
      expect(polarityOf(a), `${a}${b} 阴阳`).toBe(polarityOf(b));
      expect(controls(elementOf(a), elementOf(b)) || controls(elementOf(b), elementOf(a))).toBe(true);
    }
    const involved = new Set(STEM_CLASHES.flatMap(([a, b]) => [a, b]));
    expect(involved.has("戊")).toBe(false);
    expect(involved.has("己")).toBe(false);
  });
});

describe("地支六合", () => {
  it("六组，覆盖十二支各一次", () => {
    expect(BRANCH_SIX_COMBINATIONS).toHaveLength(6);
    const all = BRANCH_SIX_COMBINATIONS.flatMap(([a, b]) => [a, b]);
    expect(new Set(all).size).toBe(12);
    expect(new Set(all)).toEqual(new Set(BRANCHES));
  });

  it("每组二支序号之和恒为 1（mod 12）—— 子丑为轴的对称", () => {
    for (const [a, b] of BRANCH_SIX_COMBINATIONS) {
      expect(mod(branchIndex(a) + branchIndex(b), 12), `${a}${b}`).toBe(1);
    }
  });
});

describe("地支六冲", () => {
  it("六组，覆盖十二支各一次，间隔恒为 6", () => {
    expect(BRANCH_CLASHES).toHaveLength(6);
    const all = BRANCH_CLASHES.flatMap(([a, b]) => [a, b]);
    expect(new Set(all)).toEqual(new Set(BRANCHES));
    for (const [a, b] of BRANCH_CLASHES) {
      expect(mod(branchIndex(b) - branchIndex(a), 12), `${a}${b}`).toBe(6);
    }
  });

  it("相冲者同为位阴阳（皆阳位或皆阴位）", () => {
    for (const [a, b] of BRANCH_CLASHES) {
      expect(branchIndex(a) % 2).toBe(branchIndex(b) % 2);
    }
  });

  it("四生冲四生、四旺冲四旺、四墓冲四墓 —— 不跨类", () => {
    const classOf = (b: Branch) =>
      (FOUR_BIRTHS as readonly Branch[]).includes(b) ? "生"
      : (FOUR_PEAKS as readonly Branch[]).includes(b) ? "旺" : "墓";
    for (const [a, b] of BRANCH_CLASHES) expect(classOf(a), `${a}${b}`).toBe(classOf(b));
  });
});

describe("六害与六破", () => {
  it("六害：六组，覆盖十二支各一次", () => {
    expect(BRANCH_HARMS).toHaveLength(6);
    expect(new Set(BRANCH_HARMS.flatMap(([a, b]) => [a, b]))).toEqual(new Set(BRANCHES));
  });

  it("六害 = 合我者之冲 —— 甲之六合被冲，即为害", () => {
    const heOf = new Map<Branch, Branch>();
    for (const [a, b] of BRANCH_SIX_COMBINATIONS) { heOf.set(a, b); heOf.set(b, a); }
    for (const [a, b] of BRANCH_HARMS) {
      expect(stepBranch(heOf.get(a)!, 6), `${a} 之害`).toBe(b);
    }
  });

  it("六破：六组，覆盖十二支各一次，间隔恒为 3 或 9", () => {
    expect(BRANCH_DESTRUCTIONS).toHaveLength(6);
    expect(new Set(BRANCH_DESTRUCTIONS.flatMap(([a, b]) => [a, b]))).toEqual(new Set(BRANCHES));
    for (const [a, b] of BRANCH_DESTRUCTIONS) {
      expect([3, 9], `${a}${b}`).toContain(mod(branchIndex(b) - branchIndex(a), 12));
    }
  });
});

describe("三合局", () => {
  it("四局，覆盖十二支各一次", () => {
    expect(TRINITIES).toHaveLength(4);
    const all = TRINITIES.flatMap((t) => [t.sheng, t.wang, t.mu]);
    expect(new Set(all).size).toBe(12);
    expect(new Set(all)).toEqual(new Set(BRANCHES));
  });

  it("生—旺—墓 三支两两相隔四位", () => {
    for (const t of TRINITIES) {
      expect(stepBranch(t.sheng, 4), `${t.element}局 生→旺`).toBe(t.wang);
      expect(stepBranch(t.wang, 4), `${t.element}局 旺→墓`).toBe(t.mu);
      expect(stepBranch(t.mu, 4), `${t.element}局 墓→生`).toBe(t.sheng);
    }
  });

  it("生在四生地、旺在四旺地、墓在四墓地", () => {
    for (const t of TRINITIES) {
      expect(FOUR_BIRTHS).toContain(t.sheng);
      expect(FOUR_PEAKS).toContain(t.wang);
      expect(FOUR_TOMBS).toContain(t.mu);
    }
  });

  it("局之三位恰为化神本气阳干的 长生 / 帝旺 / 墓", () => {
    const yangOf: Record<string, Stem> = { 木: "甲", 火: "丙", 金: "庚", 水: "壬" };
    for (const t of TRINITIES) {
      const s = yangOf[t.element]!;
      expect(branchOfPhase(s, "长生"), `${t.element}局 生`).toBe(t.sheng);
      expect(branchOfPhase(s, "帝旺"), `${t.element}局 旺`).toBe(t.wang);
      expect(branchOfPhase(s, "墓"), `${t.element}局 墓`).toBe(t.mu);
    }
  });

  it("旺支的本气五行即化神", () => {
    for (const t of TRINITIES) {
      expect(elementOf(HIDDEN_STEMS[t.wang][0]!), `${t.element}局`).toBe(t.element);
    }
  });
});

describe("三会方", () => {
  it("四方，覆盖十二支各一次，且三支在环上连续", () => {
    expect(DIRECTIONALS).toHaveLength(4);
    const all = DIRECTIONALS.flatMap((d) => [...d.branches]);
    expect(new Set(all)).toEqual(new Set(BRANCHES));
    for (const d of DIRECTIONALS) {
      const [a, b, c] = d.branches;
      expect(stepBranch(a, 1), `${d.name}`).toBe(b);
      expect(stepBranch(b, 1), `${d.name}`).toBe(c);
    }
  });

  it("中支即该方的四旺之一，其本气即会神", () => {
    for (const d of DIRECTIONALS) {
      const mid = d.branches[1];
      expect(FOUR_PEAKS, `${d.name} 中支`).toContain(mid);
      expect(elementOf(HIDDEN_STEMS[mid][0]!)).toBe(d.element);
    }
  });

  it("每方含一生地、一旺地、一墓地", () => {
    for (const d of DIRECTIONALS) {
      const kinds = d.branches.map((b) =>
        (FOUR_BIRTHS as readonly Branch[]).includes(b) ? "生"
        : (FOUR_PEAKS as readonly Branch[]).includes(b) ? "旺" : "墓");
      expect(new Set(kinds), `${d.name}`).toEqual(new Set(["生", "旺", "墓"]));
    }
  });
});

describe("三刑", () => {
  it("无恩、恃势各三支；无礼二支；自刑四组各一支", () => {
    const byKind = (k: string) => PUNISHMENTS.filter((p) => p.kind === k);
    expect(byKind("无恩之刑")[0]!.branches).toEqual(["寅", "巳", "申"]);
    expect(byKind("恃势之刑")[0]!.branches).toEqual(["丑", "戌", "未"]);
    expect(byKind("无礼之刑")[0]!.branches).toEqual(["子", "卯"]);
    expect(byKind("自刑")).toHaveLength(4);
    expect(byKind("自刑").flatMap((p) => p.branches).sort()).toEqual(["亥", "午", "辰", "酉"].sort());
  });

  it("无恩之刑三支皆为四生地", () => {
    for (const b of PUNISHMENTS.find((p) => p.kind === "无恩之刑")!.branches) {
      expect(FOUR_BIRTHS).toContain(b);
    }
  });

  it("恃势之刑三支皆为四墓地", () => {
    for (const b of PUNISHMENTS.find((p) => p.kind === "恃势之刑")!.branches) {
      expect(FOUR_TOMBS).toContain(b);
    }
  });
});

describe("四生 / 四旺 / 四墓 的划分", () => {
  it("三类互斥且恰好覆盖十二支", () => {
    const all = [...FOUR_BIRTHS, ...FOUR_PEAKS, ...FOUR_TOMBS];
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    expect(new Set(all)).toEqual(new Set(BRANCHES));
  });

  it("四墓皆土", () => {
    for (const b of FOUR_TOMBS) expect(elementOf(HIDDEN_STEMS[b][0]!)).toBe("土");
  });

  it("四旺各为一行之专气（藏干唯一），除午外", () => {
    for (const b of FOUR_PEAKS) {
      expect(HIDDEN_STEMS[b].length, `${b}`).toBeLessThanOrEqual(2);
    }
    expect(HIDDEN_STEMS["子"]).toEqual(["癸"]);
    expect(HIDDEN_STEMS["卯"]).toEqual(["乙"]);
    expect(HIDDEN_STEMS["酉"]).toEqual(["辛"]);
    expect(HIDDEN_STEMS["午"]).toEqual(["丁", "己"]); // 午藏己土，四旺中唯一的例外
  });
});

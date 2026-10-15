import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildReport } from "../src/report/assemble.js";
import { loadParams } from "../src/params/load.js";
import { baziPairing, PILLAR_DOMAIN, type PairInput } from "../src/pair/bazi.js";
import { synastry, ZIWEI_PAIRING_NOT_INCLUDED } from "../src/pair/synastry.js";
import { skyChart } from "../src/sky/chart.js";
import { asTT } from "../src/astro/julian.js";
import { deltaTSeconds } from "../src/astro/deltaT.js";
import { scanText } from "../src/report/guard.js";
import type { BirthInput } from "../src/chart/types.js";

const A_IN: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47, latitude: 31.23,
};
const B_IN: BirthInput = {
  year: 1992, month: 11, day: 3, hour: 9, minute: 15,
  gender: "female", timeZone: "Asia/Shanghai", longitude: 121.47, latitude: 31.23,
};

const mk = (i: BirthInput): PairInput => {
  const chart = buildBaseChart(buildChart(i), loadParams());
  const r = buildReport(chart, {});
  return {
    chart,
    yongshen: {
      primary: r.strength.yongshen.value.primary,
      xishen: r.strength.yongshen.value.xishen,
    },
  };
};

const A = mk(A_IN);
const B = mk(B_IN);

describe("四柱合盘", () => {
  const P = baziPairing(A, B);

  it("**分数恒为 null** —— 这是这个功能最要紧的一条约束", () => {
    expect(P.score).toBeNull();
    expect(baziPairing(B, A).score).toBeNull();
    // 类型上也锁住：score 的类型是 null，不是 number | null
    const _check: null = P.score;
    expect(_check).toBeNull();
  });

  it("**产出里没有任何合计、总分、百分制的字段**", () => {
    // 查的是**字段名**，不是序列化后的文本 —— notes 里正解释着
    // 「为什么不给总分」，拿字符串去扫会把那句解释当成违例。
    const keys = new Set<string>();
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (x === null || typeof x !== "object") return;
      for (const [k, v] of Object.entries(x)) { keys.add(k); walk(v); }
    };
    walk(P);
    for (const bad of ["total", "overall", "compat", "rating", "合计", "总分", "评分"]) {
      for (const k of keys) {
        expect(k.toLowerCase().includes(bad.toLowerCase()), `字段 ${k}`).toBe(false);
      }
    }
    // 反向对照：确实遍历到了嵌套字段
    expect(keys.has("dayMaster")).toBe(true);
    expect(keys.has("shareInOther")).toBe(true);
    expect(keys.size).toBeGreaterThan(15);
  });

  it("日主关系算得对，且相冲相合各自标出", () => {
    expect(P.dayMaster.aStem).toBe("丁");
    expect(P.dayMaster.bStem).toBe("癸");
    expect(P.dayMaster.aElement).toBe("火");
    expect(P.dayMaster.bElement).toBe("水");
    expect(P.dayMaster.relation).toBe("被克");     // 水克火
    expect(P.dayMaster.clashes).toBe(true);        // 丁癸相冲
    expect(P.dayMaster.why).toContain("受克于");
  });

  it("**日主关系的方向随甲乙互换而反转** —— 它不是对称量", () => {
    const Q = baziPairing(B, A);
    expect(Q.dayMaster.relation).toBe("克出");
    expect(P.dayMaster.relation).toBe("被克");
  });

  it("干支关系逐条带柱位与来历", () => {
    expect(P.relations.length).toBeGreaterThan(0);
    for (const r of P.relations) {
      expect(["年", "月", "日", "时"]).toContain(r.from);
      expect(["年", "月", "日", "时"]).toContain(r.to);
      expect(r.why.length).toBeGreaterThan(3);
      if (r.kind.includes("合")) expect(r.transformsTo).toBeDefined();
      if (r.kind.includes("冲") || r.kind.includes("害")) {
        expect(r.transformsTo).toBeUndefined();
      }
    }
  });

  it("**十六组全看，不只看日柱** —— 只看日柱是一种取法，不是全部", () => {
    // 这张盘上日柱之外确实有关系命中，否则这条断言是空的
    const nonDay = P.relations.filter((r) => r.from !== "日" || r.to !== "日");
    expect(nonDay.length).toBeGreaterThan(0);
  });

  it("用神供给两边各算一遍，且带自身占比作对照", () => {
    for (const side of [P.aNeedsFromB, P.bNeedsFromA]) {
      expect(side.length).toBeGreaterThan(0);
      expect(side[0]!.role).toBe("用神");
      for (const s of side) {
        expect(s.shareInOther).toBeGreaterThanOrEqual(0);
        expect(s.shareInOther).toBeLessThanOrEqual(1);
        expect(s.shareInSelf).toBeGreaterThanOrEqual(0);
      }
    }
    // 没有自身占比，那个数读不出意思 —— 故两个都必须在
    expect(Object.keys(P.aNeedsFromB[0]!)).toContain("shareInSelf");
  });

  it("**自己与自己合盘时，用神占比两边相同** —— 这条给 share 做自检", () => {
    const S = baziPairing(A, A);
    for (const s of S.aNeedsFromB) {
      expect(s.shareInOther).toBeCloseTo(s.shareInSelf, 12);
    }
  });

  it("柱位取象是取象，措辞上不得像断语", () => {
    for (const v of Object.values(PILLAR_DOMAIN)) {
      expect(v).toContain("那一柱");
      expect(scanText(v, "pair.domain"), v).toEqual([]);
    }
  });
});

describe("星盘合盘", () => {
  const sky = (i: BirthInput) => {
    const c = buildChart(i);
    const jdTT = asTT(c.birthJdUT
      + deltaTSeconds(i.year, i.month).seconds / 86400);
    return skyChart(c.birthJdUT as never, jdTT, i.longitude, i.latitude!);
  };
  const SA = sky(A_IN);
  const SB = sky(B_IN);
  const S = synastry(SA, SB);

  it("分数恒为 null —— 与四柱同一条纪律", () => {
    expect(S.score).toBeNull();
  });

  it("交互相位两边的星都在，且带容许度与整宫标记", () => {
    expect(S.crossAspects.length).toBeGreaterThan(0);
    for (const a of S.crossAspects) {
      expect(a.orb).toBeGreaterThanOrEqual(0);
      expect(typeof a.byWholeSign).toBe("boolean");
      expect(a.aName.length).toBeGreaterThan(0);
      expect(a.kindName.length).toBeGreaterThan(0);
    }
  });

  it("**落宫两个方向不同** —— 两张盘的上升点不同，只算一边是常见实现错误", () => {
    expect(S.aInBHouses).toHaveLength(7);
    expect(S.bInAHouses).toHaveLength(7);
    // 这两张盘的上升点确实不同，否则下面那条断言是空的
    expect(S.ascendantGap).toBeGreaterThan(1);
    const sameBody = (x: string) =>
      S.aInBHouses.find((p) => p.body === x)!.house
      === S.bInAHouses.find((p) => p.body === x)!.house;
    // 七颗星的落宫不可能两个方向全同
    expect(["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"]
      .every(sameBody)).toBe(false);
  });

  it("**甲乙互换时，两张落宫表对调**", () => {
    const T = synastry(SB, SA);
    expect(T.aInBHouses.map((p) => p.house)).toEqual(S.bInAHouses.map((p) => p.house));
    expect(T.bInAHouses.map((p) => p.house)).toEqual(S.aInBHouses.map((p) => p.house));
  });

  it("容许度是参数 —— 放宽必不减少按度成相的条目", () => {
    const narrow = synastry(SA, SB, 3).crossAspects.filter((a) => !a.byWholeSign);
    const wide = synastry(SA, SB, 10).crossAspects.filter((a) => !a.byWholeSign);
    expect(wide.length).toBeGreaterThanOrEqual(narrow.length);
  });

  it("紫微合盘明说不收，而不是悄悄没有", () => {
    expect(ZIWEI_PAIRING_NOT_INCLUDED).toContain("无可靠底本");
    expect(ZIWEI_PAIRING_NOT_INCLUDED).toContain("不收录");
  });
});

describe("合盘的诚实性约束", () => {
  const P = baziPairing(A, B);

  it("**每次合盘都说清四件事**", () => {
    const n = P.notes.join("\n");
    expect(n).toContain("不是对两个人的判断");
    expect(n).toContain("不给合盘分数");
    expect(n).toContain("不等于「不好」");
    expect(n).toContain("与那个人知不知道这件事无关");
  });

  it("**对外文本过措辞守卫** —— 合盘最容易滑向对一段关系的判决", () => {
    const texts = [
      ...P.notes,
      P.dayMaster.why,
      ...P.relations.map((r) => r.why),
      ZIWEI_PAIRING_NOT_INCLUDED,
    ];
    for (const t of texts) {
      expect(scanText(t, "pair"), t.slice(0, 40)).toEqual([]);
    }
  });

  it("**运行时字符串里没有 Markdown 粗体**", () => {
    for (const t of [...P.notes, P.dayMaster.why, ...P.relations.map((r) => r.why)]) {
      expect(t.includes("**"), t.slice(0, 36)).toBe(false);
    }
  });

  it("**源码里没有任何打分的实现** —— 不是运行时才返回 null", () => {
    // 若日后有人加了一个 computeScore 再在出口处置 null，这条会红。
    const src = ["bazi.ts", "synastry.ts"].map((f) =>
      readFileSync(resolve(import.meta.dirname, "../src/pair", f), "utf8")).join("\n");
    expect(existsSync(resolve(import.meta.dirname, "../src/pair/bazi.ts"))).toBe(true);
    for (const bad of [/function\s+\w*[Ss]core/, /compatib/i, /\bweightedSum\b/]) {
      expect(bad.test(src), `源码里不该有 ${bad}`).toBe(false);
    }
    // 反向对照：确实读到了源码
    expect(src.length).toBeGreaterThan(5000);
    expect(src).toContain("不给合盘分数");
  });

  it("**合盘不产出对任何一方的人格描述** —— 与 subject:other 同一条线", () => {
    const j = JSON.stringify(P);
    // 人格层的那些枚举一个都不该出现在合盘产出里
    for (const bad of ["persona", "形体", "脏腑", "内经", "显隐比"]) {
      expect(j.includes(bad), `不该出现 ${bad}`).toBe(false);
    }
  });
});

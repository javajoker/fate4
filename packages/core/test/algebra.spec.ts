import { describe, expect, it } from "vitest";
import { BRANCHES, STEMS, TEN_GODS, type Branch, type Stem } from "../src/types/ganzhi.js";
import {
  actingRelation, branchAt, branchIndex, hiddenStemsOf,
  hourStemOf, isValidPair, mod, monthStemOf, nayinOf, polarityOf,
  sexagenaryAt, sexagenaryIndexOf, stemAt, stemIndex, stepBranch, stepStem,
  tenGod, xunKongOf, xunStartOf, yinMonthStemOf, ziHourStemOf,
} from "../src/ganzhi/algebra.js";

describe("mod", () => {
  it("负数归正", () => {
    expect(mod(-1, 12)).toBe(11);
    expect(mod(-13, 12)).toBe(11);
    expect(mod(-60, 60)).toBe(0);
    expect(mod(0, 10)).toBe(0);
  });
});

describe("有向作用关系", () => {
  it("同五行为「同」", () => {
    expect(actingRelation("木", "木")).toBe("同");
  });

  it("生与克方向正确", () => {
    expect(actingRelation("木", "火")).toBe("生");
    expect(actingRelation("木", "土")).toBe("克");
  });

  it("被生、被克在正向皆为「无」—— 其作用由反向有序对计入", () => {
    expect(actingRelation("火", "木")).toBe("无"); // 木生火，火不作用于木
    expect(actingRelation("土", "木")).toBe("无"); // 木克土，土不作用于木
  });

  it("任一有序对恰有一种关系，且 5×5 分布为 5 同 / 5 生 / 5 克 / 10 无", () => {
    const tally: Record<string, number> = { 同: 0, 生: 0, 克: 0, 无: 0 };
    const els = ["木", "火", "土", "金", "水"] as const;
    for (const a of els) for (const b of els) tally[actingRelation(a, b)]! += 1;
    expect(tally).toEqual({ 同: 5, 生: 5, 克: 5, 无: 10 });
  });
});

describe("十神", () => {
  it("对任一日主，十干一一映射到十神（双射）", () => {
    for (const dm of STEMS) {
      const gods = STEMS.map((s) => tenGod(dm, s));
      expect(new Set(gods).size, `日主 ${dm} 未覆盖全部十神`).toBe(10);
      expect(new Set(gods)).toEqual(new Set(TEN_GODS));
    }
  });

  it("日主对自身为比肩", () => {
    for (const dm of STEMS) expect(tenGod(dm, dm)).toBe("比肩");
  });

  it("甲木一列（《渊海子平》通例）", () => {
    const expected: Record<string, string> = {
      甲: "比肩", 乙: "劫财", 丙: "食神", 丁: "伤官", 戊: "偏财",
      己: "正财", 庚: "七杀", 辛: "正官", 壬: "偏印", 癸: "正印",
    };
    for (const [s, g] of Object.entries(expected)) expect(tenGod("甲", s as Stem)).toBe(g);
  });

  it("丁火一列（工作例 庚午辛巳丁丑丁未 的日主）", () => {
    const expected: Record<string, string> = {
      丁: "比肩", 丙: "劫财", 己: "食神", 戊: "伤官", 辛: "偏财",
      庚: "正财", 癸: "七杀", 壬: "正官", 乙: "偏印", 甲: "正印",
    };
    for (const [s, g] of Object.entries(expected)) expect(tenGod("丁", s as Stem)).toBe(g);
  });

  it("同性者必为比肩/食神/偏财/七杀/偏印之一", () => {
    const sameSet = new Set(["比肩", "食神", "偏财", "七杀", "偏印"]);
    for (const dm of STEMS) for (const s of STEMS) {
      const isSame = polarityOf(s) === polarityOf(dm);
      expect(sameSet.has(tenGod(dm, s)), `${dm}→${s}`).toBe(isSame);
    }
  });
});

describe("六十甲子", () => {
  it("序号与干支互为逆运算", () => {
    for (let n = 0; n < 60; n++) {
      const { stem, branch } = sexagenaryAt(n);
      expect(sexagenaryIndexOf(stem, branch), `n=${n}`).toBe(n);
    }
  });

  it("恰有 60 个合法组合，且皆同位阴阳", () => {
    const valid: string[] = [];
    for (const s of STEMS) for (const b of BRANCHES) if (isValidPair(s, b)) valid.push(s + b);
    expect(valid).toHaveLength(60);
    expect(new Set(valid).size).toBe(60);
  });

  it("阴阳不配者抛错", () => {
    expect(() => sexagenaryIndexOf("甲", "丑")).toThrow(/不是合法/);
    expect(() => sexagenaryIndexOf("乙", "子")).toThrow(/不是合法/);
  });

  it("锚点：0 甲子 · 59 癸亥 · 50 甲寅", () => {
    expect(sexagenaryAt(0)).toEqual({ stem: "甲", branch: "子" });
    expect(sexagenaryAt(59)).toEqual({ stem: "癸", branch: "亥" });
    expect(sexagenaryAt(50)).toEqual({ stem: "甲", branch: "寅" });
  });

  it("纳音每两位共用一名，六十位覆盖三十名", () => {
    for (let n = 0; n < 60; n += 2) expect(nayinOf(n)).toBe(nayinOf(n + 1));
    expect(new Set(Array.from({ length: 60 }, (_, n) => nayinOf(n))).size).toBe(30);
    expect(nayinOf(0)).toBe("海中金");
    expect(nayinOf(59)).toBe("大海水");
  });
});

describe("旬空", () => {
  it("六旬起点为 0/10/20/30/40/50", () => {
    expect([0, 5, 9, 10, 19, 20, 55].map(xunStartOf)).toEqual([0, 0, 0, 10, 10, 20, 50]);
  });

  it("六旬的空亡二支恰好不重不漏覆盖十二支", () => {
    const all = [0, 10, 20, 30, 40, 50].flatMap((n) => [...xunKongOf(n)]);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    expect(new Set(all)).toEqual(new Set(BRANCHES));
  });

  it("空亡即该旬中无天干可配的二支", () => {
    for (const start of [0, 10, 20, 30, 40, 50]) {
      const used = new Set<Branch>();
      for (let k = 0; k < 10; k++) used.add(sexagenaryAt(start + k).branch);
      const empty = BRANCHES.filter((b) => !used.has(b));
      expect(new Set(xunKongOf(start)), `旬起 ${start}`).toEqual(new Set(empty));
    }
  });

  it("甲子旬空戌亥 · 甲戌旬空申酉 · 甲寅旬空子丑", () => {
    expect(xunKongOf(sexagenaryIndexOf("甲", "子"))).toEqual(["戌", "亥"]);
    expect(xunKongOf(sexagenaryIndexOf("甲", "戌"))).toEqual(["申", "酉"]);
    expect(xunKongOf(sexagenaryIndexOf("甲", "寅"))).toEqual(["子", "丑"]);
  });
});

describe("五虎遁（年上起月）", () => {
  it("口诀逐句：甲己丙 · 乙庚戊 · 丙辛庚 · 丁壬壬 · 戊癸甲", () => {
    const expected: [Stem[], Stem][] = [
      [["甲", "己"], "丙"], [["乙", "庚"], "戊"], [["丙", "辛"], "庚"],
      [["丁", "壬"], "壬"], [["戊", "癸"], "甲"],
    ];
    for (const [years, yin] of expected) {
      for (const y of years) expect(yinMonthStemOf(y), `${y}年寅月`).toBe(yin);
    }
  });

  it("同一年内十二月干顺行不断", () => {
    const order: Branch[] = ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"];
    for (const y of STEMS) {
      const stems = order.map((b) => monthStemOf(y, b));
      for (let i = 1; i < stems.length; i++) {
        expect(stems[i], `${y}年第${i + 1}月`).toBe(stepStem(stems[i - 1]!, 1));
      }
    }
  });

  it("工作例：庚年巳月为辛巳", () => {
    expect(monthStemOf("庚", "巳")).toBe("辛");
    expect(monthStemOf("庚", "寅")).toBe("戊");
  });
});

describe("五鼠遁（日上起时）", () => {
  it("口诀逐句：甲己甲 · 乙庚丙 · 丙辛戊 · 丁壬庚 · 戊癸壬", () => {
    const expected: [Stem[], Stem][] = [
      [["甲", "己"], "甲"], [["乙", "庚"], "丙"], [["丙", "辛"], "戊"],
      [["丁", "壬"], "庚"], [["戊", "癸"], "壬"],
    ];
    for (const [days, zi] of expected) {
      for (const d of days) expect(ziHourStemOf(d), `${d}日子时`).toBe(zi);
    }
  });

  it("一日内十二时干顺行不断", () => {
    for (const d of STEMS) {
      for (let i = 1; i < 12; i++) {
        expect(hourStemOf(d, branchAt(i))).toBe(stepStem(hourStemOf(d, branchAt(i - 1)), 1));
      }
    }
  });

  it("工作例：丁日未时为丁未", () => {
    expect(hourStemOf("丁", "未")).toBe("丁");
    expect(hourStemOf("丁", "子")).toBe("庚");
  });

  it("时柱干支组合恒合法", () => {
    for (const d of STEMS) for (const b of BRANCHES) {
      expect(isValidPair(hourStemOf(d, b), b), `${d}日${b}时`).toBe(true);
    }
  });

  it("寅月干恰为子时干进二位 —— 寅在子后两支", () => {
    for (const s of STEMS) expect(yinMonthStemOf(s)).toBe(stepStem(ziHourStemOf(s), 2));
  });
});

describe("步进与索引", () => {
  it("步进闭合", () => {
    for (const s of STEMS) expect(stepStem(s, 10)).toBe(s);
    for (const b of BRANCHES) expect(stepBranch(b, 12)).toBe(b);
    for (const s of STEMS) expect(stepStem(stepStem(s, -3), 3)).toBe(s);
  });

  it("索引与取值互逆", () => {
    for (const s of STEMS) expect(stemAt(stemIndex(s))).toBe(s);
    for (const b of BRANCHES) expect(branchAt(branchIndex(b))).toBe(b);
  });

  it("未知干支抛错", () => {
    expect(() => stemIndex("甴" as Stem)).toThrow(/未知天干/);
    expect(() => branchIndex("孒" as Branch)).toThrow(/未知地支/);
  });
});

describe("藏干下发", () => {
  it("每支藏干比例之和为 1，角色依次为本气/中气/余气", () => {
    for (const b of BRANCHES) {
      const hs = hiddenStemsOf(b);
      expect(hs.reduce((a, h) => a + h.share, 0), `${b}`).toBeCloseTo(1.0, 12);
      expect(hs[0]!.role).toBe("本气");
      if (hs.length > 1) expect(hs[1]!.role).toBe("中气");
      if (hs.length > 2) expect(hs[2]!.role).toBe("余气");
    }
  });

  it("60 分下发的具体数值（docs/03-weights.md §2 的三行表）", () => {
    const at = (b: Branch) => hiddenStemsOf(b).map((h) => +(h.share * 60).toFixed(10));
    expect(at("子")).toEqual([60]);
    expect(at("午")).toEqual([42, 18]);
    expect(at("巳")).toEqual([39, 15, 6]);
  });

  it("三藏支的余气恒为最小份额，且非零", () => {
    for (const b of BRANCHES) {
      const hs = hiddenStemsOf(b);
      if (hs.length < 3) continue;
      const last = hs.at(-1)!;
      expect(last.share, `${b} 余气`).toBeGreaterThan(0);
      expect(last.share).toBeLessThan(hs[0]!.share);
      expect(+(last.share * 60).toFixed(6), `${b} 余气 60 分制`).toBe(6);
    }
  });
});

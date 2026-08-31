import { describe, expect, it } from "vitest";
import {
  BRANCHES, ELEMENTS, STEMS, TEN_GODS,
  type Branch, type Element, type Stem,
} from "../src/types/ganzhi.js";
import {
  BRANCH_ELEMENT, BRANCH_POSITIONAL_POLARITY, CONTROLS, GENERATES,
  HIDDEN_SPLIT, HIDDEN_STEMS, NAYIN, SILING,
  STEM_ELEMENT, STEM_POLARITY, TOMB_OF, TOMB_STORES, FOUR_TOMBS,
} from "../src/ganzhi/tables.js";
import { branchQiPolarity, elementOf, polarityOf } from "../src/ganzhi/algebra.js";
import { plain, sectionOf, tableRows } from "./_doc.js";

describe("基数", () => {
  it("十干、十二支、五行、十神", () => {
    expect(STEMS).toHaveLength(10);
    expect(BRANCHES).toHaveLength(12);
    expect(ELEMENTS).toHaveLength(5);
    expect(TEN_GODS).toHaveLength(10);
    expect(new Set(STEMS).size).toBe(10);
    expect(new Set(BRANCHES).size).toBe(12);
    expect(new Set(TEN_GODS).size).toBe(10);
  });

  it("每个五行恰有一阳干一阴干", () => {
    for (const el of ELEMENTS) {
      const of = STEMS.filter((s) => STEM_ELEMENT[s] === el);
      expect(of, `${el} 应有两干`).toHaveLength(2);
      expect(of.map((s) => STEM_POLARITY[s]).sort()).toEqual(["阳", "阴"].sort());
    }
  });

  it("地支位阴阳按序位交替", () => {
    BRANCHES.forEach((b, i) => {
      expect(BRANCH_POSITIONAL_POLARITY[b]).toBe(i % 2 === 0 ? "阳" : "阴");
    });
  });
});

describe("体阴用阳：位阴阳 ≠ 气阴阳，恰在 子午巳亥 四支", () => {
  it("不一致的正好是这四支", () => {
    const mismatched = BRANCHES.filter(
      (b) => BRANCH_POSITIONAL_POLARITY[b] !== branchQiPolarity(b),
    );
    expect(new Set(mismatched)).toEqual(new Set<Branch>(["子", "午", "巳", "亥"]));
  });

  it("气阴阳取本气藏干的阴阳", () => {
    expect(branchQiPolarity("子")).toBe("阴"); // 癸
    expect(branchQiPolarity("午")).toBe("阴"); // 丁
    expect(branchQiPolarity("巳")).toBe("阳"); // 丙
    expect(branchQiPolarity("亥")).toBe("阳"); // 壬
  });

  it("本气藏干的五行即地支本气五行", () => {
    for (const b of BRANCHES) {
      expect(elementOf(HIDDEN_STEMS[b][0]!), `${b} 本气`).toBe(BRANCH_ELEMENT[b]);
    }
  });
});

describe("藏干", () => {
  it("单藏 3 支、双藏 2 支、三藏 7 支，合计 12", () => {
    const byCount = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    for (const b of BRANCHES) byCount[HIDDEN_STEMS[b].length]! += 1;
    expect(byCount).toEqual({ 1: 3, 2: 2, 3: 7 });
    expect(byCount[1]! + byCount[2]! + byCount[3]!).toBe(12);
  });

  it("下发比例各自求和为 1", () => {
    for (const n of [1, 2, 3] as const) {
      const sum = HIDDEN_SPLIT[n].reduce((a, b) => a + b, 0);
      expect(sum, `${n} 藏`).toBeCloseTo(1.0, 12);
      expect(HIDDEN_SPLIT[n]).toHaveLength(n);
    }
  });

  it("比例严格递减（本气 > 中气 > 余气）", () => {
    for (const n of [2, 3] as const) {
      const s = HIDDEN_SPLIT[n];
      for (let i = 1; i < s.length; i++) expect(s[i]!).toBeLessThan(s[i - 1]!);
    }
  });

  it("同一支内藏干不重复", () => {
    for (const b of BRANCHES) {
      expect(new Set(HIDDEN_STEMS[b]).size, `${b}`).toBe(HIDDEN_STEMS[b].length);
    }
  });

  it("与 docs/01-foundations.md §3 逐格一致", () => {
    const rows = tableRows(sectionOf("地支藏干")).slice(1); // 丢表头
    expect(rows.length).toBe(12);
    for (const cells of rows) {
      const branch = plain(cells[0]!) as Branch;
      const docStems = [cells[1], cells[2], cells[3]]
        .map((c) => plain(c ?? ""))
        .filter((c) => c !== "" && c !== "—") as Stem[];
      const docCount = Number(plain(cells[4]!));
      expect(HIDDEN_STEMS[branch], `${branch} 藏干`).toEqual(docStems);
      expect(docStems.length, `${branch} 个数栏`).toBe(docCount);
    }
  });
});

describe("五行生克", () => {
  it("相生构成一个 5-循环", () => {
    let cur: Element = ELEMENTS[0]!;
    const seen = new Set<Element>([cur]);
    for (let i = 0; i < 4; i++) {
      cur = GENERATES[cur];
      expect(seen.has(cur), `相生在第 ${i + 1} 步提前闭环`).toBe(false);
      seen.add(cur);
    }
    expect(GENERATES[cur]).toBe(ELEMENTS[0]);
    expect(seen.size).toBe(5);
  });

  it("相克构成一个 5-循环", () => {
    let cur: Element = ELEMENTS[0]!;
    const seen = new Set<Element>([cur]);
    for (let i = 0; i < 4; i++) {
      cur = CONTROLS[cur];
      expect(seen.has(cur)).toBe(false);
      seen.add(cur);
    }
    expect(CONTROLS[cur]).toBe(ELEMENTS[0]);
  });

  it("生与克不重合，且皆非自反", () => {
    for (const el of ELEMENTS) {
      expect(GENERATES[el]).not.toBe(el);
      expect(CONTROLS[el]).not.toBe(el);
      expect(GENERATES[el]).not.toBe(CONTROLS[el]);
    }
  });

  it("克者恰为「生我者所生」之外的那一个 —— 隔一位相克", () => {
    // 木克土：木生火、火生土，故克位 = 生位的生位
    for (const el of ELEMENTS) {
      expect(CONTROLS[el]).toBe(GENERATES[GENERATES[el]]);
    }
  });
});

describe("纳音", () => {
  it("30 名，覆盖六十甲子", () => {
    expect(NAYIN).toHaveLength(30);
    expect(new Set(NAYIN).size, "纳音名可以重复（沙中金/沙中土等），但不应全同").toBeGreaterThan(20);
  });

  it("每名以五行之一收尾", () => {
    for (const n of NAYIN) {
      expect(ELEMENTS, `${n}`).toContain(n.slice(-1));
    }
  });
});

describe("司令分野", () => {
  it("每支各段天数之和为 30", () => {
    for (const b of BRANCHES) {
      const sum = SILING[b].reduce((a, s) => a + s.days, 0);
      expect(sum, `${b} 月司令天数`).toBe(30);
    }
  });

  it("段数 = 藏干数 + （首段司令不在藏干中则 1）", () => {
    // 首段司令常是上月本气的余绪，未必是本支藏干之一。
    // 子(壬)、卯(甲)、午(丙)、酉(庚)、亥(戊) 五支即如此，故多出一段。
    for (const b of BRANCHES) {
      const extra = HIDDEN_STEMS[b].includes(SILING[b][0]!.stem) ? 0 : 1;
      expect(SILING[b].length, `${b}`).toBe(HIDDEN_STEMS[b].length + extra);
    }
  });

  it("末段司令必为本气", () => {
    for (const b of BRANCHES) {
      const last = SILING[b].at(-1)!;
      expect(last.stem, `${b} 末段`).toBe(HIDDEN_STEMS[b][0]);
    }
  });

  it("首段司令不在藏干中的，恰为 子卯午酉亥 五支", () => {
    const notHidden = BRANCHES.filter(
      (b) => !HIDDEN_STEMS[b].includes(SILING[b][0]!.stem),
    );
    expect(new Set(notHidden)).toEqual(new Set<Branch>(["子", "卯", "午", "酉", "亥"]));
  });

  it("四正支的首段司令可按同五行回退（壬→癸 甲→乙 丙→丁 庚→辛）", () => {
    for (const b of ["子", "卯", "午", "酉"] as Branch[]) {
      const cmd = SILING[b][0]!.stem;
      expect(HIDDEN_STEMS[b].includes(cmd), `${b} 首段司令不应是藏干`).toBe(false);
      expect(elementOf(cmd), `${b} 首段司令 ${cmd} 应与本气同五行`).toBe(BRANCH_ELEMENT[b]);
      expect(polarityOf(cmd), `${b} 首段司令应为阳、本气为阴`).not.toBe(
        polarityOf(HIDDEN_STEMS[b][0]!),
      );
    }
  });

  it("亥是唯一无法回退的支 —— 戊土司令而亥只藏壬甲，无土可着", () => {
    // 亥月前 7 日戊土司令，是戌月土气的余绪；亥藏壬甲，同五行回退亦无解。
    // 此即 docs/01-foundations.md §10 规则 3 所指的 siling-unresolvable，
    // 且经穷举确认：十二支中仅此一例。
    const unresolvable = BRANCHES.filter((b) => {
      const cmd = SILING[b][0]!.stem;
      if (HIDDEN_STEMS[b].includes(cmd)) return false;
      return !HIDDEN_STEMS[b].some((h) => elementOf(h) === elementOf(cmd));
    });
    expect(unresolvable).toEqual(["亥"]);
    expect(SILING["亥"][0]!.stem).toBe("戊");
    expect(HIDDEN_STEMS["亥"]).toEqual(["壬", "甲"]);
  });

  it("与 docs/01-foundations.md §10 逐格一致", () => {
    const rows = tableRows(sectionOf("司令分野")).slice(1);
    expect(rows.length).toBe(12);
    for (const cells of rows) {
      const branch = plain(cells[0]!) as Branch;
      const segs = cells.slice(1)
        .map((c) => plain(c))
        .filter((c) => c !== "" && c !== "—")
        .map((c) => {
          const m = /^(.)\s*(\d+)日$/.exec(c);
          if (!m) throw new Error(`无法解析司令段: ${branch} 「${c}」`);
          return { stem: m[1] as Stem, days: Number(m[2]) };
        });
      expect(SILING[branch], `${branch} 司令`).toEqual(segs);
    }
  });
});

describe("四墓库", () => {
  it("辰戌丑未四支，各藏一行", () => {
    expect(new Set(FOUR_TOMBS)).toEqual(new Set<Branch>(["辰", "戌", "丑", "未"]));
    expect(new Set(Object.values(TOMB_OF))).toEqual(new Set(FOUR_TOMBS));
  });

  it("TOMB_OF 与 TOMB_STORES 互为反函数", () => {
    for (const [el, br] of Object.entries(TOMB_OF)) {
      expect(TOMB_STORES[br as Branch]).toBe(el);
    }
    for (const b of BRANCHES) {
      const stored = TOMB_STORES[b];
      if (stored === undefined) expect(FOUR_TOMBS).not.toContain(b);
      else expect(TOMB_OF[stored]).toBe(b);
    }
  });

  it("土不入库 —— 四墓本身皆土，无库可入", () => {
    expect(Object.keys(TOMB_OF)).not.toContain("土");
    for (const b of FOUR_TOMBS) expect(BRANCH_ELEMENT[b]).toBe("土");
  });

  it("库中确藏其所储之五行", () => {
    for (const [el, br] of Object.entries(TOMB_OF)) {
      const has = HIDDEN_STEMS[br as Branch].some((h) => elementOf(h) === el);
      expect(has, `${br} 应藏 ${el}`).toBe(true);
    }
  });
});

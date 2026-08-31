import { describe, expect, it } from "vitest";
import { BRANCHES, CHANGSHENG_PHASES, STEMS, type Branch, type Stem } from "../src/types/ganzhi.js";
import {
  branchOfPhase, changshengSequence, luOf, phaseOf, rootKindOf, yangRenOf,
} from "../src/ganzhi/changsheng.js";
import { elementOf, polarityOf, stepBranch } from "../src/ganzhi/algebra.js";
import { plain, sectionOf, tableRows } from "./_doc.js";

/**
 * 独立转录的十二长生矩阵（阳顺阴逆 + 火土同宫）。
 * 这是与 changsheng.ts 的推导实现相互独立的第二份表述 ——
 * 二者吻合，才算这张表是对的。列序即 长生→养。
 */
const MATRIX: Readonly<Record<Stem, readonly Branch[]>> = {
  甲: ["亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌"],
  乙: ["午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌", "酉", "申", "未"],
  丙: ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"],
  丁: ["酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌"],
  戊: ["寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑"],
  己: ["酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌"],
  庚: ["巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰"],
  辛: ["子", "亥", "戌", "酉", "申", "未", "午", "巳", "辰", "卯", "寅", "丑"],
  壬: ["申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰", "巳", "午", "未"],
  癸: ["卯", "寅", "丑", "子", "亥", "戌", "酉", "申", "未", "午", "巳", "辰"],
};

describe("十二长生：推导 vs 独立转录", () => {
  it("逐干逐位吻合", () => {
    for (const s of STEMS) {
      expect(changshengSequence(s), `${s} 序列`).toEqual(MATRIX[s]);
    }
  });

  it("与 docs/01-foundations.md §8 的表逐格一致", () => {
    const rows = tableRows(sectionOf("十二长生")).slice(1);
    const stemRows = rows.filter((c) => (STEMS as readonly string[]).includes(plain(c[0]!)));
    expect(stemRows.length).toBe(10);
    for (const cells of stemRows) {
      const stem = plain(cells[0]!) as Stem;
      const seq = cells.slice(1, 13).map((c) => plain(c)) as Branch[];
      expect(seq, `${stem} 文档行长度`).toHaveLength(12);
      expect(changshengSequence(stem), `${stem}`).toEqual(seq);
    }
  });
});

describe("十二长生的自洽性", () => {
  it("每干的十二位恰为十二支的一个排列", () => {
    for (const s of STEMS) {
      const seq = changshengSequence(s);
      expect(seq).toHaveLength(12);
      expect(new Set(seq).size, `${s} 有重复支`).toBe(12);
      expect(new Set(seq)).toEqual(new Set(BRANCHES));
    }
  });

  it("序列在地支环上逐位连续（阳顺阴逆）", () => {
    for (const s of STEMS) {
      const seq = changshengSequence(s);
      const step = polarityOf(s) === "阳" ? 1 : -1;
      for (let i = 1; i < 12; i++) {
        expect(seq[i], `${s} 第 ${i} 位`).toBe(stepBranch(seq[i - 1]!, step));
      }
    }
  });

  it("阴干长生 = 同五行阳干的「死」位", () => {
    const pairs: [Stem, Stem][] = [["甲", "乙"], ["丙", "丁"], ["戊", "己"], ["庚", "辛"], ["壬", "癸"]];
    for (const [yang, yin] of pairs) {
      expect(branchOfPhase(yin, "长生"), `${yin} 长生应为 ${yang} 死位`)
        .toBe(branchOfPhase(yang, "死"));
    }
  });

  it("phaseOf 与 branchOfPhase 互逆", () => {
    for (const s of STEMS) for (const p of CHANGSHENG_PHASES) {
      expect(phaseOf(s, branchOfPhase(s, p)), `${s} ${p}`).toBe(p);
    }
  });

  it("长生与病、临官与绝、帝旺与胎 皆隔六位相冲", () => {
    for (const s of STEMS) {
      expect(branchOfPhase(s, "病")).toBe(stepBranch(branchOfPhase(s, "长生"), 6));
      expect(branchOfPhase(s, "绝")).toBe(stepBranch(branchOfPhase(s, "临官"), 6));
      expect(branchOfPhase(s, "胎")).toBe(stepBranch(branchOfPhase(s, "帝旺"), 6));
    }
  });
});

describe("禄与羊刃（推导，非查表）", () => {
  it("禄 = 临官位，与 §9 字面表一致", () => {
    const expected: Record<string, Branch> = {
      甲: "寅", 乙: "卯", 丙: "巳", 丁: "午", 戊: "巳",
      己: "午", 庚: "申", 辛: "酉", 壬: "亥", 癸: "子",
    };
    for (const [s, b] of Object.entries(expected)) expect(luOf(s as Stem)).toBe(b);
  });

  it("禄支的本气五行即该干五行", () => {
    for (const s of STEMS) {
      const lu = luOf(s);
      const el = elementOf(s);
      // 戊己寄禄于巳午（火土同宫），故土干的禄支本气为火
      if (el === "土") expect(["巳", "午"]).toContain(lu);
      else expect(elementOf(({ 寅: "甲", 卯: "乙", 巳: "丙", 午: "丁", 申: "庚", 酉: "辛", 亥: "壬", 子: "癸" } as Record<string, Stem>)[lu]!)).toBe(el);
    }
  });

  it("羊刃 = 阳干帝旺位；阴干默认不取", () => {
    const expected: Record<string, Branch> = { 甲: "卯", 丙: "午", 戊: "午", 庚: "酉", 壬: "子" };
    for (const [s, b] of Object.entries(expected)) expect(yangRenOf(s as Stem)).toBe(b);
    for (const s of ["乙", "丁", "己", "辛", "癸"] as Stem[]) expect(yangRenOf(s)).toBeNull();
  });

  it("阳干的禄与刃相邻", () => {
    for (const s of ["甲", "丙", "戊", "庚", "壬"] as Stem[]) {
      expect(yangRenOf(s)).toBe(stepBranch(luOf(s), 1));
    }
  });
});

describe("流派切换", () => {
  it("阴阳同生同死：阴干随其阳干同起点、同顺行", () => {
    const o = { school: "sameBirthDeath" } as const;
    expect(branchOfPhase("乙", "长生", o)).toBe("亥"); // 同甲
    expect(branchOfPhase("丁", "长生", o)).toBe("寅"); // 同丙
    expect(branchOfPhase("辛", "长生", o)).toBe("巳"); // 同庚
    expect(branchOfPhase("癸", "长生", o)).toBe("申"); // 同壬
    for (const s of STEMS) expect(changshengSequence(s, o)).toEqual(changshengSequence(s, o));
  });

  it("同生同死下，同五行两干序列完全相同", () => {
    const o = { school: "sameBirthDeath" } as const;
    const pairs: [Stem, Stem][] = [["甲", "乙"], ["丙", "丁"], ["戊", "己"], ["庚", "辛"], ["壬", "癸"]];
    for (const [a, b] of pairs) expect(changshengSequence(a, o)).toEqual(changshengSequence(b, o));
  });

  it("水土同宫：戊己改随壬癸", () => {
    const o = { earth: "waterEarthSame" } as const;
    expect(branchOfPhase("戊", "长生", o)).toBe("申");
    expect(branchOfPhase("己", "长生", o)).toBe("卯");
    expect(luOf("戊", o)).toBe("亥");
    expect(luOf("己", o)).toBe("子");
  });

  it("默认流派仍是阳顺阴逆 + 火土同宫", () => {
    expect(branchOfPhase("乙", "长生")).toBe("午");
    expect(branchOfPhase("戊", "长生")).toBe("寅");
  });
});

describe("通根", () => {
  it("甲木：寅得禄根、亥得长生根、未得库根、辰为余气根、酉无根", () => {
    expect(rootKindOf("甲", "寅")).toBe("luRen");
    expect(rootKindOf("甲", "卯")).toBe("luRen");      // 帝旺
    expect(rootKindOf("甲", "亥")).toBe("changsheng");
    expect(rootKindOf("甲", "未")).toBe("ku");          // 未为木库，藏乙
    expect(rootKindOf("甲", "辰")).toBe("yuqi");        // 辰藏乙，但辰非甲之墓
    expect(rootKindOf("甲", "酉")).toBe("none");
  });

  it("支中无同五行藏干则必为 none", () => {
    for (const s of STEMS) for (const b of BRANCHES) {
      const has = ({ 子: "癸", 丑: "己癸辛", 寅: "甲丙戊", 卯: "乙", 辰: "戊乙癸", 巳: "丙庚戊",
        午: "丁己", 未: "己丁乙", 申: "庚壬戊", 酉: "辛", 戌: "戊辛丁", 亥: "壬甲" } as Record<Branch, string>)[b]
        .split("").some((h) => elementOf(h as Stem) === elementOf(s));
      if (!has) expect(rootKindOf(s, b), `${s} 在 ${b}`).toBe("none");
      else expect(rootKindOf(s, b), `${s} 在 ${b}`).not.toBe("none");
    }
  });

  it("库根只在该干自身的墓位成立", () => {
    for (const s of STEMS) {
      const mu = branchOfPhase(s, "墓");
      for (const b of BRANCHES) {
        if (rootKindOf(s, b) === "ku") expect(b, `${s} 的库根`).toBe(mu);
      }
    }
  });
});

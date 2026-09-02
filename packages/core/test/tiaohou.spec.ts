import { describe, expect, it } from "vitest";
import {
  TIAOHOU, TIAOHOU_CELLS, TIAOHOU_PRINCIPLE, TIAOHOU_VARIANTS,
  tiaohouElements, tiaohouOf,
} from "../src/conclude/tiaohou.js";
import { STEMS, BRANCHES, type Branch, type Stem } from "../src/types/ganzhi.js";
import { elementOf } from "../src/ganzhi/algebra.js";

const WINTER: readonly Branch[] = ["亥", "子", "丑"];
const SUMMER: readonly Branch[] = ["巳", "午", "未"];
const has = (s: Stem, b: Branch, ...want: Stem[]) =>
  want.some((w) => TIAOHOU[s][b].stems.includes(w));

describe("表的形状", () => {
  it("整整 120 格，无缺无重", () => {
    expect(TIAOHOU_CELLS).toHaveLength(120);
    for (const s of STEMS) {
      for (const b of BRANCHES) {
        const cell = tiaohouOf(s, b);
        expect(cell.stems.length, `${s}${b} 空格`).toBeGreaterThan(0);
        expect(new Set(cell.stems).size, `${s}${b} 用神重复`).toBe(cell.stems.length);
        for (const x of cell.stems) expect(STEMS).toContain(x);
      }
    }
  });

  it("每个日干都有原理表述，异文格都指向真实的格", () => {
    for (const s of STEMS) expect(TIAOHOU_PRINCIPLE[s].length).toBeGreaterThan(20);
    for (const v of TIAOHOU_VARIANTS) {
      expect(tiaohouOf(v.stem, v.branch).tier,
        `${v.stem}${v.branch} 列了异文却标成 firm`).toBe("varies");
      expect(v.alt).not.toEqual(tiaohouOf(v.stem, v.branch).stems);
      expect(v.note.length).toBeGreaterThan(10);
    }
  });

  it("标 varies 的格是少数 —— 若过半，说明这份转录不该拿来用", () => {
    const varies = TIAOHOU_CELLS.filter((c) => c.cell.tier === "varies").length;
    expect(varies).toBeLessThan(60);
    expect(varies, "一格 varies 都没有，反倒说明没有认真区分").toBeGreaterThan(5);
  });
});

// ═══════════════════════════════════════════════════════════
// 用「我有把握的原理」反查「我没把握的逐格次序」。
// 每条规则都附一份**穷尽的例外名单**：转录出错时，要么冒出名单外的新例外，
// 要么名单上的某一格不再违规 —— 两种都会让测试失败。
// ═══════════════════════════════════════════════════════════

const violatorsOf = (pred: (s: Stem, b: Branch) => boolean) =>
  TIAOHOU_CELLS.filter(({ stem, branch }) => !pred(stem, branch))
    .map(({ stem, branch }) => `${stem}${branch}`).sort();

describe("**寒者暖之**", () => {
  it("非火日主生于亥子丑，用神必含丙或丁 —— 无一例外", () => {
    expect(violatorsOf((s, b) =>
      !WINTER.includes(b) || elementOf(s) === "火" || has(s, b, "丙", "丁"))).toEqual([]);
  });

  it("火日主的冬月另有其法：丙取壬辉映，丁取甲引 —— 不靠外来的火", () => {
    for (const b of WINTER) {
      expect(has("丙", b, "壬"), `丙${b} 失了壬水辉映`).toBe(true);
      expect(has("丁", b, "甲"), `丁${b} 失了甲木引丁`).toBe(true);
    }
  });
});

describe("**燥者润之**", () => {
  it("生于巳午未，用神必含壬或癸 —— 例外恰好是这四格", () => {
    expect(violatorsOf((s, b) => !SUMMER.includes(b) || has(s, b, "壬", "癸")))
      .toEqual(["壬未", "庚未", "癸巳", "丁巳"].sort());
  });

  it("四个例外各有其理，不是抄漏", () => {
    // 丁巳：阴火乘旺未极，仍以甲引丁为先
    expect(tiaohouOf("丁", "巳").stems).toEqual(["甲", "庚"]);
    // 庚未：三伏生寒，金已进气，复取丁甲锻炼
    expect(tiaohouOf("庚", "未").stems).toEqual(["丁", "甲"]);
    // 壬未、癸巳：日主自身即水，润非外求
    expect(elementOf("壬")).toBe("水");
    expect(elementOf("癸")).toBe("水");
  });
});

describe("**逐日干的定法**", () => {
  it("丙火四时不离壬 —— 十二格全中", () => {
    expect(violatorsOf((s, b) => s !== "丙" || has(s, b, "壬"))).toEqual([]);
  });

  it("辛金四时不离壬 —— 十二格全中", () => {
    expect(violatorsOf((s, b) => s !== "辛" || has(s, b, "壬"))).toEqual([]);
  });

  it("庚金非丁不锻，唯夏火太炎改用壬制 —— 每格必含丁或壬", () => {
    expect(violatorsOf((s, b) => s !== "庚" || has(s, b, "丁", "壬"))).toEqual([]);
  });

  it("丁火非甲不引，独午月火炎改取壬制", () => {
    expect(violatorsOf((s, b) => s !== "丁" || has(s, b, "甲"))).toEqual(["丁午"]);
    expect(tiaohouOf("丁", "午").stems[0]).toBe("壬");
  });

  it("乙木四时喜丙癸 —— 每格必含其一", () => {
    expect(violatorsOf((s, b) => s !== "乙" || has(s, b, "丙", "癸"))).toEqual([]);
  });

  it("戊己土非丙不暖 —— 二十四格全中；唯午月丙退居其次，先取壬润", () => {
    expect(violatorsOf((s, b) => !"戊己".includes(s) || has(s, b, "丙"))).toEqual([]);
    expect(tiaohouOf("戊", "午").stems).toEqual(["壬", "甲", "丙"]);
    expect(tiaohouOf("己", "午").stems[0]).toBe("癸");
  });

  it("壬水春夏取庚辛为源，秋冬取戊丙制暖", () => {
    for (const b of ["寅", "卯", "辰", "巳", "午", "未"] as Branch[]) {
      expect(has("壬", b, "庚", "辛"), `壬${b} 缺了金源`).toBe(true);
    }
    for (const b of ["申", "酉", "戌", "亥", "子", "丑"] as Branch[]) {
      expect(has("壬", b, "戊", "丙", "丁", "甲"), `壬${b} 既不制也不暖`).toBe(true);
    }
  });

  it("癸水至弱，喜庚辛为源；冬则先丙解冻", () => {
    expect(violatorsOf((s, b) =>
      s !== "癸" || WINTER.includes(b) || has(s, b, "庚", "辛", "丁"))).toEqual([]);
    expect(tiaohouOf("癸", "子").stems[0]).toBe("丙");
  });
});

describe("五行是派生量，天干才是原貌", () => {
  it("**丙丁、壬癸的分别在转成五行时丢掉了** —— 这一层损失必须是显式的", () => {
    // 甲子取丁（灯烛），甲午取癸（雨露）；转成五行后只剩火与水
    expect(tiaohouOf("甲", "子").stems[0]).toBe("丁");
    expect(tiaohouElements(tiaohouOf("甲", "子"))[0]).toBe("火");
    // 丙取壬不取癸，己取癸不取壬 —— 五行相同，取用相反
    expect(tiaohouOf("丙", "午").stems).toContain("壬");
    expect(tiaohouOf("己", "午").stems).toContain("癸");
    expect(tiaohouElements(tiaohouOf("丙", "午"))).toContain("水");
    expect(tiaohouElements(tiaohouOf("己", "午"))).toContain("水");
  });

  it("五行按原序去重，首位即 primary", () => {
    for (const { stem, branch, cell } of TIAOHOU_CELLS) {
      const es = tiaohouElements(cell);
      expect(es.length, `${stem}${branch}`).toBeGreaterThan(0);
      expect(es.length).toBeLessThanOrEqual(cell.stems.length);
      expect(new Set(es).size).toBe(es.length);
      expect(es[0]).toBe(elementOf(cell.stems[0]!));
    }
  });
});

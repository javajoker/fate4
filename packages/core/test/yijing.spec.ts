import { describe, expect, it } from "vitest";
import {
  TRIGRAMS, TRIGRAM_BY_NAME, trigramByXiantian, trigramOf, type TrigramName,
} from "../src/yijing/trigrams.js";
import {
  HEXAGRAMS, PURE_HEXAGRAMS, PALACE_RANKS, SHI_POSITION, composeHexagram,
  hexagramOf, keyOf, nameOf, yingOf,
} from "../src/yijing/hexagrams.js";
import {
  NAJIA, liuqinOf, liuqinOfBranch, liushenOf, LIUSHEN_ORDER, LIUQIN_SCOPE,
} from "../src/yijing/najia.js";
import { STEMS, BRANCHES, ELEMENTS, type Element } from "../src/types/ganzhi.js";
import { branchElement, controlledBy, generatedBy } from "../src/ganzhi/algebra.js";
import { CONTROLS, GENERATES } from "../src/ganzhi/tables.js";

describe("八卦", () => {
  it("**先天数就是二进制，不是要背的表** —— 抄错就对不上", () => {
    for (const t of TRIGRAMS) {
      // 自下而上读，初爻为最高位，阳记 0 阴记 1
      const bits = t.lines.map((y) => (y === 1 ? 0 : 1));
      const n = bits[0]! * 4 + bits[1]! * 2 + bits[2]! + 1;
      expect(n, `${t.name} 的先天数`).toBe(t.xiantian);
    }
    expect(TRIGRAMS.map((t) => t.xiantian)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("八卦不重不漏，三爻组合恰好覆盖 2³", () => {
    expect(new Set(TRIGRAMS.map((t) => t.lines.join(""))).size).toBe(8);
    expect(new Set(TRIGRAMS.map((t) => t.name)).size).toBe(8);
    for (const t of TRIGRAMS) expect(trigramOf(t.lines)).toBe(t);
  });

  it("按先天数取卦，8 与 0 都落到坤", () => {
    for (let n = 1; n <= 8; n++) expect(trigramByXiantian(n).xiantian).toBe(n);
    expect(trigramByXiantian(8).name).toBe("坤");
    expect(trigramByXiantian(0).name).toBe("坤");   // 起卦法里余 0 取 8
    expect(trigramByXiantian(16).name).toBe("坤");
  });
});

describe("六十四卦与八宫", () => {
  it("**生成出的恰好是全部 64 卦** —— 生成规则若错，必现重复或缺漏", () => {
    expect(HEXAGRAMS).toHaveLength(64);
    expect(new Set(HEXAGRAMS.map((h) => keyOf(h.lines))).size).toBe(64);
    expect(new Set(HEXAGRAMS.map((h) => h.name)).size).toBe(64);
    // 与「六爻各取阴阳」的全集比对
    const all = new Set<string>();
    for (let i = 0; i < 64; i++) all.add(i.toString(2).padStart(6, "0"));
    expect(new Set(HEXAGRAMS.map((h) => keyOf(h.lines)))).toEqual(all);
  });

  it("每宫八卦，次序恒为本宫→一世→…→五世→游魂→归魂", () => {
    for (const p of ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"] as TrigramName[]) {
      const g = HEXAGRAMS.filter((h) => h.palace === p);
      expect(g, `${p}宫`).toHaveLength(8);
      expect(g.map((h) => h.rank)).toEqual(PALACE_RANKS);
    }
  });

  it("**乾宫逐卦对上传统卦序** —— 生成规则的验算", () => {
    const qian = HEXAGRAMS.filter((h) => h.palace === "乾");
    expect(qian.map((h) => h.name)).toEqual([
      "乾为天", "天风姤", "天山遁", "天地否", "风地观", "山地剥", "火地晋", "火天大有",
    ]);
    expect(qian.map((h) => keyOf(h.lines))).toEqual([
      "111111", "011111", "001111", "000111", "000011", "000001", "000101", "111101",
    ]);
  });

  it("坎宫与坤宫也对上 —— 一宫对上可能是巧合，三宫不会", () => {
    expect(HEXAGRAMS.filter((h) => h.palace === "坎").map((h) => h.name)).toEqual([
      "坎为水", "水泽节", "水雷屯", "水火既济", "泽火革", "雷火丰", "地火明夷", "地水师",
    ]);
    expect(HEXAGRAMS.filter((h) => h.palace === "坤").map((h) => h.name)).toEqual([
      "坤为地", "地雷复", "地泽临", "地天泰", "雷天大壮", "泽天夬", "水天需", "水地比",
    ]);
  });

  it("八纯卦恰为八宫的本宫卦，且宫五行随本卦", () => {
    expect(PURE_HEXAGRAMS.map((h) => h.name)).toEqual(
      TRIGRAMS.map((t) => `${t.name}为${t.image}`));
    for (const h of PURE_HEXAGRAMS) {
      expect(h.rank).toBe("本宫");
      expect(h.palace).toBe(h.upper);
      expect(h.palaceElement).toBe(TRIGRAM_BY_NAME.get(h.palace)!.element);
    }
  });

  it("世应恒隔三位，且世爻位只由宫内次序定", () => {
    for (const h of HEXAGRAMS) {
      expect(h.shi).toBe(SHI_POSITION[h.rank]);
      expect(h.ying).toBe(yingOf(h.shi));
      const gap = Math.abs(h.shi - h.ying);
      expect(gap, `${h.name} 世${h.shi} 应${h.ying}`).toBe(3);
    }
  });

  it("组卦与查卦互逆", () => {
    for (const h of HEXAGRAMS) {
      expect(hexagramOf(composeHexagram(h.lower, h.upper))).toBe(h);
      expect(nameOf(h.lines)).toBe(h.name);
    }
  });
});

describe("纳甲", () => {
  it("八卦各纳内外两组，共 48 个干支位，逐卦干支合法", () => {
    for (const [name, { inner, outer }] of Object.entries(NAJIA)) {
      for (const half of [inner, outer]) {
        expect(STEMS, `${name} 的天干`).toContain(half.stem);
        expect(half.branches).toHaveLength(3);
        for (const b of half.branches) expect(BRANCHES).toContain(b);
      }
    }
  });

  it("**阳卦地支顺行，阴卦逆行** —— 坤巽离兑的逆行不是笔误", () => {
    const step = (bs: readonly string[]) => {
      const idx = bs.map((b) => BRANCHES.indexOf(b as never));
      return ((idx[1]! - idx[0]!) + 12) % 12;
    };
    // 阳卦：乾震坎艮，地支每爻进两位
    for (const n of ["乾", "震", "坎", "艮"] as TrigramName[]) {
      expect(step(NAJIA[n].inner.branches), `${n} 内卦`).toBe(2);
      expect(step(NAJIA[n].outer.branches), `${n} 外卦`).toBe(2);
    }
    // 阴卦：坤巽离兑，每爻退两位
    for (const n of ["坤", "巽", "离", "兑"] as TrigramName[]) {
      expect(step(NAJIA[n].inner.branches), `${n} 内卦`).toBe(10);
      expect(step(NAJIA[n].outer.branches), `${n} 外卦`).toBe(10);
    }
  });

  it("同一卦的内外六支互不重复，合起来占地支的一半", () => {
    for (const [name, { inner, outer }] of Object.entries(NAJIA)) {
      const six = [...inner.branches, ...outer.branches];
      expect(new Set(six).size, `${name} 的六支有重复`).toBe(6);
      // 六支同为阳支或同为阴支 —— 阳卦纳阳支，阴卦纳阴支
      const parities = new Set(six.map((b) => BRANCHES.indexOf(b as never) % 2));
      expect(parities.size, `${name} 的六支阴阳混杂`).toBe(1);
    }
  });

  it("乾坤两卦的纳甲逐位对上《京氏易传》", () => {
    expect(NAJIA.乾.inner).toEqual({ stem: "甲", branches: ["子", "寅", "辰"] });
    expect(NAJIA.乾.outer).toEqual({ stem: "壬", branches: ["午", "申", "戌"] });
    expect(NAJIA.坤.inner).toEqual({ stem: "乙", branches: ["未", "巳", "卯"] });
    expect(NAJIA.坤.outer).toEqual({ stem: "癸", branches: ["丑", "亥", "酉"] });
  });
});

describe("**六亲 —— 生克方向的反向对照**", () => {
  it("五类不重不漏，且逐类的方向逐字验明", () => {
    for (const me of ELEMENTS) {
      const got = new Map<string, Element[]>();
      for (const e of ELEMENTS) {
        const q = liuqinOf(me, e);
        got.set(q, [...(got.get(q) ?? []), e]);
      }
      // 五类各占一行，不重不漏
      expect(new Set(got.keys()), `${me} 为我时的六亲分组`)
        .toEqual(new Set(["兄弟", "官鬼", "妻财", "子孙", "父母"]));
      for (const [, es] of got) expect(es).toHaveLength(1);

      // ⚠️ 分组不重不漏挡不住「整体置换」—— 四柱那边正是这样漏掉过忌神方向。
      // 故逐类断言方向本身：
      expect(got.get("兄弟")![0], `${me} 的兄弟应是同我`).toBe(me);
      expect(got.get("子孙")![0], `${me} 的子孙应是我生`).toBe(GENERATES[me]);
      expect(got.get("妻财")![0], `${me} 的妻财应是我克`).toBe(CONTROLS[me]);
      expect(got.get("官鬼")![0], `${me} 的官鬼应是克我`).toBe(controlledBy(me));
      expect(got.get("父母")![0], `${me} 的父母应是生我`).toBe(generatedBy(me));
    }
  });

  it("**妻财与官鬼不可对调** —— 我克为财，克我为鬼", () => {
    // 木为我：木克土 → 土是妻财；金克木 → 金是官鬼
    expect(liuqinOf("木", "土")).toBe("妻财");
    expect(liuqinOf("木", "金")).toBe("官鬼");
    // 写成 CONTROLS[我] 取官鬼会得到「土」，此断言即为拦它
    expect(liuqinOf("木", "土")).not.toBe("官鬼");
  });

  it("由爻支取六亲，与由五行取的一致", () => {
    for (const me of ELEMENTS) {
      for (const b of BRANCHES) {
        expect(liuqinOfBranch(me, b)).toBe(liuqinOf(me, branchElement(b)));
      }
    }
  });

  it("每一类都有指代说明", () => {
    for (const q of ["父母", "兄弟", "子孙", "妻财", "官鬼"] as const) {
      expect(LIUQIN_SCOPE[q].length).toBeGreaterThan(8);
    }
  });
});

describe("六神", () => {
  it("六位齐全不重复，次序恒为青朱勾腾白玄", () => {
    for (const s of STEMS) {
      const six = liushenOf(s);
      expect(six).toHaveLength(6);
      expect(new Set(six).size).toBe(6);
      for (let i = 1; i < 6; i++) {
        const prev = LIUSHEN_ORDER.indexOf(six[i - 1]!);
        expect(LIUSHEN_ORDER.indexOf(six[i]!)).toBe((prev + 1) % 6);
      }
    }
  });

  it("起神逐干对上：甲乙青龙、丙丁朱雀、戊勾陈、己腾蛇、庚辛白虎、壬癸玄武", () => {
    const want: Record<string, string> = {
      甲: "青龙", 乙: "青龙", 丙: "朱雀", 丁: "朱雀", 戊: "勾陈",
      己: "腾蛇", 庚: "白虎", 辛: "白虎", 壬: "玄武", 癸: "玄武",
    };
    for (const s of STEMS) expect(liushenOf(s)[0], `${s}日`).toBe(want[s]);
  });

  it("**十干只对应六种起法，戊己各自单起** —— 不是简单的两两配对", () => {
    const starts = STEMS.map((s) => liushenOf(s)[0]!);
    expect(new Set(starts).size).toBe(6);
    expect(liushenOf("戊")[0]).not.toBe(liushenOf("己")[0]);
  });
});

describe("**黄金卦 —— 四张表合起来才见真章**", () => {
  /** 把一卦装齐：纳甲 + 六亲 + 世应。这是 P18 dress() 的最小形态。 */
  function dress(name: string) {
    const h = HEXAGRAMS.find((x) => x.name === name);
    if (h === undefined) throw new Error(`查无此卦 ${name}`);
    const lower = NAJIA[h.lower]; const upper = NAJIA[h.upper];
    return Array.from({ length: 6 }, (_, i) => {
      const half = i < 3 ? lower.inner : upper.outer;
      const branch = half.branches[i % 3]!;
      return {
        pos: i + 1,
        ganzhi: `${half.stem}${branch}`,
        liuqin: liuqinOfBranch(h.palaceElement, branch),
        mark: i + 1 === h.shi ? "世" : i + 1 === h.ying ? "应" : "",
      };
    });
  }

  it("泽水困（兑宫一世）逐爻对上传统装卦", () => {
    const h = HEXAGRAMS.find((x) => x.name === "泽水困")!;
    expect(h.palace).toBe("兑");
    expect(h.rank).toBe("一世");
    expect([h.shi, h.ying]).toEqual([1, 4]);
    expect(dress("泽水困").map((y) => `${y.liuqin}${y.ganzhi}${y.mark}`)).toEqual([
      "妻财戊寅世", "父母戊辰", "官鬼戊午", "子孙丁亥应", "兄弟丁酉", "父母丁未",
    ]);
  });

  it("乾为天（乾宫本宫）逐爻对上 —— 六爻全阳，六亲却齐全", () => {
    // 「爻全是阳，六亲想必也单调」是个很自然的直觉，而它是错的：
    // 六亲由**爻支五行**与卦宫五行的生克定，与爻的阴阳无关。
    expect(dress("乾为天").map((y) => `${y.liuqin}${y.ganzhi}${y.mark}`)).toEqual([
      "子孙甲子", "妻财甲寅", "父母甲辰应", "官鬼壬午", "兄弟壬申", "父母壬戌世",
    ]);
    expect(new Set(dress("乾为天").map((y) => y.liuqin)).size).toBe(5);
  });

  it("**六亲多现与不上卦都真实存在** —— 断卦必须处理这两种局面", () => {
    // 多现：乾为天的父母两见（辰、戌）
    expect(dress("乾为天").filter((y) => y.liuqin === "父母")).toHaveLength(2);

    // 不上卦：六爻只有六个位置而六亲有五类，缺类是常态而非边角情形。
    // 伏神机制正是为此而设 —— 若六亲恒齐全，它便无用武之地。
    const incomplete = HEXAGRAMS.filter(
      (h) => new Set(dress(h.name).map((y) => y.liuqin)).size < 5);
    expect(incomplete.length, "六亲恒齐全的话，伏神机制无用武之地")
      .toBeGreaterThan(10);
    // 且缺的那一类确实查得出来
    const sample = incomplete[0]!;
    const present = new Set(dress(sample.name).map((y) => y.liuqin));
    const missing = (["父母", "兄弟", "子孙", "妻财", "官鬼"] as const)
      .filter((q) => !present.has(q));
    expect(missing.length).toBeGreaterThan(0);
  });

  it("世爻与应爻恒各出现一次，且不重合", () => {
    for (const h of HEXAGRAMS) {
      const marks = dress(h.name).map((y) => y.mark).filter((m) => m !== "");
      expect(marks.sort(), h.name).toEqual(["世", "应"]);
    }
  });
});

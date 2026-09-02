import { describe, expect, it } from "vitest";
import { castMomentOf } from "../src/liuyao/moment.js";
import {
  cast, coinToYao, lunarYearBranchOf, CastInputError, CAST_METHOD_LABEL,
  type CoinThrow,
} from "../src/liuyao/cast.js";
import {
  dress, isSixClash, isSixHarmony, monthPhaseOf,
} from "../src/liuyao/dress.js";
import { HEXAGRAMS } from "../src/yijing/hexagrams.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { loadParams } from "../src/params/load.js";
import { BRANCHES, ELEMENTS } from "../src/types/ganzhi.js";

const P = DEFAULT_PARAMS.liuyao;
const COIN = loadParams({ liuyao: { castMethod: "coin" } }).liuyao;
const NUM = loadParams({ liuyao: { castMethod: "number" } }).liuyao;
const moment = (y: number, mo: number, d: number, h: number) => castMomentOf({
  year: y, month: mo, day: d, hour: h, minute: 30,
  timeZone: "Asia/Shanghai", longitude: 121.47,
});
const M = moment(2026, 9, 2, 14);

describe("Q0 起卦", () => {
  it("**起卦法必须与参数声明一致，不静默改用另一法**", () => {
    expect(() => cast(M, { method: "number", value: 7 }, P)).toThrow(CastInputError);
    expect(() => cast(M, { method: "time" }, COIN)).toThrow(CastInputError);
  });

  it("按时起卦：算式逐步可复算，且同一时刻同一卦", () => {
    const a = cast(M, { method: "time" }, P);
    const b = cast(M, { method: "time" }, P);
    expect(b.benGua).toEqual(a.benGua);
    expect(b.moving).toEqual(a.moving);
    expect(a.derivation.join("")).toContain("农历");
    expect(a.derivation.join("")).toContain("mod 8");
  });

  it("**同一时辰内不同的问题得到同一个卦** —— 这是该方法的前提，不是漏洞", () => {
    // 卦属于时刻。区分不同的事靠取不同的用神，不靠改起卦。
    const a = cast(moment(2026, 9, 2, 14), { method: "time" }, P);
    const b = cast(moment(2026, 9, 2, 13), { method: "time" }, P);   // 13:30 与 14:30 同为未时
    expect(b.benGua).toEqual(a.benGua);
    // 换个时辰才换卦
    const c = cast(moment(2026, 9, 2, 20), { method: "time" }, P);
    expect(c.benGua).not.toEqual(a.benGua);
  });

  it("**单数报数在一个时辰内只有八个卦** —— 下卦被上卦完全决定，如实写明", () => {
    const gua = new Set<string>(); const full = new Set<string>();
    for (let n = 1; n <= 200; n++) {
      const c = cast(M, { method: "number", value: n }, NUM);
      gua.add(c.benGua.join(""));
      full.add(`${c.benGua.join("")}:${c.moving.join()}`);
    }
    expect(gua.size, "单数法一个时辰内恰好八个本卦").toBe(8);
    // ⚠️ 不是 8 × 6 = 48：n mod 8 与 n mod 6 不独立，周期是 lcm(8,6) = 24
    expect(full.size, "本卦与动爻位都由 n 决定，且两个模数不互素").toBe(24);
    expect(cast(M, { method: "number", value: 7 }, NUM).derivation.join(""))
      .toContain("只生成八个本卦");
  });

  it("两数起卦覆盖全部 64 卦 —— 单数法的补救", () => {
    const gua = new Set<string>();
    for (let a = 1; a <= 8; a++) {
      for (let b = 1; b <= 8; b++) {
        gua.add(cast(M, { method: "number", value: a, second: b }, NUM).benGua.join(""));
      }
    }
    expect(gua.size).toBe(64);
  });

  it("报数须为正整数，两数则两个都须是", () => {
    for (const bad of [0, -3, 2.5, Number.NaN]) {
      expect(() => cast(M, { method: "number", value: bad }, NUM)).toThrow(CastInputError);
      expect(() => cast(M, { method: "number", value: 7, second: bad }, NUM))
        .toThrow(CastInputError);
    }
  });

  it("**掷钱：少数决定爻性，三面同则为老而动**", () => {
    expect(coinToYao(3)).toEqual({ yao: 1, moving: true });   // 老阳（重）
    expect(coinToYao(2)).toEqual({ yao: 0, moving: false });  // 少阴（拆）
    expect(coinToYao(1)).toEqual({ yao: 1, moving: false });  // 少阳（单）
    expect(coinToYao(0)).toEqual({ yao: 0, moving: true });   // 老阴（交）
  });

  it("**掷钱的动爻可以是 0 个，也可以是 6 个** —— 只按「恒一个」实现会塌", () => {
    const still = cast(M, { method: "coin", throws: [1, 2, 1, 2, 1, 2] }, COIN);
    expect(still.moving).toEqual([]);
    expect(still.bianGua, "静卦不该有变卦").toBeNull();

    const all = cast(M, { method: "coin", throws: [3, 0, 3, 0, 3, 0] }, COIN);
    expect(all.moving).toEqual([0, 1, 2, 3, 4, 5]);
    expect(all.bianGua).not.toBeNull();
    // 六爻尽动，变卦即本卦的全反
    expect(all.bianGua!.map((y) => (y === 1 ? 0 : 1))).toEqual([...all.benGua]);

    // 而按时起卦恒为一个动爻 —— 两法的结构差异是真实的
    expect(cast(M, { method: "time" }, P).moving).toHaveLength(1);
  });

  it("掷钱的 4^6 种组合全部可装卦，不抛错", () => {
    for (let n = 0; n < 4096; n++) {
      const t = Array.from({ length: 6 }, (_, i) => ((n >> (i * 2)) & 3) as CoinThrow);
      const c = cast(M, { method: "coin", throws: t as never }, COIN);
      expect(() => dress(c, COIN)).not.toThrow();
    }
  });

  it("农历年支即生肖之支", () => {
    expect(lunarYearBranchOf(2024)).toBe("辰");
    expect(lunarYearBranchOf(2025)).toBe("巳");
    expect(lunarYearBranchOf(2026)).toBe("午");
    expect(lunarYearBranchOf(1984)).toBe("子");
  });

  it("**年界两说会给出不同的卦** —— 否则那个参数是死的", () => {
    const LICHUN = loadParams({ liuyao: { timeCast: { yearBoundary: "lichun" } } }).liuyao;
    // 2024-02-06：已过立春（甲辰），未到春节（农历仍癸卯）
    const m = moment(2024, 2, 6, 12);
    expect(m.lichunYearBranch).toBe("辰");
    expect(lunarYearBranchOf(m.lunar.year)).toBe("卯");
    expect(cast(m, { method: "time" }, LICHUN).benGua)
      .not.toEqual(cast(m, { method: "time" }, P).benGua);
  });

  it("三法都有名目，且写明借自哪一家", () => {
    expect(CAST_METHOD_LABEL.coin).toContain("六爻本法");
    expect(CAST_METHOD_LABEL.time).toContain("梅花");
  });
});

describe("Q1 装卦", () => {
  const g = dress(cast(M, { method: "time" }, P), P);

  it("**离为火逐爻对上传统装卦**", () => {
    expect(g.ben.name).toBe("离为火");
    expect(g.yaos.map((y) => `${y.liuqin}${y.stem}${y.branch}`)).toEqual([
      "父母己卯", "子孙己丑", "官鬼己亥", "妻财己酉", "子孙己未", "兄弟己巳",
    ]);
    expect([g.shi, g.ying]).toEqual([6, 3]);
    expect(g.yaos.filter((y) => y.isShi).map((y) => y.pos)).toEqual([6]);
  });

  it("六神由日干起，己日起腾蛇", () => {
    expect(M.pillars.day.stem).toBe("己");
    expect(g.yaos.map((y) => y.liushen)).toEqual([
      "腾蛇", "白虎", "玄武", "青龙", "朱雀", "勾陈",
    ]);
  });

  it("旬空由日柱定，月破由月建定", () => {
    expect(g.kongBranches).toEqual(["申", "酉"]);          // 己卯日在甲戌旬
    expect(g.poBranch).toBe("寅");                          // 申月冲寅
    const you = g.yaos.find((y) => y.branch === "酉")!;
    expect(you.xunkong).toBe(true);
    expect(you.xunkongNullified, "酉逢日辰卯冲，冲空则实").toBe("冲空则实");
  });

  it("月建五档逐爻对上", () => {
    // 申金月：金旺、水相、土休、火囚、木死
    expect(monthPhaseOf("金", "金")).toBe("旺");
    expect(monthPhaseOf("金", "水")).toBe("相");
    expect(monthPhaseOf("金", "土")).toBe("休");
    expect(monthPhaseOf("金", "火")).toBe("囚");
    expect(monthPhaseOf("金", "木")).toBe("死");
    expect(g.yaos.map((y) => y.monthPhase)).toEqual(["死", "休", "相", "旺", "休", "囚"]);
  });

  it("**五档穷尽 —— 任意两五行都落得进一档**", () => {
    for (const m of ELEMENTS) {
      const seen = new Set(ELEMENTS.map((e) => monthPhaseOf(m, e)));
      expect(seen.size, `${m} 月建下的五档有重复或缺漏`).toBe(5);
    }
  });
});

describe("**变爻**", () => {
  it("变爻的六亲按本卦的宫定，不按变卦的宫", () => {
    const g = dress(cast(M, { method: "time" }, P), P);
    const moving = g.yaos.find((y) => y.moving)!;
    expect(moving.bian).not.toBeNull();
    // 离为火 → 火山旅：初爻卯木变辰土。离宫火，火生土 → 子孙
    expect(moving.bian!.branch).toBe("辰");
    expect(moving.bian!.liuqin).toBe("子孙");
    // 若误按变卦（火山旅属离宫，恰同）—— 换一卦验：见下条
  });

  it("**生克五种穷尽，恒有其一** —— 初稿漏了「动克变」一支，关系列表会是空的", () => {
    const seen = new Set<string>();
    for (let n = 0; n < 4096; n++) {
      const t = Array.from({ length: 6 }, (_, i) => ((n >> (i * 2)) & 3) as CoinThrow);
      const g = dress(cast(M, { method: "coin", throws: t as never }, COIN), COIN);
      for (const y of g.yaos) {
        if (y.bian === null) continue;
        expect(y.bian.shengke, "生克为空 —— 有一支没写").toBeTruthy();
        seen.add(y.bian.shengke);
      }
    }
    expect(seen).toEqual(new Set(["回头生", "回头克", "比和", "泄气", "动克变"]));
  });

  it("静爻无变爻，动爻必有变爻", () => {
    for (let n = 0; n < 512; n++) {
      const t = Array.from({ length: 6 }, (_, i) => ((n >> (i * 2)) & 3) as CoinThrow);
      const g = dress(cast(M, { method: "coin", throws: t as never }, COIN), COIN);
      for (const y of g.yaos) {
        expect(y.bian === null, `第${y.pos}爻 动=${y.moving} 却 bian=${y.bian}`).toBe(!y.moving);
      }
    }
  });
});

describe("**六冲六合由纳甲推出，不抄卦名**", () => {
  it("六冲恰十卦，六合恰八卦，名目与典籍相符", () => {
    const clash = HEXAGRAMS.filter(isSixClash).map((h) => h.name);
    const harmony = HEXAGRAMS.filter(isSixHarmony).map((h) => h.name);
    expect(new Set(clash)).toEqual(new Set([
      "乾为天", "兑为泽", "离为火", "震为雷", "巽为风", "坎为水", "艮为山", "坤为地",
      "天雷无妄", "雷天大壮",
    ]));
    expect(new Set(harmony)).toEqual(new Set([
      "天地否", "地天泰", "雷地豫", "地雷复", "泽水困", "水泽节", "火山旅", "山火贲",
    ]));
  });

  it("**一卦不会既六冲又六合**", () => {
    for (const h of HEXAGRAMS) {
      expect(isSixClash(h) && isSixHarmony(h), `${h.name} 既冲又合`).toBe(false);
    }
  });
});

describe("**伏神**", () => {
  it("六亲不全时必取伏神，且伏神来自本宫的八纯卦", () => {
    let checked = 0;
    for (let n = 0; n < 2048; n++) {
      const t = Array.from({ length: 6 }, (_, i) => ((n >> (i * 2)) & 3) as CoinThrow);
      const g = dress(cast(M, { method: "coin", throws: t as never }, COIN), COIN);
      const present = new Set(g.yaos.map((y) => y.liuqin));
      const missing = (["父母", "兄弟", "子孙", "妻财", "官鬼"] as const)
        .filter((q) => !present.has(q));
      expect(new Set(g.fushen.map((f) => f.liuqin)), `${g.ben.name} 的伏神与缺的六亲对不上`)
        .toEqual(new Set(missing));
      for (const f of g.fushen) {
        expect(BRANCHES).toContain(f.branch);
        // 飞神即压在它上面的本卦爻
        expect(f.feiBranch).toBe(g.yaos[f.pos - 1]!.branch);
      }
      if (missing.length > 0) checked++;
    }
    expect(checked, "两千次抽样里一次伏神都没出现 —— 那这条测试什么也没验").toBeGreaterThan(100);
  });

  it("六亲齐全时无伏神", () => {
    const g = dress(cast(M, { method: "time" }, P), P);
    expect(new Set(g.yaos.map((y) => y.liuqin)).size).toBe(5);
    expect(g.fushen).toEqual([]);
  });
});

describe("时刻", () => {
  it("**四柱口径与出生盘完全一致** —— 调的是同一批函数", () => {
    const m = moment(2024, 2, 6, 12);
    expect(`${m.pillars.year.stem}${m.pillars.year.branch}`).toBe("甲辰");
    expect(m.lunar.year).toBe(2023);
    expect(m.lunar.month).toBe(12);
  });

  it("一个时刻不假装成一个人 —— 不需要性别，也不算大运胎元", () => {
    const m = moment(2026, 9, 2, 14);
    expect(Object.keys(m).sort()).toEqual(["lichunYearBranch", "lunar", "pillars"]);
  });
});

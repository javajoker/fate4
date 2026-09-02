import { describe, expect, it } from "vitest";
import {
  buildQimen, enclosingTermName, futouOf, xunshouOf, palaceViewOf,
  PALACES, PALACE_NAME, RING, QIYI_ORDER, STAR_HOME, DOOR_HOME, GODS,
  JU_TABLE, YIN_TERMS, YUAN_OF_BRANCH, DOOR_IMAGE, CENTER_LODGE,
  qimenClaims, type Palace,
} from "../src/qimen/index.js";
import { castMomentOf } from "../src/liuyao/moment.js";
import { toJulianDay } from "../src/astro/julian.js";
import { BRANCHES, STEMS } from "../src/types/ganzhi.js";
import { isValidPair, mod, sexagenaryIndexOf } from "../src/ganzhi/algebra.js";
import { loadParams } from "../src/params/load.js";

function chartAt(y: number, mo: number, d: number, h: number) {
  const m = castMomentOf({
    year: y, month: mo, day: d, hour: h, minute: 30,
    timeZone: "Asia/Shanghai", longitude: 121.47,
  });
  return buildQimen({
    pillars: m.pillars,
    jdUT: toJulianDay({ year: y, month: mo, day: d, hour: h, minute: 30, second: 0 }) - 8 / 24,
  });
}

/** 一年 × 四时辰。只建一次 —— 六壬那边的教训。 */
const YEAR = (() => {
  const out: ReturnType<typeof chartAt>[] = [];
  for (let d = 0; d < 365; d++) {
    for (const h of [2, 8, 14, 20]) {
      const dt = new Date(Date.UTC(2026, 0, 1 + d));
      out.push(chartAt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), h));
    }
  }
  return out;
})();

describe("定局", () => {
  it("二十四气各有三元局数，阴阳遁各十二气", () => {
    expect(Object.keys(JU_TABLE)).toHaveLength(24);
    expect(YIN_TERMS.size).toBe(12);
    for (const [name, tri] of Object.entries(JU_TABLE)) {
      expect(tri, name).toHaveLength(3);
      for (const j of tri) { expect(j).toBeGreaterThanOrEqual(1); expect(j).toBeLessThanOrEqual(9); }
    }
  });

  it("**阴阳遁以夏至冬至为界** —— 夏至后阴遁，冬至后阳遁", () => {
    for (const c of YEAR) expect(c.yin).toBe(YIN_TERMS.has(c.term));
    // 2026 夏至约 6/21、冬至约 12/21
    expect(chartAt(2026, 6, 25, 10).yin).toBe(true);
    expect(chartAt(2026, 12, 25, 10).yin).toBe(false);
    expect(chartAt(2026, 3, 10, 10).yin).toBe(false);
  });

  it("**符头是最近的甲日或己日** —— 五日一元", () => {
    for (const c of YEAR) {
      const f = futouOf(c.pillars.day);
      expect(["甲", "己"], `符头 ${f.stem}${f.branch} 既非甲亦非己`).toContain(f.stem);
      const dn = sexagenaryIndexOf(c.pillars.day.stem, c.pillars.day.branch);
      const fn = sexagenaryIndexOf(f.stem, f.branch);
      expect(mod(dn - fn, 60), "符头距该日不足五天").toBeLessThan(5);
      expect(c.futou).toEqual({ stem: f.stem, branch: f.branch });
    }
  });

  it("三元由符头之支定：子午卯酉上元、寅申巳亥中元、辰戌丑未下元", () => {
    for (const c of YEAR) expect(c.yuan).toBe(YUAN_OF_BRANCH[c.futou.branch]);
    for (const b of BRANCHES) expect(["上元", "中元", "下元"]).toContain(YUAN_OF_BRANCH[b]);
  });

  it("局数取自三元表，且九局都出得来", () => {
    const seen = new Set<string>();
    for (const c of YEAR) {
      const tri = JU_TABLE[c.term]!;
      expect(c.ju).toBe(tri[{ 上元: 0, 中元: 1, 下元: 2 }[c.yuan]]);
      seen.add(`${c.yin ? "阴" : "阳"}${c.ju}`);
    }
    expect(seen.size, "十八种局不全").toBe(18);
  });
});

describe("地盘三奇六仪", () => {
  it("**次序是戊己庚辛壬癸丁丙乙 —— 三奇殿后且丁丙乙倒排**", () => {
    expect(QIYI_ORDER).toEqual(["戊", "己", "庚", "辛", "壬", "癸", "丁", "丙", "乙"]);
    expect(QIYI_ORDER.slice(6)).toEqual(["丁", "丙", "乙"]);
  });

  it("九宫各得一干，不重不漏", () => {
    for (const c of YEAR) {
      expect(new Set(PALACES.map((p) => c.earth[p])).size).toBe(9);
      expect([...PALACES.map((p) => c.earth[p])].sort()).toEqual([...QIYI_ORDER].sort());
    }
  });

  it("**阳遁一局逐宫对账** —— 抄错次序时地盘看上去仍是九干各一，只有逐宫核才看得出", () => {
    const c = YEAR.find((x) => !x.yin && x.ju === 1)!;
    expect(PALACES.map((p) => `${p}${c.earth[p]}`).join(" "))
      .toBe("1戊 2己 3庚 4辛 5壬 6癸 7丁 8丙 9乙");
  });

  it("阴遁一局逆飞，与阳遁一局镜像", () => {
    const c = YEAR.find((x) => x.yin && x.ju === 1)!;
    expect(PALACES.map((p) => `${p}${c.earth[p]}`).join(" "))
      .toBe("1戊 2乙 3丙 4丁 5癸 6壬 7辛 8庚 9己");
  });

  it("戊必在局数之宫 —— 起点对了其余才对", () => {
    for (const c of YEAR) expect(c.earth[c.ju as Palace]).toBe("戊");
  });
});

describe("值符与值使", () => {
  it("旬首所遁之仪在哪一宫，该宫的星门即值符值使", () => {
    for (const c of YEAR) {
      const yiPalace = PALACES.find((p) => c.earth[p] === c.xunshou.yi)!;
      expect(c.zhifu).toBe(STAR_HOME[yiPalace]);
      expect(c.zhishi).toBe(DOOR_HOME[yiPalace] ?? DOOR_HOME[CENTER_LODGE]);
    }
  });

  it("六甲旬首各遁其仪：子戊、戌己、申庚、午辛、辰壬、寅癸", () => {
    const want: Readonly<Record<string, string>> = {
      子: "戊", 戌: "己", 申: "庚", 午: "辛", 辰: "壬", 寅: "癸" };
    for (const c of YEAR) {
      expect(c.xunshou.yi, `甲${c.xunshou.branch}旬`).toBe(want[c.xunshou.branch]);
    }
  });

  it("旬首恒为甲，且时柱距旬首不足十位", () => {
    for (const b of BRANCHES) {
      for (const s of STEMS) {
        if (!isValidPair(s, b)) continue;   // 阴阳不配的组合不在六十甲子里
        const x = xunshouOf({ stem: s, branch: b });
        expect(x.offset).toBeLessThan(10);
        expect(["子", "戌", "申", "午", "辰", "寅"]).toContain(x.branch);
      }
    }
  });

  it("**值符加临时干所在的地盘宫** —— 转盘的枢纽", () => {
    let center = 0;
    for (const c of YEAR) {
      const hp = c.hourPalace === 5 ? CENTER_LODGE : c.hourPalace;
      expect(c.zhifuPalace).toBe(hp);
      if (c.zhifu === "天禽") {
        // 旬首之仪落中五时，值符为天禽。天禽不上圆序，寄坤二随天芮 ——
        // 故它落在何宫，看的是天芮落在何宫。
        expect(c.qinPalace, "值符为天禽时，它应随天芮落在值符宫").toBe(hp);
        center++;
      } else {
        expect(c.stars[hp], `${c.zhifu} 未加临 ${hp} 宫`).toBe(c.zhifu);
      }
    }
    expect(center, "一年之内旬首从未落中五 —— 那这条分支没验到").toBeGreaterThan(0);
  });

  it("甲时不上盘，以所遁之仪代之", () => {
    const jia = YEAR.filter((c) => c.pillars.hour.stem === "甲");
    expect(jia.length).toBeGreaterThan(0);
    for (const c of jia) {
      expect(c.earth[c.hourPalace]).toBe(c.xunshou.yi);
    }
  });
});

describe("天盘", () => {
  it("九星不重不漏；中五恒为天禽", () => {
    for (const c of YEAR) {
      expect(new Set(PALACES.map((p) => c.stars[p])).size).toBe(9);
      expect(c.stars[5]).toBe("天禽");
    }
  });

  it("**天禽寄坤二随天芮同行** —— 不是静静留在中五", () => {
    for (const c of YEAR) {
      const rui = PALACES.find((p) => c.stars[p] === "天芮")!;
      expect(c.qinPalace).toBe(rui);
    }
    // 天芮确实会转到不同的宫 —— 否则这条断言什么也没验
    expect(new Set(YEAR.map((c) => c.qinPalace)).size).toBeGreaterThan(4);
  });

  it("天盘干随星而转：某宫的天盘干即该星本宫的地盘干", () => {
    for (const c of YEAR) {
      for (const p of PALACES) {
        if (p === 5) continue;
        const home = (Object.entries(STAR_HOME)
          .find(([, s]) => s === c.stars[p])![0]) as unknown as string;
        expect(c.sky[p], `${PALACE_NAME[p]} 的天盘干`).toBe(c.earth[Number(home) as Palace]);
      }
    }
  });

  it("洛书圆序是 1 8 3 4 9 2 7 6 —— 自坎一顺时针绕外圈", () => {
    expect(RING).toEqual([1, 8, 3, 4, 9, 2, 7, 6]);
    expect(RING).toHaveLength(8);
    expect(RING).not.toContain(5);
  });
});

describe("八门与八神", () => {
  it("八门各一次，中五无门", () => {
    for (const c of YEAR) {
      expect(c.doors[5]).toBeNull();
      const ds = PALACES.filter((p) => p !== 5).map((p) => c.doors[p]);
      expect(new Set(ds).size, PALACE_NAME[5]).toBe(8);
      expect(ds).not.toContain(null);
    }
  });

  it("**值使门落在它该落的宫** —— 自旬首宫按本旬位次顺逆行", () => {
    for (const c of YEAR) {
      expect(c.doors[c.zhishiPalace]).toBe(c.zhishi);
    }
  });

  it("八神各一次，中五无神，值符与值符宫相合", () => {
    for (const c of YEAR) {
      expect(c.gods[5]).toBeNull();
      const gs = PALACES.filter((p) => p !== 5).map((p) => c.gods[p]);
      expect(new Set(gs).size).toBe(8);
      expect(c.gods[c.zhifuPalace]).toBe("值符");
    }
  });

  it("八神阳遁顺布、阴遁逆布", () => {
    for (const c of YEAR) {
      const i = RING.indexOf(c.zhifuPalace);
      const next = RING[mod(i + 1, 8)]!;
      expect(c.gods[next], `${c.yin ? "阴" : "阳"}遁`).toBe(c.yin ? GODS[7] : GODS[1]);
    }
  });

  it("八门各有事象，只作叙述素材", () => {
    for (const d of Object.keys(DOOR_IMAGE)) {
      expect(DOOR_IMAGE[d as keyof typeof DOOR_IMAGE].length).toBeGreaterThan(4);
    }
  });
});

describe("整体", () => {
  it("每一盘都写明了推导，且可复算", () => {
    const a = chartAt(2026, 9, 2, 14);
    const b = chartAt(2026, 9, 2, 14);
    expect(b).toEqual(a);
    expect(a.derivation.length).toBeGreaterThanOrEqual(5);
    expect(a.derivation.join("")).toContain("局");
  });

  it("宫位视图九宫齐全", () => {
    const c = chartAt(2026, 9, 2, 14);
    for (const p of PALACES) {
      const v = palaceViewOf(c, p);
      expect(v.palace).toBe(p);
      expect(v.earth).toBeDefined();
      expect(v.star).toBeDefined();
    }
  });

  it("节气取自二十四气，不只取节", () => {
    const names = new Set(YEAR.map((c) => c.term));
    expect(names.size).toBe(24);
    expect(enclosingTermName(toJulianDay({
      year: 2026, month: 9, day: 2, hour: 6, minute: 30, second: 0 })).name).toBe("处暑");
  });
});

describe("**跨体系断言**", () => {
  it("四条轴 —— 比六爻六壬多出「方位」，那一条只有奇门说得上话", () => {
    for (const c of YEAR.slice(0, 300)) {
      const cs = qimenClaims(c);
      expect(new Set(cs.map((x) => x.axis)))
        .toEqual(new Set(["我方位置", "阻碍来源", "事之动静", "方位"]));
      expect(cs.every((x) => x.system === "qimen")).toBe(true);
    }
  });

  it("**门的吉凶不入顺逆判定** —— 那是对结果的断言", () => {
    // 三凶门（死惊伤）不必然判逆，三吉门（开休生）也不必然判顺 ——
    // 顺逆只看门与日干的生克，与四柱、六爻用的是同一把尺。
    const byDoor = new Map<string, Set<string>>();
    for (const c of YEAR) {
      const cl = qimenClaims(c).find((x) => x.axis === "阻碍来源")!;
      if (!byDoor.has(c.zhishi)) byDoor.set(c.zhishi, new Set());
      byDoor.get(c.zhishi)!.add(cl.polarity);
    }
    // 至少有一个「凶门」曾判中性，说明不是照吉凶表抄的
    const evil = ["死门", "惊门", "伤门"].filter((d) => byDoor.get(d)?.has("中性") === true);
    expect(evil.length, "三凶门恒判逆 —— 那是在照吉凶表抄，不是在算生克").toBeGreaterThan(0);
  });

  it("依据里只述结构与传统事象，不含成败字眼", () => {
    const BAD = ["必得", "可成", "不成", "难成", "立至", "主得", "主失", "痊愈", "大吉", "大凶"];
    for (const c of YEAR.slice(0, 400)) {
      const text = qimenClaims(c).map((x) => x.evidence).join("");
      for (const w of BAD) expect(text.includes(w), `出现成败字眼「${w}」`).toBe(false);
    }
  });

  it("我方位置三种取向都出得来", () => {
    const pol = new Set(YEAR.flatMap(
      (c) => qimenClaims(c).filter((x) => x.axis === "我方位置").map((x) => x.polarity)));
    expect(pol).toEqual(new Set(["顺", "逆", "中性"]));
  });

  it("方位轴给出的是八方之一，不是宫数", () => {
    for (const c of YEAR.slice(0, 100)) {
      const f = qimenClaims(c).find((x) => x.axis === "方位")!;
      expect(f.evidence).toMatch(/[东南西北中]/);
      expect(f.polarity, "方位不判顺逆").toBe("中性");
    }
  });
});

describe("**声明了却没实现的流派，构建期就要拦下**", () => {
  it("置闰法与飞盘法目前只在枚举里，取之即报错", () => {
    expect(() => loadParams({ qimen: { juMethod: "zhirun" } }))
      .toThrow(/只实现了 chaibu/);
    expect(() => loadParams({ qimen: { plate: "fei" } }))
      .toThrow(/只实现了 zhuan/);
    // 默认值当然要能过
    expect(() => loadParams({})).not.toThrow();
    expect(loadParams({}).qimen).toEqual({ juMethod: "chaibu", plate: "zhuan" });
  });
});

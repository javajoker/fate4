import { describe, expect, it } from "vitest";
import {
  TROPICAL_SIGNS, signOf, zodiacVsZhongqi, YUEJIANG_ZODIAC,
  precessionSinceJ2000, ayanamsaAt, LAHIRI_ZERO_EPOCH_JD, PRECESSION_DEG_PER_YEAR, skyAt,
} from "../src/compare/substrate.js";
import {
  SYSTEMS, byAstronomy, byDeterminism, systemById,
} from "../src/compare/systems.js";
import {
  SIZHU_STATES, SIZHU_NAIVE, LIUYAO_COIN_STATES, liuyaoCoinEnumeration,
  sizhuRuleHolds, tarotDraws, stateSpaces,
} from "../src/compare/statespace.js";
import { buildChart } from "../src/chart/buildChart.js";
import { asTT } from "../src/astro/julian.js";
import { millisToJulianDay } from "../src/time/timezone.js";
import { YUEJIANG } from "../src/liuren/tables.js";
import {
  meanLunarNode, meanLunarPerigee, siyuAt, NODE_PERIOD_YEARS, PERIGEE_PERIOD_YEARS,
  taisuiDrift, ziweiPalaces, ziweiPalaceSpace, meanVsTrueTerms, solarDailyMotion,
  DINGQI_REFORM_YEAR,
} from "../src/compare/correspondence.js";
import { SOLAR_TERMS } from "../src/astro/solarTerms.js";

describe("**中气与入宫点是同一组时刻** —— 全书最硬的那条连接", () => {
  it("十二中气的定义黄经恰为 30° 的整数倍，十二节恰落在正中间", () => {
    for (const t of SOLAR_TERMS) {
      if (t.kind === "气") expect(t.longitude % 30, `${t.name}`).toBe(0);
      else expect(t.longitude % 30, `${t.name}`).toBe(15);
    }
  });

  it("逐格对照：有中气的行必有入宫点，有节的行必无 —— 无一例外", () => {
    const rows = zodiacVsZhongqi();
    expect(rows.length).toBe(24);
    for (const r of rows) {
      expect(r.zhongqi !== null, `黄经 ${r.longitude}`).toBe(r.zodiacIngress !== null);
      expect(r.jie !== null, `黄经 ${r.longitude}`).toBe(r.zodiacIngress === null);
    }
    expect(rows.filter((r) => r.zhongqi !== null).length).toBe(12);
    expect(rows.filter((r) => r.jie !== null).length).toBe(12);
  });

  it("**反向对照：两套格子确实错开 15°，不是重合** —— 否则上一条是废话", () => {
    const qi = SOLAR_TERMS.filter((t) => t.kind === "气").map((t) => t.longitude).sort((a, b) => a - b);
    const jie = SOLAR_TERMS.filter((t) => t.kind === "节").map((t) => t.longitude).sort((a, b) => a - b);
    expect(qi).toEqual(TROPICAL_SIGNS.map((z) => z.from).sort((a, b) => a - b));
    for (const j of jie) expect(qi.includes(j), `节 ${j} 不该落在入宫点上`).toBe(false);
  });

  it("六壬的月将 = 太阳所在的宫，逐条对上", () => {
    expect(YUEJIANG_ZODIAC.length).toBe(12);
    for (const { branch, zodiac } of YUEJIANG_ZODIAC) {
      const y = YUEJIANG.find((x) => x.branch === branch);
      expect(y, `月将表里没有 ${branch}`).toBeDefined();
      // 月将起于某中气，而该中气的黄经即该宫的起点
      const term = SOLAR_TERMS.find((t) => t.name === y!.fromZhongqi)!;
      expect(term.kind).toBe("气");
      expect(TROPICAL_SIGNS.find((z) => z.from === term.longitude)!.name,
        `${branch}（起于${y!.fromZhongqi}）`).toBe(zodiac);
    }
  });
});

describe("岁差", () => {
  it("当代速率约 50.3 角秒/年", () => {
    expect(PRECESSION_DEG_PER_YEAR * 3600).toBeCloseTo(50.29, 1);
  });

  it("J2000 当天的累积岁差为零", () => {
    expect(precessionSinceJ2000(asTT(2451545.0))).toBeCloseTo(0, 10);
  });

  it("**Lahiri 零点代入后当代 ayanamsa ≈ 24.2°** —— 与各星历软件相符，反过来验证这段算法", () => {
    const jd = asTT(millisToJulianDay(Date.UTC(2026, 0, 1)) + 69 / 86400);
    const a = ayanamsaAt(jd, LAHIRI_ZERO_EPOCH_JD);
    expect(a).toBeGreaterThan(23.8);
    expect(a).toBeLessThan(24.6);
  });

  it("岁差是单调累积的 —— 后一年必大于前一年", () => {
    const a = precessionSinceJ2000(asTT(millisToJulianDay(Date.UTC(2000, 0, 1))));
    const b = precessionSinceJ2000(asTT(millisToJulianDay(Date.UTC(2100, 0, 1))));
    expect(b - a).toBeCloseTo(1.397, 2);   // 约 100 年 × 50.3″
  });
});

describe("一个时刻的天文量", () => {
  it("春分前后太阳在双鱼末度，刚要入白羊", () => {
    const jd = asTT(millisToJulianDay(Date.UTC(2026, 2, 20, 12)) + 69 / 86400);
    const s = skyAt(jd);
    expect(s.zodiac).toBe("双鱼");
    expect(s.degreeInSign).toBeGreaterThan(29);
    expect(s.solarLongitude).toBeGreaterThan(359);
  });

  it("黄经落在哪一宫，边界处逐个验", () => {
    expect(signOf(0).name).toBe("白羊");
    expect(signOf(29.99).name).toBe("白羊");
    expect(signOf(30).name).toBe("金牛");
    expect(signOf(359.99).name).toBe("双鱼");
    expect(signOf(360).name).toBe("白羊");
  });
});

describe("状态空间", () => {
  it("**四柱是 518400，不是 60⁴** —— 月干与时干不自由", () => {
    expect(SIZHU_STATES).toBe(518400);
    expect(SIZHU_NAIVE / SIZHU_STATES).toBe(25);
  });

  it("那两条「唯一决定」在真盘上成立 —— 不成立的话上一条就是错的", () => {
    const charts = [];
    for (let y = 1960; y < 2030; y += 2) {
      for (const [mo, d] of [[1, 10], [4, 10], [7, 10], [10, 10]] as const) {
        for (const h of [1, 9, 17] as const) {
          charts.push(buildChart({
            year: y, month: mo, day: d, hour: h, minute: 30,
            gender: "male", timeZone: "Asia/Shanghai", longitude: 120,
          }));
        }
      }
    }
    const r = sizhuRuleHolds(charts);
    expect(r.checked).toBeGreaterThan(400);
    expect(r.conflicts, "月干或时干不由那两条规则唯一决定").toBe(0);
  });

  it("掷钱：枚举出来的状态数恰为 4⁶", () => {
    expect(liuyaoCoinEnumeration()).toBe(LIUYAO_COIN_STATES);
    expect(LIUYAO_COIN_STATES).toBe(4096);
  });

  it("塔罗的组合数", () => {
    expect(tarotDraws(1, false)).toBe(78);
    expect(tarotDraws(3, false)).toBe(78 * 77 * 76);
    expect(tarotDraws(3, true)).toBe(78 * 77 * 76 * 8);
  });

  it("连续的那一类不给状态数 —— 给了就是把量化当成了本来的样子", () => {
    const cont = stateSpaces().filter((s) => s.kind === "连续");
    expect(cont.length).toBeGreaterThan(0);
    for (const s of cont) expect(s.size, s.system).toBeNull();
  });
});

describe("系统登记表", () => {
  it("每一条都有可考来源；托名与可考分开记", () => {
    for (const s of SYSTEMS) {
      expect(s.provenance.attested.length, s.name).toBeGreaterThan(10);
      expect(s.astronomyWhy.length, `${s.name} 没有给分类理由`).toBeGreaterThan(20);
    }
  });

  it("**两种分法切出来的组不一样** —— 这正是这张表的用处", () => {
    const a = byAstronomy(); const d = byDeterminism();
    // 天文含量把占星与七政放一起，确定性把它们和四柱放一起
    expect(a["实测天体"].map((s) => s.id).sort()).toEqual(["astrology", "qizheng"]);
    expect(d["确定"].map((s) => s.id)).toContain("sizhu");
    expect(d["确定"].map((s) => s.id)).toContain("astrology");
    // 塔罗两刀都落单
    expect(a["纯约定"].map((s) => s.id)).toEqual(["tarot"]);
    expect(d["随机"].map((s) => s.id)).toEqual(["tarot"]);
  });

  it("**东西之分与这两刀都不重合** —— 故「东方西方」不是一条有解释力的界", () => {
    const west = SYSTEMS.filter((s) => s.tradition === "西方").map((s) => s.id).sort();
    expect(west).toEqual(["astrology", "tarot"]);
    // 这两套西方的系统，在两刀上都被分开了
    expect(systemById("astrology")!.astronomy).toBe("实测天体");
    expect(systemById("tarot")!.astronomy).toBe("纯约定");
    expect(systemById("astrology")!.determinism).toBe("确定");
    expect(systemById("tarot")!.determinism).toBe("随机");
    // 而西洋占星与中土的七政四余同档
    expect(systemById("qizheng")!.astronomy).toBe(systemById("astrology")!.astronomy);
  });

  it("未实现的系统不冒充有实测背书", () => {
    for (const s of stateSpaces()) {
      if (s.basis === "declared") expect(s.note).toMatch(/⚠️|未实现|不给数|连续/);
    }
  });
});

// ═════════════════════════════════════════════════════════
// 数值对应 —— correspondence.ts
// ═════════════════════════════════════════════════════════

describe("**四余是月亮的交点与远地点** —— 不是类比，是同一批点", () => {
  const jd = asTT(millisToJulianDay(Date.UTC(2026, 0, 1)) + 69 / 86400);

  it("交点周期 18.6 年、近地点周期 8.85 年 —— 两个独立可查的数", () => {
    expect(NODE_PERIOD_YEARS).toBeCloseTo(18.61, 2);
    expect(PERIGEE_PERIOD_YEARS).toBeCloseTo(8.85, 2);
  });

  it("J2000 当天的平升交点 = 125.0445°（Meeus 的常数项）", () => {
    expect(meanLunarNode(asTT(2451545.0))).toBeCloseTo(125.0445479, 5);
  });

  it("**升交点逆行、近地点顺行** —— 方向相反，这是它们最好认的区别", () => {
    const a = meanLunarNode(jd);
    const b = meanLunarNode(asTT((jd as number) + 365.25));
    // 逆行：一年退约 19.35°
    expect(((a - b) % 360 + 360) % 360).toBeCloseTo(19.34, 1);

    const p1 = meanLunarPerigee(jd);
    const p2 = meanLunarPerigee(asTT((jd as number) + 365.25));
    // 顺行：一年进约 40.69°
    expect(((p2 - p1) % 360 + 360) % 360).toBeCloseTo(40.69, 1);
  });

  it("计都恒与罗睺相对，月孛恒与近地点相对", () => {
    const s = siyuAt(jd);
    expect(((s.ketu - s.rahu) % 360 + 360) % 360).toBeCloseTo(180, 9);
    expect(((s.yuebei - meanLunarPerigee(jd)) % 360 + 360) % 360).toBeCloseTo(180, 9);
  });

  it("**反向对照：与 2026 年初的已知值相符** —— 否则上面几条只是自洽", () => {
    // 自 J2000 的 125.04° 逆行 26 年 × 19.35°/年，绕回来约 342°
    expect(meanLunarNode(jd)).toBeGreaterThan(341);
    expect(meanLunarNode(jd)).toBeLessThan(343);
  });
});

describe("**太岁：一条已经漂没了的天文连接**", () => {
  it("木星十二年多走约 4.2°，约 86 年跳一个次 —— 这就是史书里的「超辰」", () => {
    const d = taisuiDrift(0, 0);
    expect(d.degreesPer12Years).toBeCloseTo(4.17, 1);
    expect(d.yearsPerStationSkip).toBeGreaterThan(80);
    expect(d.yearsPerStationSkip).toBeLessThan(90);
  });

  it("自太初历（前 104 年）至今已偏二十余个次 —— 名存实亡", () => {
    const d = taisuiDrift(-104, 2026);
    expect(d.stationsDrifted).toBeGreaterThan(20);
    expect(d.stationsDrifted).toBeLessThan(30);
  });

  it("漂移是线性累积的 —— 年数翻倍，偏差翻倍", () => {
    const a = taisuiDrift(0, 100).degreesDrifted;
    const b = taisuiDrift(0, 200).degreesDrifted;
    expect(b / a).toBeCloseTo(2, 6);
  });
});

describe("**紫微的命宫是一个纯算术函数** —— 起法本身就是依据", () => {
  it("输入只有农历月与时辰两个整数，不查星历", () => {
    expect(ziweiPalaces(1, 0).ming).toBe("寅");
    expect(ziweiPalaces(1, 0).shen).toBe("寅");
    // 正月寅起，顺数到七月是申；午时逆数六位回到寅
    expect(ziweiPalaces(7, 6).ming).toBe("寅");
    expect(ziweiPalaces(7, 6).shen).toBe("寅");
  });

  it("越界输入抛错，不静默取模", () => {
    expect(() => ziweiPalaces(0, 0)).toThrow();
    expect(() => ziweiPalaces(13, 0)).toThrow();
    expect(() => ziweiPalaces(1, 12)).toThrow();
  });

  it("**144 种输入只落到 72 对 (命, 身)** —— 穷举得出，这是该起法的性质", () => {
    const s = ziweiPalaceSpace();
    expect(s.inputs).toBe(144);
    expect(s.distinctMing).toBe(12);
    expect(s.distinctPairs).toBe(72);
  });

  it("命宫顺时不变量：命 + 身 恒等于两倍的月宫", () => {
    for (let m = 1; m <= 12; m++) {
      for (let h = 0; h < 12; h++) {
        const p = ziweiPalaces(m, h);
        const monthPalace = (2 + m - 1) % 12;
        expect((p.mingIndex + p.shenIndex) % 12).toBe((2 * monthPalace) % 12);
      }
    }
  });
});

describe("**平气与定气：1645 年那条缝**", () => {
  const terms = meanVsTrueTerms(2026);

  it("二十四个节气都算到了", () => {
    expect(terms.length).toBe(24);
  });

  it("**最大可差两天以上** —— 这足以改掉一个人的月柱", () => {
    const max = Math.max(...terms.map((t) => Math.abs(t.diffDays)));
    expect(max).toBeGreaterThan(2);
  });

  it("差值在二至附近近零、在二分附近最大 —— 椭圆轨道的直接后果", () => {
    const at = (n: string) => terms.find((t) => t.term === n)!;
    expect(Math.abs(at("夏至").diffDays)).toBeLessThan(1.2);
    expect(Math.abs(at("清明").diffDays)).toBeGreaterThan(2);
  });

  it("近日点附近太阳走得快，远日点附近走得慢，差约 7%", () => {
    const jd = (mo: number, d: number) =>
      asTT(millisToJulianDay(Date.UTC(2026, mo, d)) + 69 / 86400);
    const peri = solarDailyMotion(jd(0, 3));
    const apo = solarDailyMotion(jd(6, 5));
    expect(peri).toBeGreaterThan(apo);
    expect(peri / apo - 1).toBeCloseTo(0.069, 2);
    expect(peri).toBeCloseTo(1.019, 2);
    expect(apo).toBeCloseTo(0.953, 2);
  });

  it("**反向对照：平气的间隔确实是等的** —— 否则上面比的是两个定气", () => {
    const sorted = [...terms].sort((a, b) => a.meanJd - b.meanJd);
    const gaps = sorted.slice(1).map((t, i) => t.meanJd - sorted[i]!.meanJd);
    for (const g of gaps) expect(g).toBeCloseTo(365.2421897 / 24, 6);
  });

  it("改历之年记在案", () => {
    expect(DINGQI_REFORM_YEAR).toBe(1645);
  });
});

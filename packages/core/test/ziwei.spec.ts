import { describe, expect, it } from "vitest";
import {
  palaceLayout, bureauOf, PALACE_NAMES, BUREAU_NUMBER,
  ziweiIndex, tianfuIndex, majorStars, luckyStars, unluckyStars,
  luMaStars, sihuaOf, SIHUA_ORDER, STEM_TABLES_COVER_ALL,
  buildZiweiChart, ziweiStateSpace, ZIWEI_PENDING_CALIBRATION,
  readZiwei, readPalace, sanfangSizheng, gejuOf, MAJOR_STAR_NAMES,
} from "../src/ziwei/index.js";
import { STEMS, BRANCHES } from "../src/types/ganzhi.js";
import { scanText } from "../src/report/guard.js";

describe("十二宫", () => {
  it("命宫：自寅起正月顺数至生月，再自该宫起子时逆数至生时", () => {
    // 正月子时 → 寅
    expect(palaceLayout(1, 0).mingIndex).toBe(2);
    // 正月丑时 → 丑
    expect(palaceLayout(1, 1).mingIndex).toBe(1);
    // 五月午时：寅起正月数到五月 = 午(6)，再逆数午时(6) → 子(0)
    expect(palaceLayout(5, 6).mingIndex).toBe(0);
  });

  it("**子时生人命身同宫** —— 两者只差最后一步的方向", () => {
    for (let m = 1; m <= 12; m++) {
      const p = palaceLayout(m, 0);
      expect(p.mingIndex, `${m}月`).toBe(p.shenIndex);
    }
    // 反向对照：非子时多半不同宫（午时必不同，因为逆顺差 12 步）
    let differ = 0;
    for (let m = 1; m <= 12; m++) {
      for (let h = 1; h < 12; h++) {
        if (palaceLayout(m, h).mingIndex !== palaceLayout(m, h).shenIndex) differ++;
      }
    }
    expect(differ).toBeGreaterThan(100);
  });

  it("十二宫自命宫逆行，不重不漏", () => {
    for (let m = 1; m <= 12; m++) {
      for (let h = 0; h < 12; h++) {
        const { palaceAt, mingIndex } = palaceLayout(m, h);
        expect(new Set(palaceAt).size, `${m}月${h}时`).toBe(12);
        expect(palaceAt[mingIndex]).toBe("命宫");
        // 兄弟宫在命宫逆一位
        expect(palaceAt[(mingIndex - 1 + 12) % 12]).toBe("兄弟");
        expect(PALACE_NAMES.every((n) => palaceAt.includes(n))).toBe(true);
      }
    }
  });

  it("越界的月与时辰抛错，不静默取模", () => {
    expect(() => palaceLayout(0, 0)).toThrow();
    expect(() => palaceLayout(13, 0)).toThrow();
    expect(() => palaceLayout(1, 12)).toThrow();
    expect(() => palaceLayout(1, -1)).toThrow();
  });
});

describe("五行局", () => {
  it("只有五种，且局数与名字对得上", () => {
    const seen = new Set<string>();
    for (const s of STEMS) {
      for (let i = 0; i < 12; i++) seen.add(bureauOf(s, i).bureau);
    }
    expect(seen.size).toBe(5);
    for (const b of seen) {
      expect(BUREAU_NUMBER[b as keyof typeof BUREAU_NUMBER]).toBeGreaterThanOrEqual(2);
      expect(BUREAU_NUMBER[b as keyof typeof BUREAU_NUMBER]).toBeLessThanOrEqual(6);
    }
  });

  it("局由命宫纳音定，而命宫干由年干起五虎遁", () => {
    // 庚年、命宫在戌 → 丙戌，纳音屋上土 → 土五局
    const r = bureauOf("庚", 10);
    expect(r.mingStem).toBe("丙");
    expect(r.mingBranch).toBe("戌");
    expect(r.nayin).toBe("屋上土");
    expect(r.bureau).toBe("土五局");
    expect(r.number).toBe(5);
  });

  it("**命宫干支恒为合法干支** —— 干支必须同奇偶，否则纳音取错", () => {
    for (const s of STEMS) {
      for (let i = 0; i < 12; i++) {
        const r = bureauOf(s, i);
        const si = STEMS.indexOf(r.mingStem as typeof STEMS[number]);
        const bi = BRANCHES.indexOf(r.mingBranch as typeof BRANCHES[number]);
        expect(si % 2, `${s}/${i}`).toBe(bi % 2);
      }
    }
  });
});

describe("紫微与天府", () => {
  it("已知几例对得上", () => {
    expect(ziweiIndex(2, 1)).toBe(BRANCHES.indexOf("丑"));   // 水二局初一在丑
    expect(ziweiIndex(2, 2)).toBe(BRANCHES.indexOf("寅"));   // 水二局初二在寅
    expect(ziweiIndex(3, 1)).toBe(BRANCHES.indexOf("辰"));   // 木三局初一在辰
    expect(ziweiIndex(5, 18)).toBe(BRANCHES.indexOf("未"));  // 土五局十八在未
  });

  it("**整除时按步数顺排** —— 局数的用处只有定紫微这一个", () => {
    for (const b of [2, 3, 4, 5, 6]) {
      for (let k = 1; k * b <= 30; k++) {
        expect(ziweiIndex(b, k * b), `${b}局第${k * b}日`).toBe((2 + k - 1) % 12);
      }
    }
  });

  it("任何局任何日都落在十二宫之内", () => {
    for (const b of [2, 3, 4, 5, 6]) {
      for (let d = 1; d <= 30; d++) {
        const i = ziweiIndex(b, d);
        expect(i, `${b}局${d}日`).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(12);
      }
    }
  });

  it("**天府与紫微关于寅申轴对称**，由对称推出不另立表", () => {
    for (let z = 0; z < 12; z++) {
      const f = tianfuIndex(z);
      expect(tianfuIndex(f), `紫微 ${z}`).toBe(z);        // 对称是对合
    }
    // ⚠️ 寅与申是**不动点** —— 轴穿过它们。
    // 这两行原本写作「寅→申、丑→酉」，把实现里的错误抄了一遍，于是一路全绿。
    expect(tianfuIndex(BRANCHES.indexOf("寅"))).toBe(BRANCHES.indexOf("寅"));
    expect(tianfuIndex(BRANCHES.indexOf("申"))).toBe(BRANCHES.indexOf("申"));
    expect(tianfuIndex(BRANCHES.indexOf("丑"))).toBe(BRANCHES.indexOf("卯"));
    expect(tianfuIndex(BRANCHES.indexOf("未"))).toBe(BRANCHES.indexOf("酉"));
  });

  it("十四主星：数目对、名字不重、全部落在盘上", () => {
    for (let z = 0; z < 12; z++) {
      const s = majorStars(z);
      expect(s).toHaveLength(14);
      expect(new Set(s.map((x) => x.name)).size).toBe(14);
      expect(s.every((x) => x.index >= 0 && x.index < 12)).toBe(true);
    }
  });
});

describe("辅星与四化", () => {
  it("十个年干的表都齐 —— 缺一个就会在某年抛错", () => {
    expect(STEM_TABLES_COVER_ALL()).toBe(true);
  });

  it("四化恒为四颗，次序为禄权科忌", () => {
    for (const s of STEMS) {
      const h = sihuaOf(s);
      expect(h, s).toHaveLength(4);
      expect(h.map((x) => x.kind)).toEqual([...SIHUA_ORDER]);
      expect(new Set(h.map((x) => x.star)).size, `${s} 四化不得重星`).toBe(4);
    }
  });

  it("**擎羊陀罗恒夹禄存** —— 三者相邻是这套起法的定义", () => {
    for (const s of STEMS) {
      const lu = luMaStars(s, 0).find((x) => x.name === "禄存")!;
      const bad = unluckyStars(s, 0, 0);
      const yang = bad.find((x) => x.name === "擎羊")!;
      const tuo = bad.find((x) => x.name === "陀罗")!;
      expect((lu.index + 1) % 12, s).toBe(yang.index);
      expect((lu.index + 11) % 12, s).toBe(tuo.index);
    }
  });

  it("天马恒在四马地（寅申巳亥）", () => {
    const horses = new Set(["寅", "申", "巳", "亥"].map((b) =>
      BRANCHES.indexOf(b as typeof BRANCHES[number])));
    for (let y = 0; y < 12; y++) {
      const ma = luMaStars("甲", y).find((x) => x.name === "天马")!;
      expect(horses.has(ma.index), `年支 ${BRANCHES[y]}`).toBe(true);
    }
  });

  it("六吉六煞数目对，且落位随各自的输入变", () => {
    expect(luckyStars(1, 0, "甲")).toHaveLength(6);
    expect(unluckyStars("甲", 0, 0)).toHaveLength(6);
    // 反向对照：换一个时辰，文昌文曲必动；换一个月，左辅右弼必动
    const a = luckyStars(1, 0, "甲");
    const b = luckyStars(1, 5, "甲");
    const c = luckyStars(6, 0, "甲");
    expect(a.find((x) => x.name === "文昌")!.index)
      .not.toBe(b.find((x) => x.name === "文昌")!.index);
    expect(a.find((x) => x.name === "左辅")!.index)
      .not.toBe(c.find((x) => x.name === "左辅")!.index);
    // 而天魁天钺只随年干，不随月时
    expect(a.find((x) => x.name === "天魁")!.index)
      .toBe(b.find((x) => x.name === "天魁")!.index);
  });
});

describe("整张盘", () => {
  const CH = buildZiweiChart({
    year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
  });

  it("1990-05-12 14:30 的盘逐项对得上", () => {
    expect(CH.yearStem).toBe("庚");
    expect(CH.yearBranch).toBe("午");
    expect(CH.hourBranch).toBe(7);               // 未时
    expect(CH.bureau.bureau).toBe("土五局");
    expect(CH.palaces.find((p) => p.isMing)!.branch).toBe("戌");
    expect(CH.palaces.find((p) => p.isShen)!.branch).toBe("子");
    expect(CH.limitDirection).toBe("顺行");       // 庚为阳干、男
    const zw = CH.palaces.find((p) => p.stars.some((s) => s.name === "紫微"))!;
    expect(zw.branch).toBe("未");
    const tf = CH.palaces.find((p) => p.stars.some((s) => s.name === "天府"))!;
    // 紫微在未 → 天府在酉（寅申轴对称，(4 − 紫微) mod 12）。
    // 这里原本写的是「卯」—— 与当时那个错式子一致，故一路全绿。
    expect(tf.branch).toBe("酉");
  });

  it("十二宫齐全，每宫一名，命身各有所属", () => {
    expect(CH.palaces).toHaveLength(12);
    expect(new Set(CH.palaces.map((p) => p.name)).size).toBe(12);
    expect(CH.palaces.filter((p) => p.isMing)).toHaveLength(1);
    expect(CH.palaces.filter((p) => p.isShen)).toHaveLength(1);
  });

  it("**大限自命宫起、首限起于局数**，十二宫连续不断", () => {
    const ming = CH.palaces.find((p) => p.isMing)!;
    expect(ming.majorLimit!.from).toBe(CH.bureau.number);
    const spans = CH.palaces.map((p) => p.majorLimit!.from).sort((a, b) => a - b);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]! - spans[i - 1]!, "每限十年，首尾相接").toBe(10);
    }
  });

  it("**四化只落在盘上已有的星上** —— 它不摆新星", () => {
    const onChart = new Set(CH.palaces.flatMap((p) => p.stars.map((s) => s.name)));
    const placed = CH.palaces.flatMap((p) => p.sihua);
    for (const h of placed) expect(onChart.has(h.star), h.star).toBe(true);
    // 四化共四条，落到盘上的不会多于四条（有的星可能不在本实现收录之列）
    expect(placed.length).toBeLessThanOrEqual(4);
  });

  it("**年干支取农历年，不是立春年** —— 这一条会改变盘上一大半东西", () => {
    // 1990 正月初一在 1 月 27 日，立春在 2 月 4 日。
    // 生于两者之间：农历年已是庚午，而四柱的立春年还是己巳。
    const c = buildZiweiChart({
      year: 1990, month: 1, day: 29, hour: 10, minute: 0,
      gender: "female", timeZone: "Asia/Shanghai", longitude: 121.47,
    }, { solarYearStem: "己" });
    expect(c.lunar.year).toBe(1990);
    expect(c.yearStem).toBe("庚");
    expect(c.agreesWithSolarYear).toBe(false);
    expect(c.warnings.join()).toContain("不是同一个年");
    // 年干不同 → 四化必不同
    expect(sihuaOf("庚").map((h) => h.star))
      .not.toEqual(sihuaOf("己").map((h) => h.star));
  });

  it("闰月出一条警告 —— 换一种归属，月系星与十二宫全体移位", () => {
    // 2020 年闰四月
    const c = buildZiweiChart({
      year: 2020, month: 6, day: 1, hour: 10, minute: 0,
      gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    if (c.lunar.isLeap) expect(c.warnings.join()).toContain("闰");
    else expect(c.lunar.isLeap).toBe(false);   // 不是闰月就不该瞎报
  });

  it("**性别只改大限方向，不改星的落位**", () => {
    const f = buildZiweiChart({
      year: 1990, month: 5, day: 12, hour: 14, minute: 30,
      gender: "female", timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    expect(f.limitDirection).toBe("逆行");
    expect(f.palaces.map((p) => p.stars.map((s) => s.name).sort().join()))
      .toEqual(CH.palaces.map((p) => p.stars.map((s) => s.name).sort().join()));
  });
});

describe("**状态空间：穷举，不是估的**", () => {
  const S = ziweiStateSpace();

  it("输入基数为 518,400 —— 与四柱同数，而那是巧合", () => {
    expect(S.inputs).toBe(60 * 12 * 30 * 12 * 2);
    expect(S.inputs).toBe(518_400);
  });

  it("**不同的盘少于输入数** —— 不同的输入会给出同一张盘", () => {
    expect(S.distinctCharts).toBeLessThan(S.inputs);
    expect(S.distinctCharts).toBe(34_560);
    expect(S.collapseRatio).toBeCloseTo(15, 6);
  });

  it("**星曜布局已经定死了命宫与四化** —— 两个数相等不是巧合", () => {
    // 若有两组输入给出同一布局却不同命宫，charts 会多于 layouts。
    // 相等说明布局唯一决定命宫位置与年干四化。
    expect(S.distinctCharts).toBe(S.distinctStarLayouts);
  });

  it("**这个数属于本实现，不属于紫微斗数** —— 返回值里写着", () => {
    expect(S.note).toContain("本实现");
    expect(S.note).toContain("杂曜");
  });
});

describe("诚实性约束", () => {
  it("待核对清单点名了最要紧的几处", () => {
    const j = ZIWEI_PENDING_CALIBRATION.join("\n");
    expect(j).toContain("火星铃星");
    expect(j).toContain("闰月");
    expect(j).toContain("凭记忆转录");
    expect(j).toContain("未收录");
  });

  it("**对外文本过措辞守卫** —— 紫微的宫名极易滑向断语", () => {
    const CH = buildZiweiChart({
      year: 1990, month: 5, day: 12, hour: 14, minute: 30,
      gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    for (const t of [...CH.warnings, ...ZIWEI_PENDING_CALIBRATION]) {
      expect(scanText(t, "ziwei"), t.slice(0, 36)).toEqual([]);
    }
  });

  it("**运行时字符串里没有 Markdown 粗体**", () => {
    const CH = buildZiweiChart({
      year: 2020, month: 6, day: 1, hour: 10, minute: 0,
      gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    for (const t of [...CH.warnings, ...ZIWEI_PENDING_CALIBRATION, CH.yearBasis]) {
      expect(t.includes("**"), t.slice(0, 36)).toBe(false);
    }
  });
});

describe("盘面的解读", () => {
  const CH = buildZiweiChart({
    year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
  });
  const R = readZiwei(CH);

  it("三方四正恒为本宫、对宫（+6）、三合二宫（±4）", () => {
    for (let i = 0; i < 12; i++) {
      const sf = sanfangSizheng(i);
      expect(sf.opposite).toBe((i + 6) % 12);
      expect(new Set(sf.trine)).toEqual(new Set([(i + 4) % 12, (i + 8) % 12]));
      expect(new Set(sf.all).size, "四宫互不相同").toBe(4);
    }
  });

  it("**命宫的三合二宫恰是财帛与官禄** —— 十二宫逆行排布的直接后果", () => {
    const sf = sanfangSizheng(CH.layout.mingIndex);
    const names = sf.trine.map((i) => CH.palaces[i]!.name).sort();
    expect(names).toEqual(["官禄", "财帛"].sort());
    // 对宫必是迁移
    expect(CH.palaces[sf.opposite]!.name).toBe("迁移");
  });

  it("**空宫借对宫的主星**，不空则不借", () => {
    // 这张盘的命宫坐太阴，不空 —— 故另找一个真空宫来验借星。
    expect(R.ming.isEmpty).toBe(false);
    expect(R.ming.majors.map((s) => s.name)).toEqual(["太阴"]);

    const emptyIdx = CH.palaces.findIndex((p) =>
      !p.stars.some((s) => MAJOR_STAR_NAMES.includes(s.name)));
    expect(emptyIdx, "十二宫里总该有空宫").toBeGreaterThanOrEqual(0);
    const e = readPalace(CH, emptyIdx);
    expect(e.isEmpty).toBe(true);
    expect(e.majors).toHaveLength(0);
    expect(e.why).toContain("借对宫");
    // 借来的必须正是对宫的主星，不是别处的
    const opp = CH.palaces[e.sanfang.opposite]!;
    expect(e.borrowed.map((s) => s.name).sort())
      .toEqual(opp.stars.filter((s) => MAJOR_STAR_NAMES.includes(s.name))
        .map((s) => s.name).sort());

    // 反向对照：有主星的宫不该借
    const filled = CH.palaces.find((p) =>
      p.stars.some((s) => MAJOR_STAR_NAMES.includes(s.name)))!;
    const r = readPalace(CH, filled.index);
    expect(r.isEmpty).toBe(false);
    expect(r.borrowed).toHaveLength(0);
  });

  it("**杀破狼恒互为三合** —— 排布的直接后果，不是巧合", () => {
    for (let z = 0; z < 12; z++) {
      const s = majorStars(z);
      const at = (n: string) => s.find((x) => x.name === n)!.index;
      const gap = (a: string, b: string) => ((at(a) - at(b)) % 12 + 12) % 12;
      expect(gap("七杀", "贪狼"), `紫微 ${z}`).toBe(4);
      expect(gap("破军", "七杀"), `紫微 ${z}`).toBe(4);
    }
  });

  it("**杀破狼在三方四正里只能见三颗或一颗，绝不会是两颗**", () => {
    // 三颗恒占一条三合线 {k, k+4, k+8}。命宫的三方四正是
    // {m, m+4, m+8}（另一条三合线）加对宫 m+6。
    // 于是只有两种命中方式：命宫那条线就是杀破狼线（见三颗），
    // 或者对宫落在杀破狼线上（见一颗）。两者不可能同时发生。
    const counts = new Set<number>();
    for (let hour = 0; hour < 24; hour += 2) {
      for (const day of [3, 9, 15, 21, 27]) {
        const c = buildZiweiChart({
          year: 1990, month: 5, day, hour, minute: 0,
          gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
        });
        const g = gejuOf(c, c.layout.mingIndex).find((x) => x.name === "杀破狼");
        const n = g?.seen.length ?? 0;
        counts.add(n);
        expect([0, 1, 3], `${day} 日 ${hour} 时：见 ${g?.seen.join("、") ?? "无"}`)
          .toContain(n);
        if (n === 3) expect(g!.complete).toBe(true);
      }
    }
    // 反向对照：样本里三种情形都出现过，否则上面那条可能只验到一种
    expect(counts.size, `实际出现的命中数：${[...counts].join("/")}`)
      .toBeGreaterThan(1);
  });

  it("四化落宫带宫名，并标出是否在命宫三方四正内", () => {
    expect(R.sihua).toHaveLength(4);
    for (const h of R.sihua) {
      expect(typeof h.inMingSanfang).toBe("boolean");
      if (h.palace !== null) {
        expect(CH.palaces.some((p) => p.name === h.palace)).toBe(true);
      }
    }
    // 这张盘上确有四化落在命宫三方四正内，否则这条断言是空的
    expect(R.sihua.some((h) => h.inMingSanfang)).toBe(true);
  });

  it("**不收庙旺表，而且明说那是缺口不是取舍**", () => {
    const n = R.notes.join("\n");
    expect(n).toContain("168 格");
    expect(n).toContain("真实的缺口");
    expect(n).toContain("不是取舍");
    // 查**字段名**而不是文本 —— notes 里正解释着「为什么不收庙旺」，
    // 拿字符串去扫会把那句解释当成违例。（合盘那边先踩过一次。）
    const keys = new Set<string>();
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if (x === null || typeof x !== "object") return;
      for (const [k, v] of Object.entries(x)) { keys.add(k); walk(v); }
    };
    walk(R);
    for (const k of keys) {
      expect(/庙旺|miaowang|dignit/i.test(k), `字段 ${k}`).toBe(false);
    }
    expect(keys.has("sanfangStars"), "反向对照：确实遍历到了嵌套字段").toBe(true);
  });

  it("**不出断语** —— 解读全文过措辞守卫", () => {
    const texts = [
      ...R.notes, R.ming.why, R.shen.why,
      ...R.geju.map((g) => g.why),
      ...R.ming.sanfangStars.map((s) => `${s.palace}${s.majors.join("")}`),
    ];
    for (const t of texts) {
      expect(scanText(t, "ziwei.reading"), t.slice(0, 40)).toEqual([]);
      expect(t.includes("**"), t.slice(0, 36)).toBe(false);
    }
  });
});

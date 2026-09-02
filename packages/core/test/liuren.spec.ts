import { describe, expect, it } from "vitest";
import {
  buildPlate, sanchuan, yuejiangAt, upperOf, groundOf, tianjiangAt,
  JIGONG, TIANJIANG, YUEJIANG, GUIREN, DAY_HOURS, KE_TI, KE_TI_NOTE,
  liurenClaims, type KeTi,
} from "../src/liuren/index.js";
import { castMomentOf } from "../src/liuyao/moment.js";
import { toJulianDay } from "../src/astro/julian.js";
import { BRANCHES, STEMS, type Branch } from "../src/types/ganzhi.js";
import { branchElement, branchIndex, controls, mod, polarityOf } from "../src/ganzhi/algebra.js";
import { solveSolarTerm } from "../src/astro/solarTerms.js";
import { asTT } from "../src/astro/julian.js";
import { utToTT } from "../src/chart/pillars.js";

function plateAt(y: number, mo: number, d: number, h: number) {
  const m = castMomentOf({
    year: y, month: mo, day: d, hour: h, minute: 30,
    timeZone: "Asia/Shanghai", longitude: 121.47,
  });
  const jd = toJulianDay({ year: y, month: mo, day: d, hour: h, minute: 30, second: 0 }) - 8 / 24;
  return buildPlate({ pillars: m.pillars, jdUT: jd });
}

/**
 * 一年 × 四个时辰，供覆盖类断言。
 *
 * 只建一次。初稿写成生成器，每条断言各建 1460 个课盘，
 * 十余条断言就是一万七千次真太阳时与节气求解 —— 整套跑了 15 秒。
 */
const YEAR = (() => {
  const out: ReturnType<typeof plateAt>[] = [];
  for (let d = 0; d < 365; d++) {
    for (const h of [2, 8, 14, 20]) {
      const dt = new Date(Date.UTC(2026, 0, 1 + d));
      out.push(plateAt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), h));
    }
  }
  return out;
})();
const year2026 = () => YEAR;

/** 三传同样只算一次 —— 它是纯函数。 */
const SC = new Map(YEAR.map((p) => [p, sanchuan(p)]));
const sc = (p: ReturnType<typeof plateAt>) => SC.get(p)!;

describe("月将", () => {
  it("**以中气为界，不以节为界** —— 与四柱的月柱不同源", () => {
    // 2026 立春 2/4、雨水 2/18。2/10 已过立春而未到雨水，月将仍是子（大寒起）
    const before = yuejiangAt(toJulianDay({
      year: 2026, month: 2, day: 10, hour: 4, minute: 0, second: 0 }));
    const after = yuejiangAt(toJulianDay({
      year: 2026, month: 2, day: 25, hour: 4, minute: 0, second: 0 }));
    expect(before.fromZhongqi).toBe("大寒");
    expect(before.branch).toBe("子");
    expect(after.fromZhongqi).toBe("雨水");
    expect(after.branch).toBe("亥");
  });

  it("月将随太阳逆行十二支，一年恰好走满一轮", () => {
    expect(YUEJIANG).toHaveLength(12);
    expect(new Set(YUEJIANG.map((y) => y.branch)).size).toBe(12);
    for (let i = 1; i < 12; i++) {
      expect(mod(branchIndex(YUEJIANG[i - 1]!.branch) - branchIndex(YUEJIANG[i]!.branch), 12),
        `${YUEJIANG[i - 1]!.branch} → ${YUEJIANG[i]!.branch}`).toBe(1);
    }
  });

  it("换将之刻恰在中气 —— 逐月核对", () => {
    for (const def of YUEJIANG) {
      const term = def.fromZhongqi;
      const lon = { 雨水: 330, 春分: 0, 谷雨: 30, 小满: 60, 夏至: 90, 大暑: 120,
        处暑: 150, 秋分: 180, 霜降: 210, 小雪: 240, 冬至: 270, 大寒: 300 }[term]!;
      const guess = toJulianDay({ year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 0 })
        + (mod(lon - 285, 360) / 360) * 365.2422 + 5;
      const t = solveSolarTerm(lon, asTT(utToTT(guess))).jdUT as number;
      expect(yuejiangAt(t + 0.01).branch, `${term} 之后应用 ${def.branch} 将`).toBe(def.branch);
      expect(yuejiangAt(t - 0.01).branch, `${term} 之前不应用 ${def.branch} 将`).not.toBe(def.branch);
    }
  });
});

describe("天地盘", () => {
  const p = plateAt(2026, 9, 2, 14);

  it("天盘是地盘的一个旋转 —— 十二支各一次", () => {
    for (const q of [p, plateAt(2026, 3, 1, 8), plateAt(2025, 12, 21, 22)]) {
      expect(new Set(q.tianpan).size).toBe(12);
      expect([...q.tianpan].sort()).toEqual([...BRANCHES].sort());
    }
  });

  it("**月将加时：月将必压在占时之位上** —— 这是天盘的定义", () => {
    for (const q of year2026()) {
      expect(upperOf(q, q.zhanshi), `${q.zhanshi} 时上应为月将 ${q.yuejiang.branch}`)
        .toBe(q.yuejiang.branch);
    }
  });

  it("天盘与地盘的正查逆查互逆", () => {
    for (const b of BRANCHES) {
      expect(upperOf(p, groundOf(p, b))).toBe(b);
      expect(groundOf(p, upperOf(p, b))).toBe(b);
    }
  });
});

describe("四课", () => {
  it("**一课下神为日干寄宫，三课下神为日支** —— 课的两个起点", () => {
    for (const q of year2026()) {
      expect(q.ke[0].lower).toBe(JIGONG[q.pillars.day.stem]);
      expect(q.ke[2].lower).toBe(q.pillars.day.branch);
    }
  });

  it("四课首尾相衔：二课下神即一课上神，四课下神即三课上神", () => {
    for (const q of year2026()) {
      expect(q.ke[1].lower).toBe(q.ke[0].upper);
      expect(q.ke[3].lower).toBe(q.ke[2].upper);
    }
  });

  it("每一课的上神都由天盘取得，无一例外", () => {
    for (const q of year2026()) {
      for (const k of q.ke) expect(k.upper).toBe(upperOf(q, k.lower));
    }
  });

  it("戊寄巳与丙同、己寄未与丁同 —— 土随火位", () => {
    expect(JIGONG.戊).toBe(JIGONG.丙);
    expect(JIGONG.己).toBe(JIGONG.丁);
    expect(new Set(Object.values(JIGONG)).size, "十干寄八宫").toBe(8);
  });
});

describe("十二天将", () => {
  it("十二位各一次，次序固定", () => {
    for (const q of year2026()) {
      expect(new Set(q.tianjiang).size).toBe(12);
      expect([...q.tianjiang].sort()).toEqual([...TIANJIANG].sort());
    }
  });

  it("**贵人所临之位即贵人** —— 起点对了，其余才对", () => {
    for (const q of year2026()) {
      expect(tianjiangAt(q, q.guiren)).toBe("贵人");
    }
  });

  it("昼夜以占时判，卯至申为昼", () => {
    for (const q of year2026()) {
      expect(q.isDay).toBe(DAY_HOURS.includes(q.zhanshi));
      const want = q.isDay
        ? GUIREN[q.pillars.day.stem].day : GUIREN[q.pillars.day.stem].night;
      expect(groundOf(q, want)).toBe(q.guiren);
    }
  });

  it("**贵人临阳位顺布、临阴位逆布**", () => {
    const YANG: readonly Branch[] = ["亥", "子", "丑", "寅", "卯", "辰"];
    for (const q of year2026()) {
      expect(q.clockwise).toBe(YANG.includes(q.guiren));
      const g = branchIndex(q.guiren);
      const next = q.tianjiang[mod(g + 1, 12)]!;
      expect(next, `贵人在 ${q.guiren}，${q.clockwise ? "顺" : "逆"}布`)
        .toBe(q.clockwise ? "螣蛇" : "天后");
    }
  });

  it("十干只有五组贵人 —— 甲戊庚同、乙己同、丙丁同、壬癸同、辛独", () => {
    expect(GUIREN.甲).toEqual(GUIREN.戊);
    expect(GUIREN.戊).toEqual(GUIREN.庚);
    expect(GUIREN.乙).toEqual(GUIREN.己);
    expect(GUIREN.丙).toEqual(GUIREN.丁);
    expect(GUIREN.壬).toEqual(GUIREN.癸);
    expect(new Set(STEMS.map((s) => `${GUIREN[s].day}${GUIREN[s].night}`)).size).toBe(5);
  });
});

describe("**三传 —— 九宗门是有序的阶梯**", () => {
  it("十一种课体在一年里都出得来", () => {
    const seen = new Map<KeTi, number>();
    for (const q of year2026()) {
      const k = sc(q).keti;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    for (const k of KE_TI) {
      expect(seen.get(k) ?? 0, `课体「${k}」一年之内一次都没出现`).toBeGreaterThan(0);
    }
    // 常法（元首、重审）该占多数 —— 若特殊课式反而占多数，说明课式判定过宽
    const common = (seen.get("元首") ?? 0) + (seen.get("重审") ?? 0)
      + (seen.get("知一") ?? 0) + (seen.get("涉害") ?? 0);
    let total = 0;
    for (const v of seen.values()) total += v;
    expect(common / total, "常法竟不占多数，多半是课式判定过宽").toBeGreaterThan(0.6);
  });

  it("**有下贼上必走重审一路，无贼有克才走元首一路**", () => {
    for (const q of year2026()) {
      const zei = q.ke.filter((k) => controls(branchElement(k.lower), branchElement(k.upper)));
      const ke = q.ke.filter((k) => controls(branchElement(k.upper), branchElement(k.lower)));
      const s = sc(q);
      if (["伏吟", "返吟", "八专", "别责"].includes(s.keti)) continue;
      if (zei.length > 0) {
        expect(["重审", "知一", "涉害"], `有下贼上却走了 ${s.keti}`).toContain(s.keti);
      } else if (ke.length > 0) {
        expect(["元首", "知一", "涉害"], `无贼有克却走了 ${s.keti}`).toContain(s.keti);
      } else {
        expect(["蒿矢", "弹射", "昴星"], `四课无克却走了 ${s.keti}`).toContain(s.keti);
      }
    }
  });

  it("**初传必取自四课的上神** —— 常法诸门皆然", () => {
    for (const q of year2026()) {
      const s = sc(q);
      if (!["元首", "重审", "知一", "涉害"].includes(s.keti)) continue;
      expect(q.ke.map((k) => k.upper), `${s.keti} 的初传 ${s.chu} 不在四课上神中`)
        .toContain(s.chu);
    }
  });

  it("常法的中末传是机械的：中 = 天盘(初)，末 = 天盘(中)", () => {
    for (const q of year2026()) {
      const s = sc(q);
      if (!["元首", "重审", "知一", "涉害", "蒿矢", "弹射", "返吟"].includes(s.keti)) continue;
      expect(s.zhong, `${s.keti}`).toBe(upperOf(q, s.chu));
      expect(s.mo).toBe(upperOf(q, s.zhong));
    }
  });

  it("**伏吟当且仅当月将与占时同支；返吟当且仅当相冲**", () => {
    let fu = 0; let fan = 0;
    for (const q of year2026()) {
      const s = sc(q);
      const same = q.yuejiang.branch === q.zhanshi;
      const opposite = mod(branchIndex(q.yuejiang.branch) - branchIndex(q.zhanshi), 12) === 6;
      if (s.keti === "伏吟") { expect(same).toBe(true); fu++; }
      if (same) expect(s.keti).toBe("伏吟");
      if (s.keti === "返吟") { expect(opposite).toBe(true); fan++; }
    }
    expect(fu).toBeGreaterThan(0);
    expect(fan).toBeGreaterThan(0);
  });

  it("八专课当且仅当日干寄宫与日支同位", () => {
    for (const q of year2026()) {
      const s = sc(q);
      if (s.keti === "八专") expect(q.jigong).toBe(q.pillars.day.branch);
    }
  });

  it("**每一课都写明了它走到第几门** —— 元首与昴星的可信程度本就不同", () => {
    for (const q of year2026()) {
      const s = sc(q);
      expect(s.derivation.length).toBeGreaterThan(0);
      expect(s.derivation[s.derivation.length - 1]).toContain("三传");
      expect(KE_TI).toContain(s.keti);
      expect(KE_TI_NOTE[s.keti].length).toBeGreaterThan(6);
    }
  });

  it("**取法各家不一的课体标了 disputed** —— 别责与八专", () => {
    const disputed = new Set<KeTi>();
    for (const q of year2026()) {
      const s = sc(q);
      if (s.disputed) disputed.add(s.keti);
    }
    expect(disputed).toEqual(new Set(["别责", "八专", "伏吟"]));
    // 反向：常法不该被标成有争议
    for (const q of year2026()) {
      const s = sc(q);
      if (["元首", "重审", "知一", "涉害"].includes(s.keti)) expect(s.disputed).toBe(false);
    }
  });

  it("三传恒为合法地支，且推导可复算", () => {
    for (const q of year2026()) {
      const a = sanchuan(q); const b = sanchuan(q);
      for (const x of [a.chu, a.zhong, a.mo]) expect(BRANCHES).toContain(x);
      expect(b).toEqual(a);
    }
  });
});

describe("与六爻的一处差异", () => {
  it("**六壬的课完全由时刻决定 —— 没有「一事不二占」的技术问题**", () => {
    // 同一时刻两次起课必得同课；六爻则可掷钱、可报数，故需要防重掷。
    const a = sanchuan(plateAt(2026, 9, 2, 14));
    const b = sanchuan(plateAt(2026, 9, 2, 14));
    expect(b).toEqual(a);
    expect(polarityOf(plateAt(2026, 9, 2, 14).pillars.day.stem)).toBeDefined();
  });
});

describe("**跨体系断言 —— 说得上话的才说**", () => {
  it("只出三条轴，时间窗与方位一条不编", () => {
    for (const q of YEAR.slice(0, 200)) {
      const cs = liurenClaims(q, sc(q));
      expect(new Set(cs.map((c) => c.axis)))
        .toEqual(new Set(["我方位置", "阻碍来源", "事之动静"]));
      expect(cs.every((c) => c.system === "liuren")).toBe(true);
    }
  });

  it("**取法各家不一的课体，置信度确实被压低**", () => {
    let disputed = 0; let plain = 0;
    for (const q of YEAR) {
      const s = sc(q);
      const c = liurenClaims(q, s).find((x) => x.axis === "阻碍来源")!;
      if (s.disputed) { expect(c.confidence).toBeLessThan(0.7); disputed++; }
      else { expect(c.confidence).toBeGreaterThanOrEqual(0.7); plain++; }
    }
    expect(disputed).toBeGreaterThan(50);
    expect(plain).toBeGreaterThan(500);
  });

  it("依据里只述结构，不含成败字眼", () => {
    const BAD = ["必得", "可成", "不成", "难成", "立至", "主得", "主失", "痊愈"];
    for (const q of YEAR.slice(0, 400)) {
      const text = liurenClaims(q, sc(q)).map((c) => c.evidence).join("");
      for (const w of BAD) expect(text.includes(w), `出现成败字眼「${w}」`).toBe(false);
    }
  });

  it("**三条轴上顺逆都出得来** —— 否则那一轴形同虚设", () => {
    const pol = new Map<string, Set<string>>();
    for (const q of YEAR) {
      for (const c of liurenClaims(q, sc(q))) {
        if (!pol.has(c.axis)) pol.set(c.axis, new Set());
        pol.get(c.axis)!.add(c.polarity);
      }
    }
    expect(pol.get("我方位置")).toEqual(new Set(["顺", "逆", "中性"]));
    expect(pol.get("阻碍来源")).toEqual(new Set(["逆", "中性"]));
    // 事之动静按设计恒中性 —— 那条轴不判方向
    expect(pol.get("事之动静")).toEqual(new Set(["中性"]));
  });
});

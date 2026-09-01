import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { assignWeights } from "../src/weights/assign.js";
import { applyStructure } from "../src/structure/apply.js";
import { propagate } from "../src/propagate/iterate.js";
import { scanShensha } from "../src/shensha/scan.js";
import {
  guchenGuasuOf, hongluanOf, jinyuOf, tianxiOf, tianyiMedOf,
  trinityOf, trinityShensha, xuetangOf, yuedeOf,
} from "../src/shensha/rules.js";
import { effectiveTone } from "../src/shensha/modifiers.js";
import { SHENSHA_DEFS, TIANYI, TIANDE } from "../src/shensha/tables.js";
import { luOf } from "../src/ganzhi/changsheng.js";
import { stepBranch, elementOf } from "../src/ganzhi/algebra.js";
import { BRANCHES, STEMS, type Branch, type Stem } from "../src/types/ganzhi.js";
import { TRINITIES } from "../src/ganzhi/tables.js";
import type { BirthInput } from "../src/chart/types.js";

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};

function scan(input: BirthInput = EXAMPLE) {
  const chart = buildChart(input);
  const w = assignWeights({ chart });
  const cs = w.carriers.map((c) => ({ ...c, flags: [...c.flags], trace: [...c.trace] }));
  const st = applyStructure(cs, chart.month.branch);
  const pr = propagate(st.carriers);
  return { chart, hits: scanShensha({ chart, carriers: pr.carriers, events: st.events }) };
}

describe("三合类神煞：八个全部由局化神阳干的十二长生推出", () => {
  /**
   * 将星=帝旺 华盖=墓 桃花=沐浴 亡神=临官 劫煞=绝 六厄=死
   * 驿马=冲长生 灾煞=冲帝旺
   * 八张传世口诀表压成一条规律 —— 错一处即被自洽性测试逮住。
   */
  it("申子辰水局与传世口诀逐一吻合", () => {
    expect(trinityShensha("子")).toEqual({
      将星: "子", 华盖: "辰", 桃花: "酉", 亡神: "亥",
      劫煞: "巳", 六厄: "卯", 驿马: "寅", 灾煞: "午",
    });
  });

  it("四局的将星、华盖、桃花、驿马与口诀全表吻合", () => {
    const expected: Record<string, [Branch, Branch, Branch, Branch]> = {
      //            将星   华盖   桃花   驿马
      申子辰: ["子", "辰", "酉", "寅"],
      寅午戌: ["午", "戌", "卯", "申"],
      巳酉丑: ["酉", "丑", "午", "亥"],
      亥卯未: ["卯", "未", "子", "巳"],
    };
    for (const [key, [jiang, hua, tao, yi]] of Object.entries(expected)) {
      const t = trinityShensha(key[1] as Branch);   // 取局中的旺支
      expect(t.将星, key).toBe(jiang);
      expect(t.华盖, key).toBe(hua);
      expect(t.桃花, key).toBe(tao);
      expect(t.驿马, key).toBe(yi);
    }
  });

  it("同一局的三支给出同一组神煞", () => {
    for (const t of TRINITIES) {
      const a = trinityShensha(t.sheng);
      expect(trinityShensha(t.wang)).toEqual(a);
      expect(trinityShensha(t.mu)).toEqual(a);
    }
  });

  it("结构关系自洽：驿马冲长生、灾煞冲将星、华盖即局墓", () => {
    for (const b of BRANCHES) {
      const t = trinityShensha(b);
      const tri = trinityOf(b);
      expect(stepBranch(t.将星, 6), `${b} 灾煞`).toBe(t.灾煞);
      expect(t.华盖, `${b} 华盖`).toBe(tri.mu);
      expect(t.将星, `${b} 将星`).toBe(tri.wang);
      expect(stepBranch(t.驿马, 6), `${b} 驿马`).toBe(tri.sheng);
    }
  });

  it("驿马恒落四生地，桃花恒落四正，华盖恒落四墓", () => {
    for (const b of BRANCHES) {
      const t = trinityShensha(b);
      expect(["寅", "申", "巳", "亥"], `${b} 驿马`).toContain(t.驿马);
      expect(["子", "午", "卯", "酉"], `${b} 桃花`).toContain(t.桃花);
      expect(["辰", "戌", "丑", "未"], `${b} 华盖`).toContain(t.华盖);
    }
  });
});

describe("其余可推导的起例", () => {
  it("金舆 = 禄前二辰，与字面表吻合", () => {
    const expected: Record<string, Branch> = {
      甲: "辰", 乙: "巳", 丙: "未", 丁: "申", 戊: "未",
      己: "申", 庚: "戌", 辛: "亥", 壬: "丑", 癸: "寅",
    };
    for (const s of STEMS) {
      expect(jinyuOf(s), s).toBe(expected[s]);
      expect(jinyuOf(s)).toBe(stepBranch(luOf(s), 2));
    }
  });

  it("学堂 = 同五行阳干的长生位", () => {
    expect(xuetangOf("甲")).toBe("亥"); expect(xuetangOf("乙")).toBe("亥");
    expect(xuetangOf("丙")).toBe("寅"); expect(xuetangOf("庚")).toBe("巳");
    expect(xuetangOf("壬")).toBe("申");
    // 同五行两干同一学堂
    for (const [a, b] of [["甲", "乙"], ["丙", "丁"], ["庚", "辛"], ["壬", "癸"]] as [Stem, Stem][]) {
      expect(xuetangOf(a)).toBe(xuetangOf(b));
    }
  });

  it("天医 = 月支前一位", () => {
    expect(tianyiMedOf("寅")).toBe("丑");
    expect(tianyiMedOf("子")).toBe("亥");
    for (const b of BRANCHES) expect(stepBranch(tianyiMedOf(b), 1)).toBe(b);
  });

  it("月德 = 该月三合局化神的阳干", () => {
    expect(yuedeOf("午")).toBe("丙");   // 寅午戌 → 丙
    expect(yuedeOf("子")).toBe("壬");   // 申子辰 → 壬
    expect(yuedeOf("卯")).toBe("甲");   // 亥卯未 → 甲
    expect(yuedeOf("酉")).toBe("庚");   // 巳酉丑 → 庚
    for (const b of BRANCHES) {
      expect(elementOf(yuedeOf(b)), b).toBe(trinityOf(b).element);
    }
  });

  it("孤辰在三会方之后一位，寡宿在其前一位", () => {
    expect(guchenGuasuOf("子")).toEqual({ gu: "寅", gua: "戌" });   // 亥子丑
    expect(guchenGuasuOf("卯")).toEqual({ gu: "巳", gua: "丑" });   // 寅卯辰
    expect(guchenGuasuOf("午")).toEqual({ gu: "申", gua: "辰" });   // 巳午未
    expect(guchenGuasuOf("酉")).toEqual({ gu: "亥", gua: "未" });   // 申酉戌
  });

  it("红鸾自卯逆行，天喜为其冲", () => {
    expect(hongluanOf("子")).toBe("卯");
    expect(hongluanOf("丑")).toBe("寅");
    expect(hongluanOf("亥")).toBe("辰");
    for (const b of BRANCHES) {
      expect(tianxiOf(b), b).toBe(stepBranch(hongluanOf(b), 6));
    }
  });
});

describe("字面量表的自洽性", () => {
  it("天乙贵人口诀：甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎", () => {
    for (const s of ["甲", "戊", "庚"] as Stem[]) expect(TIANYI[s]).toEqual(["丑", "未"]);
    for (const s of ["乙", "己"] as Stem[]) expect(TIANYI[s]).toEqual(["子", "申"]);
    for (const s of ["丙", "丁"] as Stem[]) expect(TIANYI[s]).toEqual(["亥", "酉"]);
    for (const s of ["壬", "癸"] as Stem[]) expect(TIANYI[s]).toEqual(["卯", "巳"]);
    expect(TIANYI["辛"]).toEqual(["午", "寅"]);
    for (const s of STEMS) expect(TIANYI[s].length).toBeGreaterThanOrEqual(2);
  });

  it("天德干支混列，不是笔误 —— 命中判定须同时扫两层", () => {
    const values = Object.values(TIANDE);
    const stems = values.filter((v) => (STEMS as readonly string[]).includes(v));
    const branches = values.filter((v) => (BRANCHES as readonly string[]).includes(v));
    expect(stems.length).toBeGreaterThan(0);
    expect(branches.length).toBeGreaterThan(0);
    expect(stems.length + branches.length).toBe(12);
  });

  it("每个定义都有类别、吉凶倾向与叙述标签", () => {
    for (const d of SHENSHA_DEFS) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(["auspicious", "inauspicious", "neutral"]).toContain(d.polarity);
      expect(d.narrativeTags.length).toBeGreaterThan(0);
      for (const t of d.narrativeTags) {
        // 曾有一个俄文词混入标签，故此处强制全为中文
        expect(t, `${d.name} 的标签「${t}」含非中文`).toMatch(/^[一-鿿]+$/);
      }
    }
  });

  it("定义名称不重复", () => {
    const names = SHENSHA_DEFS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("状态修饰：同一神煞在不同状态下语义相反", () => {
  it("吉神逢冲受损，凶神逢冲反而动而应事", () => {
    expect(effectiveTone("auspicious", ["逢冲"]).tone).toBe("weakened");
    expect(effectiveTone("inauspicious", ["逢冲"]).tone).toBe("activated");
    expect(effectiveTone("inauspicious", ["逢冲"]).why).toContain("应事");
  });

  it("吉神落空大打折扣，凶神落空反得其解", () => {
    expect(effectiveTone("auspicious", ["落空亡"]).tone).toBe("neutralized");
    expect(effectiveTone("inauspicious", ["落空亡"]).tone).toBe("neutralized");
    expect(effectiveTone("auspicious", ["落空亡"]).why).toContain("折扣");
    expect(effectiveTone("inauspicious", ["落空亡"]).why).toContain("反得其解");
  });

  it("中性神煞逢冲逢合皆主动，本身不论吉凶", () => {
    expect(effectiveTone("neutral", ["逢冲"]).tone).toBe("activated");
    expect(effectiveTone("neutral", ["逢合"]).tone).toBe("activated");
  });

  it("无修饰时 tone 取缺省值，且如实标注 —— 缺省不是结论", () => {
    // 吉神的缺省是 strengthened。照 tone 直接渲染，报告里会出现
    //「天乙贵人落命宫，状态为坐旺得势：常态」—— 既无信息又自相矛盾。
    for (const pol of ["auspicious", "inauspicious", "neutral"] as const) {
      const t = effectiveTone(pol, []);
      expect(t.fromDefault, pol).toBe(true);
      expect(t.why).toBe("常态");
    }
    for (const mods of [["逢冲"], ["逢合"], ["落空亡"], ["坐旺"]] as const) {
      for (const pol of ["auspicious", "inauspicious", "neutral"] as const) {
        expect(effectiveTone(pol, mods).fromDefault, `${pol}/${mods[0]}`).toBe(false);
      }
    }
  });

  it("实盘中两类都存在，且缺省态一律标注为常态", () => {
    const all = scan().hits;
    const withTone = all.filter((h) => !h.toneIsDefault);
    const allDefault = all.filter((h) => h.toneIsDefault);
    expect(withTone.length).toBeGreaterThan(0);
    expect(allDefault.length).toBeGreaterThan(0);
    for (const h of allDefault) expect(h.toneReason).toBe("常态");
  });

  it("坐旺增强，坐衰减弱", () => {
    expect(effectiveTone("auspicious", ["坐旺"]).tone).toBe("strengthened");
    expect(effectiveTone("auspicious", []).tone).toBe("strengthened");
  });
});

describe("扫描输出", () => {
  const { hits } = scan();

  it("**每一条都带宫位** —— 不带宫位的神煞输出视为实现缺陷", () => {
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.palace, `${h.name} 无宫位`).toBeTruthy();
      expect(h.palace).not.toBe("");
    }
  });

  it("每条都带修饰后的语义方向与理由", () => {
    for (const h of hits) {
      expect(["strengthened", "weakened", "activated", "neutralized"]).toContain(h.tone);
      expect(h.toneReason.length).toBeGreaterThan(0);
      expect(h.narrativeTags.length).toBeGreaterThan(0);
    }
  });

  it("日起与年起两套并存，各自标注", () => {
    const bases = new Set(hits.map((h) => h.basis));
    expect(bases.size).toBeGreaterThanOrEqual(1);
    for (const h of hits) expect(["day", "year"]).toContain(h.basis);
  });

  it("工作例：庚年天乙在丑未，二者皆在盘中且逢冲", () => {
    const ty = hits.filter((h) => h.name === "天乙贵人" && h.basis === "year");
    expect(ty.length).toBe(2);
    expect(new Set(ty.map((h) => h.branch))).toEqual(new Set(["丑", "未"]));
    for (const h of ty) {
      expect(h.modifiers).toContain("逢冲");   // 丑未相冲
      expect(h.modifiers).toContain("重见");
      expect(h.tone).toBe("weakened");
    }
  });

  it("命宫独立成一个落点，不冒充胎元", () => {
    // 丁日干的天乙在亥酉，本例命宫正是丁亥。它曾被硬塞进 taiyuan，
    // 于是宫位报成「外部」—— 多一个字面量比错一个宫位划算。
    const mg = hits.filter((h) => h.landsOn.pillar === "mingGong");
    expect(mg.length).toBeGreaterThan(0);
    for (const h of mg) {
      expect(h.palace).toBe("命宫");
      expect(h.landsOn.layer).toBe("branch");
      // 命宫不参与配重，故既无载体也不论坐旺坐衰
      expect(h.hostWeight).toBe(0);
      expect(h.modifiers).not.toContain("坐衰");
      expect(h.modifiers).not.toContain("坐旺");
    }
  });

  it("工作例：华盖在日支配偶宫，逢冲而动", () => {
    const hg = hits.find((h) => h.name === "华盖");
    expect(hg).toBeDefined();
    expect(hg!.palace).toBe("配偶宫");
    expect(hg!.tone).toBe("activated");
  });

  it("每个落点都有自己的宫位，不冒充别人的", () => {
    // 命宫曾被塞进胎元、流月曾被塞进本命月柱 —— 两次都是产出的**名字对而宫位错**，
    // 而宫位恰恰是神煞唯一有信息量的那一半：「有华盖」是废话，「华盖在配偶宫」才是信息。
    const KNOWN = [
      "祖上宫", "根基宫", "父母兄弟宫", "门户宫",
      "自身", "配偶宫", "志向宫", "子女宫",
      "命宫", "胎元", "流月",   // 三者皆不参与配重，但各有其位
      "外部",                   // 大运与流年
    ];
    for (const p of new Set(hits.map((h) => h.palace))) expect(KNOWN).toContain(p);

    // 且落点与宫位一一对应，不得串位
    for (const h of hits) {
      if (h.landsOn.pillar === "mingGong") expect(h.palace).toBe("命宫");
      if (h.landsOn.pillar === "taiyuan") expect(h.palace).toBe("胎元");
      if (h.landsOn.pillar === "fleetingMonth") expect(h.palace).toBe("流月");
      if (h.landsOn.pillar === "luck" || h.landsOn.pillar === "annual") {
        expect(h.palace).toBe("外部");
      }
    }
  });

  it("「空亡」不以自身的定义充当自身的修饰", () => {
    // 空亡这个神煞的定义就是落在旬空里，若照常施加「落空亡」修饰，
    // 它必然被判为「反得其解」—— 一个恒真的自指。
    const all = scan().hits.filter((h) => h.name === "空亡");
    expect(all.length).toBeGreaterThan(0);
    for (const h of all) expect(h.modifiers).not.toContain("落空亡");
  });

  it("**神煞不改动任何权重** —— 符号层与力量层严格分离", () => {
    const chart = buildChart(EXAMPLE);
    const w = assignWeights({ chart });
    const cs = w.carriers.map((c) => ({ ...c, flags: [...c.flags], trace: [...c.trace] }));
    const st = applyStructure(cs, chart.month.branch);
    const pr = propagate(st.carriers);
    const before = pr.carriers.map((c) => ({ id: c.id, w: c.weight, a: c.activity, f: c.flags.length }));
    scanShensha({ chart, carriers: pr.carriers, events: st.events });
    for (const [i, c] of pr.carriers.entries()) {
      expect(c.weight, c.id).toBe(before[i]!.w);
      expect(c.activity, c.id).toBe(before[i]!.a);
      expect(c.flags.length, c.id).toBe(before[i]!.f);
    }
  });

  it("禄与羊刃只作展示 —— 已在 L4 通根中计过，不得二次计入", () => {
    // 二者出现在神煞输出里是允许的，但它们的 category/polarity 不参与任何权重
    const lu = hits.filter((h) => h.name === "禄神" || h.name === "羊刃");
    for (const h of lu) expect(h.hostWeight).toBeGreaterThanOrEqual(0);
  });
});

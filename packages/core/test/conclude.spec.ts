import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { assignWeights } from "../src/weights/assign.js";
import { applyStructure } from "../src/structure/apply.js";
import { propagate } from "../src/propagate/iterate.js";
import { conclude } from "../src/conclude/conclude.js";
import { bandOf, confidenceOf, BAND_LABEL } from "../src/conclude/strength.js";
import { godGroupElement } from "../src/conclude/specialPattern.js";
import { tenGodOf, GOD_GROUPS, sumGods } from "../src/conclude/tenGods.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { loadParams } from "../src/params/load.js";
import { STEMS, TEN_GODS, ELEMENTS } from "../src/types/ganzhi.js";
import { elementOf, polarityOf, tenGod as algebraTenGod } from "../src/ganzhi/algebra.js";
import { rootKindOf } from "../src/ganzhi/changsheng.js";
import type { BirthInput } from "../src/chart/types.js";
import type { Conclusions } from "../src/conclude/types.js";

const CP = DEFAULT_PARAMS.conclusion;

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const WINTER: BirthInput = {
  year: 1991, month: 12, day: 20, hour: 2, minute: 0,
  gender: "female", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const AUTUMN: BirthInput = {
  year: 1980, month: 9, day: 20, hour: 18, minute: 0,
  gender: "female", timeZone: "Asia/Shanghai", longitude: 121.47,
};

function run(input: BirthInput, params = DEFAULT_PARAMS): Conclusions {
  const chart = buildChart(input);
  const w = assignWeights({ chart, params });
  const cs = w.carriers.map((c) => ({ ...c, flags: [...c.flags], trace: [...c.trace] }));
  const st = applyStructure(cs, chart.month.branch, params);
  const pr = propagate(st.carriers, params.propagation);
  return conclude({
    carriers: pr.carriers, monthBranch: chart.month.branch,
    gender: input.gender, vitality: pr.vitality, flows: pr.flows, params,
  });
}

describe("十神：按当前五行算，不按原天干", () => {
  it("与 ganzhi 层的十神映射一致（未合化时）", () => {
    for (const dm of STEMS) for (const s of STEMS) {
      expect(tenGodOf(elementOf(dm), polarityOf(dm), elementOf(s), polarityOf(s)))
        .toBe(algebraTenGod(dm, s));
    }
  });

  it("合化改写 element 后，十神随之改变 —— 化气之后论化神", () => {
    // 乙木对丁火本为偏印；若被乙庚合化为金，则成偏财
    expect(tenGodOf("火", "阴", "木", "阴")).toBe("偏印");
    expect(tenGodOf("火", "阴", "金", "阴")).toBe("偏财");
  });

  it("日主自身单列，不计入比肩", () => {
    const c = run(EXAMPLE);
    // 同党 = 日主 + 比劫 + 印
    const recomputed = c.dayMaster.weight
      + sumGods(c.tenGods, GOD_GROUPS.比劫) + sumGods(c.tenGods, GOD_GROUPS.印星);
    expect(c.party.supporting).toBeCloseTo(recomputed, 6);
    expect(c.dayMaster.weight).toBeGreaterThan(0);
  });

  it("同党 + 异党 == 全部载体权重", () => {
    const c = run(EXAMPLE);
    const all = TEN_GODS.reduce((a, g) => a + c.tenGods[g], 0) + c.dayMaster.weight;
    expect(c.party.supporting + c.party.opposing).toBeCloseTo(all, 6);
  });

  it("r ∈ [0,1]", () => {
    for (const i of [EXAMPLE, WINTER, AUTUMN]) {
      const c = run(i);
      expect(c.party.ratio).toBeGreaterThanOrEqual(0);
      expect(c.party.ratio).toBeLessThanOrEqual(1);
    }
  });
});

describe("十神组的五行推导 —— 用查表，不用模运算", () => {
  it("四组各自正确", () => {
    // 曾把「克我者」写成 (idx+4)%5，对木给出水 —— 那是生我者。故逐一钉死。
    expect(godGroupElement("木", "食伤")).toBe("火");
    expect(godGroupElement("木", "财")).toBe("土");
    expect(godGroupElement("木", "官杀")).toBe("金");
    expect(godGroupElement("木", "印")).toBe("水");
  });

  it("五行皆自洽：官杀者克我，印者生我", () => {
    for (const dm of ELEMENTS) {
      expect(godGroupElement(godGroupElement(dm, "官杀"), "财")).toBe(dm);   // 克我者以我为财
      expect(godGroupElement(godGroupElement(dm, "印"), "食伤")).toBe(dm);    // 生我者以我为食伤
    }
  });
});

describe("旺衰与置信度", () => {
  it("五档按阈值分界", () => {
    expect(bandOf(0.80, CP)).toBe("VERY_STRONG");
    expect(bandOf(0.60, CP)).toBe("STRONG");
    expect(bandOf(0.50, CP)).toBe("BALANCED");
    expect(bandOf(0.40, CP)).toBe("WEAK");
    expect(bandOf(0.20, CP)).toBe("VERY_WEAK");
  });

  it("距阈值越远置信度越高，触底为 floor", () => {
    expect(confidenceOf(0.50, CP)).toBeCloseTo(1, 9);   // 距 0.45/0.55 各 0.05
    expect(confidenceOf(0.451, CP)).toBe(CP.confidence.floor);
    expect(confidenceOf(0.4496, CP)).toBe(CP.confidence.floor);
  });

  it("**临界盘必须给出替代判定** —— 不强行归类", () => {
    const c = run(EXAMPLE);
    // 工作例的 r 恰在 0.45 阈值附近
    expect(Math.abs(c.party.ratio - CP.strengthBands.balancedLow)).toBeLessThan(0.01);
    expect(c.strength.confidence).toBe(CP.confidence.floor);
    expect(c.strength.alternatives.length).toBeGreaterThan(0);
    expect(c.strength.alternatives[0]!.reason).toContain("临界");
    // 替代判定应是相邻的一档
    const bands = ["VERY_WEAK", "WEAK", "BALANCED", "STRONG", "VERY_STRONG"];
    const d = Math.abs(bands.indexOf(c.strength.value) - bands.indexOf(c.strength.alternatives[0]!.value));
    expect(d).toBe(1);
  });

  it("置信度高时不强加替代", () => {
    const c = run(AUTUMN);
    expect(c.strength.confidence).toBeGreaterThan(0.9);
    expect(c.strength.alternatives).toHaveLength(0);
  });

  it("推导链完整可回溯", () => {
    const c = run(EXAMPLE);
    const steps = c.strength.derivation.map((d) => d.step);
    expect(steps).toEqual(["党势", "比值", "分档", "置信"]);
    for (const d of c.strength.derivation) expect(d.detail.length).toBeGreaterThan(0);
  });

  it("阈值须严格递减，否则参数校验拦下", () => {
    expect(() => loadParams({ conclusion: { strengthBands: { strong: 0.9 } } }))
      .toThrow(/strengthBands 须严格递减/);
  });
});

describe("通根", () => {
  it("工作例：丁火得禄于午、得帝旺于巳、通余气于未", () => {
    const c = run(EXAMPLE);
    const byBranch = new Map(c.rootDetail.map((d) => [d.branch, d.kind]));
    expect(byBranch.get("午")).toBe("luRen");   // 丁禄在午
    expect(byBranch.get("巳")).toBe("luRen");   // 丁帝旺在巳
    expect(byBranch.get("未")).toBe("yuqi");    // 未藏丁
    expect(c.rootScore).toBeGreaterThan(0.5);
  });

  it("无同五行藏干的支不计根", () => {
    const c = run(EXAMPLE);
    expect(c.rootDetail.some((d) => d.branch === "丑")).toBe(false);   // 丑藏己癸辛，无火
  });

  it("从格候选者无根", () => {
    const c = run(AUTUMN);
    expect(c.rootScore).toBe(0);
  });

  it("⚠️ 流派开关改变根的**等级**，但不必然改变某一盘的总分", () => {
    // 丁火在午/巳/未三支下，两派恰好给出相同等级（午：临官↔帝旺，皆作 luRen），
    // 故工作例的总分不变。这不是开关失效 —— 直接查长生表才看得出分叉。
    const yy = { school: "yangForwardYinReverse" } as const;
    const sd = { school: "sameBirthDeath" } as const;

    // 乙木在亥：阳顺阴逆下亥为「死」，只作余气根；同生同死下亥为「长生」
    expect(rootKindOf("乙", "亥", yy)).toBe("yuqi");
    expect(rootKindOf("乙", "亥", sd)).toBe("changsheng");
    // 丁火在午：两派一为临官、一为帝旺，皆归 luRen —— 故等级不变
    expect(rootKindOf("丁", "午", yy)).toBe("luRen");
    expect(rootKindOf("丁", "午", sd)).toBe("luRen");

    const std = run(EXAMPLE);
    const alt = run(EXAMPLE, loadParams({ conclusion: { changshengSchool: "sameBirthDeath" } }));
    expect(alt.schoolsUsed.changshengSchool).toBe("sameBirthDeath");
    expect(alt.rootScore).toBeCloseTo(std.rootScore, 6);   // 此盘恰好不变
  });

  it("土的长生流派改变戊己的根", () => {
    // 火土同宫：戊长生寅、墓戌；水土同宫：戊长生申、墓辰
    const fe = { earth: "fireEarthSame" } as const;
    const we = { earth: "waterEarthSame" } as const;
    expect(rootKindOf("戊", "寅", fe)).toBe("changsheng");
    expect(rootKindOf("戊", "寅", we)).not.toBe("changsheng");
    expect(rootKindOf("戊", "申", we)).toBe("changsheng");

    const a = run(EXAMPLE, loadParams({ conclusion: { earthChangsheng: "waterEarthSame" } }));
    expect(a.schoolsUsed.earthChangsheng).toBe("waterEarthSame");
  });
});

describe("特殊格局", () => {
  it("秋生金旺、丙火无根 → 从财格", () => {
    const c = run(AUTUMN);
    expect(c.specialPattern.value).not.toBeNull();
    expect(c.specialPattern.value!.kind).toBe("congge");
    expect((c.specialPattern.value as { subtype: string }).subtype).toContain("从");
    expect(c.specialPattern.value!.element).toBe("金");
  });

  it("有根则绝不判从格（不变量）", () => {
    for (const i of [EXAMPLE, WINTER]) {
      const c = run(i);
      if (c.rootScore > 0) {
        expect(c.specialPattern.value?.kind).not.toBe("congge");
      }
    }
  });

  it("从格与专旺格互斥", () => {
    for (const i of [EXAMPLE, WINTER, AUTUMN]) {
      const v = run(i).specialPattern.value;
      if (v === null) continue;
      expect(["congge", "zhuanwang", "huaqi"]).toContain(v.kind);
    }
  });

  it("未命中时给出未命中的理由", () => {
    const c = run(EXAMPLE);
    expect(c.specialPattern.value).toBeNull();
    const detail = c.specialPattern.derivation.map((d) => d.detail).join(" ");
    expect(detail).toContain("未命中");
  });

  it("化气格置信度封顶 —— 实务争议大", () => {
    expect(CP.specialGe.huaqiConfidenceCap).toBeLessThanOrEqual(0.7);
  });
});

describe("用神", () => {
  it("冬生火弱 → 调候取火，且标为无力（须待大运）", () => {
    const c = run(WINTER);
    expect(c.yongshen.value.method).toBe("tiaohou");
    expect(c.yongshen.value.primary).toBe("火");
    expect(c.yongshen.value.needsLuckSupport).toBe(true);
    expect(c.yongshen.value.tiaohouSource).toBe("heuristic");
  });

  it("**调候来源如实标注** —— 不冒充完整调候表", () => {
    const c = run(WINTER);
    expect(c.schoolsUsed.tiaohouSource).toBe("heuristic");
    const d = c.yongshen.derivation.map((x) => x.detail).join(" ");
    expect(d).toContain("《穷通宝鉴》");
    expect(d).toContain("尚未转录");
  });

  it("**调候与扶抑方向相反时并列，不藏起来**", () => {
    // 工作例：判身弱，而调候取水（克身之火的克者）—— 两条路相反
    const c = run(EXAMPLE);
    expect(c.yongshen.value.method).toBe("tiaohou");
    expect(["WEAK", "VERY_WEAK"]).toContain(c.strength.value);
    expect(c.yongshen.alternatives.length).toBeGreaterThan(0);
    expect(c.yongshen.alternatives[0]!.reason).toContain("方向相反");
    expect(c.yongshen.confidence).toBeLessThan(0.5);
  });

  it("从格顺其势 —— 用神即所从之神", () => {
    const c = run(AUTUMN);
    expect(c.yongshen.value.primary).toBe("金");
    expect(c.specialPattern.value!.element).toBe("金");
  });

  it("喜忌仇闲五组不重不漏覆盖五行", () => {
    for (const i of [EXAMPLE, WINTER, AUTUMN]) {
      const y = run(i).yongshen.value;
      const all = [y.primary, ...y.xishen, ...y.jishen, ...y.choushen, ...y.xianshen];
      expect(new Set(all).size, `${JSON.stringify(i)} 有重复或遗漏`).toBe(5);
      expect(new Set(all)).toEqual(new Set(ELEMENTS));
    }
  });

  it("用神无力的阈值来自参数", () => {
    const c = run(WINTER);
    expect(c.yongshen.value.strength < CP.yongshen.weakYongshenThreshold)
      .toBe(c.yongshen.value.needsLuckSupport);
  });
});

describe("月令格局", () => {
  it("工作例：巳月中气庚透于年干 → 正财格", () => {
    const c = run(EXAMPLE);
    expect(c.geju.value.name).toBe("正财格");
    expect(c.geju.value.source).toBe("zhongqiRevealed");
    expect(c.geju.value.isAuspicious).toBe(true);
    expect(c.geju.value.usage).toBe("顺用");
  });

  it("不透则取本气，置信度较低", () => {
    const c = run(WINTER);
    expect(c.geju.value.source).toBe("notRevealed");
    expect(c.geju.confidence).toBeLessThan(0.8);
  });

  it("四吉神顺用、四凶神逆用", () => {
    for (const i of [EXAMPLE, WINTER, AUTUMN]) {
      const g = run(i).geju.value;
      expect(g.usage).toBe(g.isAuspicious ? "顺用" : "逆用");
      expect(g.xiangshen.length).toBeGreaterThan(0);
      expect(g.breakers.length).toBeGreaterThan(0);
    }
  });

  it("**格局与用神是两条独立判定线，允许不一致**", () => {
    // 从财格的盘，月令格局仍按常规取 —— 二者并列，不强行统一
    const c = run(AUTUMN);
    expect(c.specialPattern.value!.kind).toBe("congge");
    expect(c.geju.value.name).toBeTruthy();   // 格局照常输出
  });
});

describe("宫位六亲 —— 宫星同参", () => {
  it("五项六亲齐全，各带星与宫", () => {
    const c = run(EXAMPLE);
    expect(c.kin).toHaveLength(5);
    expect(c.kin.map((k) => k.kin)).toEqual(
      ["father", "mother", "spouse", "siblings", "children"]);
    for (const k of c.kin) {
      expect(TEN_GODS).toContain(k.starGod);
      expect(k.palaceLabel.length).toBeGreaterThan(0);
      expect(["both-favorable", "palace-only", "star-only", "neither"]).toContain(k.quadrant);
    }
  });

  it("男命配偶星为正财，女命为正官", () => {
    expect(run(EXAMPLE).kin.find((k) => k.kin === "spouse")!.starGod).toBe("正财");
    expect(run(WINTER).kin.find((k) => k.kin === "spouse")!.starGod).toBe("正官");
  });

  it("配偶宫恒为日支", () => {
    const s = run(EXAMPLE).kin.find((k) => k.kin === "spouse")!;
    expect(s.palace).toEqual({ pillar: "day", layer: "branch" });
  });

  it("女命子女星的流派开关生效", () => {
    const std = run(WINTER).kin.find((k) => k.kin === "children")!;
    const rev = run(WINTER, loadParams({ conclusion: { femaleChildStarVariant: "reversed" } }))
      .kin.find((k) => k.kin === "children")!;
    expect(std.starGod).toBe("食神");
    expect(rev.starGod).toBe("伤官");
  });

  it("星或宫为零时置信度降低", () => {
    for (const i of [EXAMPLE, WINTER, AUTUMN]) {
      for (const k of run(i).kin) {
        if (k.starWeight === 0 || k.palaceWeight === 0) {
          expect(k.confidence, `${k.label}`).toBeLessThanOrEqual(0.4);
        }
      }
    }
  });
});

describe("流通指标", () => {
  it("三项均在合理区间", () => {
    for (const i of [EXAMPLE, WINTER, AUTUMN]) {
      const m = run(i).metrics;
      expect(m.vitality).toBeGreaterThan(0);
      expect(m.vitality).toBeLessThanOrEqual(1);
      expect(m.circulation).toBeGreaterThanOrEqual(0);
      expect(m.circulation).toBeLessThanOrEqual(1);
      expect(m.evenness).toBeGreaterThanOrEqual(0);
      expect(m.evenness).toBeLessThanOrEqual(1);
    }
  });

  it("五行越集中，evenness 越低", () => {
    const even = run(WINTER).metrics.evenness;      // 均衡 0.849
    const skewed = run(AUTUMN).metrics.evenness;    // 金旺 0.634
    expect(skewed).toBeLessThan(even);
  });
});

describe("L4 不变量", () => {
  const cs = [EXAMPLE, WINTER, AUTUMN].map((i) => run(i));

  it("① 同党 + 异党 == 全部载体权重", () => {
    for (const c of cs) {
      const all = TEN_GODS.reduce((a, g) => a + c.tenGods[g], 0) + c.dayMaster.weight;
      expect(Math.abs(c.party.supporting + c.party.opposing - all)).toBeLessThan(1e-6);
    }
  });

  it("② r ∈ [0,1]", () => {
    for (const c of cs) {
      expect(c.party.ratio).toBeGreaterThanOrEqual(0);
      expect(c.party.ratio).toBeLessThanOrEqual(1);
    }
  });

  it("③ 从格与专旺格互斥 —— 由阈值区间保证，不可能同时成立", () => {
    // 原先写的是 `v.kind === "congge" && v.kind === "zhuanwang"`，恒为 false，
    // 是个什么也没测的同义反复（TS 直接指出了两个字面量类型无交集）。
    // 真正的依据是两者的 r 区间不相交：从格要 r < 0.30，专旺要 r ≥ 0.78。
    expect(CP.congge.ratioThreshold).toBeLessThan(CP.specialGe.zhuanwangThreshold);
    for (const c of cs) {
      const v = c.specialPattern.value;
      if (v?.kind === "congge") expect(c.party.ratio).toBeLessThan(CP.congge.ratioThreshold);
      if (v?.kind === "zhuanwang") expect(c.party.ratio).toBeGreaterThanOrEqual(CP.specialGe.zhuanwangThreshold);
    }
  });

  it("④ 有根则不判从格", () => {
    for (const c of cs) {
      if (c.rootScore > 0) expect(c.specialPattern.value?.kind).not.toBe("congge");
    }
  });

  it("⑤ 每个 Verdict 的 derivation 非空", () => {
    for (const c of cs) {
      for (const [name, v] of [["strength", c.strength], ["specialPattern", c.specialPattern],
        ["yongshen", c.yongshen], ["geju", c.geju]] as const) {
        expect(v.derivation.length, `${name} 无推导链`).toBeGreaterThan(0);
      }
    }
  });

  it("⑥ **confidence < 0.5 时 alternatives 必须非空**", () => {
    for (const c of cs) {
      for (const [name, v] of [["strength", c.strength], ["yongshen", c.yongshen]] as const) {
        if (v.confidence < 0.5) {
          expect(v.alternatives.length, `${name} 置信 ${v.confidence} 却无替代解读`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("⑦ 流派开关随盘声明 —— 结论会因它们分叉", () => {
    for (const c of cs) {
      expect(c.schoolsUsed.changshengSchool).toBeTruthy();
      expect(c.schoolsUsed.earthChangsheng).toBeTruthy();
      expect(c.schoolsUsed.tiaohouSource).toBeTruthy();
      expect(c.schoolsUsed.femaleChildStarVariant).toBeTruthy();
    }
  });

  it("旺衰标签齐全", () => {
    for (const b of ["VERY_STRONG", "STRONG", "BALANCED", "WEAK", "VERY_WEAK"] as const) {
      expect(BAND_LABEL[b].length).toBeGreaterThan(0);
    }
  });
});

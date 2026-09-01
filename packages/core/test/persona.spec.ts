import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildReport } from "../src/report/assemble.js";
import { GOD_TRAITS, ELEMENT_TRAITS, allTraitWords } from "../src/conclude/traits.js";
import { GOD_GROUPS } from "../src/conclude/tenGods.js";
import { scanText, formatViolations } from "../src/report/guard.js";
import { loadParams, ParamsValidationError } from "../src/params/load.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { ELEMENTS, TEN_GODS } from "../src/types/ganzhi.js";
import type { BirthInput } from "../src/chart/types.js";

const SAMPLES: readonly BirthInput[] = [
  { year: 1990, month: 5, day: 12, hour: 14, minute: 30, gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47 },
  { year: 1968, month: 1, day: 9, hour: 5, minute: 5, gender: "female", timeZone: "Asia/Shanghai", longitude: 113.3 },
  { year: 1984, month: 11, day: 2, hour: 12, minute: 0, gender: "female", timeZone: "Asia/Taipei", longitude: 121.5 },
  { year: 2001, month: 3, day: 21, hour: 18, minute: 15, gender: "male", timeZone: "Asia/Shanghai", longitude: 104.1 },
  { year: 1958, month: 5, day: 5, hour: 0, minute: 0, gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47, unknownHour: true },
];
const bases = SAMPLES.map((s) => buildBaseChart(buildChart(s)));

describe("特质表：用词的纪律", () => {
  it("十神表四栏齐全，且四栏互不相同", () => {
    // 同一个十神旺弱表述相反：食神适中为温和从容、太过则疏懒无争。
    // 只给一栏，强弱两端会说同样的话，那张表就废了。
    for (const g of TEN_GODS) {
      const t = GOD_TRAITS[g];
      for (const col of ["inner", "outer", "excess", "deficient"] as const) {
        expect(t[col].length, `${g}.${col}`).toBeGreaterThan(0);
      }
      const cols = [t.inner, t.outer, t.excess, t.deficient].map((c) => c.join("|"));
      expect(new Set(cols).size, `${g} 有两栏内容完全相同`).toBe(4);
      // 过旺与过弱必须真的相反 —— 不得共用任何一个词
      const overlap = t.excess.filter((w) => t.deficient.includes(w));
      expect(overlap, `${g} 的过旺与过弱共用了词：${overlap.join("、")}`).toEqual([]);
    }
  });

  it("五行表覆盖五行，各带五常与强弱两栏", () => {
    for (const e of ELEMENTS) {
      const t = ELEMENT_TRAITS[e];
      expect(t.virtue).toHaveLength(1);
      expect(t.strong.length).toBeGreaterThan(0);
      expect(t.weak.length).toBeGreaterThan(0);
    }
    expect(new Set(ELEMENTS.map((e) => ELEMENT_TRAITS[e].virtue)).size).toBe(5);
  });

  it("**特质词全为中文，且不用心理学量表词汇**", () => {
    // 混用会制造虚假的科学感 —— 读者会以为这些词背后有心理测量学的效度。
    const BANNED = ["外向", "内向", "宜人", "神经质", "开放性", "尽责", "人格特质", "评分", "指数"];
    for (const w of allTraitWords()) {
      expect(w, `「${w}」含非中文`).toMatch(/^[一-鿿]+$/);
      for (const b of BANNED) {
        expect(w.includes(b), `「${w}」用了量表词汇「${b}」`).toBe(false);
      }
    }
  });

  it("特质词全部通过措辞扫描", () => {
    const vs = allTraitWords().flatMap((w) => scanText(w, "trait", { kind: "vocabulary" }));
    expect(formatViolations(vs)).toBe("措辞扫描通过。");
  });
});

describe("内外分布：透干为显，藏支为隐", () => {
  it("两侧各自归一化，和恒为 1（或全零）", () => {
    for (const [i, b] of bases.entries()) {
      for (const side of ["inner", "outer"] as const) {
        const sum = TEN_GODS.reduce((a, g) => a + b.persona[side][g], 0);
        expect(sum, `样本 ${i} 的${side}`).toBeCloseTo(1, 9);
      }
    }
  });

  it("日主自身不计入任一侧 —— 与 L4 的十神向量同一条规矩", () => {
    for (const b of bases) {
      const dmWeight = b.conclusions.dayMaster.weight;
      const outerRaw = b.persona.outerTotal;
      const stemTotal = b.carriers
        .filter((c) => c.position.layer === "stem")
        .reduce((a, c) => a + c.weight, 0);
      // 天干层总量 − 日主 = 外在总量
      expect(outerRaw).toBeCloseTo(stemTotal - dmWeight, 6);
    }
  });

  it("内 = 藏干、外 = 天干，二者合起来是全盘（除日主）", () => {
    for (const b of bases) {
      const all = b.carriers.filter((c) => !c.flags.includes("DAY_MASTER"))
        .reduce((a, c) => a + c.weight, 0);
      expect(b.persona.innerTotal + b.persona.outerTotal).toBeCloseTo(all, 6);
    }
  });

  it("**内外张力按五组算，不按十档** —— 十档会顶格", () => {
    // 外在只有三个天干，与八九个藏干的分布本就难重叠：
    // 实测十档下中位数 0.737、5.1% 恰为 1.000，那量的是「外在档位少」。
    for (const b of bases) {
      const P = b.persona;
      expect(P.innerOuterTension).toBeGreaterThanOrEqual(0);
      expect(P.innerOuterTension).toBeLessThanOrEqual(1 + 1e-9);
      // 聚合只会让差异变小，绝不会变大
      expect(P.innerOuterTension).toBeLessThanOrEqual(P.innerOuterTensionByGod + 1e-9);
    }
  });

  it("张力与分歧组同进同出 —— 只报一个 T 值是没有信息的", () => {
    for (const b of bases) {
      expect(b.persona.divergentGroups.length).toBeGreaterThan(0);
      const groups = Object.keys(GOD_GROUPS);
      for (const d of b.persona.divergentGroups) expect(groups).toContain(d.group);
      // 按 |delta| 降序
      const deltas = b.persona.divergentGroups.map((d) => Math.abs(d.delta));
      expect([...deltas].sort((x, y) => y - x)).toEqual(deltas);
    }
  });
});

describe("主导十神：并列与置信度由构造对齐", () => {
  it("差距小于门槛即并列，且置信度必定低于 0.60", () => {
    // 置信度 = 0.45 + 0.15 × gap / dominantMargin，
    // gap = margin 时恰得 0.60，即模板的 confidenceFloor。
    // 于是「判为并列」与「改用留有余地的措辞」永远同进同出。
    for (const b of bases) {
      for (const v of [b.persona.dominantInner, b.persona.dominantOuter]) {
        if (v.value.length > 1) expect(v.confidence).toBeLessThan(0.6);
        else expect(v.confidence).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it("换一个 dominantMargin，对齐关系依然成立", () => {
    for (const margin of [0.02, 0.05, 0.12, 0.3]) {
      const p = loadParams({ persona: { dominantMargin: margin } });
      for (const s of SAMPLES) {
        const v = buildBaseChart(buildChart(s), p).persona.dominantOuter;
        if (v.value.length > 1) expect(v.confidence, `margin=${margin}`).toBeLessThan(0.6);
        else expect(v.confidence, `margin=${margin}`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });

  it("推导链完整，并列时不再重复列 alternatives", () => {
    for (const b of bases) {
      const v = b.persona.dominantOuter;
      expect(v.derivation.length).toBe(2);
      if (v.value.length > 1) expect(v.alternatives).toHaveLength(0);
    }
  });
});

describe("真缺与过弱是两回事", () => {
  it("真缺者占比恰为零；过弱者大于零", () => {
    for (const b of bases) {
      const P = b.persona;
      for (const g of P.absent) {
        expect(P.inner[g] + P.outer[g], `${g} 被判真缺却有权重`).toBe(0);
      }
      for (const g of P.deficient) {
        expect(P.inner[g] + P.outer[g], `${g} 被判过弱却为零`).toBeGreaterThan(0);
      }
      expect(P.absent.filter((g) => P.deficient.includes(g))).toEqual([]);
    }
  });

  it("过旺与过弱不可能是同一个十神 —— 由参数校验保证", () => {
    expect(() => loadParams({ persona: { excessShare: 0.04 } }))
      .toThrow(ParamsValidationError);
    for (const b of bases) {
      expect(b.persona.excess.filter((g) => b.persona.deficient.includes(g))).toEqual([]);
    }
  });
});

describe("五行剖面", () => {
  it("偏枯度取自 metrics.evenness 的补 —— 单一来源，不另算一遍熵", () => {
    for (const b of bases) {
      expect(b.persona.elements.skew).toBeCloseTo(1 - b.conclusions.metrics.evenness, 12);
    }
  });

  it("受克最重者与占比最弱者允许不同 —— 前者被打，后者本来就少", () => {
    const differ = bases.filter(
      (b) => b.persona.elements.mostAttacked !== b.persona.elements.weakest);
    expect(differ.length, "样本里没有一张盘二者不同，该断言在空转").toBeGreaterThan(0);
  });

  it("最旺者占比不小于最弱者", () => {
    for (const b of bases) {
      const E = b.persona.elements;
      expect(E.share[E.strongest]).toBeGreaterThanOrEqual(E.share[E.weakest]);
    }
  });
});

describe("宫位状态", () => {
  it("自身宫标为日主，且其十神构成为空", () => {
    for (const b of bases) {
      const self = b.persona.palaces.find((x) => x.palace === "自身")!;
      expect(self.isDayMaster).toBe(true);
      // 日主是参照点，不是自己的比肩 —— 破了这条，自身宫会凭空多一个比肩
      expect(TEN_GODS.reduce((a, g) => a + self.gods[g], 0)).toBe(0);
    }
  });

  it("宫位占比之和等于一（时辰未知者少两宫，仍为一）", () => {
    for (const [i, b] of bases.entries()) {
      const sum = b.persona.palaces.reduce((a, x) => a + x.share, 0);
      expect(sum, `样本 ${i}`).toBeCloseTo(1, 6);
    }
  });

  it("时辰未知时不出现时柱两宫", () => {
    const noHour = bases[SAMPLES.length - 1]!;
    const names = noHour.persona.palaces.map((x) => x.palace);
    expect(names).not.toContain("志向宫");
    expect(names).not.toContain("子女宫");
  });

  it("受制事件按**层**匹配 —— 天干的合冲不算到地支头上", () => {
    for (const b of bases) {
      for (const pal of b.persona.palaces) {
        for (const e of pal.afflicted) {
          const isStemKind = e.kind === "ganchong";
          expect(isStemKind, `${pal.palace}(${pal.layer}) 收到了 ${e.kind}`)
            .toBe(pal.layer === "stem");
        }
      }
    }
  });
});

describe("报告 §2.5", () => {
  it("subject 为他人时**整节不生成**，不靠扫描兜底", () => {
    const chart = buildChart(SAMPLES[0]!);
    expect(buildReport(chart, { curveYears: 1 }).persona).not.toBeNull();
    expect(buildReport(chart, { curveYears: 1, subject: "other" }).persona).toBeNull();
  });

  it("叙述通过措辞扫描，且不漏出英文", () => {
    for (const b of bases) {
      const r = buildReport(b, { curveYears: 1 });
      expect(r.persona).not.toBeNull();
      for (const l of r.persona!.narrative) {
        expect(formatViolations(scanText(l.text, l.templateId))).toBe("措辞扫描通过。");
        expect(l.text, l.templateId).not.toMatch(/[A-Za-z]{3,}/);
      }
    }
  });

  it("底本随盘声明", () => {
    expect(bases[0]!.persona.source).toBe(DEFAULT_PARAMS.persona.source);
    expect(bases[0]!.persona.source).toBe("conventional");
  });
});

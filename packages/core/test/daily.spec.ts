import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { dailyOutlook, dailyNarrative } from "../src/liuyao/daily.js";
import {
  crossref, summarizeCrossref, AXIS_ORDER, AXIS_DIRECTIONAL, SYSTEM_LABEL,
  type StructuralClaim, type AgreementKind,
} from "../src/divination/claim.js";
import { scanText } from "../src/report/guard.js";
import { toHant, SIMPLIFIED_ONLY } from "../src/report/hant.js";
import { loadParams } from "../src/params/load.js";
import type { BirthInput } from "../src/chart/types.js";

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const base = buildBaseChart(buildChart(EXAMPLE));
const claim = (
  system: StructuralClaim["system"], axis: StructuralClaim["axis"],
  polarity: StructuralClaim["polarity"],
): StructuralClaim => ({ system, axis, polarity, evidence: `${system}/${axis}`, confidence: 0.8 });

describe("**对照层只报一致与分歧，不合成**", () => {
  it("五个类目各有其判据，互不混淆", () => {
    const cases: readonly (readonly [StructuralClaim[], AgreementKind])[] = [
      [[claim("bazi", "我方位置", "顺"), claim("liuyao", "我方位置", "顺")], "一致"],
      [[claim("bazi", "我方位置", "顺"), claim("liuyao", "我方位置", "逆")], "分歧"],
      [[claim("bazi", "我方位置", "中性"), claim("liuyao", "我方位置", "顺")], "单侧表态"],
      [[claim("bazi", "我方位置", "中性"), claim("liuyao", "我方位置", "中性")], "无从比对"],
      [[claim("liuyao", "我方位置", "顺")], "单侧"],
      [[claim("bazi", "事之动静", "中性"), claim("liuyao", "事之动静", "中性")], "并列"],
    ];
    for (const [cs, want] of cases) {
      expect(crossref(cs).map((c) => c.kind), JSON.stringify(cs.map((c) => c.polarity)))
        .toEqual([want]);
    }
  });

  it("**一侧中性、一侧有方向，不是「一致」** —— 沉默不等于同意", () => {
    const c = crossref([
      claim("bazi", "我方位置", "中性"), claim("liuyao", "我方位置", "顺"),
    ])[0]!;
    expect(c.kind).toBe("单侧表态");
    expect(c.kind).not.toBe("一致");
    expect(c.note).toContain("不等于它同意");
  });

  it("**不判方向的轴走「并列」，不走「无从比对」** —— 两件事不该共用一个名目", () => {
    expect(AXIS_DIRECTIONAL["事之动静"]).toBe(false);
    expect(AXIS_DIRECTIONAL["时间窗"]).toBe(false);
    expect(AXIS_DIRECTIONAL["我方位置"]).toBe(true);
    const c = crossref([
      claim("bazi", "事之动静", "中性"), claim("liuyao", "事之动静", "中性"),
    ])[0]!;
    expect(c.kind).toBe("并列");
    expect(c.note).toContain("动不等于好");
  });

  it("一致的注记必须写明「不构成互相印证」", () => {
    const c = crossref([
      claim("bazi", "我方位置", "顺"), claim("liuyao", "我方位置", "顺"),
    ])[0]!;
    expect(c.note).toContain("确定性函数");
    expect(c.note).toContain("不构成互相印证");
  });

  it("**分歧不作裁决** —— 两说并列，不取一舍一", () => {
    const c = crossref([
      claim("bazi", "阻碍来源", "顺"), claim("liuyao", "阻碍来源", "逆"),
    ])[0]!;
    expect(c.kind).toBe("分歧");
    expect(c.claims).toHaveLength(2);
    expect(c.note).toContain("不作裁决");
  });

  it("轴序固定，同一份输入两次调用给出同一排列", () => {
    const cs = [
      claim("liuyao", "时间窗", "中性"), claim("bazi", "我方位置", "顺"),
      claim("liuyao", "阻碍来源", "逆"), claim("bazi", "阻碍来源", "逆"),
    ];
    const a = crossref(cs).map((c) => c.axis);
    const b = crossref([...cs].reverse()).map((c) => c.axis);
    expect(a).toEqual(b);
    expect(a).toEqual(AXIS_ORDER.filter((x) => a.includes(x)));
  });

  it("摘要只报类目计数，不给「总体顺逆」", () => {
    const s = summarizeCrossref(crossref([
      claim("bazi", "我方位置", "顺"), claim("liuyao", "我方位置", "逆"),
    ]));
    expect(s).toContain("方向相反");
    expect(s).not.toMatch(/总体|综合|得分|评分/);
  });
});

describe("当日运程", () => {
  const o = dailyOutlook(base, { year: 2026, month: 9, day: 2 });

  it("两侧都在，三轴齐全", () => {
    expect(o.bazi.pillar).toBeDefined();
    expect(o.liuyao.gua.ben.name.length).toBeGreaterThan(0);
    expect(new Set(o.claims.map((c) => c.system))).toEqual(new Set(["bazi", "liuyao"]));
    expect(new Set(o.claims.map((c) => c.axis)))
      .toEqual(new Set(["我方位置", "阻碍来源", "事之动静"]));
    // 每一轴两侧各一条
    for (const axis of ["我方位置", "阻碍来源", "事之动静"] as const) {
      expect(o.claims.filter((c) => c.axis === axis)).toHaveLength(2);
    }
  });

  it("**日卦对同一日恒定** —— 默认取子时初，报告可复算", () => {
    const a = dailyOutlook(base, { year: 2026, month: 9, day: 2 });
    const b = dailyOutlook(base, { year: 2026, month: 9, day: 2 });
    expect(b.liuyao.gua.ben.name).toBe(a.liuyao.gua.ben.name);
    expect(b.liuyao.gua.casting.moving).toEqual(a.liuyao.gua.casting.moving);
    // 换一日则换卦（同一日辰内的时辰仍可能同卦，故比隔日）
    const c = dailyOutlook(base, { year: 2026, month: 9, day: 20 });
    expect(c.liuyao.gua.ben.name).not.toBe(a.liuyao.gua.ben.name);
  });

  it("**替用户掷钱是伪造随机性 —— 故当日运程只支持按时起卦**", () => {
    // 基础盘一经构建即冻结（P11 的守卫），故须从头以该参数建盘，
    // 否则先撞上「换参数」那道错，测不到这一条。
    for (const m of ["coin", "number"] as const) {
      const p = loadParams({ liuyao: { castMethod: m } });
      const b = buildBaseChart(buildChart(EXAMPLE), p);
      expect(() => dailyOutlook(b, { year: 2026, month: 9, day: 2 }))
        .toThrow(/只支持按时起卦/);
    }
  });

  it("**每一份叙述都过措辞守卫**", () => {
    for (let d = 1; d <= 28; d++) {
      const x = dailyOutlook(base, { year: 2026, month: 3, day: d });
      for (const l of dailyNarrative(x)) {
        expect(scanText(l.text, l.templateId), `${d} 日 / ${l.templateId}`).toEqual([]);
        expect(l.text).not.toMatch(/[{}]/);
        expect(l.source.ref.length).toBeGreaterThan(0);
      }
    }
  });

  it("叙述里明写「不作合并」与「不构成互相印证」", () => {
    const text = dailyNarrative(o).map((l) => l.text).join("");
    expect(text).toContain("不作合并");
    expect(text).toContain("不构成互相印证");
    expect(text).toContain("不给出");
  });

  it("**不判方向的轴上，两侧的话不该被说成「未表态」**", () => {
    const line = dailyNarrative(o).find((l) => l.text.includes("事之动静"))!;
    expect(line.text).not.toContain("未表态");
    expect(line.text).toContain("并列");
  });

  it("繁体叙述无简体残留，且同样过守卫", () => {
    for (const l of dailyNarrative(o, "zh-Hant")) {
      expect(SIMPLIFIED_ONLY.filter((c) => l.text.includes(c)), l.templateId).toEqual([]);
      expect(scanText(l.text, l.templateId)).toEqual([]);
      expect(toHant(l.text)).toBe(l.text);
    }
  });
});

describe("**一致率约等于分歧率 —— 这正是「一致不构成印证」的实证**", () => {
  it("半年逐日：五个类目都出得来，且一致与分歧数量相当", () => {
    const kinds = new Map<AgreementKind, number>();
    for (let d = 0; d < 180; d += 1) {
      const dt = new Date(Date.UTC(2026, 0, 1 + d));
      const x = dailyOutlook(base, {
        year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate(),
      });
      for (const c of x.comparisons) kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    }
    for (const k of ["一致", "分歧", "单侧表态", "无从比对", "并列"] as const) {
      expect(kinds.get(k) ?? 0, `类目「${k}」半年一次都没出现`).toBeGreaterThan(0);
    }
    const agree = kinds.get("一致")!;
    const differ = kinds.get("分歧")!;
    // 两侧若真在互相印证，一致率该显著高于分歧率。实测两者相当 ——
    // 这与「都是同一日干支的确定性函数，彼此并不独立地支持对方」相符。
    const ratio = agree / (agree + differ);
    expect(ratio, `一致 ${agree} / 分歧 ${differ}`).toBeGreaterThan(0.25);
    expect(ratio, "一致率若压倒性地高，说明两侧其实在算同一件事").toBeLessThan(0.75);
  });
});

describe("体系标签", () => {
  it("四个体系都有中文名，供 crossref 的注记使用", () => {
    expect(Object.keys(SYSTEM_LABEL).sort()).toEqual(["bazi", "liuren", "liuyao", "qimen"]);
    for (const v of Object.values(SYSTEM_LABEL)) expect(v.length).toBeGreaterThan(1);
  });
});

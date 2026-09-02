import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { crossReading } from "../src/divination/reading.js";
import {
  crossref, summarizeCrossref, AXIS_ORDER, SYSTEM_LABEL,
  type AgreementKind, type StructuralClaim,
} from "../src/divination/claim.js";
import { loadParams } from "../src/params/load.js";
import { scanText } from "../src/report/guard.js";
import { toHant, SIMPLIFIED_ONLY } from "../src/report/hant.js";
import type { BirthInput } from "../src/chart/types.js";

const P = loadParams({});
const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};
const base = buildBaseChart(buildChart(EXAMPLE));
const at = (y: number, mo: number, d: number, h: number) => ({
  year: y, month: mo, day: d, hour: h, minute: 30,
  timeZone: "Asia/Shanghai", longitude: 121.47,
});

/** 一百二十个时刻，只算一次。 */
const READINGS = (() => {
  const out: ReturnType<typeof crossReading>[] = [];
  for (let d = 0; d < 120; d++) {
    const dt = new Date(Date.UTC(2026, 0, 1 + d * 3));
    out.push(crossReading(
      at(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), 10), P, base));
  }
  return out;
})();

const claim = (
  system: StructuralClaim["system"], polarity: StructuralClaim["polarity"],
): StructuralClaim => ({
  system, axis: "我方位置", polarity, evidence: `${system}`, confidence: 0.8,
});

describe("四家合参", () => {
  it("四个体系都在，且各出各的轴", () => {
    const r = READINGS[0]!;
    expect(r.systems).toBe(4);
    expect(new Set(r.claims.map((c) => c.system)))
      .toEqual(new Set(["bazi", "liuyao", "liuren", "qimen"]));
    // 三条共同轴 + 奇门独有的方位
    expect(new Set(r.claims.map((c) => c.axis)))
      .toEqual(new Set(["我方位置", "阻碍来源", "事之动静", "方位"]));
  });

  it("**不给命盘则三家合参 —— 少一家就少一家，不用别的顶上**", () => {
    const three = crossReading(at(2026, 9, 2, 14), P);
    expect(three.systems).toBe(3);
    expect(three.bazi).toBeNull();
    expect(new Set(three.claims.map((c) => c.system)))
      .toEqual(new Set(["liuyao", "liuren", "qimen"]));
    // 少了四柱，「我方位置」轴仍有三家，不该退化为单侧
    const axis = three.comparisons.find((c) => c.axis === "我方位置")!;
    expect(axis.claims).toHaveLength(3);
    expect(axis.kind).not.toBe("单侧");
  });

  it("**「方位」恒为单侧 —— 只有奇门说得上话**", () => {
    for (const r of READINGS) {
      const f = r.comparisons.find((c) => c.axis === "方位")!;
      expect(f.kind).toBe("单侧");
      expect(f.claims.map((c) => c.system)).toEqual(["qimen"]);
      expect(f.note).toContain("未表态，不等于默认同意");
    }
  });

  it("同一时刻两次合参逐字相同 —— 四家都是确定性的", () => {
    const a = crossReading(at(2026, 9, 2, 14), P, base);
    const b = crossReading(at(2026, 9, 2, 14), P, base);
    expect(b.claims).toEqual(a.claims);
    expect(b.comparisons.map((c) => [c.axis, c.kind]))
      .toEqual(a.comparisons.map((c) => [c.axis, c.kind]));
  });
});

describe("**不合成、不投票、不排座次**", () => {
  it("注记里写明谁判什么，不写比数", () => {
    for (const r of READINGS) {
      for (const c of r.comparisons) {
        if (c.kind !== "分歧" && c.kind !== "一致") continue;
        // 该出现体系名
        expect(c.note).toMatch(/四柱|六爻|六壬|奇门/);
        // 不该出现「三比一」「75%」这类比数
        expect(c.note).not.toMatch(/\d+\s*[:：比]\s*\d+/);
        expect(c.note).not.toMatch(/\d+\s*%/);
      }
    }
  });

  it("**分歧时明写「不要把三比一读成七成五的把握」**", () => {
    const c = crossref([
      claim("bazi", "顺"), claim("liuyao", "顺"),
      claim("liuren", "顺"), claim("qimen", "逆"),
    ])[0]!;
    expect(c.kind).toBe("分歧");
    expect(c.note).toContain("把计数当概率");
    expect(c.note).not.toMatch(/七成五|三比一/);
  });

  it("**沉默必须写出来** —— 三家判顺一家中性仍是一致，但注记要说那一家没表态", () => {
    const c = crossref([
      claim("bazi", "中性"), claim("liuyao", "顺"),
      claim("liuren", "顺"), claim("qimen", "顺"),
    ])[0]!;
    expect(c.kind).toBe("一致");
    expect(c.note).toContain("四柱未表态");
    expect(c.note).toContain("不构成互相印证");
  });

  it("摘要只报类目计数，一个「综合取向」都不给", () => {
    for (const r of READINGS) {
      expect(r.summary).not.toMatch(/总体|综合|得分|评分|更可信|最可信/);
      expect(summarizeCrossref(r.comparisons)).toBe(r.summary);
    }
  });

  it("**没有任何一处给出「哪一家更准」**", () => {
    for (const r of READINGS.slice(0, 30)) {
      const text = r.comparisons.map((c) => c.note + c.claims.map((x) => x.evidence).join("")).join("");
      for (const w of ["更准", "更可信", "为主", "为准", "优先采信", "以…为断"]) {
        expect(text.includes(w), `出现了排座次的措辞「${w}」`).toBe(false);
      }
    }
  });
});

describe("**一致率不压倒分歧率 —— 四家时更是如此**", () => {
  it("我方位置一轴上，一致与分歧数量相当", () => {
    const kinds = new Map<AgreementKind, number>();
    for (const r of READINGS) {
      const c = r.comparisons.find((x) => x.axis === "我方位置")!;
      kinds.set(c.kind, (kinds.get(c.kind) ?? 0) + 1);
    }
    const agree = kinds.get("一致") ?? 0;
    const differ = kinds.get("分歧") ?? 0;
    expect(agree, "一致一次都没有").toBeGreaterThan(0);
    expect(differ, "分歧一次都没有 —— 四家竟从不相左，可疑").toBeGreaterThan(0);
    const ratio = agree / (agree + differ);
    // 两家时实测约五五开；四家时分歧本该更多 —— 家数越多，全体同向越难
    expect(ratio, `一致 ${agree} / 分歧 ${differ}`).toBeLessThan(0.6);
    expect(ratio).toBeGreaterThan(0.15);
  });

  it("五个类目在一百二十个时刻里都出得来", () => {
    const seen = new Set<AgreementKind>();
    for (const r of READINGS) for (const c of r.comparisons) seen.add(c.kind);
    for (const k of ["一致", "分歧", "单侧表态", "无从比对", "并列", "单侧"] as const) {
      expect(seen.has(k), `类目「${k}」一次都没出现`).toBe(true);
    }
  });
});

describe("轴与措辞", () => {
  it("轴序固定，且只出现在 AXIS_ORDER 里的", () => {
    for (const r of READINGS) {
      const axes = r.comparisons.map((c) => c.axis);
      expect(axes).toEqual(AXIS_ORDER.filter((a) => axes.includes(a)));
    }
  });

  it("**依据与注记全部过措辞守卫**", () => {
    for (const r of READINGS.slice(0, 40)) {
      for (const c of r.comparisons) {
        expect(scanText(c.note, `crossref.${c.axis}`), c.axis).toEqual([]);
        for (const x of c.claims) {
          expect(scanText(x.evidence, `${x.system}.${x.axis}`), `${x.system}/${x.axis}`)
            .toEqual([]);
        }
      }
    }
  });

  it("繁体转换无残留 —— 四台引擎的语汇都已归类", () => {
    for (const r of READINGS.slice(0, 40)) {
      const text = r.comparisons.map(
        (c) => c.note + c.claims.map((x) => x.evidence).join("")).join("\n") + r.summary;
      const hant = toHant(text);
      expect(SIMPLIFIED_ONLY.filter((c) => hant.includes(c))).toEqual([]);
      expect(toHant(hant)).toBe(hant);
    }
  });

  it("四个体系都有中文名", () => {
    for (const r of READINGS.slice(0, 5)) {
      for (const c of r.claims) expect(SYSTEM_LABEL[c.system].length).toBeGreaterThan(1);
    }
  });
});

describe("**六爻这一侧取的是用神，不是世爻**", () => {
  it("换个占事，六爻的断言随之改变", () => {
    const a = crossReading({ ...at(2026, 9, 2, 14), topicId: "wealth.seek" }, P, base);
    const b = crossReading({ ...at(2026, 9, 2, 14), topicId: "career.job" }, P, base);
    const ev = (r: typeof a) => r.claims.find(
      (c) => c.system === "liuyao" && c.axis === "我方位置")!.evidence;
    expect(ev(a)).not.toBe(ev(b));
    expect(ev(a)).toContain("求财");
    expect(ev(b)).toContain("求职");
    // 六壬、奇门、四柱三家不随占事而变 —— 它们本就不分占事
    for (const sys of ["liuren", "qimen", "bazi"] as const) {
      expect(a.claims.filter((c) => c.system === sys))
        .toEqual(b.claims.filter((c) => c.system === sys));
    }
  });

  it("**用神伏藏时判中性，不判逆** —— 找不到位置不等于不利", () => {
    let hidden = 0;
    for (let d = 0; d < 200; d++) {
      const dt = new Date(Date.UTC(2026, 0, 1 + d));
      const r = crossReading(
        { ...at(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), 6),
          topicId: "wealth.seek" }, P, base);
      const c = r.claims.find((x) => x.system === "liuyao" && x.axis === "我方位置")!;
      if (!c.evidence.includes("伏")) continue;
      hidden++;
      expect(c.polarity, "伏藏判成了逆 —— 那是把结构缺位说成了不利").toBe("中性");
      expect(c.evidence).toContain("不作强弱之判");
    }
    expect(hidden, "两百个时刻里一次伏藏都没有 —— 这条没验到").toBeGreaterThan(0);
  });

  it("世应类的占事，用神本就是世爻", () => {
    const r = crossReading({ ...at(2026, 9, 2, 14), topicId: "self.fortune" }, P, base);
    const c = r.claims.find((x) => x.system === "liuyao" && x.axis === "我方位置")!;
    expect(c.evidence).toContain("持世");
  });
});

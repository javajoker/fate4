import { describe, expect, it } from "vitest";
import {
  AMBIGUOUS, IDENTICAL, SIMPLIFIED_ONLY, TERMS,
  toHant, unclassifiedOf, UncoveredAmbiguityError,
} from "../src/report/hant.js";
import { buildChart } from "../src/chart/buildChart.js";
import { buildReport, collectReportText } from "../src/report/assemble.js";
import { renderMarkdown } from "../src/report/markdown.js";
import { NEIJING } from "../src/conclude/neijing.js";
import type { BirthInput } from "../src/chart/types.js";

const CHARTS: readonly BirthInput[] = [
  { year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47 },
  { year: 1977, month: 11, day: 3, hour: 6, minute: 5,
    gender: "female", timeZone: "Asia/Shanghai", longitude: 121.47 },
  { year: 2003, month: 2, day: 19, hour: 23, minute: 40,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47 },
];

const report = (b: BirthInput, locale: "zh-Hans" | "zh-Hant") =>
  buildReport(buildChart(b), { locale, includeNodes: true, now: { year: 2026, month: 9, day: 2 } });

const hansCorpus = CHARTS.map((b) => {
  const r = report(b, "zh-Hans");
  return [...collectReportText(r).map((x) => x.text), renderMarkdown(r)].join("\n");
}).join("\n");

// ═══════════════════════════════════════════════════════════

describe("三个桶必须不重不漏", () => {
  it("歧义字不得混进单字表", () => {
    for (const c of SIMPLIFIED_ONLY) {
      expect(AMBIGUOUS[c], `「${c}」一简对多繁，不能当作一对一映射`).toBeUndefined();
    }
  });

  it("同形表里不得有需要转换的字", () => {
    for (const c of IDENTICAL) {
      expect(SIMPLIFIED_ONLY, `「${c}」既说同形又在单字表里`).not.toContain(c);
      expect(AMBIGUOUS[c], `「${c}」既说同形又说歧义`).toBeUndefined();
    }
    expect(new Set(IDENTICAL).size, "同形表有重复字").toBe(IDENTICAL.length);
  });

  it("**报告里的每一个汉字都已归类** —— 新字出现时这里会指名道姓", () => {
    const unknown = unclassifiedOf(hansCorpus);
    expect(unknown,
      `以下汉字未归入三个桶，请在 hant.ts 里明确它属于哪一类：${unknown.join("")}`)
      .toEqual([]);
  });

  it("词条的键必含歧义字，否则它是多余的", () => {
    for (const k of Object.keys(TERMS)) {
      const hasAmb = [...k].some((c) => c in AMBIGUOUS);
      expect(hasAmb, `词条「${k}」里没有歧义字 —— 单字表已能处理，此条多余`).toBe(true);
    }
  });

  it("pick 为 null 的字必须真的有词条兜着", () => {
    const nulls = Object.entries(AMBIGUOUS).filter(([, v]) => v.pick === null).map(([c]) => c);
    expect(nulls.sort()).toEqual(["历", "发", "复", "系"].sort());
    for (const c of nulls) {
      const covered = Object.keys(TERMS).filter((k) => k.includes(c));
      expect(covered.length, `「${c}」说无单一读法，却一条词条也没有`).toBeGreaterThan(2);
    }
  });
});

describe("**文档点名的那几个陷阱**", () => {
  it("余气→餘氣，不是余氣", () => {
    expect(toHant("余气")).toBe("餘氣");
    expect(toHant("其余几步")).toBe("其餘幾步");
  });

  it("历法→曆法，不是歷法；经历→經歷", () => {
    expect(toHant("历法")).toBe("曆法");
    expect(toHant("经历")).toBe("經歷");
  });

  it("后天→後天，不是后天", () => {
    expect(toHant("后天")).toBe("後天");
    expect(toHant("之后才去找")).toBe("之後才去找");
  });

  it("**其华在发→其華在髮，而触发→觸發** —— 同一个字，两个答案", () => {
    expect(toHant("其华在发")).toBe("其華在髮");
    expect(toHant("触发标记")).toBe("觸發標記");
    // 单独成格的「发」是肾之华
    expect(toHant("发")).toBe("髮");
  });

  it("系统/关系/系数 —— 同一个字，三个答案", () => {
    expect(toHant("本系统")).toBe("本系統");
    expect(toHant("两者的关系")).toBe("兩者的關係");
    expect(toHant("距离系数")).toBe("距離係數");
  });

  it("重复→重複，恢复→恢復，反复→反覆", () => {
    expect(toHant("重复计入")).toBe("重複計入");
    expect(toHant("恢复")).toBe("恢復");
    expect(toHant("反复")).toBe("反覆");
  });

  it("干支之干不作乾，干燥才作乾", () => {
    expect(toHant("天干藏干透干")).toBe("天干藏干透干");
    expect(toHant("干燥")).toBe("乾燥");
  });

  it("脏腑→臟腑，不是髒腑；虚实→虛實", () => {
    expect(toHant("脏腑")).toBe("臟腑");
    expect(toHant("阴阳虚实")).toBe("陰陽虛實");
  });

  it("五行之克作剋；相冲作沖", () => {
    expect(toHant("土克水")).toBe("土剋水");
    expect(toHant("逢冲而动")).toBe("逢沖而動");
  });

  it("采样→採樣；钟表→鐘錶；配属表仍是表", () => {
    expect(toHant("月度采样")).toBe("月度採樣");
    expect(toHant("当地钟表时")).toBe("當地鐘錶時");
    expect(toHant("配属表")).toBe("配屬表");
  });
});

describe("拒绝猜测", () => {
  it("**无法定夺时抛错，而不是挑一个** —— 这是本模块与机械转换的分界", () => {
    // 「发」无单一读法，且「奋发」不在词条里
    expect(() => toHant("奋发")).toThrow(UncoveredAmbiguityError);
    try { toHant("奋发"); } catch (e) {
      expect((e as Error).message).toContain("发");
      expect((e as Error).message).toContain("不要让它猜");
    }
  });

  it("每个歧义字的理由都举了实际用例，不是占位话", () => {
    // 门槛不设在字数上 —— 字数只会逼出更长的空话。要求举例：
    // 理由里必须以「」引出本领域里真实出现的词，读的人才能自己复核。
    for (const [c, a] of Object.entries(AMBIGUOUS)) {
      expect(a.why, `「${c}」的理由没举出任何实际用词`).toMatch(/「[^」]+」/);
      expect(a.forms, `「${c}」的候选字表里没有它选中的那一个`).toContain(a.pick ?? a.forms[0]!);
      expect(a.forms.length, `「${c}」只有一个候选，那它不该算歧义字`).toBeGreaterThan(1);
    }
  });

  it("词条压过单字，长词条压过短词条", () => {
    expect(toHant("发")).toBe("髮");          // EXACT
    expect(toHant("其华在发")).toBe("其華在髮"); // 长词条
    expect(toHant("发生")).toBe("發生");        // 短词条
  });

  it("转换是幂等的 —— 转过的文本再转一次不变", () => {
    const once = toHant(hansCorpus);
    expect(toHant(once)).toBe(once);
  });
});

describe("端到端", () => {
  for (const [i, b] of CHARTS.entries()) {
    it(`第 ${i + 1} 张盘的繁体报告里没有一个简体字`, () => {
      const r = report(b, "zh-Hant");
      const md = renderMarkdown(r);
      const leaked = SIMPLIFIED_ONLY.filter((c) => md.includes(c));
      expect(leaked, `Markdown 里残留简体：${leaked.join("")}`).toEqual([]);
    });

    it(`第 ${i + 1} 张盘：**报告树里的每一段文字都已转换**`, () => {
      // toHant 幂等，故「再转一次不变」等价于「这一段确实转过了」。
      // 漏掉某个字段时这里会失败 —— 这是本方案的完整性保证。
      for (const chunk of collectReportText(report(b, "zh-Hant"))) {
        expect(toHant(chunk.text), `${chunk.where} 未经繁体转换`).toBe(chunk.text);
      }
    });
  }

  it("简繁两版的结构完全一致 —— 只有字变了", () => {
    const hans = collectReportText(report(CHARTS[0]!, "zh-Hans"));
    const hant = collectReportText(report(CHARTS[0]!, "zh-Hant"));
    expect(hant.map((x) => x.where)).toEqual(hans.map((x) => x.where));
    expect(hant.map((x) => x.text)).toEqual(hans.map((x) => toHant(x.text)));
  });

  it("《内经》配属表的每个字都能转，且肾之华为髮", () => {
    for (const row of Object.values(NEIJING)) {
      for (const v of [row.zang, row.fu, row.ti, row.hua, row.ye, row.zhi, row.qi, row.wei]) {
        expect(() => toHant(v), `内经表的「${v}」无法转换`).not.toThrow();
      }
    }
    expect(toHant(NEIJING.水.hua)).toBe("髮");
    expect(toHant(NEIJING.火.ti)).toBe("脈");
  });
});

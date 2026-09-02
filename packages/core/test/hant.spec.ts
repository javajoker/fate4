import { describe, expect, it } from "vitest";
import {
  AMBIGUOUS, IDENTICAL, SIMPLIFIED_ONLY, TERMS,
  toHant, unclassifiedOf, unconvertedOf, UncoveredAmbiguityError,
} from "../src/report/hant.js";
import { buildChart } from "../src/chart/buildChart.js";
import { buildReport, collectReportText } from "../src/report/assemble.js";
import { renderMarkdown } from "../src/report/markdown.js";
import { NEIJING } from "../src/conclude/neijing.js";
import { GUARD_RULES, scanText } from "../src/report/guard.js";
import { castMomentOf } from "../src/liuyao/moment.js";
import { cast, type CoinThrow } from "../src/liuyao/cast.js";
import { dress } from "../src/liuyao/dress.js";
import { pickYongshen } from "../src/liuyao/yongshen.js";
import { judge } from "../src/liuyao/judge.js";
import { buildQuestionReport, collectQuestionText } from "../src/liuyao/report.js";
import { TOPICS } from "../src/liuyao/topics.js";
import { HEXAGRAMS } from "../src/yijing/hexagrams.js";
import { TRIGRAMS } from "../src/yijing/trigrams.js";
import { LIUQIN_SCOPE, LIUSHEN_IMAGE } from "../src/yijing/najia.js";
import { YAO_POSITION_IMAGE } from "../src/liuyao/dress.js";
import { TIAOHOU_PRINCIPLE } from "../src/conclude/tiaohou.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
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

/**
 * 问事报告也要进语料 —— **完整性保证只到语料所及之处**。
 *
 * 第二台引擎接上来时，`安静` 的「静」就没转（它在四柱报告里从未出现），
 * 繁体正文里赫然留着一个简体字，而当时的完整性测试全绿。
 * 语料漏一块，保证就少一块。
 */
const liuyaoCorpus = (() => {
  const P = DEFAULT_PARAMS.liuyao;
  const out: string[] = [];
  for (const [y, mo, d, h] of [[2026, 9, 2, 14], [2026, 3, 15, 10], [2025, 12, 5, 8]] as const) {
    const M = castMomentOf({
      year: y, month: mo, day: d, hour: h, minute: 30,
      timeZone: "Asia/Shanghai", longitude: 121.47,
    });
    for (let n = 0; n < 4096; n += 397) {
      const t = Array.from({ length: 6 }, (_, i) => ((n >> (i * 2)) & 3) as CoinThrow);
      const CP = { ...P, castMethod: "coin" as const };
      const g = dress(cast(M, { method: "coin", throws: t as never }, CP), CP);
      for (const topic of TOPICS) {
        const j = judge(g, pickYongshen(g, topic.id, "父母"), P);
        const r = buildQuestionReport(j, DEFAULT_PARAMS);
        out.push(...collectQuestionText(r).map((c) => c.text));
        for (const f of j.findings) {
          out.push(f.value, ...f.derivation.map((x) => x.step + x.detail));
        }
      }
    }
  }
  // 静态词表穷举 —— 卦名、六亲、六神、爻位象、占事标签。
  // 抽样会漏：步长从 97 改到 397，立刻冒出「丰」「谦」「复」三个没归类的卦名字。
  // 静态的东西该穷举，不该抽样。
  out.push(HEXAGRAMS.map((h) => h.name).join(" "));
  out.push(TRIGRAMS.map((t) => `${t.name}${t.image}`).join(" "));
  out.push(TOPICS.map((t) => `${t.category}${t.label}`).join(" "));
  out.push(Object.values(LIUQIN_SCOPE).join(" "));
  out.push(Object.values(LIUSHEN_IMAGE).join(" "));
  out.push(YAO_POSITION_IMAGE.join(" "));
  out.push(Object.values(TIAOHOU_PRINCIPLE).join(" "));
  return out.join("\n");
})();

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
    const unknown = unclassifiedOf(hansCorpus + "\n" + liuyaoCorpus);
    expect(unknown,
      `以下汉字未归入三个桶，请在 hant.ts 里明确它属于哪一类：${unknown.join("")}`)
      .toEqual([]);
  });

  it("**派生出的繁体规则里没有一个没转过去的字**", () => {
    // 繁体规则由简体机械派生（见 guard.ts）。漏归类的字会原样留在简体，
    // 于是那条繁体规则永远匹配不上繁体正文 —— 一个不报错的洞。实测漏过一个「险」。
    //
    // 这里不能用「不含简体字」来查：一个没归类的简体字既不在单字表的键里，
    // 也就不会被 SIMPLIFIED_ONLY 逮到。故改查输出侧的白名单。
    const src = GUARD_RULES["zh-Hant"]
      .map((r) => [r.pattern.source, r.why, r.fix].join("")).join("");
    const bad = unconvertedOf(src);
    expect(bad, `繁体规则里未转换的汉字：${bad.join("")}`).toEqual([]);
  });

  it("词条的键必含歧义字，否则它是多余的", () => {
    for (const k of Object.keys(TERMS)) {
      const hasAmb = [...k].some((c) => c in AMBIGUOUS);
      expect(hasAmb, `词条「${k}」里没有歧义字 —— 单字表已能处理，此条多余`).toBe(true);
    }
  });

  it("pick 为 null 的字必须真的有词条兜着", () => {
    const nulls = Object.entries(AMBIGUOUS).filter(([, v]) => v.pick === null).map(([c]) => c);
    expect(nulls.sort()).toEqual(["历", "发", "复", "系", "汇"].sort());
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
    for (const corpus of [hansCorpus, liuyaoCorpus]) {
      const once = toHant(corpus);
      expect(toHant(once)).toBe(once);
    }
  });

  it("**问事报告的繁体里没有一个简体字**", () => {
    const out = toHant(liuyaoCorpus);
    const leaked = SIMPLIFIED_ONLY.filter((c) => out.includes(c));
    expect(leaked, `繁体问事报告残留简体：${leaked.join("")}`).toEqual([]);
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

// ═══════════════════════════════════════════════════════════

describe("**守卫的简繁对等 —— 是构造保证，不是维护约定**", () => {
  const hans = GUARD_RULES["zh-Hans"];
  const hant = GUARD_RULES["zh-Hant"];

  it("两套规则一一对应，条数相同", () => {
    // 初版繁体只有手写的七条，简体十九条 —— 那十二条之差是实打实的守卫盲区。
    expect(hant.length).toBe(hans.length);
    expect(hant.map((r) => r.id)).toEqual(hans.map((r) => r.id.replace(/^zh\./, "zht.")));
    for (const [i, r] of hant.entries()) {
      expect(r.mode).toBe(hans[i]!.mode);
      expect(r.category).toBe(hans[i]!.category);
      expect(r.locale).toBe("zh-Hant");
    }
  });

  it("繁体规则的模式确实是繁体 —— 不是照抄简体", () => {
    let converted = 0;
    for (const [i, r] of hant.entries()) {
      if (r.pattern.source !== hans[i]!.pattern.source) converted++;
    }
    expect(converted, "两套模式逐条相同，说明转换根本没生效").toBeGreaterThan(hans.length / 2);
  });

  it("**植入违规必须两种字体都逮到** —— 反向对照", () => {
    const PLANTED: readonly string[] = [
      "此人必然在 2030 年离婚。",
      "注意心脏疾病。",
      "建议投资买房。",
      "会有官司缠身。",
      "肝不好，需要调理。",
      // 六爻专有的四条
      "用神旺相，主得财。",
      "用神临日辰，此事可成。",
      "应期在申日，届时必有消息。",
      "官鬼持世，病难愈。",
    ];
    for (const bad of PLANTED) {
      const h = scanText(bad, "test.hans");
      expect(h.length, `简体未逮到：${bad}`).toBeGreaterThan(0);
      const t = scanText(toHant(bad), "test.hant");
      expect(t.length, `繁体未逮到：${toHant(bad)}`).toBeGreaterThan(0);
    }
  });

  it("**合规文本两种字体都放行** —— 没有它，「全绿」可能只是因为什么都拦", () => {
    const OK = "《内经》五行配属中，木应肝与胆，在窍为目。以上为传统对照与本盘数值的"
      + "并列陈述，不构成任何关于身体状况的判断，亦不指向任何具体病症；"
      + "健康相关的决定请咨询持证专业人士。";
    expect(scanText(OK, "test.hans"), "简体合规文本被误拦").toEqual([]);
    expect(scanText(toHant(OK), "test.hant"), "繁体合规文本被误拦 —— 框定语没有简繁双写")
      .toEqual([]);
  });
});

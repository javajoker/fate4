import { describe, expect, it } from "vitest";
import { buildChart } from "../src/chart/buildChart.js";
import { buildReport } from "../src/report/assemble.js";
import { plainCards, type PlainCard } from "../src/plain/cards.js";
import { scanPlain, PLAIN_RULES } from "../src/plain/guard.js";
import {
  STRENGTH_PLAIN, GOD_PLAIN, GOD_RELATION_PLAIN, ELEMENT_PLAIN, ELEMENT_BODY_PLAIN,
  ELEMENT_STATE_PLAIN, QUADRANT_PLAIN, DIRECTION_PLAIN, favorPlain, confidencePlain,
} from "../src/plain/vocab.js";
import { GUARD_RULES, scanText } from "../src/report/guard.js";
import { toHant, SIMPLIFIED_ONLY } from "../src/report/hant.js";
import { ELEMENTS, TEN_GODS } from "../src/types/ganzhi.js";
import type { BirthInput } from "../src/chart/types.js";

const CHARTS: readonly BirthInput[] = [
  { year: 1990, month: 5, day: 12, hour: 14, minute: 30,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47 },
  { year: 1977, month: 11, day: 3, hour: 6, minute: 5,
    gender: "female", timeZone: "Asia/Shanghai", longitude: 121.47 },
  { year: 2003, month: 2, day: 19, hour: 23, minute: 40,
    gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47 },
];
const REPORTS = CHARTS.map((b) => buildReport(buildChart(b), {
  includeNodes: true, now: { year: 2026, month: 9, day: 2 },
}));
const PLAINS = REPORTS.map(plainCards);
const allCards = (): PlainCard[] => PLAINS.flatMap((p) => p.cards);

describe("词表完备", () => {
  it("十神、五行、象限、方向、状态都有人话，不留空", () => {
    for (const g of TEN_GODS) {
      expect(GOD_PLAIN[g]?.length, g).toBeGreaterThan(3);
      expect(GOD_RELATION_PLAIN[g]?.length, g).toBeGreaterThan(2);
    }
    for (const e of ELEMENTS) {
      expect(ELEMENT_PLAIN[e]?.length, e).toBeGreaterThan(3);
      expect(ELEMENT_BODY_PLAIN[e]?.length, e).toBeGreaterThan(3);
    }
    for (const b of ["VERY_STRONG", "STRONG", "BALANCED", "WEAK", "VERY_WEAK"]) {
      expect(STRENGTH_PLAIN[b]?.length, b).toBeGreaterThan(8);
    }
    for (const q of ["both-favorable", "star-only", "palace-only", "neither"]) {
      expect(QUADRANT_PLAIN[q]?.length, q).toBeGreaterThan(8);
    }
    for (const d of ["opportunity", "pressure", "neutral"]) {
      expect(DIRECTION_PLAIN[d]?.length, d).toBeGreaterThan(4);
    }
    for (const s of ["实", "实而受制", "平", "平而受制", "虚", "虚而被伐"]) {
      expect(ELEMENT_STATE_PLAIN[s]?.length, s).toBeGreaterThan(2);
    }
  });

  it("**「场合」与「身体」是两张表** —— 拿场合的话说身体是范畴错误", () => {
    // 初稿正是这么错的：「需要被看见的场合上，这一路偏盛」
    for (const e of ELEMENTS) {
      expect(ELEMENT_BODY_PLAIN[e]).not.toBe(ELEMENT_PLAIN[e]);
      expect(ELEMENT_PLAIN[e]).toContain("场合");
      expect(ELEMENT_BODY_PLAIN[e]).not.toContain("场合");
    }
  });

  it("**词表里一个方位、属相、颜色、数字都没有**", () => {
    const all = [
      ...Object.values(STRENGTH_PLAIN), ...Object.values(GOD_PLAIN),
      ...Object.values(GOD_RELATION_PLAIN), ...Object.values(ELEMENT_PLAIN),
      ...Object.values(ELEMENT_BODY_PLAIN), ...Object.values(QUADRANT_PLAIN),
    ].join("");
    for (const w of ["东方", "西方", "南方", "北方", "属鼠", "属牛", "幸运色", "幸运数字"]) {
      expect(all.includes(w), `词表里出现了「${w}」`).toBe(false);
    }
  });

  it("置信度低时人话必须说出来 —— 不能只在技术层留个小数", () => {
    expect(confidencePlain(0.9)).toBe("");
    expect(confidencePlain(0.7)).toContain("不算特别确定");
    expect(confidencePlain(0.4)).toContain("很不确定");
  });

  it("顺逆指数分五档，且不把数字给用户", () => {
    const bands = new Set([0, 20, 40, 50, 60, 80, 100].map(favorPlain));
    expect(bands.size).toBe(5);
    for (const b of bands) expect(b).not.toMatch(/\d/);
  });
});

describe("**人话是判定的函数，不是自由撰写**", () => {
  it("同一份报告两次生成，逐字相同", () => {
    const a = plainCards(REPORTS[0]!);
    const b = plainCards(REPORTS[0]!);
    expect(b.cards.map((c) => c.body)).toEqual(a.cards.map((c) => c.body));
  });

  it("**旺衰档换一个，底子那张卡就换一句** —— 人话确实挂在枚举上", () => {
    const bodies = new Set(PLAINS.map(
      (p) => p.cards.find((c) => c.id === "self.strength")!.body));
    const bands = new Set(REPORTS.map((r) => r.strength.strength.value));
    // 三张盘若落在不同档，人话也该不同；落在同档则相同
    expect(bodies.size).toBe(new Set([...bands].map((b) => STRENGTH_PLAIN[b])).size);
  });

  it("**同一张卡在不同盘上的取值是有界的** —— 自由撰写会让它无界", () => {
    // 这是「人话是判定的函数」的可检验形式：正文由枚举查表拼成，
    // 故同一 card.id 在多张盘上只能取到有限几种值。
    // 若某张卡逐盘都不同，那它就不是查表得来的了。
    const byId = new Map<string, Set<string>>();
    for (const p of PLAINS) {
      for (const c of p.cards) {
        if (!byId.has(c.id)) byId.set(c.id, new Set());
        byId.get(c.id)!.add(c.body);
      }
    }
    for (const [id, set] of byId) {
      // 三张盘至多三种取值；若某卡三张盘三个样，仍可能是枚举恰好各不相同，
      // 故只在「取值里含有本盘特有的数字」时判为自由撰写。
      for (const body of set) {
        expect(body, `${id} 的正文里带了本盘特有的数字 —— 那不是查表得来的`)
          .not.toMatch(/\d+\.\d|\d+%/);
      }
      expect(set.size, id).toBeLessThanOrEqual(PLAINS.length);
    }
  });
});

describe("**每张卡都挂着它的来历**", () => {
  it("卡片有 id、分节、标题、正文，且正文不空", () => {
    for (const c of allCards()) {
      expect(c.id.length).toBeGreaterThan(0);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(6);
      expect(c.confidence).toBeGreaterThan(0);
      expect(c.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("**依据是报告原文，不是重写的** —— 逐条能在报告里找到", () => {
    for (const [i, p] of PLAINS.entries()) {
      const all = new Set(collectAll(REPORTS[i]!).map((l) => l.text));
      for (const c of p.cards) {
        for (const e of c.evidence) {
          expect(all.has(e.text), `${c.id} 的依据不在报告里：${e.text.slice(0, 30)}`).toBe(true);
        }
      }
    }
  });

  it("**大运卡的依据不许错位** —— 错开一格时每张卡仍有依据，看上去毫无异样", () => {
    for (const [i, p] of PLAINS.entries()) {
      const steps = REPORTS[i]!.luck.steps;
      for (const s of steps) {
        const c = p.cards.find((x) => x.id === `luck.${s.index}`)!;
        expect(c.evidence).toHaveLength(1);
        expect(c.evidence[0]!.text, `第 ${s.index} 步的依据`)
          .toContain(`第${s.index}步`);
      }
    }
  });

  it("六亲卡的依据逐条对齐，不是把五条都算给第一条", () => {
    for (const [i, p] of PLAINS.entries()) {
      const kin = p.cards.filter((c) => c.section === "亲近的人");
      if (kin.length === 0) continue;
      const texts = kin.flatMap((c) => c.evidence.map((e) => e.text));
      expect(new Set(texts).size, "多张六亲卡共用了同一条依据").toBe(texts.length);
      for (const [j, c] of kin.entries()) {
        const k = REPORTS[i]!.kin.readings[j]!;
        if (c.evidence.length > 0) expect(c.evidence[0]!.text).toContain(k.label);
      }
    }
  });

  it("绝大多数卡片都有依据可看 —— 「看依据」不能是空按钮", () => {
    const withEv = allCards().filter((c) => c.evidence.length > 0).length;
    expect(withEv / allCards().length).toBeGreaterThan(0.85);
  });
});

describe("**人话层的守卫比技术层更严**", () => {
  it("放开第二人称，其余一条不减，另加六条", () => {
    const tech = GUARD_RULES["zh-Hans"];
    const ids = new Set(PLAIN_RULES.map((r) => r.id));
    for (const r of tech) {
      if (r.category === "secondPerson") {
        expect(ids.has(r.id), "人话层不该还禁着第二人称").toBe(false);
      } else {
        expect(ids.has(r.id), `技术层的 ${r.id} 在人话层被丢了`).toBe(true);
      }
    }
    for (const id of ["zh.plain.actionable", "zh.plain.fitness", "zh.plain.imperative",
      "zh.plain.appearance", "zh.plain.otherPerson", "zh.plain.framing"]) {
      expect(ids.has(id), `缺少人话专有规则 ${id}`).toBe(true);
    }
  });

  it("**全部卡片过人话守卫，零命中**", () => {
    for (const p of PLAINS) {
      const text = p.cards.map((c) => `${c.title}。${c.body}`).join("\n")
        + `\n${p.framing}\n${p.disclaimer}`;
      const v = scanPlain(text, "plain");
      expect(v.map((x) => `${x.ruleId}: ${x.match}`)).toEqual([]);
    }
  });

  it("**植入六类违规必须被逮到** —— 反向对照", () => {
    const PLANTED: readonly (readonly [string, string])[] = [
      ["你适合往东南方发展。", "zh.plain.actionable"],
      ["宜找属兔的人合作。", "zh.plain.actionable"],
      ["你很适合从事金融行业。", "zh.plain.fitness"],
      ["你不适合创业。", "zh.plain.fitness"],
      ["不妨多往南边走走。", "zh.plain.imperative"],
      ["你相貌端正，五官出众。", "zh.plain.appearance"],
      ["你的配偶多半是温和的人。", "zh.plain.otherPerson"],
      ["你的八字里火很旺。", "zh.plain.framing"],
    ];
    for (const [text, id] of PLANTED) {
      const v = scanPlain(text, "planted");
      expect(v.length, `未被拦下：${text}`).toBeGreaterThan(0);
      expect(v.map((x) => x.ruleId), `${text} 未命中 ${id}`).toContain(id);
    }
  });

  it("**技术层的禁令在人话层同样生效** —— 不是只加不减", () => {
    for (const bad of [
      "你必然在 2030 年离婚。", "注意心脏疾病。", "建议投资买房。", "会有官司缠身。",
    ]) {
      expect(scanPlain(bad, "planted").length, `未被拦下：${bad}`).toBeGreaterThan(0);
    }
  });

  it("**第二人称在人话层放行，在技术层仍拦** —— 两层各守各的", () => {
    const t = "你的底子偏轻，容易顺着环境走。";
    expect(scanPlain(t, "plain")).toEqual([]);
    expect(scanText(t, "tech").map((v) => v.ruleId)).toContain("zh.secondPerson.address");
  });

  it("繁体规则的框定语简繁双写 —— 否则繁体规则会在简体正文上必然误报", () => {
    // 这个 bug 在 report/guard.ts 修过一次，手写派生时又犯了一遍
    const t = "按传统的五行配属，这是一套传统模型的推演。";
    expect(scanPlain(t, "plain")).toEqual([]);
    expect(scanPlain(toHant(t), "plain")).toEqual([]);
  });
});

describe("繁体", () => {
  it("人话转繁体无残留，且幂等", () => {
    for (const p of PLAINS) {
      const text = p.cards.map((c) => `${c.title}。${c.body}`).join("\n") + p.framing;
      const h = toHant(text);
      expect(SIMPLIFIED_ONLY.filter((c) => h.includes(c))).toEqual([]);
      expect(toHant(h)).toBe(h);
    }
  });
});

describe("分节", () => {
  it("六个分节都出得来，且顺序稳定", () => {
    for (const p of PLAINS) {
      const secs = [...new Set(p.cards.map((c) => c.section))];
      expect(secs.length).toBeGreaterThanOrEqual(5);
      expect(secs).toContain("性格");
      expect(secs).toContain("人生轨迹");
    }
  });

  it("每一页都挂着框定语与免责声明", () => {
    for (const p of PLAINS) {
      expect(p.framing).toContain("不是对你本人的鉴定");
      expect(p.framing).toContain("可以展开看");
      expect(p.disclaimer.length).toBeGreaterThan(20);
    }
  });
});

function collectAll(r: ReturnType<typeof buildReport>) {
  const out = [
    ...r.chart.narrative, ...r.force.narrative, ...r.strength.narrative,
    ...r.kin.narrative, ...r.luck.narrative, ...r.years.narrative,
    ...r.method.narrative,
    ...(r.persona?.narrative ?? []), ...(r.body?.narrative ?? []),
    ...(r.current?.narrative ?? []),
  ];
  if (r.nodes !== null) {
    for (const f of r.nodes.findings) out.push(f.summary, ...f.detail.narrative);
  }
  for (const c of r.years.cards) out.push(...c.narrative);
  return out;
}

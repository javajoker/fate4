import { describe, expect, it } from "vitest";
import {
  DISCLAIMER, NARRATIVE_TEMPLATES, TEMPLATES_BY_ID, type NarrativeTemplate,
} from "../src/report/templates.js";
import {
  MissingSlotError, placeholdersOf, renderTemplate,
} from "../src/report/render.js";
import { formatViolations, scanText } from "../src/report/guard.js";
import { YINGQI_RULES } from "../src/yingqi/rules.js";
import { DOMAIN_LABEL } from "../src/yingqi/types.js";
import { SHENSHA_DEFS } from "../src/shensha/tables.js";
import { buildChart } from "../src/chart/buildChart.js";
import { buildBaseChart } from "../src/chart/baseChart.js";
import { buildReport, collectReportText } from "../src/report/assemble.js";
import { renderMarkdown } from "../src/report/markdown.js";
import { dayView, luckTimeline, monthView } from "../src/temporal/views.js";
import type { BirthInput } from "../src/chart/types.js";

describe("模板库的自洽性", () => {
  const localeTexts = (t: NarrativeTemplate): [string, string][] => {
    const out: [string, string][] = [["zhHans", t.text.zhHans], ["en", t.text.en]];
    if (t.text.zhHant !== undefined) out.push(["zhHant", t.text.zhHant]);
    if (t.hedged !== undefined) {
      out.push(["hedged.zhHans", t.hedged.zhHans], ["hedged.en", t.hedged.en]);
      if (t.hedged.zhHant !== undefined) out.push(["hedged.zhHant", t.hedged.zhHant]);
    }
    return out;
  };

  it("id 唯一", () => {
    expect(TEMPLATES_BY_ID.size).toBe(NARRATIVE_TEMPLATES.length);
  });

  it("slots 声明与各语言文本中的占位符对账", () => {
    // 两份独立表述必须一致：slots 是人写的清单，占位符是文本里实际出现的。
    // 只对其一，报告里就会留下裸 {slot}，或在渲染时抛缺值错。
    //
    // 正常措辞要求**完全相等**；hedged 只要求是**子集** ——
    // 降级本来就可能连同某个细节一起收回（geju 的 hedged 就不再报相神）。
    for (const t of NARRATIVE_TEMPLATES) {
      const declared = [...new Set(t.slots)].sort();
      for (const [which, text] of localeTexts(t)) {
        const found = [...placeholdersOf(text)].sort();
        if (which.startsWith("hedged")) {
          for (const f of found) {
            expect(declared, `${t.id}.${which} 用到了未声明的槽位 {${f}}`).toContain(f);
          }
        } else {
          expect(found, `${t.id}.${which} 与 slots 声明不符`).toEqual(declared);
        }
      }
    }
  });

  it("confidenceFloor > 0 的模板必须带 hedged —— 否则降级机制无处可去", () => {
    for (const t of NARRATIVE_TEMPLATES) {
      if (t.confidenceFloor > 0) {
        expect(t.hedged, `${t.id} 声明了置信度门槛却没有留有余地的措辞`).toBeDefined();
      }
    }
  });

  it("hedged 措辞必须真的在留余地 —— 按语义查，不按长度查", () => {
    // 起初这条写作「hedged 不得比正常措辞更短」。它是错的：
    // kin.neither 的 hedged 恰恰**删掉**了「传统上……」那句断语 ——
    // 判别本就不可靠时，连传统解读一并收回，是正确的降级方向，而它使文本变短。
    // 长度不是留余地的度量，限定语才是。
    // 「有限」刻意不列：kin.neither 的正常措辞里「助力有限」是在描述结构，不是在打折。
    const ZH = /倾向|偏向|接近|两说|两存|不远|贴近|尚可|一并列出|分辨力/;
    const EN = /leans|arguable|equally defensible|close to|weakly|not clean|borderline|alongside/i;
    for (const t of NARRATIVE_TEMPLATES) {
      if (t.hedged === undefined) continue;
      expect(ZH.test(t.hedged.zhHans), `${t.id} 的 hedged 中文未见任何限定语`).toBe(true);
      expect(EN.test(t.hedged.en), `${t.id} 的 hedged 英文未见任何限定语`).toBe(true);
      // 且正常措辞里不该出现这些限定语 —— 否则两版没有区别
      expect(ZH.test(t.text.zhHans), `${t.id} 的正常措辞已经在打折，与 hedged 无从区分`).toBe(false);
    }
  });

  it("模板文本里不得写 Markdown —— 同一份文本要进 Web、CLI、JSON", () => {
    // 报告层的模板同时喂给 Markdown 导出、Web 的纯文本渲染、CLI 与 Skill 的 JSON。
    // 只有 Markdown 认得 `**粗体**`，其余三处会原样显示成星号。
    // 强调不是承重的东西，去掉即可 —— 让模板保持格式中立。
    for (const t of NARRATIVE_TEMPLATES) {
      for (const [which, text] of localeTexts(t)) {
        expect(text, `${t.id}.${which} 含 Markdown 粗体`).not.toMatch(/\*\*[^*]+\*\*/);
        expect(text, `${t.id}.${which} 含 Markdown 代码跨度`).not.toMatch(/`[^`]+`/);
        expect(text, `${t.id}.${which} 含 Markdown 链接`).not.toMatch(/\[[^\]]+\]\([^)]+\)/);
      }
    }
  });

  it("繁体由 toHant 生成，手写的 zhHant 优先", () => {
    // 原先此处断言「繁体全缺席」。现由 hant.ts 转换 —— 那不是机械降级：
    // 一简对多繁的字要么有写明理由的定夺，要么抛错。详见 hant.spec.ts。
    for (const t of NARRATIVE_TEMPLATES) {
      if (t.text.zhHant === undefined) continue;
      expect(placeholdersOf(t.text.zhHant), `${t.id} 繁体的槽位与简体不一致`)
        .toEqual(placeholdersOf(t.text.zhHans));
    }
    expect(DISCLAIMER.zhHant ?? DISCLAIMER.zhHans).toContain("四柱");
  });
});

// ═══════════════════════════════════════════════════════════
// 措辞守卫
// ═══════════════════════════════════════════════════════════

describe("措辞守卫 —— 拦断言的形状，不拦词", () => {
  const hits = (t: string, kind: "narrative" | "vocabulary" = "narrative") =>
    scanText(t, "test", { kind }).map((v) => v.ruleId);

  it("**新增三条：病名、易感式断语、概率陈述**", () => {
    const cases: readonly [string, string][] = [
      ["此运需防高血压。", "zh.medical.diseaseName"],
      ["木弱者多有结石。", "zh.medical.diseaseName"],
      ["本盘肝系易感。", "zh.medical.contract"],
      ["土弱者恐有脾胃之疾。", "zh.medical.contract"],
      ["该年发生变动的概率为 5%。", "zh.stats.probability"],
      ["此为 5% 的概率事件。", "zh.stats.probability"],
    ];
    for (const [text, ruleId] of cases) {
      expect(hits(text), `「${text}」应命中 ${ruleId}`).toContain(ruleId);
    }
  });

  it("病名无条件禁止，但「炎上」「之中，风」不是病名", () => {
    // 火曰炎上是五行的本义；「五气之中，风为木之气」里的「中风」是断句巧合。
    expect(hits("火之性明朗炎上。")).not.toContain("zh.medical.diseaseName");
    expect(hits("五气之中，风为木之气。")).not.toContain("zh.medical.diseaseName");
    expect(hits("此结构易生炎症。")).toContain("zh.medical.diseaseName");
  });

  it("**脏腑段：框定语与免责导向缺一即拦**（判定域为「段」）", () => {
    const organ = "《内经》五行配属中，木应肝与胆，在窍为目，在体为筋。";
    const disclaim = "以上为传统对照与盘面数值的并列陈述，不构成任何关于身体状况的判断；"
      + "健康相关的决定请咨询持证专业人士。";
    // 只有框定，没有免责 → 拦
    expect(hits(organ)).toContain("zh.body.framing");
    // 只有免责，没有框定 → 也拦（此句提到脏腑但不说是传统对照）
    expect(hits(`木弱则肝与胆当留意。${disclaim.replace("传统对照与盘面数值的并列陈述，", "")}`))
      .toContain("zh.body.framing");
    // 两者俱全 → 放行
    expect(hits(organ + disclaim)).not.toContain("zh.body.framing");
  });

  it("段与段之间不互相担保 —— 免责声明不能替别的段落把关", () => {
    // 一份 Markdown 里，第五条列表项的免责声明不该替第二条把关，
    // 因为读者只会读到第二条。故段界取空行与 Markdown 块首。
    const doc = [
      "- 《内经》五行配属中，木应肝与胆，在窍为目。",
      "- 另一条无关的话。",
      "- 以上为传统对照，不构成任何关于身体状况的判断；请咨询持证专业人士。",
    ].join("\n");
    expect(hits(doc), "跨列表项的免责被误判为有效").toContain("zh.body.framing");

    // 同一条之内则放行
    const ok = "- 《内经》五行配属中，木应肝与胆。以上为传统对照，"
      + "不构成任何关于身体状况的判断；请咨询持证专业人士。";
    expect(hits(ok)).not.toContain("zh.body.framing");
  });

  it("每条禁令都拦得住一个真实的反例", () => {
    // 每一类都给一个具体的坏句子。这条测试若某天空转，禁令表就形同虚设。
    const cases: readonly [string, string][] = [
      ["命主 2027 年会离婚。", "zh.prediction.lifeEvent"],
      ["此运必然破格。", "zh.prediction.absolute"],
      ["注意心脏疾病。", "zh.medical.warning"],
      ["命主肝胆偏弱。", "zh.medical.organ"],
      ["此结构易患脾胃之疾。", "zh.medical.contract"],
      ["该年适合投资置业。", "zh.financial.advice"],
      ["行此运必发财。", "zh.financial.outcome"],
      ["流年冲太岁，会有官司。", "zh.legal.outcome"],
      ["命带孤鸾，因此婚姻不顺。", "zh.shensha.verdict"],
      ["此命命格评分 82 分。", "zh.score.grade"],
      ["对方性格急躁。", "zh.thirdParty.persona"],
      ["你的日主偏弱。", "zh.secondPerson.address"],
      ["This chart will definitely turn.", "en.prediction.absolute"],
      ["The chart score: 82 out of 100.", "en.score.grade"],
      ["Beware of heart disease in that decade.", "en.medical.warning"],
    ];
    for (const [text, ruleId] of cases) {
      expect(hits(text), `「${text}」应命中 ${ruleId}`).toContain(ruleId);
    }
  });

  it("术语与传统语汇不误伤 —— 否则守卫会被关掉", () => {
    // 朴素黑名单在本领域必然失败的那一半：禁掉「病」等于禁掉自己的取用神法。
    const clean = [
      "取水为用，法从病药：土为病，取木去之。",
      "其他条件相同的两张盘，结论可能不同。",
      // 脏腑段须**同时**带传统框定与免责导向 —— 缺一即拦，见 zh.body.framing
      "《内经》五行配属中，木应肝与胆，在窍为目。以上为传统对照，"
        + "不构成任何关于身体状况的判断；健康相关的决定请咨询持证专业人士。",
      "五气之中，风为木之气，与中焦无涉。",   // 「之中，风」不是中风
      "传统上灾煞与灾厄、疾病一类语汇相联系。",
      "顺逆指数衡量的是当年五行结构与本命喜用的契合度。",
      "月令格局为七杀格，凶神逆用，相神取食神。",
    ];
    for (const t of clean) {
      expect(hits(t), `「${t}」被误伤`).toEqual([]);
    }
  });

  it("allow 窗只豁免紧邻的合法复合词，不豁免整句", () => {
    // 若 allow 用整句作窗，下面这句会因为含「其他」而整句放行 —— 那正是要拦的东西。
    expect(hits("其他情况下，对方身体偏弱。")).toContain("zh.thirdParty.persona");
  });

  it("requireContext 要的是框定语，不是关键词的存在", () => {
    expect(hits("木对应肝胆。")).toContain("zh.medical.correspondence");
    expect(hits("传统上木对应肝胆。")).not.toContain("zh.medical.correspondence");
  });

  it("词汇不是断语 —— vocabulary 跳过 requireContext，但禁令照拦", () => {
    expect(hits("血光", "narrative")).toContain("zh.health.framing");
    expect(hits("血光", "vocabulary")).toEqual([]);
    expect(hits("你", "vocabulary")).toContain("zh.secondPerson.address");
  });

  it("跨语言扫描 —— 中文段落里混入英文断言也拦得住", () => {
    expect(hits("日主偏弱，you will certainly prosper。")).toContain("en.prediction.absolute");
  });

  it("强制声明本身通过扫描", () => {
    expect(hits(DISCLAIMER.zhHans)).toEqual([]);
    expect(hits(DISCLAIMER.en)).toEqual([]);
  });

  it("既有的全部叙述词汇通过扫描", () => {
    for (const r of YINGQI_RULES) {
      expect(hits(r.narrativeTag, "vocabulary"), r.id).toEqual([]);
      expect(hits(r.name, "vocabulary"), r.id).toEqual([]);
    }
    for (const d of SHENSHA_DEFS) {
      expect(hits(d.name, "vocabulary"), d.name).toEqual([]);
      for (const t of d.narrativeTags) expect(hits(t, "vocabulary"), `${d.name}/${t}`).toEqual([]);
    }
    for (const v of Object.values(DOMAIN_LABEL)) expect(hits(v, "vocabulary")).toEqual([]);
  });

  it("模板库整体通过扫描 —— 这是 P9 的验收判据", () => {
    const vs = [];
    for (const t of NARRATIVE_TEMPLATES) {
      vs.push(...scanText(t.text.zhHans, `${t.id}.zhHans`));
      vs.push(...scanText(t.text.en, `${t.id}.en`));
      if (t.hedged !== undefined) {
        vs.push(...scanText(t.hedged.zhHans, `${t.id}.hedged.zhHans`));
        vs.push(...scanText(t.hedged.en, `${t.id}.hedged.en`));
      }
    }
    expect(formatViolations(vs)).toBe("措辞扫描通过。");
  });
});

// ═══════════════════════════════════════════════════════════
// 模板求值
// ═══════════════════════════════════════════════════════════

describe("模板求值", () => {
  const slots = { dm: "丁", monthBranch: "巳", ratio: "45.0%", rootScore: "1.0", margin: "0.0004" };

  it("置信度低于门槛自动切 hedged，调用方无从绕过", () => {
    const hi = renderTemplate("strength.weak", slots, { confidence: 0.9 });
    const lo = renderTemplate("strength.weak", slots, { confidence: 0.3 });
    expect(hi.hedged).toBe(false);
    expect(lo.hedged).toBe(true);
    expect(lo.text).toContain("临界");
    expect(hi.text).not.toContain("临界");
  });

  it("恰在门槛上不降级，门槛之下才降级", () => {
    const t = TEMPLATES_BY_ID.get("strength.weak")!;
    expect(renderTemplate("strength.weak", slots, { confidence: t.confidenceFloor }).hedged).toBe(false);
    expect(renderTemplate("strength.weak", slots, { confidence: t.confidenceFloor - 1e-9 }).hedged).toBe(true);
  });

  it("槽位缺值抛错，不留裸花括号", () => {
    expect(() => renderTemplate("strength.weak", { dm: "丁" })).toThrow(MissingSlotError);
    const line = renderTemplate("strength.weak", slots, { confidence: 1 });
    expect(line.text).not.toMatch(/[{}]/);
  });

  it("繁体在**填槽之后**转换 —— 槽位值也得转", () => {
    const hans = renderTemplate("strength.weak", slots, { locale: "zh-Hans" });
    const hant = renderTemplate("strength.weak", slots, { locale: "zh-Hant" });
    expect(hant.text).not.toBe(hans.text);
    expect(hant.text).not.toMatch(/[为个说时无这运财权气数体传应过强当]/);
  });

  it("每条叙述都带来源指向 —— 报告不做新判断", () => {
    const line = renderTemplate("strength.weak", slots, { confidence: 1 });
    expect(line.source.ref.length).toBeGreaterThan(0);
    expect(line.templateId).toBe("strength.weak");
  });
});

// ═══════════════════════════════════════════════════════════
// 报告组装
// ═══════════════════════════════════════════════════════════

const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};

/** 覆盖四季、南北经度、两种性别、含时辰未知的一组样本。 */
const SAMPLES: readonly BirthInput[] = [
  EXAMPLE,
  { year: 1968, month: 1, day: 9, hour: 5, minute: 5, gender: "female", timeZone: "Asia/Shanghai", longitude: 113.3 },
  { year: 1975, month: 8, day: 30, hour: 23, minute: 40, gender: "male", timeZone: "Asia/Shanghai", longitude: 87.6 },
  { year: 1984, month: 11, day: 2, hour: 12, minute: 0, gender: "female", timeZone: "Asia/Taipei", longitude: 121.5 },
  { year: 2001, month: 3, day: 21, hour: 18, minute: 15, gender: "male", timeZone: "Asia/Shanghai", longitude: 104.1 },
  { year: 1962, month: 7, day: 23, hour: 14, minute: 20, gender: "male", timeZone: "Asia/Shanghai", longitude: 116.4 },
  { year: 1995, month: 12, day: 31, hour: 0, minute: 30, gender: "female", timeZone: "Asia/Shanghai", longitude: 121.47 },
  { year: 1958, month: 5, day: 5, hour: 0, minute: 0, gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47, unknownHour: true },
];

const OPTS = { now: { year: 2026, month: 9, day: 1 }, curveYears: 40, cardYears: { from: 2024, to: 2028 } };

describe("报告组装", () => {
  const base2 = buildBaseChart(buildChart(EXAMPLE));
  const reports = SAMPLES.map((s) => buildReport(buildChart(s), OPTS));

  it("八节俱在，声明首尾各一次", () => {
    for (const r of reports) {
      expect(r.chart.pillars.length).toBeGreaterThanOrEqual(3);
      expect(r.force.flows.length).toBeGreaterThan(0);
      expect(r.strength.strength.derivation.length).toBeGreaterThan(0);
      expect(r.kin.readings).toHaveLength(5);
      expect(r.luck.steps.length).toBeGreaterThan(0);
      expect(r.years.curve).toHaveLength(40);
      expect(r.current).not.toBeNull();
      expect(r.method.pendingCalibration.length).toBeGreaterThan(0);
      expect(r.disclaimerTop).toBe(r.disclaimerBottom);
      expect(r.disclaimerTop).toContain("不构成医疗、法律、财务");
    }
  });

  it("**措辞扫描全绿** —— P9 的验收判据", () => {
    for (const [i, r] of reports.entries()) {
      expect(r.guard.scanned, `样本 ${i} 一段都没扫到，扫描形同虚设`).toBeGreaterThan(50);
      expect(formatViolations(r.guard.violations), `样本 ${i}`).toBe("措辞扫描通过。");
    }
  });

  it("中文报告里不得漏出英文枚举", () => {
    // P7b 已犯过一次（「月支寅害 month 支巳」）。枚举名是代码的词汇，不是读者的词汇。
    // 唯一豁免：出处一行含参数哈希与太阳黄经算法标识，本就是标识符。
    for (const [i, r] of reports.entries()) {
      for (const { text, where } of collectReportText(r)) {
        if (where.endsWith("method.provenance")) continue;
        expect(text, `样本 ${i} 的 ${where} 漏出了英文`).not.toMatch(/[A-Za-z]{3,}/);
      }
    }
  });

  it("每条叙述都能指回来源", () => {
    for (const r of reports) {
      const all = [r.chart, r.force, r.strength, r.kin, r.luck, r.years, r.method]
        .flatMap((s) => s.narrative);
      expect(all.length).toBeGreaterThan(0);
      for (const l of all) {
        expect(TEMPLATES_BY_ID.has(l.templateId), l.templateId).toBe(true);
        expect(l.source.ref.length).toBeGreaterThan(0);
      }
    }
  });

  it("低置信度的判定必定以留有余地的措辞出现", () => {
    for (const r of reports) {
      const strengthLine = r.strength.narrative.find((l) => l.templateId.startsWith("strength."))!;
      const t = TEMPLATES_BY_ID.get(strengthLine.templateId)!;
      expect(strengthLine.hedged).toBe(r.strength.strength.confidence < t.confidenceFloor);
    }
  });

  it("§3.6 取用与格局取向不一致时必须并列，不合并", () => {
    for (const r of reports) {
      const has = r.strength.narrative.some((l) => l.templateId === "geju.tension");
      expect(has, "并列说明与 tension 标志必须同进同出").toBe(r.strength.yongshenGejuTension);
    }
  });

  it("subject 为他人时，六亲叙述与神煞语义**不生成** —— 不靠扫描兜底", () => {
    const self = buildReport(buildChart(EXAMPLE), OPTS);
    const other = buildReport(buildChart(EXAMPLE), { ...OPTS, subject: "other" });
    expect(self.kin.narrative.length).toBeGreaterThan(0);
    expect(other.kin.narrative).toHaveLength(0);
    expect(other.kin.narrativeOmitted).toBe(true);
    // 结构表仍在 —— 略去的是对人的描述，不是数据
    expect(other.kin.readings).toHaveLength(5);
    expect(other.chart.narrative.some((l) => l.templateId === "shensha.tone")).toBe(false);
  });

  it("卡片窗口落在曲线跨度之外时，§6.2 仍照常产出", () => {
    // 曲线与卡片是两个产品、两个区间。原实现把卡片挂在曲线循环里，
    // 窗口一旦越出跨度，那一节就**静默变空** —— 报告里没了，也不说为什么。
    const r = buildReport(buildChart(EXAMPLE), {
      curveYears: 20,                       // 1990–2009
      now: { year: 2060, month: 1, day: 1 }, // 卡片窗口 2059–2064，远在曲线之外
    });
    expect(r.years.curve).toHaveLength(20);
    expect(r.years.cards).toHaveLength(6);
    expect(r.years.cards.map((c) => c.view.year)).toEqual([2059, 2060, 2061, 2062, 2063, 2064]);
  });

  it("曲线与卡片重叠的年份只解一次", () => {
    // 两个环各自遍历，重叠处若不缓存就会把同一年算两遍。
    const r = buildReport(base2, { now: { year: 2026, month: 9, day: 1 }, curveYears: 60 });
    const overlap = r.years.cards.filter(
      (c) => r.years.curve.some((p) => p.year === c.view.year));
    expect(overlap.length).toBeGreaterThan(0);
    for (const c of overlap) {
      const fromCurve = r.years.curve.find((p) => p.year === c.view.year)!;
      expect(c.view.favorIndex).toBe(fromCurve.favorIndex);
    }
  });

  it("不取系统时间：不给 now 则第七节整节缺席", () => {
    const r = buildReport(buildChart(EXAMPLE), { curveYears: 5 });
    expect(r.current).toBeNull();
  });

  it("纯函数 —— 同一输入两次组装逐字相同", () => {
    const a = renderMarkdown(buildReport(buildChart(EXAMPLE), OPTS));
    const b = renderMarkdown(buildReport(buildChart(EXAMPLE), OPTS));
    expect(a).toBe(b);
  });

  it("导出必带参数快照与引擎版本 —— 否则旧报告无从复算", () => {
    const md = renderMarkdown(reports[0]!);
    expect(md).toContain(reports[0]!.method.paramsHash);
    expect(md).toContain(reports[0]!.method.engineVersion);
    expect(md.split("本报告为四柱命理的计算实现").length - 1, "声明须首尾各一次").toBe(2);
  });

  it("Markdown 全文同样不漏英文（含表格）", () => {
    for (const r of reports) {
      for (const line of renderMarkdown(r).split("\n")) {
        if (line.includes("`")) continue;   // 标识符一律裹在代码跨度里
        expect(line, "Markdown 表格里漏出了英文枚举").not.toMatch(/[A-Za-z]{3,}/);
      }
    }
  });

  it("时辰未知时，时柱不出现在盘面里", () => {
    const r = reports[SAMPLES.length - 1]!;
    expect(r.chart.pillars.map((p) => p.kind)).not.toContain("hour");
    expect(r.chart.narrative.some((l) => l.templateId === "warn.unknownHour")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 语料全量扫描 —— §6.4.1 的「构建期扫描」
// ═══════════════════════════════════════════════════════════

describe("语料全量扫描", () => {
  it("流月十二格、流日整月的叙述全部通过", () => {
    // 报告树扫的是被组装进来的那些。流月流日的叙述由 views 直接生成，
    // 不经模板 —— 它们同样会显示给读者，同样要扫。P7b 的英文漏出正出在这里。
    const vs = [];
    for (const s of [SAMPLES[0]!, SAMPLES[3]!]) {
      const chart = buildChart(s);
      for (let m = 0; m < 12; m++) {
        const mv = monthView(chart, 2026, m);
        for (const n of mv.narrative) vs.push(...scanText(n, `monthView.${m}`));
        for (const i of mv.interactions) vs.push(...scanText(i.detail, `monthView.${m}.interaction`));
      }
      for (let d = 1; d <= 31; d++) {
        const dv = dayView(chart, 2026, 3, d);
        vs.push(...scanText(dv.note, `dayView.3-${d}`));
        for (const c of dv.conflicts) vs.push(...scanText(c.detail, `dayView.3-${d}.conflict`));
        for (const hh of dv.harmonies) vs.push(...scanText(hh, `dayView.3-${d}.harmony`));
      }
      for (const st of luckTimeline(chart)) {
        vs.push(...scanText(st.stemPhaseSummary, `luck.${st.index}.stem`));
        vs.push(...scanText(st.branchPhaseSummary, `luck.${st.index}.branch`));
      }
    }
    expect(formatViolations(vs)).toBe("措辞扫描通过。");
  });

  it("推导链与替代解读同样通过 —— 它们也会印在报告里", () => {
    const vs = [];
    for (const s of SAMPLES) {
      const r = buildReport(buildChart(s), { curveYears: 3 });
      for (const v of [r.strength.strength, r.strength.yongshen, r.strength.geju,
        r.strength.specialPattern]) {
        for (const d of v.derivation) {
          vs.push(...scanText(d.detail, "derivation.detail"));
          vs.push(...scanText(d.step, "derivation.step"));
        }
        for (const a of v.alternatives) vs.push(...scanText(a.reason, "alternative.reason"));
      }
    }
    expect(formatViolations(vs)).toBe("措辞扫描通过。");
  });

  it("扫描确实在做事 —— 植入一句违规必须被逮到", () => {
    // 反向对照。没有这一条，上面几条全绿也可能只是因为扫描根本没跑。
    const planted = "命主 2029 年会离婚，且必然破财。";
    expect(scanText(planted, "planted").length).toBeGreaterThanOrEqual(2);
    expect(formatViolations(scanText(planted, "planted"))).not.toBe("措辞扫描通过。");
  });
});

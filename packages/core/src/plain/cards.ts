/**
 * 人话卡片 —— 把报告的判定转成平常话，并挂上它的来历。
 *
 * ## 一张卡片 ≠ 一句技术叙述
 *
 * 「你的底子偏轻」这一句，概括的是旺衰、通根、党势三条技术判定。
 * 故卡片与技术叙述是**多对一**：`evidence` 里放的是报告里那几行的**原文**，
 * 不重写、不缩写。这一条是本层最要紧的诚实性保证 ——
 * 人话是概括，而读者随时能看到被概括的是什么。
 *
 * ## 人话由枚举查表得到
 *
 * 每张卡片的正文都来自 `vocab.ts` 的定值映射，键是判定里的**枚举值**
 * （旺衰档、象限、五行状态、节点方向）。于是人话不可能漂离技术层：
 * 想改人话，得先改那个枚举的含义。
 *
 * 逐盘自由撰写读起来更自然，但那一层一旦松动，「报告不做新判断」就守不住了 ——
 * 而人话层恰恰是最容易松动的一层，因为它读起来本就不像在下判断。
 */

import type { Report } from "../report/types.js";
import type { NarrativeLine } from "../report/render.js";
import { ELEMENTS } from "../types/ganzhi.js";
import {
  AXIS_PLAIN, DIRECTION_PLAIN, ELEMENT_PLAIN, ELEMENT_STATE_PLAIN,
  ELEMENT_BODY_PLAIN, GOD_PLAIN, GOD_RELATION_PLAIN, QUADRANT_PLAIN, STRENGTH_PLAIN,
  confidencePlain, domainOfSeries, favorPlain, PLAIN_DISCLAIMER, PLAIN_FRAMING,
} from "./vocab.js";

export type PlainSection =
  | "性格" | "身心" | "亲近的人" | "人生轨迹" | "起伏" | "今年" | "本月" | "今天";

export interface PlainCard {
  readonly id: string;
  readonly section: PlainSection;
  readonly title: string;
  readonly body: string;
  /** 「看依据」展开后显示的**报告原文**。不重写、不缩写。 */
  readonly evidence: readonly NarrativeLine[];
  readonly confidence: number;
}

export interface PlainReport {
  readonly cards: readonly PlainCard[];
  /** 小节级的说明。放在小节开头说一次，不在每张卡片上重复。 */
  readonly sectionNotes: Readonly<Partial<Record<PlainSection, string>>>;
  /** 每一页都要挂的框定语。 */
  readonly framing: string;
  /** 人话版的免责声明 —— 技术版的改写，四个要素一个不少。 */
  readonly disclaimer: string;
  /** 技术版的免责声明原文，供「看依据」一并展示。 */
  readonly disclaimerTechnical: string;
}

const card = (
  id: string, section: PlainSection, title: string, body: string,
  evidence: readonly NarrativeLine[], confidence = 1,
): PlainCard => ({
  id, section, title,
  body: body + confidencePlain(confidence),
  evidence, confidence,
});

/** 取报告某一节里模板 id 以某前缀起头的那几行 —— 作卡片的来历。 */
const linesOf = (ls: readonly NarrativeLine[], ...prefixes: string[]): NarrativeLine[] =>
  ls.filter((l) => prefixes.some((p) => l.templateId.startsWith(p)));

export function plainCards(r: Report): PlainReport {
  const cards: PlainCard[] = [];

  // ── 性格 ──
  const band = r.strength.strength.value;
  cards.push(card("self.strength", "性格", "你的底子",
    STRENGTH_PLAIN[band] ?? "这一项没有算出明确的倾向。",
    linesOf(r.strength.narrative, "strength.", "root."),
    r.strength.strength.confidence));

  const y = r.strength.yongshen.value;
  cards.push(card("self.setting", "性格", "什么场合让你省力",
    `${ELEMENT_PLAIN[y.primary]}最合你的结构；`
    + `${y.xishen.map((e) => ELEMENT_PLAIN[e]).join("、")}也帮得上。`
    + "这说的是场合的性质，不是地方、不是行业、也不是该找什么样的人。",
    linesOf(r.strength.narrative, "yongshen."), r.strength.yongshen.confidence));

  if (r.persona !== null) {
    const p = r.persona.persona;
    const inner = p.dominantInner.value.map((g) => GOD_PLAIN[g]).join("；");
    const outer = p.dominantOuter.value.map((g) => GOD_PLAIN[g]).join("；");
    cards.push(card("self.inner", "性格", "你自己知道的那一面",
      `${inner}。这是不太外露、多半只有你自己清楚的部分。`,
      linesOf(r.persona.narrative, "persona.inner", "persona.dominant"),
      p.dominantInner.confidence));
    cards.push(card("self.outer", "性格", "别人看到的那一面",
      `${outer}。这是容易被外人接住的部分。`,
      linesOf(r.persona.narrative, "persona.outer", "persona.reveal"),
      p.dominantOuter.confidence));

    const t = p.innerOuterTension;
    cards.push(card("self.tension", "性格", "里外一致吗",
      t >= 0.7 ? "你里面想的和外面显出来的差得比较多 —— 不是表里不一，"
        + "是两套劲儿用在了不同地方，容易觉得累。"
        : t >= 0.45 ? "你里外有些差别，但不算大，多数场合对得上。"
          : "你里外比较一致，想什么大致就显出什么。",
      linesOf(r.persona.narrative, "persona.tension")));

    if (p.absent.length > 0) {
      cards.push(card("self.absent", "性格", "你这里比较空",
        `${p.absent.map((g) => GOD_PLAIN[g]).join("；")} —— 这几路在你的结构里几乎没有着落。`
        + "空不等于缺陷，只是这方面的劲要靠外部条件给。",
        linesOf(r.persona.narrative, "persona.absent", "persona.deficient")));
    }
  }

  // ── 身心（只出形体倾向，不出五官、不出病名、不出预后） ──
  if (r.body !== null) {
    const b = r.body.body;
    cards.push(card("body.axes", "身心", "整体的底色",
      `${AXIS_PLAIN[b.axes.heatLabel]}、${AXIS_PLAIN[b.axes.drynessLabel]}。`
      + "这是传统对照给出的形体倾向，非体检结论，不构成关于身体状况的判断。",
      linesOf(r.body.narrative, "body.axes", "body.")));
    // ⚠️ 用 ELEMENT_BODY_PLAIN 而非 ELEMENT_PLAIN —— 后者说的是「什么场合」，
    // 拿来说身体会得出「需要被看见的场合上这一路偏盛」这种范畴错误的句子。
    const focus = b.focus.map((e) => {
      const d = b.details[e];
      return `${ELEMENT_BODY_PLAIN[e]}，${ELEMENT_STATE_PLAIN[d.state] ?? "情况不明"}`;
    }).join("；");
    if (focus !== "") {
      // zh.body.framing 要求**同时**带传统框定与免责导向，缺一即拦 ——
      // 全表唯一一条这样的规则，因为脏腑是最容易被当成医嘱的一节。
      // 人话层不但不该绕过它，还该比技术层说得更直白。
      cards.push(card("body.focus", "身心", "值得留意的几路",
        `按传统的五行配属，${focus}。这只是一套传统对照，`
        + "不构成任何关于身体状况的判断，也给不出具体的病和时间；"
        + "身体上的事请咨询医生。",
        linesOf(r.body.narrative, "body.element", "body.")));
    }
  }

  // ── 亲近的人（只说相处结构，不描述别人） ──
  if (!r.kin.narrativeOmitted) {
    // 六亲的叙述按 readings 的次序逐条产出，模板 id 只表象限（kin.bothFavorable 一类），
    // 故按下标对齐而不是按 id 前缀找 —— 按 id 找会把五条六亲的叙述全都算给第一条。
    const kinLines = r.kin.narrative.filter((l) => l.templateId.startsWith("kin."));
    for (const [i, k] of r.kin.readings.entries()) {
      const ev = kinLines[i];
      cards.push(card(`kin.${k.kin}`, "亲近的人", k.label,
        `${QUADRANT_PLAIN[k.quadrant] ?? "这一路的结构不明显。"}`
        + `与之相关的多是${GOD_RELATION_PLAIN[k.starGod]}。`,
        ev === undefined ? [] : [ev], k.confidence));
    }
  }

  // ── 人生轨迹 ──
  // 与六亲同理：luck.step 的模板 id 不含步序，按下标对齐而不是按前缀找 ——
  // 按前缀找会把十几条叙述全都算给每一步。
  const luckLines = r.luck.narrative.filter((l) => l.templateId === "luck.step");
  for (const s of r.luck.steps) {
    const mid = s.samples.find((x) => x.at === "mid") ?? s.samples[0]!;
    const age = Math.round(s.startAgeYears);
    cards.push(card(`luck.${s.index}`, "人生轨迹", `${age} 岁起的十年`,
      `${favorPlain(mid.favorIndex)}。`
      + "十年是一段，段与段之间会换气，换的那一两年往往最有感觉。",
      // ⚠️ LuckStep.index 自 1 起，数组自 0 起 —— 直接拿 index 当下标会整体错开一格，
      // 而错开一格的「依据」看上去毫无异样：每张卡都有依据，只是全是隔壁那一步的。
      [luckLines[s.index - 1]].filter((x): x is NarrativeLine => x !== undefined)));
  }

  // ── 起伏（统计节点） ──
  if (r.nodes !== null) {
    for (const f of r.nodes.findings.slice(0, 8)) {
      // 时间段与指事都从 evidence 里取 —— 它们本就在那儿，
      // 不必也不该在人话层另算一遍。
      const num = (label: string) => f.detail.evidence.find((e) => e.label === label)?.value;
      const from = num("进入"); const to = num("退出");
      const span = from === undefined ? ""
        : to === undefined || to === from ? `${from} 年` : `${from}–${to} 年`;
      const ref = f.detail.evidence.find((e) => e.ref.startsWith("node:"))?.ref ?? "";
      const domain = domainOfSeries(ref.slice("node:".length));

      cards.push(card(`node.${f.id}`, "起伏",
        span === "" ? "一段值得留意的时期" : span,
        // 那段「这是排序不是概率」的话只在小节说一次 —— 八张卡各说一遍，
        // 读者会跳过它，而它恰恰是最不该被跳过的一句。
        (domain === null ? "" : `${domain}，`)
        + `${DIRECTION_PLAIN[f.direction] ?? "这段时间变动明显"}。`,
        [f.summary, ...f.detail.narrative], f.confidence));
    }
  }

  // ── 今年 / 本月 / 今天 ──
  if (r.current !== null) {
    /**
     * 该时点被引动的神煞及其指事。
     *
     * 神煞是**叙述素材**，不入权重。它回答的是「这一刻的变化，传统上会挂在
     * 哪一类事上」—— 如金舆指向车马出行。**指事说的是符号与哪类事相联系，
     * 不是会发生什么。**
     */
    const tagsOf = (hits: readonly { name: string; palace: string; tone: string;
      narrativeTags: readonly string[] }[]) => hits
      .filter((h) => h.tone === "activated" && h.narrativeTags.length > 0)
      .map((h) => `${h.name}（落${h.palace}）指向「${h.narrativeTags.join("、")}」一类的事`);

    const yearTags = tagsOf(r.current.year.evaluated.shensha);
    const dayTags = r.current.day.shensha.map(
      (h) => `${h.name}（落${h.palace}）指向「${h.narrativeTags.join("、")}」一类的事`);

    cards.push(card("cur.year", "今年", "今年整体",
      `${favorPlain(r.current.year.favorIndex)}。这说的是今年的结构与你本命的契合程度，`
      + "不是运气好坏，更不是生活质量。"
      + (yearTags.length === 0 ? ""
        : `今年被引动的传统符号有：${yearTags.slice(0, 4).join("；")}。`
          + "这是说这些符号在传统上与哪类事相联系，不是说这些事会发生。"),
      linesOf(r.current.narrative, "year.")));
    cards.push(card("cur.month", "本月", "这个月",
      r.current.month.narrative.length > 0
        ? "这个月有几处被牵动的地方，展开可以看到是哪些。"
        : "这个月没有特别被牵动的地方。",
      linesOf(r.current.narrative, "month.")));
    cards.push(card("cur.day", "今天", "今天",
      (r.current.day.conflicts.length > 0
        ? "今天有几处张力，展开可以看到在哪。"
        : "今天没有明显的张力。")
      + (dayTags.length === 0 ? ""
        : `今天的传统符号：${dayTags.slice(0, 3).join("；")}。`),
      linesOf(r.current.narrative, "day.")));
  }

  return {
    cards: Object.freeze(cards),
    sectionNotes: Object.freeze({
      起伏: "下面说的是「哪一类事」在某段时间里起伏大，不是会发生什么事 ——"
        + "这套模型给不出具体的事件。它把六十年的曲线拉出来，"
        + "找其中偏离常态最多的几段：是排序，不是概率，比的是你自己的其他时候。",
      今年: "顺手与否说的是这一年的结构与你本命的契合程度，不是运气好坏，也不是生活质量。",
      身心: "以下是传统的形体对照，不构成关于身体状况的判断，也给不出具体的病和时间。",
      亲近的人: "说的是你与这几类关系的相处结构，不是对方是什么样的人 ——"
        + "用你的出生时刻去描述另一个人，那是把一份推演套到没同意过的人身上。",
    }),
    framing: PLAIN_FRAMING,
    disclaimer: PLAIN_DISCLAIMER,
    disclaimerTechnical: r.disclaimerBottom,
  };
}

/** 供测试：全部五行，确保词表不漏。 */
export const ALL_ELEMENTS = ELEMENTS;

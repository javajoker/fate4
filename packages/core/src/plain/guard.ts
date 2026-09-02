/**
 * 人话层专用禁令 —— **比技术层更严，不是更松**。
 *
 * ## 为什么另立一套而不复用
 *
 * 技术层禁「你」（`zh.secondPerson.address`），理由是「第二人称把结构描述变成了
 * 对读者的断言」。人话层偏偏要用「你」—— 那是它平易近人的来源。
 *
 * 但那条理由并没有失效，只是转移了：**去掉术语等于去掉了天然的对冲**。
 * 「用神取木」晦涩，读者知道自己在看模型；「你适合往东发展」具体可执行，
 * 读起来像忠告。故人话层放开第二人称的同时，必须补上更硬的几条。
 *
 * 这一套是**新增**的，不改动 `report/guard.ts` 的任何一条 ——
 * 技术层照旧禁「你」，人话层走 {@link scanPlain}。
 */

import { biscript, GUARD_RULES, type GuardRule, type GuardViolation } from "../report/guard.js";
import { toHant } from "../report/hant.js";

const PLAIN_ONLY: readonly GuardRule[] = [
  {
    id: "zh.plain.actionable",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    // 方位、属相、颜色、数字、日期 —— 一切可以照着做的指定
    pattern: /(?:朝|向|去|往)?(?:正?[东西南北]方?|东南|东北|西南|西北)(?:发展|方位|有利|为吉|走)|属(?:鼠|牛|虎|兔|龙|蛇|马|羊|猴|鸡|狗|猪)(?:的人|之人)|(?:幸运|吉利)(?:色|数字|方位)|忌(?:穿|戴|用)/g,
    why: "人话层最容易滑向的就是这类可以照着做的指定。技术层本就不产出方位、"
      + "属相、颜色、数字，人话层更不许「翻译」出来 —— 那等于凭空造了一条建议。",
    fix: "只说结构与场合：「在需要沉静的场合状态更好」。",
  },
  {
    id: "zh.plain.fitness",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    pattern: /(?:很)?(?:适合|不适合|宜于|不宜)(?:做|从事|选择|走|当|去)?[^。；！？\n]{0,8}(?:工作|职业|行业|专业|岗位|创业|经商|从政|结婚|生育|投资|移民|留学|体制内)/g,
    why: "「适合做什么」是对人生路径的适配判断。一套按出生时刻推演的模型给不出它，"
      + "而人话读起来最像它给得出。",
    fix: "改为描述结构：「在有规则、有层级的环境里更省力」。",
  },
  {
    id: "zh.plain.imperative",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    pattern: /(?:^|[。；！？\n])\s*(?:不妨|记得|务必|切记|请务必|建议你|最好去|应该去|一定要)/g,
    why: "祈使句把描述变成了指令。人话层用第二人称，一旦再加祈使，就成了忠告。",
    fix: "去掉祈使，只留陈述。",
  },
  {
    id: "zh.plain.appearance",
    locale: "zh-Hans", category: "medical", mode: "forbid",
    pattern: /(?:相貌|长相|容貌|五官|颜值)[^。；！？\n]{0,6}(?:好|佳|美|丑|端正|出众|平平)|(?:眉|眼|鼻|口|脸)[^。；！？\n]{0,4}(?:好看|难看|有福|克夫|克妻)/g,
    why: "从出生时刻断相貌，比断性格更接近伪科学的人身判断。本系统只出形体倾向"
      + "（偏清瘦／偏敦厚一类），不出五官，不作美丑之评。",
    fix: "只说形体倾向，并标明是传统对照。",
  },
  {
    id: "zh.plain.otherPerson",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    pattern: /(?:你的?)?(?:朋友|配偶|伴侣|父母|子女|同事|上司)(?:是|会是|多半是|往往是)[^。；！？\n]{0,10}(?:的人|性格|脾气)/g,
    why: "用你的盘去描述另一个人，是把一份推演套到没有同意过的第三方身上。"
      + "本系统只出「你与这类关系的相处结构」。",
    fix: "改为描述相处结构：「这一路的关系在你的结构里分量足」。",
  },
  {
    id: "zh.plain.framing",
    locale: "zh-Hans", category: "prediction", mode: "requireContext",
    domain: "paragraph",
    // 人话层若出现「传统」二字之外的模型自指，须在同段带上框定
    pattern: /命[理盘格]|八字|五行|十神|用神|大运|流年/g,
    context: /传统|模型|这套|推演|不是对你本人的鉴定|可以展开看/,
    why: "人话层若漏出术语，必须同段说明它来自一套传统模型 ——"
      + "否则读者会把它当成对自己的鉴定。",
    fix: "同段补一句「这是一套传统模型的说法」。",
  },
];

/** 人话层的规则：技术层的全部，减去「禁第二人称」，加上本模块的六条。 */
export const PLAIN_RULES: readonly GuardRule[] = Object.freeze([
  ...GUARD_RULES["zh-Hans"].filter((r) => r.category !== "secondPerson"),
  ...PLAIN_ONLY,
  // 繁体由简体派生 —— 与 report/guard.ts 同一条思路。
  //
  // ⚠️ `context` 必须**简繁双写**，不能只转成繁体。触发词多为简繁同形
  // （五行、命理、八字），框定语却不同形 —— 只转繁体的话，繁体规则会在
  // 简体正文上必然误报「缺框定语」。这个 bug 在 report/guard.ts 修过一次，
  // 此处手写派生时又犯了一遍，故改为复用那边的 `biscript`。
  ...PLAIN_ONLY.map((r) => ({
    ...r,
    id: r.id.replace(/^zh\./, "zht."),
    locale: "zh-Hant" as const,
    pattern: new RegExp(toHant(r.pattern.source), r.pattern.flags),
    why: toHant(r.why),
    fix: toHant(r.fix),
    ...(r.context === undefined ? {} : { context: biscript(r.context) }),
    ...(r.allow === undefined ? {} : { allow: r.allow.map(biscript) }),
  })),
]);

/**
 * 扫描一段人话。
 *
 * 与 `scanText` 的差别只有两处：放开第二人称，另加六条。
 * 其余（预言、医疗、财务、法律、神煞断语、统计措辞、六爻成败词）**一条不减**。
 */
export const scanPlain = (text: string, where: string): GuardViolation[] =>
  scanWith(PLAIN_RULES, text, where);

/** 以给定规则集扫描。`scanText` 只认内建的三张表，故此处自行走一遍。 */
function scanWith(rules: readonly GuardRule[], text: string, where: string): GuardViolation[] {
  const out: GuardViolation[] = [];
  for (const rule of rules) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex = m.index + 1; continue; }
      const start = m.index; const end = start + m[0].length;
      if (rule.mode === "forbid") {
        const win = text.slice(Math.max(0, start - 4), Math.min(text.length, end + 4));
        if (rule.allow?.some((a) => a.test(win)) === true) { re.lastIndex = start + 1; continue; }
      } else {
        const scope = rule.domain === "paragraph" ? paragraphAround(text, start) : sentenceAround(text, start);
        if (rule.context?.test(scope) === true) { re.lastIndex = start + 1; continue; }
      }
      out.push({
        ruleId: rule.id, category: rule.category, locale: rule.locale, mode: rule.mode,
        ...(rule.domain === undefined ? {} : { domain: rule.domain }),
        match: m[0], index: start,
        excerpt: text.slice(Math.max(0, start - 14), Math.min(text.length, end + 14)),
        why: rule.why, fix: rule.fix, where,
      });
      re.lastIndex = start + 1;
    }
  }
  return out;
}

const SENT = /[。；！？\n]/;
function sentenceAround(text: string, i: number): string {
  let a = i; let b = i;
  while (a > 0 && !SENT.test(text[a - 1]!)) a--;
  while (b < text.length && !SENT.test(text[b]!)) b++;
  return text.slice(a, b + 1);
}
function paragraphAround(text: string, i: number): string {
  const a = text.lastIndexOf("\n", i);
  const b = text.indexOf("\n", i);
  return text.slice(a < 0 ? 0 : a + 1, b < 0 ? text.length : b);
}

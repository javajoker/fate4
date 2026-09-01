/**
 * 措辞守卫 —— [09-report](../../../../docs/09-report.md) §6 的可执行形式。
 *
 * ## 为什么不是「敏感词过滤」
 *
 * 朴素的子串黑名单在本领域必然失败，两个方向都会：
 *
 * - **误杀**：「病药」是本系统的取用神法之一（`yongshen.priority` 里就有 bingyao），
 *   「疾病」「血光」是神煞的传统语义标签。禁掉「病」，等于禁掉自己的术语表。
 * - **漏放**：「你 2027 年会离婚」里没有任何一个词单独有问题。
 *
 * 所以本守卫拦的是**断言的形状**，不是词。规则由「主体 + 情态 + 后果」构成，
 * 词汇本身一律放行。
 *
 * ## 两种模式
 *
 * | 模式 | 语义 | 判定窗口 |
 * | `forbid` | 命中即违规 | 命中处 ±4 字的 `allow` 豁免窗 |
 * | `requireContext` | 命中后，所在**整句**必须带框定语 | 句子 |
 *
 * 窗口大小的差别是刻意的：`allow` 要豁免的是「病药」这种紧邻的合法复合词，
 * 用整句作窗会让「病药用神在此，注意心脏病」整句放行 —— 那正是要拦的东西。
 * 而 `requireContext` 要求的是叙述框架（「传统上……」），框架是句级的。
 *
 * ## 词汇与断语
 *
 * `scanText` 的 `kind` 区分二者。神煞标签表里的「血光」是**词汇**，
 * 一个孤零零的名词不构成对任何人的断言，requireContext 类规则对它不适用；
 * 而报告正文里出现「血光」，就必须带上「传统上……之象」的框定。
 * 禁令类（forbid）规则对两者一视同仁。
 */

export type GuardLocale = "zh-Hans" | "zh-Hant" | "en";

export const GUARD_LOCALES: readonly GuardLocale[] = Object.freeze([
  "zh-Hans", "zh-Hant", "en",
]);

export type GuardCategory =
  | "prediction"      // §6.1 断言式预言
  | "medical"         // §6.1 医疗判断
  | "financial"       // §6.1 财务建议
  | "legal"           // §6.1 法律判断
  | "shenshaVerdict"  // §6.1 以神煞名直接作断语
  | "score"           // §6.1 吉凶总分
  | "thirdParty"      // §6.1 对他人的人格/健康描述
  | "secondPerson";   // §6.2 保留主体性

export type GuardMode = "forbid" | "requireContext";
export type TextKind = "narrative" | "vocabulary";

export interface GuardRule {
  readonly id: string;
  readonly locale: GuardLocale;
  readonly category: GuardCategory;
  readonly mode: GuardMode;
  /** 必须带 g 标志；`matchAll` 会克隆之，不污染 lastIndex。 */
  readonly pattern: RegExp;
  /** forbid：命中处 ±4 字窗内若匹配任一条，视为合法复合词，放行。 */
  readonly allow?: readonly RegExp[];
  /** requireContext：所在句须匹配，否则违规。 */
  readonly context?: RegExp;
  readonly why: string;
  readonly fix: string;
}

export interface GuardViolation {
  readonly ruleId: string;
  readonly category: GuardCategory;
  readonly locale: GuardLocale;
  readonly mode: GuardMode;
  readonly match: string;
  readonly index: number;
  readonly excerpt: string;
  readonly why: string;
  readonly fix: string;
  /** 调用方提供的定位串，如 "templates[strength.weak].zhHans"。 */
  readonly where: string;
}

const ALLOW_WINDOW = 4;
const EXCERPT_WINDOW = 14;
const SENTENCE_SEP = /[。！？；\n.!?;]/;

function windowAround(text: string, start: number, end: number, pad: number): string {
  return text.slice(Math.max(0, start - pad), Math.min(text.length, end + pad));
}

/** 命中处所在的一整句。requireContext 的判定域。 */
function sentenceAround(text: string, start: number, end: number): string {
  let a = start;
  while (a > 0 && !SENTENCE_SEP.test(text[a - 1]!)) a--;
  let b = end;
  while (b < text.length && !SENTENCE_SEP.test(text[b]!)) b++;
  return text.slice(a, b);
}

// ═══════════════════════════════════════════════════════════
// 简体中文
// ═══════════════════════════════════════════════════════════

const ZH_HANS: readonly GuardRule[] = [
  {
    id: "zh.prediction.absolute",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    pattern: /必然|必定|必将|肯定会|一定会|注定|铁定|势必|无疑会/g,
    why: "绝对情态把一个概率性的结构描述变成了预言。",
    fix: "改用「传统上常被解读为」「此结构的张力偏高」一类措辞。",
  },
  {
    id: "zh.prediction.lifeEvent",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    pattern: /(?:会|将|要|难免|免不了|逃不过)[^。；！？\n]{0,6}(?:离婚|离异|分手|丧偶|破财|破产|失业|下岗|坐牢|入狱|车祸|横祸|出事|绝症|夭折)/g,
    why: "对具体人生事件作时点预言，是本系统明确不具备的能力。",
    fix: "只描述结构：「该年配偶宫受冲，婚姻域张力为本运最高」。",
  },
  {
    id: "zh.medical.warning",
    locale: "zh-Hans", category: "medical", mode: "forbid",
    pattern: /(?:注意|小心|谨防|当心|提防|防范|预防)[^。；！？\n]{0,8}(?:疾病|病症|病变|癌|炎症|心脏|肝病|肾病|中风|血压|血糖|肿瘤|结石)/g,
    why: "医疗提醒即医疗判断，本系统无此资格。",
    fix: "删除。健康相关一律导向持证专业人士。",
  },
  {
    id: "zh.medical.organ",
    locale: "zh-Hans", category: "medical", mode: "forbid",
    pattern: /(?:肝|胆|心脏|肺|肾|脾胃|肠胃|气血|血液)[^。；！？\n]{0,4}(?:不好|有恙|有问题|偏弱|虚弱|受损|易病|有疾|亏虚)/g,
    why: "对脏腑状态下断语。",
    fix: "五行与脏腑只作传统对照表呈现，不接任何关于身体的推论。",
  },
  {
    id: "zh.medical.contract",
    locale: "zh-Hans", category: "medical", mode: "forbid",
    pattern: /易患|会患|将患|恐患|易得病|会生病|多病灾|体弱多病/g,
    why: "疾病倾向的预测。",
    fix: "删除。",
  },
  {
    id: "zh.medical.correspondence",
    locale: "zh-Hans", category: "medical", mode: "requireContext",
    pattern: /(?:木|火|土|金|水)(?:主|对应|应)(?:肝|胆|心|小肠|脾|胃|肺|大肠|肾|膀胱)/g,
    context: /传统|典籍|古人|旧说|对照|之说/,
    why: "五行脏腑对应若不加框定，读者会当作对自己身体的描述。",
    fix: "写成「传统上木对应肝胆」，并且到此为止，不作推论。",
  },
  {
    id: "zh.health.framing",
    locale: "zh-Hans", category: "medical", mode: "requireContext",
    pattern: /疾病|病灾|灾厄|血光|伤灾|残疾/g,
    context: /传统|典籍|古人|旧说|相联系|相关联|之象|一类语汇|所指/,
    why: "灾病类语汇是神煞的传统语义，出现在正文时必须框定为传统关联，而非对命主的判断。",
    fix: "写成「传统上此煞与灾厄一类语汇相联系」。",
  },
  {
    id: "zh.financial.advice",
    locale: "zh-Hans", category: "financial", mode: "forbid",
    pattern: /(?:适合|应当|应该|建议|宜于|不宜|切勿|避免|可以放心)[^。；！？\n]{0,6}(?:投资|买房|购房|置业|炒股|入市|创业|借贷|理财|加杠杆)/g,
    why: "理财建议需持牌资格。",
    fix: "删除。财运域只描述结构与张力。",
  },
  {
    id: "zh.financial.outcome",
    locale: "zh-Hans", category: "financial", mode: "forbid",
    pattern: /(?:会|将|必|定能)[^。；！？\n]{0,4}(?:发财|暴富|赚大钱|亏损|血本无归|倾家荡产)/g,
    why: "财务结果的预言。",
    fix: "改为描述财星与日主的力量关系。",
  },
  {
    id: "zh.legal.outcome",
    locale: "zh-Hans", category: "legal", mode: "forbid",
    pattern: /(?:会有|将有|必有|难免|少不了)[^。；！？\n]{0,4}(?:官司|诉讼|牢狱|刑罚|讼事|牢狱之灾)/g,
    why: "法律后果的判断。",
    fix: "删除。",
  },
  {
    id: "zh.shensha.verdict",
    locale: "zh-Hans", category: "shenshaVerdict", mode: "forbid",
    pattern: /(?:孤鸾|羊刃|亡神|劫煞|灾煞|六厄|华盖|桃花|驿马|白虎|丧门|阴差阳错|十恶大败|元辰)[^。；！？\n]{0,8}(?:导致|造成|使得|所以|因此|故而|必|注定|不顺|破败|无疑)/g,
    why: "以神煞名直接作断语，是把符号层当因果层用。神煞在本系统只有三个作用：叙述素材、应期触发器、宫位定性。",
    fix: "先给出力量层或结构层的依据，神煞只作补充定性。",
  },
  {
    id: "zh.score.grade",
    locale: "zh-Hans", category: "score", mode: "forbid",
    pattern: /(?:命格|八字|命局|命盘|运势|一生|格局)[^。；！？\n]{0,4}(?:评分|得分|打分|分数|评级|等级|几分)|(?:评分|得分)[：:]\s*\d/g,
    why: "吉凶总分把多维的结构描述压成一个价值判断，且无从证伪。",
    fix: "顺逆指数只描述与用神的契合度，必须与「好坏」脱钩表述。",
  },
  {
    id: "zh.thirdParty.persona",
    locale: "zh-Hans", category: "thirdParty", mode: "forbid",
    // 「其他」里的「他」不是人称代词，用后顾断言直接排除，不进 allow ——
    // 放行会让匹配落在错的位置上（见 scanText 中推进 lastIndex 的注释）。
    pattern: /(?:此人|该人|对方|(?<!其)他|她)[^。；！？\n]{0,6}(?:性格|为人|个性|脾气|人品|身体|健康)(?:[^。；！？\n]{0,4}(?:如何|怎样|是|偏|较))?/g,
    why: "用户输入他人生辰时，不得生成针对该人的人格或健康描述。",
    fix: "六亲只描述宫位与星曜的结构，不描述人。",
  },
  {
    id: "zh.secondPerson.address",
    locale: "zh-Hans", category: "secondPerson", mode: "forbid",
    pattern: /你/g,
    why: "第二人称把结构描述变成了对读者的断言，主体性随之丧失。UI 文案不在扫描范围内，此处限于报告正文。",
    fix: "主语用「本盘」「命主」「此结构」。",
  },
];

// ═══════════════════════════════════════════════════════════
// 繁体中文
//
// 繁体模板尚未就位（见 templates.ts），但禁令表先行 —— 模型在
// Skill 场景下可能直接产出繁体，守卫不能有语言盲区。
// ═══════════════════════════════════════════════════════════

const ZH_HANT: readonly GuardRule[] = [
  {
    id: "zht.prediction.absolute",
    locale: "zh-Hant", category: "prediction", mode: "forbid",
    pattern: /必然|必定|必將|肯定會|一定會|註定|鐵定|勢必|無疑會/g,
    why: "絕對情態把結構描述變成預言。",
    fix: "改用「傳統上常被解讀為」。",
  },
  {
    id: "zht.prediction.lifeEvent",
    locale: "zh-Hant", category: "prediction", mode: "forbid",
    pattern: /(?:會|將|要|難免|免不了|逃不過)[^。；！？\n]{0,6}(?:離婚|離異|分手|喪偶|破財|破產|失業|坐牢|入獄|車禍|橫禍|出事|絕症|夭折)/g,
    why: "對具體人生事件作時點預言。",
    fix: "只描述結構。",
  },
  {
    id: "zht.medical.warning",
    locale: "zh-Hant", category: "medical", mode: "forbid",
    pattern: /(?:注意|小心|謹防|當心|提防|防範|預防)[^。；！？\n]{0,8}(?:疾病|病症|病變|癌|炎症|心臟|肝病|腎病|中風|血壓|血糖|腫瘤)/g,
    why: "醫療提醒即醫療判斷。",
    fix: "刪除。",
  },
  {
    id: "zht.financial.advice",
    locale: "zh-Hant", category: "financial", mode: "forbid",
    pattern: /(?:適合|應當|應該|建議|宜於|不宜|切勿|避免)[^。；！？\n]{0,6}(?:投資|買房|購房|置業|炒股|入市|創業|借貸|理財)/g,
    why: "理財建議需持牌資格。",
    fix: "刪除。",
  },
  {
    id: "zht.legal.outcome",
    locale: "zh-Hant", category: "legal", mode: "forbid",
    pattern: /(?:會有|將有|必有|難免)[^。；！？\n]{0,4}(?:官司|訴訟|牢獄|刑罰|訟事)/g,
    why: "法律後果的判斷。",
    fix: "刪除。",
  },
  {
    id: "zht.score.grade",
    locale: "zh-Hant", category: "score", mode: "forbid",
    pattern: /(?:命格|八字|命局|命盤|運勢|格局)[^。；！？\n]{0,4}(?:評分|得分|打分|分數|評級|等級)|(?:評分|得分)[：:]\s*\d/g,
    why: "吉凶總分把多維描述壓成價值判斷。",
    fix: "順逆指數須與「好壞」脫鉤表述。",
  },
  {
    id: "zht.secondPerson.address",
    locale: "zh-Hant", category: "secondPerson", mode: "forbid",
    pattern: /你/g,
    why: "第二人稱把結構描述變成對讀者的斷言。",
    fix: "主語用「本盤」「命主」。",
  },
];

// ═══════════════════════════════════════════════════════════
// English
//
// §7：禁令表按语言**各自**维护 —— "will definitely" 与「必然」
// 不存在共用的中间表示，靠翻译对齐只会两头漏。
// ═══════════════════════════════════════════════════════════

const EN: readonly GuardRule[] = [
  {
    id: "en.prediction.absolute",
    locale: "en", category: "prediction", mode: "forbid",
    pattern: /\b(?:will|shall) (?:definitely|certainly|surely|undoubtedly|inevitably)\b|\b(?:will definitely|is guaranteed to|are guaranteed to|certainly will|destined to|bound to|inevitably will|without a doubt)\b/gi,
    why: "Absolute modality turns a structural reading into a prophecy.",
    fix: "Use 'is traditionally read as' or 'the tension in this domain is high'.",
  },
  {
    id: "en.prediction.lifeEvent",
    locale: "en", category: "prediction", mode: "forbid",
    pattern: /\b(?:will|shall|is going to|are going to)\b[^.;!?\n]{0,24}\b(?:divorce|separate|lose (?:your|his|her|the) job|go bankrupt|be sued|be jailed|get cancer|die)\b/gi,
    why: "Dated predictions about concrete life events are outside this system's capability.",
    fix: "Describe the structure instead.",
  },
  {
    id: "en.medical.warning",
    locale: "en", category: "medical", mode: "forbid",
    pattern: /\b(?:watch out for|beware of|be careful of|prone to|susceptible to|at risk of)\b[^.;!?\n]{0,16}\b(?:disease|illness|cancer|stroke|diabetes|heart (?:problems|disease)|blood pressure)\b/gi,
    why: "A medical caution is a medical judgement.",
    fix: "Remove. Route all health matters to licensed professionals.",
  },
  {
    id: "en.medical.organ",
    locale: "en", category: "medical", mode: "forbid",
    pattern: /\b(?:liver|gallbladder|heart|lungs?|kidneys?|spleen|stomach)\b[^.;!?\n]{0,12}\b(?:is weak|are weak|is deficient|are deficient|has problems|will suffer)\b/gi,
    why: "A verdict on organ health.",
    fix: "Present the five-phase / organ mapping only as a traditional correspondence table.",
  },
  {
    id: "en.medical.correspondence",
    locale: "en", category: "medical", mode: "requireContext",
    pattern: /\b(?:wood|fire|earth|metal|water)\b[^.;!?\n]{0,12}\b(?:liver|heart|spleen|lungs?|kidneys?)\b/gi,
    context: /traditional|traditionally|classical|correspondence|in the tradition/i,
    why: "Unframed, the mapping reads as a statement about the reader's body.",
    fix: "Write 'traditionally, Wood corresponds to the liver and gallbladder' and stop there.",
  },
  {
    id: "en.financial.advice",
    locale: "en", category: "financial", mode: "forbid",
    pattern: /\b(?:should|shouldn't|should not|ought to|a good (?:year|time) to|avoid|refrain from)\b[^.;!?\n]{0,16}\b(?:invest|investing|buy (?:a )?(?:house|home|property)|trade stocks|start a business|take a loan)\b/gi,
    why: "Financial advice requires a licence.",
    fix: "Remove. Describe the structure of the wealth domain only.",
  },
  {
    id: "en.legal.outcome",
    locale: "en", category: "legal", mode: "forbid",
    pattern: /\b(?:will|shall|is likely to|are likely to)\b[^.;!?\n]{0,16}\b(?:face a lawsuit|be sued|go to (?:jail|prison)|face litigation|be prosecuted)\b/gi,
    why: "A legal judgement.",
    fix: "Remove.",
  },
  {
    id: "en.score.grade",
    locale: "en", category: "score", mode: "forbid",
    pattern: /\b(?:chart|bazi|destiny|life) (?:score|rating|grade)\b|\bscore[:\s]+\d+\s*(?:\/|out of)\s*100\b/gi,
    why: "A single quality score collapses a multi-dimensional reading into an unfalsifiable verdict.",
    fix: "The favour index measures fit with the useful god, and must be worded apart from 'good' or 'bad'.",
  },
  {
    id: "en.secondPerson.address",
    locale: "en", category: "secondPerson", mode: "forbid",
    pattern: /\b(?:you|your|yours|you're)\b/gi,
    why: "Second person turns a structural description into an assertion about the reader. UI copy is out of scope; this applies to report prose.",
    fix: "Make the chart the subject: 'the chart', 'the day master', 'this structure'.",
  },
];

export const GUARD_RULES: Readonly<Record<GuardLocale, readonly GuardRule[]>> = Object.freeze({
  "zh-Hans": Object.freeze(ZH_HANS),
  "zh-Hant": Object.freeze(ZH_HANT),
  en: Object.freeze(EN),
});

export const ALL_GUARD_RULES: readonly GuardRule[] = Object.freeze([
  ...ZH_HANS, ...ZH_HANT, ...EN,
]);

/**
 * 扫描一段文本。
 *
 * 默认跑**全部语言**的规则表，而不只是当前 locale ——
 * 一段中文叙述里混进 "you will certainly" 同样要拦下。
 */
export function scanText(
  text: string,
  where: string,
  opts: { readonly kind?: TextKind; readonly locales?: readonly GuardLocale[] } = {},
): GuardViolation[] {
  const kind = opts.kind ?? "narrative";
  const locales = opts.locales ?? GUARD_LOCALES;
  const out: GuardViolation[] = [];

  for (const loc of locales) {
    for (const rule of GUARD_RULES[loc]) {
      // 词汇表不是断语 —— 孤立名词无从框定语境，requireContext 对它不适用。
      if (kind === "vocabulary" && rule.mode === "requireContext") continue;

      // 手工推进 lastIndex，而不是 matchAll ——
      // 一处被放行的匹配不得吞掉它覆盖范围内的下一处违规。
      // 实例：「其他情况下，对方身体偏弱」中，`他情况下，对方身体` 先命中，
      // 因窗内有「其他」而放行，若就此跳过整段，真正的「对方身体偏弱」便再也扫不到。
      // 放行时只前进一个字符，重新开扫。
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        if (m[0].length === 0) { re.lastIndex = start + 1; continue; }

        if (rule.mode === "forbid") {
          const win = windowAround(text, start, end, ALLOW_WINDOW);
          if (rule.allow?.some((a) => a.test(win))) { re.lastIndex = start + 1; continue; }
        } else {
          const sentence = sentenceAround(text, start, end);
          if (rule.context !== undefined && rule.context.test(sentence)) {
            re.lastIndex = start + 1; continue;
          }
        }

        out.push({
          ruleId: rule.id, category: rule.category, locale: rule.locale, mode: rule.mode,
          match: m[0], index: start,
          excerpt: windowAround(text, start, end, EXCERPT_WINDOW),
          why: rule.why, fix: rule.fix, where,
        });
      }
    }
  }
  return out;
}

/** 便捷判定。 */
export function isClean(text: string, kind: TextKind = "narrative"): boolean {
  return scanText(text, "-", { kind }).length === 0;
}

/** 把违规列表格式化成构建日志可读的形式。 */
export function formatViolations(vs: readonly GuardViolation[]): string {
  if (vs.length === 0) return "措辞扫描通过。";
  const lines = [`措辞扫描命中 ${vs.length} 处：`, ""];
  for (const v of vs) {
    lines.push(`  ✗ [${v.ruleId}] ${v.where}`);
    lines.push(`    命中「${v.match}」于第 ${v.index} 字：…${v.excerpt}…`);
    lines.push(`    为何禁止：${v.why}`);
    lines.push(`    改法：${v.fix}`);
    lines.push("");
  }
  return lines.join("\n");
}

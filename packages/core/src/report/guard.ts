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
 * | 模式 | 语义 | 判定域 |
 * | `forbid` | 命中即违规 | 命中处 ±4 字的 `allow` 豁免窗 |
 * | `requireContext` | 命中后，判定域内必须带框定语 | **句**或**段**，逐规则声明 |
 *
 * 窗口大小的差别是刻意的：`allow` 要豁免的是「病药」这种紧邻的合法复合词，
 * 用整句作窗会让「病药用神在此，注意心脏病」整句放行 —— 那正是要拦的东西。
 *
 * 判定域分两档：多数框定语与被框定的词同句，用「句」即可；
 * 但脏腑一节要求**同时**带传统框定语与免责导向，而框定语在段首、免责语在段尾，
 * 必须用「段」。段的切分见 `paragraphAround` —— 空行与 Markdown 块首都算段界，
 * 于是一份 Markdown 里每一条列表项各自成段，段与段之间不会互相担保。
 *
 * ## 词汇与断语
 *
 * `scanText` 的 `kind` 区分二者。神煞标签表里的「血光」是**词汇**，
 * 一个孤零零的名词不构成对任何人的断言，requireContext 类规则对它不适用；
 * 而报告正文里出现「血光」，就必须带上「传统上……之象」的框定。
 * 禁令类（forbid）规则对两者一视同仁。
 */

import { toHant } from "./hant.js";

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
/** `requireContext` 的判定域。默认「句」。 */
export type ContextDomain = "sentence" | "paragraph";
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
  /** requireContext：判定域内须匹配，否则违规。 */
  readonly context?: RegExp;
  /** requireContext 的判定域。默认 `sentence`。 */
  readonly domain?: ContextDomain;
  readonly why: string;
  readonly fix: string;
}

export interface GuardViolation {
  readonly ruleId: string;
  readonly category: GuardCategory;
  readonly locale: GuardLocale;
  readonly mode: GuardMode;
  readonly domain?: ContextDomain;
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

/**
 * 命中处所在的一整段。
 *
 * 段界取空行，或 Markdown 的块首（列表项、编号、标题、引用、表格行）。
 * 这样一份 Markdown 里每条列表项各自成段 —— 否则第五条里的免责声明
 * 会替第二条把关，而读者只会读到第二条。
 *
 * 单行文本（报告层逐条 NarrativeLine 扫描时的常态）整条即一段，
 * 这正是我们要的粒度：**能被单独复制走的那一块，必须自带框定与免责**。
 */
function paragraphAround(text: string, start: number, end: number): string {
  const isBlockStart = (line: string): boolean =>
    line.trim().length === 0 || /^\s*(?:[-*+]\s|\d+[.、]\s|#{1,6}\s|>\s|\|)/.test(line);

  const lines = text.split("\n");
  // 行首偏移
  const offsets: number[] = [];
  let acc = 0;
  for (const ln of lines) { offsets.push(acc); acc += ln.length + 1; }

  const lineOf = (pos: number) => {
    let i = 0;
    while (i + 1 < offsets.length && offsets[i + 1]! <= pos) i++;
    return i;
  };
  const a0 = lineOf(start);
  const b0 = lineOf(Math.max(start, end - 1));

  let from = a0;
  while (from > 0 && !isBlockStart(lines[from]!)) from--;
  let to = b0;
  while (to + 1 < lines.length && !isBlockStart(lines[to + 1]!)) to++;

  return lines.slice(from, to + 1).join("\n");
}

/** 命中处所在的一整句。requireContext 的默认判定域。 */
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
    pattern: /易患|会患|将患|恐患|易得病|会生病|多病灾|体弱多病|易感|易生[病疾]|素有[^。；\n]{0,4}之[疾患]|(?:恐有|难免|多有|常有)[^。；\n]{0,6}(?:之疾|之症|不适|隐患)/g,
    why: "疾病倾向的断语。「肝系易感」仍是对这个人身体下的判断，只是换了个说法。",
    fix: "要表达同一功能，用「传统养生之说据此提示相应系统宜加留意」的框定式写法。",
  },
  {
    id: "zh.medical.diseaseName",
    locale: "zh-Hans", category: "medical", mode: "forbid",
    pattern: /癌|肿瘤|结石|中风|梗塞|心梗|脑梗|糖尿病|高血压|低血压|冠心病|肝炎|肾炎|胃炎|肠炎|炎症|哮喘|抑郁症|癫痫|风湿|痛风|结核|溃疡|中暑|失眠症/g,
    // 「五气之中，风为木之气」里的「中风」不是病名 —— 窗口取命中处 ±4 字，足以看到前缀。
    allow: [/之中[，、]?风/, /其中风/, /中风池/],
    why: "**病名无条件禁止，不看上下文。**器官名（肝、心、目、筋）可以出现在带传统"
      + "框定与免责导向的对照句里；病名一个都不行。这条线清楚、可执行，且不需要判断语境。",
    fix: "只说五行与脏腑的传统对照，不指向任何具体病症。",
  },
  {
    id: "zh.medical.correspondence",
    locale: "zh-Hans", category: "medical", mode: "requireContext",
    pattern: /(?:木|火|土|金|水)(?:主|对应|应)(?:肝|胆|心|小肠|脾|胃|肺|大肠|肾|膀胱)/g,
    context: /传统|典籍|古人|旧说|对照|之说|内经|素问|配属/,
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
    id: "zh.body.framing",
    locale: "zh-Hans", category: "medical", mode: "requireContext",
    domain: "paragraph",
    pattern: /(?:肝|胆|小肠|脾|胃|肺|大肠|肾|膀胱)|在窍为|在体为|在志为|在气为|其华在/g,
    // 全表唯一要求**两个条件同时成立**的一条：既要有传统框定，又要有免责导向。
    // 脏腑是所有输出里最容易被当成医嘱的一节，只框定不免责、或只免责不框定，
    // 都放行不得。框定语常在段首、免责语在段尾，故判定域必须是段。
    context: /(?=[\s\S]*(?:内经|素问|传统|典籍|配属|对照))(?=[\s\S]*(?:不构成|请咨询|非体检|非诊断))/,
    why: "脏腑段须**同时**带传统框定语与免责导向，缺一即拦。",
    fix: "写成「《内经》五行配属中，木应肝与胆……以上不构成任何关于身体状况的判断；"
      + "健康相关的决定请咨询持证专业人士。」",
  },
  {
    id: "zh.guidance.prescription",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    pattern: /(?:应当|应该|务必|切记|建议|最好|千万)[^。；！？\n]{0,8}(?:去|别|不要|停止|辞职|跳槽|搬家|签约|结婚|离婚|生育|手术|服药|就医|体检|求医|吃药)/g,
    why: "趋避一节最容易被单独复制走，而一句孤零零的行动指令就是建议 ——"
      + "无论它原本挂在多少免责声明底下。传统趋避之说只描述姿态，不指派动作。",
    fix: "改为姿态性的描述：「传统趋避之说于此类时段主张以守代攻、缓图为上」。",
  },
  {
    id: "zh.guidance.framing",
    locale: "zh-Hans", category: "prediction", mode: "requireContext",
    domain: "paragraph",
    // 与脏腑段同一个做法：**两个条件同时成立**。趋避条目会被逐条摘出来读，
    // 故框定与免责都得在这一条自己身上，不能指望同一份报告里别处的那句。
    pattern: /趋吉避凶|趋避之说|宜守|以守代攻|缓图|不轻许诺|先安内/g,
    context: /(?=[\s\S]*(?:传统|旧说|之说|典籍|古人))(?=[\s\S]*(?:不构成|请咨询|非建议))/,
    why: "趋避语句须**同时**带传统框定语与免责导向，缺一即拦。",
    fix: "写成「传统趋避之说于此类时段主张……以上不构成任何专业建议；"
      + "涉及健康、法律、财务的决定请咨询持证专业人士。」",
  },
  {
    id: "zh.stats.probability",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    pattern: /(?:概率|几率|可能性)[^。；！？\n]{0,6}(?:为|是|达|约)\s*[\d百千万]|\d+\s*%\s*(?:的概率|的可能)|(?:小概率|大概率)事件/g,
    why: "命盘的时间序列是**确定性的**准周期序列，σ 只是它自身的经验散布 ——"
      + "「六十年中最偏离常态的三段」成立，「发生巨变的概率是 5%」不成立。"
      + "把百分位包装成统计推断，恰恰会让本来有用的排序失去可信度。",
    fix: "改用排序陈述：「本命六十年中最偏离常态的三段时期」。",
  },
  // ── 六爻问事专有的四条 ──
  //
  // 六爻典籍的断语是赤裸的结果预言，而它的句式与四柱叙述**形状不同** ——
  // 通用规则按「主体 + 情态 + 后果」构句匹配，逮不到省略主语的「主得财」，
  // 也不认识「可成」「立至」这类六爻特有的成败词。故另立四条。
  {
    id: "zh.liuyao.verbZhu",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    // 「主」作断言动词：主+后果。省略主语，通用规则的构句匹配落空。
    pattern: /主[得失散成败凶吉离合病灾财]|主[^。；！？\n]{0,4}(?:之[喜忧灾祸]|不利|无成|有成)/g,
    allow: [/主体/, /主要/, /主张/, /主动/, /日主/, /主事/, /主宰/, /卦主/, /主人/],
    why: "「主得财」「主离散」是六爻典籍的断语句式 —— 省略主语的结果预言。"
      + "它没有情态词，故按「主体+情态+后果」构句的通用规则逮不到。",
    fix: "改为描述结构：「妻财爻临月建得令，日辰生之」。",
  },
  {
    id: "zh.liuyao.outcomeVerb",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    pattern: /可成|不成|难成|必得|必失|立至|即至|无妨|有望|指日可待|十有八九/g,
    allow: [/不成立/, /不成文/],
    why: "成败词是六爻特有的结果断言，不在通用情态表里。",
    fix: "只描述用神的力量与生克，成败留给读者。",
  },
  {
    id: "zh.liuyao.yingqiPoint",
    locale: "zh-Hans", category: "prediction", mode: "forbid",
    // 应期报到日、到时辰即伪精度。报到月建（如「申月」）是允许的。
    pattern: /应(?:期|在)[^。；！？\n]{0,8}(?:\d{1,2}\s*[日号]|[子丑寅卯辰巳午未申酉戌亥]日|[子丑寅卯辰巳午未申酉戌亥]时)/g,
    why: "应期取法给出的是干支之候，落到日历上天然是一族候选，不是一个时点。"
      + "报到日、到时辰是伪精度 —— 与统计节点同一条纪律。",
    fix: "只报到月建：「申、酉两个月建为传统所指的候选时段」。",
  },
  {
    id: "zh.liuyao.divineMedical",
    locale: "zh-Hans", category: "medical", mode: "forbid",
    // ⚠️ 初稿写作 `(?:病|疾|症)[…]{0,4}(?:…|重|轻|…)`，当场误杀了自家的
    // 「病药：该病的权重刚过门槛」—— 病与权「重」隔了四个字就命中。
    // 这正是本模块开篇警告的那种失败。故预后词一律取成词，不留字距。
    pattern: /病危|病重|病轻|可愈|难愈|痊愈|将愈|不愈|凶险|(?:病情|病势|病症)[^。；！？\n]{0,4}(?:好转|恶化|加重|减轻|不利|凶|吉)|(?:官鬼|子孙)[^。；！？\n]{0,6}(?:主病|病愈|病重)/g,
    why: "占病的预后判断。现有的病名规则只拦病名，不拦「难愈」「凶险」这类预后。",
    fix: "健康类只出五行脏腑对应与传统框定语，不出预后、不出时间窗。",
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
// 繁体中文 —— **由简体规则机械派生，不手写**
//
// 初版是手写的七条，而简体有十九条。繁体从「调用即抛错」变成真会产出之后
// （见 report/hant.ts），这十二条之差就成了实打实的守卫盲区 ——
// 而我当时写的测试只查字面转换，没查两套规则是否对等，故没逮到。
//
// 现在派生：`toHant` 拒绝猜测，遇到无法定夺的字直接抛错，
// 于是「往简体加一条规则却忘了繁体」这件事**在构建期就过不去**。
// 与「Skill 与 Web 逐字一致是构造保证而非维护约定」同一条思路。
//
// 另一半问题在 `requireContext` 的先行断言：触发词多为简繁同形（肝、肺、癌），
// 而框定语不是 —— 于是简体规则在繁体正文上必然误报「缺框定语」，实测已见。
// 故先行断言一律**简繁双写**，两种写法都算数。
// ═══════════════════════════════════════════════════════════

/** 把一条正则扩成简繁双匹配。已是纯繁体或不含汉字时原样返回。 */
export function biscript(re: RegExp): RegExp {
  const hant = toHant(re.source);
  return hant === re.source ? re : new RegExp(`(?:${re.source})|(?:${hant})`, re.flags);
}

/**
 * 由简体规则派生繁体规则。
 *
 * 主模式取**纯繁体**（简体那条由 ZH_HANS 自己负责，双写会把同一处报两遍）；
 * `context` 的框定语与 `allow` 的豁免窗取简繁双写 —— 用哪种写法都该算数。
 */
function toHantRule(r: GuardRule): GuardRule {
  return {
    ...r,
    id: r.id.replace(/^zh\./, "zht."),
    locale: "zh-Hant",
    pattern: new RegExp(toHant(r.pattern.source), r.pattern.flags),
    why: toHant(r.why),
    fix: toHant(r.fix),
    ...(r.context === undefined ? {} : { context: biscript(r.context) }),
    ...(r.allow === undefined ? {} : { allow: r.allow.map(biscript) }),
  };
}

const ZH_HANT: readonly GuardRule[] = ZH_HANS.map(toHantRule);

/**
 * 简体规则的框定语同样双写。
 *
 * 这一条是真 bug 的修复，不是对称的装饰：`requireContext` 的**触发词**多为
 * 简繁同形（肝、肺、癌、脾、胃），于是简体规则照样在繁体正文上命中；
 * 而**框定语**不同形，于是必然报「缺框定语」。实测繁体报告被拦下两处，就是这个。
 */
const ZH_HANS_BI: readonly GuardRule[] = ZH_HANS.map((r) => ({
  ...r,
  ...(r.context === undefined ? {} : { context: biscript(r.context) }),
  ...(r.allow === undefined ? {} : { allow: r.allow.map(biscript) }),
}));

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
  "zh-Hans": Object.freeze(ZH_HANS_BI),
  "zh-Hant": Object.freeze(ZH_HANT),
  en: Object.freeze(EN),
});

export const ALL_GUARD_RULES: readonly GuardRule[] = Object.freeze([
  ...ZH_HANS_BI, ...ZH_HANT, ...EN,
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
          const domain = rule.domain ?? "sentence";
          const scope = domain === "paragraph"
            ? paragraphAround(text, start, end)
            : sentenceAround(text, start, end);
          if (rule.context !== undefined && rule.context.test(scope)) {
            re.lastIndex = start + 1; continue;
          }
        }

        out.push({
          ruleId: rule.id, category: rule.category, locale: rule.locale, mode: rule.mode,
          ...(rule.domain === undefined ? {} : { domain: rule.domain }),
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

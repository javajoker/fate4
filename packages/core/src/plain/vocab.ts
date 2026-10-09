/**
 * 人话词表 —— 判定枚举 → 平常话。
 *
 * ## 去掉术语，恰恰去掉了天然的对冲
 *
 * 「用神取木，喜水」晦涩，读者一眼就知道自己在看一个模型；
 * 「你适合往东发展」具体、可执行，读起来像忠告。**同一份判定，换个说法就从
 * 「模型的输出」变成了「对你的建议」。** 故人话层需要的是更严的约束，不是更松的。
 *
 * 三条硬规矩，由 `plain/guard.ts` 强制：
 *
 * 1. **不给方位、属相、日期、职业、配偶这类可执行的指定。**
 *    技术层本就不出，人话层更不许「翻译」出来。
 * 2. **不作「适合／不适合」的适配判断。** 只说结构：「在有规则的环境里更省力」
 *    不是「你适合体制内」。
 * 3. **不出祈使句。** 「不妨…」「建议…」「记得…」一律不要。
 *
 * ## 人话是判定枚举的函数，不是逐盘自由撰写
 *
 * 每一条人话都由一个**枚举值**查表得到 —— 旺衰档、象限、五行状态、节点方向。
 * 于是它不可能漂离技术层：想改人话，得先改那个枚举的含义。
 * 逐盘自由撰写读起来更自然，但那一层一旦松动，「报告不做新判断」就守不住了。
 */

import type { Element, TenGod } from "../types/ganzhi.js";

/** 旺衰五档 → 底子的轻重。**不带褒贬** —— 旺不等于好，弱不等于差。 */
export const STRENGTH_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  VERY_STRONG: "你的底子很足，自己就能撑起事情，不太依赖外部条件；"
    + "反过来，太顺的时候容易用力过猛。",
  STRONG: "你的底子偏足，做事有自己的节奏，不太容易被带着走。",
  BALANCED: "你的底子不偏不倚，进退之间比较有余地，"
    + "不容易走极端，也少有那种一鼓作气的猛劲。",
  WEAK: "你的底子偏轻，容易顺着环境走 —— 顺境里借力顺畅，逆境里消耗得快。",
  VERY_WEAK: "你的底子很轻，环境对你的影响比自身的劲头大得多；"
    + "找对场合，比自己硬扛更省力。",
});

/** 十神 → 内在倾向的人话。**只说倾向，不说好坏，也不说适合做什么。** */
export const GOD_PLAIN: Readonly<Record<TenGod, string>> = Object.freeze({
  比肩: "自己拿主意，不太爱被安排",
  劫财: "行动快，愿意分担，也容易替人扛事",
  食神: "喜欢琢磨和表达，节奏偏舒缓",
  伤官: "点子多、不服框框，说话直",
  正财: "务实，看得见摸得着的东西才安心",
  偏财: "对机会敏感，来去都快",
  正官: "讲规矩，在意分寸和名分",
  七杀: "压力下反而来劲，敢碰硬的",
  正印: "重情理，慢热，靠积累",
  偏印: "想得多，偏好冷门和独处",
});

/** 十神 → 与之相关的人和事，供「亲近的人」一节。 */
export const GOD_RELATION_PLAIN: Readonly<Record<TenGod, string>> = Object.freeze({
  比肩: "同辈、合作的人", 劫财: "同辈、争抢同一件事的人",
  食神: "晚辈、你照顾的人", 伤官: "晚辈、你表达的对象",
  正财: "务实的往来、日常开销", 偏财: "机会型的往来",
  正官: "上级、规则本身", 七杀: "压力源、竞争者",
  正印: "长辈、照顾你的人", 偏印: "长辈、精神上的支持",
});

/**
 * 十神 → **它指向哪一类事**。
 *
 * ⚠️ 与 `GOD_RELATION_PLAIN` 分工不同：那一张说「与之相关的是哪类人」，
 * 这一张说「这一路的起伏落在生活的哪一块」。
 *
 * **只说是哪一类事，不说会发生什么。** 「与职位、规则相关的那一路张力偏大」
 * 可以；「可能升官」不可以 —— 后者是事件预言，措辞守卫会拦，而且它本就
 * 越过了这套模型能说的范围。
 */
export const GOD_DOMAIN_PLAIN: Readonly<Record<TenGod, string>> = Object.freeze({
  比肩: "与同辈、合作、自己拿主意相关的那一路",
  劫财: "与同辈、分摊、争抢同一件事相关的那一路",
  食神: "与表达、创作、照顾人相关的那一路",
  伤官: "与表达、不服框框、锋芒相关的那一路",
  正财: "与钱、务实的往来、日常开销相关的那一路",
  偏财: "与机会型收入、来去快的往来相关的那一路",
  正官: "与职位、规则、名分相关的那一路",
  七杀: "与压力、竞争、硬碰硬相关的那一路",
  正印: "与长辈、学业、被照顾相关的那一路",
  偏印: "与独处、冷门的钻研、精神支持相关的那一路",
});

/** 宫位 → 它指向哪一类事。同样只说类别。 */
export const PALACE_DOMAIN_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  祖上宫: "与家世、早年环境相关的那一路",
  根基宫: "与出身根底相关的那一路",
  父母兄弟宫: "与父母、兄弟姐妹相关的那一路",
  门户宫: "与家门、日常所处环境相关的那一路",
  自身: "与你自己相关的那一路",
  配偶宫: "与伴侣、亲密关系相关的那一路",
  志向宫: "与志向、想做的事相关的那一路",
  子女宫: "与子女、晚辈相关的那一路",
  命宫: "与整体处境相关的那一路",
  胎元: "与先天底子相关的那一路",
});

/** 五行 → 场合与状态的人话。**不出方位、不出颜色、不出属相。** */
export const ELEMENT_PLAIN: Readonly<Record<Element, string>> = Object.freeze({
  木: "需要生长、需要往外伸展的场合",
  火: "需要热度、需要被看见的场合",
  土: "需要稳住、需要承接的场合",
  金: "需要果断、需要收束的场合",
  水: "需要沉静、需要理清头绪的场合",
});

/**
 * 五行 → 形体那一路的人话。
 *
 * ⚠️ **与 `ELEMENT_PLAIN` 分开。** 那一张说的是「什么场合」，是给性格用的；
 * 拿它来说身体会得出「需要被看见的场合上这一路偏盛」这种范畴错误的句子 ——
 * 初稿正是这么错的。身体这一路用《内经》的脏腑对照，不用场合。
 */
export const ELEMENT_BODY_PLAIN: Readonly<Record<Element, string>> = Object.freeze({
  木: "与肝胆、筋、眼睛相联系的那一路",
  火: "与心、脉、舌相联系的那一路",
  土: "与脾胃、肌肉、口相联系的那一路",
  金: "与肺、皮毛、鼻相联系的那一路",
  水: "与肾、骨、耳相联系的那一路",
});

/** 五行虚实六档 → 形体倾向。**只说易感，不出病名、不出预后。** */
export const ELEMENT_STATE_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  实: "这一路偏盛",
  实而受制: "这一路偏盛，但同时受到牵制",
  平: "这一路持平",
  平而受制: "这一路本来持平，但受到牵制",
  虚: "这一路偏弱",
  虚而被伐: "这一路偏弱，还在被消耗",
});

/** 寒热燥湿 → 人话。 */
export const AXIS_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  偏热: "整体偏热", 偏寒: "整体偏寒",
  偏燥: "整体偏干", 偏湿: "整体偏润", 平: "居中",
});

/** 六亲象限 → 相处结构。**说的是你与这类关系的相处，不是对方是什么人。** */
export const QUADRANT_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  "both-favorable": "这一路的关系在你的结构里分量足，位置也稳 —— 是你生活里占地方的一块。",
  "star-only": "这一路的关系在你心里分量重，但落脚的位置不够稳，"
    + "往往是你惦记得多、相处的形态却不固定。",
  "palace-only": "这一路的位置摆得稳，但在你的结构里分量不算重 ——"
    + "关系在那里，只是不占你太多心思。",
  neither: "这一路在你的结构里既不重也不稳，着墨很少。",
});

/** 节点方向 → 人话。**不说吉凶，只说是顺风处还是费劲处。** */
export const DIRECTION_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  opportunity: "这段时间这一项是顺风的",
  pressure: "这段时间这一项比较费劲",
  neutral: "这段时间这一项变动明显，但顺逆两说",
});

/** 顺逆指数 → 人话分档。指数本身是 0–100，但**不把数字给用户** —— 那是伪精度。 */
export function favorPlain(index: number): string {
  if (index >= 66) return "整体比较顺手";
  if (index >= 55) return "略微顺手";
  if (index > 45) return "平平，没什么特别的推力也没什么特别的阻力";
  if (index > 34) return "略微费劲";
  return "整体比较费劲";
}

/** 置信度 → 人话。低置信度必须说出来，不能只在技术层留一个小数。 */
export function confidencePlain(c: number): string {
  if (c >= 0.8) return "";
  if (c >= 0.6) return "（这一条不算特别确定）";
  return "（这一条很不确定，另一种读法同样说得通）";
}

/**
 * 人话版的免责声明。
 *
 * 它是技术版声明的**改写，不是删减** —— 四个要素一个不许少：
 * 传统文化研究的定位、不具备预测能力、不构成专业建议、导向持证专业人士。
 * 由 `plain.spec.ts` 逐条断言。
 *
 * 之所以不直接复用技术版：那一版说的是「本报告为四柱命理的计算实现」，
 * 在一个刻意不出术语的应用里既突兀，又把「命理」二字漏了出来。
 * 但改写声明是件危险的事 —— 很容易在「说得通顺些」的名义下弱化它，
 * 故把要素写成测试。
 */
export const PLAIN_DISCLAIMER =
  "这套东西是按一种传统的推演方法算出来的，属于文化研究和自我省思的工具。"
  + "它不具备预测未来事件的能力，也不构成医疗、法律、财务或任何专业方面的建议。"
  + "凡涉及健康、法律、财务的决定，请咨询相应领域的持证专业人士。";

/**
 * 序列 id → 它指向哪一类事。
 *
 * 序列 id 形如 `tenGod.正财`、`palace.配偶宫.branch`、`element.水`。
 * 认不出的返回 null —— **不瞎猜**，认不出就不说这一句。
 */
/**
 * 整盘指标 → 人话。
 *
 * 这几条不指向某一类事，而是**整盘的**：流通顺不顺、力量留不留得住、
 * 显露得多还是藏得多。照样得给它们一句「哪一类」，否则起伏卡片会只剩
 * 「这段时间这一项是顺风的」—— 哪一项？读者无从知道。
 */
const METRIC_DOMAIN_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  "metric.vitality": "整盘的力量留不留得住，这一路",
  "metric.circulation": "整盘转得顺不顺、有没有堵在某一处，这一路",
  "metric.favorIndex": "整盘与你本命合不合得来，这一路",
  "innerOuter.revealRatio": "你显露在外的那部分与压在里面的那部分，这一路",
  "innerOuter.tension": "你对外的样子与内里的状态之间拉不拉扯，这一路",
});

/**
 * 扰动 → 人话。
 *
 * `agitation.<位>` 说的是该位被冲、刑、合、害引动的程度。位名（命宫、年支……）
 * 是术语，故不照搬 —— 换成那一位在传统里对应的生活面。
 */
const AGITATION_DOMAIN_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  命宫: "与你整个人的处境被搅动相关的那一路",
  胎元: "与你的底子、来处被搅动相关的那一路",
  年支: "与长辈、来处被搅动相关的那一路",
  月支: "与你所处的环境、工作面被搅动相关的那一路",
  日支: "与身边最近的人被搅动相关的那一路",
  时支: "与晚辈、晚年、往后的去向被搅动相关的那一路",
});

/**
 * 序列 → 它说的是「哪一类事」。
 *
 * **必须覆盖 `buildSeries` 产出的每一个 id。** 漏掉一类，起伏卡片就会退化成
 * 一句没有主语的「这段时间这一项是顺风的」—— 而「说的是哪一类事」正是这类卡片
 * 唯一的内容。`metric` / `innerOuter` / `agitation` 三类曾漏在外面，
 * 直到某张盘的节点排进前八才露出来；现由 plain.spec.ts 逐条穷举断言。
 */
export function domainOfSeries(seriesId: string): string | null {
  const [kind, name] = seriesId.split(".");
  if (kind === "tenGod" && name !== undefined) {
    return GOD_DOMAIN_PLAIN[name as TenGod] ?? null;
  }
  if (kind === "palace" && name !== undefined) return PALACE_DOMAIN_PLAIN[name] ?? null;
  if (kind === "element" && name !== undefined) {
    return name in ELEMENT_PLAIN ? `${ELEMENT_PLAIN[name as Element]}这一路` : null;
  }
  if (kind === "dayMaster") return "与你自身状态相关的那一路";
  if (kind === "domain") return "与外部事项相关的那一路";
  if (kind === "metric" || kind === "innerOuter") {
    return METRIC_DOMAIN_PLAIN[seriesId] ?? null;
  }
  if (kind === "agitation" && name !== undefined) {
    return AGITATION_DOMAIN_PLAIN[name] ?? null;
  }
  return null;
}

/** 每张人话卡片都要挂的那句话。**不是可选装饰，是结构的一部分。** */
export const PLAIN_FRAMING =
  "以上是一套传统模型对出生时刻的推演结果，换成了平常话。它描述的是这套模型看到的结构，"
  + "不是对你本人的鉴定，也不预告将会发生什么。每一条都可以展开看它的来历。";

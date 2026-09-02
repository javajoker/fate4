/**
 * 叙述模板库 —— [09-report](../../../../docs/09-report.md) §3。
 *
 * ## 模板是唯一的叙述来源
 *
 * 报告层**不做任何新判断**。每条叙述都由 `(结论类型, 状态组合)` 索引到一条模板，
 * 槽位由 L0–L5 的数据填充。这条边界一旦破了，系统就不再可复现：
 * 同一份 JSON 会因为措辞逻辑的分支产出不同的结论。
 *
 * ## hedgedVariant 是强制机制，不是修辞选项
 *
 * `confidence < confidenceFloor` 时自动切到留有余地的措辞。
 * 把一个 0.3 置信度的判定写成斩钉截铁的断语，是本领域最普遍的失真，
 * 而它恰恰是**可以在代码里杜绝**的那一类。
 * 因此 `confidenceFloor > 0` 的模板**必须**带 `hedgedVariant`，由测试强制。
 *
 * ## 繁体尚未就位
 *
 * `zhHant` 为可选，目前全部缺席。不做「简转繁」自动降级 —— 本领域的高频字
 * 恰好落在一简对多繁的歧义区：余气→餘氣（非余氣）、历法→曆法（非歷法）、
 * 后天→後天（非后天）。机械转换会在术语上出错，而术语出错的报告比没有报告更糟。
 * `renderTemplate` 遇到缺失的 `zh-Hant` 直接抛错，不静默回落到简体 ——
 * 静默回落等于对外谎称支持了繁体。见 docs/11-validation.md §5。
 */

export type Locale = "zh-Hans" | "zh-Hant" | "en";

export interface LocalizedText {
  readonly zhHans: string;
  readonly zhHant?: string;
  readonly en: string;
}

export interface NarrativeTemplate {
  readonly id: string;
  /** 该模板挂在哪一类判定下 —— 供审计「这句话是从哪个 Verdict 来的」。 */
  readonly appliesTo: {
    readonly source: "verdict" | "event" | "data";
    readonly kind: string;
  };
  /** 声明的槽位。与三种语言文本中出现的 {占位符} 集合必须完全相等，由测试断言。 */
  readonly slots: readonly string[];
  readonly text: LocalizedText;
  /** 低于此置信度改用 hedged。0 表示该模板不依赖置信度（纯数据陈述）。 */
  readonly confidenceFloor: number;
  readonly hedged?: LocalizedText;
}

const T = (
  id: string,
  source: NarrativeTemplate["appliesTo"]["source"],
  kind: string,
  slots: readonly string[],
  text: LocalizedText,
  confidenceFloor = 0,
  hedged?: LocalizedText,
): NarrativeTemplate =>
  hedged === undefined
    ? { id, appliesTo: { source, kind }, slots, text, confidenceFloor }
    : { id, appliesTo: { source, kind }, slots, text, confidenceFloor, hedged };

// ═══════════════════════════════════════════════════════════
// §3.1 旺衰
// ═══════════════════════════════════════════════════════════

const STRENGTH_HEDGE = (band: string, bandEn: string): LocalizedText => ({
  zhHans: `日主{dm}生于{monthBranch}月，同党占比 {ratio}，通根评分 {rootScore}，力量层偏向${band}。该值距分档阈值仅 {margin}，另一档的取法同样有依据 —— 此盘属临界，取用宜两面兼看。`,
  en: `The day master {dm}, born in the {monthBranch} month, holds {ratio} of the supporting party with a rooting score of {rootScore}, leaning ${bandEn}. It sits only {margin} from the band threshold, so the neighbouring reading is equally defensible; treat this chart as borderline and weigh both.`,
});

const STRENGTH_SLOTS = ["dm", "monthBranch", "ratio", "rootScore", "margin"] as const;

const strengthTemplates: NarrativeTemplate[] = [
  T("strength.veryStrong", "verdict", "strength", STRENGTH_SLOTS, {
    zhHans: "日主{dm}生于{monthBranch}月，同党占比 {ratio}，通根评分 {rootScore}，距分档阈值 {margin}，力量层判为身极旺。",
    en: "The day master {dm}, born in the {monthBranch} month, holds {ratio} of the supporting party with a rooting score of {rootScore}, {margin} clear of the band threshold: the force layer reads it as very strong.",
  }, 0.6, STRENGTH_HEDGE("身极旺", "very strong")),

  T("strength.strong", "verdict", "strength", STRENGTH_SLOTS, {
    zhHans: "日主{dm}生于{monthBranch}月，同党占比 {ratio}，通根评分 {rootScore}，距分档阈值 {margin}，力量层判为身旺。",
    en: "The day master {dm}, born in the {monthBranch} month, holds {ratio} of the supporting party with a rooting score of {rootScore}, {margin} clear of the band threshold: the force layer reads it as strong.",
  }, 0.6, STRENGTH_HEDGE("身旺", "strong")),

  T("strength.balanced", "verdict", "strength", STRENGTH_SLOTS, {
    zhHans: "日主{dm}生于{monthBranch}月，同党占比 {ratio}，通根评分 {rootScore}，距分档阈值 {margin}，力量层判为中和。",
    en: "The day master {dm}, born in the {monthBranch} month, holds {ratio} of the supporting party with a rooting score of {rootScore}, {margin} clear of the band threshold: the force layer reads it as balanced.",
  }, 0.6, STRENGTH_HEDGE("中和", "balanced")),

  T("strength.weak", "verdict", "strength", STRENGTH_SLOTS, {
    zhHans: "日主{dm}生于{monthBranch}月，同党占比 {ratio}，通根评分 {rootScore}，距分档阈值 {margin}，力量层判为身弱。",
    en: "The day master {dm}, born in the {monthBranch} month, holds {ratio} of the supporting party with a rooting score of {rootScore}, {margin} clear of the band threshold: the force layer reads it as weak.",
  }, 0.6, STRENGTH_HEDGE("身弱", "weak")),

  T("strength.veryWeak", "verdict", "strength", STRENGTH_SLOTS, {
    zhHans: "日主{dm}生于{monthBranch}月，同党占比 {ratio}，通根评分 {rootScore}，距分档阈值 {margin}，力量层判为身极弱。",
    en: "The day master {dm}, born in the {monthBranch} month, holds {ratio} of the supporting party with a rooting score of {rootScore}, {margin} clear of the band threshold: the force layer reads it as very weak.",
  }, 0.6, STRENGTH_HEDGE("身极弱", "very weak")),
];

// ═══════════════════════════════════════════════════════════
// §3.2 通根
// ═══════════════════════════════════════════════════════════

const rootTemplates: NarrativeTemplate[] = [
  T("root.rooted", "data", "rootDetail", ["detail", "rootScore"], {
    zhHans: "日主通根于{detail}，合计评分 {rootScore}。",
    en: "The day master roots in {detail}, for a combined score of {rootScore}.",
  }),
  T("root.rootless", "data", "rootDetail", ["rootScore"], {
    zhHans: "日主在四支中无根，通根评分 {rootScore} —— 力量全赖生扶，此结构对大运的依赖度高于一般盘面。",
    en: "The day master finds no root among the branches; rooting score {rootScore}. Its force rests entirely on support, which makes this structure more dependent on the luck pillars than most.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §3.3 特殊格局
// ═══════════════════════════════════════════════════════════

const patternTemplates: NarrativeTemplate[] = [
  T("pattern.congge", "verdict", "specialPattern", ["subtype", "element", "ratio"], {
    zhHans: "判为从格（{subtype}），从{element}。异党占比 {ratio}，日主无根可依，取用不再走扶抑一路。",
    en: "Read as a following pattern ({subtype}), following {element}. The opposing party holds {ratio} and the day master has no root, so the useful god is no longer chosen by support-or-restraint.",
  }, 0.65, {
    zhHans: "倾向从格（{subtype}），从{element}，异党占比 {ratio}。从格的成立门槛在各家之间分歧甚大，本盘距门槛不远 —— 普通格局的取法在下文一并列出，两者并存。",
    en: "Leans toward a following pattern ({subtype}), following {element}, with the opposing party at {ratio}. Schools disagree sharply on the threshold for this pattern and this chart sits close to it, so the ordinary reading is listed below as well; both stand.",
  }),

  T("pattern.zhuanwang", "verdict", "specialPattern", ["name", "element", "ratio"], {
    zhHans: "判为专旺格（{name}），全局归{element}，该五行占比 {ratio}。",
    en: "Read as a dominant-phase pattern ({name}); the whole chart resolves to {element}, which holds {ratio}.",
  }, 0.65, {
    zhHans: "倾向专旺格（{name}），归{element}，占比 {ratio}，但未到公认的稳妥区间。普通格局的取法一并列出。",
    en: "Leans toward a dominant-phase pattern ({name}) in {element} at {ratio}, though short of the range schools agree on. The ordinary reading is listed alongside.",
  }),

  T("pattern.huaqi", "verdict", "specialPattern", ["element"], {
    zhHans: "判为化气格，化{element}。",
    en: "Read as a transformation pattern, transforming to {element}.",
  }, 0.65, {
    zhHans: "倾向化气格，化{element}。化气格的成败条件在实务中争议最大，本系统对该判定设有置信度上限，普通格局的取法一并列出。",
    en: "Leans toward a transformation pattern in {element}. This is the most contested pattern in practice; the engine caps its confidence by design, and the ordinary reading is listed alongside.",
  }),

  T("pattern.none", "verdict", "specialPattern", [], {
    zhHans: "未命中从格、专旺、化气三类特殊格局，按普通格局取用。",
    en: "None of the following, dominant-phase, or transformation patterns applies; the chart is read as an ordinary structure.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §3.4 用神
// ═══════════════════════════════════════════════════════════

const yongshenTemplates: NarrativeTemplate[] = [
  T("yongshen.tiaohou", "verdict", "yongshen", ["primary", "reason"], {
    zhHans: "取{primary}为用，法从调候：{reason}。",
    en: "Takes {primary} as the useful god by climatic adjustment: {reason}.",
  }, 0.6, {
    zhHans: "倾向取{primary}为用，法从调候：{reason}。此取法与扶抑一路的方向不一致，两条线在下文并列，未作合并。",
    en: "Leans toward {primary} as the useful god by climatic adjustment: {reason}. This runs against the support-or-restraint reading; both lines are listed below and are not merged.",
  }),

  T("yongshen.fuyi", "verdict", "yongshen", ["primary", "secondary"], {
    zhHans: "取{primary}为用，法从扶抑；喜神{secondary}。",
    en: "Takes {primary} as the useful god by support-or-restraint, with {secondary} as the favourable phase.",
  }, 0.6, {
    zhHans: "倾向取{primary}为用，法从扶抑；喜神{secondary}。日主旺衰本身接近临界，取用随之带有不确定性。",
    en: "Leans toward {primary} by support-or-restraint, with {secondary} as the favourable phase. The day master's strength is itself near a band edge, so this choice carries that uncertainty.",
  }),

  T("yongshen.tongguan", "verdict", "yongshen", ["primary", "sideA", "sideB"], {
    zhHans: "取{primary}为用，法从通关：{sideA}与{sideB}两强相持，取通关之神引流。",
    en: "Takes {primary} as the useful god by mediation: {sideA} and {sideB} stand locked at comparable force, and the mediating phase channels between them.",
  }, 0.6, {
    zhHans: "倾向取{primary}为用，法从通关：{sideA}与{sideB}相持，但两方势力的差距接近判别边界，是否构成通关格局尚可两说。",
    en: "Leans toward {primary} by mediation between {sideA} and {sideB}, though the gap between the two sides sits close to the decision edge, so whether mediation applies is arguable.",
  }),

  T("yongshen.bingyao", "verdict", "yongshen", ["primary", "bing"], {
    zhHans: "取{primary}为用，法从病药：{bing}为病，取{primary}去之。",
    en: "Takes {primary} as the useful god by the ailment-and-remedy method: {bing} is the ailment, and {primary} removes it.",
  }, 0.6, {
    zhHans: "倾向取{primary}为用，法从病药：{bing}为病。但该病的权重刚过门槛，是否成病尚可两说。",
    en: "Leans toward {primary} by the ailment-and-remedy method, with {bing} as the ailment, though its weight only just clears the threshold and whether it qualifies is arguable.",
  }),

  T("yongshen.parties", "data", "yongshen", ["xishen", "jishen", "choushen", "xianshen"], {
    zhHans: "喜神{xishen}，忌神{jishen}，仇神{choushen}，闲神{xianshen}。",
    en: "Favourable {xishen}; unfavourable {jishen}; hostile {choushen}; neutral {xianshen}.",
  }),

  T("yongshen.needsLuckSupport", "data", "yongshen", ["primary", "strength"], {
    zhHans: "用神{primary}在本命盘中的权重仅 {strength} —— 取向明确而力量不足，此结构须待大运送来同气方能起用。这是常被略过、却直接决定运程节奏的一项。",
    en: "The useful god {primary} carries only {strength} in the natal chart: the direction is clear but the force is not there, so the structure waits on a luck pillar of the same phase. This is routinely skipped, yet it sets the tempo of the whole timeline.",
  }),

  T("yongshen.heuristicSource", "data", "yongshen", [], {
    zhHans: "调候一项走的是可计算的极端气候降级规则 —— 《穷通宝鉴》逐日干月支表尚未录入本系统。此项判定的依据弱于其余各项，已计入置信度。",
    en: "The climatic adjustment runs on a computable extreme-climate fallback: the classical day-stem-by-month-branch table is not yet loaded into this engine. This verdict rests on weaker ground than the others, and the confidence figure already reflects that.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §3.5 · §3.6 月令格局
// ═══════════════════════════════════════════════════════════

const gejuTemplates: NarrativeTemplate[] = [
  T("geju.auspicious", "verdict", "geju", ["name", "god", "source", "xiangshen"], {
    zhHans: "月令格局为{name}，以{god}定格（{source}），吉神顺用，相神取{xiangshen}。",
    en: "The month-command structure is {name}, fixed on {god} ({source}). It is an auspicious god used with the grain; the supporting god is {xiangshen}.",
  }, 0.55, {
    zhHans: "月令格局倾向{name}，以{god}定格（{source}）。该格所依的透干条件不够干净，定格本身可作两说。",
    en: "The month-command structure leans toward {name}, fixed on {god} ({source}), though the revealing condition it rests on is not clean and the identification is arguable.",
  }),

  T("geju.inauspicious", "verdict", "geju", ["name", "god", "source", "xiangshen"], {
    zhHans: "月令格局为{name}，以{god}定格（{source}），凶神逆用，相神取{xiangshen}。",
    en: "The month-command structure is {name}, fixed on {god} ({source}). It is an inauspicious god used against the grain; the supporting god is {xiangshen}.",
  }, 0.55, {
    zhHans: "月令格局倾向{name}，以{god}定格（{source}）。该格所依的透干条件不够干净，定格本身可作两说。",
    en: "The month-command structure leans toward {name}, fixed on {god} ({source}), though the revealing condition it rests on is not clean and the identification is arguable.",
  }),

  T("geju.tension", "data", "geju", ["yongshen", "xiangshen"], {
    zhHans: "取用与格局的取向不一致：扶抑一路取{yongshen}，而格局的相神在{xiangshen}。两条线在此并列呈现，不作合并 —— 合并会把这张盘真正的张力所在抹掉。",
    en: "The useful god and the month-command structure point different ways: support-or-restraint takes {yongshen}, while the structure's supporting god is {xiangshen}. Both lines are shown side by side rather than merged; merging would erase exactly where this chart's tension lies.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §2.4 指标 · §2.5 结构事件
// ═══════════════════════════════════════════════════════════

const metricsTemplates: NarrativeTemplate[] = [
  T("metrics.summary", "data", "metrics", ["vitality", "circulation", "evenness"], {
    zhHans: "单轮留存 {vitality}，流通度 {circulation}，五行匀度 {evenness}。",
    en: "Per-round retention {vitality}; circulation {circulation}; evenness across the five phases {evenness}.",
  }),
  T("metrics.flowing", "data", "metrics", [], {
    zhHans: "生的流量高于克，五行相续，力量在盘中传得动。",
    en: "Generation outweighs control: the phases pass force along rather than spending it.",
  }),
  T("metrics.contentious", "data", "metrics", [], {
    zhHans: "克的流量高于生，战克交加，力量在盘中的损耗大于传递。",
    en: "Control outweighs generation: force is spent in the clash faster than it is passed on.",
  }),

  T("structure.transformed", "event", "structure", ["participants", "element"], {
    zhHans: "{participants}合化成{element}，参与藏干的五行随之改写 —— 这是全流程中唯一允许改写五行的一步。",
    en: "{participants} combine and transform into {element}, rewriting the phase of the participating stems. This is the only step in the whole pipeline permitted to rewrite a phase.",
  }),
  T("structure.bound", "event", "structure", ["participants"], {
    zhHans: "{participants}合而不化，成合绊 —— 双方仍在场，可被作用，但向外施加生克的活性打折。",
    en: "{participants} combine without transforming, forming a binding: both remain present and can still be acted upon, but their outgoing force is damped.",
  }),
  T("structure.clash", "event", "structure", ["participants", "loser"], {
    zhHans: "{participants}相冲，{loser}一方损耗较重。",
    en: "{participants} clash; {loser} takes the heavier loss.",
  }),
  T("structure.tombOpen", "event", "structure", ["branch", "released"], {
    zhHans: "{branch}库被冲开，{released}得以透出。",
    en: "The {branch} storehouse is broken open, releasing {released}.",
  }),
  T("structure.arbitrated", "event", "structure", ["he", "chong", "heScore", "chongScore", "winner"], {
    zhHans: "{he}与{chong}互解，合势 {heScore} 对冲势 {chongScore}，裁为{winner}。此项若无裁决记录，便无从回答「为什么不化」。",
    en: "{he} and {chong} cancel each other; the combination scores {heScore} against the clash's {chongScore}, and the arbitration returns {winner}. Without this record there is no way to answer why the combination failed to transform.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §4 宫位与六亲
// ═══════════════════════════════════════════════════════════

const KIN_SLOTS = ["label", "palaceLabel", "starGod", "starWeight", "palaceWeight"] as const;
const KIN_HEDGE: LocalizedText = {
  zhHans: "{label}：宫在{palaceLabel}，权重 {palaceWeight}；星为{starGod}，权重 {starWeight}。两项的权重都贴近判别边界，此象限归属的分辨力有限。",
  en: "{label}: palace at {palaceLabel} (weight {palaceWeight}), star {starGod} (weight {starWeight}). Both figures sit close to the decision edge, so the quadrant assignment discriminates weakly here.",
};

const kinTemplates: NarrativeTemplate[] = [
  T("kin.bothFavorable", "data", "kin", KIN_SLOTS, {
    zhHans: "{label}：宫在{palaceLabel}，权重 {palaceWeight}；星为{starGod}，权重 {starWeight}。宫星两得力。",
    en: "{label}: palace at {palaceLabel} (weight {palaceWeight}), star {starGod} (weight {starWeight}); both palace and star carry force.",
  }, 0.55, KIN_HEDGE),

  T("kin.palaceOnly", "data", "kin", KIN_SLOTS, {
    zhHans: "{label}：宫在{palaceLabel}，权重 {palaceWeight}，得力；星{starGod} 权重仅 {starWeight}，不足。宫星不同步。",
    en: "{label}: the palace at {palaceLabel} (weight {palaceWeight}) carries force while the star {starGod} (weight {starWeight}) does not; palace and star are out of step.",
  }, 0.55, KIN_HEDGE),

  T("kin.starOnly", "data", "kin", KIN_SLOTS, {
    zhHans: "{label}：星{starGod} 权重 {starWeight}，得力；宫在{palaceLabel}，权重仅 {palaceWeight}，不足。宫星不同步。",
    en: "{label}: the star {starGod} (weight {starWeight}) carries force while the palace at {palaceLabel} (weight {palaceWeight}) does not; palace and star are out of step.",
  }, 0.55, KIN_HEDGE),

  T("kin.neither", "data", "kin", KIN_SLOTS, {
    zhHans: "{label}：宫在{palaceLabel}，权重 {palaceWeight}；星{starGod}，权重 {starWeight}。宫星俱不得力。传统上此结构常被解读为该项六亲的助力有限，此处只作结构陈述。",
    en: "{label}: neither the palace at {palaceLabel} (weight {palaceWeight}) nor the star {starGod} (weight {starWeight}) carries force. Traditionally such a structure is read as limited support from that relation; stated here as structure only.",
  }, 0.55, KIN_HEDGE),
];

// ═══════════════════════════════════════════════════════════
// §1.4 神煞
// ═══════════════════════════════════════════════════════════

const shenshaTemplates: NarrativeTemplate[] = [
  T("shensha.palace", "data", "shensha", ["palace", "names"], {
    zhHans: "{palace}：{names}。",
    en: "{palace}: {names}.",
  }),
  T("shensha.tone", "data", "shensha", ["name", "palace", "tone", "reason"], {
    zhHans: "{name}落{palace}，状态为{tone}：{reason}。",
    en: "{name} lands in {palace}, state {tone}: {reason}.",
  }),
  T("shensha.vocabularyNote", "data", "shensha", ["name", "tags"], {
    zhHans: "传统上{name}与{tags}一类语汇相联系。神煞在本系统只作叙述素材、应期触发器与宫位定性三用，不进入力量模型。",
    en: "Traditionally {name} is associated with the vocabulary of {tags}. In this engine the symbolic layer serves three purposes only — narrative material, timing trigger, and palace colouring — and never enters the force model.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §5 大运 · §6 流年
// ═══════════════════════════════════════════════════════════

const timelineTemplates: NarrativeTemplate[] = [
  T("luck.step", "data", "luck",
    ["index", "pillar", "fromAge", "toAge", "stemPhase", "branchPhase", "start", "mid", "end"], {
      zhHans: "第{index}步 {pillar}，{fromAge}至{toAge}岁。{stemPhase}；{branchPhase}。三点顺逆指数 {start} / {mid} / {end}。",
      en: "Step {index}, {pillar}, ages {fromAge} to {toAge}. {stemPhase}; {branchPhase}. Favour index at the three sample points: {start} / {mid} / {end}.",
    }),
  T("luck.transition", "data", "luck", ["year", "from", "to"], {
    zhHans: "{year}年换运，{from}交{to}。换运前后的气象本不相同，该年分段呈现，不作加权平均。",
    en: "The luck pillar turns in {year}, from {from} to {to}. The two halves differ in character, so that year is shown in segments rather than averaged.",
  }),
  T("luck.crossover", "data", "luck", ["pillar"], {
    zhHans: "{pillar}一步之内，天干占比自 0.70 线性降至 0.30，地支反向递增，二者恰在第 5 年末交叉。取样点设在起、中、末三处，正为呈现这一变化。",
    en: "Across the {pillar} step the stem's share falls linearly from 0.70 to 0.30 while the branch's rises to meet it, the two crossing at the end of year five. The three sample points — start, middle, end — exist to show that shift.",
  }),

  T("year.summary", "data", "year", ["year", "pillar", "luck", "index", "top"], {
    zhHans: "{year}年 {pillar}，行运{luck}，顺逆指数 {index}。主要引动：{top}。",
    en: "{year}, pillar {pillar}, luck pillar {luck}, favour index {index}. Principal triggers: {top}.",
  }),
  T("year.quiet", "data", "year", ["year", "pillar", "luck", "index"], {
    zhHans: "{year}年 {pillar}，行运{luck}，顺逆指数 {index}。本年无应期规则触发。",
    en: "{year}, pillar {pillar}, luck pillar {luck}, favour index {index}. No timing rule fires this year.",
  }),
  T("year.indexMeaning", "data", "year", [], {
    zhHans: "顺逆指数衡量的是当年五行结构与本命喜用的契合度，不是运气的好坏。指数低表示结构与取用相左，需要更多的调适 —— 与「凶」不是一回事。",
    en: "The favour index measures how far a year's phase structure fits the chart's useful god. It is not a rating of fortune: a low index means the structure runs against the chosen direction and asks for more adaptation, which is a different statement.",
  }),
  T("year.highTension", "data", "domain", ["domain", "tension", "supporting", "opposing"], {
    zhHans: "{domain}域张力 {tension}：{supporting}与{opposing}同时在场。同域内极性相反的事件并存，不相抵消 —— 净值近零，但这与「无事」是两回事：前者是大起大落，后者是平淡。",
    en: "Tension in the {domain} domain reaches {tension}: {supporting} and {opposing} are both present. Opposing events in one domain coexist rather than cancelling, so a net near zero is not the same statement as an uneventful year — the first swings, the second does not.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §7 当前时段
// ═══════════════════════════════════════════════════════════

const currentTemplates: NarrativeTemplate[] = [
  T("month.summary", "data", "month", ["month", "pillar", "element", "relation"], {
    zhHans: "{month}：月柱{pillar}，其气属{element}，{relation}。",
    en: "{month}: month pillar {pillar}, phase {element}; {relation}.",
  }),
  T("month.noWeightNote", "data", "month", [], {
    zhHans: "流月与流日只作引动，不参与权重计算。把一个三十天的短期因素放进权重迭代，等于让它与终生不变的月令同台竞争数值 —— 既无理论依据，也会让年度曲线被高频噪声淹没。",
    en: "The month and day layers trigger; they do not supply force. Feeding a thirty-day factor into the weight iteration would let it compete numerically with the month command that holds for a lifetime — unfounded in theory, and enough to drown the annual curve in high-frequency noise.",
  }),
  T("day.calm", "data", "day", ["pillar"], {
    zhHans: "今日{pillar}，五行与本命无明显张力。",
    en: "Today is {pillar}; no marked tension between its phases and the natal chart.",
  }),
  T("day.conflicts", "data", "day", ["pillar", "detail"], {
    zhHans: "今日{pillar}：{detail}。",
    en: "Today is {pillar}: {detail}.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §1.2 · §8 声明与提示
// ═══════════════════════════════════════════════════════════

const methodTemplates: NarrativeTemplate[] = [
  T("warn.unknownHour", "data", "warning", [], {
    zhHans: "出生时辰未知，时柱缺省。时柱关系到子女宫、志向宫与近三成的盘面权重，缺省之下，涉及这两宫与晚年的判定一律不予给出。",
    en: "The hour of birth is unknown and the hour pillar is omitted. That pillar carries the children and aspiration palaces and close to a third of the chart's weight, so no verdict touching those palaces or later life is issued.",
  }),
  T("warn.ambiguousTime", "data", "warning", ["detail"], {
    zhHans: "出生时刻落在时区规则的歧义区间：{detail}。本盘取其一，另一取法可能改变时柱乃至日柱。",
    en: "The moment of birth falls in an ambiguous window of the timezone rules: {detail}. This chart takes one reading; the other may change the hour pillar and possibly the day pillar.",
  }),
  T("warn.silingUnresolvable", "data", "warning", ["detail"], {
    zhHans: "司令干在月支藏干中无落点：{detail}。此为亥月前七日戊土司令的固有情形，非计算错误 —— 该段的司令加成未予施加。",
    en: "The commanding stem has no counterpart among the month branch's hidden stems: {detail}. This is inherent to the first seven days of the Hai month, not a computation error; the command bonus is simply not applied for that span.",
  }),
  T("warn.pendingCalibration", "data", "warning", ["items"], {
    zhHans: "以下条目尚待人工校准，其取值直接影响上文判定：{items}。",
    en: "The following items await manual calibration and their settings bear directly on the verdicts above: {items}.",
  }),
  T("method.schools", "data", "method", ["ziHour", "mingGong", "changsheng", "earth", "tiaohou", "childStar"], {
    zhHans: "所用流派：日界{ziHour}；命宫月界{mingGong}；十二长生{changsheng}；土的长生{earth}；调候来源{tiaohou}；女命子女星{childStar}。换一套开关，同一张盘可能得出不同结论 —— 故随盘声明。",
    en: "Schools in force: day boundary {ziHour}; life-palace month boundary {mingGong}; twelve-stage cycle {changsheng}; earth's cycle {earth}; climatic source {tiaohou}; female child star {childStar}. A different set of switches can yield a different reading of the same chart, which is why they travel with it.",
  }),
  T("method.provenance", "data", "method", ["engineVersion", "paramsHash", "solarProvider"], {
    zhHans: "引擎版本 {engineVersion}，参数快照 {paramsHash}，太阳黄经算法 {solarProvider}。半年后若同一生辰算出不同结果，这三项是唯一能回答「为什么」的依据。",
    en: "Engine {engineVersion}, parameter snapshot {paramsHash}, solar longitude provider {solarProvider}. If the same birth data yields a different result half a year from now, these three fields are the only way to answer why.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §2.5 性格与偏好（L4p 人格层）
//
// 措辞的三条底线：
//   · 主语是**结构**，不是读者。「本盘外在一面以正官为主」，不是「你自律」
//   · 特质词一律带「传统上……常被解读为」的框定，不作直陈
//   · 不用心理学量表词汇 —— 那会让读者以为背后有心理测量学的效度
// ═══════════════════════════════════════════════════════════

const personaTemplates: NarrativeTemplate[] = [
  T("persona.innerOuter", "data", "persona",
    ["innerTop", "innerTraits", "outerTop", "outerTraits"], {
      zhHans: "藏而不透的一面以{innerTop}为主，传统上此类结构常被解读为{innerTraits}；"
        + "透干显用的一面以{outerTop}为主，常被解读为{outerTraits}。"
        + "「透干为显、藏支为隐」是这一划分的依据，二者说的是同一张盘的两个侧面。",
      en: "The concealed side is led by {innerTop}, a configuration traditionally read as {innerTraits}; "
        + "the revealed side is led by {outerTop}, read as {outerTraits}. "
        + "The split follows the classical rule that revealed stems show and hidden stems conceal — "
        + "both describe the same chart from two sides.",
    }, 0.6, {
      zhHans: "藏而不透的一面倾向{innerTop}，透干显用的一面倾向{outerTop}。"
        + "两侧的前二名占比接近，主导之神尚可两说，故此处并列而不取一。",
      en: "The concealed side leans toward {innerTop} and the revealed side toward {outerTop}. "
        + "On each side the top two shares sit close together, so the leading god is arguable; "
        + "both are listed rather than one chosen.",
    }),

  T("persona.tension", "data", "persona", ["tension", "divergent"], {
    zhHans: "内外张力 {tension}。差异最大的是{divergent}。"
      + "此值只描述内在构成与外在构成的差异大小，不含褒贬 —— "
      + "传统上既可解为含蓄内敛，也可解为言行不一，取决于分歧落在哪几组上。",
    en: "Tension between the concealed and revealed sides: {tension}. The widest gaps are {divergent}. "
      + "The figure describes only how far the two compositions differ and carries no valuation: "
      + "the tradition reads it either as reserve or as inconsistency, depending on which groups diverge.",
  }),

  T("persona.revealRatio", "data", "persona", ["ratio"], {
    zhHans: "显隐比 {ratio} —— 天干占全盘力量的这一份。"
      + "此值的结构区间本就窄（八成的盘落在 25% 至 36% 之间），"
      + "故它只在这个区间内部比较才有意义，不宜孤立解读。",
    en: "Revealed share: {ratio} — the portion of the chart's force carried by the visible stems. "
      + "Its structural range is narrow (four charts in five fall between 25% and 36%), "
      + "so it means something only when compared within that band, not on its own.",
  }),

  T("persona.siling", "data", "persona", ["stem", "god"], {
    zhHans: "月令当权者为{stem}，于日主为{god} —— 传统上以此为禀气的底色。"
      + "它是标注，不另加权：月令的力量已在配重层放大过一次，不重复计入。",
    en: "The month command is held by {stem}, which stands as {god} to the day master; "
      + "the tradition treats this as the ground tone of one's endowment. "
      + "It is a label, not extra weight — the month's force was already amplified in the weighting layer.",
  }),

  T("persona.excess", "data", "persona", ["gods", "traits"], {
    zhHans: "{gods}过旺，传统上此时的表述转向{traits} —— "
      + "同一个十神，适度与太过的解读相反，故不能只看它在不在。",
    en: "{gods} runs to excess, at which point the traditional reading turns to {traits}: "
      + "one and the same god reads oppositely in measure and in excess, "
      + "so its mere presence settles nothing.",
  }),

  T("persona.absent", "data", "persona", ["gods", "traits"], {
    zhHans: "四柱与藏干中不见{gods}。传统上此结构常被解读为{traits}。"
      + "「不见」是占比恰为零，与「弱」是两回事。",
    en: "Neither the stems nor the hidden stems carry {gods}. "
      + "Traditionally such a configuration is read as {traits}. "
      + "Absent means a share of exactly zero, which is a different statement from weak.",
  }),

  T("persona.elements", "data", "persona", ["strongest", "virtue", "traits", "weakest", "skew"], {
    zhHans: "五行以{strongest}最盛（五常配{virtue}），传统上常被解读为{traits}；{weakest}最弱。"
      + "偏枯度 {skew} —— 此值不是缺陷指标，偏枯而成格成局者不在少数。",
    en: "Among the five phases {strongest} is strongest (paired with {virtue} among the five virtues), "
      + "traditionally read as {traits}; {weakest} is weakest. "
      + "Concentration index {skew} — not a defect measure: many well-formed charts are concentrated.",
  }),

  T("persona.mostAttacked", "data", "persona", ["element", "attack", "by"], {
    zhHans: "受克最重的是{element}，累计受克流量 {attack}，主要来自{by}。"
      + "受克最重者与占比最弱者常常不是同一个 —— 前者是被打，后者是本来就少。",
    en: "The phase under the heaviest control is {element}, taking {attack} of cumulative control flow, "
      + "chiefly from {by}. The most-attacked phase and the weakest phase are often not the same one: "
      + "the first is being struck, the second simply has little to begin with.",
  }),

  T("persona.palace", "data", "persona", ["palace", "share", "gods", "note"], {
    zhHans: "{palace}占全盘 {share}，宫中{gods}{note}。",
    en: "{palace} holds {share} of the chart; it carries {gods}{note}.",
  }),
];

// ═══════════════════════════════════════════════════════════
// §2.6 形体与脏腑（《内经》五行配属）
//
// **这两条模板的形状是定死的，不允许自由发挥。**
//
// 边界只有一条：陈述「传统对照 + 本盘事实」，不作「关于这个人的判断」。
//   ✅ 「本盘水最弱，占 4.8%；《内经》中水应肾与膀胱」——两个可验证的陈述并列
//   ❌ 「肾弱」「易患结石」「注意泌尿系统」——替读者做了推论
//
// 「传统养生之说据此提示相应系统宜加留意」做到了要的功能（读者知道该留意哪一系），
// 而没做出这个系统没资格做的断言。差别不是修辞技巧：前者把「留意」归于传统之说，
// 后者把它归于本系统的计算结果。
//
// 由两条规则强制：zh.body.framing（段级，框定语与免责导向缺一即拦）、
// zh.medical.diseaseName（无条件，病名一个都不行）。
// ═══════════════════════════════════════════════════════════

const bodyTemplates: NarrativeTemplate[] = [
  T("body.form", "data", "body", ["element", "share", "xingti"], {
    zhHans: "本盘{element}最旺，占 {share}。传统相法中{element}对应{xingti}一类形貌。"
      + "此为五行与形貌的传统对照，非体检结论。",
    en: "{element} is the strongest phase in this chart at {share}. "
      + "In the traditional physiognomic correspondence, {element} is paired with a "
      + "{xingti} build. This is a classical correspondence, not a physical finding.",
  }),

  T("body.organ", "data", "body",
    ["element", "state", "share", "attackNote", "yang", "heat", "dryness",
      "zang", "fu", "qiao", "ti", "zhi", "qi"], {
      zhHans: "{element}{state}，占 {share}{attackNote}，{yang}；"
        + "寒热{heat}、燥湿{dryness}。"
        + "《内经》五行配属中，{element}应{zang}与{fu}，在窍为{qiao}，在体为{ti}，"
        + "在志为{zhi}，在气为{qi}。"
        + "传统养生之说据此提示相应系统宜加留意。"
        + "以上为传统对照与本盘数值的并列陈述，不构成任何关于身体状况的判断，"
        + "亦不指向任何具体病症；健康相关的决定请咨询持证专业人士。",
      en: "{element} reads as {state} at {share}{attackNote}, {yang}; "
        + "on the warm-cold axis {heat}, on the dry-damp axis {dryness}. "
        + "In the classical correspondences of the Neijing, {element} pairs with the {zang} "
        + "and the {fu}, opens at the {qiao}, governs the {ti}, "
        + "answers to the emotion {zhi} and the climatic factor {qi}. "
        + "Traditional health lore takes this as a cue to keep the corresponding system in view. "
        + "The above sets a classical correspondence beside a chart figure; it constitutes no "
        + "judgement about anyone's physical condition and points to no specific ailment. "
        + "For decisions touching health, please consult a licensed professional.",
    }),

  T("body.axes", "data", "body", ["heat", "heatValue", "dryness", "drynessValue"], {
    zhHans: "全盘寒热{heat}（{heatValue}）、燥湿{dryness}（{drynessValue}）。"
      + "此二轴由五行占比与月令推得，是命理自有的量，与《内经》的五气可相对照。",
    en: "Overall the chart reads {heat} on the warm-cold axis ({heatValue}) and "
      + "{dryness} on the dry-damp axis ({drynessValue}). "
      + "Both are derived from the phase shares and the month command — quantities native to "
      + "the Four Pillars method, which line up with the five climatic factors of the Neijing.",
  }),

  T("body.yangNote", "data", "body", [], {
    zhHans: "「以阳干为主」说的是天干的形式阴阳（甲阳乙阴），"
      + "与中医的阴阳（阴液与阳气）同名而异指，不可混用。"
      + "此处的「阴阳虚实」由虚实档与阳干份额两项并列给出，不合成中医的证型名。",
    en: "「Carried mainly by yang stems」 refers to the formal parity of the heavenly stems, "
      + "which shares a name with — but does not mean — the yin and yang of Chinese medicine. "
      + "The two readings here are given side by side and are never merged into a medical pattern name.",
  }),
];


// ─────────────────────────────────────────────────────────
// §2.9 统计节点 —— 两层结论
//
// 摘要层只出一句，展开层才给依据。**摘要里的每个数字都必须在
// `detail.evidence` 里找得到**（`auditFinding` 强制）：否则摘要写「财运向好」、
// 展开写「财星被劫」，而读者通常只看一层。
//
// 每条模板都自带「这是排序，不是概率」的框定 —— 序列是确定性的准周期序列，
// |z|≥2 的点必然约占 5%，与这张盘是什么盘无关。
// ─────────────────────────────────────────────────────────

const nodeTemplates: readonly NarrativeTemplate[] = [
  T("node.section", "data", "node", ["count", "threshold", "from", "to", "maxShown"], {
    zhHans: "以下 {count} 条为 {from}–{to} 年这条基准窗内，各条曲线越过 ±{threshold} 个标准差的时段。"
      + "门槛决定哪些时段入选，每个尺度按偏离程度取前 {maxShown} 条 —— "
      + "它是一个取舍旋钮，不是显著性水平：序列由出生时刻完全决定，"
      + "越阈的采样点在任何一张盘上都是那么多。"
      + "每条默认只给一句，展开才有依据；摘要里出现的每个数字都能在展开层找到出处。",
    en: "The {count} entries below are the stretches in which each curve crosses ±{threshold} "
      + "standard deviations, measured against the {from}–{to} baseline window. "
      + "The threshold decides which stretches qualify, and each scale lists its top {maxShown} "
      + "by deviation. It is a dial for selection, not a significance level: the series is fully "
      + "determined by the moment of birth, and about as many samples cross the threshold in any "
      + "chart. Each entry gives one line by default; the evidence sits behind it, and every "
      + "figure in the summary can be traced there.",
  }),

  T("node.summary", "data", "node", ["label", "span", "z", "shape", "direction"], {
    zhHans: "{label}在 {span}最偏离常态（{z}σ，{shape}·{direction}）。",
    en: "{label} sits furthest from its own norm during {span} ({z}σ, {shape} · {direction}).",
  }),

  // 中尺度不引 σ 比值 —— 见 node.summary.medium
  T("node.summary.medium", "data", "node",
    ["label", "span", "steps", "peakValue", "mean", "shape", "direction"], {
      zhHans: "{label}在 {span}这一步，在这 {steps} 步大运中明显偏离"
        + "（该步 {peakValue}，各步中位 {mean}，{shape}·{direction}）。",
      en: "{label} in the step covering {span} departs markedly from the other {steps} luck steps "
        + "(that step {peakValue} against a median of {mean} across steps; {shape} · {direction}).",
    }),

  T("node.level.medium", "data", "node", ["peakValue", "mean", "flatSteps"], {
    zhHans: "该步 {peakValue}，各步中位 {mean}，另有 {flatSteps} 步都落在中位附近。"
      + "此处不引「几个标准差」—— 六十年只有六步运，散布由中位数与绝对中位差估出，"
      + "落在四五个取值相近的步上时，那个比值可以大到几十，"
      + "与大节点的三、四完全不在一个量纲上，并列去读只会误导。"
      + "比值仍用来给中节点排序，但不作为陈述。",
    en: "That step reads {peakValue} against a median of {mean} across steps, "
      + "with {flatSteps} of the others sitting near that median. "
      + "No 「standard deviations」 figure is quoted here: sixty years hold only six luck steps, "
      + "and the spread is estimated from the median and the median absolute deviation. "
      + "When four or five steps sit close together that ratio can reach the dozens — "
      + "nowhere near the three or four of a large-scale node, and misleading to read side by side. "
      + "The ratio still orders the medium nodes; it is not quoted as a finding.",
  }),

  T("node.scaleNote.medium", "data", "node", ["from", "to"], {
    zhHans: "此为中节点，基准是 {from}–{to} 年之间那六步大运的步均值。"
      + "所谓「偏离」是在这六步之间排序，不是概率陈述 —— "
      + "六个样本谈不上分布，能说的只是「哪一步与其余几步差得最远」。",
    en: "This is a medium node; the baseline is the per-step mean of the six luck steps between "
      + "{from} and {to}. 「Deviation」 ranks those six steps against one another and is not a "
      + "probability claim — six samples do not make a distribution, and all that can be said is "
      + "which step sits furthest from the rest.",
  }),

  T("node.scaleNote", "data", "node", ["scale", "from", "to"], {
    zhHans: "此为{scale}，基准取 {from}–{to} 年这一段本身的散布。"
      + "所谓「偏离」是在这条序列自己的六十年里排序，不是概率陈述 —— "
      + "命盘的时间序列由出生时刻完全决定，越阈的采样点总在二十分之一上下，与哪张盘无关。",
    en: "This is a {scale}; the baseline is the spread of the {from}–{to} window itself. "
      + "「Deviation」 here ranks moments within this one series' own sixty years and is not a "
      + "probability claim: the chart's time series is fully determined by the moment of birth, "
      + "so about one sample in twenty crosses the threshold no matter whose chart it is.",
  }),

  T("node.level", "data", "node", ["peakValue", "mean", "z"], {
    zhHans: "峰值 {peakValue}，该段基准均值 {mean}，相差 {z} 个标准差。",
    en: "Peak {peakValue} against a baseline mean of {mean} — a gap of {z} standard deviations.",
  }),

  T("node.rate", "data", "node", ["rateZ"], {
    zhHans: "同比变化率偏离 {rateZ} 个标准差。差分取一整年，"
      + "以消掉立春换柱那个每年必现的阶跃 —— 否则量到的只是「立春跳得比月内大」。",
    en: "The year-over-year rate of change sits {rateZ} standard deviations from its norm. "
      + "The difference is taken across a full year so that the annual step at Start of Spring "
      + "cancels out; otherwise the measurement only says 「the annual step is larger than "
      + "within-year drift」, which is always true.",
  }),

  T("node.shape.sustained", "data", "node", [], {
    zhHans: "形态为持续极端：水平长期偏离，变化率却不高 —— 是一段状态，不是一次转折。",
    en: "Shape: sustained. The level stays far from norm while the rate of change does not — "
      + "a condition, not a turning point.",
  }),
  T("node.shape.swift", "data", "node", [], {
    zhHans: "形态为急速穿越：水平本身未及极端，但变得很快 —— 换运前后的典型形态。"
      + "此类节点的吉凶取变化的方向，不取水平的高低。",
    en: "Shape: swift crossing. The level itself is not extreme but is moving fast — "
      + "typical around a change of luck pillar. Its reading follows the direction of change, "
      + "not the height of the level.",
  }),
  T("node.shape.surge", "data", "node", [], {
    zhHans: "形态为突入极端：水平与变化率同时越阈，三种形态中最强的一种。",
    en: "Shape: surge. Level and rate cross the threshold together — the strongest of the three shapes.",
  }),

  T("node.monthNote", "data", "node", ["label"], {
    zhHans: "{label}属权重类序列，而流月不参与权重。"
      + "故此段的边界是立春年的边界，报到年为止 —— 写成某月是它没有的精度。",
    en: "{label} is a weight-bearing series, and the fleeting month carries no weight. "
      + "Its boundaries are therefore the boundaries of solar years, and it is reported to the "
      + "year only — naming a month would claim a precision the model does not have.",
  }),

  T("node.reasons", "data", "node", ["items"], {
    zhHans: "同期可对照的盘面事件：{items}。这些是检出之后才去找的对照，"
      + "不参与检出本身 —— 曲线说「这里变了」，它们说「大概是因为这个」。",
    en: "Chart events in the same window: {items}. These are looked up after detection, not before, and "
      + "take no part in it — the curve says 「something changed here」 and they suggest why.",
  }),

  T("node.noReasons", "data", "node", [], {
    zhHans: "同期没有可对照的神煞或结构事件。曲线的变动来自权重推移本身。",
    en: "No shensha or structural event lines up with this window; the movement comes from the "
      + "shifting weights themselves.",
  }),

  // ── 趋吉避凶 ──
  //
  // 每条都必须自带传统框定与免责导向：这一段最容易被单独复制走，
  // 而单独复制走的一句「宜守不宜攻」就是建议。守卫按**段**判定，见 zh.guidance.framing。
  // 三条趋避各自成一条完整模板，而**不是**「框架 + 可插拔的短语」。
  //
  // 初版把「以守代攻、缓图为上」抽成独立的片段模板，措辞守卫当场拦下 ——
  // 它是对的：那个串一旦存在于模板库里，就是一句可以被原样摘走的行动指令，
  // 无论调用方本来打算把它插进多完整的框定里。故不留这样的片段。
  T("guidance.item.hold", "data", "guidance", ["domain", "span", "trigger"], {
    zhHans: "{domain}在 {span}张力偏高，形态为长期偏离；同期的传统触发标记为{trigger}。"
      + "传统趋避之说于此类时段主张以守代攻、缓图为上。"
      + "以上是典籍之说与盘面数值的并列，不构成任何专业建议；"
      + "涉及健康、法律、财务的决定请咨询持证专业人士。",
    en: "The {domain} domain runs at elevated tension through {span}, in a sustained pattern; "
      + "the traditional markers in the same window are {trigger}. For such stretches the classical "
      + "「seek fortune, avoid harm」 lore holds to holding rather than pressing, and to moving slowly. "
      + "The above sets classical lore beside a chart figure and constitutes no professional advice; "
      + "for decisions touching health, law, or finance, please consult a licensed professional.",
  }),

  T("guidance.item.watch", "data", "guidance", ["domain", "span", "trigger"], {
    zhHans: "{domain}在 {span}张力变动很快，水平本身未及极端；同期的传统触发标记为{trigger}。"
      + "传统趋避之说于此类时段主张凡事多留一分回旋，不轻许诺。"
      + "以上是典籍之说与盘面数值的并列，不构成任何专业建议；"
      + "涉及健康、法律、财务的决定请咨询持证专业人士。",
    en: "The {domain} domain changes quickly through {span} without the level itself reaching an "
      + "extreme; the traditional markers in the same window are {trigger}. For such stretches the "
      + "classical 「seek fortune, avoid harm」 lore holds to leaving room to turn back and not "
      + "committing lightly. The above sets classical lore beside a chart figure and constitutes no "
      + "professional advice; for decisions touching health, law, or finance, please consult a "
      + "licensed professional.",
  }),

  T("guidance.item.settle", "data", "guidance", ["domain", "span", "trigger"], {
    zhHans: "{domain}在 {span}张力与变动同时偏高；同期的传统触发标记为{trigger}。"
      + "传统趋避之说于此类时段主张先安内而后图外，不宜多头并进。"
      + "以上是典籍之说与盘面数值的并列，不构成任何专业建议；"
      + "涉及健康、法律、财务的决定请咨询持证专业人士。",
    en: "In the {domain} domain both tension and rate of change run high through {span}; "
      + "the traditional markers in the same window are {trigger}. For such stretches the classical "
      + "「seek fortune, avoid harm」 lore holds to settling what is near before reaching outward, and "
      + "to not pressing on several fronts at once. The above sets classical lore beside a chart "
      + "figure and constitutes no professional advice; for decisions touching health, law, or "
      + "finance, please consult a licensed professional.",
  }),

  T("guidance.none", "data", "guidance", [], {
    zhHans: "本命六十年中没有张力显著偏高的时段可供列举。"
      + "这说的是这条序列自身的散布较平，不是「一生平顺」——"
      + "同一套判据在任何一张盘上都只挑出最偏的那几段。",
    en: "No stretch of the sixty years stands out as markedly elevated in tension. "
      + "That says the series' own spread is flat, not that a life will be smooth: "
      + "the same criterion picks only the most deviant stretches of whatever chart it is given.",
  }),
];

export const NARRATIVE_TEMPLATES: readonly NarrativeTemplate[] = Object.freeze([
  ...strengthTemplates, ...rootTemplates, ...patternTemplates, ...yongshenTemplates,
  ...gejuTemplates, ...metricsTemplates, ...kinTemplates, ...shenshaTemplates,
  ...personaTemplates, ...bodyTemplates,
  ...timelineTemplates, ...currentTemplates, ...methodTemplates,
  ...nodeTemplates,
]);

export const TEMPLATES_BY_ID: ReadonlyMap<string, NarrativeTemplate> = new Map(
  NARRATIVE_TEMPLATES.map((t) => [t.id, t]),
);

/** §6.3 强制声明 —— 每份报告首尾各一次，逐字固定。 */
export const DISCLAIMER: LocalizedText = Object.freeze({
  zhHans:
    "本报告为四柱命理的计算实现，属传统文化研究与自我省思的工具。"
    + "其中的判定基于传统命理典籍的规则与本系统的量化模型，不具备预测未来事件的能力，"
    + "不构成医疗、法律、财务或任何专业建议。涉及健康、法律、财务的决策，请咨询相应领域的持证专业人士。",
  en:
    "This report is a computational implementation of Four Pillars astrology, offered as a tool for "
    + "cultural study and self-reflection. Its verdicts follow the rules of the traditional literature and "
    + "this system's quantitative model. It has no capacity to predict future events and constitutes no "
    + "medical, legal, financial, or other professional advice. For decisions touching health, law, or "
    + "finance, please consult a licensed professional in that field.",
});

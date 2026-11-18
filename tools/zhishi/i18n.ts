/**
 * 「六爻指事」页面的界面文案。
 *
 * 简体与英文各写一份；繁体由简体经 `toHant` 机械转出 —— 与报告层同一条路。
 * `scripts/build-zhishi.mjs` 在构建时检查：简体里每个字都已在 hant.ts 归类、
 * 转换不抛错、全部文案过人话守卫。任何一条不过，构建失败。
 *
 * 写简体文案时避开 hant.ts 里「无单一读法」的五个字（历、发、复、系、汇）——
 * 它们必须由词条定夺，单独出现会让转换抛错。
 */

export type UiLang = "zh-Hans" | "en";

export interface Ui {
  readonly title: string;
  /** 顶栏上的短名。 */
  readonly brand: string;
  readonly tagline: string;
  readonly navCast: string;
  readonly navResult: string;
  readonly navGuide: string;
  readonly langLabel: string;
  readonly firstTime: string;
  readonly firstTimeLink: string;

  readonly step1: string;
  readonly howTime: string;
  readonly howTimeHint: string;
  readonly howCoin: string;
  readonly howCoinHint: string;
  readonly placeLabel: string;
  readonly placeHint: string;
  readonly cities: readonly string[];

  readonly step2: string;
  readonly handSelf: string;
  readonly handMachine: string;
  readonly helpSelf: string;
  readonly helpMachine: string;
  readonly ordinal: readonly string[];
  readonly bottom: string;
  readonly top: string;
  readonly heads: string;
  readonly tails: string;
  readonly coinAria: string;
  /** 三枚里的正面数 0–3 → 这一次的读法。 */
  readonly summary: readonly [string, string, string, string];
  readonly tossNext: string;
  readonly tossAll: string;
  readonly reset: string;
  readonly count: string;

  readonly step3: string;
  readonly go: string;
  readonly goWaiting: string;

  readonly resultTitle: string;
  readonly castByTime: string;
  readonly castByCoin: string;
  readonly movingNone: string;
  readonly moving: string;
  readonly ben: string;
  readonly bian: string;
  readonly noBian: string;
  readonly legendMoving: string;
  readonly legendPicked: string;
  readonly role: Readonly<Record<"主" | "次" | "体" | "用", string>>;
  readonly guaPicked: string;
  readonly from: string;
  readonly withheld: string;
  readonly again: string;
  readonly error: string;

  readonly guideTitle: string;
  readonly guide: readonly { readonly h: string; readonly p: readonly string[] }[];
  readonly rulesHead: readonly [string, string];
  readonly rulesRows: readonly string[];
  readonly rulesNote: string;

  readonly footer: string;
}

const ZH_HANS: Ui = {
  title: "六爻指事",
  brand: "六爻指事",
  tagline: "起一卦，读《周易》里「这一卦说的是什么事」。",
  navCast: "起卦",
  navResult: "结果",
  navGuide: "说明",
  langLabel: "语言",
  firstTime: "第一次用？",
  firstTimeLink: "先花一分钟看说明",

  step1: "选一种起卦的方式",
  howTime: "按现在的时刻",
  howTimeHint: "用你按下按钮的这一刻起卦。同一个时段里，所有人得到的是同一卦。",
  howCoin: "掷铜钱",
  howCoinHint: "自己掷三枚硬币，一共六次。卦由你掷出来的结果决定。",
  placeLabel: "你在哪",
  placeHint: "用来定当地的时刻。",
  cities: ["上海", "北京", "广州", "深圳", "成都", "西安", "台北", "香港", "新加坡"],

  step2: "掷六次，每次记下三枚的正反",
  handSelf: "我自己掷",
  handMachine: "让程序替我掷",
  helpSelf: "准备三枚一样的硬币，先定好哪一面叫「正」—— 有人以有字的一面为正，也有人以背面为正，"
    + "定了就一直这么算。从最下面一行记起：点一下是正，再点一下是反，第三下清空。",
  helpMachine: "程序用浏览器生成的随机数替你掷，不是你亲手掷的。手边有硬币，还是自己掷。",
  ordinal: ["第一次", "第二次", "第三次", "第四次", "第五次", "第六次"],
  bottom: "最下面",
  top: "最上面",
  heads: "正",
  tails: "反",
  coinAria: "{ord}第 {k} 枚",
  summary: ["三反 · 在动", "一正两反 · 不动", "两正一反 · 不动", "三正 · 在动"],
  tossNext: "掷{ord}",
  tossAll: "六次一起掷",
  reset: "重来",
  count: "已记 {n} / 6",

  step3: "起卦",
  go: "起卦",
  goWaiting: "六次掷齐后再起卦",

  resultTitle: "结果",
  castByTime: "按时刻起",
  castByCoin: "掷铜钱起",
  movingNone: "六格都没动",
  moving: "第 {list} 格在动",
  ben: "本卦",
  bian: "变卦",
  noBian: "没有动的格，也就没有变卦。",
  legendMoving: "画圈、打叉的是在动的格（圈为阳，叉为阴）",
  legendPicked: "标了字的，是这次读的那一格",
  role: { 主: "主", 次: "次", 体: "体", 用: "用" },
  guaPicked: "读整卦 · {role}",
  from: "出自",
  withheld: "有 {n} 段没通过本工具的措辞检查（绝对的说法、命令式的口气之类），未显示。"
    + "这些话是外来的，不为它们开例外。",
  again: "再起一卦",
  error: "出错了：{msg}",

  guideTitle: "说明",
  guide: [
    {
      h: "这是什么",
      p: [
        "六爻是《周易》的一种起卦方法。起出一卦之后，这个工具只做一件事：按传统的取法，"
          + "从《周易》里找出与这一卦对应的那几段话 —— 卦辞、爻辞，以及它们的白话转述 ——"
          + "接成一段，告诉你「这一卦说的是什么事」。",
        "它不判断好坏，也不预言结果。",
      ],
    },
    {
      h: "一卦是怎么来的",
      p: [
        "一卦有六格，从下往上数，最下面是第一格。每一格是一条线：实线为阳，断线为阴。",
        "按时刻起卦，六格由起卦的年、月、日、时算出来，只有一格会动。"
          + "掷铜钱起卦，每一格由一次掷钱决定：三枚同面（三正或三反）的那一格「在动」，其余不动。",
        "在动的格会变成相反的那一种，于是得到第二卦，叫「变卦」；原来那一卦叫「本卦」。",
      ],
    },
    {
      h: "读哪几段",
      p: ["读哪几段，取决于有几格在动："],
    },
    {
      h: "每一段怎么读",
      p: [
        "读到某一格时，依次给出三样：它走到了哪一步（六格各对应一件事的六个阶段），"
          + "这一步的要点，以及展开的说法。读两格时，第二格以「其次」起头。",
        "读整卦时没有「哪一步」可说，直接给要点与展开的说法。",
      ],
    },
    {
      h: "要知道的",
      p: [
        "段落里的话原样照录，只在句与句之间添了连接词。转述里的「你」是转述者的口吻，不是对你本人的判断。",
        "按时刻起卦时，同一个时段里的人得到同一卦 —— 卦属于那个时刻，不属于人。",
        "本工具不构成医疗、法律、财务或任何专业建议。全部计算在这台设备上完成，不联网，不留记录。",
      ],
    },
  ],
  rulesHead: ["动的格数", "读哪一段"],
  rulesRows: [
    "本卦的卦辞（整卦的那段话）",
    "本卦里那一格动的",
    "本卦里那两格动的，以靠上的为主",
    "本卦与变卦的卦辞：本卦说事情本身，变卦说它往哪里去",
    "变卦里那两格没动的，以靠下的为主",
    "变卦里那唯一没动的一格",
    "变卦的卦辞",
  ],
  rulesNote: "这套取法出自朱熹《易学启蒙》。六格全动时，原书对乾、坤两卦另读「用九」「用六」；"
    + "本工具的语料里没有这两条，一律读变卦的卦辞。",

  footer: "以上是《周易》卦辞、爻辞的传统转述，原话照录，只添了连接词；转述里的「你」是转述者的口吻。"
    + "它说的是「这一卦说的是什么事」，不是对你的判断，也不预言结果，不构成医疗、法律、财务或任何专业建议。",
};

const EN: Ui = {
  title: "Six Lines: What It Points To",
  brand: "Six Lines",
  tagline: "Cast a hexagram and read what the Book of Changes says it is about.",
  navCast: "Cast",
  navResult: "Reading",
  navGuide: "Guide",
  langLabel: "Language",
  firstTime: "New to this?",
  firstTimeLink: "Take a minute with the guide",

  step1: "Choose how to cast",
  howTime: "By this moment",
  howTimeHint: "The hexagram comes from the moment you press the button. Everyone casting in the same two-hour period gets the same one.",
  howCoin: "Toss coins",
  howCoinHint: "Toss three coins, six times. The hexagram comes from what you throw.",
  placeLabel: "Where you are",
  placeHint: "Sets the local time.",
  cities: ["Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Chengdu", "Xi'an", "Taipei", "Hong Kong", "Singapore"],

  step2: "Toss six times, marking each coin",
  handSelf: "I'll toss them",
  handMachine: "Toss for me",
  helpSelf: "Take three identical coins and decide which face counts as heads; traditions differ, so pick one "
    + "and keep to it. Start from the bottom row: tap once for heads, again for tails, a third time to clear.",
  helpMachine: "The page tosses with your browser's random number generator, not your own hand. "
    + "If you have coins, toss them yourself.",
  ordinal: ["1st toss", "2nd toss", "3rd toss", "4th toss", "5th toss", "6th toss"],
  bottom: "bottom",
  top: "top",
  heads: "H",
  tails: "T",
  coinAria: "{ord}, coin {k}",
  summary: ["three tails · moving", "one head · still", "two heads · still", "three heads · moving"],
  tossNext: "Toss {ord}",
  tossAll: "Toss all six",
  reset: "Start over",
  count: "{n} of 6 recorded",

  step3: "Cast",
  go: "Cast",
  goWaiting: "Record all six tosses first",

  resultTitle: "Reading",
  castByTime: "Cast by the moment",
  castByCoin: "Cast with coins",
  movingNone: "no moving lines",
  moving: "moving lines: {list}",
  ben: "Original",
  bian: "Changed",
  noBian: "No line is moving, so there is no changed hexagram.",
  legendMoving: "Circle or cross: a moving line (circle yang, cross yin)",
  legendPicked: "Labelled: the line read this time",
  role: { 主: "main", 次: "second", 体: "itself", 用: "heading" },
  guaPicked: "whole hexagram · {role}",
  from: "From",
  withheld: "{n} passage(s) did not pass this tool's wording check (absolute claims, commanding tone and the like) "
    + "and are not shown. The texts come from outside; they get no exemption.",
  again: "Cast again",
  error: "Something went wrong: {msg}",

  guideTitle: "Guide",
  guide: [
    {
      h: "What this is",
      p: [
        "Six-line casting is one way of drawing a hexagram from the Book of Changes. Once a hexagram is cast, "
          + "this tool does one thing: following the traditional rule, it finds the passages the book attaches "
          + "to it (the judgement, the line texts, and plain-language retellings) and joins them into a reading "
          + "of what the hexagram is about.",
        "It does not judge good or bad, and it does not predict outcomes.",
      ],
    },
    {
      h: "How a hexagram is made",
      p: [
        "A hexagram has six lines, counted from the bottom up. Each is solid (yang) or broken (yin).",
        "Cast by the moment, the six lines are worked out from the year, month, day and hour, and exactly one "
          + "line moves. Cast with coins, each line comes from one toss: three of the same face (all heads or "
          + "all tails) makes a moving line; anything else is still.",
        "Moving lines flip to their opposite, which gives a second hexagram, the changed one. "
          + "The first is the original.",
      ],
    },
    {
      h: "Which passages are read",
      p: ["Which passages are read depends on how many lines move:"],
    },
    {
      h: "How each passage reads",
      p: [
        "For a line, the reading gives three things in turn: the stage it stands for (the six lines are the six "
          + "stages of a matter), the key point at that stage, and a fuller retelling. When two lines are read, "
          + "the second begins with “Secondly”.",
        "For a whole hexagram there is no stage; the reading gives the key point and the fuller retelling.",
      ],
    },
    {
      h: "Worth knowing",
      p: [
        "The passages are quoted as they are; only connecting words are added. The “you” in the "
          + "retellings is the reteller's voice, not a judgement about you.",
        "Cast by the moment, everyone in the same two-hour period gets the same hexagram: it belongs to the moment, "
          + "not to the person.",
        "Nothing here is medical, legal, financial or other professional advice. Everything runs on this device; "
          + "nothing is sent or stored.",
      ],
    },
  ],
  rulesHead: ["Moving lines", "What is read"],
  rulesRows: [
    "The judgement of the original hexagram",
    "The one moving line of the original",
    "The two moving lines of the original, the upper one leading",
    "The judgements of both: the original for the matter itself, the changed one for where it is heading",
    "The two unmoving lines of the changed hexagram, the lower one leading",
    "The one unmoving line of the changed hexagram",
    "The judgement of the changed hexagram",
  ],
  rulesNote: "These rules come from Zhu Xi's Introduction to the Study of the Changes. When all six lines move, "
    + "the book reads two special texts for the first two hexagrams; they are not in this tool's sources, "
    + "so the judgement of the changed hexagram is read instead.",

  footer: "These are traditional retellings of the Book of Changes, quoted as they are with only connecting words "
    + "added; the “you” is the reteller's voice. They say what the hexagram is about. They are not a "
    + "judgement of you, do not predict outcomes, and are not medical, legal, financial or other professional advice.",
};

export const UI_SOURCE: Readonly<Record<UiLang, Ui>> = { "zh-Hans": ZH_HANS, en: EN };

/** 对整份文案逐个字符串套一个函数 —— 繁体用它从简体转出。 */
export function mapUi(ui: Ui, f: (s: string) => string): Ui {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return f(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(ui) as Ui;
}

/** 文案里所有字符串 —— 构建时的检查用。 */
export function allStrings(ui: Ui): string[] {
  const out: string[] = [];
  mapUi(ui, (s) => { out.push(s); return s; });
  return out;
}

/** 把 {key} 换成值。 */
export const fill = (s: string, v: Readonly<Record<string, string | number>>): string =>
  s.replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k] ?? `{${k}}`));

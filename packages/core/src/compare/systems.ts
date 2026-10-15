/**
 * 九套系统的**可比属性**登记表。
 *
 * ## 这张表不比较哪一套更准
 *
 * 「哪套更准」问不出答案：没有共同的判准，也没有可供检验的记录。
 * 可以问的是另外几件事，它们都有确定答案：
 *
 * | 问 | 为什么能答 |
 * | --- | --- |
 * | 输入是什么 | 看它的起例，照着做即可 |
 * | 输入里有多少真实天体位置 | 算得出来 |
 * | 同一输入是否恒得同一结果 | 跑两遍就知道 |
 * | 可能的结果有多少种 | 数得出来 |
 * | 最早的可考文献是什么 | 查得到，而托名与可考要分开记 |
 *
 * 这五项把九套系统分得很开 —— 分法与它们的象征体系、与「东方西方」
 * 都不重合，这正是它有意思的地方。
 *
 * ## 托名与可考，分两栏记
 *
 * 这几套东西大多有一个**传说的创立者**（黄帝、陈抟、邵雍、麻衣道者），
 * 和一个**可考的最早文本**，两者往往差几百上千年。
 * 把托名当作年代写进表里，是这个领域最常见的一种失实。故分两栏。
 *
 * ⚠️ 本表的年代与书名**未经实体书核对**，与 `docs/11-validation.md`
 * 里《穷通宝鉴》那一项同样的性质：可用，但别拿它当考据结论。
 */

/** 输入的种类。 */
export type InputKind =
  /** 一个时刻（年月日时）。 */
  | "时刻"
  /** 出生地点 —— 影响真太阳时或上升点。 */
  | "地点"
  /** 一次随机事件：掷钱、洗牌、报数。 */
  | "随机"
  /** 所问之事的类别 —— 决定取哪个用神／牌阵。 */
  | "问类";

/**
 * 天文含量 —— 这套系统的输入里有多少真实天体的位置。
 *
 * 三档的界限很硬，不是程度之分：
 */
export type AstronomyBasis =
  /** **实测天体**：输入直接是某个天体的黄经（太阳、月亮、五星）。 */
  | "实测天体"
  /** **历法派生**：输入是历法上的日期，而该历法由实测天象定（节气、定朔）。 */
  | "历法派生"
  /** **纯约定**：输入与天象无关，是一套自洽的符号规则或一次随机事件。 */
  | "纯约定";

export type Determinism =
  /** 同一输入恒得同一结果。两个人同时同地起，结果逐字相同。 */
  | "确定"
  /** 含一次随机事件，同一时刻重起结果不同。 */
  | "随机"
  /** 起法不止一种，确定与随机都有。 */
  | "两者皆有";

export interface SystemProvenance {
  /** 传说中的创立者或来历。**传说就是传说**，不作年代用。 */
  readonly legendary: string | null;
  /** 可考的最早相关文献或文物，连同大致年代。 */
  readonly attested: string;
  /** 后世的主要文本。 */
  readonly keyTexts: readonly string[];
}

/**
 * 一套占法的可比属性。
 *
 * 叫 `SystemProfile` 而不是 `DivinationSystem`：后者在 `divination/claim.ts`
 * 里已经是四家合参的那个四值枚举（bazi/liuyao/liuren/qimen）。
 * 那是「本项目实现了哪四台引擎」，这里是「世上有哪些占法、各自什么性质」——
 * 两件事，不该共用一个名字。
 */
export interface SystemProfile {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly tradition: "中土" | "西方";
  readonly provenance: SystemProvenance;
  readonly inputs: readonly InputKind[];
  readonly astronomy: AstronomyBasis;
  /** 为什么是这一档 —— 不给理由的分类等于没分。 */
  readonly astronomyWhy: string;
  readonly determinism: Determinism;
  /** 本项目有没有实现它。没实现的，表里的数是**声明**不是实测。 */
  readonly implemented: boolean;
}

export const SYSTEMS: readonly SystemProfile[] = Object.freeze([
  {
    id: "sizhu",
    name: "四柱（子平）", nameEn: "Four Pillars / BaZi", tradition: "中土",
    provenance: {
      legendary: null,
      attested: "唐 · 李虚中以年柱为主；五代宋初 · 徐子平改以日干为主，「子平」之名由此而来",
      keyTexts: ["《渊海子平》（现存明刊本，托名徐升辑）", "《三命通会》（明 · 万民英）",
        "《滴天髓》（托名刘基，注本多在清）", "《穷通宝鉴》／《栏江网》（清 · 余春台辑）"],
    },
    inputs: ["时刻", "地点"],
    astronomy: "历法派生",
    astronomyWhy: "月柱由二十四节气的「节」划分，而节是太阳黄经的 15° 整数倍 ——"
      + "这一层是实测的。时柱由真太阳时定，牵涉经度与均时差，也是实测的。"
      + "但年、日两柱是六十甲子的连续计数，与天象无关。",
    determinism: "确定",
    implemented: true,
  },
  {
    id: "ziwei",
    name: "紫微斗数", nameEn: "Zi Wei Dou Shu", tradition: "中土",
    provenance: {
      legendary: "托名陈抟（北宋初）",
      attested: "现存最早为明代《紫微斗数全书》（托名陈抟，罗洪先编）；一般认为成型于明",
      keyTexts: ["《紫微斗数全书》", "《十八飞星策天紫微斗数》"],
    },
    inputs: ["时刻"],
    astronomy: "历法派生",
    astronomyWhy: "⚠️ 最容易被误解的一套。它的「星」—— 紫微、天府、贪狼 ——"
      + "**不是天上的星**，而是按农历日与时辰的算术规则摆进十二宫的虚星；"
      + "真正的紫微垣（北极一带）一次都不进计算。它的天文含量全在农历："
      + "朔日定初一要真算合朔，置闰要看中气，而中气是太阳黄经的 30° 整数倍。",
    determinism: "确定",
    implemented: false,
  },
  {
    id: "liuyao",
    name: "六爻（纳甲）", nameEn: "Liu Yao / Najia", tradition: "中土",
    provenance: {
      legendary: "纳甲之法归于西汉 · 京房",
      attested: "《火珠林》（托名麻衣道者，宋）为现存较早的纳甲断法专书",
      keyTexts: ["《卜筮正宗》（清 · 王洪绪）", "《增删卜易》（清 · 野鹤老人）"],
    },
    inputs: ["时刻", "随机", "问类"],
    astronomy: "历法派生",
    astronomyWhy: "断卦用的月建与日辰来自历法；按时起卦另取农历月日。"
      + "但卦本身由掷钱得来，那一步与天象无关。",
    determinism: "两者皆有",
    implemented: true,
  },
  {
    id: "meihua",
    name: "梅花易数", nameEn: "Plum Blossom Numerology", tradition: "中土",
    provenance: {
      legendary: "托名北宋 · 邵雍",
      attested: "托名之作，成书年代晚于邵雍；现存本多为明清刊本",
      keyTexts: ["《梅花易数》"],
    },
    inputs: ["时刻", "随机"],
    astronomy: "历法派生",
    astronomyWhy: "按时起卦取农历年月日与时辰之数相加取模，故只经由历法沾天象；"
      + "报数、观物起卦则与天象全无关系。",
    determinism: "两者皆有",
    implemented: true,
  },
  {
    id: "liuren",
    name: "大六壬", nameEn: "Da Liu Ren", tradition: "中土",
    provenance: {
      legendary: "式占之一，与太乙、奇门并称三式",
      attested: "汉代墓葬出土式盘（如安徽阜阳双古堆汉墓）可证式占之制已行",
      keyTexts: ["《六壬大全》（明，收入四库全书）", "《大六壬毕法赋》"],
    },
    inputs: ["时刻", "问类"],
    astronomy: "历法派生",
    astronomyWhy: "⚠️ 这一套的天文含量比看上去高：**月将每中气一换，而中气即太阳入宫点** ——"
      + "月将就是太阳所在的黄道宫，换了一套地支的名字。"
      + "「月将加时」把太阳位置叠到时辰上转出天盘，是一个朴素的天球模型。",
    determinism: "确定",
    implemented: true,
  },
  {
    id: "qimen",
    name: "奇门遁甲", nameEn: "Qi Men Dun Jia", tradition: "中土",
    provenance: {
      legendary: "托名黄帝、风后",
      attested: "托名甚早而成法晚；汉代有太乙九宫占盘出土，与九宫之制相关",
      keyTexts: ["《烟波钓叟歌》（核心歌诀，托名）", "《奇门遁甲元灵经》"],
    },
    inputs: ["时刻"],
    astronomy: "历法派生",
    astronomyWhy: "定局要看节气与三元，节气是太阳黄经；其余（九宫飞布、八门八神）是约定。",
    determinism: "确定",
    implemented: true,
  },
  {
    id: "qizheng",
    name: "七政四余", nameEn: "Chinese Astrology (Seven Luminaries)", tradition: "中土",
    provenance: {
      legendary: null,
      attested: "唐代随佛经与西域历法传入，《七曜攘灾决》《都利聿斯经》为其迹",
      keyTexts: ["《果老星宗》", "《张果星宗》"],
    },
    inputs: ["时刻", "地点"],
    astronomy: "实测天体",
    astronomyWhy: "输入直接是日、月、五星的实际位置 —— 要算星历才起得了盘。"
      + "这是中土传统里与西洋占星同源的那一支。",
    determinism: "确定",
    // 七政与四余可算（`sky/chart.ts`、`compare/correspondence.ts`），
    // 十二宫由上升点定，庙旺陷落平在 `sky/qizheng.ts`。
    // ⚠️ 庙旺表凭记忆转录且转录者读过西洋那张表，故带一层特殊的污染风险 ——
    // 见 docs/11-validation.md §5.1。
    implemented: true,
  },
  {
    id: "astrology",
    name: "西洋占星", nameEn: "Western Astrology", tradition: "西方",
    provenance: {
      legendary: null,
      attested: "巴比伦天象记录为源，希腊化时期成形；托勒密《四书》（Tetrabiblos，2 世纪）为集成",
      keyTexts: ["Ptolemy, Tetrabiblos", "William Lilly, Christian Astrology (1647)"],
    },
    inputs: ["时刻", "地点"],
    astronomy: "实测天体",
    astronomyWhy: "输入是日月五星的黄经，以及由时刻与地点定的上升点与宫位 ——"
      + "全部要算星历。它与七政四余是同一类东西。",
    determinism: "确定",
    // 本项目实现的是**古典（希腊化）**那一支：整宫制、必然尊贵五项、
    // 昼夜盘、托勒密五相。现代占星那一层不实现 —— 不是因为它不好，
    // 是因为它的解读是自由撰写的，没有可判定的规则接得进 Verdict。
    implemented: true,
  },
  {
    id: "tarot",
    name: "塔罗", nameEn: "Tarot", tradition: "西方",
    provenance: {
      legendary: "「源自古埃及」之说由 18 世纪的 Court de Gébelin 提出，无证据支持",
      attested: "15 世纪中叶意大利北部的纸牌**游戏**（trionfi），如 Visconti-Sforza 牌组；"
        + "占卜用途有据的记载始于 18 世纪末（Etteilla）",
      keyTexts: ["Tarot de Marseille（18 世纪定型）",
        "Rider–Waite–Smith（1909）", "Golden Dawn 的对应体系（1888 起）"],
    },
    inputs: ["随机", "问类"],
    astronomy: "纯约定",
    astronomyWhy: "⚠️ **天文含量为零。** 它起于一副纸牌游戏，起盘只需洗牌与切牌，"
      + "不需要时刻，更不需要星历。流行的「牌—行星—星座」对应表是 19 世纪末"
      + "金色黎明一系**后加**的一层注解，不是它的来历，也不进起牌。",
    determinism: "随机",
    implemented: false,
  },
]);

export const systemById = (id: string): SystemProfile | undefined =>
  SYSTEMS.find((s) => s.id === id);

/** 按天文含量分组 —— 这张表最该先看的一刀。 */
export function byAstronomy(): Readonly<Record<AstronomyBasis, readonly SystemProfile[]>> {
  const out: Record<AstronomyBasis, SystemProfile[]> =
    { 实测天体: [], 历法派生: [], 纯约定: [] };
  for (const s of SYSTEMS) out[s.astronomy].push(s);
  return Object.freeze(out);
}

/** 按确定性分组 —— 第二刀，而这一刀与第一刀**切出来的组完全不同**。 */
export function byDeterminism(): Readonly<Record<Determinism, readonly SystemProfile[]>> {
  const out: Record<Determinism, SystemProfile[]> =
    { 确定: [], 随机: [], 两者皆有: [] };
  for (const s of SYSTEMS) out[s.determinism].push(s);
  return Object.freeze(out);
}

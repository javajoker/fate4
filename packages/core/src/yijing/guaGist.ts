/**
 * 卦辞的一句话指事 —— 六十四条，三种语言。
 *
 * ## 为什么有这个文件
 *
 * 语料（`@fate/data/yaoci`）每卦七格，爻辞格各有一句话指事，**卦辞格没有**
 * （语料自带的测试照旧断言它为空）。七例取法里有三例只取卦辞（静、三爻动、六爻动），
 * 指事一栏在这三例里就成了空白。这里补上。
 *
 * ## 这些话是谁写的
 *
 * **本项目撰述，不是语料搬运。** 写法：以语料该卦卦辞的**白话转述**为准、参考卦辞原文；
 * 模型起草，用户逐条审定（2026-11-18）。故它与语料里那 384 条爻辞指事来历不同，
 * 不放进 `packages/data`（那里只放程序化搬运、记了 SHA256 的东西）。
 *
 * 以白话转述为准，意味着转述与原文方向不合的那十来卦（履、大壮、晋、姤……），
 * 指事也跟着转述走，不跟原文 —— 这是审定时定下的取舍，见 docs/13 §7.5.3。
 *
 * ## 三种语言
 *
 * - 简体：审定稿。
 * - 繁体：由 `toHant` 从简体机械转出后**写死在这里**，测试断言两者逐字一致。
 *   不在运行时转 —— 本模块属 `yijing/`，不该反过来依赖报告层。
 * - 英文：与简体同时起草、同时审定；不用第二人称（技术层禁 you）。
 *
 * 每一条都要过技术层与人话层两道措辞守卫，由测试逐条断言。
 */

import type { YaociLocale } from "./yaoci.js";

const ZH_HANS: readonly string[] = [
  "知行合一，内外通达，行事果断而端方正直", // 1 乾为天
  "像大地般包容承载，温顺而坚韧；起初迷茫，渐渐形成主见", // 2 坤为地
  "扎根为先，不随大流；目标未明时，先在已有领域耕耘", // 3 水雷屯
  "启蒙待人来求，教导要有分寸，灌输过多反而有害", // 4 山水蒙
  "如土中珍宝待雨冲刷，时机一到，便可走向更大的天地", // 5 水天需
  "争论中坚持己见，但要留有余地，必要时请有能力的人相助", // 6 天水讼
  "统领众人，任用老成持重之人更为稳妥", // 7 地水师
  "动荡之中守住坚贞，随波逐流只会更加被动", // 8 水地比
  "积蓄尚浅，如密云未雨，继续沉淀到条件成熟", // 9 风天小畜
  "看似如履虎尾，放下犹豫执行计划，不必过虑", // 10 天泽履
  "小有付出，大有回报，努力得到报偿", // 11 地天泰
  "付出多而回报少，努力不被认可，需要重新评估得失", // 12 天地否
  "聚散为同，齐心协力，可以一同闯荡", // 13 天火同人
  "承担起庇护众人的责任，内外一致，和谐亨通", // 14 火天大有
  "谦和真诚、勤奋踏实，日久自会赢得支持", // 15 地山谦
  "万事俱备，不惧外界干扰，可以大胆开拓", // 16 雷地豫
  "身居主导，仍随外部变化调整，内外一致而无灾祸", // 17 泽雷随
  "建立生生不息的生态，向外闯荡时不破坏平衡", // 18 山风蛊
  "居上监督考察，下属成长后仍紧抓不放，便埋下隐患", // 19 地泽临
  "打理好自己，不必推销，酒香不怕巷子深", // 20 风地观
  "补足薄弱环节，处理人事有法可依、果断利落", // 21 火雷噬嗑
  "适度修饰可锦上添花，但改变不了本质，只宜小处调整", // 22 山火贲
  "明确目的，不随波逐流，在诱惑中保持清醒", // 23 山地剥
  "在自己的主场来去自如，引来同伴，形成良性循环", // 24 地雷复
  "谨守原则，不妄动；放下偏见，才看得清全局", // 25 天雷无妄
  "持续积累，借外部条件充实自己，时机成熟再出山", // 26 山天大畜
  "照顾团队、支持他人之余，自己的养护还得靠自己", // 27 山雷颐
  "压力过大如栋梁压弯，要与团队合力化解，不可单打独斗", // 28 泽风大过
  "身陷重险，像水一样柔韧，守住本心与立场", // 29 坎为水
  "想借外力脱困，要果断守正，像母牛般柔顺勤勉、积蓄力气", // 30 离为火
  "与人一拍即合、配合默契，彼此成全，事半功倍", // 31 泽山咸
  "找到能长久的做事方式，带领众人协同前进", // 32 雷风恒
  "力不足以维持现状时，暂时隐退，保全实力", // 33 天山遁
  "适时急流勇退，到新环境里借势成长，更上一层楼", // 34 雷天大壮
  "善用良种，不断繁育提升，竞争力源源不断", // 35 火地晋
  "资源消耗过度，守正格外吃力，仍要在艰难中坚持", // 36 地火明夷
  "行事果断而内心柔和，守住正道，不因冲动迷失方向", // 37 风火家人
  "求同存异，去芜存精，杂质太多反而得不偿失", // 38 火泽睽
  "孤军奋战、举步维艰，要尽快找有能力的人协助脱困", // 39 水山蹇
  "在资源运转中找到自己的出路，否则就会停滞不前", // 40 雷水解
  "根基受损时坚守信念，借势而行，挺过艰难", // 41 山泽损
  "收获之时，趁势出去闯荡，开阔经验与格局", // 42 风雷益
  "表明现状难以为继，不再妥协；远离只顾眼前利益的人", // 43 泽天夬
  "遇到强势对手，以柔克刚，用亲和化敌为友", // 44 天风姤
  "顺应众意，凝聚向心力，众人协作更顺畅", // 45 泽地萃
  "扩张到头时转向提升自己，向能者学习，乘势而上", // 46 地风升
  "升到尽头被困住，进退两难，守住内心便不至被击垮", // 47 泽水困
  "资源看似恒常不变，日日取用，终有耗尽的一天", // 48 水风井
  "变革要明确目的、把握时机，内有坚持，外有支持", // 49 泽火革
  "以已有资源为缓冲，借外部之力提升，让精华尽数展现", // 50 火风鼎
  "身为主心骨，惊雷当前也处变不惊、从容自若", // 51 震为雷
  "动静之间与环境融为一体，共担共享，便无灾祸", // 52 艮为山
  "循序渐进、逐步渗透，好事水到渠成", // 53 风山渐
  "处境被动，先顺应环境、与之契合，硬来只会适得其反", // 54 雷泽归妹
  "壮大如引火燃薪，既懂保存火种，也懂借天时燃旺", // 55 雷火丰
  "资源吃紧时调整策略、另寻方向，不盲目冲动", // 56 火山旅
  "颠沛中保持谦逊柔顺，小事顺通，与人合作更显和谐", // 57 巽为风
  "皆大欢喜之时，仍要保持内心的正直安定", // 58 兑为泽
  "人心不和之时，借有利地位建立共同信念，推动事情", // 59 风水涣
  "暂时退守、保持节制，但节制不可过苦，过苦难以持久", // 60 水泽节
  "自信而以诚待人，如鱼得水，自然形成良好氛围", // 61 风泽中孚
  "外部资源再好也不属于自己，脚踏实地，不好高骛远", // 62 雷山小过
  "事近完成，持续用力收尾，同时适可而止、不做绝", // 63 水火既济
  "想摆脱鸟尽弓藏的处境，需另闯天地；方法不对，只会徒劳无益", // 64 火水未济
];

const ZH_HANT: readonly string[] = [
  "知行合一，內外通達，行事果斷而端方正直", // 1 乾为天
  "像大地般包容承載，溫順而堅韌；起初迷茫，漸漸形成主見", // 2 坤为地
  "紮根為先，不隨大流；目標未明時，先在已有領域耕耘", // 3 水雷屯
  "啟蒙待人來求，教導要有分寸，灌輸過多反而有害", // 4 山水蒙
  "如土中珍寶待雨沖刷，時機一到，便可走向更大的天地", // 5 水天需
  "爭論中堅持己見，但要留有餘地，必要時請有能力的人相助", // 6 天水讼
  "統領眾人，任用老成持重之人更為穩妥", // 7 地水师
  "動盪之中守住堅貞，隨波逐流只會更加被動", // 8 水地比
  "積蓄尚淺，如密雲未雨，繼續沉澱到條件成熟", // 9 风天小畜
  "看似如履虎尾，放下猶豫執行計劃，不必過慮", // 10 天泽履
  "小有付出，大有回報，努力得到報償", // 11 地天泰
  "付出多而回報少，努力不被認可，需要重新評估得失", // 12 天地否
  "聚散為同，齊心協力，可以一同闖蕩", // 13 天火同人
  "承擔起庇護眾人的責任，內外一致，和諧亨通", // 14 火天大有
  "謙和真誠、勤奮踏實，日久自會贏得支持", // 15 地山谦
  "萬事俱備，不懼外界干擾，可以大膽開拓", // 16 雷地豫
  "身居主導，仍隨外部變化調整，內外一致而無災禍", // 17 泽雷随
  "建立生生不息的生態，向外闖蕩時不破壞平衡", // 18 山风蛊
  "居上監督考察，下屬成長後仍緊抓不放，便埋下隱患", // 19 地泽临
  "打理好自己，不必推銷，酒香不怕巷子深", // 20 风地观
  "補足薄弱環節，處理人事有法可依、果斷利落", // 21 火雷噬嗑
  "適度修飾可錦上添花，但改變不了本質，只宜小處調整", // 22 山火贲
  "明確目的，不隨波逐流，在誘惑中保持清醒", // 23 山地剥
  "在自己的主場來去自如，引來同伴，形成良性循環", // 24 地雷复
  "謹守原則，不妄動；放下偏見，才看得清全局", // 25 天雷无妄
  "持續積累，借外部條件充實自己，時機成熟再出山", // 26 山天大畜
  "照顧團隊、支持他人之餘，自己的養護還得靠自己", // 27 山雷颐
  "壓力過大如棟梁壓彎，要與團隊合力化解，不可單打獨鬥", // 28 泽风大过
  "身陷重險，像水一樣柔韌，守住本心與立場", // 29 坎为水
  "想借外力脫困，要果斷守正，像母牛般柔順勤勉、積蓄力氣", // 30 离为火
  "與人一拍即合、配合默契，彼此成全，事半功倍", // 31 泽山咸
  "找到能長久的做事方式，帶領眾人協同前進", // 32 雷风恒
  "力不足以維持現狀時，暫時隱退，保全實力", // 33 天山遁
  "適時急流勇退，到新環境裡借勢成長，更上一層樓", // 34 雷天大壮
  "善用良種，不斷繁育提升，競爭力源源不斷", // 35 火地晋
  "資源消耗過度，守正格外吃力，仍要在艱難中堅持", // 36 地火明夷
  "行事果斷而內心柔和，守住正道，不因衝動迷失方向", // 37 风火家人
  "求同存異，去蕪存精，雜質太多反而得不償失", // 38 火泽睽
  "孤軍奮戰、舉步維艱，要儘快找有能力的人協助脫困", // 39 水山蹇
  "在資源運轉中找到自己的出路，否則就會停滯不前", // 40 雷水解
  "根基受損時堅守信念，借勢而行，挺過艱難", // 41 山泽损
  "收穫之時，趁勢出去闖蕩，開闊經驗與格局", // 42 风雷益
  "表明現狀難以為繼，不再妥協；遠離只顧眼前利益的人", // 43 泽天夬
  "遇到強勢對手，以柔克剛，用親和化敵為友", // 44 天风姤
  "順應眾意，凝聚向心力，眾人協作更順暢", // 45 泽地萃
  "擴張到頭時轉向提升自己，向能者學習，乘勢而上", // 46 地风升
  "升到盡頭被困住，進退兩難，守住內心便不至被擊垮", // 47 泽水困
  "資源看似恆常不變，日日取用，終有耗盡的一天", // 48 水风井
  "變革要明確目的、把握時機，內有堅持，外有支持", // 49 泽火革
  "以已有資源為緩衝，借外部之力提升，讓精華盡數展現", // 50 火风鼎
  "身為主心骨，驚雷當前也處變不驚、從容自若", // 51 震为雷
  "動靜之間與環境融為一體，共擔共享，便無災禍", // 52 艮为山
  "循序漸進、逐步滲透，好事水到渠成", // 53 风山渐
  "處境被動，先順應環境、與之契合，硬來只會適得其反", // 54 雷泽归妹
  "壯大如引火燃薪，既懂保存火種，也懂借天時燃旺", // 55 雷火丰
  "資源吃緊時調整策略、另尋方向，不盲目衝動", // 56 火山旅
  "顛沛中保持謙遜柔順，小事順通，與人合作更顯和諧", // 57 巽为风
  "皆大歡喜之時，仍要保持內心的正直安定", // 58 兑为泽
  "人心不和之時，借有利地位建立共同信念，推動事情", // 59 风水涣
  "暫時退守、保持節制，但節制不可過苦，過苦難以持久", // 60 水泽节
  "自信而以誠待人，如魚得水，自然形成良好氛圍", // 61 风泽中孚
  "外部資源再好也不屬於自己，腳踏實地，不好高騖遠", // 62 雷山小过
  "事近完成，持續用力收尾，同時適可而止、不做絕", // 63 水火既济
  "想擺脫鳥盡弓藏的處境，需另闖天地；方法不對，只會徒勞無益", // 64 火水未济
];

const EN: readonly string[] = [
  "Knowing and doing as one; consistent within and without, decisive and upright.", // 1 乾为天
  "Embracing and bearing like the earth, gentle yet strong; lost at first, then forming a view of one's own.", // 2 坤为地
  "Roots first, not following the crowd; while the goal is unclear, keep working the ground already held.", // 3 水雷屯
  "Instruction waits to be sought and comes in measure; too much does harm.", // 4 山水蒙
  "Like buried treasure waiting for rain to wash it clean: when the time comes, a wider world opens.", // 5 水天需
  "Holding one's ground in a dispute while leaving room; when needed, bringing in someone capable to help.", // 6 天水讼
  "In leading many, a seasoned and steady commander is the safer choice.", // 7 地水师
  "Holding steady amid turbulence; drifting with the current only makes things worse.", // 8 水地比
  "Clouds without rain yet: reserves are thin, and settling and building must go on until conditions are ripe.", // 9 风天小畜
  "Though it feels like treading on a tiger's tail, hesitation can be set aside and the plan carried out.", // 10 天泽履
  "Small effort, large return: work that pays off.", // 11 地天泰
  "Much given, little returned, effort unrecognized; a time to reassess what is owed.", // 12 天地否
  "From scattered to united: together, strength multiplies and ventures open up.", // 13 天火同人
  "Taking on the duty to shelter others; consistent within and without, in harmony.", // 14 火天大有
  "Modest, sincere, and diligent: support comes over time.", // 15 地山谦
  "Everything in place and undisturbed by outside noise: a time to open new ground boldly.", // 16 雷地豫
  "Even in the lead, adjusting to outside change; consistency within and without keeps harm away.", // 17 泽雷随
  "Building an ecosystem that keeps renewing itself, and venturing out without upsetting its balance.", // 18 山风蛊
  "Overseeing from above: holding on tightly after subordinates have outgrown their roles plants serious trouble.", // 19 地泽临
  "Keeping oneself in good order, with no need for self-promotion: good wine needs no bush.", // 20 风地观
  "Shoring up the weak points; handling people matters by clear rules, decisively.", // 21 火雷噬嗑
  "Moderate adornment adds grace but cannot change substance; suited only to small adjustments.", // 22 山火贲
  "Clear about purpose and not drifting with the tide, staying clear-headed amid temptation.", // 23 山地剥
  "On home ground and moving freely, drawing in allies and forming a virtuous cycle.", // 24 地雷复
  "Keeping to principle and not acting rashly; setting prejudice aside to see the whole picture.", // 25 天雷无妄
  "Steady accumulation, enriched by outside resources; stepping out when the time is ripe.", // 26 山天大畜
  "Caring for the team and supporting others, while one's own nourishment remains one's own task.", // 27 山雷颐
  "Pressure bending the ridgepole: to be resolved together with the team, not alone.", // 28 泽风大过
  "Deep in danger, supple as water, holding to one's own heart and stance.", // 29 坎为水
  "Seeking outside help to get free: decisive and upright, gentle and diligent like a cow storing strength.", // 30 离为火
  "An instant match and close cooperation; each completes the other, with twice the result for half the effort.", // 31 泽山咸
  "Finding a way of working that can last, and leading others forward together.", // 32 雷风恒
  "When strength no longer suffices to hold the position, withdrawing for now to preserve it.", // 33 天山遁
  "Stepping back at the right moment and growing in a new setting by riding its momentum.", // 34 雷天大壮
  "Making good use of fine stock and improving it steadily; competitiveness keeps coming.", // 35 火地晋
  "With resources overstretched, staying upright is hard work, yet it is kept up through the hardship.", // 36 地火明夷
  "Decisive in action yet gentle at heart, holding the right course without losing direction to impulse.", // 37 风火家人
  "Seeking common ground while keeping differences; keeping what is useful, as too much dross costs more than it gives.", // 38 火泽睽
  "Isolated and struggling: capable help is needed quickly to get out of the mire.", // 39 水山蹇
  "Finding one's own outlet within the flow of resources, or stagnating.", // 40 雷水解
  "When the core is worn down, holding to conviction and working with circumstances to see the hard stretch through.", // 41 山泽损
  "A season of returns: going out to gain experience and breadth while the tide is favourable.", // 42 风雷益
  "Declaring that the status quo no longer works and compromising no further; leaving those who care only for short-term gain.", // 43 泽天夬
  "Facing a forceful opponent: overcoming hardness with softness and turning rivals into friends.", // 44 天风姤
  "Going with the shared will and building cohesion, so that cooperation flows more easily.", // 45 泽地萃
  "When expansion reaches its limit, turning to self-improvement, learning from the capable, rising with the tide.", // 46 地风升
  "Risen as far as it can go and hemmed in; inner integrity prevents final defeat.", // 47 泽水困
  "A resource that seems unchanging, drawn on daily, can still run dry.", // 48 水风井
  "Change needs a clear aim and good timing, with inner resolve and outside support.", // 49 泽火革
  "Existing resources as a buffer and outside strength to rise, letting the best come through.", // 50 火风鼎
  "As the mainstay, calm and composed even as thunder strikes.", // 51 震为雷
  "In stillness and motion alike, at one with the surroundings, sharing burdens and gains, free of harm.", // 52 艮为山
  "Steady, gradual progress: good things come in their own time.", // 53 风山渐
  "In a passive position, fitting in with the surroundings first; forcing matters backfires.", // 54 雷泽归妹
  "Growth like kindling a fire: knowing how to keep the ember alive and when to let it blaze.", // 55 雷火丰
  "With resources running short, adjusting course and looking for a new direction, without rash moves.", // 56 火山旅
  "Modest and pliant through unsettled times; small matters go smoothly, and working with others shows harmony.", // 57 巽为风
  "When everyone rejoices, the heart is still kept upright and settled.", // 58 兑为泽
  "Amid discord, a favourable position is used to build a shared belief and move things forward.", // 59 风水涣
  "Retreating and practising restraint for now, but restraint must not turn bitter, or it cannot last.", // 60 水泽节
  "Confident and sincere with others, like a fish in water, creating a good atmosphere.", // 61 风泽中孚
  "Outside resources, however good, are not one's own: step by step, feet on the ground, no overreaching.", // 62 雷山小过
  "Near completion: keeping up the effort to finish, while knowing when to stop and not pushing to the extreme.", // 63 水火既济
  "To escape being discarded once useful, breaking out to new ground; the wrong method only wastes effort.", // 64 火水未济
];

/** 按通行本卦序（0–63）排列的卦辞指事。 */
export const GUA_GIST: Readonly<Record<YaociLocale, readonly string[]>> = Object.freeze({
  "zh-Hans": Object.freeze(ZH_HANS),
  "zh-Hant": Object.freeze(ZH_HANT),
  en: Object.freeze(EN),
});

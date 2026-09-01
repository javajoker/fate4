/**
 * 参数校准面板的条目表。
 *
 * 一套有几十个自由参数的模型，没有这个面板是无法被验证的 ——
 * 改一个系数、右侧盘面立即重算，是唯一能建立对参数的直觉的方式。
 *
 * 这里只写**界面元数据**（中文名、一句话说明、取值范围）；
 * 默认值与结构约束的真源始终是 `packages/core/src/params/defaults.ts`，
 * 面板取值一律从那里读，不在此处复述，免得两处漂移。
 *
 * 标记：
 *   流派  人工决策项，不进入自动校准
 *   校准  数据驱动项，由金标准集拟合
 */

export type SpecKind =
  | { readonly kind: "number"; readonly min: number; readonly max: number; readonly step: number }
  | { readonly kind: "bool" }
  | { readonly kind: "enum"; readonly options: readonly (readonly [string, string])[] };

export interface ParamSpec {
  readonly path: string;
  readonly name: string;
  readonly note: string;
  readonly tag?: "流派" | "校准" | "硬约束";
  readonly spec: SpecKind;
}

export interface ParamGroup {
  readonly title: string;
  readonly intro: string;
  readonly items: readonly ParamSpec[];
}

const n = (min: number, max: number, step: number): SpecKind => ({ kind: "number", min, max, step });
const b: SpecKind = { kind: "bool" };
const e = (...options: readonly (readonly [string, string])[]): SpecKind => ({ kind: "enum", options });

export const PARAM_GROUPS: readonly ParamGroup[] = [
  {
    title: "L0 · 排盘",
    intro: "四项流派开关。它们不是可拟合的系数，需要人工择定 —— 把流派选择交给拟合，会得到一个在古籍命例上分数很高、内部理论却不自洽的模型。",
    items: [
      { path: "chart.ziHourRule", name: "日界（子时规则）", tag: "流派",
        note: "23–24 时出生者如何归日。三种取法会得到不同的日柱或时干。",
        spec: e(["lateZiNextDay", "晚子换日"], ["earlyZiSameDay", "早子不换"], ["split", "折衷"]) },
      { path: "chart.mingGongBoundary", name: "命宫月界", tag: "流派",
        note: "以节为界是主流；以中气为界在理论上更自洽（月将本就在中气换）。",
        spec: e(["jie", "以节为界"], ["zhongqi", "以中气为界"]) },
      { path: "chart.hiddenStemVariant", name: "藏干变体", tag: "流派",
        note: "申与亥的藏干在各家之间有出入。",
        spec: e(["standard", "常规"], ["alt", "别本"]) },
      { path: "chart.trueSolarTime", name: "用真太阳时", note: "关掉则时支按钟表时定。", spec: b },
      { path: "chart.equationOfTime", name: "计入均时差", note: "最大约 ±16 分钟，足以跨越时辰边界。", spec: b },
    ],
  },
  {
    title: "L1 · 配重",
    intro: "每柱基础 100，天干四成、地支六成。月令另有放大 —— 它是全盘力量的总闸。",
    items: [
      { path: "weights.stemShare", name: "天干占比", tag: "校准",
        note: "与地支占比之和恒为 1，改一个另一个自动跟随。", spec: n(0.2, 0.6, 0.01) },
      { path: "weights.monthCommand.branchMultiplier", name: "月支放大", tag: "校准",
        note: "月令是提纲。60 × 2.00 = 120。", spec: n(1, 3, 0.05) },
      { path: "weights.monthCommand.stemMultiplier", name: "月干放大", tag: "校准",
        note: "40 × 1.20 = 48。", spec: n(1, 2, 0.05) },
      { path: "weights.monthCommand.silingBoost", name: "司令加成", tag: "校准",
        note: "当权藏干的加成，组内重归一，故月支总量不变。", spec: n(1, 3, 0.05) },
      { path: "weights.luck.total", name: "大运总权重", tag: "校准",
        note: "高于本命一柱 —— 环境作用于命强于命作用于环境。", spec: n(60, 200, 5) },
      { path: "weights.luck.stemShareStart", name: "交运时天干占比",
        note: "一步之内线性衰减至下一项，与地支恰在第 5 年末交叉。", spec: n(0.3, 0.9, 0.05) },
      { path: "weights.luck.stemShareEnd", name: "换运前天干占比", spec: n(0.1, 0.7, 0.05),
        note: "与上一项对称。" },
      { path: "weights.year.total", name: "流年总权重", tag: "校准",
        note: "太岁一年之主。", spec: n(50, 180, 5) },
      { path: "weights.kongwang.factor", name: "空亡折扣", tag: "校准",
        note: "落旬空的权重折扣；逢冲逢合可填实。", spec: n(0.3, 1, 0.05) },
    ],
  },
  {
    title: "L2 · 结构",
    intro: "会合冲刑害破。优先级固定（三会 > 三合 > 半合 > 六合 > 天干五合 > 冲…），此处只调强度与距离衰减。",
    items: [
      { path: "structure.sanhui.gain", name: "三会 · 化神增益", tag: "校准", spec: n(1, 2, 0.05),
        note: "方局最专，增益最大。" },
      { path: "structure.sanhe.gain", name: "三合 · 化神增益", tag: "校准", spec: n(1, 2, 0.05), note: "" },
      { path: "structure.transform.catalystThreshold", name: "合化引化门槛", tag: "校准",
        note: "月令之外，还需一个够强的引化之神，否则只合不化。", spec: n(0, 80, 5) },
      { path: "structure.transform.bindFactorOnFailure", name: "合绊活性折扣", tag: "校准",
        note: "合而不化：双方仍在场、可被作用，但向外施力打折。这是「贪合忘克」的量化。",
        spec: n(0.3, 1, 0.05) },
      { path: "structure.chong.uprootThreshold", name: "拔根判定比", tag: "校准",
        note: "强弱比达此值判为拔根，弱方损耗大增。", spec: n(1.5, 4, 0.1) },
      { path: "structure.arbitration.decisiveMargin", name: "冲合裁决胜出幅度", tag: "校准",
        note: "胜者须超出此比例才判定，否则两败俱伤。", spec: n(1, 2, 0.05) },
      { path: "structure.tomb.sealedFactor", name: "闭库折扣", tag: "校准",
        note: "库未开时中气余气的折扣。", spec: n(0.3, 1, 0.05) },
    ],
  },
  {
    title: "L3 · 生克传导",
    intro: "多轮同步迭代。轮数是**交互深度**，不是收敛控制 —— 迭代到收敛会得到作用矩阵的特征向量，把 L1 的月令信息完全抹掉。",
    items: [
      { path: "propagation.maxRounds", name: "交互轮数", tag: "校准",
        note: "第 1 轮直接作用，第 2 轮邻居的邻居。轮数越多，初始配重的痕迹越淡。",
        spec: n(1, 8, 1) },
      { path: "propagation.damping", name: "阻尼 λ", tag: "校准",
        note: "与轮数共同决定交互深度。", spec: n(0.1, 1, 0.05) },
      { path: "propagation.kernel.sheng", name: "生的作用核", tag: "校准", spec: n(0.05, 0.8, 0.05), note: "" },
      { path: "propagation.kernel.ke", name: "克的作用核", tag: "校准",
        note: "克重于生 —— 传统的一贯表述。", spec: n(0.05, 0.8, 0.05) },
      { path: "propagation.shengEfficiency", name: "生的传输效率 η", tag: "校准",
        note: "1−η 为损耗，不进入任何载体。生因此严格守恒，不会数值爆炸。", spec: n(0.5, 1, 0.05) },
      { path: "propagation.keCost", name: "克者自耗", tag: "校准",
        note: "克是「毁」不是「转移」：双方俱损。", spec: n(0, 1, 0.05) },
      { path: "propagation.outflowCap", name: "单轮流出上限", tag: "校准",
        note: "占自身权重。无此上限，多目标载体的流出率会随目标数量线性膨胀。",
        spec: n(0.1, 1, 0.05) },
      { path: "propagation.inflowDamageCap", name: "单轮受克上限", tag: "校准",
        note: "无此上限，一个大权重的金会把整盘伤害倾泻在唯一那点乙木上，一轮内令其归零。",
        spec: n(0.1, 1, 0.05) },
      { path: "propagation.tongdang.beta", name: "同类抗性 β", tag: "校准",
        note: "同类不加权，改为抗性 —— 加权会引入正反馈。", spec: n(0, 2, 0.05) },
      { path: "propagation.polarity.keSame", name: "同性相克系数",
        note: "七杀无情力猛。", spec: n(0.3, 1.5, 0.05) },
      { path: "propagation.polarity.keCross", name: "异性相克系数",
        note: "正官有情力缓。", spec: n(0.3, 1.5, 0.05) },
    ],
  },
  {
    title: "L4 · 断论",
    intro: "全是阈值与查表，无自由发挥。阈值挪动会直接改变旺衰分档，进而改变取用。",
    items: [
      { path: "conclusion.changshengSchool", name: "十二长生流派", tag: "流派",
        note: "影响通根等级，进而影响旺衰。",
        spec: e(["yangForwardYinReverse", "阳顺阴逆"], ["sameBirthDeath", "阴阳同生同死"]) },
      { path: "conclusion.earthChangsheng", name: "土的长生", tag: "流派",
        note: "戊己的长生位。",
        spec: e(["fireEarthSame", "火土同宫"], ["waterEarthSame", "水土同宫"]) },
      { path: "conclusion.strengthBands.strong", name: "身旺门槛", tag: "校准",
        note: "同党占比达此值判为身旺。四道阈值须严格递减，否则参数校验直接拦下。",
        spec: n(0.5, 0.7, 0.01) },
      { path: "conclusion.strengthBands.balancedLow", name: "中和下界", tag: "校准",
        note: "低于此值判为身弱。", spec: n(0.35, 0.55, 0.01) },
      { path: "conclusion.confidence.bandMargin", name: "置信度带宽", tag: "校准",
        note: "距阈值多远算高置信。带宽越窄，被判为「临界」的盘越少。", spec: n(0.01, 0.2, 0.01) },
      { path: "conclusion.congge.ratioThreshold", name: "从格门槛", tag: "校准",
        note: "同党占比低于此值方可能成从格。", spec: n(0.1, 0.45, 0.01) },
      { path: "conclusion.yongshen.tiaohou.fireFloor", name: "极寒门槛", tag: "校准",
        note: "冬月火占比低于此值即触发调候。", spec: n(0.01, 0.3, 0.01) },
      { path: "conclusion.yongshen.bingyao.damageShare", name: "病药折损比门槛", tag: "校准",
        note: "用神被削掉几成方算成病。尺度无关，故不随大运流年的加入而漂移。",
        spec: n(0.2, 0.8, 0.01) },
      { path: "conclusion.femaleChildStarVariant", name: "女命子女星", tag: "流派",
        note: "各家分歧较大，建议报告中淡化。",
        spec: e(["standard", "常规取法"], ["reversed", "反取"]) },
    ],
  },
  {
    title: "L5 · 时间层",
    intro: "流月流日的重算开关是硬约束，不可修改 —— 改则参数校验直接失败。",
    items: [
      { path: "temporal.index.a", name: "指数 · 结构项系数", tag: "校准",
        note: "权重结构变化对顺逆指数的贡献。", spec: n(0, 12, 0.25) },
      { path: "temporal.index.b", name: "指数 · 事件项系数", tag: "校准",
        note: "应期事件对顺逆指数的贡献。", spec: n(0, 2, 0.05) },
      { path: "temporal.luckPillarCount", name: "大运步数", note: "", spec: n(6, 16, 1) },
      { path: "temporal.qiyun.mode", name: "起运换算", tag: "流派",
        note: "连续换算保留小数；传统离散口诀取整。两者并列输出。",
        spec: e(["continuous", "连续换算"], ["traditionalDiscrete", "传统离散口诀"]) },
    ],
  },
];

// ─────────────────────────────────────────────────────────

export function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (o, k) => (o !== null && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
    obj);
}

/** 不可变的深层写入 —— 只沿路径复制，其余共享。 */
export function setAt<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  if (head === undefined) return obj;
  const src = (obj ?? {}) as Record<string, unknown>;
  const next = rest.length === 0
    ? value
    : setAt((src[head] ?? {}) as Record<string, unknown>, rest.join("."), value);
  return { ...src, [head]: next } as T;
}

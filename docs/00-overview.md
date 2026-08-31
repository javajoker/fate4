# 00 · 系统总览

## 1. 问题陈述

给定一个出生时刻与地点，产出：

1. 完整命盘（四柱 + 胎元 + 命宫 + 神煞 + 空亡 + 纳音）
2. 每个载体的**数值权重**，经五行生克传导后收敛
3. 旺衰、从格、用神、格局、宫位六亲的判定，每条带可回溯的推导链
4. 逐步大运、逐年流年的重算盘面
5. 逐月的神煞与引动事件 + 运势描述（不重算权重）
6. 逐日的五行冲突提示（不重算权重）
7. 以上汇总为分层报告

## 2. 核心抽象：载体（Carrier）

整套系统的关键简化：**一切最终归约为天干**。

- 天干直接是载体。
- 地支不是载体，是**载体的容器**——它把自己的分数按藏干比例下发给所含天干。
- 因此命盘的力量状态 = 一个 10 维向量，每维对应一个天干，天干自带 `(五行, 阴阳)`。

这样做的收益：

- 五行力量 = 10 维向量按五行聚合（5 维）
- 阴阳分布 = 按阴阳聚合（2 维）
- 十神力量 = 以日主为基准对 10 维做关系映射（10 维十神向量）
- 生克传导只需定义**天干 × 天干**的作用核，不必再为地支单独定义一套

```ts
interface Carrier {
  id: string;                    // 稳定标识，如 "month.branch.hidden[0]"
  stem: Stem;                    // 甲…癸
  element: Element;              // 木火土金水
  polarity: Polarity;            // 阳 | 阴
  origin: CarrierOrigin;         // 来源：天干透出 / 地支藏干
  position: Position;            // 所属柱与层
  weight: number;                // 当前权重（L1 初始 → L2 修正 → L3 收敛）
  activity: number;              // 活性阻尼 ∈ [0,1]，L2 产出，影响其"施力"能力
  flags: CarrierFlag[];          // 合绊 / 被冲 / 入墓 / 司令 / 透干 …
  trace: TraceEntry[];           // 权重的每一次变更记录
}
```

`activity` 与 `weight` 分离是刻意的：一个被合绊的天干**存在**（有 weight，仍可被生克）但**不作为**（施力打折）。这对应「合绊者贪合忘克」。

## 3. 位置模型

```ts
type PillarKind = 'year' | 'month' | 'day' | 'hour' | 'luck' | 'annual';
type Layer      = 'stem' | 'branch';

interface Position {
  pillar: PillarKind;
  layer: Layer;
  hiddenIndex?: number;   // 藏干序号，0 = 本气
}
```

本命四柱的**柱序**用于距离计算：`year=0, month=1, day=2, hour=3`。
大运与流年不在这条数轴上，用独立的外部距离系数（见 [05-propagation](05-propagation.md) §4.3）。

## 4. 管线与数据流

```
BirthInput
   │
   ├─ L0  buildChart()        → NatalChart      { 四柱, 胎元, 命宫, 纳音, 空亡, 神煞 }
   │
   ▼
EvaluationContext { natal, luck?, annual? }
   │
   ├─ L1  assignWeights()     → Carrier[]       初始权重
   ├─ L2  applyStructure()    → Carrier[]       + StructureEvent[]
   ├─ L3  propagate()         → Carrier[]       收敛权重 + ConvergenceReport
   ├─ L4  conclude()          → Conclusions     旺衰/从格/用神/格局/十神/宫位六亲
   │
   ▼
EvaluatedChart
   │
   ├─ L5a luckTimeline()      → LuckPillar[]        每步重跑 L1–L4
   ├─ L5b yearView(y)         → YearView            重跑 L1–L4（6 柱）
   ├─ L5c monthView(y, m)     → MonthView           仅神煞 + 引动，无权重
   ├─ L5d dayView(date)       → DayView             仅五行冲突，无权重
   ├─ L5e yingqi()            → YingqiEvent[]       规则引擎
   │
   ▼
L6  report()                  → Report
```

**层间单向。** 下游层不得回写上游层的数据结构。`EvaluatedChart` 一旦产出即冻结（`Object.freeze` + 类型上 `readonly`）。

## 5. Explain trace

每一次权重变更写一条：

```ts
interface TraceEntry {
  layer: 'L1' | 'L2' | 'L3';
  round?: number;              // L3 的迭代轮次
  rule: string;                // 规则标识，如 "L2.chong.branch"
  from: number;                // 变更前权重
  to: number;                  // 变更后权重
  cause: string[];             // 触发方的 carrier id
  params: Record<string, number>;  // 本次用到的参数值
  note?: string;
}
```

判定结论同样带 trace：

```ts
interface Verdict<T> {
  value: T;
  confidence: number;          // ∈ [0,1]，落在阈值边界附近时降低
  derivation: DerivationStep[];
  alternatives?: { value: T; reason: string }[];  // 若换流派/换阈值会得到的其他结论
}
```

`alternatives` 是刻意的：当一个盘接近 `身弱/中和` 的边界，报告必须说「接近临界」，而不是斩钉截铁。这是本系统与市面工具的主要区别之一。

## 6. 参数系统

所有系数在 [`params/default.yaml`](../params/default.yaml)。载入时用 zod schema 校验，缺失项报错而非静默取默认。

```ts
const params = loadParams();            // 默认
const params = loadParams(overrides);   // 深合并覆盖
```

参数分组与 L 层一一对应：`weights`(L1) / `structure`(L2) / `propagation`(L3) / `conclusion`(L4) / `temporal`(L5) / `chart`(L0) / `shensha` / `yingqi`。

## 7. 术语表

| 术语 | 本文档中的精确含义 |
| --- | --- |
| **载体 Carrier** | 一个带权重的天干实例。地支不是载体。 |
| **透干** | 地支藏干与某天干同字，该藏干标记 `revealed` |
| **通根** | 天干在某地支藏干中找到同字或同五行，标记 `rooted`，带根的强度分级 |
| **月提 / 月令** | 月支。L1 中被放大的那个位置。 |
| **司令** | 依出生日距节的天数，月支藏干中当权的那一个 |
| **活性 activity** | 载体施加生克的能力系数，与其自身权重独立 |
| **党势** | 日主的同党（比劫 + 印星）权重之和 |
| **异党** | 食伤 + 财星 + 官杀 权重之和 |
| **交运时刻** | 大运起始的绝对时刻，精确到小时 |
| **引动** | 流年/流月/流日与命局或大运构成合冲刑害，使某个静态结构生效 |

## 8. 不做的事

明确排除，避免范围蔓延：

- **不做紫微斗数、六爻、奇门、择日。** 只做四柱。
- **不做南半球季节反转。** 默认关闭，仅作为参数存在（`chart.southernHemisphereFlip`）。
- **不做流月/流日的权重重算。** 见用户约束，也是性能与理论上的正确选择。
- **不做健康、财务、法律的具体建议。** 五行与脏腑的对应只作为传统对照展示，措辞受 [09-report](09-report.md) §6 约束。

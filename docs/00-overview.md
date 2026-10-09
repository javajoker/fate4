# 00 · 系统总览

## 1. 问题陈述

给定一个出生时刻与地点，产出：

1. 完整命盘（四柱 + 胎元 + 命宫 + 神煞 + 空亡 + 纳音）
2. **基础盘**：每个载体的数值权重，经五行生克传导后的终态。
   **只取四柱**；胎元命宫为辅助，不入权重（[12](12-persona-curves-nodes.md) §2.1）
3. 旺衰、从格、用神、格局、宫位六亲的判定，每条带可回溯的推导链
4. 由基础盘导出的**人格层**：内外十神分布、五行偏枯、形体与内经五行配属
5. 逐步大运、逐年流年的即时盘 —— 以基础盘为固定基准
6. 逐月的神煞与引动事件 + 运势描述（**不重算权重**）
7. 逐日的五行冲突提示（**不重算权重**）
8. 月度采样的**生命曲线**与 θσ **穿越区间**（默认 2σ，可配置；[12](12-persona-curves-nodes.md) §3–§4）
9. 以上汇总为分层报告，每条结论分「一句话」与「完整解释」两层

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
  id: string;                    // 稳定标识，如 "month.branch.0"（0 = 本气）
  stem: Stem;                    // 甲…癸
  element: Element;              // 木火土金水。**只有 L2 的合化可改写它**（需 structure.rewriteCarriers）
  polarity: Polarity;            // 阳 | 阴
  origin: "revealed" | "hidden"; // 天干透出 / 地支藏干。人格层的内外之分即取此字段
  position: Position;            // 所属柱与层
  weight: number;                // 当前权重（L1 初始 → L2 修正（可关）→ L3 收敛）
  activity: number;              // 活性阻尼 ∈ [0,1]，L2 产出，影响其"施力"能力
  flags: CarrierFlag[];          // 合绊 / 被冲 / 入墓 / 司令 / 透干 …
  trace: TraceEntry[];           // 权重的每一次变更记录
}
```

`activity` 与 `weight` 分离是刻意的：一个被合绊的天干**存在**（有 weight，仍可被生克）但**不作为**（施力打折）。这对应「合绊者贪合忘克」。

## 3. 位置模型

```ts
type PillarKind = 'year' | 'month' | 'day' | 'hour' | 'luck' | 'annual' | 'taiyuan';
type Layer      = 'stem' | 'branch';

interface Position {
  pillar: PillarKind;
  layer: Layer;
  hiddenIndex: number | null;   // 藏干序号，0 = 本气；天干层为 null
}
```

本命四柱的**柱序**用于距离计算：`year=0, month=1, day=2, hour=3`。
大运与流年不在这条数轴上，用独立的外部距离系数（见 [05-propagation](05-propagation.md) §3.4）。

**神煞的落点比载体的位置多两个**：

```ts
type ShenshaTarget = PillarKind | 'mingGong' | 'fleetingMonth';
```

命宫与流月都不参与配重（没有载体、不入生克），但都是真实的神煞落点。
曾把它们塞进现成的 `PillarKind`，产出的神煞名字对而宫位错 ——
见 [07-shensha](07-shensha.md) §9.2。

## 4. 管线与数据流

```
BirthInput
   │
   ├─ L0  buildChart()        → NatalChart      { 四柱, 胎元, 命宫, 纳音, 空亡, 神煞 }
   │
   ▼
BaseChart ← buildBaseChart(chart, params)      **算一次，冻结**
   │
   ├─ L1  assignWeights()     → Carrier[]       四柱初始权重
   ├─ L2  applyStructure()    → Carrier[]       + StructureEvent[]
   ├─ L3  propagate()         → Carrier[]       传导终态 + 逐轮审计
   ├─ L4  conclude()          → Conclusions     旺衰/从格/用神/格局/十神/宫位六亲
   ├─ L4p persona()           → Persona         内外分布/五行偏枯/形体与脏腑对照
   │
   ▼
InstantChart ← evaluateAt(base, { luck, annual, fleetingMonth })
   │           四柱的 L1 配重复用；结构与生克**全局重算**（见下）
   │
   ├─ L5a luckTimeline()      → LuckStep[]          每步三个取样点
   ├─ L5b yearView(y)         → YearView            六柱即时盘
   ├─ L5c monthView(y, m)     → MonthView           仅神煞 + 引动，**无权重字段**
   ├─ L5d dayView(date)       → DayView             仅五行冲突，**无权重字段**
   ├─ L5e yingqi()            → YingqiEvent[]       规则引擎
   ├─ L5f series()            → Series[]            月度采样的生命曲线
   ├─ L5n findNodes()         → NodeSet             θσ 穿越区间（默认 2σ）
   │
   ▼
L6  buildReport()             → Report
```

### 4.1 「基础盘算一次」与「即时盘全局重算」并不冲突

`BaseChart` 冻结的是**基准**：四柱的 L1 配重复用不重算，`W_base` 作为一切偏离的分母。

但即时盘的**结构与生克必须全局重跑**，因为：

- 三合需要全部地支同时在场才看得见 —— 本命寅午只成半合，流年来戌才成局
- 冲的裁决依赖相对权重，而大运份额在运内连续推移，**冲的结局会中途翻转**

详见 [12](12-persona-curves-nodes.md) §1.0。

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

**默认值的真源是 [`params/defaults.ts`](../packages/core/src/params/defaults.ts)**；
[`params/default.yaml`](../params/default.yaml) 是平行的文档表述，
由 `test/params.spec.ts` 逐键断言一致，任一处漂移即构建失败。

校验**不引入 zod 一类的库** —— `core` 需在浏览器、Node、Worker 中零运行时依赖地跑。
`params/load.ts` 手写两类校验，一次报出全部错误：

- **区间与枚举** —— 单值是否合法
- **结构不变量** —— 值与值之间的关系（干支占比之和为 1、旺衰四阈值严格递减、
  流月流日不得重算权重…）。这一类若被违反，引擎不会报错，只会静默产出错误盘面。

此外，**未实现的开关一律锁在默认值上**并说明原因 —— 静默忽略是最坏的处置：
用户改了值、以为生效了，而盘面纹丝不动。

```ts
const params = loadParams();            // 默认
const params = loadParams(overrides);   // 深合并覆盖
```

参数分组与 L 层一一对应：

`chart`(L0) / `weights`(L1) / `structure`(L2) / `propagation`(L3) / `conclusion`(L4) /
`shensha` / `temporal`(L5) / `report`(L6)

应期规则（`yingqi`）的权重写在规则本身，不单列参数段。

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
| **基础盘 BaseChart** | 只含四柱的 L1→L3 终态。算一次即冻结，是一切时点偏离的分母 |
| **即时盘 InstantChart** | 基础盘 + 大运 + 流年。结构与生克全局重算，但四柱的初始配重复用 |
| **穿越区间** | 某曲线 \|z\| ≥ 阈值的极大连续区间，带进入点、极值点、离开点 |
| **虚实** | 某五行占比相对五行均分的偏离，叠加受克流量。五档 |
| **形式阴阳** | 天干的奇偶（甲阳乙阴）。**与中医的阴阳（阴液/阳气）同名而异指**，不可混用 |

## 8. 不做的事

明确排除，避免范围蔓延：

- **不做紫微斗数、六爻、奇门、择日。** 只做四柱。
- **不做南半球季节反转。** 默认关闭，仅作为参数存在（`chart.southernHemisphereFlip`）。
- **不做流月/流日的权重重算。** 月与日是引动的扳机，不是力量的来源。
  由类型、参数校验、输出扫描三处强制。
  月度采样的曲线之所以有变化，是**大运份额在连续推移**，不是流月加了分。
- **不做健康、财务、法律的具体建议。**
  五行与脏腑只作**传统对照**呈现：可以说「本盘水最弱占 4.8%，《内经》中水应肾与膀胱」，
  不可以说「肾弱」「易患结石」「注意泌尿系统」。
  **病名无条件禁止**，器官名只能出现在带传统框定与免责导向的对照句里。
  见 [12](12-persona-curves-nodes.md) §2.7 与 [09-report](09-report.md) §6。
- **不作概率陈述。** 统计节点是**排序工具**：命盘的时间序列是确定性的准周期序列，
  σ 只是它自身的经验散布。「六十年中最偏离常态的三段」成立，
  「发生巨变的概率是 5%」不成立。

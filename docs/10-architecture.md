# 10 · 应用方案

## 1. 仓库结构

pnpm workspace 单体仓库。

```
fate/
├── package.json                  # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── params/
│   └── default.yaml              # 唯一参数源
├── docs/                         # 本文档集
└── packages/
    ├── core/                     # 推演内核 —— 零运行时依赖
    ├── data/                     # 静态数据（节气表、调候表、模板库）
    ├── web/                      # Next.js 应用
    ├── skill/                    # Claude Agent Skill
    └── cli/                      # 命令行，供 skill 与调试调用
```

**依赖方向严格单向**：`web → core → data`，`skill → cli → core → data`。
`core` **不得**依赖 `web`、`next`、`react` 或任何浏览器/Node 专属 API。它必须能在浏览器、Node、Worker、Deno 里跑同一份代码。

---

## 2. `packages/core`

```
core/src/
├── index.ts                      # 公共 API 出口
├── types/                        # 全部类型定义，无实现
│   ├── carrier.ts  chart.ts  verdict.ts  params.ts  report.ts
├── astro/
│   ├── julian.ts                 # 儒略日
│   ├── vsop87.ts                 # 太阳视黄经（截断级数）
│   ├── solarTerms.ts             # 节气求解 + 静态表查询
│   ├── deltaT.ts                 # TT ↔ UT
│   └── equationOfTime.ts
├── time/
│   ├── timezone.ts               # 含历史规则
│   └── trueSolarTime.ts
├── ganzhi/
│   ├── tables.ts                 # 01-foundations 的全部静态表
│   ├── algebra.ts                # 干支循环、五行关系、十神映射
│   ├── hiddenStems.ts
│   └── changsheng.ts
├── chart/
│   ├── buildChart.ts             # L0
│   ├── pillars.ts  taiyuan.ts  mingGong.ts
│   ├── siling.ts
│   └── qiyun.ts                  # 起运精确计算
├── weights/assign.ts             # L1
├── structure/
│   ├── detect.ts                 # 会合冲刑害破的检测
│   ├── transform.ts              # 合化判定
│   ├── arbitrate.ts              # 冲合互解裁决
│   └── apply.ts                  # L2 施加
├── propagate/
│   ├── relations.ts  distance.ts  resistance.ts
│   └── iterate.ts                # L3 主循环
├── conclude/
│   ├── tenGods.ts  rootScore.ts  strength.ts
│   ├── specialPattern.ts  yongshen.ts  geju.ts  kin.ts
│   └── metrics.ts
├── shensha/
│   ├── rules.ts                  # 起例（可推导的用函数，不硬编码）
│   ├── scan.ts
│   └── modifiers.ts              # 逢冲/逢合/落空 等状态修饰
├── temporal/
│   ├── luck.ts  year.ts  month.ts  day.ts
│   └── index.ts                  # 顺逆指数
├── yingqi/
│   ├── rules.ts                  # 规则清单
│   ├── engine.ts                 # 求值 + 裁决
│   └── domains.ts
├── report/
│   ├── assemble.ts  templates.ts  guard.ts   # guard = §9-6 措辞扫描
└── params/
    ├── schema.ts                 # zod
    └── load.ts
```

### 2.1 公共 API

```ts
// 排盘
export function buildChart(input: BirthInput, params?: PartialParams): NatalChart;

// 在某一瞬时求解（本命 / 加大运 / 加流年）
export function evaluate(
  chart: NatalChart,
  at: Instant,
  params?: PartialParams
): EvaluatedChart;

// 时间层
export function luckTimeline(chart: NatalChart, params?): LuckPillar[];
export function yearView(chart: NatalChart, year: number, params?): YearView;
export function monthView(chart: NatalChart, year: number, monthIndex: number): MonthView;
export function dayView(chart: NatalChart, date: CalendarDate): DayView;

// 报告
export function buildReport(chart: NatalChart, options: ReportOptions): Report;

// 参数
export function loadParams(overrides?: PartialParams): Params;
export function paramsHash(params: Params): string;
```

**全部为纯函数。**`core` 中无全局可变状态、无 `Date.now()`、无 I/O。所有时间从参数传入。这是可测试性的前提。

### 2.2 性能

单次 `evaluate`：约 24 个载体 → 552 有序对 → 30 轮 ≈ 1.7 万次浮点运算。**微秒级。**
120 年逐年 = 120 次 `evaluate` ≈ 2 毫秒。无需缓存、无需 Worker、无需增量更新。

节气是唯一需要预计算的部分：`packages/data` 内置 1900–2100 的 4824 个节气时刻静态表（约 40 KB gzip）。区间外走实时 VSOP87 计算。

---

## 3. `packages/web`

Next.js App Router。**默认全部本地计算**——生辰数据不出浏览器。

```
web/app/
├── page.tsx                          # 输入表单
├── chart/[id]/
│   ├── layout.tsx                    # 命盘上下文 + 侧栏
│   ├── page.tsx                      # §1 盘面 + §2 力量结构
│   ├── strength/page.tsx             # §3 旺衰与取用
│   ├── kin/page.tsx                  # §4 宫位六亲
│   ├── luck/page.tsx                 # §5 大运
│   ├── year/[y]/page.tsx             # §6 流年
│   ├── calendar/page.tsx             # §7 月历 + 今日
│   ├── report/page.tsx               # 完整报告 + 导出
│   └── params/page.tsx               # 参数校准面板
└── api/
    └── report/route.ts               # 仅 PDF 渲染需要服务端
```

### 3.1 存储

`id` 是**本地生成的 UUID**，命盘数据存 `IndexedDB`。默认不上传任何生辰信息。

分享功能（若做）：把 `BirthInput + paramsOverrides` 压缩后编进 URL fragment（`#` 之后，不进服务器日志），而不是存服务端。

### 3.2 参数校准面板

`/chart/[id]/params` 暴露 `params/default.yaml` 的全部条目，分组对应 L 层，每项带：

- 当前值、默认值、取值范围
- 一句话说明它影响什么
- **实时重算** —— 改一个系数，右侧盘面立即更新

这是给用户（也是给你）校准模型的工具。没有它，一套有几十个自由参数的模型是无法被验证的。

面板支持导出/导入参数集为 JSON，便于保存「我校准过的一套系数」。

### 3.3 状态管理

不用全局状态库。`NatalChart` 由 layout 计算一次放进 React Context，各页按需调 `evaluate`。计算是微秒级的，重算比缓存便宜。

---

## 4. `packages/cli`

```bash
fate chart --date 1990-05-12 --time 14:30 --lon 121.47 --lat 31.23 \
           --tz Asia/Shanghai --gender male --json

fate year  --chart chart.json --year 2026 --json
fate month --chart chart.json --year 2026 --month 3 --json
fate day   --chart chart.json --date 2026-03-15 --json
fate report --chart chart.json --format markdown
```

全部子命令支持 `--params custom.yaml` 与 `--json`。CLI 是 Skill 的执行后端，也是回归测试的入口。

---

## 5. `packages/skill` —— Agent Skill

```
skill/
├── SKILL.md
├── scripts/
│   ├── build_chart.sh
│   ├── year_view.sh
│   └── report.sh
└── references/
    ├── terminology.md        # 术语对照，供模型解释名词
    ├── reading-guide.md      # 如何组织一次解读
    └── constraints.md        # 措辞禁令（09-report §6）
```

### SKILL.md 要点

```markdown
---
name: bazi
description: 四柱（八字）排盘与推演。当用户提供出生年月日时并询问命盘、
  大运、流年、运势、五行、十神、神煞、用神、格局，或要求解读八字时使用。
  需要出生日期、时间、地点。
---

## 工作流程

1. 收齐输入：出生日期、时间（精确到分）、出生地（城市即可，脚本会解析经纬度与时区）、性别
2. 时间不确定时**先问清楚**，不要猜。时辰未知则明确按「时柱缺省」处理并告知影响
3. 调用 `scripts/build_chart.sh` 得到 NatalChart JSON
4. 依用户问题调用 year_view / month_view / day_view
5. 基于返回的 JSON 组织叙述

## 硬约束

- **不得**自行推导任何命理结论。你看到的每个判定都在 JSON 里，
  包括 derivation 字段。解释它，不要发明它。
- **不得**修改任何数值。
- **不得**在数据未支持时补充「一般这种命格会…」。
- 遵守 references/constraints.md 的全部措辞禁令。
- 每次解读结尾附声明。
- 低 confidence 的判定必须说明是临界情况并给出 alternatives。
```

**Skill 与 Web 共用 `core`**，因此 Skill 里说出的每个数字，都能在 Web 上原样复现。

---

## 6. 测试策略

| 层级 | 内容 | 工具 |
| --- | --- | --- |
| 静态表 | `tables.ts` 逐字对应 `01-foundations`；十二长生自洽性断言 | vitest |
| 天文 | 节气时刻 vs 参考数据，1900–2100 逐年，误差 ≤ 1 min | vitest + 参考数据集 |
| 排盘 | 100+ 已知命例的四柱/胎元/命宫/起运 | 黄金测试 |
| L1 | 不变量 1–7（[03-weights](03-weights.md) §10） | 属性测试 |
| L2 | 不变量 1–6（[04-structure](04-structure.md) §13） | 属性测试 |
| L3 | **顺序无关性**（打乱数组结果不变）、质量非增、审计闭合 | 属性测试（fast-check） |
| L4 | 不变量、边界置信度 | vitest |
| L5 | 换运年分段、流月流日无 weight 字段 | 类型 + 运行时 |
| L6 | 禁用词表扫描 | 构建期检查 |
| 端到端 | 若干命例的完整报告快照 | snapshot |

**L3 的顺序无关性测试是最重要的一个。**它是「同步迭代」这个设计承诺的唯一证明。

---

## 7. 实施顺序

严格自底向上，每层通过测试才进下一层。

| 阶段 | 内容 | 完成判据 |
| --- | --- | --- |
| **P0** | `data` 静态表 + `ganzhi` 代数 | 表一致性与自洽性测试全绿 |
| **P1** | `astro` + `time` | 1900–2100 节气误差 ≤ 1 min |
| **P2** | `chart` L0 | 100 命例四柱零误差；命宫两种取法都实现并标注待定 |
| **P3** | `weights` L1 | 不变量测试全绿；配重面板可视 |
| **P4** | `structure` L2 | 不变量全绿；互解裁决有 trace |
| **P5** | `propagate` L3 | **顺序无关性测试通过**；桑基图可渲染 |
| **P6** | `conclude` L4 | 与人工判读的命例比对，旺衰一致率作为校准依据 |
| **P7** | `shensha` + `yingqi` | 神煞起例的推导式与查表式一致 |
| **P8** | `temporal` L5 | 三线曲线、月历、日视图 |
| **P9** | `report` L6 + Web UI | 禁用词扫描通过 |
| **P10** | `cli` + `skill` | Skill 与 Web 结论逐字一致 |

**P2 不通过不进 P3。**排盘错了，后面全部无意义——而排盘的对错是可以 100% 客观验证的，没有任何借口。

---

## 8. 技术选型

| 用途 | 选择 | 理由 |
| --- | --- | --- |
| 语言 | TypeScript `strict` | Skill 与 Web 共用一份内核 |
| 包管理 | pnpm workspace | |
| 时区 | `@js-temporal/polyfill` + 完整 tzdata | 需历史夏令时规则 |
| 参数校验 | zod | 参数文件是外部输入，必须校验 |
| 测试 | vitest + fast-check | 属性测试对不变量是刚需 |
| 图表 | 自绘 SVG（无图表库） | 桑基图与命盘表都是定制的，通用库反而绑手 |
| PDF | 服务端 Playwright 打印 | 唯一需要服务端的功能 |
| 部署 | 静态导出优先，仅 PDF 走 serverless | 生辰数据默认不出浏览器 |

**不引入图表库**是刻意的：本项目的核心可视化（四柱表、桑基图、月历网格）都是高度定制的，通用库的抽象在这里只会增加阻力。三线曲线用 30 行 SVG 就能画。

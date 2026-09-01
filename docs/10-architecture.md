# 10 · 应用方案

## 1. 仓库结构

pnpm workspace 单体仓库。

```
fate/
├── package.json                  # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── params/
│   └── default.yaml              # 默认值的**平行文档**，真源在 core/params/defaults.ts
├── docs/                         # 本文档集
├── scripts/
│   └── generate-vsop87.mjs       # 由官方数据生成截断级数，校验 SHA256
└── packages/
    ├── core/                     # 推演内核 —— 零运行时依赖
    ├── data/                     # 静态数据（VSOP87 截断级数）
    ├── web/                      # Next.js 应用（静态导出）
    ├── cli/                      # 命令行，Skill 的执行后端
    └── skill/                    # Claude Agent Skill 载荷
```

**依赖方向严格单向**：`web → core → data`，`skill → cli → core → data`。
`core` **不得**依赖 `web`、`next`、`react` 或任何浏览器/Node 专属 API。它必须能在浏览器、Node、Worker、Deno 里跑同一份代码。

---

## 2. `packages/core`

```
core/src/
├── index.ts                      # 公共 API 出口
├── types/ganzhi.ts               # 干支、五行、十神的基础类型
├── astro/
│   ├── julian.ts  deltaT.ts  angles.ts  nutation.ts
│   ├── vsop87.ts                 # 太阳视黄经（截断级数）
│   ├── sun.ts  equationOfTime.ts
│   ├── solarTerms.ts             # 节气求根
│   └── defaults.ts               # 默认黄经提供者（单列以断开循环依赖）
├── time/
│   ├── timezone.ts               # Intl + IANA tzdata，含历史夏令时
│   └── trueSolarTime.ts
├── ganzhi/
│   ├── tables.ts                 # 01-foundations 的全部静态表
│   ├── algebra.ts                # 干支循环、五行关系、十神映射、反向查表
│   └── changsheng.ts             # 十二长生、禄刃、通根分级
├── chart/
│   ├── buildChart.ts             # L0，另导出 chartOptionsOf(params)
│   ├── pillars.ts  taiyuan.ts  mingGong.ts  siling.ts  qiyun.ts
│   └── types.ts
├── weights/
│   ├── carrier.ts                # 载体类型与 trace
│   └── assign.ts                 # L1
├── structure/
│   ├── detect.ts  transform.ts  arbitrate.ts  distance.ts
│   └── apply.ts                  # L2 施加
├── propagate/
│   ├── relations.ts  distance.ts  resistance.ts
│   └── iterate.ts                # L3 主循环
├── conclude/
│   ├── traits.ts                 # 十神四栏 + 五行五常特质表（conventional，可替换）
│   ├── neijing.ts                # 《内经》五行配属十三行 + 五窍两派
│   ├── persona.ts                # L4p 人格层
│   ├── tenGods.ts  rootScore.ts  strength.ts
│   ├── specialPattern.ts  yongshen.ts  geju.ts  kin.ts  metrics.ts
│   └── conclude.ts               # L4 总装
├── shensha/
│   ├── tables.ts  rules.ts       # 起例（可推导者用函数，不硬编码）
│   ├── modifiers.ts              # 逢冲/逢合/落空 等状态修饰
│   └── scan.ts
├── yingqi/
│   ├── types.ts  helpers.ts  rules.ts  engine.ts  domains.ts
├── temporal/
│   ├── series.ts                 # L5c 生命曲线（月度采样）
│   ├── evaluate.ts               # 瞬时求解
│   ├── views.ts                  # 大运/流年/流月/流日四视图
│   └── types.ts
├── report/
│   ├── templates.ts  render.ts   # 模板库与求值
│   ├── guard.ts                  # §9-6 措辞扫描
│   ├── labels.ts                 # 枚举 → 中文
│   ├── assemble.ts  markdown.ts  types.ts
└── params/
    ├── types.ts  defaults.ts     # **默认值的真源**
    └── load.ts                   # 手写校验，不引 zod
```

> 原稿在此处列过 `types/carrier.ts` `chart.ts` `verdict.ts` `params.ts` `report.ts`、
> `ganzhi/hiddenStems.ts`、`params/schema.ts`、`temporal/{luck,year,month,day}.ts` ——
> 这些文件最终没有出现：类型与实现同文件更便于维护，
> 时间层四视图合并在 `views.ts` 里共享大量辅助函数。上表为实际结构。

`chart/baseChart.ts`（P11）与 `conclude/{traits,persona}.ts`（P12）已就位。
`conclude/neijing.ts`（P13）亦已就位。
`temporal/series.ts`（P14）亦已就位。**P15 将新增**：`temporal/nodes.ts`、`report/finding.ts`。

### 2.1 公共 API

```ts
// ── L0 排盘 ──
export function buildChart(input: BirthInput, options?: ChartOptions): NatalChart;
/** 由完整参数集导出 L0 开关。界面与 CLI 一律用它，不手工对映。 */
export function chartOptionsOf(p: Params): ChartOptions;

// ── 瞬时求解 ──
export function evaluate(input: {
  chart: NatalChart;
  luck?: { pillar: Pillar; elapsedYears: number } | null;
  annual?: Pillar | null;
  params?: Params;
}): EvaluatedChart;

// ── 时间层 ──
export function luckTimeline(chart: NatalChart, params?: Params): LuckStep[];
export function yearView(chart: NatalChart, year: number, params?: Params): YearView;
export function monthView(chart: NatalChart, year: number, monthIndex: number,
                          params?: Params): MonthView;
export function dayView(chart: NatalChart, y: number, m: number, d: number,
                        params?: Params): DayView;

// ── L6 报告 ──
export function buildReport(chart: NatalChart, options?: ReportOptions): Report;
export function renderMarkdown(report: Report): string;

// ── 措辞守卫 ──
export function scanText(text: string, where: string, opts?): GuardViolation[];
export function formatViolations(vs: readonly GuardViolation[]): string;

// ── 参数 ──
export function loadParams(overrides?: PartialParams): Params;
export function paramsHash(params: Params): string;
```

> 原稿把 `evaluate` 写作 `(chart, at, params)` 三个位置参数。
> 实际取单个具名入参对象 —— 大运需要同时给「哪一柱」与「已行几年」，
> 位置参数放不下，且具名入参在调用点自解释。

**P11 起 `evaluate` 的入口改为收 `BaseChart`**（[12](12-persona-curves-nodes.md) §2.0）：

```ts
export function buildBaseChart(chart: NatalChart, params: Params): BaseChart;
export function evaluateAt(base: BaseChart, at: Instant): InstantChart;
export function series(base: BaseChart, opts?): Series[];        // 月度曲线
export function nodes(series: readonly Series[], opts?): NodeInterval[];  // 2σ 穿越区间
```

这样「基准算过一次」成为**类型层面的事实**，而不是调用方需要记得的纪律。

**全部为纯函数。**`core` 中无全局可变状态、**无 `Date.now()`**、无 I/O。
所有时间从参数传入 —— 取系统时间是外壳（Web / CLI）的职责，这是可测试性的前提。

### 2.2 性能

单次 `evaluate`：约 24 个载体 → 552 有序对 → 30 轮 ≈ 1.7 万次浮点运算。**微秒级。**
120 年逐年 = 120 次 `evaluate` ≈ 2 毫秒。无需缓存、无需 Worker、无需增量更新。

节气是唯一需要预计算的部分：`packages/data` 内置 1900–2100 的 4824 个节气时刻静态表（约 40 KB gzip）。区间外走实时 VSOP87 计算。

---

## 3. `packages/web`

Next.js App Router。**默认全部本地计算**——生辰数据不出浏览器。

```
web/app/
├── page.tsx                          # 输入表单 + 本机已存命盘
├── chart/
│   ├── layout.tsx                    # 命盘上下文 + 顶栏
│   ├── page.tsx                      # §1 盘面 + §2 力量结构
│   ├── strength/page.tsx             # §3 旺衰与取用
│   ├── kin/page.tsx                  # §4 宫位六亲
│   ├── luck/page.tsx                 # §5 大运
│   ├── year/page.tsx                 # §6 流年
│   ├── calendar/page.tsx             # §7 月历 + 今日
│   ├── report/page.tsx               # 完整报告 + 导出
│   └── params/page.tsx               # 参数校准面板
```

### 3.0 命盘标识走片段，不走路径段

原稿写作 `/chart/[id]/…`。实现时改为 `/chart/…#<id>`，理由有二，且第二条更重要：

1. 动态路径段与 `output: "export"` 冲突 —— 静态导出要求构建期就知道全部 `id`，
   而 `id` 是运行时在浏览器里生成的。
2. **路径会随请求发往服务器并进访问日志，片段不会。**分享链接里编的是
   `BirthInput + paramsOverrides`；把它放进路径，等于每次打开都把一份生辰
   写进某处的日志。放进片段则数据只在收发双方的浏览器里。

代价是片段不会自动跟着 `<Link>` 走，各处链接须显式带上（`withFrag`）。
这个代价值得付。

### 3.0b 消费编译产物，不消费 TS 源码

`@fate/core` 的 `exports` 指向 `dist/`。源码里的相对导入按 TS 的 ESM 规范
一律写作 `./x.js`，而打包器不会把它回溯到 `./x.ts` —— 与其为此配一套
扩展名别名（每换一个打包器就要重配一次），不如让内核照常经 `tsc -b`
出真正的 `.js`。web 的 `dev` / `build` 因此都以 `tsc -b ../..` 开头。

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

全部子命令支持 `--params`（`.json` 或 `.yaml`）与 `--json`。
CLI 是 Skill 的执行后端，也是回归测试的入口。

### 4.1 命盘文件存的是输入，不是结果

`chart.json` 里是 `BirthInput + paramsOverrides`，不是算好的 `NatalChart`。

盘面是输入的纯函数，重算是毫秒级的；而序列化一棵含大量浮点的结果树，既要处理精度往返，
又会让「文件里的盘」与「当前引擎算出的盘」可能不一致 ——
换了参数或修了缺陷之后，旧文件会悄悄带着旧结论继续用下去。
存输入则永远重算，`paramsHash` 与 `engineVersion` 如实反映此刻的引擎。

### 4.2 严格模式：未知选项报错，不静默忽略

`--gendre male` 若被默默丢掉，盘面照出、性别按缺省走，错得无声无息。
同理：缺 `--time` 时必须以 `--unknown-hour` 显式声明，**时辰不猜**；
缺 `--gender` 直接报错，因为大运顺逆由年干阴阳与性别共同决定。

### 4.3 `--month` 取公历月

`--month 9` 解析为「节落在九月内的那个节气月」，即白露起的**酉月**。
输出写明该月柱的实际起讫日期 —— 节气月与公历月并不重合。
公历一月对应丑月，而丑月属于**上一个立春年**。

### 4.4 输出前过一遍措辞守卫

CLI 的人读输出同样是面向读者的叙述，故在打印前跑一次扫描；
命中即以退出码 3 中止，**不把违规文本送出去**。

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
| L3 | **顺序无关性**（打乱数组结果不变）、质量非增、审计闭合 | vitest + 打乱重跑 |
| L4 | 不变量、边界置信度 | vitest |
| L5 | 换运年分段、流月流日无 weight 字段 | 类型 + 运行时 |
| L6 | **措辞扫描**：模板库 + 全部叙述语料 + 报告全文 + CLI 输出 | `pnpm guard`，随 `pnpm test` 执行 |
| L6 | 中文输出不得漏出英文枚举（三个及以上连续拉丁字母） | vitest |
| Web | JSX 文本里不得写 Markdown（`**粗体**` 会原样渲染成星号） | `pnpm check:web` |
| L4p | 特质表四栏齐全、过旺与过弱不共用词、全中文、不用量表词汇 | vitest |
| L4p | 内外分布归一化；特质表四栏齐全且全中文 | vitest（P12） |
| 内经 | 配属表十三行逐格对账；病名无条件禁；框定语与免责语缺一即拦 | vitest |
| L6 | 模板文本不得含 Markdown（同一份要进 Web、CLI、JSON 三处） | vitest |
| L5c | 序列条数与分组；月内变化的两个来源可分；流月不入权重；扰动只取最强一条 | vitest |
| L5n | 三尺度；中节点用 MAD；**平直序列不产出节点**的反向对照 | vitest（P15） |
| 端到端 | CLI 的 Markdown 与内核直调**逐字节相同** | vitest |

**L3 的顺序无关性测试是最重要的一个。**它是「同步迭代」这个设计承诺的唯一证明。

### 6.1 每一条「全绿」都要配一条反向对照

只断言「扫描通过」「不变量成立」是**空转的** —— 扫描根本没跑到东西时，
它同样全绿；条件断言在没有样本命中时，它同样全绿。本项目已两次栽在这上面
（P4 的互解裁决从未被样本触发、P9 的措辞扫描）。故：

- 扫描类断言必须同时断言 `scanned > 阈值`，且**植入一条违规必须被逮到**
- 条件类断言必须有**实证覆盖**：确认样本集中确实有命中该分支的盘
- 统计类断言必须有**空对照**：平直序列不得产出节点

---

## 7. 实施顺序

严格自底向上，每层通过测试才进下一层。

| 阶段 | 内容 | 状态 · 完成判据 |
| --- | --- | --- |
| **P0** | `data` 静态表 + `ganzhi` 代数 | ✅ 表一致性与自洽性全绿 |
| **P1** | `astro` + `time` | ✅ 对香港天文台 240 个节气，RMS 18.0 秒，0 项越界 |
| **P2** | `chart` L0 | ✅ 日柱 73000 日连推无错位；命宫两种取法皆实现并标注待定 |
| **P3** | `weights` L1 | ✅ 七条不变量全绿；YAML 与 TS 逐键对账 |
| **P4** | `structure` L2 | ✅ 六条不变量全绿；互解裁决有 trace 且有实证覆盖 |
| **P5** | `propagate` L3 | ✅ **顺序无关性**通过；并修正规格中四处会致命的错误 |
| **P6** | `conclude` L4 | ✅ 旺衰/从格/用神/格局/六亲；后修正忌神方向与病药法 |
| **P7** | `shensha` + `yingqi` | ✅ 起例的推导式与查表式一致；32 条应期规则 |
| **P8** | `temporal` L5 | ✅ 四视图；流月流日无权重字段（类型 + 参数 + 输出三处强制） |
| **P9** | `report` L6 + Web UI | ✅ 措辞扫描通过；十个路由静态导出；图表无红绿吉凶色 |
| **P10** | `cli` + `skill` | ✅ **Skill 与 Web 报告逐字节相同**（构造保证，非人工约定） |
| **P11** | `BaseChart` 一等对象 + `evaluateAt` | 📋 基础盘在一次报告生成中**恰好算一次**；现有断言全绿不变 |
| **P12** | L4p 人格层 | ✅ 张力改按五组算；真缺与过弱分开；置信度与并列门槛由构造对齐 |
| **P13** | 内经配属 + 三条轴 + 守卫的「整段」判定域 | ✅ 配属表十三行逐格对账；病名无条件禁；框定语与免责语缺一即拦；虚实补第六档 |
| **P14** | L5c 曲线层 | 📋 47 条序列 + 扰动序列；**运内结构翻转**有实证样例 |
| **P15** | L5n 节点层 + Finding 两层 | 📋 穿越区间；中节点走 MAD；summary 的每个数字可在 detail 的 evidence 中找到 |

P11–P15 的完整算法见 [12-persona-curves-nodes](12-persona-curves-nodes.md)。

**P2 不通过不进 P3。**排盘错了，后面全部无意义——而排盘的对错是可以 100% 客观验证的，没有任何借口。

---

## 8. 技术选型

| 用途 | 选择 | 理由 |
| --- | --- | --- |
| 语言 | TypeScript `strict` | Skill 与 Web 共用一份内核 |
| 包管理 | pnpm workspace | |
| 时区 | 平台内建 `Intl` + 系统 tzdata | 已含完整历史规则；`core` 要求零运行时依赖 |
| 参数校验 | **手写两类校验**（区间枚举 / 结构不变量） | 同上。zod 会给 `core` 带来运行时依赖 |
| 测试 | vitest | 不变量以**穷举**与**实测样本**验证，未引 fast-check |
| 图表 | 自绘 SVG（无图表库） | 桑基图与命盘表都是定制的，通用库反而绑手 |
| PDF | 服务端 Playwright 打印 | 唯一需要服务端的功能 |
| 部署 | 静态导出优先，仅 PDF 走 serverless | 生辰数据默认不出浏览器 |

**不引入图表库**是刻意的：本项目的核心可视化（四柱表、桑基图、月历网格）都是高度定制的，通用库的抽象在这里只会增加阻力。三线曲线用 30 行 SVG 就能画。

# 08 · L5 时间层与应期

时间层分**两种性质截然不同的层**，这是本系统的核心分界：

| 层 | 载体数 | 重算 L1–L4？ | 产出 |
| --- | --- | --- | --- |
| 大运 | 5 柱 | ✅ 全量重算 | 每步的完整盘面 |
| 流年 | 6 柱 | ✅ 全量重算 | 每年的完整盘面 + 顺逆指数 |
| **流月** | — | ❌ **不重算** | 神煞 + 引动事件 + 当月描述 |
| **流日** | — | ❌ **不重算** | 五行冲突提示 |

**为何流月流日不进权重引擎**：月与日是**引动的扳机**，不是力量的来源。一个流月支不会改变命局的力量结构，它只是让某个既有结构在那个月「响」一下。把流月加进权重迭代，等于让一个 30 天的短期因素与一个终生不变的月令同台竞争数值——既无理论依据，也会让年度曲线被高频噪声淹没。

---

## 1. 大运层

```ts
interface LuckPillar {
  index: number;                        // 第几步，从 1 起
  pillar: Pillar;
  startInstant: Instant;                // 交运时刻 + (n−1)×10 回归年
  endInstant: Instant;
  ageRange: { startVirtual: number; endVirtual: number };
  evaluatedAtStart: EvaluatedChart;     // 取样于本步起点
  evaluatedAtMid: EvaluatedChart;       // 取样于第 5 年末（干支平权点）
  evaluatedAtEnd: EvaluatedChart;       // 取样于本步终点
  stemPhaseSummary: string;             // 前段（重干）气象
  branchPhaseSummary: string;           // 后段（重支）气象
  favorIndex: { start: number; mid: number; end: number };
}
```

大运一步之内取**三个样本点**而非一个。因为干支权重随 `elapsed` 连续变化（见 [03-weights](03-weights.md) §5），起点与终点的盘面可能相差很大——前五年天干占 70%、后五年地支占 70%，同一步大运的前后半段本就该呈现不同气象。只取一个样本点会抹掉这个信息。

---

## 2. 流年层

### 2.1 计算

```
for year in [出生年, 出生年 + 120]:
    instant  ← 该年立春时刻
    luck     ← 覆盖该 instant 的大运（可能为 null，若未交运）
    annual   ← 该年的年柱
    chart    ← evaluate(natal, instant, { luck, annual })    # 全量 L1–L4
```

**换运年的处理**：若某年内发生换运（交运时刻落在该年立春与次年立春之间），`YearView.segments` 返回两段，各带自己的 `EvaluatedChart`。前端渲染为分段柱，标注换运日期。**不做加权平均**——两步大运的气象不可线性混合。

### 2.2 顺逆指数

```
喜用集 = { 用神, 喜神 }      忌仇集 = { 忌神, 仇神 }

Δ(e) = 实际份额(e) − 期望份额(e)                # 见下：期望，不是本命
base = Σ_(e ∈ 喜用) Δ(e) − Σ_(e ∈ 忌仇) Δ(e)

eventDelta = Σ_(触发的应期规则) polarity × weight

raw = temporal.index.a × base + temporal.index.b × eventDelta
index = 50 + 50 × tanh(raw)                    # ∈ (0, 100)
```

#### 份额之差必须相对「中性的一年」，不能相对本命盘

原稿写作 `share_year(e) − share_natal(e)`。那是错的，而且错得隐蔽。

本命盘约 400 单位，加上大运流年约 640。份额之和恒为 1，于是新增的载体必然把
各五行的占比**拉向均匀**。而用神之所以是用神，正因为它在本命盘里弱；
忌神之所以是忌神，正因为它强。两件事凑在一起，「用神占比上升、忌神占比下降」
就成了**加载体这个动作本身**的必然结果，与那两根柱子究竟是什么干支无关。

实测这条偏置（240 个盘年）：`base` 中位数 +0.054、61.7% 的年份为正；
对称的两条规则，「用神得力」触发率 63%，「忌神转旺」只有 38%。

取「新增的力量在五行上均摊」为中性的一年：

```
新增 = 总量_now − 总量_本命
期望份额(e) = ( W本命(e) + 新增 / 5 ) / 总量_now
实际份额(e) = W_now(e) / 总量_now
```

五行求和恒为 0，故不再有整体漂移；无大运流年时 Δ 恒为 0。
改用此式后 `base` 的正值比例由 61.7% 降至 55.8%。

#### 系数

```yaml
temporal.index:
  a: 2.0        # 权重结构变化的贡献
  b: 0.20       # 应期事件的贡献
```

`tanh` 保证有界且在中段近似线性、两端饱和——避免极端盘产出 `−300` 这种无法解释的数值。

**但饱和是有代价的。**原取 `a = 4.0, b = 0.35`，实测 240 个盘年中 **32%** 落在
`<5` 或 `>95`——三分之一的年份被压到两端，指数退化成近乎二值的信号。
落在 25–75 中段的年份只有 21%。降到 `a = 2.0, b = 0.20` 后：饱和率 1%，
中段占比 45%，标准差 27.1，`p10 / p50 / p90 = 18 / 65 / 89`。

再往下（`a = 1.0`）饱和率同样为 0，但整条曲线向中间压缩、区分度下降，
故取 2.0 而非更小。此项为 [校准] 项，金标准集就位后须重标定
（见 [11-validation](11-validation.md) §5）。

回归护栏：`test/temporal.spec.ts` 断言饱和率 < 10%。

> **指数的语义边界（必须写进 UI）**
> 这条曲线衡量的是**当年的五行结构与本命用神的契合程度**，不是「运气好坏」，更不是生活质量。
> 低分年份意味着结构性张力大，这在传统语境中同样对应「变动」「突破」「转折」。
> UI 上不得使用红绿吉凶配色，不得出现「凶年」「大凶」等断言式标签。
> 参见 [09-report](09-report.md) §6。

### 2.3 附加曲线

除顺逆指数外，同图叠加：

- `vitality`（来自 L3）—— 内耗程度。骤降年份对应「多事之秋」。
- `dayMasterShare` —— 日主党势占比的逐年变化，看身强身弱如何随运推移。

三条线一起看，比单一「运势分」有信息量得多。

---

## 3. 流月层（无权重）

用户需求第 6 条：**实际月柱展示神煞，给出当月运势描述，不涉及权重变化。**

### 3.1 月柱确定

#### 节气月的起讫要按黄经求根，不能估算

`monthIndex` 自寅月起（0 = 寅），所属为该**立春年**：索引 0 起于该年立春，
索引 11（丑月）起于**次年**小寒。

首版取「2 月 4 日 + monthIndex × 30.4368 日」作近似，再问「这一刻落在哪个节里」。
两处误差叠加 —— 锚点用固定的 2 月 4 日而非真实立春；月长按均值，
而真实的节气月自 29.4 日（近日点附近）到 31.4 日（远日点附近）不等。
估算点落到真节**之前**时，问出来的就是上一个月的节：
实测索引 7（酉月）报出「立秋 → 白露」，那是申月的区间。

**月柱与它自称的区间对不上，是这一层最难被发现的一类错**：两个字段各自看都合理。

正解是直接按黄经求根 —— 开启寅月的节是立春（λ = 315°），此后每月 +30°。
均值只用来给牛顿法一个初值，不参与结果。
回归护栏见 `test/temporal.spec.ts`「节气月的起讫」：十二个月的月支与开启它的节逐一对账，
且相邻月首尾相接、无缝无叠。


流月边界是**节**，与流年一致的历法基准（见 [02-chart](02-chart.md) §3）。
月干由该年年干起五虎遁。

一个自然年内的 12 个流月，起讫为立春→惊蛰→清明→…→小寒→次年立春。

### 3.2 产出

```ts
interface MonthView {
  yearPillar: Pillar;
  luckPillar: Pillar | null;
  monthPillar: Pillar;
  range: { from: Instant; to: Instant };       // 节到节

  shensha: ShenshaHit[];                        // 月柱干支命中的神煞（§7 全表）
  interactions: Interaction[];                  // 与命局/大运/流年的合冲刑害
  triggeredRules: YingqiEvent[];                // scope: 'month' 的规则
  elementTone: {                                // 定性，非权重
    monthElement: Element;
    relationToYongshen: 'supports' | 'neutral' | 'opposes';
    relationToDayMaster: TenGod;
  };
  narrative: MonthNarrative;
}

interface Interaction {
  type: 'chong' | 'he' | 'xing' | 'hai' | 'po' | 'sanhe' | 'sanhui' | 'fuyin' | 'fanyin';
  monthSide: Position;                          // 月干 或 月支
  targetSide: Position;                         // 命局某柱 / 大运 / 流年
  targetPalace: PalaceName;                     // 引动了哪个宫
  relatedKin: KinRelation[];                    // 牵动哪些六亲
  relatedTenGod: TenGod;
}
```

### 3.3 定性判定规则

月柱不算权重，但要给出方向。判据只用**已算好的 L4 结论**加**月柱的干支关系**：

```
1. 月支五行 == 用神五行            → tone: supports
   月支五行 == 忌神五行            → tone: opposes
   否则                            → tone: neutral

2. 月支冲命局中「用神所居之支」   → 该月张力升高，标记 tension
   月支冲命局中「忌神所居之支」   → 该月疏解，标记 relief

3. 月柱引动的宫位 → 该月的主题落在该宫对应的六亲/事项上
   （年柱宫=长辈/根基，月柱宫=父母兄弟/事业，日支=配偶/内心，时柱=子女/晚年）

4. 月柱神煞 + §7 §8 的状态修饰 → 意象素材
```

**当月描述的生成来源，严格限定为以上四项 + L4 的用神/格局结论。**不得引入未计算的判断。

### 3.4 全年月历视图

一年 12 个月排成一张表，每月一行：月柱、主要神煞、引动的宫位、tone。这是用户日常最常看的一屏，也是最容易被做成噪音的一屏——**约束是：每月至多列 3 条最强的引动，其余折叠。**

---

## 4. 流日层（无权重）

用户需求第 7 条：**每日微调，展示五行冲突内容。**

```ts
interface DayView {
  date: CalendarDate;
  dayPillar: Pillar;
  monthContext: Pillar;
  yearContext: Pillar;

  conflicts: ElementConflict[];
  harmonies: ElementHarmony[];
  shensha: ShenshaHit[];
  note: string;                                 // 一到两句，不作预测
}

interface ElementConflict {
  kind: 'chongDayBranch'      // 日支冲本命日支（冲身）
      | 'chongYongshen'       // 冲用神所居之支
      | 'keDayMaster'         // 日干克本命日主
      | 'keYongshen'          // 日干克用神
      | 'xing' | 'hai'
      | 'fuyinDayPillar';     // 日柱伏吟
  severity: 'mild' | 'notable';                 // 只有两档，刻意不细分
  involvedElements: [Element, Element];
  affectedPalace?: PalaceName;
}
```

**「微调」的含义**：日层不产生任何数值，只做**冲突/相合的枚举与提示**。`severity` 只有两档，因为日层的分辨率本就不支持更细的判断——给出五档只是伪精度。

日层的文案约束最严：`note` 限一到两句，描述「今日五行与本命的张力所在」，**不得**出现宜忌、吉凶、行动建议。这不是黄历。

---

## 5. 应期规则引擎

### 5.1 规则结构

```ts
interface YingqiRule {
  id: string;
  name: string;
  scope: ('luck' | 'year' | 'month' | 'day')[];
  priority: number;                    // 冲突时的裁决序
  when: Predicate;                     // 纯函数 (ctx) => boolean
  polarity: -1 | 0 | 1;                // 逆 / 中性(应事) / 顺
  weight: number;                      // ∈ [0, 1]，进入顺逆指数
  domains: Domain[];
  requires?: string[];                 // 依赖的其他规则 id（组合规则）
  narrativeTag: string;
}

type Domain = 'career' | 'wealth' | 'marriage' | 'health'
            | 'study' | 'kin' | 'relocation' | 'legal' | 'social';
```

`polarity: 0` 是刻意保留的一档——**「应事」不等于「吉」或「凶」**。驿马逢冲是「动」，动是好是坏取决于用忌。把所有事件二分为吉凶，是命理软件最常见的失真来源。

### 5.2 规则清单

**结构类**

| id | 判据 | 极性 | 权重 |
| --- | --- | --- | --- |
| `sui_yun_bing_lin` | 大运干支 == 流年干支 | 0 | 0.80 |
| `tian_ke_di_chong_day` | 流年干克日干 **且** 流年支冲日支 | −1 | 0.85 |
| `tian_ke_di_chong_luck` | 流年与大运 天克地冲 | −1 | 0.70 |
| `fuyin_day` | 流年干支 == 日柱干支 | 0 | 0.55 |
| `fanyin_day` | 流年干支与日柱 天克地冲（同上但记为反吟） | −1 | 0.60 |
| `chong_ti_gang` | 流年支冲月支（提纲） | 0 | 0.65 |
| `chong_year_branch` | 流年支冲年支 | 0 | 0.45 |
| `chong_hour_branch` | 流年支冲时支 | 0 | 0.45 |

**用忌类**

| id | 判据 | 极性 | 权重 |
| --- | --- | --- | --- |
| `yongshen_reinforced` | 流年五行 ∈ 喜用 **且** 该五行占比较本命上升 > 0.03 | +1 | 0.70 |
| `jishen_reinforced` | 流年五行 ∈ 忌仇 **且** 占比上升 > 0.03 | −1 | 0.70 |
| `yongshen_chonged` | 用神所居之支被流年冲 | −1 | 0.75 |
| `yongshen_bound` | 用神被流年合绊（L2 判为 BOUND） | −1 | 0.50 |
| `jishen_restrained` | 忌神被流年所克且权重下降 > 0.03 | +1 | 0.65 |
| `yongshen_gets_root` | 流年支为用神之禄或帝旺 | +1 | 0.60 |

**合局类**

| id | 判据 | 极性 | 权重 |
| --- | --- | --- | --- |
| `sanhe_formed_favorable` | 流年支与命局二支成三合，化神 ∈ 喜用 | +1 | 0.80 |
| `sanhe_formed_adverse` | 同上，化神 ∈ 忌仇 | −1 | 0.80 |
| `sanhui_formed` | 流年支与命局二支成三会方 | 0 | 0.75 |
| `liuhe_with_pillar` | 流年支与某柱支成六合 | 0 | 0.40 |

**墓库类**

| id | 判据 | 极性 | 权重 |
| --- | --- | --- | --- |
| `tomb_opened` | 命局中某墓库支被流年冲开（L2 `TOMB_OPENED`） | 0 | 0.70 |
| `wealth_star_tombed` | 财星入墓且墓未开 | −1 | 0.45 |
| `daymaster_tombed` | 流年为日主之墓且日主弱 | −1 | 0.60 |

**刃杀类**

| id | 判据 | 极性 | 权重 |
| --- | --- | --- | --- |
| `yangren_chonged` | 羊刃所居之支被冲 | −1 | 0.70 |
| `yangren_repeated` | 大运与流年皆见羊刃 | −1 | 0.60 |
| `sha_unrestrained` | 七杀无食神/印制，流年再助杀 | −1 | 0.75 |
| `sha_restrained` | 流年送来食神或印，制化七杀 | +1 | 0.70 |

**神煞类**

| id | 判据 | 极性 | 权重 | 域 |
| --- | --- | --- | --- | --- |
| `yima_chonged` | 驿马逢冲 | 0 | 0.55 | relocation, career |
| `yima_bound` | 驿马逢合 | 0 | 0.35 | relocation |
| `taohua_he` | 桃花逢合 | 0 | 0.50 | marriage, social |
| `taohua_chong` | 桃花逢冲 | 0 | 0.45 | marriage |
| `huagai_void` | 华盖落空亡 | 0 | 0.35 | social, study |
| `tianyi_activated` | 天乙贵人所居之支被流年合或本身值年 | +1 | 0.45 | career, social |
| `kongwang_filled` | 空亡之支被流年冲或合（填实） | 0 | 0.40 | — |

**六亲类**

| id | 判据 | 极性 | 权重 | 域 |
| --- | --- | --- | --- | --- |
| `spouse_palace_chonged` | 日支被冲 | 0 | 0.70 | marriage |
| `spouse_palace_he` | 日支被合 | 0 | 0.55 | marriage |
| `spouse_star_afflicted` | 配偶星被克且权重下降 > 0.04 | −1 | 0.60 | marriage |
| `children_palace_moved` | 时支被冲或合 | 0 | 0.45 | kin |
| `parent_star_afflicted` | 父星或母星入墓 / 受重克 | −1 | 0.45 | kin |

**格局类**

| id | 判据 | 极性 | 权重 |
| --- | --- | --- | --- |
| `xiangshen_damaged` | 相神被流年冲克（破格） | −1 | 0.85 |
| `pattern_restored` | 破格之神被流年制住（复格） | +1 | 0.75 |

### 5.2b 规则要判「变化」，不判「状态」

一条 9 年里有 8 年为真的规则不是应期，是背景；一条从不触发的规则是死代码，
而它在覆盖率上看起来和正常规则一样。**两端都要拦。**

首版实测（240 个盘年）暴露了三类写法上的错：

**一、判据是常驻的结构事实。**「食印制化」原判 `食印之和 > 七杀`——
这是这张盘本来的样子，不是今年变了什么，触发率 75%。改判**制化比相对本命的改善幅度**。

**二、把常态当成事件。**「贵人引动」原判 `天乙贵人.tone === "strengthened"`，
而 `strengthened` 正是吉神的**常态**：只要盘里有天乙且未被冲空即成立，触发率 90%。
改判为须由今年送来的干支引动——流年或大运之支即贵人位。
且只认主起例（日干起）：开了 `alsoComputeYearBase` 之后落点由 2 支变 4 支，
触发率随之翻倍；展示时两套都留，作扳机时只用主起例。

**三、候选数不对称。**「相神中任一转旺」与「败格之神中任一转旺」，
相神常有三个（食神、伤官、比肩），败格之神常只有一两个，于是「成格」
天然比「破格」更容易触发——那是清单长度的产物，不是这张盘的性质（实测 72% 对 40%）。
改按**组内权重之和**判，与成员个数无关。

修正后：33 条规则全部触发过，触发率均低于 70%，平均触发率 19.9%，
每年平均命中 6.6 条；顺向与逆向的累计权重由 2.2 : 1 收敛到 1.53 : 1。

回归护栏：`test/temporal.spec.ts` 断言「无规则触发率为 0」且「无规则触发率 > 70%」。

### 5.3 冲突裁决

多条规则同时触发时：

1. 按 `priority` 降序排列
2. 同域内极性相反的规则**并存不抵消**，报告中并列呈现（「这一年既有 X 也有 Y」是真实的命理状态，不该被平均掉）
3. `eventDelta` 求和时保留符号，由 `tanh` 做饱和

**不做「综合评分取最高的那条」。**取最高会丢掉张力，而张力恰恰是应期分析中最有价值的部分。

### 5.3b 现场依据是强制的

每条规则的 `when` 返回 `true` 或**一段现场依据字符串**；返回字符串时该串直接进入
事件的 `evidence`。于是每条触发都能回答「为什么触发」：

```
用神得助   evidence: "喜用之金、水占比上升 4.2%"
相神被伤   evidence: "正财格的败格之神 劫财 转旺"
岁运并临   evidence: "大运与流年干支同为 甲申"
```

没有 evidence 的事件，读者无从判断该不该采信 —— 与 L4 的 `derivation` 同理。

### 5.4 域聚合

每个域独立汇总：

```ts
interface DomainOutlook {
  domain: Domain;
  supportingEvents: YingqiEvent[];
  opposingEvents: YingqiEvent[];
  neutralEvents: YingqiEvent[];
  tension: number;        // = min(Σ支持, Σ反对) / max(...)，越接近 1 张力越大
  net: number;            // Σ极性×权重
}
```

`tension` 高的域，是这一年真正值得看的地方——支持与反对同时强烈，意味着该领域有实质变动。

---

### 5.5 tension 才是关键，不是 net

同域内极性相反的事件**并存不抵消**。若只看 `net`（净值），
一个「支持 0.8、反对 0.8」的域会被读成 0 —— 与「毫无事件」无法区分。

但这两种情形在命理上截然不同：前者是**大起大落**，后者是**平淡无事**。
故必须同时给出 `tension = min(Σ支持, Σ反对) / max(...)`：

| | net | tension | 读法 |
| --- | --- | --- | --- |
| 支持 0.8 / 反对 0.8 | 0 | **1.0** | 该域有实质变动，值得细看 |
| 无事件 | 0 | 0 | 平淡 |

实测工作例 2025–2027 年，事业域 tension 达 0.81（相神被伤与相神得力同现），
而 net 接近零 —— 只看 net 会把这三年读成「无事」。

## 6. 参数

```yaml
temporal:
  qiyun:
    mode: continuous            # continuous | traditionalDiscrete
    daysPerYear: 3
  luckPillarCount: 12
  includeXiaoyun: false
  yearRangeYears: 120
  sampleLuckAt: [start, mid, end]

  monthLayer:
    recomputeWeights: false     # 硬约束，不建议改
    maxInteractionsShown: 3

  dayLayer:
    recomputeWeights: false     # 硬约束
    severityLevels: 2

  index:
    a: 4.0
    b: 0.35
```

## 7. L5 不变量

1. `monthLayer.recomputeWeights` 与 `dayLayer.recomputeWeights` 恒为 `false`；若为 `true`，构建期报错。
2. 流月/流日的输出中**不得出现任何 `weight` 字段**——类型系统层面禁止。
3. `index ∈ (0, 100)`，且 `tanh` 输入有界。
4. 每个 `YingqiEvent` 必须能追溯到唯一 `ruleId` 与触发它的 `Predicate` 求值快照。
5. 换运年必须返回 `segments.length >= 2`。
6. 大运每步必须有 3 个取样点。

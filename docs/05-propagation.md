# 05 · L3 生克传导（核心算法）

这是整个系统的中心。L1 给出「谁在场、各占多少」，L2 给出「结构如何改写场面」，L3 回答**「这些力量互相作用之后，最终各自剩多少」**。

执行模式：**多轮同步迭代**，轮数为固定的小值。每轮基于上一轮的完整状态计算全部增量，一次性施加。结果与载体的遍历顺序无关，可复现、可单测。

> ⚠️ 本文档早先写的是「迭代至**收敛**」—— 那是错的，且错得要紧。
> 本系统是齐次线性映射，迭代到收敛等于幂迭代，会把 L1 的月提与司令分野**完全冲刷掉**。
> 详见 §5.1。

---

## 1. 三条建模决策（先读这节）

### 1.1 生是「流」，不是「加」

`木生火` 不是凭空给火加分，而是**木的一部分流向火**。母生子，母泄气——这是传统明确表述的。

```
W_木 −= F           W_火 += η · F           η = shengEfficiency = 0.85
```

`(1−η)` 的部分是传输损耗，不进入任何载体。这样 `生` 是**质量守恒（准）**的，不会引发数值爆炸。

### 1.2 克是「毁」，不是「转移」

`金克木` 不是金拿走木的分，是金**削掉**木的分，且金自己也耗力。

```
W_木 −= D           W_金 −= D · keCost      keCost = 0.30
```

双方都减 → 总质量严格单调不增。注意这保证的是**有界**，不是「收敛到定态」——
齐次线性系统没有非零不动点，见 §5.1。

### 1.3 同类不加权，改为「抗性」

这是本模型与常见量化八字最大的分歧点，也是刻意的。

若把 `比劫帮身` 实现为「同五行互相加分」，则任意两个同五行载体每轮互相增益，构成正反馈，`20` 轮后可放大数倍——数值发散，且结论会被「同类多寡」单一维度绑架。

**比劫在传统中的真实作用是「分担官杀之克」「帮身任财官」，即抗压能力，不是凭空生力。**因此：

```
resistance_j = 1 / (1 + β · S_j)          β = tongdang.beta = 0.60
S_j = Σ_(同五行载体 a ≠ j) [ W_a · D(a, j) ] / M          M = 场上总权重
```

`j` 受到的**克**乘以 `resistance_j`。生不受影响。

好处：
- 数学上严格收敛，无正反馈
- 语义上更准：有比劫、有通根的日主，是「更抗打」而不是「凭空更旺」
- **通根自动被覆盖**——天干的根就是同柱距离 `1.00` 的同五行载体，无需另设机制

`propagation.tongdang.mode = 'additive'` 保留了加分式实现，仅供对照实验。默认 `'resistance'`。

---

## 2. 关系判定

对有序对 `(i, j)`，`i ≠ j`：

| `elem(i)` vs `elem(j)` | `rel(i→j)` | i 的动作 |
| --- | --- | --- |
| i 生 j | `SHENG` | 流出 |
| i 克 j | `KE` | 施毁 |
| i == j | `TONG` | 不产生增量，只贡献 `S_j` |
| j 生 i | `PASSIVE` | 无（由 `(j,i)` 方向计） |
| j 克 i | `PASSIVE` | 无（由 `(j,i)` 方向计） |

**每个方向只计一次。**不得在 `(i,j)` 里同时算「i 生 j」和「i 被 j 克」——那是重复计数，是这类实现最常见的 bug。

---

## 3. 作用量

```
基量:   B(i→j) = W_i · A_i · K(rel) · Y(pol_i, pol_j, rel) · Dist(pos_i, pos_j)
```

### 3.1 核 K

```
propagation.kernel:
  sheng: 0.30
  ke:    0.40
```

克重于生，是有意的：四柱中「制」比「生」更能决定成败，且克的破坏性在传统叙述中权重更高。

### 3.2 阴阳系数 Y

| 关系 | 阴阳 | 系数 | 十神对应 | 理由 |
| --- | --- | --- | --- | --- |
| 生 | **异**性 | `1.00` | 正印 / 伤官 | 有情之生，力大 |
| 生 | **同**性 | `0.70` | 偏印 / 食神 | 同性相斥，生而不亲 |
| 克 | **同**性 | `1.00` | 七杀 | 无情之克，力猛 |
| 克 | **异**性 | `0.70` | 正官 / 正财 | 有情之克，有制约而不摧折 |

生与克的阴阳规律**方向相反**——生取异性为强，克取同性为强。这是四柱阴阳理论的核心不对称，必须写进测试。

阴阳一律取**气阴阳**（藏干本身的阴阳），不取地支的位阴阳。见 [01-foundations](01-foundations.md) §2。

### 3.3 距离 Dist

**本命柱序**：`年=0 · 月=1 · 日=2 · 时=3`

| 关系 | 系数 |
| --- | --- |
| 同柱（天干 ↔ 本柱地支藏干） | `1.00` |
| 同一地支内的藏干之间 | `0.60` |
| 相邻柱 `\|Δ\|=1` | `0.80` |
| 隔一柱 `\|Δ\|=2` | `0.40` |
| 隔两柱 `\|Δ\|=3`（年↔时） | `0.20` |
| **附加**：跨层（天干 ↔ 异柱地支） | `× 0.70` |

同支藏干之间取 `0.60`：巳中丙火克庚金是真实存在的（庚在巳虽长生却受制），不能设为 0；但同处一支、气机未分，也不该按满力计。

### 3.4 外部层距离（大运 / 流年）

**刻意不对称**：

| 方向 | 系数 |
| --- | --- |
| 大运 → 本命 | `0.80` |
| 流年 → 本命 | `0.70` |
| 大运 ↔ 流年 | `1.00` |
| 流年 → 日主（额外） | `× 1.15` |
| **本命 → 大运** | `0.60` |
| **本命 → 流年** | `0.50` |

环境作用于人强，人作用于环境弱。这不是数值上的方便，是这个模型的立场：**大运流年是施加于命局的条件，命局可以抵抗，不能取消。**一个身强的人在坏流年里受损较小，但不会把坏流年变成好流年。

---

## 4. 单轮计算

```
function computeRound(carriers, params) -> Delta[]

  M  = Σ carriers[i].weight
  Δ  = zeros(n)

  # ---- 预计算抗性 ----
  for j in carriers:
      S_j = Σ_{a ≠ j, elem(a) == elem(j)} carriers[a].weight · Dist(a, j)
      resistance[j] = 1 / (1 + β · S_j / M)

  # ---- 收集原始作用：按关系分组，**对目标集归一** ----
  outgoing = map<i, Effect[]>
  for i in carriers:
      buckets = groupBy(j ≠ i, rel(i,j))        # 生 / 克 / 同 / 无
      for rel in [生, 克]:
          ts = buckets[rel];  if empty: continue
          w_j   = Y(pol_i, pol_j, rel) · Dist(pos_i, pos_j)
          rate  = K(rel) · max_j(w_j)            # 速率由最强耦合定，非目标个数
          out   = W_i · A_i · rate
          for j in ts:
              B = out · (w_j / Σ w_j)            # 按耦合强度分摊
              if rel == 生:
                  outgoing[i].push({ j, cost: B,            gainToJ: +η · B })
              if rel == 克:
                  damage = B · resistance[j]
                  outgoing[i].push({ j, cost: damage · keCost, gainToJ: −damage })

  # ---- 流出上限（防一轮泄尽）----
  for i in carriers:
      O_i = Σ outgoing[i].cost
      if O_i > outflowCap · W_i:                       # outflowCap = 0.35
          scale = outflowCap · W_i / O_i
          for e in outgoing[i]: e.cost *= scale; e.gainToJ *= scale

  # ---- 受克上限（防一轮蒸发）----
  for j in carriers:
      D_j = Σ_{所有指向 j 的克} (−gainToJ)
      if D_j > inflowDamageCap · W_j:                  # inflowDamageCap = 0.40
          scale = inflowDamageCap · W_j / D_j
          for 每条指向 j 的克 e: e.cost *= scale; e.gainToJ *= scale

  # ---- 汇总 ----
  for i, effects in outgoing:
      for e in effects:
          Δ[i]   −= e.cost
          Δ[e.j] += e.gainToJ

  return Δ
```

**关键点**：流出上限的缩放必须**同时**作用于 `cost` 与 `gainToJ`。只缩 `cost` 会凭空制造质量，只缩 `gainToJ` 会凭空销毁质量——两者都会破坏审计不变量。

---

## 5. 迭代：轮数是「交互深度」，不是收敛控制

### 5.1 为何不能迭代到收敛

本系统的更新式是

```
W ← W + λ · Δ(W)
```

而 `Δ` 的每一项都正比于 `W_i`，即对 `W` **一次齐次**。于是整体是线性映射
`W ← (I + λA) W`。这类映射只有两种归宿：谱半径小于 1 则全部趋零，大于 1 则发散，
**恰等于 1 是零测度事件**。「收敛到非零定态」在这个形式下根本不存在。

更要命的是：迭代到「收敛」等于**幂迭代**，结果趋于矩阵的主特征向量 ——
那只由结构（哪些五行在场、如何耦合）决定，**完全遗忘初始权重**。
L1 辛苦算出的月提放大与司令分野会被彻底冲刷掉。

实测（工作例，火占 L2 出口 52.7%）：

| 轮数 | 木 | 火 | 土 | 金 | 水 |
| --- | --- | --- | --- | --- | --- |
| L2 出口 | 0.9% | **52.7%** | 15.0% | 28.3% | 3.0% |
| 3 | 1.1% | **43.9%** | 28.2% | 22.0% | 4.8% |
| 10 | 0.0% | 34.3% | 47.4% | 18.3% | 0.0% |
| 30 | 0.0% | **8.8%** | 28.2% | **63.0%** | 0.0% |

30 轮后火只剩 8.8%、金升到 63% —— 初始信息尽失，这不是「传导的结果」，
是「矩阵的特征向量」。

### 5.2 正确的语义

展开 `(I+λA)^k = I + kλA + C(k,2)(λA)² + …`：**一阶项随 k 线性增长**。
所以轮数直接决定「让生克作用发生多少」，没有自然截断点 ——
它是一个**校准参数**，与核系数同性质，须标 `[校准]`。

```
propagation:
  maxRounds: 3        # [校准] 交互深度
  damping: 0.50       # [校准] 与 maxRounds 共同决定总交互量
  epsilon: 0.002      # 提前停止的安全阀，**不是**主控制
```

取 3 的理由：2 轮才能捕捉二阶链（金生水、水再生木），3–4 轮覆盖三四阶，
再多则开始向特征向量退化。`damping × maxRounds` 是有效交互深度，二者部分冗余。

### 5.3 两道上限

```
outflowCap: 0.35        # 单轮任一载体的**流出**上限
inflowDamageCap: 0.40   # 单轮任一载体的**受克**上限
```

二者对称，缺一不可：

- 无流出上限 → 强载体一轮泄尽
- 无受克上限 → **一个大载体的全部克力可能砸在唯一的小目标上，一轮之内蒸发它**

后者是实测发现的：工作例中金 123 单位，其克的唯一目标是 4 单位的乙木，
无上限时乙木一轮归零。克应当削弱，不应当汽化。

### 5.4 对目标集归一（关键）

**流出速率是施方的属性，多个受方是分摊而非倍增。**

```
对施方 i 与关系 r ∈ {生, 克}:
    targets = { j : rel(i,j) = r }
    w_j     = Y_ij · D_ij
    rate    = K_r · max_j(w_j)          ← 速率由最强耦合决定
    totalOut = W_i · A_i · rate
    effect_j = totalOut · (w_j / Σw_j)  ← 按耦合强度分摊
```

若改为对每个目标独立求和，一个载体的流出率就正比于**目标个数** ——
而目标个数取决于藏干记账（火有 4 个土载体可生，木只有 1 个），纯属artifact。

实测该写法下流出率中位数达 **63%**、最大 **102%**，人人撞上限，
全盘等比塌缩（总量 434 → 18），且稳态形状由载体个数而非命理结构决定。

## 6. `vitality`：单轮留存率

```
vitality = (Σ W_final / Σ W_L2) ^ (1 / rounds)
```

**取几何平均的单轮留存，而非累计留存。**累计留存 ≈ ρ^rounds 会随轮数任意变化，
不是命局的属性；单轮留存 ρ 才是。

传导中损失的质量来自两处：生的传输损耗 `(1−η)`，与克的双向销毁。

| `vitality` | 含义 |
| --- | --- |
| **高**（→ 1.0） | 五行流通，相生为主，内耗少。气顺。 |
| **低**（→ 0.8 以下） | 战克交加，多组相冲相克，力量在内部消耗殆尽。 |

这不是「命好命坏」的指标 —— `vitality` 高的偏枯之局未必胜过 `vitality` 低但制化有情之局。
它衡量的是**内耗程度**，作为报告的一个独立维度呈现，不参与旺衰判定。

`cumulativeRetention` 亦一并输出，但仅供诊断，不进报告。

## 7. 归一化后的输出

```ts
interface PropagationResult {
  readonly carriers: readonly Carrier[];     // weight 已收敛并归一回 M₀
  readonly rawTotal: number;                 // 归一前的 M_final
  readonly vitality: number;
  readonly convergence: {
    converged: boolean;
    rounds: number;
    finalResidual: number;
    history: { round: number; total: number; maxDelta: number }[];
  };
  readonly byElement: Record<Element, number>;
  readonly byPolarity: Record<Polarity, number>;
  readonly flows: FlowRecord[];              // 用于桑基图
}

interface FlowRecord {
  from: CarrierId; to: CarrierId;
  kind: 'sheng' | 'ke';
  totalAmount: number;                        // 全部轮次累加
  coefficients: { K: number; Y: number; Dist: number; resistance?: number };
}
```

`flows` 使得整张盘可以渲染成一张**桑基图**：谁在生谁、谁在克谁、流量多大。这是本系统最有解释力的可视化，也是「五行流通」是否成立的直接证据。

---

## 8. 加入大运 / 流年

同一套引擎，只是载体集合变大：

| 视图 | 载体来源 | 柱数 |
| --- | --- | --- |
| 本命盘 | 年月日时 | 4 |
| 大运盘 | + 大运 | 5 |
| 流年盘 | + 大运 + 流年 | 6 |

每次 `evaluate(chart, instant)` 都**从 L1 重跑**，不做增量更新。理由：L2 的结构判定是全局的（一个流年支的加入可能促成三合，从而改变整盘），增量更新在这里既不安全也不省事。

单次全量计算的成本：载体约 24 个 → 有序对 552 → 每轮 552 次浮点运算 → 30 轮不到 2 万次。**逐年算 120 年也在毫秒级**，无需优化。

---

## 9. 参数总览

```yaml
propagation:
  mode: syncIterative
  damping: 0.50
  maxRounds: 30
  epsilon: 0.002
  outflowCap: 0.35
  floor: 0.0

  kernel:
    sheng: 0.30
    ke:    0.40

  shengEfficiency: 0.85
  keCost: 0.30

  polarity:
    shengCross: 1.00
    shengSame:  0.70
    keSame:     1.00
    keCross:    0.70

  tongdang:
    mode: resistance        # resistance | additive
    beta: 0.60
    additiveKernel: 0.20    # 仅 mode=additive 时生效

  distance:
    samePillar:        1.00
    sameBranchHidden:  0.60
    adjacent:          0.80
    gap1:              0.40
    gap2:              0.20
    crossLayerFactor:  0.70

  external:
    luckToNatal:       0.80
    annualToNatal:     0.70
    luckToAnnual:      1.00
    natalToLuck:       0.60
    natalToAnnual:     0.50
    annualToDayMasterBonus: 1.15
```

---

## 10. L3 不变量（写成断言）

1. **顺序无关**：随机打乱 `carriers` 数组，结果差异 < 1e-9。这是同步迭代模式的核心保证，必须有对应测试。
2. **非负**：任意轮次任意载体 `W ≥ 0`。
3. **质量非增**：`Σ W^(t+1) ≤ Σ W^(t) + 1e-9`。生有损耗、克有销毁，总量只减不增。
4. **两道上限**：任一载体单轮流出 `≤ outflowCap × W_i`，单轮受克 `≤ inflowDamageCap × W_i`。
5. **审计闭合**：`Σ Δ[i]` 必须等于 `−Σ(传输损耗) − Σ(克的销毁)`，误差 < 1e-9。
6. **收敛或声明**：`converged == false` 时 `finalResidual` 必须非空。
7. **归一保总量**：`Σ W_normalized == M₀`（误差 < 1e-9）。
8. **`vitality ∈ (0, 1]`**，且为单轮留存 —— 改变轮数不应显著改变它。

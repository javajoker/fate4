# 02 · L0 排盘

排盘层是**纯确定性**的：给定 `BirthInput`，输出 `NatalChart`。此层无任何命理判断，只有历法与天文换算。它的正确性可以被外部万年历 100% 验证，因此必须先做到零误差，再谈上层。

---

## 1. 输入

```ts
interface BirthInput {
  calendar: 'gregorian';        // 内部一律公历；农历输入在 UI 层转换
  year: number;                 // 公历年，支持负数（公元前）
  month: number;                // 1–12
  day: number;                  // 1–31
  hour: number;                 // 0–23，钟表时（未校正）
  minute: number;               // 0–59
  gender: 'male' | 'female';    // 决定大运顺逆
  location: {
    longitude: number;          // 东经为正，西经为负
    latitude: number;
    tzIdentifier: string;       // IANA，如 'Asia/Shanghai'
  };
  unknownHour?: boolean;        // 时辰未知 → 时柱缺省，见 §9
}
```

## 2. 时间归一

三步，顺序不可换：

### 2.1 钟表时 → UTC

用 IANA 时区数据库。**必须使用带历史规则的库**（`@js-temporal/polyfill` 或 `luxon` + 完整 tzdata），因为：

- 中国 1986–1991 实行夏令时（每年 4 月中旬至 9 月中旬，+1h）
- 中国 1940–1941、1945–1948 有过夏令时
- 1949 年前中国分五时区（长白 UTC+8.5、中原 +8、陇蜀 +7、新藏 +6、昆仑 +5.5）

`chart.handleDst`（默认 `true`）关闭时跳过夏令时校正，仅用于对照老式排盘工具。

### 2.2 UTC → 平太阳时（经度校正）

```
localMeanTime = UTC + longitude / 15 小时
```

注意用**出生地实际经度**，不是时区中心经度。

### 2.3 平太阳时 → 真太阳时（均时差）

```
trueSolarTime = localMeanTime + EoT(date)
```

均时差 `EoT` 范围约 −14.2 min ~ +16.4 min，用 NOAA 近似式或直接从 VSOP87 的太阳视黄经反解。精度要求 ±5 秒。

`chart.trueSolarTime`（默认 `true`）。关闭时止步于 2.2。

> **为何必须做**：均时差最大 16 分钟，时辰边界在整点。出生在 10:52 的人，均时差 +9 分钟即跨入巳时/午时的另一侧。这不是精度洁癖，是会改变时柱的实质差异。

**输出**：`solarInstant` —— 后续所有节气比较、日柱计算都基于它。

## 3. 节气计算

24 节气定义为**太阳视黄经**每 15° 的时刻：

| 节气 | 黄经 | 类型 | 起何月 |
| --- | --- | --- | --- |
| 立春 | 315° | 节 | 寅月 |
| 雨水 | 330° | 气 | — |
| 惊蛰 | 345° | 节 | 卯月 |
| 春分 | 0° | 气 | — |
| 清明 | 15° | 节 | 辰月 |
| 谷雨 | 30° | 气 | — |
| 立夏 | 45° | 节 | 巳月 |
| 小满 | 60° | 气 | — |
| 芒种 | 75° | 节 | 午月 |
| 夏至 | 90° | 气 | — |
| 小暑 | 105° | 节 | 未月 |
| 大暑 | 120° | 气 | — |
| 立秋 | 135° | 节 | 申月 |
| 处暑 | 150° | 气 | — |
| 白露 | 165° | 节 | 酉月 |
| 秋分 | 180° | 气 | — |
| 寒露 | 195° | 节 | 戌月 |
| 霜降 | 210° | 气 | — |
| 立冬 | 225° | 节 | 亥月 |
| 小雪 | 240° | 气 | — |
| 大雪 | 255° | 节 | 子月 |
| 冬至 | 270° | 气 | — |
| 小寒 | 285° | 节 | 丑月 |
| 大寒 | 300° | 气 | — |

**算法**：VSOP87D 截断级数求太阳视黄经 λ(t)，含光行差与章动修正，再用 Newton 迭代求解 `λ(t) = target`。

```
solveSolarTerm(targetLongitude, approxJD):
  t ← approxJD
  repeat:
    λ ← apparentSolarLongitude(t)
    Δ ← normalizeAngle(target − λ)          // 归入 (−180°, 180°]
    t ← t + Δ / 0.9856                      // 太阳日行约 0.9856°
  until |Δ| < 1e-6 度
  return t                                  // TT，需转 UTC（ΔT 修正）
```

**精度目标**：与《中国天文年历》/香港天文台数据比对，误差 ≤ 1 分钟，1900–2100 全覆盖。

**性能**：节气一年只有 24 个，预计算并缓存 `[1900, 2100]` 区间的全部 4824 个时刻到一张静态表，运行时直接查表 + 二分。区间外才走实时计算。

## 4. 四柱

### 4.1 年柱

边界是**立春**，不是农历正月初一，不是元旦。

```
solarYear ← 使得 立春(solarYear) ≤ solarInstant < 立春(solarYear+1) 的那个年份
stemIndex   = (solarYear − 4) mod 10
branchIndex = (solarYear − 4) mod 12
```

（公元 4 年为甲子年。负数取模须归正。）

### 4.2 月柱

边界是**节**，绝不是气。

```
monthBranch ← 由 solarInstant 落在哪两个「节」之间决定（表见 §3）
```

月干用**五虎遁**（年上起月）：

> 甲己之年丙作首，乙庚之岁戊为头，丙辛必定寻庚起，丁壬壬位顺行流，戊癸之年何处觅，甲寅之上好追求。

```
yinMonthStem = [丙, 戊, 庚, 壬, 甲][yearStemIndex mod 5]      // 寅月的天干
monthStemIndex = (yinMonthStem + (monthBranchIndex − 2 + 12) mod 12) mod 10
```

### 4.3 日柱

连续六十甲子日序，与任何历法无关。

```
jdn = julianDayNumber(公历年, 月, 日)        // 取当地日界，非 UT
sexagenary = (jdn + 49) mod 60               // 0 = 甲子
```

**锚点校验**（必须写成测试）：

- 1949-10-01 = 甲子日
- 2000-01-01 = 戊午日

自检：两日相距 18354 天，`18354 mod 60 = 54`；`54 mod 10 = 4 → 戊`，`54 mod 12 = 6 → 午` ✔

**日界规则** `chart.ziHourRule`：

| 取值 | 含义 |
| --- | --- |
| `lateZiNextDay`（默认） | 23:00 起即算次日的日柱，时柱为次日的甲/丙/…子时 |
| `earlyZiSameDay` | 23:00–24:00 仍算当日日柱，时柱用当日日干起的子时 |
| `split` | 23:00–24:00 日柱不变（当日），但时柱按**次日**日干起遁 —— 折衷派 |

三者在报告中必须显式标注所用规则。这是四柱领域最常见的两盘不一致来源。

### 4.4 时柱

时支由真太阳时定（23–01 子、01–03 丑 …）。
时干用**五鼠遁**（日上起时）：

> 甲己还加甲，乙庚丙作初，丙辛从戊起，丁壬庚子居，戊癸何方发，壬子是真途。

```
ziHourStem = [甲, 丙, 戊, 庚, 壬][dayStemIndex mod 5]
hourStemIndex = (ziHourStem + hourBranchIndex) mod 10
```

## 5. 胎元

```
胎元干 = (月干 + 1) mod 10
胎元支 = (月支 + 3) mod 12
```

例：月柱 甲子 → 胎元 乙卯。月柱 丙寅 → 胎元 丁巳。

胎元主先天禀赋与母体环境。**默认不参与 L1–L3 权重计算**（`weights.includeTaiyuan = false`），仅作展示与神煞落点。开启后按一柱 `weights.taiyuanTotal`（建议 40）计入。

## 6. 命宫

`m` = 节气月序（寅月=1, 卯=2, …, 丑=12 —— **注意是从寅起数，不是从子**）
`h` = 时支序（子=1, 丑=2, …, 亥=12）

传统口诀以「子=1 顺数至生月」表述，因此需先把寅起的月序转为子起：

```
mZi = ((m + 1) mod 12) + 1        // 寅月(m=1) → mZi=3（子=1,丑=2,寅=3）✔
n   = mZi + h
命宫支序(子=1..亥=12) = ((14 − n − 1) mod 12) + 1
命宫天干 = 由年干起五虎遁，遁至命宫支
```

**验算**：

| 生月 | 生时 | mZi | h | n | 命宫支 |
| --- | --- | --- | --- | --- | --- |
| 寅月 | 子时 | 3 | 1 | 4 | `((14−4−1) mod 12)+1 = 10` → 酉 |
| 卯月 | 卯时 | 4 | 4 | 8 | `((14−8−1) mod 12)+1 = 6` → 巳 |
| 子月 | 子时 | 1 | 1 | 2 | `((14−2−1) mod 12)+1 = 12` → 亥 |
| 午月 | 午时 | 7 | 7 | 14 | `((14−14−1) mod 12)+1 = 12` → 亥 |
| 亥月 | 亥时 | 12 | 12 | 24 | `((14−24−1) mod 12)+1 = 2` → 丑 |

mod-12 形式统一了传统口诀的 `n ≤ 14 用 14−n`／`n > 14 用 26−n` 两分支，并消除了 `n = 14` 时结果为 0 的边界缺陷。

> ⚠️ **待校准**：`chart.mingGongBoundary`
> 命宫源自月将，而**月将换于中气，非节**。因此存在两种取月方式：
> - `'jie'`（默认）—— 与主流排盘软件一致
> - `'zhongqi'` —— 理论上更自洽
>
> 两者在节与中气之间出生的人身上会给出相差一位的命宫。上线前必须用参考万年历取 ≥50 个跨界命例回归，二选一并在报告中标注。

**可选扩展**（默认关闭）：

- **身宫** `chart.includeShenGong` —— 命宫的对宫算法有多种记法，同样待校准。
- **胎息** `chart.includeTaiXi` —— 日干之合 + 日支之合。日柱甲子 → 胎息己丑。

## 7. 大运

### 7.1 顺逆

```
阳年男 / 阴年女 → 顺行（向未来的节）
阴年男 / 阳年女 → 逆行（向过去的节）
```

「阳年阴年」取**年干**的阴阳，不是年支。

### 7.2 起运时长（精确）

```
Δ = |目标节的时刻 − solarInstant|          // 目标节：顺行取下一个节，逆行取上一个节
```

换算率：`3 日 = 1 年`。

**连续模式**（默认，`temporal.qiyun.mode = 'continuous'`）：

```
起运时长(毫秒) = Δ(毫秒) × (365.2422 / 3)
交运时刻 = solarInstant + 起运时长
```

比例因子 `365.2422 / 3 = 121.7474`。

**离散模式**（`'traditionalDiscrete'`，用于与传统排盘对照）：

```
d = Δ 的整日数, h = 余下的整时辰数(2h), ...
年 = floor(d / 3)
月 = (d mod 3) × 4 + floor(h / 1) × ... （1 时辰 = 5 日 = 5/3 月 ≈ 0.556 月）
```

传统口诀：`3日=1年`，`1日=4月`，`1时辰=5日`。离散模式按此逐级换算并截断，误差可达数月，**只作对照，不作默认**。

两种模式的结果都要输出，报告中显示连续模式，附注离散模式的传统虚岁。

### 7.3 大运序列

```
第 N 步大运（N 从 1 起）：
  起始 = 交运时刻 + (N−1) × 1 回归年 × 10
  结束 = 交运时刻 + N × 1 回归年 × 10
  干支 = 月柱在六十甲子上顺行/逆行 N 位
```

默认生成 12 步（覆盖约 120 年），`temporal.luckPillarCount`。

**小运** `temporal.includeXiaoyun`（默认关闭）：起运前的年份，自时柱顺逆推。争议大，仅作可选展示。

### 7.4 换运与流年不对齐

大运边界是**交运时刻**（可能在任意月日），流年边界是**立春**。两者不重合。

**引擎的处理**：`evaluate(chart, instant)` 永远针对一个**瞬时**求解。年度视图的默认取样点是该年立春时刻。

若某年内发生换运，`YearView` 额外返回 `segments: [{ from, to, luckPillar }]`，前端渲染为分段，并在换运点标记。**不做加权平均**——两步大运的气象不可线性混合。

## 8. 神煞与空亡落点

排盘完成后即可计算，不依赖权重。见 [07-shensha](07-shensha.md)。

空亡索引：

```
xunStart      = sexagenary − (sexagenary mod 10)
xunStartBranch = xunStart mod 12
空亡二支 = [(xunStartBranch + 10) mod 12, (xunStartBranch + 11) mod 12]
```

验算：甲子（0）→ xunStartBranch=0 → 空 戌(10)、亥(11) ✔
甲戌（10）→ xunStartBranch=10 → 空 申(8)、酉(9) ✔

## 9. 时辰未知

`unknownHour = true` 时：

- 时柱标记为 `null`，不产生载体
- L1 的柱基准总量由 400 降为 300，**不做归一补偿**（少一柱就是少一柱的信息）
- 命宫无法计算 → 标记 `unavailable`
- 所有依赖时柱的神煞、子女宫、晚年运判定一律标记 `insufficient-data`，报告中显式留白
- **禁止**用「最可能时辰」猜测填充。宁可留白。

## 10. 输出

```ts
interface NatalChart {
  readonly input: BirthInput;
  readonly solarInstant: Instant;          // 真太阳时
  readonly corrections: {
    tzOffsetMinutes: number;
    dstApplied: boolean;
    longitudeCorrectionMinutes: number;
    equationOfTimeMinutes: number;
  };
  readonly pillars: {
    year: Pillar; month: Pillar; day: Pillar; hour: Pillar | null;
  };
  readonly taiyuan: Pillar;
  readonly mingGong: Pillar | 'unavailable';
  readonly solarTerms: { prev: SolarTerm; next: SolarTerm };
  readonly siling: { stem: Stem; daysIntoJie: number; segment: 0 | 1 | 2 };
  readonly xunKong: { byDay: [Branch, Branch]; byYear: [Branch, Branch] };
  readonly nayin: Record<PillarKind, string>;
  readonly shensha: ShenshaHit[];
  readonly luck: { direction: 'forward' | 'reverse'; startInstant: Instant;
                   startAgeDisplay: string; pillars: LuckPillar[] };
  readonly rulesUsed: { ziHourRule: string; mingGongBoundary: string; /* … */ };
}
```

`rulesUsed` 是强制字段。任何一张盘都必须能回答「你是用哪套规则算出来的」。

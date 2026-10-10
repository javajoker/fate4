/**
 * 读者档 —— 同一份推演，给三种人看三种深度。
 *
 * ## 它控制披露，不控制断言
 *
 * 这一条是整个模块的前提，写在最前面：
 *
 * > **措辞守卫在三档下完全相同。**
 * > 这个开关决定「给看多少」，**从不**决定「可以说什么」。
 *
 * 一个命理师不需要引擎替他下断语 —— 断语是他自己的事，而且他比引擎更懂。
 * 他需要的是**引擎藏起来的那些数**：权重、比值、z 分数、置信度的小数位、
 * 候选时段的原始列表。那些东西人话层出于好意收了起来
 * （见 `plain/vocab.ts` 的 `favorPlain`：「不把数字给用户 —— 那是伪精度」），
 * 对普通读者是对的，对专业读者就成了遮挡。
 *
 * 所以这个开关两头都开：**往上给数，往下关掉时间论断。**
 *
 * ## 三档
 *
 * | | 普通人 | 学生 | 命理师 |
 * | --- | --- | --- | --- |
 * | 排盘与结构 | ✓ | ✓ | ✓ |
 * | **盘的来历警告** | ✓ **必出** | ✓ | ✓ |
 * | 推导链 | 人话摘要 | 完整 | 完整 |
 * | 量化数字 | ✗ 只给档位 | ✓ 带解释 | ✓ 裸数 |
 * | **指向未来的时段** | **✗ 关闭** | ✓ | ✓ |
 * | 神煞原始命中 | 概括 | ✓ | ✓ |
 * | 待校准清单 | ✗ | ✓ | ✓ |
 * | 措辞守卫 | **同** | **同** | **同** |
 *
 * ## 「盘的来历警告」为什么三档都必出
 *
 * 那一栏不是细节，是**这张盘凭什么长这样**：
 *
 * ```
 * 出生于晚子时（真太阳时 23 时后），按「晚子换日」规则日柱已进位。
 * 出生时当地行用夏令时，已扣除一小时。
 * ```
 *
 * 第一条意味着**日柱换了一个**，而日干就是日主 —— 整张盘的基准点。
 * 它由一个可改的参数决定（`chart.ziHourRule`，三说并存，无正确答案）。
 * 读者不知道这件事，就不知道自己看的这张盘是三张里的哪一张。
 *
 * ⚠️ 这些警告此前**在网页与移动版里一次都没有显示过** —— 只有 Markdown
 * 导出和命令行有。那是本次审查逮到的最要紧的一处遗漏。
 *
 * ## 「关闭时间论断」关的是哪一类
 *
 * 不是关掉所有与时间有关的东西 —— 那会把「今年的结构是什么样」也关掉，
 * 而那是描述，不是预告。关的是**指向未来某个时段的论断**，三处：
 *
 * 1. 六爻的应期候选时段
 * 2. 起伏节点里**尚未到来**的那些
 * 3. 流年卡片里晚于当前年的
 *
 * 过去与当下照旧。「回看」整页因此不受影响 —— 它本来就只看过去，
 * 而且它的用处正是让人自己检验，不是听人预告。
 */

export type Audience = "lay" | "student" | "practitioner";

export const AUDIENCES: readonly Audience[] = Object.freeze([
  "lay", "student", "practitioner",
]);

export const AUDIENCE_LABEL: Readonly<Record<Audience, string>> = Object.freeze({
  lay: "普通读者",
  student: "学习中",
  practitioner: "命理师",
});

export const AUDIENCE_NOTE: Readonly<Record<Audience, string>> = Object.freeze({
  lay: "平常话为主，不出量化数字，也不给指向未来的时段。",
  student: "完整的推导链与数字，每个数附一句它是什么意思。",
  practitioner: "原始数值直出，不加解释；候选时段、神煞命中、待校准项全给。",
});

/** 可以按档位开关的几样东西。 */
export type Disclosure =
  /** 量化数字：权重、比值、z 分数、置信度小数。 */
  | "numbers"
  /** 数字旁边要不要附一句解释。 */
  | "numberGloss"
  /** 指向**未来**某个时段的论断。 */
  | "futureWindows"
  /** 神煞的原始命中与落宫。 */
  | "shenshaRaw"
  /** 完整推导链（相对于人话摘要）。 */
  | "fullDerivation"
  /** 待校准清单与参数指纹一类的工程信息。 */
  | "calibrationNotes";

const TABLE: Readonly<Record<Audience, Readonly<Record<Disclosure, boolean>>>> = Object.freeze({
  lay: Object.freeze({
    numbers: false, numberGloss: false, futureWindows: false,
    shenshaRaw: false, fullDerivation: false, calibrationNotes: false,
  }),
  student: Object.freeze({
    numbers: true, numberGloss: true, futureWindows: true,
    shenshaRaw: true, fullDerivation: true, calibrationNotes: true,
  }),
  practitioner: Object.freeze({
    numbers: true, numberGloss: false, futureWindows: true,
    shenshaRaw: true, fullDerivation: true, calibrationNotes: true,
  }),
});

/**
 * 这一档给不给看某样东西。
 *
 * ⚠️ 表里**没有**「守卫」这一项，而且永远不会有。
 * 措辞守卫不是一种披露，它是一条不可配置的红线
 * （与 `report.guard.neutralPalette` 同一性质）。
 */
export const discloses = (a: Audience, what: Disclosure): boolean => TABLE[a][what];

/**
 * 盘的来历警告 —— **任何档都必出**，故单给一个常量而不是查表。
 *
 * 写成函数是为了让调用处读起来像在问一个问题，而不是像在读一个 `true`。
 */
export const showsProvenanceWarnings = (_a: Audience): true => true;

/**
 * 某个年份对这一档是不是「未来」。
 *
 * 边界取**当前年本身算作当下**：今年的卡片是对正在发生的这一段的描述，
 * 不是预告。只有严格晚于今年的才算未来。
 */
export function isFutureWindow(year: number, now: number): boolean {
  return year > now;
}

/** 关掉未来时段时，给读者的交代。**说清楚关了什么、为什么**，不含糊过去。 */
export const FUTURE_WITHHELD_NOTE =
  "这一档不显示指向未来的时段。不是算不出来，是这套方法给出的只是"
  + "「传统取法列出的候选」，而候选读起来太像预告 —— 隔着一个时间差，"
  + "读者会把它记成一件将要发生的事。换到「学习中」或「命理师」可以看到。";

/**
 * 量化数字的披露 —— 同一个数，三档给三种写法。
 *
 * ## 为什么人话层原本不给数
 *
 * `vocab.ts` 的 `favorPlain` 里写着一句：「指数本身是 0–100，
 * 但**不把数字给用户** —— 那是伪精度」。那句话对**普通读者**是对的：
 * 「顺逆指数 62.3」读起来像一个测出来的量，而它是一串人定参数的函数，
 * 小数点后那一位没有任何东西背书。
 *
 * ## 但对专业读者，不给数就是遮挡
 *
 * 命理师不需要引擎替他下断语，他需要的恰恰是这些数：同党占比离档界多远、
 * 顺逆指数在哪一档的哪一头、这个节点的 z 是 2.1 还是 3.4。
 * 没有它们，他拿到的是一个黑箱的结论，而那比「伪精度」更糟。
 *
 * 于是同一个数三种写法：
 *
 * ```
 * 普通读者   （不出）
 * 学习中     同党占总量 0.368（低于 0.45 这一档算身弱，离界 0.082）
 * 命理师     同党/总量 0.3679｜距最近档界 0.0821｜档界 0.45
 * ```
 *
 * 学生那一档**每个数附一句它是什么意思**；命理师那一档不附 ——
 * 他不需要被解释，而解释会占掉他要扫的地方。
 *
 * ## 这不是放松守卫
 *
 * 数字本身不构成断言：「0.3679」说不出任何关于将来的话。
 * 本模块产出的每一段仍然照常过 `scanPlain`，由测试断言。
 */

import { discloses, type Audience } from "../report/audience.js";

export interface Quantity {
  /** 短标签，如「同党/总量」。 */
  readonly label: string;
  /** 值。字符串直接用，数字按 `digits` 格式化。 */
  readonly value: number | string;
  /** 小数位。给了才格式化，不给则用 `String(value)`。 */
  readonly digits?: number;
  /** 学生档附的那一句。命理师档不出。 */
  readonly gloss?: string;
}

const fmt = (q: Quantity): string =>
  typeof q.value === "number" && q.digits !== undefined
    ? q.value.toFixed(q.digits)
    : String(q.value);

/**
 * 把一组数写成一段附注，接在卡片正文后面。
 *
 * 普通读者档返回空串 —— 调用处直接拼接即可，不必各自判断档位。
 */
export function quantities(a: Audience, qs: readonly Quantity[]): string {
  if (!discloses(a, "numbers") || qs.length === 0) return "";
  if (discloses(a, "numberGloss")) {
    // 学生档：每个数带它的意思，分句写，便于逐条读
    return "　〔数〕" + qs.map((q) => {
      const g = q.gloss === undefined ? "" : `（${q.gloss}）`;
      return `${q.label} ${fmt(q)}${g}`;
    }).join("；") + "。";
  }
  // 命理师档：紧凑一行，不加解释
  return "　〔" + qs.map((q) => `${q.label} ${fmt(q)}`).join("｜") + "〕";
}

/**
 * 置信度。
 *
 * 人话层本来只出「这一条很不确定」一类的话。那句话该留着 ——
 * 它是给所有人看的；数是另加的，不是替换。
 */
export const confidenceQuantity = (conf: number): Quantity => ({
  label: "置信度", value: conf, digits: 2,
  gloss: "0–1。低于 0.7 时本系统必须同时给出另一种读法",
});

/** 顺逆指数。 */
export const favorQuantity = (index: number): Quantity => ({
  label: "顺逆指数", value: index, digits: 1,
  gloss: "0–100，衡量的是这套传统模型下该时段与本命的契合度，不是运气好坏",
});

/**
 * 旺衰的同党占比与它离档界多远。
 *
 * 两个数直接取 `strength` 的推导链 —— **不在这里另算一遍**。
 * 另算一遍就有两份实现，而两份实现迟早会不一致，
 * 到时候屏幕上的数与推导链里的数对不上，还查不出来是哪边错了。
 */
export function strengthQuantities(
  derivation: readonly { readonly step: string;
    readonly values?: Readonly<Record<string, number | string>> }[],
): readonly Quantity[] {
  const num = (step: string, key: string): number | undefined => {
    const v = derivation.find((d) => d.step === step)?.values?.[key];
    return typeof v === "number" ? v : undefined;
  };
  const r = num("比值", "r");
  const nearest = num("置信", "nearest");
  const distance = num("置信", "distance");
  const out: Quantity[] = [];
  if (r !== undefined) {
    out.push({ label: "同党/总量", value: r, digits: 4,
      gloss: "帮日主的那一半占全盘权重的比例" });
  }
  if (nearest !== undefined && distance !== undefined) {
    // 两个数分开出，不把「界在 0.3」塞进值里 —— 塞进去，学生档就成了
    // 「0.0679（界在 0.3）（贴近零说明…）」，两组括号挨在一起没法读。
    out.push({ label: "距最近档界", value: distance, digits: 4,
      gloss: "贴近零说明这张盘在界上，两种读法都成立 —— 那时本系统必须把两种都列出来" });
    out.push({ label: "档界", value: nearest });
  }
  return out;
}

/** 统计节点的 z 与门槛。 */
export const nodeQuantities = (z: number, threshold: number): readonly Quantity[] => [
  { label: "z", value: z, digits: 2,
    gloss: "偏离该序列自身中心多少个标准差。门槛是「取多少条」的旋钮，不是显著性水平" },
  { label: "门槛", value: threshold, digits: 1, gloss: "超过它才入选" },
];

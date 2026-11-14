/**
 * 曲线页上那条平滑曲线的数学 —— 图与表共用这一份。
 *
 * ## 为什么放在内核里
 *
 * 曲线页的交点表要回答「图上这条线是在哪一刻穿过那两条虚线的」。
 * 要回答得与图一致，就必须在**画图用的那条曲线**上求交点，而不是在
 * 采样点的折线上、也不是在模型内部的阶梯上。
 *
 * 一个值（而不是两份各写一遍的公式）保证两边不会悄悄漂开：
 * 图里改了张力，表就跟着变；不会出现图上穿过去了、表上说没穿的局面。
 *
 * ## 曲线是什么
 *
 * Catmull-Rom 转三次贝塞尔，张力 0.5（通行取值）：过每个采样点，点之间平滑。
 * 对第 i 段（p1→p2），两个内部控制点为
 *
 *     c1 = p1 + (p2 − p0) / 6
 *     c2 = p2 − (p3 − p1) / 6
 *
 * 首尾两段缺的那个邻点取端点自身（与图一致）。
 *
 * 横坐标等间距时，贝塞尔的 x 分量对参数 t 是线性的，所以**同一个 t 既是
 * 曲线参数、也是这一段里走过的横向比例** —— 这正是能把 t 直接换成日期的原因。
 */

/** 一段 p1→p2 的两个内部控制点。`p0`/`p3` 是两侧邻点。 */
export function catmullRomControls(
  p0: number, p1: number, p2: number, p3: number,
): readonly [c1: number, c2: number] {
  return [p1 + (p2 - p0) / 6, p2 - (p3 - p1) / 6];
}

/** 三次贝塞尔在参数 t∈[0,1] 处的值。 */
export function cubicAt(p1: number, c1: number, c2: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p1 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p2;
}

/**
 * 整条曲线在第 seg 段（ys[seg]→ys[seg+1]）、参数 t 处的值。
 * 首尾缺邻点时取端点自身，与 `charts.tsx` 画图的取法逐字一致。
 */
export function splineAt(ys: readonly number[], seg: number, t: number): number {
  const n = ys.length;
  const p0 = ys[seg === 0 ? 0 : seg - 1]!;
  const p1 = ys[seg]!;
  const p2 = ys[seg + 1]!;
  const p3 = ys[seg + 2 < n ? seg + 2 : n - 1]!;
  const [c1, c2] = catmullRomControls(p0, p1, p2, p3);
  return cubicAt(p1, c1, c2, p2, t);
}

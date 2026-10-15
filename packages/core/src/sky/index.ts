/**
 * `@fate/core/sky` —— 行星星历与以它为输入的占法。
 *
 * ## 为什么单独开一个子路径
 *
 * 五星的 VSOP87 级数合计约 410 KB。四柱一条都用不上 ——
 * 它只要太阳（节气）与月亮（农历），而那两样在根 index 上。
 *
 * 若把这里并进根 index，每一个只排四柱的调用方都要连带下载那 410 KB，
 * 移动版首屏尤其吃不消。`@fate/data` 那边已经为同样的理由把五星
 * 放在 `@fate/data/vsop87-planets`；这里是同一条线的延续 ——
 * **谁用谁引**，而不是谁都得背着。
 */

export * from "./planets.js";
export * from "./angles.js";
export * from "./dignities.js";
export * from "./chart.js";
export * from "./qizheng.js";

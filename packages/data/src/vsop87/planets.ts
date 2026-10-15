/**
 * 五星级数的子路径入口 —— `@fate/data/vsop87-planets`。
 *
 * ## 为什么不经根 index 转出
 *
 * 五星的级数合计约 410 KB，而绝大多数调用方只用四柱 —— 一条行星项都
 * 不需要。经根 index 转出等于把它塞进每一个 bundle，移动版首屏尤其吃不消。
 * 与 `yaoci` 同样处理：谁用谁引。
 *
 * 地球的 L、R 不在这里（它们在根 index 上，四柱要用），
 * 但地球的 **B** 在：它只有行星的地心变换才用得到。
 */

export type { Vsop87Series } from "./earth.js";
export { EARTH_B } from "./earthLatitude.js";
export { MERCURY_L, MERCURY_B, MERCURY_R } from "./mercury.js";
export { VENUS_L, VENUS_B, VENUS_R } from "./venus.js";
export { MARS_L, MARS_B, MARS_R } from "./mars.js";
export { JUPITER_L, JUPITER_B, JUPITER_R } from "./jupiter.js";
export { SATURN_L, SATURN_B, SATURN_R } from "./saturn.js";

/**
 * @fate/core —— 四柱推演内核。
 *
 * 零运行时依赖，纯函数，无全局可变状态，无 Date.now()，无 I/O。
 * 可在浏览器、Node、Worker 中跑同一份代码。
 *
 * 进度：P0 干支代数 ✅ · P1 天文与时间 ✅（黄经级数待换 VSOP87）· P2 排盘 · P3 配重 …
 */
export * from "./types/ganzhi.js";
export * from "./ganzhi/index.js";
export * from "./astro/index.js";
export * from "./time/index.js";

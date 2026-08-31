/**
 * @fate/core —— 四柱推演内核。
 *
 * 零运行时依赖，纯函数，无全局可变状态，无 Date.now()，无 I/O。
 * 可在浏览器、Node、Worker 中跑同一份代码。
 *
 * 进度：P0 干支代数 ✅ · P1 天文 · P2 排盘 · P3 配重 · P4 结构 · P5 传导 · P6 断论
 */
export * from "./types/ganzhi.js";
export * from "./ganzhi/index.js";

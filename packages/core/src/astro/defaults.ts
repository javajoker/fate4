/**
 * 默认黄经 provider。
 *
 * 单独成模块，是为了打断 sun.ts ↔ vsop87.ts 的循环引用：
 * vsop87.ts 需要 sun.ts 的类型，而默认值需要 vsop87 的实例。
 *
 * `apparentSolarLongitude` 刻意**不设默认值** —— 调用方必须显式声明所用级数。
 * 一个「忘了传 provider 就悄悄退回低精度」的默认参数，会让 15 分钟量级的
 * 系统偏差在代码里静默存活，且不会被任何结构性测试捕获。
 */
import { vsop87 } from "./vsop87.js";
import type { SolarLongitudeProvider } from "./sun.js";

export const DEFAULT_SOLAR_PROVIDER: SolarLongitudeProvider = vsop87;

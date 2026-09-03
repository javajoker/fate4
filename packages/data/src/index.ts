/**
 * @fate/data —— 体量较大的生成数据。
 *
 * 已就位：
 *   vsop87/  地球黄经与向径级数（由官方档案生成，见 scripts/generate-vsop87.mjs）
 *   yaoci/   六十四卦爻辞语料（由原型项目生成，见 scripts/generate-yaoci.mjs）
 *
 * yaoci **不由本文件转出**：三种语言合计约 500 KB，而绝大多数调用方只用四柱，
 * 一条爻辞都不需要。经根 index 转出等于把它塞进每一个 bundle，故走子路径
 * `@fate/data/yaoci`，谁用谁引。
 *
 * 待补：
 *   P6 《穷通宝鉴》调候表（120 格，须逐格转录、双源校对，见 docs/11-validation.md 项 02）
 *   P9 报告模板库
 *
 * 干支基础静态表不在这里 —— 它们与代数运算强耦合，且体量小到不值得跨包，
 * 见 @fate/core 的 ganzhi/tables.ts。
 */
export * from "./vsop87/index.js";

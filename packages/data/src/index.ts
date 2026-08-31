/**
 * @fate/data —— 体量较大的生成数据。
 *
 * P1 填入 1900–2100 的 4824 个节气时刻静态表；
 * P6 填入《穷通宝鉴》调候表（120 格，须逐格转录、双源校对，见 docs/11-validation.md §5 项 02）；
 * P9 填入报告模板库。
 *
 * 干支基础静态表不在这里 —— 它们在 @fate/core 的 ganzhi/tables.ts，
 * 因为它们与代数运算强耦合，且体量小到不值得跨包。
 */
export const DATA_PACKAGE_VERSION = "0.1.0";

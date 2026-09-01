import type { NextConfig } from "next";

/**
 * 全部计算在浏览器内完成 —— 生辰数据不出本机。
 *
 * 故：静态导出，无服务端路由；命盘标识走 URL 片段（`#` 之后），
 * 片段不随请求发往服务器，也不进任何访问日志。
 *
 * `@fate/core` 走**已编译的 dist**，不走 TS 源码。
 * 源码里的相对导入一律写作 `./x.js`（TS 的 ESM 规范要求），
 * 而打包器不会把它回溯到 `./x.ts` —— 与其为此配一套扩展名别名，
 * 不如让内核照常经 `tsc -b` 出真正的 `.js`，界面层只消费产物。
 * 构建脚本因此是 `tsc -b ../.. && next build`。
 */
const config: NextConfig = {
  output: "export",
  reactStrictMode: true,
};

export default config;

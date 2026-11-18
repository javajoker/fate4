#!/usr/bin/env node
/**
 * 生成「六爻指事」独立页面：`tools/zhishi/liuyao-zhishi.html`。
 *
 * ## 为什么打包内核，而不是把语料抄进页面
 *
 * 页面要做的三件事 —— 起卦（时刻要换农历与时辰，要真太阳时）、按七例取辞、
 * 过措辞守卫 —— 内核都有，且都有测试。另抄一份，两边迟早不一致：
 * 同一时刻起卦，页面与问事页取到不同的话。故直接把内核打进来。
 *
 * 措辞守卫也照内核的规矩**在读取时跑**（`screen`），不在这里预先筛好写死 ——
 * 预先筛的结果会冻在生成那一刻（见 docs/13 §7.5.4）。代价是页面里带着守卫规则，
 * 多几 KB，无妨。
 *
 * ## 单文件
 *
 * 脚本内联进 HTML，没有外部资源：断网、直接双击打开都能用。
 *
 * 用法：node scripts/build-zhishi.mjs（pnpm gen:zhishi 会先做类型检查）
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(ROOT, "tools/zhishi");
const OUT = resolve(DIR, "liuyao-zhishi.html");
const SLOT = "/*__BUNDLE__*/";

/** `@fate/data` 的子路径与源文件不同名（vsop87-planets → vsop87/planets），故不用前缀别名。 */
const DATA = {
  "": "src/index.ts",
  "/yaoci": "src/yaoci/index.ts",
  "/vsop87-planets": "src/vsop87/planets.ts",
};
const fateData = {
  name: "fate-data",
  setup(b) {
    b.onResolve({ filter: /^@fate\/data(\/.*)?$/ }, (a) => {
      const sub = a.path.slice("@fate/data".length);
      const file = DATA[sub];
      if (file === undefined) throw new Error(`未知的 @fate/data 子路径：${a.path}`);
      return { path: resolve(ROOT, "packages/data", file) };
    });
  },
};

/**
 * 页面只出简体：繁体、英文两份语料换成空包，省下三百多 KB。
 *
 * 只在这一次打包里换，语料文件本身不动。空包而不是简体顶替 ——
 * 万一哪天页面误取了别的语言，看到的是空白，而不是一段语言不对却读得通的话。
 */
const SIMPLIFIED_ONLY = {
  name: "yaoci-zh-hans-only",
  setup(b) {
    b.onResolve({ filter: /^\.\/(en|zh-hant)\.js$/ }, (a) =>
      a.importer.endsWith(`yaoci${"/"}index.ts`) ? { path: a.path, namespace: "empty-pack" } : undefined);
    b.onLoad({ filter: /.*/, namespace: "empty-pack" }, () => ({
      contents: "export const CLASSIC = []; export const GIST = []; export const EXPAND = []; export const STAGE = [];",
      loader: "js",
    }));
  },
};

const r = await build({
  entryPoints: [resolve(DIR, "main.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  charset: "utf8",
  legalComments: "none",
  write: false,
  plugins: [fateData, SIMPLIFIED_ONLY],
  logLevel: "warning",
});

const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const tpl = readFileSync(resolve(DIR, "page.html"), "utf8");
if (!tpl.includes(SLOT)) throw new Error(`page.html 里找不到占位 ${SLOT}`);
const html = tpl.replace(SLOT, () => js);
writeFileSync(OUT, html);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`✓ 六爻指事 → ${OUT.slice(ROOT.length + 1)}（${kb(Buffer.byteLength(html))}，其中脚本 ${kb(Buffer.byteLength(js))}）`);

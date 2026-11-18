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
 * 构建前先查界面文案（`tools/zhishi/i18n.ts`）：
 *
 * 1. 简体里每个字都已在 hant.ts 归类 —— 否则繁体界面里会静悄悄地留着简体字；
 * 2. 每一条都能转成繁体而不抛错（「无单一读法」的字单独出现会抛）；
 * 3. 三种文字的每一条都过人话守卫。
 *
 * 文案与内核的转换、守卫一起打成一个临时模块来查，不依赖 dist —— 查的就是源码本身。
 */
async function checkCopy() {
  const r = await build({
    stdin: {
      contents: [
        'export { UI_SOURCE, allStrings, mapUi } from "./tools/zhishi/i18n.ts";',
        'export { toHant, unclassifiedOf } from "./packages/core/src/report/hant.ts";',
        'export { scanPlain } from "./packages/core/src/plain/guard.ts";',
      ].join("\n"),
      resolveDir: ROOT, loader: "ts",
    },
    bundle: true, format: "esm", platform: "neutral", write: false, plugins: [fateData], logLevel: "warning",
  });
  const m = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
  const problems = [];
  const hans = m.allStrings(m.UI_SOURCE["zh-Hans"]);
  const un = m.unclassifiedOf(hans.join(""));
  if (un.length > 0) problems.push(`hant.ts 未归类的字：${un.join("")}`);
  let hant = [];
  try { hant = m.allStrings(m.mapUi(m.UI_SOURCE["zh-Hans"], m.toHant)); }
  catch (e) { problems.push(`繁体转换抛错：${String(e.message).split("\n")[0]}`); }
  for (const [name, list] of [["简体", hans], ["繁体", hant], ["英文", m.allStrings(m.UI_SOURCE.en)]]) {
    for (const s of list) {
      for (const v of m.scanPlain(s, "zhishi.ui")) problems.push(`${name}文案被守卫拦下（${v.ruleId}）：${s.slice(0, 40)}`);
    }
  }
  if (problems.length > 0) {
    console.error(`六爻指事：界面文案检查未通过，${problems.length} 处：\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
}

await checkCopy();

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
  plugins: [fateData],
  logLevel: "warning",
});

const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const tpl = readFileSync(resolve(DIR, "page.html"), "utf8");
if (!tpl.includes(SLOT)) throw new Error(`page.html 里找不到占位 ${SLOT}`);
const html = tpl.replace(SLOT, () => js);
writeFileSync(OUT, html);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`✓ 六爻指事 → ${OUT.slice(ROOT.length + 1)}（${kb(Buffer.byteLength(html))}，其中脚本 ${kb(Buffer.byteLength(js))}）`);

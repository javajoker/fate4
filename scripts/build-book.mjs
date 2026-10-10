#!/usr/bin/env node
/**
 * 由 `book/*.md`（简体源）生成网页版的**繁体** HTML。
 *
 * ## 为什么在构建期转，而不是在浏览器里转
 *
 * 三条理由，按要紧程度排：
 *
 * 1. `toHant` **遇到无法定夺的字会抛错**。那是它的本分（见 hant.ts），
 *    但一个会抛错的函数不该在读者打开页面时才跑 —— 抛了就是白屏。
 *    放在构建期，抛错即构建失败，改完再发。
 * 2. Markdown 解析器因此完全不进浏览器包。页面拿到的是现成的 HTML。
 * 3. 转换结果可以被测试逐字检查（`book.spec.ts`），而不是只能靠肉眼看页面。
 *
 * ## 为什么只出繁体
 *
 * 简体源就在 `book/` 里，GitHub 上直接可读，不需要再做一份网页。
 * 网页版补的是**繁体**那一份 —— 它没有别的来源。
 *
 * ## Markdown 子集
 *
 * 这本书的 Markdown 是本项目自己写的，故解析器只需覆盖实际用到的子集：
 * 标题、段落、表格、引用、围栏代码、有序/无序列表、水平线，
 * 行内的粗体、代码、链接。**不是通用解析器，也不打算是** ——
 * 通用解析器要么引一个依赖，要么写一千行，而这本书一行都用不到那些。
 *
 * 用法：node scripts/build-book.mjs
 * 前置：pnpm 的 `tsc -b`（本脚本要用 @fate/core 的 dist）
 */

import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
/**
 * 两本书，两条路由。
 *
 * `book/`         《一张盘是怎么算出来的》—— 这个项目实现的那一套怎么算
 * `book-compare/` 《测天，还是约定》—— 九套占法在整片版图上的位置
 */
const BOOKS = [
  { dir: "book", route: "/book", out: "packages/web/app/book/content.ts" },
  { dir: "book-compare", route: "/compare-book", out: "packages/web/app/compare-book/content.ts" },
];

/** 当前正在生成的那本书的路由前缀 —— 行内链接要用它。 */
let ROUTE = "/book";

const { toHant } = await import(
  resolve(HERE, "../packages/core/dist/src/report/hant.js"));

// ─────────────────────────────────────────────────────────
// 行内
// ─────────────────────────────────────────────────────────

const esc = (s) => s
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * 行内标记。次序要紧：先抽出代码跨度占位，免得它里面的星号被当成粗体。
 */
function inline(s) {
  const codes = [];
  let t = s.replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(c);
    return `\u0000C${codes.length - 1}\u0000`;
  });
  t = esc(t);
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // 链接：章节之间互指的 .md 改写成站内路由；外链原样
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => {
    // ⚠️ 次序要紧：`../docs/13-liuyao.md` 也以 .md 结尾。先判仓库内路径，
    // 否则它会被当成章节链接，变成一个打不开的 `/book/13`。实测撞上过。
    if (href.startsWith("http")) return `<a href="${href}">${text}</a>`;
    // 指向仓库里源码／文档的引用，网页上没有对应页面，故降级为普通文字
    if (href.startsWith("../")) return `<span class="bk-ref">${text}</span>`;
    if (/\.md($|#)/.test(href)) return `<a href="${ROUTE}/${slugOf(href.replace(/#.*$/, ""))}">${text}</a>`;
    return `<a href="${href}">${text}</a>`;
  });
  return t.replace(/\u0000C(\d+)\u0000/g, (_m, i) => `<code>${esc(codes[Number(i)])}</code>`);
}

// ─────────────────────────────────────────────────────────
// 块
// ─────────────────────────────────────────────────────────

function render(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;

  const flushList = (tag, items) =>
    out.push(`<${tag}>` + items.map((x) => `<li>${inline(x)}</li>`).join("") + `</${tag}>`);

  while (i < lines.length) {
    const ln = lines[i];

    if (ln.trim() === "") { i++; continue; }

    // 围栏代码
    if (ln.startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // 水平线
    if (/^---+$/.test(ln.trim())) { out.push("<hr/>"); i++; continue; }

    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(ln);
    if (h !== null) {
      const n = h[1].length;
      out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      i++;
      continue;
    }

    // 表格
    if (ln.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);   // 第 1 行是分隔行
      out.push("<table><thead><tr>"
        + head.map((c) => `<th>${inline(c)}</th>`).join("")
        + "</tr></thead><tbody>"
        + body.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("")
        + "</tbody></table>");
      continue;
    }

    // 引用（可跨多行）
    if (ln.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        buf.push(lines[i++].replace(/^>\s?/, ""));
      }
      out.push(`<blockquote>${render(buf.join("\n"))}</blockquote>`);
      continue;
    }

    // 列表
    if (/^\s*[-*]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
        // 续行
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s/.test(lines[i])) {
          items[items.length - 1] += lines[i++].trim();
        }
      }
      flushList("ul", items);
      continue;
    }
    if (/^\s*\d+[.、]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.、]\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*\d+[.、]\s+/, ""));
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*\d+[.、]\s/.test(lines[i])) {
          items[items.length - 1] += lines[i++].trim();
        }
      }
      flushList("ol", items);
      continue;
    }

    // 段落：连到下一个空行
    const buf = [];
    while (i < lines.length && lines[i].trim() !== ""
      && !lines[i].startsWith("|") && !lines[i].startsWith(">")
      && !lines[i].startsWith("```") && !/^#{1,6}\s/.test(lines[i])
      && !/^---+$/.test(lines[i].trim())
      && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+[.、]\s+/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    // 书里的换行是为了源码好读，不是排版意图，故接成一段
    out.push(`<p>${inline(buf.join(""))}</p>`);
  }
  return out.join("\n");
}

// ─────────────────────────────────────────────────────────

/**
 * `01-它在算什么.md` → `01`；README → `index`；附录 → `appendix`。
 *
 * ⚠️ 要同时认简体与繁体的文件名。行内链接是在**转换之后**的正文上改写的，
 * 那时「附录-术语对照.md」已经变成「附錄-術語對照.md」—— 只认简体的话，
 * 它会落到兜底分支，得出一个 `/book/附錄` 这种打不开的路径。实测撞上过。
 */
function slugOf(file) {
  const base = file.replace(/^.*\//, "").replace(/\.md$/, "");
  if (base === "README") return "index";
  if (base.startsWith("附录") || base.startsWith("附錄")) return "appendix";
  return base.slice(0, 2);
}

for (const book of BOOKS) {
  const srcDir = resolve(HERE, "..", book.dir);
  ROUTE = book.route;
  const files = (await readdir(srcDir)).filter((f) => f.endsWith(".md")).sort((a, b) => {
    const k = (x) => (x === "README.md" ? "00" : x.startsWith("附录") ? "99" : x);
    return k(a) < k(b) ? -1 : 1;
  });

  const chapters = [];
  for (const f of files) {
    const src = await readFile(join(srcDir, f), "utf8");
    let hant;
    try {
      hant = toHant(src);
    } catch (e) {
      console.error(`✗ ${book.dir}/${f} 简转繁失败：${(e.chars ?? []).join("、")}`);
      console.error("  在 hant.ts 里把它们归类，不要让它猜。");
      process.exit(1);
    }
    const title = (/^#\s+(.*)$/m.exec(hant)?.[1] ?? slugOf(f)).trim();
    chapters.push({ slug: slugOf(f), file: f, title, html: render(hant) });
  }

  const lit = (s) => JSON.stringify(s);
  const outPath = resolve(HERE, "..", book.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath,
    `/**\n * 網頁版正文 —— 由 ${book.dir}/*.md（簡體源）生成，**請勿手改**。\n *\n`
    + ` * 見 scripts/build-book.mjs。繁體由 @fate/core 的 toHant 轉出；\n`
    + ` * 它遇到無法定奪的字會抛錯，故這一步放在構建期：抛錯即構建失敗。\n */\n\n`
    + `export interface Chapter {\n`
    + `  readonly slug: string;\n  readonly file: string;\n`
    + `  readonly title: string;\n  readonly html: string;\n}\n\n`
    + `export const ROUTE = ${lit(book.route)};\n\n`
    + `export const CHAPTERS: readonly Chapter[] = Object.freeze([\n`
    + chapters.map((c) =>
      `  { slug: ${lit(c.slug)}, file: ${lit(c.file)}, title: ${lit(c.title)},\n`
      + `    html: ${lit(c.html)} },`).join("\n")
    + `\n]);\n`,
    "utf8");

  console.log(`✓ ${book.dir}：${chapters.length} 章 → ${book.out}`);
}

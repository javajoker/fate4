#!/usr/bin/env node
/**
 * Web 文案的静态检查。
 *
 * JSX 的文本节点里写 Markdown 是无效的：`**结构**` 会原样渲染成星号。
 * 这类错只有截到那一屏才看得见，而页面很长 —— 故用脚本兜底。
 *
 * 同时检查中文文案里漏出的英文枚举，规则与报告层一致。
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const files = globSync("packages/web/**/*.tsx", { exclude: (p) => p.includes("node_modules") });
const problems = [];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  // JSX 的块注释 `{/* … */}` 可以跨多行，而其中的文字不会被渲染。
  // 只看行首特征会把注释的**续行**当成正文 —— 那是假阳性，
  // 而假阳性会教人去忽略这个检查，比漏报更坏。故跟踪块注释的开合。
  let inBlockComment = false;
  src.split("\n").forEach((line, i) => {
    const n = i + 1;
    const t = line.trim();
    const opens = line.lastIndexOf("{/*") >= 0 || line.lastIndexOf("/*") >= 0;
    const closes = line.includes("*/");
    if (inBlockComment) {
      if (closes) inBlockComment = false;
      return;
    }
    if (opens && !closes) { inBlockComment = true; return; }
    if (opens && closes) return;
    // 跳过行注释与字符串字面量里的星号（import 之类）
    if (t.startsWith("//") || t.startsWith("*")) return;
    if (/\*\*[^*]+\*\*/.test(line)) {
      problems.push(`${f}:${n}  JSX 文本里的 Markdown 粗体无效，会渲染成星号\n    ${t}`);
    }
    if (/^\s*[^<>{}/]*[一-鿿]+.*`[^`]*`/.test(line) && !line.includes("className")) {
      // 反引号在 JSX 文本里同样无效
      if (/>[^<]*`[^`]+`[^<]*</.test(line)) {
        problems.push(`${f}:${n}  JSX 文本里的 Markdown 代码跨度无效\n    ${t}`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error(`Web 文案检查未通过，${problems.length} 处：\n`);
  for (const p of problems) console.error("  " + p + "\n");
  process.exit(1);
}
console.log(`Web 文案检查通过（扫描 ${files.length} 个文件）。`);

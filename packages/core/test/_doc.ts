/**
 * 从 docs/01-foundations.md 解析字面量表。
 *
 * 该文档自称是「所有静态表的唯一来源」，tables.ts 自称「必须逐字对应」。
 * 这个解析器让那两句话成为可执行的断言，而不是两条互相指望的注释。
 *
 * 解析器刻意写得宽容：只认以 | 起首的行、按 | 切分、去空白、丢弃分隔行与表头。
 * 文档重排格式会让测试失败 —— 这是**期望行为**，不是脆弱：
 * 表变了而代码没跟上，正是这层要防的事。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DOC_PATH = resolve(HERE, "../../../docs/01-foundations.md");

const DOC = readFileSync(DOC_PATH, "utf8");

/** 抽取某个二级/三级标题之后、下一个同级标题之前的正文。 */
export function sectionOf(headingPrefix: string): string {
  const lines = DOC.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## ") && l.includes(headingPrefix));
  if (start < 0) throw new Error(`文档中找不到章节: ${headingPrefix}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

function parseRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function isSeparator(cells: string[]): boolean {
  return cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "");
}

/**
 * 把一段 markdown 切成**若干张独立的表**，遇非表格行即断开。
 *
 * 一节里可以有多张表（§10 司令分野就有两张：司令分野表与回退解析表），
 * 因此调用方必须指明取第几张 —— 把整节的行混作一张，
 * 会让「给文档补一张说明表」这种无害的编辑莫名其妙地弄红测试。
 * 返回的每张表已剔除表头与分隔行。
 */
export function tablesOf(section: string): string[][][] {
  const tables: string[][][] = [];
  let cur: string[][] | null = null;
  for (const line of section.split("\n")) {
    if (line.trimStart().startsWith("|")) {
      const cells = parseRow(line);
      if (isSeparator(cells)) continue;
      if (cur === null) { cur = []; tables.push(cur); }
      cur.push(cells);
    } else if (line.trim() === "" || !line.trimStart().startsWith("|")) {
      cur = null;
    }
  }
  return tables;
}

/** 取某节中第 n 张表（默认第一张）的数据行。 */
export function tableRows(section: string, n = 0): string[][] {
  const tables = tablesOf(section);
  const t = tables[n];
  if (t === undefined) {
    throw new Error(`该节只有 ${tables.length} 张表，取不到第 ${n + 1} 张`);
  }
  return t;
}

/** 去掉单元格里的 markdown 强调与反引号，只留纯文本。 */
export function plain(cell: string): string {
  return cell.replace(/[`*_]/g, "").trim();
}

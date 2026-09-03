#!/usr/bin/env node
/**
 * 由原型项目的《易经》语料生成 TypeScript 数据模块。
 *
 * ## 为什么用脚本而不是抄
 *
 * 语料是 64×7 = 448 条爻辞原文 + 448 条白话转述 + 448 条一句话指事，
 * 三种语言共约 1350 条。这个体量下人工/模型转录必然出错，而错在**第几爻**
 * 上是查不出来的 —— 读起来都通顺。故一律程序化搬运，并记录源文件 SHA256。
 *
 * ## 顺序的双重转录是刻意的
 *
 * 语料按**通行本卦序**编号（乾坤屯蒙需讼师比……），而本项目的六十四卦
 * 按京房八宫次序生成。两者之间需要一张映射。
 *
 * 源文件恰好给了两份互相独立的通行本次序：`iching_list`（64 个卦画二进制串）
 * 与 `iching_raw[0]`（64 个卦名）。两份都搬过来，由 `yijing/yaoci.ts` 的测试
 * 断言二者一致 —— 即「照二进制查出来的卦，卦名必须等于名单里那一个」。
 * 任一份搬错都会当场暴露，而单独一份错了则无从发觉。
 *
 * 用法：node scripts/generate-yaoci.mjs [语料目录]
 *
 * 默认读仓库内的 `prototype/iching/` —— 源文件随本仓库存档，故重新生成
 * 不依赖任何本机路径，`provenance.ts` 里的 SHA256 也可以当场复核。
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../packages/data/src/yaoci");
// ⚠️ 相对路径必须相对**本脚本**，不是相对 cwd —— 后者从仓库根跑就指到仓库外了。
const SRC_DIR = process.argv[2] === undefined
  ? resolve(HERE, "../prototype/iching")
  : resolve(process.argv[2]);

/** 源文件 → 本项目 locale。 */
const PACKS = [
  { file: "iching.zh-CN.js", locale: "zh-Hans", ident: "zhHans" },
  { file: "iching.zh-TW.js", locale: "zh-Hant", ident: "zhHant" },
  { file: "iching.en.js", locale: "en", ident: "en" },
];

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const lit = (s) => JSON.stringify(s);
const arr = (a, indent = "  ") =>
  "[\n" + a.map((x) => indent + lit(x) + ",").join("\n") + "\n]";

function must(cond, msg) {
  if (!cond) { console.error("✗ " + msg); process.exit(1); }
}

const provenance = { sources: [], generated: new Date().toISOString().slice(0, 10) };

// ── 卦序 ──────────────────────────────────────────────────
const baseFile = join(SRC_DIR, "iching-base.js");
const baseBuf = await readFile(baseFile);
const base = await import(pathToFileURL(baseFile).href);
provenance.sources.push({ file: "iching-base.js", sha256: sha256(baseBuf) });

const list = base.iching_list;
must(Array.isArray(list) && list.length === 64, `iching_list 应为 64 项，实为 ${list?.length}`);
must(new Set(list).size === 64, "iching_list 有重复");
must(list.every((s) => /^[01]{6}$/.test(s)), "iching_list 有非法卦画串");

// ── 各语言包 ──────────────────────────────────────────────
const packs = [];
for (const p of PACKS) {
  const f = join(SRC_DIR, p.file);
  const buf = await readFile(f);
  const m = await import(pathToFileURL(f).href);
  provenance.sources.push({ file: p.file, sha256: sha256(buf) });

  const raw = m.default;
  must(Array.isArray(raw) && raw.length === 2, `${p.file}: iching_raw 结构不符`);
  const [names, classic] = raw;
  const { iching_place: stage, iching_content: expand, iching_abbr: gist } = m;

  must(names.length === 64, `${p.file}: 卦名 ${names.length} ≠ 64`);
  must(new Set(names).size === 64, `${p.file}: 卦名有重复`);
  for (const [n, a] of [["classic", classic], ["expand", expand], ["gist", gist]]) {
    must(a.length === 448, `${p.file}: ${n} ${a.length} ≠ 448`);
    must(a.every((s) => typeof s === "string"), `${p.file}: ${n} 含非字符串`);
  }
  must(stage.length === 6, `${p.file}: 爻位阶段 ${stage.length} ≠ 6`);

  // 每卦七格：0 为卦辞，1–6 为六爻。gist 的卦辞格恒空 —— 这是源数据的约定，
  // 断言它，好让约定变化时当场发现，而不是悄悄多出 64 条空指事。
  for (let h = 0; h < 64; h++) {
    must(gist[h * 7] === "", `${p.file}: gist 第 ${h} 卦的卦辞格非空`);
    for (let i = 1; i <= 6; i++) {
      must(gist[h * 7 + i].trim() !== "", `${p.file}: gist 第 ${h} 卦第 ${i} 爻为空`);
    }
    for (let i = 0; i <= 6; i++) {
      must(classic[h * 7 + i].trim() !== "", `${p.file}: classic 第 ${h} 卦第 ${i} 格为空`);
      must(expand[h * 7 + i].trim() !== "", `${p.file}: expand 第 ${h} 卦第 ${i} 格为空`);
    }
  }
  packs.push({ ...p, names, classic, expand, gist, stage });
}

// ── 繁体包的勘误 ──────────────────────────────────────────
//
// 源语言包的繁体那份漏转了个别字。本项目有一条硬测试「繁体输出里没有一个简体
// 字」，漏转的字一进报告就会把它撞停。故在此原样列出、逐字修正 ——
// 列在生成脚本里而不是悄悄改数据文件，是为了让改动看得见、可追。
//
// 判据不靠肉眼：`packages/core/test/yaoci.spec.ts` 拿 `SIMPLIFIED_ONLY`
// 把整份繁体语料筛一遍，还剩简体字就报错，并指名道姓说是哪个。
const HANT_ERRATA = Object.freeze({
  杠: "槓",   // 鼎杠 → 鼎槓（第 50 卦鼎·上爻白话）
});
{
  const hant = packs.find((p) => p.locale === "zh-Hant");
  let fixed = 0;
  for (const field of ["classic", "gist", "expand", "stage"]) {
    hant[field] = hant[field].map((s) => {
      let out = s;
      for (const [from, to] of Object.entries(HANT_ERRATA)) {
        if (out.includes(from)) { out = out.split(from).join(to); fixed++; }
      }
      return out;
    });
  }
  console.log(`  繁体勘误 ${fixed} 处`);
}

// 简繁英三份卦名互不同形，无从逐字比对；但每份都已各自校验过
// 「64 个、无重复」，而下标是共用的，故只需卦名表本身取简体那一份。
const hans = packs[0];

// ── 输出 ──────────────────────────────────────────────────
const HEAD = (what) =>
  `/**\n * ${what}\n *\n * 由 scripts/generate-yaoci.mjs 生成，**请勿手改**。\n`
  + ` * 出处与校验和见 ./provenance.ts。\n */\n\n`;

await writeFile(join(OUT_DIR, "order.ts"),
  HEAD("通行本卦序 —— 语料的下标次序。")
  + "/** 通行本第 i 卦的卦画，自下而上六爻，1 阳 0 阴。 */\n"
  + `export const RECEIVED_BINARY: readonly string[] = Object.freeze(${arr(list)});\n\n`
  + "/** 通行本第 i 卦的卦名（简体）。与 {@link RECEIVED_BINARY} 互为校验。 */\n"
  + `export const RECEIVED_NAMES: readonly string[] = Object.freeze(${arr(hans.names)});\n`,
  "utf8");

for (const p of packs) {
  await writeFile(join(OUT_DIR, `${p.locale.toLowerCase()}.ts`),
    HEAD(`《易经》语料 —— ${p.locale}。下标 = 通行本卦序 × 7 + 爻位（0 为卦辞，1–6 为六爻）。`)
    + "/** 爻辞原文。 */\n"
    + `export const CLASSIC: readonly string[] = Object.freeze(${arr(p.classic)});\n\n`
    + "/** 一句话指事。卦辞格恒为空串。 */\n"
    + `export const GIST: readonly string[] = Object.freeze(${arr(p.gist)});\n\n`
    + "/** 白话转述。 */\n"
    + `export const EXPAND: readonly string[] = Object.freeze(${arr(p.expand)});\n\n`
    + "/** 六个爻位各自的阶段描述，下标 0 为初爻。 */\n"
    + `export const STAGE: readonly string[] = Object.freeze(${arr(p.stage)});\n`,
    "utf8");
}

await writeFile(join(OUT_DIR, "provenance.ts"),
  "/**\n * 语料出处与校验和。\n *\n * 由 scripts/generate-yaoci.mjs 生成，**请勿手改**。\n */\n\n"
  + "export const YAOCI_PROVENANCE = "
  + JSON.stringify({
    dataset: "iching corpus",
    description: "六十四卦爻辞原文、一句话指事、白话转述、六爻位阶段（简/繁/英）",
    origin: "同作者的原型项目 prototypes/fate/fate/src/api",
    note: "爻辞原文为《周易》公有领域文本；指事与白话转述为原型项目的撰述。",
    ...provenance,
    counts: { hexagrams: 64, slotsPerHexagram: 7, entriesPerLocale: 448, stages: 6 },
  }, null, 2) + " as const;\n", "utf8");

await writeFile(join(OUT_DIR, "index.ts"),
  HEAD("《易经》语料。")
  + "export * from \"./order.js\";\nexport * from \"./provenance.js\";\n"
  + packs.map((p) => `export * as ${p.ident} from "./${p.locale.toLowerCase()}.js";`).join("\n")
  + "\n", "utf8");

console.log(`✓ 生成 ${OUT_DIR}`);
for (const s of provenance.sources) console.log(`  ${s.file}  ${s.sha256.slice(0, 16)}…`);

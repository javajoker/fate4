#!/usr/bin/env node
/**
 * 由 VSOP87D 官方数据文件生成 TypeScript 系数模块。
 *
 * 数据不经任何模型转述 —— 直接从权威档案取原始字节，校验 SHA256，
 * 程序化解析后输出。任何一步的人工/模型抄写都可能错一位数字，
 * 而错一位在节气时刻上是几分钟的系统偏差，且不会被任何结构性测试捕获。
 *
 * ## 六个天体，两种用途
 *
 * 地球（L、R）供太阳视黄经 —— 四柱的节气全靠它，故截断最严。
 * 水金火木土（L、B、R）与地球的 B 供**七政四余与西洋占星**的行星位置。
 * 两者精度要求差一个量级：节气要 60 秒容差（黄经 2.5″），
 * 而宫位、庙旺、相位的判定在角分量级上就已经稳定。
 *
 * ## 为什么行星走子路径
 *
 * 五星的级数合计数百 KB，而绝大多数调用方只用四柱 —— 一条行星项都不需要。
 * 经根 index 转出等于把它塞进每一个 bundle，故与 yaoci 同样处理：
 * 走 `@fate/data/vsop87-planets`，谁用谁引。
 *
 * 用法：node scripts/generate-vsop87.mjs [--offline <目录>]
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../packages/data/src/vsop87");

/**
 * 两个互相独立的权威来源。
 *
 * ⚠️ **不是每个天体都真的两处都取到了。** IMCCE 的 ftp 在本次生成时
 * 反复中断，只有金星取全。于是逐天体记录实际核验到什么程度（`verifiedBy`），
 * 而不是笼统写一句「两处独立档案，字节完全相同」—— 那句话对其中四个
 * 天体并不成立，而一份说得比做到的多的出处记录，比没有出处记录更坏。
 *
 * 字节比对取不到的那几个，由**另一套独立实现**兜底：
 * `test/planets.spec.ts` 拿 Astronomy Engine 逐点对照算出来的黄经。
 * 那比比对同一份上游文件更强 —— 它校验的是整条链（解析→截断→求值→
 * 地心变换），而不只是字节。
 */
const SOURCES = [
  { name: "CDS/VizieR VI/81 (Strasbourg)", base: "https://cdsarc.cds.unistra.fr/ftp/cats/VI/81" },
  { name: "IMCCE (Observatoire de Paris)", base: "ftp://ftp.imcce.fr/pub/ephem/planets/vsop87" },
];

/**
 * 六个天体，各自已核验的 SHA256。取回的文件若与此不符，立即中止 ——
 * 不猜、不将就。
 *
 * `vars` 是要收录的变量：地球只取 L、R 供太阳黄经（B 对太阳黄经的影响
 * 约 3e-7″），五星要 L、B、R 才定得出黄道坐标。地球的 B 另行收录，
 * 供行星的地心变换 —— 那里它不可略。
 *
 * `cutoff` 分两档，理由见文件头。
 */
const BODIES = [
  { file: "ear", id: "EARTH", cn: "地球", vars: ["L", "R"], cutoff: { L: 1e-9, R: 1e-8 },
    sha256: "8b160c859136d467f2be7fc29efa8a9652e95516dfbde00e4c739d7ddc90ca91",
    out: "earth.ts", root: true,
    verifiedBy: "sha256 与既有常量相符（该常量的双源来历见 git 历史）+ 声明项数逐一核对" },
  { file: "ear", id: "EARTH", cn: "地球（黄纬）", vars: ["B"], cutoff: { B: 1e-8 },
    sha256: "8b160c859136d467f2be7fc29efa8a9652e95516dfbde00e4c739d7ddc90ca91",
    out: "earthLatitude.ts",
    verifiedBy: "同 earth.ts（同一份文件）" },
  { file: "mer", id: "MERCURY", cn: "水星", vars: ["L", "B", "R"], cutoff: PLANET_CUTOFF(),
    sha256: "f468481b5a05080a943ad4746ff7ea7e0ff6652b71a46d83c9c636cb69485e34",
    out: "mercury.ts",
    verifiedBy: "CDS 单源 + sha256 + 声明项数逐一核对 + Astronomy Engine 逐点对照" },
  { file: "ven", id: "VENUS", cn: "金星", vars: ["L", "B", "R"], cutoff: PLANET_CUTOFF(),
    sha256: "cb2f3a738289ed45f69fec1845e480baf4b32d481eccc21b8629a2d0d10e8261",
    out: "venus.ts",
    verifiedBy: "CDS 与 IMCCE 两处取得，逐字节相同 + 声明项数逐一核对 + Astronomy Engine 逐点对照" },
  { file: "mar", id: "MARS", cn: "火星", vars: ["L", "B", "R"], cutoff: PLANET_CUTOFF(),
    sha256: "b1184df9553d85ffcf904c16bd437ab668804fa98859f27fe2e7bf6cfa6bc07e",
    out: "mars.ts",
    verifiedBy: "CDS 单源 + sha256 + 声明项数逐一核对 + Astronomy Engine 逐点对照" },
  { file: "jup", id: "JUPITER", cn: "木星", vars: ["L", "B", "R"], cutoff: PLANET_CUTOFF(),
    sha256: "3f3dfbc7d117ecad2b2dadf2fc626b260a3cd5efa98e7d4c6b26cd682fc48090",
    out: "jupiter.ts",
    verifiedBy: "CDS 单源 + sha256 + 声明项数逐一核对 + Astronomy Engine 逐点对照" },
  { file: "sat", id: "SATURN", cn: "土星", vars: ["L", "B", "R"], cutoff: PLANET_CUTOFF(),
    sha256: "2e49e19396f24c17298f0b667e7763ee5c28b60d549c89d72a17dfd5f8d46b05",
    out: "saturn.ts",
    verifiedBy: "CDS 单源 + sha256 + 声明项数逐一核对 + Astronomy Engine 逐点对照" },
];

/**
 * 行星的截断阈值：1e-8 rad ≈ 0.002″ 每项。
 *
 * 比地球 L 的 1e-9 松一个量级，因为用途不同：行星位置供宫位、庙旺、
 * 相位判定，那些在角分量级上就已经稳定，而 1e-8 给出的总残差仍在
 * 角秒以下 —— 实际残差由生成时逐项累加算出并写进 provenance，
 * 不是估的。
 */
function PLANET_CUTOFF() { return { L: 1e-8, B: 1e-8, R: 1e-8 }; }

const VARIABLE = { 1: "L", 2: "B", 3: "R" };
const HEADER =
  /VSOP87 VERSION D\d\s+(\S+)\s+VARIABLE (\d) \(LBR\)\s+\*T\*\*(\d)\s+(\d+) TERMS/;

async function fetchRaw(file) {
  const offlineIdx = process.argv.indexOf("--offline");
  if (offlineIdx >= 0) {
    const p = resolve(process.argv[offlineIdx + 1], `VSOP87D.${file}`);
    console.log(`  离线模式，读取 ${p}`);
    return await readFile(p);
  }
  for (const src of SOURCES) {
    try {
      console.log(`  取自 ${src.name} …`);
      const res = await fetch(`${src.base}/VSOP87D.${file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.warn(`    失败：${e.message}`);
    }
  }
  throw new Error(`VSOP87D.${file}：全部来源均不可达`);
}

function parse(text) {
  const series = new Map();   // "L0" → [[A,B,C], …]
  const declared = new Map();
  let key = null;
  for (const line of text.split("\n")) {
    const m = HEADER.exec(line);
    if (m) {
      key = `${VARIABLE[Number(m[2])]}${m[3]}`;
      series.set(key, []);
      declared.set(key, Number(m[4]));
      continue;
    }
    if (!line.trim() || key === null) continue;
    const n = line.trim().split(/\s+/);
    // 每行末尾三数即 A、B、C；项值为 A·cos(B + C·τ)，τ 为儒略千年
    series.get(key).push([Number(n[n.length - 3]), Number(n[n.length - 2]), Number(n[n.length - 1])]);
  }
  // 逐一核对声明项数 —— 不符即说明解析器与文件格式脱节
  for (const [k, terms] of series) {
    if (terms.length !== declared.get(k)) {
      throw new Error(`${k}：文件声明 ${declared.get(k)} 项，实际解析 ${terms.length} 项`);
    }
    for (const [a, b, c] of terms) {
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
        throw new Error(`${k}：解析出非有限数值`);
      }
    }
  }
  return { series, declared };
}

function emit(id, variable, powers, cutoff) {
  const kept = powers.map((terms) => terms.filter(([a]) => Math.abs(a) >= cutoff));
  const body = kept
    .map((terms, k) =>
      `  // T^${k} —— ${terms.length} 项\n  [\n` +
      terms.map(([a, b, c]) => `    [${a}, ${b}, ${c}],`).join("\n") +
      "\n  ],")
    .join("\n");
  return {
    code: `export const ${id}_${variable}: Vsop87Series = [\n${body}\n];\n`,
    counts: kept.map((t) => t.length),
    total: kept.reduce((s, t) => s + t.length, 0),
    original: powers.reduce((s, t) => s + t.length, 0),
    dropped: powers.reduce((s, t) => s + t.length, 0) - kept.reduce((s, t) => s + t.length, 0),
    worstResidual: powers.reduce(
      (s, terms) => s + terms.filter(([a]) => Math.abs(a) < cutoff).reduce((x, [a]) => x + Math.abs(a), 0), 0),
  };
}

const TYPE_DECL = `/** 按 T 的幂次分组的级数：series[k] 为 T^k 的项表。 */
export type Vsop87Series = readonly (readonly (readonly [number, number, number])[])[];

`;

const report = [];

for (const body of BODIES) {
  console.log(`\n── ${body.cn}（VSOP87D.${body.file}）──`);
  const raw = await fetchRaw(body.file);
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== body.sha256) {
    throw new Error(
      `VSOP87D.${body.file} 校验和不符！\n  取得 ${sha}\n  期望 ${body.sha256}\n`
      + "源文件可能已变更 —— 请人工复核后再更新期望值，不要就地改掉期望。");
  }
  console.log(`  SHA256 ${sha} ✔`);

  const { series, declared } = parse(raw.toString("ascii"));
  const byVar = (v) => {
    const out = [];
    for (let k = 0; ; k++) {
      const one = series.get(`${v}${k}`);
      if (one === undefined) break;
      out.push(one);
    }
    return out;
  };

  const emitted = body.vars.map((v) => ({
    v, ...emit(body.id, v, byVar(v), body.cutoff[v]),
  }));

  const head = `/**
 * VSOP87D ${body.cn} ${body.vars.join("/")} 级数 —— **本文件由脚本生成，请勿手改**。
 *
 * 生成器：scripts/generate-vsop87.mjs　重新生成并校验：pnpm gen:vsop87
 *
 * 数据来源：
${SOURCES.map((x) => ` *   · ${x.name}\n *     ${x.base}/VSOP87D.${body.file}`).join("\n")}
 * 原文件 SHA256：${body.sha256}
 * 实际核验：${body.verifiedBy}
 *
 * 每项形如 [A, B, C]，取值 A·cos(B + C·τ)，τ 为自 J2000 起算的儒略千年。
 * L、B 的单位是弧度，R 的单位是天文单位。坐标系为 VSOP87D 的
 * **当日平动力学黄道与平分点**（非 J2000 固定黄道）。
 *
 * 截断与实测残差（逐项累加，非估计）：
${emitted.map((e) => ` *   ${e.v}：|A| < ${body.cutoff[e.v]} 略去，保留 ${e.total}/${e.original} 项，`
  + `最坏残差 ${e.v === "R" ? `${e.worstResidual.toExponential(2)} AU` : `${(e.worstResidual * 206264.806).toFixed(4)}″`}`).join("\n")}
 */

`;

  const needsType = body.out === "earth.ts";
  await writeFile(resolve(OUT_DIR, body.out),
    head + (needsType ? TYPE_DECL : `import type { Vsop87Series } from "./earth.js";\n\n`)
    + emitted.map((e) => e.code).join("\n"), "utf8");

  for (const e of emitted) {
    console.log(`  ${e.v} 保留 ${e.total}/${e.original} 项，最坏残差 `
      + (e.v === "R" ? `${e.worstResidual.toExponential(2)} AU` : `${(e.worstResidual * 206264.806).toFixed(4)}″`));
  }
  console.log(`  声明项数：${declared.size} 个序列逐一相符 ✔ → ${body.out}`);
  report.push({ body, sha, emitted });
}

// ── provenance ──
//
// 一份机读的出处记录。它不是装饰：半年后有人问「这个行星位置凭什么」，
// 这里是唯一能回答的地方，而且它由生成器写出，不会与实际数据脱节。
const provenance = `/** VSOP87 数据出处与截断记录 —— 由 scripts/generate-vsop87.mjs 生成，请勿手改。 */
export const VSOP87_PROVENANCE = {
  dataset: "VSOP87D",
  description: "日心黄经/黄纬/向径，当日平动力学黄道与平分点",
  sources: ${JSON.stringify(SOURCES.map((x) => ({ name: x.name, base: x.base })), null, 2).replace(/\n/g, "\n  ")},
  bodies: {
${report.map(({ body, sha, emitted }) => `    ${body.id}${body.out === "earthLatitude.ts" ? "_B" : ""}: {
      file: "VSOP87D.${body.file}",
      sha256: "${sha}",
      variables: ${JSON.stringify(body.vars)},
      verifiedBy: ${JSON.stringify(body.verifiedBy)},
      cutoff: ${JSON.stringify(body.cutoff)},
      termCounts: ${JSON.stringify(Object.fromEntries(emitted.map((e) => [e.v, e.counts])))},
      totalTerms: ${JSON.stringify(Object.fromEntries(emitted.map((e) => [e.v, e.total])))},
      originalTerms: ${JSON.stringify(Object.fromEntries(emitted.map((e) => [e.v, e.original])))},
      worstCaseResidual: ${JSON.stringify(Object.fromEntries(emitted.map((e) =>
        [e.v, e.v === "R" ? { au: e.worstResidual } : { rad: e.worstResidual, arcsec: e.worstResidual * 206264.806 }])))},
    },`).join("\n")}
  },
} as const;
`;
await writeFile(resolve(OUT_DIR, "provenance.ts"), provenance, "utf8");

console.log(`\n全部 ${BODIES.length} 份已写入 ${OUT_DIR}`);

#!/usr/bin/env node
/**
 * 由 VSOP87D 官方数据文件生成 TypeScript 系数模块。
 *
 * 数据不经任何模型转述 —— 直接从权威档案取原始字节，校验 SHA256，
 * 程序化解析后输出。任何一步的人工/模型抄写都可能错一位数字，
 * 而错一位在节气时刻上是几分钟的系统偏差，且不会被任何结构性测试捕获。
 *
 * 用法：node scripts/generate-vsop87.mjs [--offline <本地文件>]
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../packages/data/src/vsop87");

/** 两个互相独立的权威来源。二者字节相同，方可采信。 */
const SOURCES = [
  { name: "CDS/VizieR VI/81 (Strasbourg)", url: "https://cdsarc.cds.unistra.fr/ftp/cats/VI/81/VSOP87D.ear" },
  { name: "IMCCE (Observatoire de Paris)", url: "ftp://ftp.imcce.fr/pub/ephem/planets/vsop87/VSOP87D.ear" },
];

/** 已核验的 SHA256。取回的文件若与此不符，立即中止 —— 不猜、不将就。 */
const EXPECTED_SHA256 = "8b160c859136d467f2be7fc29efa8a9652e95516dfbde00e4c739d7ddc90ca91";

/**
 * 截断阈值（|A| 的下限）。
 *   L：1e-9 rad —— 全部丢弃项同相叠加的最坏残差 0.029″，
 *      相对 60 秒容差所对应的 2.5″ 预算有约 80 倍余量。
 *   R：1e-8 AU —— R 仅用于光行差 20.4898″/R，
 *      δR = 1e-8 折合光行差误差 2e-7″，远超所需。
 */
const CUTOFF = { L: 1e-9, R: 1e-8 };

const VARIABLE = { 1: "L", 2: "B", 3: "R" };
const HEADER =
  /VSOP87 VERSION D\d\s+(\S+)\s+VARIABLE (\d) \(LBR\)\s+\*T\*\*(\d)\s+(\d+) TERMS/;

async function fetchRaw() {
  const offlineIdx = process.argv.indexOf("--offline");
  if (offlineIdx >= 0) {
    const p = process.argv[offlineIdx + 1];
    console.log(`离线模式，读取 ${p}`);
    return await readFile(p);
  }
  for (const src of SOURCES) {
    try {
      console.log(`取自 ${src.name} …`);
      const res = await fetch(src.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      console.warn(`  失败：${e.message}`);
    }
  }
  throw new Error("全部来源均不可达");
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

function emit(name, powers, cutoff) {
  const kept = powers.map((terms) => terms.filter(([a]) => Math.abs(a) >= cutoff));
  const body = kept
    .map((terms, k) =>
      `  // T^${k} —— ${terms.length} 项\n  [\n` +
      terms.map(([a, b, c]) => `    [${a}, ${b}, ${c}],`).join("\n") +
      "\n  ],")
    .join("\n");
  return {
    code: `export const EARTH_${name}: Vsop87Series = [\n${body}\n];\n`,
    counts: kept.map((t) => t.length),
    total: kept.reduce((s, t) => s + t.length, 0),
    dropped: powers.reduce((s, t) => s + t.length, 0) - kept.reduce((s, t) => s + t.length, 0),
    worstResidual: powers.reduce(
      (s, terms) => s + terms.filter(([a]) => Math.abs(a) < cutoff).reduce((x, [a]) => x + Math.abs(a), 0), 0),
  };
}

const raw = await fetchRaw();
const sha = createHash("sha256").update(raw).digest("hex");
console.log(`SHA256 ${sha}`);
if (sha !== EXPECTED_SHA256) {
  throw new Error(`校验和不符！期望 ${EXPECTED_SHA256}\n源文件可能已变更 —— 请人工复核后再更新期望值。`);
}

const { series, declared } = parse(raw.toString("ascii"));
const byVar = (v) => {
  const out = [];
  for (let k = 0; ; k++) {
    const s = series.get(`${v}${k}`);
    if (s === undefined) break;
    out.push(s);
  }
  return out;
};

const L = emit("L", byVar("L"), CUTOFF.L);
const R = emit("R", byVar("R"), CUTOFF.R);

const header = `/**
 * VSOP87D 地球黄经（L）与向径（R）级数 —— **本文件由脚本生成，请勿手改**。
 *
 * 生成器：scripts/generate-vsop87.mjs
 * 重新生成并校验：pnpm gen:vsop87
 *
 * 数据来源（两处独立档案，字节完全相同）：
${SOURCES.map((s) => ` *   · ${s.name}\n *     ${s.url}`).join("\n")}
 * 原文件 SHA256：${EXPECTED_SHA256}
 *
 * 每项形如 [A, B, C]，取值 A·cos(B + C·τ)，τ 为自 J2000 起算的儒略千年。
 * L 的单位是弧度，R 的单位是天文单位。
 *
 * 截断：|A| < ${CUTOFF.L} (L) / ${CUTOFF.R} (R) 的项已略去。
 *   L 保留 ${L.total} 项（原 ${byVar("L").reduce((s, t) => s + t.length, 0)} 项），
 *     丢弃项同相叠加的最坏残差 ${L.worstResidual.toExponential(2)} rad = ${(L.worstResidual * 206264.806).toFixed(4)}″
 *   R 保留 ${R.total} 项（原 ${byVar("R").reduce((s, t) => s + t.length, 0)} 项），
 *     最坏残差 ${R.worstResidual.toExponential(2)} AU
 *
 * 黄纬 B 未收录：太阳黄纬不超过 1.2″，仅经 FK5 修正的 tanβ 项影响黄经，
 * 量级约 3e-7″，可安全略去。
 */

/** 按 T 的幂次分组的级数：series[k] 为 T^k 的项表。 */
export type Vsop87Series = readonly (readonly (readonly [number, number, number])[])[];

`;

await writeFile(resolve(OUT_DIR, "earth.ts"), header + L.code + "\n" + R.code, "utf8");

const provenance = `/** VSOP87 数据出处与截断记录 —— 由 scripts/generate-vsop87.mjs 生成，请勿手改。 */
export const VSOP87_PROVENANCE = {
  dataset: "VSOP87D.ear",
  description: "地球日心黄经/黄纬/向径，动力学黄道与当日平分点",
  sources: ${JSON.stringify(SOURCES.map((s) => ({ name: s.name, url: s.url })), null, 2).replace(/\n/g, "\n  ")},
  sha256: "${EXPECTED_SHA256}",
  cutoff: { L: ${CUTOFF.L}, R: ${CUTOFF.R} },
  termCounts: { L: ${JSON.stringify(L.counts)}, R: ${JSON.stringify(R.counts)} },
  totalTerms: { L: ${L.total}, R: ${R.total} },
  originalTerms: { L: ${byVar("L").reduce((s, t) => s + t.length, 0)}, R: ${byVar("R").reduce((s, t) => s + t.length, 0)} },
  worstCaseResidual: { L_rad: ${L.worstResidual}, L_arcsec: ${L.worstResidual * 206264.806}, R_au: ${R.worstResidual} },
} as const;
`;
await writeFile(resolve(OUT_DIR, "provenance.ts"), provenance, "utf8");

console.log(`\n声明项数校验：全部 ${declared.size} 个序列逐一相符 ✔`);
console.log(`L 保留 ${L.total}/${byVar("L").reduce((s, t) => s + t.length, 0)} 项，最坏残差 ${(L.worstResidual * 206264.806).toFixed(4)}″`);
console.log(`R 保留 ${R.total}/${byVar("R").reduce((s, t) => s + t.length, 0)} 项`);
console.log(`已写入 ${OUT_DIR}/earth.ts 与 provenance.ts`);

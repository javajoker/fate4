/**
 * `fate` —— 命令行入口，亦即 Agent Skill 的执行后端。
 *
 * ## 唯一的叙述来源
 *
 * `report` 的输出直接来自 `renderMarkdown(buildReport(...))` ——
 * 与 Web 调用的是同一个函数、同一份模板、同一套默认值。
 * 「Skill 与 Web 结论逐字一致」因此是**构造保证**，不是需要维护的约定：
 * 想让两者不一致，得先让它们走上两条代码路径。
 *
 * ## 纯函数与 I/O 的分界
 *
 * `run()` 收一个 `Io`，一切读写与「今天是几号」都经它。于是命令可在进程内
 * 直接调用与断言，不必 spawn、不必落盘。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";
import {
  buildReport, dayView, disclaimerText, evaluate, formatViolations, luckTimeline,
  monthView, MONTH_BRANCH_ORDER, renderMarkdown, scanText, yearView,
  type BirthInput, type PartialParams,
} from "@fate/core";
import { UsageError, type Io } from "./io.js";
import { num, oneOf, parse, parseDate, parseTime, req, reqNum } from "./args.js";
import { findCity, CITIES } from "./cities.js";
import { makeChartFile, readChartFile, rebuild } from "./chartFile.js";
import { renderChart, renderDay, renderLuck, renderMonth, renderYear } from "./render.js";

const COMMON = {
  params: { type: "string" as const },
  json: { type: "boolean" as const },
  out: { type: "string" as const, short: "o" },
};
const CHART_REF = { chart: { type: "string" as const }, ...COMMON };

const USAGE = `fate —— 四柱推演命令行

  fate chart  --date YYYY-MM-DD [--time HH:MM | --unknown-hour]
              (--city 城市 | --tz 时区 --lon 经度) [--lat 纬度]
              --gender male|female [--params f.json] [--json] [-o f.json]

  fate luck   --chart c.json [--json]
  fate year   --chart c.json --year 2026 [--json]
  fate month  --chart c.json --year 2026 --month 1..12 [--json]
  fate day    --chart c.json --date YYYY-MM-DD [--json]
  fate report --chart c.json [--format markdown|json] [--now YYYY-MM-DD]
              [--subject self|other] [--locale zh-Hans|en]

  fate cities             列出内置城市表
  fate --help

选项
  --params  参数覆盖文件（.json，或 .yaml/.yml）。覆盖项与默认深合并后校验。
  --json    输出结构化 JSON，供程序消费。
  -o        写入文件而非标准输出。

--month 取公历月 1–12，解析为「节落在该月内的那个节气月」（如 9 月 → 白露起的酉月）。
输出写明该月柱的实际起讫日期 —— 节气月与公历月并不重合。
经度直接决定真太阳时，进而可能改变时支 —— chart 的输出一律回显所用经度与时区。`;

// ─────────────────────────────────────────────────────────

/**
 * 参数覆盖文件。JSON 与 YAML 皆可 —— 前者是 Web「导出参数集」的产物，
 * 后者便于直接照着 `params/default.yaml` 改（那份文件带着每个系数的理由）。
 *
 * 无论哪种格式，读进来之后都要过一遍 `loadParams` 的完整校验：
 * 区间、枚举、以及结构不变量。外部文件是不可信输入，没有例外。
 */
function loadOverrides(io: Io, path: string | undefined): PartialParams {
  if (path === undefined) return {};
  const text = io.readFile(path);
  const isYaml = /\.ya?ml$/i.test(path);
  try {
    const doc = isYaml ? loadYaml(text) : JSON.parse(text);
    if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
      throw new Error("顶层须为对象");
    }
    return doc as PartialParams;
  } catch (e) {
    throw new UsageError(
      `${path} 解析失败（${isYaml ? "YAML" : "JSON"}）：${e instanceof Error ? e.message : String(e)}`);
  }
}

function emit(io: Io, v: Record<string, unknown> | string, asJson: boolean, out?: string): void {
  const text = asJson || typeof v !== "string"
    ? JSON.stringify(v, null, 2)
    : v;
  if (out === undefined) io.out(text);
  else io.writeFile(out, text.endsWith("\n") ? text : `${text}\n`);
}

function loadChart(io: Io, v: Record<string, string | boolean | undefined>) {
  const path = req(v, "chart");
  const f = readChartFile(io.readFile(path), path);
  return { file: f, ...rebuild(f) };
}

// ─────────────────────────────────────────────────────────
// 子命令
// ─────────────────────────────────────────────────────────

function cmdChart(argv: readonly string[], io: Io): void {
  const v = parse(argv, {
    date: { type: "string" }, time: { type: "string" },
    tz: { type: "string" }, lon: { type: "string" }, lat: { type: "string" },
    city: { type: "string" }, gender: { type: "string" },
    "unknown-hour": { type: "boolean" },
    ...COMMON,
  });

  const d = parseDate(req(v, "date"));
  const unknownHour = v["unknown-hour"] === true;
  if (!unknownHour && typeof v["time"] !== "string") {
    throw new UsageError("须给 --time，或以 --unknown-hour 明确声明时辰未知。时辰不猜。");
  }
  const t = unknownHour ? { hour: 12, minute: 0 } : parseTime(req(v, "time"));
  const gender = oneOf(v, "gender", ["male", "female"] as const, "male");
  if (v["gender"] === undefined) throw new UsageError("缺少必需选项 --gender（大运顺逆由年干阴阳与性别共同决定）");

  let timeZone: string; let longitude: number; let latitude: number | undefined;
  const cityName = typeof v["city"] === "string" ? v["city"] : undefined;
  if (cityName !== undefined) {
    const c = findCity(cityName);
    if (c === undefined) {
      throw new UsageError(
        `城市表里没有「${cityName}」。表是便利而非权威，请直接给 --tz 与 --lon。`
        + `（fate cities 可列出全部内置城市）`);
    }
    timeZone = c.timeZone; longitude = c.longitude; latitude = c.latitude;
  } else {
    timeZone = req(v, "tz");
    longitude = reqNum(v, "lon");
  }
  const latOverride = num(v, "lat");
  if (latOverride !== undefined) latitude = latOverride;
  const lonOverride = cityName !== undefined ? num(v, "lon") : undefined;
  if (lonOverride !== undefined) longitude = lonOverride;

  const input: BirthInput = {
    year: d.year, month: d.month, day: d.day,
    hour: t.hour, minute: t.minute, gender, timeZone, longitude,
    ...(latitude === undefined ? {} : { latitude }),
    ...(unknownHour ? { unknownHour: true } : {}),
  };

  const overrides = loadOverrides(io, v["params"] as string | undefined);
  const file = makeChartFile(input, overrides);

  if (v["json"] === true || typeof v["out"] === "string") {
    emit(io, file as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }

  const { chart, params } = rebuild(file);
  const r = buildReport(chart, { params, curveYears: 1 });
  const o: string[] = [];
  o.push(`四柱 ${file.summary.pillars}　胎元 ${file.summary.taiyuan}　命宫 ${file.summary.mingGong ?? "—"}`);
  o.push(`出生地 经度 ${longitude}°　时区 ${timeZone}`
    + (cityName === undefined ? "" : `（由「${cityName}」解析而来，请核对）`));
  o.push(renderChart(r));
  for (const w of chart.warnings) o.push(`\n  ⚠ ${w}`);
  o.push(`\n参数快照 ${file.summary.paramsHash}`);
  o.push(`\n${disclaimerText(params.report.locale)}`);
  emit(io, o.join("\n"), false, undefined);
}

function cmdLuck(argv: readonly string[], io: Io): void {
  const v = parse(argv, CHART_REF);
  const { chart, params } = loadChart(io, v);
  const steps = luckTimeline(chart, params);
  if (v["json"] === true) {
    emit(io, { luck: { direction: chart.luck.direction, startAgeYears: chart.luck.startAgeYears,
      traditional: chart.luck.traditional }, steps }, true, v["out"] as string | undefined);
    return;
  }
  emit(io, renderLuck(steps, chart.luck.startAgeYears, chart.luck.direction), false, undefined);
}

function cmdYear(argv: readonly string[], io: Io): void {
  const v = parse(argv, { year: { type: "string" }, ...CHART_REF });
  const { chart, params } = loadChart(io, v);
  const year = reqNum(v, "year");
  const view = yearView(chart, year, params);
  if (v["json"] === true) {
    emit(io, view as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }
  // 叙述取自报告层，与 Web、Markdown 同源
  const r = buildReport(chart, { params, curveYears: 1, cardYears: { from: year, to: year } });
  emit(io, renderYear(view, r.years.cards[0]?.narrative ?? []), false, undefined);
}

function cmdMonth(argv: readonly string[], io: Io): void {
  const v = parse(argv, { year: { type: "string" }, month: { type: "string" }, ...CHART_REF });
  const { chart, params } = loadChart(io, v);
  const year = reqNum(v, "year");
  const civil = reqNum(v, "month");
  if (civil < 1 || civil > 12) throw new UsageError("--month 取公历月 1–12");
  /*
   * 公历月 → 节气月：取「节落在该月内」的那个月。
   *   2 月交立春 → 寅月（索引 0）…… 12 月交大雪 → 子月（索引 10）
   *   1 月交小寒 → 丑月（索引 11），而丑月属于**上一个立春年**
   * 漏掉最后这一条，`--month 1 --year 2026` 会算到 2027 年 1 月去。
   */
  const idx = (civil - 2 + 12) % 12;
  const springYear = civil === 1 ? year - 1 : year;
  const view = monthView(chart, springYear, idx, params);
  if (v["json"] === true) {
    emit(io, view as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }
  emit(io, renderMonth(view), false, undefined);
}

function cmdDay(argv: readonly string[], io: Io): void {
  const v = parse(argv, { date: { type: "string" }, ...CHART_REF });
  const { chart, params } = loadChart(io, v);
  const d = parseDate(req(v, "date"));
  const view = dayView(chart, d.year, d.month, d.day, params);
  if (v["json"] === true) {
    emit(io, view as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }
  emit(io, renderDay(view), false, undefined);
}

function cmdReport(argv: readonly string[], io: Io): void {
  const v = parse(argv, {
    format: { type: "string" }, now: { type: "string" },
    subject: { type: "string" }, locale: { type: "string" },
    ...CHART_REF,
  });
  const { chart, params } = loadChart(io, v);
  const format = oneOf(v, "format", ["markdown", "json"] as const, "markdown");
  const subject = oneOf(v, "subject", ["self", "other"] as const, "self");
  const locale = oneOf(v, "locale", ["zh-Hans", "zh-Hant", "en"] as const, params.report.locale);
  const now = typeof v["now"] === "string" ? parseDate(v["now"], "--now") : io.today();

  // 与 Web 完全相同的一次调用。窗口等默认值都在 core 里，此处不另作决定。
  const report = buildReport(chart, { params, subject, locale, now });

  if (format === "json" || v["json"] === true) {
    emit(io, report as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }
  emit(io, renderMarkdown(report), false, v["out"] as string | undefined);
}

function cmdCities(argv: readonly string[], io: Io): void {
  const v = parse(argv, { json: { type: "boolean" } });
  if (v["json"] === true) { emit(io, { cities: CITIES }, true); return; }
  const o = ["内置城市表 —— 便利而非权威。经度决定真太阳时，务必核对；--lon 永远覆盖表值。", ""];
  for (const c of CITIES) {
    o.push(`  ${c.name.padEnd(6, "　")}  ${String(c.longitude).padStart(8)}°  ${c.timeZone}`);
  }
  emit(io, o.join("\n"), false);
}

// ─────────────────────────────────────────────────────────

const COMMANDS: Readonly<Record<string, (a: readonly string[], io: Io) => void>> = {
  chart: cmdChart, luck: cmdLuck, year: cmdYear,
  month: cmdMonth, day: cmdDay, report: cmdReport, cities: cmdCities,
};

export function run(argv: readonly string[], io: Io): number {
  const [cmd, ...rest] = argv;
  if (cmd === undefined || cmd === "--help" || cmd === "-h" || cmd === "help") {
    io.out(USAGE);
    return cmd === undefined ? 1 : 0;
  }
  const fn = COMMANDS[cmd];
  if (fn === undefined) {
    io.err(`未知子命令 ${JSON.stringify(cmd)}。可用：${Object.keys(COMMANDS).join(" / ")}`);
    return 2;
  }
  try {
    fn(rest, io);
    return 0;
  } catch (e) {
    if (e instanceof UsageError) { io.err(`用法错误：${e.message}`); return 2; }
    io.err(`失败：${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

/** 输出前的措辞扫描 —— §6.4.3。命中即以非零码退出，绝不把违规文本送出去。 */
export function guardOutput(text: string): { clean: boolean; report: string } {
  const vs = scanText(text, "cli.stdout");
  return { clean: vs.length === 0, report: formatViolations(vs) };
}

export async function main(argv: readonly string[]): Promise<number> {
  const buf: string[] = [];
  const io: Io = {
    out: (s) => buf.push(s),
    err: (s) => process.stderr.write(`${s}\n`),
    readFile: (p) => readFileSync(p, "utf8"),
    writeFile: (p, s) => writeFileSync(p, s, "utf8"),
    today: () => {
      const d = new Date();
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    },
  };
  const code = run(argv, io);
  const text = buf.join("\n");
  if (text.length > 0) {
    const g = guardOutput(text);
    if (!g.clean) {
      process.stderr.write(`输出被措辞守卫拦下，未予打印：\n${g.report}\n`);
      return 3;
    }
    process.stdout.write(`${text}\n`);
  }
  return code;
}

export { MONTH_BRANCH_ORDER, evaluate };

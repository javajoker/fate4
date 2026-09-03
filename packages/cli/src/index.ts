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
  buildQuestionReport, buildReport, cast, castMomentOf, dailyOutlook, dayView,
  disclaimerText, dress, evaluate, formatViolations, judge, luckTimeline,
  monthView, MONTH_BRANCH_ORDER, pickYongshen, renderDailyMarkdown, renderMarkdown,
  plainCards, plainQuestion, scanPlain, renderCrossMarkdown, renderQuestionMarkdown, crossReading,
  type PlainCard,
  scanText, TOPICS, TOPIC_BY_ID, yearView,
  loadParams,
  type BirthInput, type CastInput, type CoinThrow, type Liuqin, type PartialParams,
} from "@fate/core";
import { UsageError, type Io } from "./io.js";
import { num, oneOf, parse, parseDate, parseTime, req, reqNum } from "./args.js";
import { findCity, CITIES } from "./cities.js";
import { makeChartFile, readChartFile, rebuild } from "./chartFile.js";
import { appendEntry, findEntry, fingerprintOf, keyOf, readJournal } from "./journal.js";
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
              [--subject self|other] [--locale zh-Hans|zh-Hant|en]
              [--nodes [--node-threshold 2.0]]

  fate ask    --topic 占事id [--question 问题文本 | --question-hash 指纹]
              (--city 城市 | --tz 时区 --lon 经度)
              [--at "YYYY-MM-DD HH:MM"] [--method time|number|coin]
              [--number N [--number2 M]] [--coins 121212] [--relation 六亲]
              [--journal f.json] [--locale …] [--json]

  fate daily  --chart c.json [--date YYYY-MM-DD] [--locale …] [--json]

  fate cross  (--city 城市 | --tz 时区 --lon 经度) [--at "YYYY-MM-DD HH:MM"]
              [--chart c.json] [--topic 占事id] [--locale …] [--json]
              四家合参：四柱流日 ∥ 六爻 ∥ 六壬 ∥ 奇门。不给 --chart 则三家。

  fate plain  --chart c.json [--section 性格|身心|亲近的人|人生轨迹|起伏|今年|本月|今天]
              [--json]
              人话版：把判定换成平常话，每条附技术原文作依据。

  fate topics             列出 32 类占事
  fate cities             列出内置城市表
  fate --help

选项
  --params  参数覆盖文件（.json，或 .yaml/.yml）。覆盖项与默认深合并后校验。
  --json    输出结构化 JSON，供程序消费。
  --nodes   加算 §6.5 统计节点。默认关闭 —— 它要按月跑满六十年，
            约 1.3 秒，比其余全部章节加起来还久。
            「--subject other」时即便开了也不产出。
  --journal 问卜记录。一事不二占：同一问题同一日再问，返回首卦。
            只存问题的**指纹**，不存原文。默认不落盘（即不设防）。
  --question 问题文本。仅用于就地算指纹，**不写入任何文件、不打印**。
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
  const asData = asJson || typeof v !== "string";
  if (out === undefined) io.out(text, asData ? "data" : "narrative");
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
    nodes: { type: "boolean" }, "node-threshold": { type: "string" },
    ...CHART_REF,
  });
  const { chart, params } = loadChart(io, v);
  const format = oneOf(v, "format", ["markdown", "json"] as const, "markdown");
  const subject = oneOf(v, "subject", ["self", "other"] as const, "self");
  const locale = oneOf(v, "locale", ["zh-Hans", "zh-Hant", "en"] as const, params.report.locale);
  const now = typeof v["now"] === "string" ? parseDate(v["now"], "--now") : io.today();

  // §6.5 默认关闭：它要按月跑满六十年，约 1.3 秒，比其余全部章节加起来还久。
  const includeNodes = v["nodes"] === true;
  const thRaw = v["node-threshold"];
  if (thRaw !== undefined && !includeNodes) {
    throw new UsageError("--node-threshold 须与 --nodes 同用，否则那一节根本不生成。");
  }
  const nodeThreshold = typeof thRaw === "string" ? Number(thRaw) : undefined;
  if (nodeThreshold !== undefined && !(nodeThreshold > 0)) {
    throw new UsageError(`--node-threshold 须为正数，实为 ${JSON.stringify(thRaw)}`);
  }

  // 与 Web 完全相同的一次调用。窗口等默认值都在 core 里，此处不另作决定。
  const report = buildReport(chart, {
    params, subject, locale, now, includeNodes,
    ...(nodeThreshold === undefined ? {} : { nodeThreshold }),
  });

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

// ═══════════════════════════════════════════════════════════
// 第二台引擎 —— 六爻问事与当日运程
// ═══════════════════════════════════════════════════════════

/** --city 或 --tz/--lon。与 cmdChart 同一套解析，避免两处各写一遍。 */
function placeOf(v: Record<string, string | boolean | undefined>): {
  timeZone: string; longitude: number;
} {
  const cityName = typeof v["city"] === "string" ? v["city"] : undefined;
  if (cityName !== undefined) {
    const c = findCity(cityName);
    if (c === undefined) {
      throw new UsageError(
        `城市表里没有「${cityName}」。表是便利而非权威，请直接给 --tz 与 --lon。`);
    }
    const lon = num(v, "lon");
    return { timeZone: c.timeZone, longitude: lon ?? c.longitude };
  }
  return { timeZone: req(v, "tz"), longitude: reqNum(v, "lon") };
}

function cmdTopics(argv: readonly string[], io: Io): void {
  const v = parse(argv, { json: { type: "boolean" } });
  if (v["json"] === true) { emit(io, { topics: TOPICS }, true); return; }
  const o = ["三十二类占事 —— 大类供选择，具体占事决定用神。", ""];
  let cat = "";
  for (const t of TOPICS) {
    if (t.category !== cat) { cat = t.category; o.push(`  【${cat}】`); }
    const use = t.use.kind === "liuqin" ? `用神 ${t.use.value}`
      : t.use.kind === "shi" ? "用神 世爻"
        : t.use.kind === "ying" ? "用神 应爻"
          : t.use.kind === "shiYing" ? "以世应关系为主" : "用神随所问之人（须给 --relation）";
    o.push(`    ${t.id.padEnd(20)} ${t.label.padEnd(10, "　")} ${use}`
      + (t.restricted === true ? "  ⚠️ 输出受限：不给预后、不给时间窗" : ""));
  }
  emit(io, o.join("\n"), false);
}

function cmdAsk(argv: readonly string[], io: Io): void {
  const v = parse(argv, {
    topic: { type: "string" }, question: { type: "string" },
    "question-hash": { type: "string" }, relation: { type: "string" },
    at: { type: "string" }, method: { type: "string" },
    number: { type: "string" }, number2: { type: "string" },
    coins: { type: "string" }, journal: { type: "string" },
    locale: { type: "string" }, plain: { type: "boolean" },
    tz: { type: "string" }, lon: { type: "string" }, city: { type: "string" },
    ...COMMON,
  });

  const topicId = req(v, "topic");
  const topic = TOPIC_BY_ID.get(topicId);
  if (topic === undefined) {
    throw new UsageError(`未知占事 ${JSON.stringify(topicId)}。fate topics 可列出全部三十二类。`);
  }
  const params = loadParams(loadOverrides(io, v["params"] as string | undefined));
  const locale = oneOf(v, "locale", ["zh-Hans", "zh-Hant", "en"] as const, params.report.locale);

  // 问题文本只用于就地算指纹 —— 不落盘、不打印、不进报告
  const qh = typeof v["question-hash"] === "string" ? v["question-hash"]
    : typeof v["question"] === "string" ? fingerprintOf(v["question"]) : null;

  const { timeZone, longitude } = placeOf(v);
  const now = typeof v["at"] === "string" ? parseAt(v["at"]) : nowOf(io);
  const at = { ...now, timeZone, longitude };

  const requested = oneOf(v, "method", ["time", "number", "coin"] as const, params.liuyao.castMethod);
  const moment = castMomentOf(at);
  const dayGanzhi = `${moment.pillars.day.stem}${moment.pillars.day.branch}`;

  // ── 一事不二占 ──
  const journalPath = typeof v["journal"] === "string" ? v["journal"] : null;
  const key = qh === null ? null : keyOf({ dayGanzhi, topicId, questionFingerprint: qh });
  const journal = journalPath === null ? null : readJournal(io, journalPath);
  const prior = journal !== null && key !== null ? findEntry(journal, key) : null;
  if (prior !== null) {
    io.err(`一事不二占：本日已为该问题起过卦（${prior.dayGanzhi}，记于 ${prior.recordedAt}），`
      + "此处返回首卦。重掷等于允许一直摇到满意为止，故不另起。");
  }
  // 重放时以**当初的时刻与输入**重算，故所得卦与首卦逐字相同。
  // 起卦法也须取首卦的 —— 命令行这次给的是什么并不作数，否则
  //「一事不二占」就成了「换个起卦法即可重来」。
  const input: CastInput = prior?.input ?? castInputOf(v, requested);
  if (prior !== null && v["method"] !== undefined && prior.input.method !== requested) {
    io.err(`（本次给的 --method ${requested} 不作数：首卦以 ${prior.input.method} 起，`
      + "换个起卦法不算换了一件事。)");
  }
  const method = input.method;
  const p = method === params.liuyao.castMethod
    ? params
    : { ...params, liuyao: { ...params.liuyao, castMethod: method } };
  const casting = cast(prior === null ? moment : castMomentOf(prior.at), input, p.liuyao);
  const gua = dress(casting, p.liuyao);
  const relation = typeof v["relation"] === "string" ? v["relation"] as Liuqin : undefined;
  const ys = pickYongshen(gua, topicId, relation);
  const j = judge(gua, ys, p.liuyao);
  const report = buildQuestionReport(j, p, {
    locale, ...(qh === null ? {} : { questionFingerprint: qh }),
  });

  if (journal !== null && key !== null && prior === null) {
    appendEntry(io, journalPath!, journal, {
      dayGanzhi, topicId, questionFingerprint: qh!,
      at, input, recordedAt: new Date().toISOString(),
    });
  }

  if (v["json"] === true) {
    emit(io, report as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }
  if (v["plain"] === true) {
    emitPlain(io, renderPlainQuestion(plainQuestion(report)), v["out"] as string | undefined);
    return;
  }
  emit(io, renderQuestionMarkdown(report), false, v["out"] as string | undefined);
}

/**
 * 问事的人话版。
 *
 * 与 `cmdPlain`（四柱人话版）同一套排法，且**指事单列一节** ——
 * 上面几节是本引擎的话，指事那一节是引来的原话，两者混排读者分不清谁在说。
 */
function renderPlainQuestion(p: ReturnType<typeof plainQuestion>): string {
  const o: string[] = ["# 问事・人话版", "", `> ${p.framing}`, ""];
  const block = (cards: readonly PlainCard[]) => {
    for (const c of cards) {
      o.push(`### ${c.title}`, "", c.body, "");
      if (c.evidence.length > 0) {
        o.push("<details><summary>看依据</summary>", "");
        for (const e of c.evidence) o.push(`- 〔推演〕${e.text}`);
        o.push("", "</details>", "");
      }
    }
  };
  o.push("## 这件事在卦里的分量", "");
  block(p.cards);
  if (p.yaoci.length > 0) {
    o.push("## 说的是什么事", "",
      "以下为《周易》爻辞及其传统转述的**引文**，原样端出，一个字未改。"
      + "与上一节各说各的，不互相印证。", "");
    block(p.yaoci);
  }
  o.push("---", "", p.disclaimer, "", `_技术版原文：${p.disclaimerTechnical}_`, "");
  return o.join("\n");
}

function cmdDaily(argv: readonly string[], io: Io): void {
  const v = parse(argv, {
    date: { type: "string" }, locale: { type: "string" }, ...CHART_REF,
  });
  const { chart, params } = loadChart(io, v);
  const locale = oneOf(v, "locale", ["zh-Hans", "zh-Hant", "en"] as const, params.report.locale);
  const d = typeof v["date"] === "string" ? parseDate(v["date"], "--date") : io.today();
  const o = dailyOutlook(chart, d, params);
  if (v["json"] === true) {
    emit(io, o as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }
  emit(io, renderDailyMarkdown(o, locale), false, v["out"] as string | undefined);
}

function cmdCross(argv: readonly string[], io: Io): void {
  const v = parse(argv, {
    at: { type: "string" }, topic: { type: "string" }, locale: { type: "string" },
    chart: { type: "string" },
    tz: { type: "string" }, lon: { type: "string" }, city: { type: "string" },
    params: { type: "string" }, json: { type: "boolean" }, out: { type: "string", short: "o" },
  });
  // 不给 --chart 就是三家合参 —— 少一家就少一家，不用别的顶上
  const withChart = typeof v["chart"] === "string";
  const params = withChart
    ? loadChart(io, v).params
    : loadParams(loadOverrides(io, v["params"] as string | undefined));
  const chart = withChart ? loadChart(io, v).chart : undefined;
  const locale = oneOf(v, "locale", ["zh-Hans", "zh-Hant", "en"] as const, params.report.locale);
  const { timeZone, longitude } = placeOf(v);
  const now = typeof v["at"] === "string" ? parseAt(v["at"]) : nowOf(io);

  const r = crossReading({
    ...now, timeZone, longitude,
    ...(typeof v["topic"] === "string" ? { topicId: v["topic"] } : {}),
  }, params, chart);

  if (v["json"] === true) {
    emit(io, r as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }
  emit(io, renderCrossMarkdown(r, locale), false, v["out"] as string | undefined);
}

/**
 * 人话版。
 *
 * 输出刻意分成「一句人话 + 缩进的依据」两层，而不是只出人话 ——
 * 命令行没有「点开」这个动作，若只出人话，那层来历就等于不存在了。
 */
function cmdPlain(argv: readonly string[], io: Io): void {
  const v = parse(argv, { section: { type: "string" }, ...CHART_REF });
  const { chart, params } = loadChart(io, v);
  const d = io.today();
  const report = buildReport(chart, { params, includeNodes: true, now: d });
  const p = plainCards(report);

  if (v["json"] === true) {
    emit(io, p as unknown as Record<string, unknown>, true, v["out"] as string | undefined);
    return;
  }
  const want = typeof v["section"] === "string" ? v["section"] : null;
  const cards = want === null ? p.cards : p.cards.filter((c) => c.section === want);
  if (cards.length === 0 && want !== null) {
    throw new UsageError(`没有「${want}」这一节。可选：`
      + [...new Set(p.cards.map((c) => c.section))].join(" / "));
  }

  const o: string[] = ["# 人话版", "", `> ${p.framing}`, ""];
  let sec = "";
  for (const c of cards) {
    if (c.section !== sec) { sec = c.section; o.push(`## ${sec}`, ""); }
    o.push(`### ${c.title}`, "", c.body, "");
    if (c.evidence.length > 0) {
      // 每条依据带「推演」二字：既是给读者的标示，也让人话守卫的框定语
      // 落在同一段里 —— 依据块引的是技术原文，含术语是它的本分，
      // 但守卫按段判定，看不到上一行的 <summary>。
      o.push("<details><summary>看依据</summary>", "");
      for (const e of c.evidence) o.push(`- 〔推演〕${e.text}`);
      o.push("", "</details>", "");
    }
  }
  o.push("---", "", p.disclaimer, "", `_技术版原文：${p.disclaimerTechnical}_`, "");
  emitPlain(io, o.join("\n"), v["out"] as string | undefined);
}

/** 人话版的输出走 `plain` 档。 */
function emitPlain(io: Io, text: string, out?: string): void {
  if (out === undefined) io.out(text, "plain");
  else io.writeFile(out, `${text}\n`);
}

/** `--at "YYYY-MM-DD HH:MM"`。问事必须精确到分 —— 时辰由真太阳时定。 */
function parseAt(raw: string): {
  year: number; month: number; day: number; hour: number; minute: number;
} {
  const [dPart, tPart] = raw.trim().split(/\s+/);
  if (dPart === undefined || tPart === undefined) {
    throw new UsageError(`--at 须形如 "2026-09-02 14:30"，实为 ${JSON.stringify(raw)}`);
  }
  return { ...parseDate(dPart, "--at"), ...parseTime(tPart) };
}

/** 未给 --at 时取系统时刻。内核里没有 Date.now()，取当下是外壳的职责。 */
function nowOf(io: Io): { year: number; month: number; day: number; hour: number; minute: number } {
  const d = io.today();
  const n = new Date();
  return { ...d, hour: n.getHours(), minute: n.getMinutes() };
}

function castInputOf(
  v: Record<string, string | boolean | undefined>, method: "time" | "number" | "coin",
): CastInput {
  if (method === "time") return { method: "time" };
  if (method === "number") {
    const n = num(v, "number");
    if (n === undefined) throw new UsageError("--method number 须同时给 --number。");
    const n2 = num(v, "number2");
    return n2 === undefined
      ? { method: "number", value: n }
      : { method: "number", value: n, second: n2 };
  }
  const raw = typeof v["coins"] === "string" ? v["coins"] : undefined;
  if (raw === undefined || !/^[0-3]{6}$/.test(raw)) {
    throw new UsageError(
      "--method coin 须给 --coins，形如 121212 —— 自初爻起六次，每位为三枚铜钱中的阳面数（0–3）。");
  }
  const throws = [...raw].map((c) => Number(c) as CoinThrow) as [
    CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow];
  return { method: "coin", throws };
}

// ─────────────────────────────────────────────────────────

const COMMANDS: Readonly<Record<string, (a: readonly string[], io: Io) => void>> = {
  chart: cmdChart, luck: cmdLuck, year: cmdYear,
  month: cmdMonth, day: cmdDay, report: cmdReport, cities: cmdCities,
  ask: cmdAsk, daily: cmdDaily, topics: cmdTopics, cross: cmdCross, plain: cmdPlain,
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
/**
 * 出口前再扫一遍标准输出。
 *
 * ## ⚠️ JSON 转储按「词汇」档扫，不按「叙述」档
 *
 * 这不是放宽，是判定档本来就分两种（见 `guard.ts` 的 `TextKind`）：
 * 「词汇表不是断语 —— 孤立名词无从框定语境，`requireContext` 对它不适用」。
 *
 * 原实现对整个 stdout 一律按叙述档扫，后果是**任何带神煞名的 JSON 都印不出来**：
 * `fate report --json`、`fate year --json` 全部以退出码 3 失败 ——
 * 一个神煞叫「血光」，它在 JSON 里是数组中的一个字符串，
 * 而 `zh.health.framing` 要求这个词周围有传统框定语。数组里当然没有。
 *
 * 词汇档**只跳过 `requireContext`**，`forbid` 一条不减：病名、绝对情态、
 * 概率陈述在 JSON 里照样拦。而 JSON 里那些真正的叙述句，
 * 在 `buildReport` 里已由 `guardReport` 按叙述档扫过，
 * 结果就放在同一份 JSON 的 `guard.violations` 里，消费方读得到。
 */
export function guardOutput(
  text: string, kind: "narrative" | "data" | "plain" = "narrative",
): { clean: boolean; report: string } {
  // 人话版走它自己的规则集：放开第二人称，另加六条更硬的。
  // 用技术层的规则扫人话，会把每一个「你」都拦下来。
  const vs = kind === "plain"
    ? scanPlain(text, "cli.stdout")
    : scanText(text, "cli.stdout", kind === "data" ? { kind: "vocabulary" } : {});
  return { clean: vs.length === 0, report: formatViolations(vs) };
}

export async function main(argv: readonly string[]): Promise<number> {
  const buf: string[] = [];
  let kind: "narrative" | "data" | "plain" = "narrative";
  const io: Io = {
    out: (s, k) => { buf.push(s); if (k !== undefined) kind = k; },
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
    const g = guardOutput(text, kind);
    if (!g.clean) {
      process.stderr.write(`输出被措辞守卫拦下，未予打印：\n${g.report}\n`);
      return 3;
    }
    process.stdout.write(`${text}\n`);
  }
  return code;
}

export { MONTH_BRANCH_ORDER, evaluate };

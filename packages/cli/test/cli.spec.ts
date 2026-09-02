import { describe, expect, it } from "vitest";
import {
  buildChart, buildReport, chartOptionsOf, loadParams, renderMarkdown, scanText,
  formatViolations, type BirthInput,
} from "@fate/core";
import { run, guardOutput } from "../src/index.js";
import { CITIES, findCity } from "../src/cities.js";
import type { Io } from "../src/io.js";

const EXAMPLE_ARGS = [
  "--date", "1990-05-12", "--time", "14:30",
  "--tz", "Asia/Shanghai", "--lon", "121.47", "--gender", "male",
];
const EXAMPLE: BirthInput = {
  year: 1990, month: 5, day: 12, hour: 14, minute: 30,
  gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47,
};

interface Result { code: number; out: string; err: string; files: Map<string, string> }

function cli(argv: string[], files: Map<string, string> = new Map()): Result {
  const out: string[] = []; const err: string[] = [];
  const io: Io = {
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    readFile: (p) => {
      const v = files.get(p);
      if (v === undefined) throw new Error(`ENOENT ${p}`);
      return v;
    },
    writeFile: (p, s) => { files.set(p, s); },
    today: () => ({ year: 2026, month: 9, day: 1 }),
  };
  const code = run(argv, io);
  return { code, out: out.join("\n"), err: err.join("\n"), files };
}

/** 先造一份命盘文件，供后续子命令引用。 */
function withChart(extra: string[] = []): Map<string, string> {
  const files = new Map<string, string>();
  const r = cli(["chart", ...EXAMPLE_ARGS, ...extra, "-o", "c.json"], files);
  expect(r.code, r.err).toBe(0);
  return files;
}

describe("参数解析", () => {
  it("未知选项报错，不静默忽略", () => {
    // `--gendre male` 若被默默丢掉，盘面照出、性别按缺省走，错得无声无息。
    const r = cli(["chart", ...EXAMPLE_ARGS, "--gendre", "male"]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/用法错误/);
  });

  it("未知子命令以非零码退出并列出可用命令", () => {
    const r = cli(["chartt"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("report");
  });

  it("缺时辰时必须显式声明，不猜", () => {
    const r = cli(["chart", "--date", "1990-05-12", "--tz", "Asia/Shanghai",
      "--lon", "121.47", "--gender", "male"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("时辰不猜");
    const ok = cli(["chart", "--date", "1990-05-12", "--tz", "Asia/Shanghai",
      "--lon", "121.47", "--gender", "male", "--unknown-hour", "--json"]);
    expect(ok.code, ok.err).toBe(0);
    expect(JSON.parse(ok.out).input.unknownHour).toBe(true);
  });

  it("缺性别报错 —— 大运顺逆由年干阴阳与性别共同决定", () => {
    const r = cli(["chart", "--date", "1990-05-12", "--time", "14:30",
      "--tz", "Asia/Shanghai", "--lon", "121.47"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--gender");
  });

  it("格式非法即报错", () => {
    expect(cli(["chart", ...EXAMPLE_ARGS.slice(0, 2), "--date", "1990/05/12"]).code).toBe(2);
    expect(cli(["chart", ...EXAMPLE_ARGS, "--time", "25:00"]).code).toBe(2);
  });

  it("参数文件非法即报错，绝不静默取默认", () => {
    const files = new Map([["bad.json", "{ not json"]]);
    const r = cli(["chart", ...EXAMPLE_ARGS, "--params", "bad.json"], files);
    expect(r.code).toBe(2);
    expect(r.err).toContain("解析失败");
  });

  it("参数文件违反结构不变量即报错", () => {
    const files = new Map([["p.json", JSON.stringify({ weights: { stemShare: 0.5 } })]]);
    const r = cli(["chart", ...EXAMPLE_ARGS, "--params", "p.json"], files);
    expect(r.code).toBe(1);
    expect(r.err).toContain("stemShare + branchShare");
  });

  it("YAML 参数文件同样可用", () => {
    const files = new Map([["p.yaml", "weights:\n  monthCommand:\n    branchMultiplier: 2.4\n"]]);
    const r = cli(["chart", ...EXAMPLE_ARGS, "--params", "p.yaml", "--json"], files);
    expect(r.code, r.err).toBe(0);
    expect(JSON.parse(r.out).overrides.weights.monthCommand.branchMultiplier).toBe(2.4);
  });
});

describe("命盘文件存的是输入，不是结果", () => {
  it("往返后重算得到同一张盘", () => {
    const files = withChart();
    const doc = JSON.parse(files.get("c.json")!);
    expect(doc.kind).toBe("fate-chart");
    expect(doc.input).toEqual(EXAMPLE);
    expect(doc.summary.pillars).toBe("庚午 辛巳 丁丑 丁未");
  });

  it("非命盘文件被拒", () => {
    const files = new Map([["x.json", JSON.stringify({ hello: 1 })]]);
    const r = cli(["year", "--chart", "x.json", "--year", "2026"], files);
    expect(r.code).toBe(2);
    expect(r.err).toContain("fate-chart");
  });
});

describe("各子命令产出", () => {
  const files = withChart();

  it("luck / year / month / day 皆可出 JSON", () => {
    const luck = cli(["luck", "--chart", "c.json", "--json"], files);
    expect(luck.code, luck.err).toBe(0);
    expect(JSON.parse(luck.out).steps).toHaveLength(12);

    const year = cli(["year", "--chart", "c.json", "--year", "2026", "--json"], files);
    expect(year.code, year.err).toBe(0);
    expect(JSON.parse(year.out).year).toBe(2026);

    // 公历九月内交白露，白露起酉月 —— 故 --month 9 解析为酉月，不是申月。
    // 「公历月 M」对应「节落在 M 月内的那个节气月」，即 idx = M − 2。
    const month = cli(["month", "--chart", "c.json", "--year", "2026", "--month", "9", "--json"], files);
    expect(month.code, month.err).toBe(0);
    expect(JSON.parse(month.out).pillar.branch).toBe("酉");
    expect(JSON.parse(month.out).openedBy).toBe("白露");

    const day = cli(["day", "--chart", "c.json", "--date", "2026-09-01", "--json"], files);
    expect(day.code, day.err).toBe(0);
    expect(JSON.parse(day.out).pillar.stem.length).toBe(1);
  });

  it("**流月流日的 JSON 里不得出现 weight 字段**", () => {
    for (const argv of [
      ["month", "--chart", "c.json", "--year", "2026", "--month", "3", "--json"],
      ["day", "--chart", "c.json", "--date", "2026-03-15", "--json"],
    ]) {
      const r = cli(argv, files);
      expect(r.out).not.toContain('"weight"');
      expect(r.out).not.toContain('"activity"');
    }
  });

  it("十二个公历月逐一对上其节气月 —— 偏移一位只在个别月份露馅", () => {
    const expected: Record<number, [string, string]> = {
      1: ["丑", "小寒"], 2: ["寅", "立春"], 3: ["卯", "惊蛰"], 4: ["辰", "清明"],
      5: ["巳", "立夏"], 6: ["午", "芒种"], 7: ["未", "小暑"], 8: ["申", "立秋"],
      9: ["酉", "白露"], 10: ["戌", "寒露"], 11: ["亥", "立冬"], 12: ["子", "大雪"],
    };
    for (let m = 1; m <= 12; m++) {
      const r = cli(["month", "--chart", "c.json", "--year", "2026", "--month", String(m), "--json"], files);
      expect(r.code, r.err).toBe(0);
      const v = JSON.parse(r.out);
      expect([v.pillar.branch, v.openedBy], `公历 ${m} 月`).toEqual(expected[m]);
    }
  });

  it("--month 越界报错", () => {
    expect(cli(["month", "--chart", "c.json", "--year", "2026", "--month", "13"], files).code).toBe(2);
  });
});

describe("**Skill 与 Web 结论逐字一致** —— P10 的验收判据", () => {
  const files = withChart();

  it("report 的 Markdown 与内核直调逐字节相同", () => {
    // 两者不是「碰巧一样」，是同一次调用：CLI 只负责解析参数与写文件。
    const params = loadParams({});
    const chart = buildChart(EXAMPLE, chartOptionsOf(params));
    const direct = renderMarkdown(buildReport(chart, {
      params, subject: "self", locale: params.report.locale,
      now: { year: 2026, month: 9, day: 1 },
    }));
    const r = cli(["report", "--chart", "c.json", "--now", "2026-09-01"], files);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toBe(direct);
  });

  it("窗口等默认值不在调用方手里 —— 不给 cardYears 也一致", () => {
    // 若 Web 与 CLI 各自决定卡片窗口，这条验收就从构造保证退化成人工约定。
    const params = loadParams({});
    const chart = buildChart(EXAMPLE, chartOptionsOf(params));
    const now = { year: 2026, month: 9, day: 1 };
    const a = buildReport(chart, { params, now });
    expect(a.years.cards.map((c) => c.view.year)).toEqual([2025, 2026, 2027, 2028, 2029, 2030]);
  });

  it("JSON 报告与 Markdown 出自同一棵树", () => {
    const j = cli(["report", "--chart", "c.json", "--format", "json", "--now", "2026-09-01"], files);
    const m = cli(["report", "--chart", "c.json", "--now", "2026-09-01"], files);
    const tree = JSON.parse(j.out);
    expect(m.out).toContain(tree.method.paramsHash);
    expect(m.out).toContain(tree.strength.narrative[0].text);
  });

  it("subject=other 时六亲叙述整体略去", () => {
    const r = cli(["report", "--chart", "c.json", "--format", "json",
      "--subject", "other", "--now", "2026-09-01"], files);
    const tree = JSON.parse(r.out);
    expect(tree.kin.narrativeOmitted).toBe(true);
    expect(tree.kin.narrative).toHaveLength(0);
    expect(tree.kin.readings).toHaveLength(5);
  });

  it("繁体尚未就位，取之即报错而非静默回落简体", () => {
    const r = cli(["report", "--chart", "c.json", "--locale", "zh-Hant"], files);
    expect(r.code).toBe(1);
    expect(r.err).toMatch(/zh-Hant|繁体/);
  });
});

describe("输出经措辞扫描", () => {
  const files = withChart();

  it("各子命令的人读输出全部通过", () => {
    const cmds = [
      ["chart", ...EXAMPLE_ARGS],
      ["luck", "--chart", "c.json"],
      ["year", "--chart", "c.json", "--year", "2026"],
      ["year", "--chart", "c.json", "--year", "2027"],
      ["month", "--chart", "c.json", "--year", "2026", "--month", "3"],
      ["day", "--chart", "c.json", "--date", "2026-03-15"],
      ["report", "--chart", "c.json", "--now", "2026-09-01"],
      ["cities"],
    ];
    for (const argv of cmds) {
      const r = cli(argv, files);
      expect(r.code, `${argv[0]}: ${r.err}`).toBe(0);
      expect(formatViolations(scanText(r.out, argv[0]!)), argv[0]).toBe("措辞扫描通过。");
    }
  });

  it("人读输出里不得漏出英文枚举", () => {
    for (const argv of [
      ["chart", ...EXAMPLE_ARGS], ["luck", "--chart", "c.json"],
      ["year", "--chart", "c.json", "--year", "2026"],
      ["month", "--chart", "c.json", "--year", "2026", "--month", "3"],
      ["day", "--chart", "c.json", "--date", "2026-03-15"],
    ]) {
      const r = cli(argv, files);
      for (const line of r.out.split("\n")) {
        // 参数快照、时区标识、出生地经纬本就是标识符与数字
        if (/参数快照|时区|Asia|Europe|America|Australia/.test(line)) continue;
        expect(line, `${argv[0]} 漏出英文：${line}`).not.toMatch(/[A-Za-z]{3,}/);
      }
    }
  });

  it("守卫是真的会拦人的", () => {
    // 没有这条，上面几条全绿也可能只是因为扫描根本没跑到东西。
    expect(guardOutput("日主偏弱。").clean).toBe(true);
    expect(guardOutput("命主 2029 年会离婚，且必然破财。").clean).toBe(false);
  });

  it("**JSON 转储按词汇档扫 —— 否则任何带神煞名的 JSON 都印不出来**", () => {
    // 一个神煞叫「血光」。它在 JSON 里是数组中的一个字符串，
    // 而 zh.health.framing 要求这个词周围有传统框定语 —— 数组里当然没有。
    // 原实现对整个 stdout 一律按叙述档扫，`fate report --json` 因此恒以码 3 失败。
    const dump = JSON.stringify({ shensha: ["血光", "劫煞"] }, null, 2);
    expect(guardOutput(dump, "narrative").clean, "叙述档本就该拦下它").toBe(false);
    expect(guardOutput(dump, "data").clean, "词汇档不该拦一个孤立的神煞名").toBe(true);
  });

  it("**但词汇档只跳 requireContext，forbid 一条不减**", () => {
    for (const bad of [
      { note: "命主必然破财。" },          // zh.prediction.absolute
      { note: "此运易患肝炎。" },          // zh.medical.diseaseName
      { note: "发生巨变的概率为 5%。" },    // zh.stats.probability
    ]) {
      const dump = JSON.stringify(bad, null, 2);
      expect(guardOutput(dump, "data").clean, dump).toBe(false);
    }
  });
});

describe("§6.5 统计节点", () => {
  const files = withChart();

  it("默认不产出 —— 它要按月跑满六十年，比其余全部章节加起来还久", () => {
    const r = cli(["report", "--chart", "c.json", "--format", "json"], files);
    expect(r.code).toBe(0);
    expect((JSON.parse(r.out) as { nodes: unknown }).nodes).toBeNull();
  });

  it("--nodes 打开，且两层结构齐全", () => {
    const r = cli(["report", "--chart", "c.json", "--nodes", "--format", "json"], files);
    expect(r.code).toBe(0);
    const n = (JSON.parse(r.out) as {
      nodes: { findings: { summary: { text: string }; detail: { evidence: unknown[] } }[];
        threshold: number };
    }).nodes;
    expect(n.findings.length).toBeGreaterThan(0);
    expect(n.threshold).toBe(2);
    for (const f of n.findings) expect(f.detail.evidence.length).toBeGreaterThan(0);
  });

  it("--node-threshold 生效，且必须与 --nodes 同用", () => {
    const r = cli(["report", "--chart", "c.json", "--nodes",
      "--node-threshold", "2.5", "--format", "json"], files);
    expect((JSON.parse(r.out) as { nodes: { threshold: number } }).nodes.threshold).toBe(2.5);

    // 单给门槛而不开节点，那一节根本不生成 —— 静默忽略会让人以为它生效了
    const bad = cli(["report", "--chart", "c.json", "--node-threshold", "2.5"], files);
    expect(bad.code).not.toBe(0);
    expect(bad.err).toMatch(/须与 --nodes 同用/);

    const neg = cli(["report", "--chart", "c.json", "--nodes", "--node-threshold", "-1"], files);
    expect(neg.code).not.toBe(0);
  });

  it("subject=other 时即便开了也不产出 —— 那是对一个人一生时段的描述", () => {
    const r = cli(["report", "--chart", "c.json", "--nodes",
      "--subject", "other", "--format", "json"], files);
    expect((JSON.parse(r.out) as { nodes: unknown }).nodes).toBeNull();
  });

  it("Markdown 用 details 折叠 —— 直接铺开，两层就塌成一层", () => {
    const r = cli(["report", "--chart", "c.json", "--nodes"], files);
    expect(r.code).toBe(0);
    expect(r.out).toContain("## §6.5 统计节点");
    expect(r.out).toContain("<details><summary>展开依据</summary>");
    expect(formatViolations(scanText(r.out, "report --nodes"))).toBe("措辞扫描通过。");
  });
});

describe("城市表 —— 便利而非权威", () => {
  it("名称与别名皆可查，且大小写不敏感", () => {
    expect(findCity("上海")?.longitude).toBe(121.47);
    expect(findCity("Shanghai")?.name).toBe("上海");
    expect(findCity("SHANGHAI")?.name).toBe("上海");
    expect(findCity("不存在的城")).toBeUndefined();
  });

  it("表外城市不猜，明确报错并指向 --tz / --lon", () => {
    const r = cli(["chart", "--date", "1990-05-12", "--time", "14:30",
      "--city", "某个不在表里的地方", "--gender", "male"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--lon");
  });

  it("--lon 覆盖城市表", () => {
    const r = cli(["chart", "--date", "1990-05-12", "--time", "14:30",
      "--city", "上海", "--lon", "100", "--gender", "male", "--json"]);
    expect(r.code, r.err).toBe(0);
    expect(JSON.parse(r.out).input.longitude).toBe(100);
    expect(JSON.parse(r.out).input.timeZone).toBe("Asia/Shanghai");
  });

  it("经度与其时区的标称子午线之差不超过 40°", () => {
    /*
     * 交叉校验：经度是我录入的，时区的标称子午线可由 IANA 数据推得，
     * 两者独立。拦不住 0.5° 的小误差，但足以逮住符号写反、数位漏写 ——
     * 而那正是凭记忆录表最常犯的错。乌鲁木齐差 32° 是真实情况
     * （用东八区时钟而位于东经 87.6°），正是真太阳时存在的理由。
     */
    for (const c of CITIES) {
      const off = offsetHours(c.timeZone);
      const meridian = off * 15;
      const d = Math.abs(c.longitude - meridian);
      expect(d, `${c.name} 经度 ${c.longitude}° 与 ${c.timeZone} 的标称子午线 ${meridian}° 相差 ${d.toFixed(1)}°`)
        .toBeLessThanOrEqual(40);
    }
  });

  it("城市名与别名不重复", () => {
    const keys = CITIES.flatMap((c) => [c.name, ...c.aliases]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/** 某时区在某个冬季时点的 UTC 偏移（小时）—— 避开夏令时。 */
function offsetHours(tz: string): number {
  const at = new Date(Date.UTC(2021, 0, 15, 12, 0, 0));
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(
    Number(p["year"]), Number(p["month"]) - 1, Number(p["day"]),
    Number(p["hour"]) % 24, Number(p["minute"]));
  return (asUtc - at.getTime()) / 3_600_000;
}

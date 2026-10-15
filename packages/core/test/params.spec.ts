import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { load as loadYaml } from "js-yaml";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { loadParams, ParamsValidationError, paramsHash, stableStringify } from "../src/params/load.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const YAML_PATH = resolve(HERE, "../../../params/default.yaml");

describe("YAML 与 TS 默认值一致", () => {
  /**
   * 默认值的真源是 TypeScript；params/default.yaml 是平行的文档表述。
   * 这条测试让「二者一致」成为可执行的断言，而不是一句期望。
   * 任一处漂移即构建失败 —— 文档不会悄悄过期。
   */
  const doc = loadYaml(readFileSync(YAML_PATH, "utf8")) as Record<string, unknown>;
  const yamlWeights = doc["weights"] as Record<string, unknown>;

  it("YAML 可解析且含 weights 段", () => {
    expect(doc["version"]).toBe(DEFAULT_PARAMS.version);
    expect(yamlWeights).toBeTypeOf("object");
  });

  const flat = (o: unknown, p = "", out: string[] = []): string[] => {
    if (o === null || typeof o !== "object" || Array.isArray(o)) { out.push(p); return out; }
    for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, out);
    return out;
  };

  // 三段全覆盖。只查 weights 会让后加的 structure / propagation 悄悄漂移 ——
  // 实测 propagation 就曾漂出两处（新增 inflowDamageCap、maxRounds 30→3）。
  // conclusion 段同样纳入 —— 它含四个流派开关，漂移会让报告声明错误的流派。
  // chart 与 report 两段起初只存在于 YAML 里，TS 侧无对应物 ——
  // 于是它们既不受这条断言保护，也进不了参数校准面板。补齐后一并纳入。
  for (const section of [
    "chart", "weights", "structure", "propagation",
    "conclusion", "shensha", "temporal", "persona", "series", "nodes", "report",
  ] as const) {
    it(`${section} 段逐项相同（含嵌套）`, () => {
      // stableStringify 递归排序键，使比较与书写顺序无关
      expect(stableStringify(doc[section])).toBe(stableStringify(DEFAULT_PARAMS[section]));
    });

    it(`${section} 键集合完全一致 —— YAML 不多不少`, () => {
      expect(flat(doc[section]).sort()).toEqual(flat(DEFAULT_PARAMS[section]).sort());
    });
  }
});

describe("参数校验", () => {
  it("默认值本身合法", () => {
    expect(() => loadParams()).not.toThrow();
    expect(loadParams()).toEqual(DEFAULT_PARAMS);
  });

  it("覆盖项与默认深合并", () => {
    const p = loadParams({ weights: { monthCommand: { branchMultiplier: 2.5 } } });
    expect(p.weights.monthCommand.branchMultiplier).toBe(2.5);
    expect(p.weights.monthCommand.stemMultiplier).toBe(1.2);   // 未覆盖者保持
    expect(p.weights.pillarBase).toBe(100);
  });

  it("超出区间即抛错，绝不静默取默认", () => {
    expect(() => loadParams({ weights: { monthCommand: { silingBoost: 99 } } }))
      .toThrow(ParamsValidationError);
    expect(() => loadParams({ weights: { stemShare: -1 } })).toThrow(/stemShare/);
  });

  it("枚举非法即抛错", () => {
    expect(() => loadParams({ weights: { luck: { mode: "quadratic" as never } } }))
      .toThrow(/luck\.mode/);
  });

  it("**结构不变量**：干支占比之和须为 1", () => {
    // 这一类若被违反，引擎不会报错，只会静默产出错误盘面 —— 必须在入口拦住
    expect(() => loadParams({ weights: { stemShare: 0.5 } }))
      .toThrow(/stemShare \+ branchShare/);
    expect(() => loadParams({ weights: { stemShare: 0.5, branchShare: 0.5 } })).not.toThrow();
  });

  it("藏干下发比例之和须为 1 且递减", () => {
    expect(() => loadParams({ weights: { hiddenSplit: { 3: [0.5, 0.3, 0.1] } } }))
      .toThrow(/hiddenSplit\.3 之和/);
    expect(() => loadParams({ weights: { hiddenSplit: { 3: [0.1, 0.25, 0.65] } } }))
      .toThrow(/递减/);
  });

  it("流年干支之和须等于其总量", () => {
    expect(() => loadParams({ weights: { year: { stem: 50 } } }))
      .toThrow(/year\.stem \+ branch/);
    expect(() => loadParams({ weights: { year: { stem: 50, total: 120 } } })).not.toThrow();
  });

  it("[硬约束] 措辞扫描与中性配色不可关闭", () => {
    // 这两项若可配置，「违反的输出视为 bug」就降格成了一句建议。
    expect(() => loadParams({ report: { guard: { enforceBannedTerms: false as never } } }))
      .toThrow(/enforceBannedTerms/);
    expect(() => loadParams({ report: { guard: { neutralPalette: false as never } } }))
      .toThrow(/neutralPalette/);
  });

  it("[硬约束] 南半球不反转季节", () => {
    expect(() => loadParams({ chart: { southernHemisphereFlip: true } }))
      .toThrow(/southernHemisphereFlip/);
  });

  it("未实现的开关锁在默认值上，且抛错时说明原因", () => {
    // 静默忽略是最坏的一种：用户改了值、以为生效了，而盘面纹丝不动。
    expect(() => loadParams({ chart: { hiddenStemVariant: "alt" } })).toThrow(/尚未录入|只支持 standard/);
    expect(() => loadParams({ chart: { includeShenGong: true } })).toThrow(/尚未实现/);
    expect(() => loadParams({ chart: { handleDst: false } })).toThrow(/不可关闭/);
  });

  it("四个流派开关都能改，且改动确实进入参数", () => {
    const p = loadParams({
      chart: { ziHourRule: "earlyZiSameDay", mingGongBoundary: "zhongqi" },
      conclusion: { changshengSchool: "sameBirthDeath", earthChangsheng: "waterEarthSame" },
    });
    expect(p.chart.ziHourRule).toBe("earlyZiSameDay");
    expect(p.chart.mingGongBoundary).toBe("zhongqi");
    expect(p.conclusion.changshengSchool).toBe("sameBirthDeath");
    expect(p.conclusion.earthChangsheng).toBe("waterEarthSame");
  });

  it("一次报出全部错误，而非只报第一条", () => {
    try {
      loadParams({ weights: { stemShare: 5, luck: { mode: "bad" as never } } });
      expect.unreachable("应当抛错");
    } catch (e) {
      expect(e).toBeInstanceOf(ParamsValidationError);
      expect((e as ParamsValidationError).errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("参数指纹", () => {
  it("同参数同指纹，与键的书写顺序无关", () => {
    expect(paramsHash(loadParams())).toBe(paramsHash(DEFAULT_PARAMS));
    const a = loadParams({ weights: { pillarBase: 100, stemShare: 0.4 } });
    const b = loadParams({ weights: { stemShare: 0.4, pillarBase: 100 } });
    expect(paramsHash(a)).toBe(paramsHash(b));
  });

  it("改任一参数即改指纹", () => {
    const base = paramsHash(DEFAULT_PARAMS);
    expect(paramsHash(loadParams({ weights: { monthCommand: { silingBoost: 1.51 } } })))
      .not.toBe(base);
  });

  it("**呈现项不进指纹** —— 指纹的用处是「数可比」，而它们不改任何一个数", () => {
    // 否则同一张盘的简体版与繁体版会得到两个不同的指纹，于是按本项目自己的
    // 规矩它们「不可比」—— 而它们的数逐位相同。读者档一加进来，
    // 这个毛病会从偶尔遇到变成每天都遇到。
    const base = paramsHash(DEFAULT_PARAMS);
    for (const o of [
      { report: { audience: "practitioner" } },
      { report: { audience: "student" } },
      { report: { locale: "zh-Hant" } },
      { report: { showParamsSnapshot: false } },
      { report: { showConvergenceHistory: true } },
    ] as const) {
      expect(paramsHash(loadParams(o)), JSON.stringify(o)).toBe(base);
    }
  });

  it("**反过来：会改数值的参数一项都不许漏** —— 逐节各改一处，指纹必须变", () => {
    const base = paramsHash(DEFAULT_PARAMS);
    const probes = [
      ["chart", { chart: { ziHourRule: "earlyZiSameDay" } }],
      ["weights", { weights: { luck: { total: 150 } } }],
      ["structure", { structure: { rewriteCarriers: true } }],
      ["conclusion", { conclusion: { congge: { ratioThreshold: 0.4 } } }],
      ["nodes", { nodes: { threshold: 3 } }],
    ] as const;
    for (const [name, o] of probes) {
      expect(paramsHash(loadParams(o)), `改 ${name} 后指纹没变`).not.toBe(base);
    }
  });
});

describe("**四柱之外几套的流派也归参数管** —— 指纹相同，两份才可比", () => {
  /**
   * 此前紫微、星盘、塔罗的流派散在函数参数与硬编码里，于是两张用不同
   * 取法排出来的盘会得到**同一个指纹**。而指纹的用处只有一个：
   * 指纹相同，两份报告的数才可比。
   */
  it("三节都在 Params 上，与 liuyao / qimen 同列", () => {
    const p = loadParams({});
    for (const k of ["ziwei", "sky", "tarot", "liuyao", "qimen"] as const) {
      expect(p[k], k).toBeDefined();
    }
  });

  it("**改任何一处流派，指纹都变**", () => {
    const base = paramsHash(loadParams({}));
    const changes = [
      { tarot: { numbering: "rws" } },
      { tarot: { suitElement: "swordsFire" } },
      { tarot: { withReversals: true } },
      { sky: { maxOrb: 6 } },
    ] as const;
    for (const c of changes) {
      expect(paramsHash(loadParams(c)), JSON.stringify(c)).not.toBe(base);
    }
  });

  it("**而改呈现仍不变** —— 这几节是计算参数，report 不是", () => {
    const base = paramsHash(loadParams({}));
    expect(paramsHash(loadParams({ report: { audience: "practitioner" } })))
      .toBe(base);
    expect(paramsHash(loadParams({ report: { locale: "zh-Hant" } }))).toBe(base);
  });

  it("枚举越界报错，不静默取默认", () => {
    expect(() => loadParams({ tarot: { numbering: "乱写" } as never })).toThrow();
    expect(() => loadParams({ sky: { houseSystem: "placidus" } as never })).toThrow();
    expect(() => loadParams({ ziwei: { leapMonth: "乱写" } as never })).toThrow();
    expect(() => loadParams({ sky: { maxOrb: 99 } })).toThrow();
  });

  it("**两条硬约束锁死** —— 它们不是偏好", () => {
    // 紫微的时辰不做真太阳时校正：它的传统起法不涉及经度
    expect(() => loadParams({ ziwei: { trueSolarTimeHour: true } as never })).toThrow();
    // 未实现的派别锁在默认值上，且报错里说明为什么
    expect(() => loadParams({ ziwei: { leapMonth: "splitHalf" } }))
      .toThrow(/尚未实现/);
  });

  it("**参数真的被读到** —— 不是只存着好看", async () => {
    const { drawSpread } = await import("../src/tarot/index.js");
    const rnd = { id: "fixed", int: () => 0 };
    const a = drawSpread({ params: loadParams({ tarot: { numbering: "marseille" } }), random: rnd });
    const b = drawSpread({ params: loadParams({ tarot: { numbering: "rws" } }), random: rnd });
    expect(a.schools.numbering).toBe("marseille");
    expect(b.schools.numbering).toBe("rws");
    // 同一副牌、同一个随机源 → 同一批牌，但 8/11 的序号不同
    expect(a.cards.map((c) => c.card.id)).toEqual(b.cards.map((c) => c.card.id));
    const major8 = drawSpread({
      params: loadParams({ tarot: { numbering: "rws" } }),
      spreadId: "celtic", random: rnd,
    });
    expect(major8.schools.numbering).toBe("rws");
  });

  it("**星盘容许度确实管用** —— 按度成相必须守住它", async () => {
    const { skyChart, aspectsOf } = await import("../src/sky/chart.js");
    const { buildChart } = await import("../src/chart/buildChart.js");
    const { asTT } = await import("../src/astro/julian.js");
    const { deltaTSeconds } = await import("../src/astro/deltaT.js");
    const skyOf = (y: number, mo: number, d: number) => {
      const c = buildChart({
        year: y, month: mo, day: d, hour: 12, minute: 0,
        gender: "male", timeZone: "Asia/Shanghai", longitude: 121.47, latitude: 31.23,
      });
      return skyChart(c.birthJdUT as never,
        asTT(c.birthJdUT + deltaTSeconds(y, mo).seconds / 86400), 121.47, 31.23);
    };

    // 契约：每一条要么整宫成相，要么角距在容许度之内。两者之外不得出现。
    let differed = 0;
    for (const [y, mo, d] of [[1990, 5, 12], [1995, 8, 3], [2001, 2, 20],
      [2010, 11, 7], [2020, 6, 15]] as const) {
      const sky = skyOf(y, mo, d);
      for (const orb of [2, 6, 10]) {
        for (const a of aspectsOf(sky, undefined, loadParams({ sky: { maxOrb: orb } }))) {
          expect(a.byWholeSign || a.orb <= orb, `${y}-${mo} orb=${orb}`).toBe(true);
        }
      }
      const narrow = aspectsOf(sky, undefined, loadParams({ sky: { maxOrb: 1 } })).length;
      const wide = aspectsOf(sky, undefined, loadParams({ sky: { maxOrb: 12 } })).length;
      expect(wide).toBeGreaterThanOrEqual(narrow);
      if (wide > narrow) differed++;
    }
    // 反向对照：样本里确实有盘在放宽后多出条目，
    // 否则上面那条可能只是在比两个相等的数
    expect(differed, "五张盘里总该有几张在放宽容许度后多出按度成相的条目")
      .toBeGreaterThan(0);
  });
});

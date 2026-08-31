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
  for (const section of ["weights", "structure", "propagation", "conclusion", "shensha"] as const) {
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
});

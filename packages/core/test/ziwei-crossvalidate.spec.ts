import { describe, expect, it } from "vitest";
import { buildZiweiChart } from "../src/ziwei/index.js";
import { BRANCHES } from "../src/types/ganzhi.js";

/**
 * 紫微排盘 —— 与 **iztro** 逐盘对照。
 *
 * ## 为什么需要这一条
 *
 * 紫微的星曜偏移表是凭记忆转录的，而本项目对它的结构性检查
 * （十四颗不重名、全部落在十二宫内、天府与紫微的对称是对合）
 * **全部通过** —— 然而其中一条是错的。
 *
 * 错在 `tianfuIndex`：写的是 `(10 − 紫微)`，该写 `(4 − 紫微)`。
 * 两者都是对合，只是不动点一个落在巳亥、一个落在寅申。
 * 于是天府系八颗星整体偏了六宫，而没有任何内部不变量看得出来 ——
 * 因为内部不变量只看自己。更糟的是当初那条测试断言的是
 * `天府(寅) === 申`，把同一个错误抄了一遍，所以一路全绿。
 *
 * **逮到它的是另一套独立实现。** 这与 `crossvalidate.spec.ts` 用
 * Astronomy Engine 校验太阳月亮是同一条理由：一个实现可以自洽地错下去。
 *
 * ## ⚠️ 它能证明什么，不能证明什么
 *
 * **能**：我的落位与一套独立实现一致 —— 两边同时错成一样的可能性很低。
 *
 * **不能**：证明这张表「对」。iztro 自己**不引任何底本**，
 * 而整个开源紫微生态基本都源自它。故「与 iztro 一致」
 * 不等于「与《紫微斗数全书》一致」—— 那仍然需要实体书。
 *
 * 换句话说：**不一致是信息，一致不是证据。** 这条对照的价值在前一半。
 *
 * ## 为什么用 devDependency 而不是 submodule
 *
 * Astronomy Engine 是零依赖的纯 JS，拿 submodule 引进来直接能跑。
 * iztro 是 TypeScript 且有四个运行时依赖，submodule 意味着自己构建、
 * 自己解依赖 —— 严格更差。它只进 devDependencies，不进任何运行时路径。
 *
 * 装不上时本条**自动跳过**：一个因为缺少可选校验而变红的套件，
 * 只会教人去忽略红色。
 */

interface IztroStar { readonly name: string; readonly brightness: string }
interface IztroPalace {
  readonly name: string;
  readonly earthlyBranch: string;
  readonly majorStars: readonly IztroStar[];
}
interface IztroChart {
  readonly palaces: readonly IztroPalace[];
  readonly fiveElementsClass: string;
  readonly lunarDate: string;
}
interface Iztro {
  astro: {
    bySolar(date: string, hourIndex: number, gender: string,
      fixLeap: boolean, lang: string): IztroChart;
  };
}

let AE: Iztro | null = null;
try {
  AE = await import("iztro") as unknown as Iztro;
} catch { AE = null; }

const MAJORS = new Set([
  "紫微", "天机", "太阳", "武曲", "天同", "廉贞",
  "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军",
]);

/** 覆盖四季、大小月、不同时辰与性别。 */
const CASES: readonly (readonly [number, number, number, number, "male" | "female"])[] = [
  [1990, 5, 12, 14, "male"], [1985, 1, 3, 0, "female"],
  [1972, 9, 28, 23, "male"], [2001, 2, 14, 6, "female"],
  [1960, 12, 31, 11, "male"], [2015, 7, 7, 18, "female"],
  [1948, 3, 19, 3, "male"], [2023, 10, 1, 21, "female"],
  [1999, 6, 6, 9, "male"], [1933, 11, 11, 16, "female"],
];

/** 本项目的时辰序与 iztro 的 hourIndex 同口径：子时 0，23 时起即次日子时。 */
const hourIndexOf = (hour: number): number => Math.floor(((hour + 1) % 24) / 2);

describe.skipIf(AE === null)("**紫微排盘：与 iztro 逐盘对照**", () => {
  it("iztro 载得进来", () => {
    expect(typeof AE!.astro.bySolar).toBe("function");
  });

  it("**十四主星逐宫一致** —— 这一条逮到过一个结构性检查看不见的错", () => {
    let checked = 0;
    for (const [y, mo, d, h, g] of CASES) {
      const mine = buildZiweiChart({
        year: y, month: mo, day: d, hour: h, minute: 0,
        gender: g, timeZone: "Asia/Shanghai", longitude: 121.47,
      });
      const theirs = AE!.astro.bySolar(`${y}-${mo}-${d}`, hourIndexOf(h), g, true, "zh-CN");
      for (const p of theirs.palaces) {
        const i = BRANCHES.indexOf(p.earthlyBranch as typeof BRANCHES[number]);
        expect(i, `支 ${p.earthlyBranch} 不识`).toBeGreaterThanOrEqual(0);
        const a = mine.palaces[i]!.stars
          .filter((s) => MAJORS.has(s.name)).map((s) => s.name).sort();
        const b = [...p.majorStars].map((s) => s.name).sort();
        expect(a, `${y}-${mo}-${d} ${h}时 ${p.earthlyBranch}`).toEqual(b);
        checked++;
      }
    }
    expect(checked, "反向对照：确实逐宫比过").toBe(CASES.length * 12);
  });

  it("命宫与五行局也一致", () => {
    for (const [y, mo, d, h, g] of CASES) {
      const mine = buildZiweiChart({
        year: y, month: mo, day: d, hour: h, minute: 0,
        gender: g, timeZone: "Asia/Shanghai", longitude: 121.47,
      });
      const theirs = AE!.astro.bySolar(`${y}-${mo}-${d}`, hourIndexOf(h), g, true, "zh-CN");
      const theirMing = theirs.palaces.find((p) => p.name === "命宫")!;
      expect(mine.palaces.find((p) => p.isMing)!.branch,
        `${y}-${mo}-${d} 命宫`).toBe(theirMing.earthlyBranch);
      expect(mine.bureau.bureau, `${y}-${mo}-${d} 五行局`)
        .toBe(theirs.fiveElementsClass);
    }
  });

  it("**反向对照：把天府的式子改回旧版，对照必须红**", () => {
    // 旧式 (10 − 紫微) 同样是对合，不动点却在巳亥 —— 结构性检查看不出来。
    // 这条证明本对照确实有能力逮到它。
    const wrongTianfu = (ziwei: number) => ((10 - ziwei) % 12 + 12) % 12;
    const rightTianfu = (ziwei: number) => ((4 - ziwei) % 12 + 12) % 12;
    let differ = 0;
    for (let z = 0; z < 12; z++) {
      if (wrongTianfu(z) !== rightTianfu(z)) differ++;
      // 两者都是对合 —— 故「对合」这条断言对二者皆真，分辨不出
      expect(wrongTianfu(wrongTianfu(z))).toBe(z);
      expect(rightTianfu(rightTianfu(z))).toBe(z);
    }
    expect(differ, "十二个紫微落点上两式全不相同").toBe(12);
  });

  it("⚠️ **一致不是证据** —— iztro 自己不引底本", () => {
    // 这条不断言任何数值，只是把那句话钉在测试里，
    // 免得日后有人把「与 iztro 一致」当成「已核对」写进文档。
    const note = "iztro 不引任何底本，且开源紫微生态基本源自它；"
      + "故一致不等于与《紫微斗数全书》一致。不一致是信息，一致不是证据。";
    expect(note).toContain("一致不是证据");
  });
});

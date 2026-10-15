/**
 * 紫微盘面的解读 —— 只说结构，不下断语。
 *
 * ## 这一层解读什么
 *
 * 排盘给出的是「哪颗星在哪一宫」。但紫微的读法从来不是一宫一宫单看，
 * 而是**成组地看**：
 *
 * 1. **三方四正** —— 本宫、对宫，加三合的另两宫。四宫同看。
 * 2. **空宫借星** —— 本宫无主星时，借对宫的主星来看。
 * 3. **四化落宫** —— 四化落在哪一宫，就把那一宫牵动起来。
 * 4. **格局** —— 某几颗星凑在三方四正里，传统上另有名目。
 *
 * 这四条**全部可由落位推出**，不需要另一张表。所以本模块产出的每一条
 * 都指得回「哪几颗星在哪几宫」这个已经算好的事实。
 *
 * ## ⚠️ 不收星曜庙旺表，而且这是个缺口
 *
 * 紫微另有一层：**每颗星在十二宫各自的庙、旺、得地、平、陷**。
 * 那是十四主星 × 十二宫 = 168 格。
 *
 * 本项目**不收**。理由与别处一致：168 格凭记忆转录，
 * 其风险比《穷通宝鉴》120 格更大，而结构性检查对它几乎无能为力 ——
 * 一格记错看不出来，而它会悄悄改变对某颗星的强弱判断。
 *
 * **这是一个真实的缺口，不是设计上的取舍。** 收齐它需要一个底本，
 * 而本项目没有。写在这里，也写在界面上。
 *
 * ## 不出断语
 *
 * 本模块产出「命宫坐七杀，三方见破军、贪狼」这样的**事实陈述**，
 * 不产出「主性格刚毅」「宜从事……」这样的断语。
 * 后者是那套占法的内容，但它没有可判定的规则 —— 与现代占星那一层同理
 * （见 `sky/dignities.ts` 开头）。全部产出照常过措辞守卫，由测试断言。
 */

import type { ZiweiChart, ZiweiPalace } from "./chart.js";
import type { StarPlacement } from "./stars.js";

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** 十四主星。空宫与否按它们算，辅星不计。 */
export const MAJOR_STAR_NAMES: readonly string[] = Object.freeze([
  "紫微", "天机", "太阳", "武曲", "天同", "廉贞",
  "天府", "太阴", "贪狼", "巨门", "天相", "天梁", "七杀", "破军",
]);

export interface Sanfang {
  /** 本宫。 */
  readonly self: number;
  /** 对宫，恒为本宫 + 6。 */
  readonly opposite: number;
  /** 三合的另两宫，恒为本宫 ± 4。 */
  readonly trine: readonly [number, number];
  /** 四宫合起来，依次为本、对、三合二宫。 */
  readonly all: readonly number[];
}

/**
 * 三方四正。
 *
 * 本宫、对宫（+6）、三合二宫（±4）。对命宫而言，三合的那两宫
 * 恰是**财帛**与**官禄** —— 那不是巧合，是十二宫逆行排布的直接后果：
 * 财帛在命宫逆四位，官禄在逆八位，而逆四与逆八正是 ±4。
 */
export function sanfangSizheng(index: number): Sanfang {
  const self = mod12(index);
  const opposite = mod12(index + 6);
  const trine: [number, number] = [mod12(index + 4), mod12(index + 8)];
  return { self, opposite, trine, all: Object.freeze([self, opposite, ...trine]) };
}

export interface PalaceReading {
  readonly palace: ZiweiPalace;
  /** 本宫的主星。空宫时为空数组。 */
  readonly majors: readonly StarPlacement[];
  /** 本宫无主星 —— 传统做法是借对宫的主星来看。 */
  readonly isEmpty: boolean;
  /** 空宫时借来的主星（来自对宫）。 */
  readonly borrowed: readonly StarPlacement[];
  /** 三方四正四宫的宫名与星。 */
  readonly sanfang: Sanfang;
  readonly sanfangStars: readonly {
    readonly palace: string;
    readonly branch: string;
    readonly role: "本宫" | "对宫" | "三合";
    readonly majors: readonly string[];
  }[];
  /** 这一条的来历。 */
  readonly why: string;
}

/** 一宫的读法：本宫、空宫借星、三方四正。 */
export function readPalace(chart: ZiweiChart, index: number): PalaceReading {
  const palace = chart.palaces[mod12(index)]!;
  const majorsIn = (i: number): readonly StarPlacement[] =>
    chart.palaces[mod12(i)]!.stars.filter((s) => MAJOR_STAR_NAMES.includes(s.name));
  const majors = majorsIn(index);
  const sf = sanfangSizheng(index);
  const isEmpty = majors.length === 0;
  const borrowed = isEmpty ? majorsIn(sf.opposite) : [];

  const role = (i: number): "本宫" | "对宫" | "三合" =>
    i === sf.self ? "本宫" : i === sf.opposite ? "对宫" : "三合";

  return {
    palace, majors, isEmpty, borrowed, sanfang: sf,
    sanfangStars: Object.freeze(sf.all.map((i) => ({
      palace: chart.palaces[i]!.name,
      branch: chart.palaces[i]!.branch,
      role: role(i),
      majors: Object.freeze(majorsIn(i).map((s) => s.name)),
    }))),
    why: isEmpty
      ? `${palace.name}无主星，传统做法是借对宫（${chart.palaces[sf.opposite]!.name}）`
        + `的主星来看：${borrowed.map((s) => s.name).join("、") || "对宫亦无主星"}`
      : `${palace.name}坐${majors.map((s) => s.name).join("、")}`,
  };
}

/**
 * 格局 —— 某几颗星凑在三方四正里，传统上另有名目。
 *
 * 本项目只收**由落位直接判定、且各家名目一致**的几种，
 * 不收需要另一张表或另一套条件的。
 */
export interface ZiweiGeju {
  readonly name: string;
  /** 这一格要的那几颗星。 */
  readonly stars: readonly string[];
  /** 在三方四正里实际见到的。 */
  readonly seen: readonly string[];
  readonly complete: boolean;
  readonly why: string;
}

const GEJU_DEFS: readonly { readonly name: string; readonly stars: readonly string[];
  readonly note: string }[] = Object.freeze([
  {
    name: "杀破狼", stars: ["七杀", "破军", "贪狼"],
    note: "这三星**恒互为三合**（各差四宫），故它们必在同一条三合线上 —— "
      + "命宫落在那条线上，三方四正就必然见齐三颗。这是排布的直接后果，不是巧合。",
  },
  {
    name: "机月同梁", stars: ["天机", "太阴", "天同", "天梁"],
    note: "这四星的相对位置随紫微落点而变，故不像杀破狼那样恒聚，见齐才算。",
  },
  {
    name: "紫府同宫", stars: ["紫微", "天府"],
    note: "紫微与天府关于寅申轴对称，只有落在轴上（寅或申）时才同宫。",
  },
]);

export function gejuOf(chart: ZiweiChart, index: number): readonly ZiweiGeju[] {
  const sf = sanfangSizheng(index);
  const inSanfang = new Set(
    sf.all.flatMap((i) => chart.palaces[i]!.stars.map((s) => s.name)));
  return Object.freeze(GEJU_DEFS.map((d) => {
    const seen = d.stars.filter((s) => inSanfang.has(s));
    return {
      name: d.name, stars: d.stars, seen: Object.freeze(seen),
      complete: seen.length === d.stars.length,
      why: d.note.replace(/\*\*/g, ""),
    };
  }).filter((g) => g.seen.length > 0));
}

export interface SihuaLanding {
  readonly kind: string;
  readonly star: string;
  /** 落在哪一宫。`null` 表示该星不在本实现收录之列。 */
  readonly palace: string | null;
  readonly branch: string | null;
  /** 该宫是否在命宫的三方四正内 —— 传统上那意味着它与命宫直接相关。 */
  readonly inMingSanfang: boolean;
}

/** 四化各落在哪一宫。四化不摆新星，它把已有的星所在的那一宫牵动起来。 */
export function sihuaLandings(chart: ZiweiChart): readonly SihuaLanding[] {
  const mingSf = new Set(sanfangSizheng(chart.layout.mingIndex).all);
  return Object.freeze(chart.sihua.map((h) => {
    const p = chart.palaces.find((x) => x.stars.some((s) => s.name === h.star));
    return {
      kind: h.kind, star: h.star,
      palace: p?.name ?? null, branch: p?.branch ?? null,
      inMingSanfang: p !== undefined && mingSf.has(p.index),
    };
  }));
}

export interface ZiweiReading {
  readonly ming: PalaceReading;
  readonly shen: PalaceReading;
  readonly geju: readonly ZiweiGeju[];
  readonly sihua: readonly SihuaLanding[];
  readonly notes: readonly string[];
}

/** 整张盘的解读 —— 命宫、身宫、格局、四化落宫。 */
export function readZiwei(chart: ZiweiChart): ZiweiReading {
  return {
    ming: readPalace(chart, chart.layout.mingIndex),
    shen: readPalace(chart, chart.layout.shenIndex),
    geju: gejuOf(chart, chart.layout.mingIndex),
    sihua: sihuaLandings(chart),
    notes: Object.freeze([
      "这里给的是盘面的结构：哪颗星在哪一宫、哪几宫同看、四化落在哪里。"
      + "每一条都指得回已经算好的落位，不另引一张表。",
      "紫微的读法从来不是一宫一宫单看，而是成组地看 —— "
      + "三方四正是本宫、对宫与三合的另两宫，四宫同看。",
      "⚠️ 本项目不收星曜的庙旺表（十四主星 × 十二宫 = 168 格）。"
      + "那一层凭记忆转录的风险比调候 120 格更大，而结构性检查对它几乎无能为力："
      + "一格记错看不出来，却会悄悄改变对某颗星的强弱判断。"
      + "这是一个真实的缺口，不是取舍 —— 收齐它需要一个底本，而本项目没有。",
      "本页不出断语。「命宫坐七杀」是事实陈述；"
      + "「主性格刚毅」「宜从事某行」是另一回事，那一层没有可判定的规则。",
    ]),
  };
}

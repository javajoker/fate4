/**
 * 应期规则清单。
 *
 * ## polarity: 0 是刻意保留的一档
 *
 * **「应事」不等于「吉」或「凶」。**驿马逢冲是「动」，动是好是坏取决于用忌；
 * 墓库冲开是「事发」，发的是财是祸取决于库中所藏。
 * 把所有事件二分为吉凶，是命理软件最常见的失真来源 —— 它会把一个中性的
 * 结构性判断包装成价值判断，而读者无从分辨。
 *
 * 每条规则的 `when` 返回 `true` 或一段**现场依据字符串**；返回字符串时，
 * 该字符串直接进入事件的 evidence，使每条触发都可回溯。
 */

import { FOUR_TOMBS } from "../ganzhi/tables.js";
import type { Branch, TenGod } from "../types/ganzhi.js";
import {
  adverseElements, opposingBranch, chongTargets, elementHomeBranches, eventHits,
  favorableElements, godWeight, samePillar, shenshaWith, tianKeDiChong,
} from "./helpers.js";
import type { YingqiRule } from "./types.js";

const YEAR_SCOPE = ["year"] as const;
const YEAR_LUCK = ["year", "luck"] as const;

export const YINGQI_RULES: readonly YingqiRule[] = Object.freeze([
  // ── 结构类 ──
  {
    id: "sui_yun_bing_lin", name: "岁运并临", scope: YEAR_SCOPE, priority: 90,
    polarity: 0, weight: 0.80, domains: ["career", "health", "kin"],
    narrativeTag: "岁运并临",
    when: (c) => samePillar(c.luck, c.annual)
      && `大运与流年干支同为 ${c.annual!.stem}${c.annual!.branch}`,
  },
  {
    id: "tian_ke_di_chong_day", name: "天克地冲日柱", scope: YEAR_SCOPE, priority: 95,
    polarity: -1, weight: 0.85, domains: ["health", "marriage", "career"],
    narrativeTag: "天克地冲",
    when: (c) => c.annual !== null && tianKeDiChong(c.annual, c.chart.day)
      && `流年 ${c.annual.stem}${c.annual.branch} 克冲日柱 ${c.chart.day.stem}${c.chart.day.branch}`,
  },
  {
    id: "tian_ke_di_chong_luck", name: "岁运天克地冲", scope: YEAR_SCOPE, priority: 85,
    polarity: -1, weight: 0.70, domains: ["career", "health"],
    narrativeTag: "岁运相战",
    when: (c) => c.annual !== null && c.luck !== null && tianKeDiChong(c.annual, c.luck)
      && `流年 ${c.annual.stem}${c.annual.branch} 与大运 ${c.luck.stem}${c.luck.branch} 天克地冲`,
  },
  {
    id: "fuyin_day", name: "伏吟日柱", scope: YEAR_SCOPE, priority: 70,
    polarity: 0, weight: 0.55, domains: ["health", "kin"],
    narrativeTag: "伏吟",
    when: (c) => samePillar(c.annual, c.chart.day) && "流年干支与日柱全同",
  },
  {
    id: "chong_ti_gang", name: "冲提纲", scope: YEAR_SCOPE, priority: 80,
    polarity: 0, weight: 0.65, domains: ["career", "kin"],
    narrativeTag: "冲动提纲",
    when: (c) => c.annual !== null && opposingBranch(c.annual.branch) === c.chart.month.branch
      && `流年 ${c.annual.branch} 冲月支 ${c.chart.month.branch}（提纲）`,
  },
  {
    id: "chong_year_branch", name: "冲年支", scope: YEAR_SCOPE, priority: 50,
    polarity: 0, weight: 0.45, domains: ["kin", "social"],
    narrativeTag: "动摇根基",
    when: (c) => c.annual !== null && opposingBranch(c.annual.branch) === c.chart.year.branch
      && `流年 ${c.annual.branch} 冲年支`,
  },
  {
    id: "chong_hour_branch", name: "冲时支", scope: YEAR_SCOPE, priority: 50,
    polarity: 0, weight: 0.45, domains: ["kin", "career"],
    narrativeTag: "动摇晚境",
    when: (c) => c.annual !== null && c.chart.hour !== null
      && opposingBranch(c.annual.branch) === c.chart.hour.branch
      && `流年 ${c.annual.branch} 冲时支`,
  },

  // ── 用忌类 ──
  {
    id: "yongshen_reinforced", name: "用神得助", scope: YEAR_LUCK, priority: 75,
    polarity: 1, weight: 0.70, domains: ["career", "wealth", "health"],
    narrativeTag: "用神得力",
    when: (c) => {
      const fav = favorableElements(c);
      const up = fav.filter((e) => c.shareDelta[e] > 0.03);
      return up.length > 0
        && `喜用之 ${up.join("、")} 占比上升 ${(Math.max(...up.map((e) => c.shareDelta[e])) * 100).toFixed(1)}%`;
    },
  },
  {
    id: "jishen_reinforced", name: "忌神得势", scope: YEAR_LUCK, priority: 75,
    polarity: -1, weight: 0.70, domains: ["career", "wealth", "health"],
    narrativeTag: "忌神转旺",
    when: (c) => {
      const adv = adverseElements(c);
      const up = adv.filter((e) => c.shareDelta[e] > 0.03);
      return up.length > 0
        && `忌仇之 ${up.join("、")} 占比上升 ${(Math.max(...up.map((e) => c.shareDelta[e])) * 100).toFixed(1)}%`;
    },
  },
  {
    id: "yongshen_chonged", name: "用神被冲", scope: YEAR_SCOPE, priority: 85,
    polarity: -1, weight: 0.75, domains: ["career", "health"],
    narrativeTag: "用神受制",
    when: (c) => {
      if (c.annual === null) return false;
      const y = c.natal.conclusions.yongshen.value.primary;
      const homes = elementHomeBranches(c, y);
      const hit = homes.find((b) => opposingBranch(c.annual!.branch) === b);
      return hit !== undefined && `流年 ${c.annual.branch} 冲用神${y}所居之 ${hit}`;
    },
  },
  {
    id: "jishen_restrained", name: "忌神受制", scope: YEAR_LUCK, priority: 70,
    polarity: 1, weight: 0.65, domains: ["career", "wealth"],
    narrativeTag: "忌神受制",
    when: (c) => {
      const adv = adverseElements(c);
      const down = adv.filter((e) => c.shareDelta[e] < -0.03);
      return down.length > 0 && `忌仇之 ${down.join("、")} 占比下降`;
    },
  },

  // ── 合局类 ──
  {
    id: "sanhe_formed_favorable", name: "三合成局助用", scope: YEAR_SCOPE, priority: 88,
    polarity: 1, weight: 0.80, domains: ["career", "wealth"],
    narrativeTag: "合局助用",
    when: (c) => {
      const e = eventHits(c.now.events, ["sanhe", "sanhui"], ["annual"]);
      if (e?.transformedTo === undefined) return false;
      return favorableElements(c).includes(e.transformedTo)
        && `流年引动三合，化神 ${e.transformedTo} 正是喜用`;
    },
  },
  {
    id: "sanhe_formed_adverse", name: "三合成局助忌", scope: YEAR_SCOPE, priority: 88,
    polarity: -1, weight: 0.80, domains: ["career", "wealth", "health"],
    narrativeTag: "合局助忌",
    when: (c) => {
      const e = eventHits(c.now.events, ["sanhe", "sanhui"], ["annual"]);
      if (e?.transformedTo === undefined) return false;
      return adverseElements(c).includes(e.transformedTo)
        && `流年引动三合，化神 ${e.transformedTo} 恰为忌仇`;
    },
  },
  {
    id: "liuhe_with_pillar", name: "流年六合本命", scope: YEAR_SCOPE, priority: 40,
    polarity: 0, weight: 0.40, domains: ["social", "marriage"],
    narrativeTag: "合而有情",
    when: (c) => {
      const e = eventHits(c.now.events, ["liuhe"], ["annual"]);
      return e !== undefined && `流年与本命成六合${e.outcome === "transformed" ? "并化成" : "（合而不化）"}`;
    },
  },

  // ── 墓库类 ──
  {
    id: "tomb_opened", name: "墓库冲开", scope: YEAR_SCOPE, priority: 82,
    polarity: 0, weight: 0.70, domains: ["wealth", "kin", "career"],
    narrativeTag: "刑冲开库",
    when: (c) => {
      const e = c.now.events.find((x) => x.kind === "tombOpen"
        && x.pillars.some((p) => (["year", "month", "day", "hour"] as string[]).includes(p)));
      return e !== undefined && `本命 ${e.branches?.join("") ?? ""} 库被冲开，库中之物得以显现`;
    },
  },
  {
    id: "daymaster_tombed", name: "日主入墓", scope: YEAR_SCOPE, priority: 78,
    polarity: -1, weight: 0.60, domains: ["health", "career"],
    narrativeTag: "日主入墓",
    when: (c) => {
      if (c.annual === null) return false;
      if (!(FOUR_TOMBS as readonly Branch[]).includes(c.annual.branch)) return false;
      const weak = ["WEAK", "VERY_WEAK"].includes(c.natal.conclusions.strength.value);
      return weak && `流年 ${c.annual.branch} 为墓地，而日主本弱`;
    },
  },

  // ── 刃杀类 ──
  {
    id: "yangren_chonged", name: "羊刃逢冲", scope: YEAR_SCOPE, priority: 80,
    polarity: -1, weight: 0.70, domains: ["health", "legal"],
    narrativeTag: "刃动",
    when: (c) => shenshaWith(c, "羊刃", "逢冲") && "羊刃所居之支被冲",
  },
  {
    id: "sha_unrestrained", name: "七杀无制", scope: YEAR_LUCK, priority: 80,
    polarity: -1, weight: 0.75, domains: ["career", "health", "legal"],
    narrativeTag: "杀重无制",
    when: (c) => {
      const sha = godWeight(c, "七杀");
      const zhi = godWeight(c, "食神") + godWeight(c, "正印") + godWeight(c, "偏印");
      return sha > 0 && sha > zhi * 2
        && `七杀 ${sha.toFixed(1)} 远超制化之神 ${zhi.toFixed(1)}`;
    },
  },
  {
    id: "sha_restrained", name: "食印制化", scope: YEAR_LUCK, priority: 75,
    polarity: 1, weight: 0.70, domains: ["career"],
    narrativeTag: "杀得制化",
    // 原判据是 `zhi > sha` —— 一条**常驻的结构事实**，多数盘面恒真，实测触发率 75%。
    // 应期规则要的是「今年变了什么」，不是「这张盘本来是什么样」。
    // 改判制化比相对本命的**改善幅度**。
    when: (c) => {
      const sha = godWeight(c, "七杀");
      if (sha <= 0) return false;
      const zhi = godWeight(c, "食神") + godWeight(c, "正印") + godWeight(c, "偏印");
      const n = c.natal.conclusions.tenGods;
      const shaN = n["七杀"];
      const zhiN = n["食神"] + n["正印"] + n["偏印"];
      if (shaN <= 0 || zhiN <= 0) return false;
      const ratio = zhi / sha; const ratioN = zhiN / shaN;
      return ratio > ratioN * 1.2 && zhi > sha
        && `制化比自 ${ratioN.toFixed(2)} 升至 ${ratio.toFixed(2)}，七杀 ${sha.toFixed(1)} 得以驾驭`;
    },
  },

  // ── 神煞类：全部 polarity 0 —— 动是好是坏取决于用忌 ──
  {
    id: "yima_chonged", name: "驿马逢冲", scope: YEAR_SCOPE, priority: 60,
    polarity: 0, weight: 0.55, domains: ["relocation", "career"],
    narrativeTag: "马动",
    when: (c) => shenshaWith(c, "驿马", "逢冲") && "驿马逢冲，主迁动出行",
  },
  {
    id: "yima_bound", name: "驿马逢合", scope: YEAR_SCOPE, priority: 45,
    polarity: 0, weight: 0.35, domains: ["relocation"],
    narrativeTag: "马被绊",
    when: (c) => shenshaWith(c, "驿马", "逢合") && "驿马被合住，欲动不动",
  },
  {
    id: "taohua_he", name: "桃花逢合", scope: YEAR_SCOPE, priority: 55,
    polarity: 0, weight: 0.50, domains: ["marriage", "social"],
    narrativeTag: "桃花动",
    when: (c) => shenshaWith(c, "桃花", "逢合") && "桃花逢合，主感情人际之事",
  },
  {
    id: "taohua_chong", name: "桃花逢冲", scope: YEAR_SCOPE, priority: 50,
    polarity: 0, weight: 0.45, domains: ["marriage"],
    narrativeTag: "桃花冲",
    when: (c) => shenshaWith(c, "桃花", "逢冲") && "桃花逢冲，感情有波动",
  },
  {
    id: "huagai_void", name: "华盖落空", scope: YEAR_LUCK, priority: 40,
    polarity: 0, weight: 0.35, domains: ["social", "study"],
    narrativeTag: "华盖空",
    when: (c) => shenshaWith(c, "华盖", "落空亡") && "华盖落空亡，主孤高玄远",
  },
  {
    id: "tianyi_activated", name: "贵人引动", scope: YEAR_SCOPE, priority: 50,
    polarity: 1, weight: 0.45, domains: ["career", "social"],
    narrativeTag: "得贵人",
    // 原判据含 `tone === "strengthened"` —— 而 strengthened 正是吉神的**常态**，
    // 于是只要盘里有天乙贵人且未被冲空，此条即成立，实测触发率 90%。
    // 贵人是本命的静态特征，要成为应期，须由今年送来的干支引动：
    // 流年/大运之支即贵人位，或与贵人位相合。
    // 且只认主起例（日干起）。开了 alsoComputeYearBase 之后，天乙的落点由 2 支变 4 支，
    // 触发率随之翻倍 —— 展示时两套都留，作应期扳机时只用主起例。
    when: (c) => c.now.shensha.some(
      (h) => h.name === "天乙贵人" && h.basis === "day"
        && (h.landsOn.pillar === "annual" || h.landsOn.pillar === "luck"))
      && "天乙贵人得力",
  },
  {
    id: "kongwang_filled", name: "空亡填实", scope: YEAR_SCOPE, priority: 45,
    polarity: 0, weight: 0.40, domains: ["career", "kin"],
    narrativeTag: "填实",
    when: (c) => c.now.shensha.some(
      (h) => h.name === "空亡" && (h.modifiers.includes("逢冲") || h.modifiers.includes("逢合")))
      && "空亡之支被冲合填实",
  },

  // ── 六亲类 ──
  {
    id: "spouse_palace_chonged", name: "配偶宫被冲", scope: YEAR_SCOPE, priority: 80,
    polarity: 0, weight: 0.70, domains: ["marriage"],
    narrativeTag: "配偶宫动",
    when: (c) => chongTargets(c, c.annual).includes("day") && "流年冲日支（配偶宫）",
  },
  {
    id: "spouse_palace_he", name: "配偶宫被合", scope: YEAR_SCOPE, priority: 60,
    polarity: 0, weight: 0.55, domains: ["marriage"],
    narrativeTag: "配偶宫合",
    when: (c) => {
      const e = eventHits(c.now.events, ["liuhe", "sanhe", "sanhui", "banhe"], ["day"]);
      return e !== undefined && e.pillars.includes("annual") && "流年与日支相合";
    },
  },
  {
    id: "spouse_star_afflicted", name: "配偶星受克", scope: YEAR_LUCK, priority: 70,
    polarity: -1, weight: 0.60, domains: ["marriage"],
    narrativeTag: "配偶星伤",
    when: (c) => {
      const k = c.natal.conclusions.kin.find((x) => x.kin === "spouse");
      if (k === undefined) return false;
      const now = c.now.conclusions.kin.find((x) => x.kin === "spouse")!;
      return k.starWeight > 0 && now.starWeight < k.starWeight * 0.8
        && `配偶星 ${k.starGod} 由 ${k.starWeight.toFixed(1)} 降至 ${now.starWeight.toFixed(1)}`;
    },
  },
  {
    id: "children_palace_moved", name: "子女宫引动", scope: YEAR_SCOPE, priority: 50,
    polarity: 0, weight: 0.45, domains: ["kin"],
    narrativeTag: "子女宫动",
    when: (c) => chongTargets(c, c.annual).includes("hour") && "流年冲时支（子女宫）",
  },
  {
    id: "parent_star_afflicted", name: "父母星受损", scope: YEAR_LUCK, priority: 55,
    polarity: -1, weight: 0.45, domains: ["kin"],
    narrativeTag: "亲星受损",
    when: (c) => {
      for (const kin of ["father", "mother"] as const) {
        const a = c.natal.conclusions.kin.find((x) => x.kin === kin);
        const b = c.now.conclusions.kin.find((x) => x.kin === kin);
        if (a === undefined || b === undefined || a.starWeight === 0) continue;
        if (b.starWeight < a.starWeight * 0.75) {
          return `${a.label}星 ${a.starGod} 显著转弱`;
        }
      }
      return false;
    },
  },

  // ── 格局类 ──
  {
    id: "xiangshen_damaged", name: "相神被伤", scope: YEAR_LUCK, priority: 92,
    polarity: -1, weight: 0.85, domains: ["career"],
    narrativeTag: "破格",
    // 按**组内权重之和**判，不按「任一成员转旺」。
    // 后者会让候选多的一方更容易触发：相神常有三个（食神、伤官、比肩），
    // 败格之神常只有一两个，于是「成格」的触发率天然高于「破格」——
    // 那是清单长度的产物，不是这张盘的性质。实测曾为 72% 对 40%。
    when: (c) => {
      const g = c.natal.conclusions.geju.value;
      if (g.breakers.length === 0) return false;
      const sum = (gs: readonly TenGod[], v: Readonly<Record<TenGod, number>>) =>
        gs.reduce((a, b) => a + v[b], 0);
      const now = sum(g.breakers, c.now.conclusions.tenGods);
      const nat = sum(g.breakers, c.natal.conclusions.tenGods);
      return nat > 0 && now > nat * 1.3
        && `${g.name}的败格之神合计自 ${nat.toFixed(1)} 升至 ${now.toFixed(1)}`;
    },
  },
  {
    id: "pattern_restored", name: "相神得力", scope: YEAR_LUCK, priority: 88,
    polarity: 1, weight: 0.75, domains: ["career"],
    narrativeTag: "成格",
    when: (c) => {
      const g = c.natal.conclusions.geju.value;
      if (g.xiangshen.length === 0) return false;
      const sum = (gs: readonly TenGod[], v: Readonly<Record<TenGod, number>>) =>
        gs.reduce((a, b) => a + v[b], 0);
      const now = sum(g.xiangshen, c.now.conclusions.tenGods);
      const nat = sum(g.xiangshen, c.natal.conclusions.tenGods);
      return nat > 0 && now > nat * 1.3
        && `${g.name}的相神合计自 ${nat.toFixed(1)} 升至 ${now.toFixed(1)}`;
    },
  },
]);

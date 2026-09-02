/**
 * 三传 —— 九宗门。
 *
 * ## 九宗门是一条**有序的阶梯**，不是九个并列的选项
 *
 * 前一门取不出，才轮到后一门。故实现走阶梯并记下**是在哪一门发用的**（课体）——
 * 「元首课」与「昴星课」得出的三传，可信程度本就不同，
 * 报告须说明它走到了第几门。
 *
 * ```
 * 伏吟 / 返吟 / 八专 / 别责     ← 先看课式是否特殊
 * 贼克（下贼上 > 上克下）        ← 常法
 *   多者 → 比用（取与日干同阴阳者）
 *     仍多 → 涉害（取涉害深者，深浅相等取孟仲季）
 * 四课无克 → 遥克（蒿矢 > 弹射）
 * 无遥克   → 昴星
 * ```
 *
 * ## 中末传是机械的
 *
 * `中传 = 天盘(初传)`、`末传 = 天盘(中传)` —— 唯伏吟、八专、别责另有其法。
 * 难的只有发用（取初传）这一步。
 *
 * ## ⚠️ 分歧之处
 *
 * 别责与八专的取法各家不一，尤其是中末传。此处按通行本实现并标出课体；
 * 遇到这两课时置信度下调，且在报告里写明「此课取法各家不一」。
 * 与《穷通宝鉴》调候表同样的处理：不装作没有分歧。
 */

import type { Branch } from "../types/ganzhi.js";
import { branchAt, branchElement, branchIndex, controls, mod, polarityOf } from "../ganzhi/algebra.js";
import { JI, MENG, XING, YIMA, ZHONG } from "./tables.js";
import { groundOf, upperOf, type Ke, type LiurenPlate } from "./plate.js";

export type KeTi =
  | "元首" | "重审" | "知一" | "涉害" | "蒿矢" | "弹射"
  | "昴星" | "别责" | "八专" | "伏吟" | "返吟";

export interface Sanchuan {
  readonly chu: Branch;
  readonly zhong: Branch;
  readonly mo: Branch;
  /** 在九宗门的哪一门发用。 */
  readonly keti: KeTi;
  /** 逐步的推导 —— 走到这一门是因为前面各门都取不出。 */
  readonly derivation: readonly string[];
  /** 该课体的取法是否各家不一。 */
  readonly disputed: boolean;
}

const isYang = (b: Branch) => branchIndex(b) % 2 === 0;
const clash = (b: Branch) => branchAt(branchIndex(b) + 6);

/** 四课中「下贼上」的：下神克上神。 */
const zeiOf = (ke: readonly Ke[]) =>
  ke.filter((k) => controls(branchElement(k.lower), branchElement(k.upper)));
/** 四课中「上克下」的。 */
const keOf = (ke: readonly Ke[]) =>
  ke.filter((k) => controls(branchElement(k.upper), branchElement(k.lower)));

/**
 * 涉害深浅 —— 上神自其天盘位回到本家，途中经过地盘几重克。
 *
 * 「涉害」二字即取此义：一路趟过多少克。经得多者为深，取深者发用。
 */
function shehaiDepth(p: LiurenPlate, upper: Branch): number {
  const from = branchIndex(groundOf(p, upper));
  const home = branchIndex(upper);
  let depth = 0;
  for (let i = 1; i <= mod(home - from, 12); i++) {
    const passing = branchAt(from + i);
    if (controls(branchElement(passing), branchElement(upper))) depth++;
  }
  return depth;
}

/** 深浅相等时的最后一道取舍：孟 > 仲 > 季。 */
const rank = (b: Branch): number =>
  MENG.includes(b) ? 0 : ZHONG.includes(b) ? 1 : JI.includes(b) ? 2 : 3;

function pickAmong(
  p: LiurenPlate, cands: readonly Ke[], dayYang: boolean, steps: string[],
): { chu: Branch; keti: KeTi } {
  if (cands.length === 1) {
    return { chu: cands[0]!.upper, keti: "元首" };
  }
  // ── 比用：取与日干阴阳相同者 ──
  const same = cands.filter((k) => isYang(k.upper) === dayYang);
  steps.push(`克者不止一个（${cands.map((k) => k.upper).join("、")}），`
    + `比用取与日干同${dayYang ? "阳" : "阴"}者：${same.map((k) => k.upper).join("、") || "无"}`);
  if (same.length === 1) return { chu: same[0]!.upper, keti: "知一" };

  // ── 涉害：取涉害深者 ──
  const pool = same.length > 1 ? same : cands;
  const depths = pool.map((k) => ({ k, d: shehaiDepth(p, k.upper) }));
  const max = Math.max(...depths.map((x) => x.d));
  const deepest = depths.filter((x) => x.d === max);
  steps.push(`比用不能定，涉害计深浅：`
    + depths.map((x) => `${x.k.upper} 涉 ${x.d} 重`).join("、"));
  if (deepest.length === 1) return { chu: deepest[0]!.k.upper, keti: "涉害" };

  const byRank = [...deepest].sort((a, b) => rank(a.k.upper) - rank(b.k.upper));
  steps.push(`涉害深浅相等，取孟仲季之先者：${byRank[0]!.k.upper}`);
  return { chu: byRank[0]!.k.upper, keti: "涉害" };
}

export function sanchuan(p: LiurenPlate): Sanchuan {
  const steps: string[] = [];
  const dayStem = p.pillars.day.stem;
  const dayYang = polarityOf(dayStem) === "阳";
  const up = (b: Branch) => upperOf(p, b);
  const ganUpper = p.ke[0]!.upper;
  const zhiUpper = p.ke[2]!.upper;

  const zei = zeiOf(p.ke);
  const ke = keOf(p.ke);
  const hasKe = zei.length > 0 || ke.length > 0;

  // ── 先辨课式 ──
  const isFuyin = p.yuejiang.branch === p.zhanshi;
  const isFanyin = branchIndex(p.yuejiang.branch) === mod(branchIndex(p.zhanshi) + 6, 12);
  const isBazhuan = p.jigong === p.pillars.day.branch;
  // 四课不全：四课中只出现三组不同的（上,下）
  const distinct = new Set(p.ke.map((k) => `${k.lower}${k.upper}`)).size;

  if (isFuyin) {
    steps.push("月将与占时同支，天地盘重合 —— 伏吟课");
    if (hasKe) {
      const { chu, keti } = pickAmong(p, zei.length > 0 ? zei : ke, dayYang, steps);
      void keti;
      const zhong = XING[chu]!;
      const mo = XING[zhong]!;
      return finish(chu, zhong === chu ? clash(chu) : zhong, mo === zhong ? clash(zhong) : mo,
        "伏吟", steps, true);
    }
    steps.push(`四课无克，${dayYang ? "阳日取干上神（自任）" : "阴日取支上神（自信）"}`);
    const chu = dayYang ? ganUpper : zhiUpper;
    const zhong0 = XING[chu]!;
    const zhong = zhong0 === chu ? zhiUpper : zhong0;
    const mo0 = XING[zhong]!;
    return finish(chu, zhong, mo0 === zhong ? clash(zhong) : mo0, "伏吟", steps, true);
  }

  if (isFanyin && !hasKe) {
    steps.push("月将与占时相冲，天地盘全对冲，且四课无克 —— 返吟无依课，取驿马发用");
    const chu = YIMA[p.pillars.day.branch]!;
    return finish(chu, up(chu), up(up(chu)), "返吟", steps, false);
  }

  if (isBazhuan && !hasKe) {
    steps.push("日干寄宫与日支同位 —— 八专课；四课无克，"
      + (dayYang ? "阳日自第一课上神顺数三位" : "阴日自第四课上神逆数三位"));
    const from = dayYang ? p.ke[0]!.upper : p.ke[3]!.upper;
    const chu = branchAt(branchIndex(from) + (dayYang ? 2 : -2));
    return finish(chu, ganUpper, ganUpper, "八专", steps, true);
  }

  if (distinct === 3 && !hasKe) {
    steps.push("四课不全（只得三课）—— 别责课；⚠️ 此课取法各家不一，本实现按通行本");
    const chu = dayYang
      ? up(branchAt(branchIndex(p.jigong) + 5))   // 阳日取干合之上神
      : branchAt(branchIndex(p.pillars.day.branch) + 4); // 阴日取支三合前一位
    return finish(chu, ganUpper, ganUpper, "别责", steps, true);
  }

  // ── 贼克 ──
  if (zei.length > 0) {
    steps.push(`四课有下贼上：${zei.map((k) => `${k.upper}/${k.lower}`).join("、")}`);
    const { chu, keti } = pickAmong(p, zei, dayYang, steps);
    return finish(chu, up(chu), up(up(chu)),
      keti === "元首" ? "重审" : keti, steps, false);
  }
  if (ke.length > 0) {
    steps.push(`四课无下贼上，有上克下：${ke.map((k) => `${k.upper}/${k.lower}`).join("、")}`);
    const { chu, keti } = pickAmong(p, ke, dayYang, steps);
    return finish(chu, up(chu), up(up(chu)), keti, steps, false);
  }

  // ── 遥克 ──
  const stemEl = branchElement(p.jigong);
  const uppers = p.ke.map((k) => k.upper);
  const haoshi = uppers.filter((b) => controls(branchElement(b), stemEl));
  const tanshe = uppers.filter((b) => controls(stemEl, branchElement(b)));
  if (haoshi.length > 0) {
    steps.push(`四课无克，取遥克 —— 上神克日，蒿矢课：${haoshi.join("、")}`);
    const chu = haoshi.length === 1 ? haoshi[0]!
      : pickAmong(p, haoshi.map((b) => ({ lower: p.jigong, upper: b })), dayYang, steps).chu;
    return finish(chu, up(chu), up(up(chu)), "蒿矢", steps, false);
  }
  if (tanshe.length > 0) {
    steps.push(`四课无克、无上神克日，取日克上神 —— 弹射课：${tanshe.join("、")}`);
    const chu = tanshe.length === 1 ? tanshe[0]!
      : pickAmong(p, tanshe.map((b) => ({ lower: p.jigong, upper: b })), dayYang, steps).chu;
    return finish(chu, up(chu), up(up(chu)), "弹射", steps, false);
  }

  // ── 昴星 ──
  steps.push(`四课无克亦无遥克 —— 昴星课，`
    + (dayYang ? "阳日取地盘酉上之神（虎视）" : "阴日取天盘酉所临之地盘神（冬蛇掩目）"));
  const chu = dayYang ? up("酉") : groundOf(p, "酉");
  return dayYang
    ? finish(chu, zhiUpper, ganUpper, "昴星", steps, false)
    : finish(chu, ganUpper, zhiUpper, "昴星", steps, false);
}

function finish(
  chu: Branch, zhong: Branch, mo: Branch, keti: KeTi,
  steps: string[], disputed: boolean,
): Sanchuan {
  steps.push(`三传：初 ${chu} → 中 ${zhong} → 末 ${mo}（${keti}课）`);
  return { chu, zhong, mo, keti, derivation: Object.freeze(steps), disputed };
}

/** 供测试与叙述：全部课体。 */
export const KE_TI: readonly KeTi[] = Object.freeze([
  "元首", "重审", "知一", "涉害", "蒿矢", "弹射", "昴星", "别责", "八专", "伏吟", "返吟",
]);

export const KE_TI_NOTE: Readonly<Record<KeTi, string>> = Object.freeze({
  元首: "四课无下贼上，独一上克下者发用 —— 常法之正",
  重审: "四课有下贼上，取之发用 —— 下犯上，故曰重审",
  知一: "克者不止一个，取与日干同阴阳者 —— 比用",
  涉害: "比用仍不能定，取涉害深者 —— 一路趟过的克更多",
  蒿矢: "四课无克，上神遥克日干",
  弹射: "四课无克，日干遥克上神",
  昴星: "无克亦无遥克，取酉位发用",
  别责: "四课不全，只得三课。⚠️ 取法各家不一",
  八专: "日干寄宫与日支同位。⚠️ 取法各家不一",
  伏吟: "月将与占时同支，天地盘重合 —— 事在原地",
  返吟: "月将与占时相冲，天地盘全对冲 —— 事情反覆",
});

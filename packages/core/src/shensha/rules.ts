/**
 * 神煞的推导式起例。
 *
 * 三合局类的八个神煞，全部是**该局化神阳干的十二长生位**：
 *
 *   将星 = 帝旺   华盖 = 墓     桃花 = 沐浴   亡神 = 临官
 *   劫煞 = 绝     六厄 = 死     驿马 = 冲长生  灾煞 = 冲帝旺
 *
 * 以申子辰水局（壬）验：壬长生申、沐浴酉、临官亥、帝旺子、死卯、墓辰、绝巳。
 * 于是 将星子、华盖辰、桃花酉、亡神亥、劫煞巳、六厄卯、驿马寅（冲申）、灾煞午（冲子）——
 * 与传世口诀逐一吻合。
 *
 * 推导而非查表的价值：八张表压成一条规律，错一处即被自洽性测试逮住。
 */

import { DIRECTIONALS, TRINITIES } from "../ganzhi/tables.js";
import { branchAt, branchIndex, elementOf, mod, stepBranch } from "../ganzhi/algebra.js";
import { branchOfPhase, luOf, type ChangshengOptions } from "../ganzhi/changsheng.js";
import type { Branch, Element, Stem } from "../types/ganzhi.js";

/** 某地支所属的三合局。 */
export function trinityOf(branch: Branch) {
  const t = TRINITIES.find((x) => x.sheng === branch || x.wang === branch || x.mu === branch);
  if (t === undefined) throw new RangeError(`${branch} 不属于任何三合局`);
  return t;
}

/** 局化神的阳干 —— 八个三合类神煞的推导基准。 */
const YANG_OF: Readonly<Record<Element, Stem>> = Object.freeze({
  木: "甲", 火: "丙", 土: "戊", 金: "庚", 水: "壬",
});

const chong = (b: Branch): Branch => stepBranch(b, 6);

export interface TrinityShensha {
  readonly 将星: Branch; readonly 华盖: Branch; readonly 桃花: Branch;
  readonly 亡神: Branch; readonly 劫煞: Branch; readonly 六厄: Branch;
  readonly 驿马: Branch; readonly 灾煞: Branch;
}

/** 由年支（或日支）推出八个三合类神煞。 */
export function trinityShensha(base: Branch, opts: ChangshengOptions = {}): TrinityShensha {
  const t = trinityOf(base);
  const yang = YANG_OF[t.element];
  const at = (phase: Parameters<typeof branchOfPhase>[1]) => branchOfPhase(yang, phase, opts);
  return {
    将星: at("帝旺"), 华盖: at("墓"), 桃花: at("沐浴"),
    亡神: at("临官"), 劫煞: at("绝"), 六厄: at("死"),
    驿马: chong(at("长生")), 灾煞: chong(at("帝旺")),
  };
}

/** 金舆 = 禄前二辰。 */
export function jinyuOf(stem: Stem, opts: ChangshengOptions = {}): Branch {
  return stepBranch(luOf(stem, opts), 2);
}

/** 学堂 = 同五行阳干的长生位。 */
export function xuetangOf(stem: Stem, opts: ChangshengOptions = {}): Branch {
  return branchOfPhase(YANG_OF[elementOf(stem)], "长生", opts);
}

/** 天医 = 月支前一位。 */
export function tianyiMedOf(monthBranch: Branch): Branch {
  return stepBranch(monthBranch, -1);
}

/** 月德贵人 = 该月三合局化神的阳干。寅午戌→丙、申子辰→壬、亥卯未→甲、巳酉丑→庚。 */
export function yuedeOf(monthBranch: Branch): Stem {
  return YANG_OF[trinityOf(monthBranch).element];
}

/** 孤辰 = 三会方的后一位；寡宿 = 三会方的前一位。 */
export function guchenGuasuOf(yearBranch: Branch): { gu: Branch; gua: Branch } {
  const d = DIRECTIONALS.find((x) => (x.branches as readonly Branch[]).includes(yearBranch));
  if (d === undefined) throw new RangeError(`${yearBranch} 不属于任何三会方`);
  return {
    gu: stepBranch(d.branches[2], 1),
    gua: stepBranch(d.branches[0], -1),
  };
}

/** 红鸾：年支起卯逆行。天喜为红鸾之冲。 */
export function hongluanOf(yearBranch: Branch): Branch {
  return branchAt(mod(3 - branchIndex(yearBranch), 12));
}
export function tianxiOf(yearBranch: Branch): Branch {
  return chong(hongluanOf(yearBranch));
}

export { chong as chongOf };

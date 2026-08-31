/**
 * 司令分野（人元司事）—— 由出生时刻距节的天数定当权藏干。
 *
 * 首段司令常是上月本气的余绪，未必是本支所藏。十二支中有五支如此
 * （子卯午酉亥），其中**亥是唯一连同五行回退也无解的一支**：
 * 亥月前 7 日戊土司令，而亥只藏壬甲，无土可着。
 * 详见 docs/01-foundations.md §10。
 */

import { SILING, HIDDEN_STEMS } from "../ganzhi/tables.js";
import { elementOf } from "../ganzhi/algebra.js";
import type { Branch } from "../types/ganzhi.js";
import type { SilingInfo } from "./types.js";

export function silingOf(monthBranch: Branch, daysIntoJie: number): SilingInfo {
  const segments = SILING[monthBranch];

  let acc = 0;
  let segment: 0 | 1 | 2 = 0;
  for (let i = 0; i < segments.length; i++) {
    acc += segments[i]!.days;
    if (daysIntoJie < acc) { segment = i as 0 | 1 | 2; break; }
    segment = Math.min(i, segments.length - 1) as 0 | 1 | 2;
  }
  // 距节天数超出该月总日数（约 30 日）时归入末段 —— 只在极端浮点边界发生
  if (daysIntoJie >= acc) segment = (segments.length - 1) as 0 | 1 | 2;

  const stem = segments[segment]!.stem;
  const hidden = HIDDEN_STEMS[monthBranch];

  if (hidden.includes(stem)) {
    return { stem, segment, daysIntoJie, resolvedTo: stem, resolution: "exact" };
  }
  const sameElement = hidden.find((h) => elementOf(h) === elementOf(stem));
  if (sameElement !== undefined) {
    return { stem, segment, daysIntoJie, resolvedTo: sameElement, resolution: "sameElement" };
  }
  // 唯亥月前 7 日至此
  return { stem, segment, daysIntoJie, resolvedTo: null, resolution: "unresolvable" };
}

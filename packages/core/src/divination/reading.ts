/**
 * 四体系合参 —— 四柱流日 ∥ 六爻 ∥ 六壬 ∥ 奇门。
 *
 * ## ⚠️ 四家一致，仍然不是印证
 *
 * 这一点在两家时就写过（`claim.ts`），到四家时更要说：
 * 四个体系**都是同一时刻干支的确定性函数**。没有抽样，就没有独立性；
 * 没有独立性，一致就不是证据的叠加。
 *
 * 更要紧的是**别把「四家有三家判顺」当成 75% 的把握**。那是把计数当概率，
 * 与统计节点那一层禁的是同一件事。故本层：
 *
 * - 报**谁判什么**（「六爻、奇门判顺；六壬判逆」），不报比数
 * - 不给「综合取向」，不给分数，不排「更可信的一家」
 * - 分歧照实并列
 *
 * ## 四柱那一侧是可选的
 *
 * 六爻、六壬、奇门只要时刻；四柱流日要生辰。故不给命盘时是三家合参 ——
 * 少一家就少一家，不用别的东西顶上。
 */

import type { Params } from "../params/types.js";
import type { BaseChart } from "../chart/baseChart.js";
import type { NatalChart } from "../chart/types.js";
import { toBaseChart } from "../chart/baseChart.js";
import { toJulianDay } from "../astro/julian.js";
import { castMomentOf, type MomentInput } from "../liuyao/moment.js";
import { cast } from "../liuyao/cast.js";
import { dress } from "../liuyao/dress.js";
import { pickYongshen } from "../liuyao/yongshen.js";
import { judge, type Judgement } from "../liuyao/judge.js";
import { liuyaoClaims } from "../liuyao/claims.js";
import { buildPlate, sanchuan, type LiurenPlate, type Sanchuan } from "../liuren/index.js";
import { liurenClaims } from "../liuren/claims.js";
import { buildQimen, type QimenChart } from "../qimen/chart.js";
import { qimenClaims } from "../qimen/claims.js";
import { dayView } from "../temporal/views.js";
import type { DayView } from "../temporal/types.js";
import { baziDayClaims } from "./bazi.js";
import { crossref, summarizeCrossref, type AxisComparison, type StructuralClaim } from "./claim.js";

export interface CrossReadingInput extends MomentInput {
  /** 六爻的占事。默认「近期运势」，以世爻为用。 */
  readonly topicId?: string;
}

export interface CrossReading {
  readonly at: MomentInput;
  readonly bazi: DayView | null;
  readonly liuyao: { readonly judgement: Judgement };
  readonly liuren: { readonly plate: LiurenPlate; readonly sanchuan: Sanchuan };
  readonly qimen: QimenChart;
  readonly claims: readonly StructuralClaim[];
  readonly comparisons: readonly AxisComparison[];
  readonly summary: string;
  /** 参与合参的体系数。不给命盘时为三。 */
  readonly systems: number;
}

export function crossReading(
  input: CrossReadingInput,
  params: Params,
  chart?: BaseChart | NatalChart,
): CrossReading {
  const moment = castMomentOf(input);
  const jdUT = toJulianDay({
    year: input.year, month: input.month, day: input.day,
    hour: input.hour, minute: input.minute, second: input.second ?? 0,
  }) - offsetHoursOf(input) / 24;

  // ── 六爻 ──
  const p = params.liuyao.castMethod === "time"
    ? params
    : { ...params, liuyao: { ...params.liuyao, castMethod: "time" as const } };
  const gua = dress(cast(moment, { method: "time" }, p.liuyao), p.liuyao);
  const ys = pickYongshen(gua, input.topicId ?? "self.fortune");
  const j = judge(gua, ys, p.liuyao);

  // ── 六壬 ──
  const plate = buildPlate({ pillars: moment.pillars, jdUT });
  const sc = sanchuan(plate);

  // ── 奇门 ──
  const qm = buildQimen({ pillars: moment.pillars, jdUT });

  // ── 四柱流日（可选） ──
  const base = chart === undefined ? null : toBaseChart(chart, params);
  const dv = base === null ? null
    : dayView(base, input.year, input.month, input.day, base.params);

  const claims: StructuralClaim[] = [
    ...(base === null || dv === null ? [] : baziDayClaims(base, dv)),
    ...liuyaoClaims(gua, j, params),
    ...liurenClaims(plate, sc),
    ...qimenClaims(qm),
  ];
  const comparisons = crossref(claims);

  return {
    at: input, bazi: dv,
    liuyao: { judgement: j },
    liuren: { plate, sanchuan: sc },
    qimen: qm,
    claims: Object.freeze(claims),
    comparisons: Object.freeze(comparisons),
    summary: summarizeCrossref(comparisons),
    systems: base === null ? 3 : 4,
  };
}

/**
 * 时区偏移，小时。
 *
 * 只为把民用钟表时换成 UT 以定月将与节气 —— 六壬与奇门都要它。
 * 不走 `Intl` 的完整时区库，因为 `castMomentOf` 已经算过一次真太阳时；
 * 此处只需粗到小时即可（月将与节气的边界以日计，差几分钟不改结论）。
 */
function offsetHoursOf(input: MomentInput): number {
  const d = new Date(Date.UTC(input.year, input.month - 1, input.day, 12));
  const s = d.toLocaleString("en-US", { timeZone: input.timeZone, timeZoneName: "longOffset" });
  const m = /GMT([+-]\d{2}):(\d{2})/.exec(s);
  if (m === null) return 0;
  return Number(m[1]) + Math.sign(Number(m[1])) * Number(m[2]) / 60;
}

/**
 * L0 排盘总装。
 *
 * 纯函数：同一输入永远同一输出，无 I/O、无全局状态、不读系统时钟。
 * 此层无任何命理判断，只有历法与天文换算 —— 其正确性可被外部万年历
 * 100% 验证，故必须先做到零误差，再谈上层。
 */

import { toTrueSolarTime } from "../time/trueSolarTime.js";
import { fromJulianDay } from "../astro/julian.js";
import { DEFAULT_SOLAR_PROVIDER } from "../astro/defaults.js";
import { TOLERANCE_GUARANTEED_UNTIL_YEAR } from "../astro/deltaT.js";
import {
  dayAndHourPillarOf, enclosingTermOf, monthPillarOf, yearPillarOf,
} from "./pillars.js";
import { taiyuanOf } from "./taiyuan.js";
import { mingGongOf, monthBranchByZhongqi } from "./mingGong.js";
import { silingOf } from "./siling.js";
import { computeLuck } from "./qiyun.js";
import type { BirthInput, ChartOptions, NatalChart } from "./types.js";

const DEFAULTS = {
  ziHourRule: "lateZiNextDay",
  mingGongBoundary: "jie",
  trueSolarTime: true,
  equationOfTime: true,
  qiyunMode: "continuous",
  luckPillarCount: 12,
} as const;

export function buildChart(input: BirthInput, options: ChartOptions = {}): NatalChart {
  const opt = { ...DEFAULTS, ...options };
  const warnings: string[] = [];

  // ── 时间归一 ────────────────────────────────────────────
  const tst = toTrueSolarTime({
    wall: {
      year: input.year, month: input.month, day: input.day,
      hour: input.hour, minute: input.minute, second: input.second ?? 0,
    },
    timeZone: input.timeZone,
    longitude: input.longitude,
    applyLongitude: opt.trueSolarTime,
    applyEquationOfTime: opt.trueSolarTime && opt.equationOfTime,
    provider: DEFAULT_SOLAR_PROVIDER,
  });

  const birthJdUT = tst.jdCivil;                 // 绝对时刻 —— 年月柱与节气比较用
  const trueSolarJd = tst.jdTrueSolar;           // 本地日影时 —— 时支与日界用
  const trueSolarCalendar = fromJulianDay(trueSolarJd);

  if (tst.resolution === "ambiguous") {
    warnings.push(
      "出生钟表时落在夏令时回拨的重叠小时内，对应两个真实时刻，相差一小时。" +
      "两种取法给出的时柱可能不同，报告须并列说明。",
    );
  }
  if (tst.resolution === "nonexistent") {
    warnings.push(
      "出生钟表时落在夏令时前拨的空缺小时内，该时刻在当地并不存在。" +
      "多半是记录有误，请核对原始出生记录。",
    );
  }
  if (tst.corrections.isDaylightSaving) {
    warnings.push(`出生时当地行用夏令时，已扣除 ${tst.corrections.tzOffsetMinutes - 480 === 60 ? "一小时" : "相应时差"}。`);
  }

  // ── 年柱、月柱（依绝对时刻与节气）────────────────────────
  const jie = enclosingTermOf(birthJdUT, "节");
  const monthBranch = jie.prev.def.opensMonthBranch;
  if (monthBranch === null) throw new Error(`${jie.prev.def.name} 未定义所开月支`);

  const { pillar: yearPillar } = yearPillarOf(birthJdUT);
  const monthPillar = monthPillarOf(monthBranch as never, yearPillar.stem);

  // ── 日柱、时柱（依真太阳时）──────────────────────────────
  const dh = dayAndHourPillarOf(trueSolarCalendar, opt.ziHourRule);
  if (dh.dayAdvanced) {
    warnings.push("出生于晚子时（真太阳时 23 时后），按「晚子换日」规则日柱已进位。");
  }
  if (input.unknownHour) {
    warnings.push("时辰未知，时柱与命宫缺省。依赖时柱的判定一律留白，不作猜测。");
  }

  // ── 胎元、命宫 ───────────────────────────────────────────
  const taiyuan = taiyuanOf(monthPillar);

  let mingGong: NatalChart["mingGong"] = null;
  if (!input.unknownHour) {
    const branchForMingGong = opt.mingGongBoundary === "zhongqi"
      ? monthBranchByZhongqi(enclosingTermOf(birthJdUT, "气").prev.def.longitude)
      : monthBranch as never;
    mingGong = mingGongOf(branchForMingGong, dh.hour.branch, yearPillar.stem);
  }

  // ── 司令分野 ─────────────────────────────────────────────
  const siling = silingOf(monthBranch as never, birthJdUT - jie.prev.jdUT);
  if (siling.resolution === "unresolvable") {
    warnings.push(
      `${monthBranch}月${siling.stem}土司令，而该支藏干中无同五行者，司令加成无处可着。` +
      "此为亥月前七日独有的情形，非实现缺陷。",
    );
  }

  // ── 起运与大运 ───────────────────────────────────────────
  const luck = computeLuck({
    birthJdUT,
    monthPillar,
    yearStem: yearPillar.stem,
    gender: input.gender,
    prevJie: { name: jie.prev.def.name, jdUT: jie.prev.jdUT },
    nextJie: { name: jie.next.def.name, jdUT: jie.next.jdUT },
    pillarCount: opt.luckPillarCount,
  });

  // ── 精度告知 ─────────────────────────────────────────────
  if (!DEFAULT_SOLAR_PROVIDER.meetsSolarTermTolerance) {
    warnings.push("当前黄经级数不满足节气 60 秒容差，节气边界附近的盘面不可信。");
  }
  if (input.year > TOLERANCE_GUARANTEED_UNTIL_YEAR) {
    warnings.push(
      `${TOLERANCE_GUARANTEED_UNTIL_YEAR} 年以后 ΔT 为外推值，其不确定度已超过 60 秒容差，` +
      "节气时刻仅供参考。",
    );
  }

  return {
    input,
    birthJdUT,
    trueSolarJd,
    trueSolarCalendar,
    corrections: {
      tzOffsetMinutes: tst.corrections.tzOffsetMinutes,
      isDaylightSaving: tst.corrections.isDaylightSaving,
      longitudeMinutes: tst.corrections.longitudeMinutes,
      equationOfTimeMinutes: tst.corrections.equationOfTimeMinutes,
      totalMinutes: tst.corrections.totalMinutes,
      netVsCivilMinutes: tst.corrections.totalMinutes - tst.corrections.tzOffsetMinutes,
      resolution: tst.resolution,
    },
    year: yearPillar,
    month: monthPillar,
    day: dh.day,
    hour: input.unknownHour ? null : dh.hour,
    taiyuan,
    mingGong,
    enclosingJie: {
      prevName: jie.prev.def.name, prevJd: jie.prev.jdUT,
      nextName: jie.next.def.name, nextJd: jie.next.jdUT,
    },
    siling,
    luck,
    rulesUsed: {
      ziHourRule: opt.ziHourRule,
      mingGongBoundary: opt.mingGongBoundary,
      trueSolarTime: opt.trueSolarTime,
      equationOfTime: opt.equationOfTime,
      qiyunMode: opt.qiyunMode,
      solarProviderId: DEFAULT_SOLAR_PROVIDER.id,
      solarProviderMeetsTolerance: DEFAULT_SOLAR_PROVIDER.meetsSolarTermTolerance,
    },
    warnings,
  };
}

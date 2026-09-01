/**
 * 命盘文件。
 *
 * 存的是**输入**（BirthInput + 参数覆盖），不是算出来的 NatalChart。
 *
 * 理由：盘面是输入的纯函数，重算是毫秒级的；而序列化一棵含大量浮点的结果树，
 * 既要处理精度往返，又会让「文件里的盘」与「当前引擎算出的盘」可能不一致 ——
 * 换了参数或修了缺陷之后，旧文件会悄悄带着旧结论继续用下去。
 * 存输入则永远重算，`paramsHash` 与 `engineVersion` 如实反映此刻的引擎。
 */

import {
  buildChart, chartOptionsOf, loadParams, paramsHash,
  type BirthInput, type NatalChart, type Params, type PartialParams,
} from "@fate/core";
import { UsageError } from "./io.js";

export interface ChartFile {
  readonly kind: "fate-chart";
  readonly version: 1;
  readonly input: BirthInput;
  readonly overrides: PartialParams;
  /** 仅供人读与核对，不参与重算。 */
  readonly summary: {
    readonly pillars: string;
    readonly taiyuan: string;
    readonly mingGong: string | null;
    readonly paramsHash: string;
  };
}

export function makeChartFile(input: BirthInput, overrides: PartialParams): ChartFile {
  const params = loadParams(overrides);
  const chart = buildChart(input, chartOptionsOf(params));
  const p = (x: { stem: string; branch: string } | null) => (x === null ? "—" : `${x.stem}${x.branch}`);
  return {
    kind: "fate-chart", version: 1, input, overrides,
    summary: {
      pillars: [chart.year, chart.month, chart.day, chart.hour].map(p).join(" "),
      taiyuan: p(chart.taiyuan),
      mingGong: chart.mingGong === null ? null : p(chart.mingGong),
      paramsHash: paramsHash(params),
    },
  };
}

export function readChartFile(text: string, where: string): ChartFile {
  let doc: unknown;
  try { doc = JSON.parse(text); } catch {
    throw new UsageError(`${where} 不是合法的 JSON`);
  }
  const d = doc as Partial<ChartFile>;
  if (d.kind !== "fate-chart" || d.input === undefined) {
    throw new UsageError(`${where} 不是命盘文件（缺少 kind: "fate-chart"）`);
  }
  return { kind: "fate-chart", version: 1, input: d.input, overrides: d.overrides ?? {}, summary: d.summary! };
}

/** 由命盘文件重建盘面与参数。两者永远同源，不会各走各的。 */
export function rebuild(f: ChartFile): { chart: NatalChart; params: Params } {
  const params = loadParams(f.overrides);
  return { chart: buildChart(f.input, chartOptionsOf(params)), params };
}

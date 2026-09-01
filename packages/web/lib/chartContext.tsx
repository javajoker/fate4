"use client";

/**
 * 命盘上下文。
 *
 * `NatalChart` 由此处算一次放进 Context，各页按需自行调 `evaluate` ——
 * 单次求解是毫秒级的，重算比缓存便宜，也免掉一整套失效逻辑。
 */

import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import {
  buildBaseChart, buildChart, chartOptionsOf, loadParams,
  type BaseChart, type BirthInput, type NatalChart, type Params, type PartialParams,
} from "@fate/core";
import { decodeShare, getChart, type ChartRecord } from "./storage";

interface Ctx {
  readonly record: ChartRecord | null;
  readonly chart: NatalChart | null;
  /**
   * 基础盘 —— **整个命盘上下文里算一次**。
   *
   * 各页拿它去调 buildReport / yearView / monthView，基准不再逐页重解。
   * 换年份、换页签都不会触发重算；只有换命盘或改参数才会。
   */
  readonly base: BaseChart | null;
  readonly params: Params;
  readonly overrides: PartialParams;
  readonly setOverrides: (o: PartialParams) => void;
  readonly error: string | null;
  readonly loading: boolean;
}

const ChartCtx = createContext<Ctx | null>(null);

/** 当前片段里的命盘标识（`#<uuid>` 或 `#s=<编码>`）。 */
export function useFragment(): string {
  const [frag, setFrag] = useState("");
  useEffect(() => {
    const read = () => setFrag(location.hash.slice(1));
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  return frag;
}

export function ChartProvider({ children }: { children: ReactNode }) {
  const frag = useFragment();
  const [record, setRecord] = useState<ChartRecord | null>(null);
  const [overrides, setOverrides] = useState<PartialParams>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (frag === "") { setLoading(false); return; }
    setLoading(true);
    const shared = decodeShare(frag);
    if (shared !== null) {
      setRecord({
        id: "shared", label: "分享的命盘",
        input: shared.input, overrides: shared.overrides, createdAt: 0,
      });
      setOverrides(shared.overrides);
      setLoading(false);
      return;
    }
    getChart(frag).then((r) => {
      if (!alive) return;
      if (r === undefined) setError("本机没有这张命盘。它只存在于生成它的那台设备上。");
      else { setRecord(r); setOverrides(r.overrides); }
      setLoading(false);
    }).catch((e: unknown) => { if (alive) { setError(String(e)); setLoading(false); } });
    return () => { alive = false; };
  }, [frag]);

  const params = useMemo(() => loadParams(overrides), [overrides]);

  const chart = useMemo(() => {
    if (record === null) return null;
    try {
      // 手工对映迟早漂移：加一个 L0 开关而忘了改这里，
      // 症状是「面板里改了没反应」，极难定位。故由内核统一导出。
      return buildChart(record.input, chartOptionsOf(params));
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [record, params]);

  // 基础盘随 (命盘, 参数) 记忆。参数面板改一个系数即失效重算，符合预期。
  const base = useMemo(
    () => (chart === null ? null : buildBaseChart(chart, params)),
    [chart, params],
  );

  return (
    <ChartCtx.Provider
      value={{ record, chart, base, params, overrides, setOverrides, error, loading }}
    >
      {children}
    </ChartCtx.Provider>
  );
}

export function useChart(): Ctx {
  const c = useContext(ChartCtx);
  if (c === null) throw new Error("useChart 必须在 ChartProvider 之内使用");
  return c;
}

export type { BirthInput };

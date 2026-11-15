"use client";

import { DEFAULT_MONTH_RATIO, MONTH_RATIOS } from "./store";

/**
 * 「每个月算多少分量」的切换。
 *
 * ## 为什么要摆出来
 *
 * 这个比例没有古籍依据，是本项目的一个选择（默认一年的一半）。它会改变「起伏」
 * 那一栏：月份算分量时，起伏细到月，段数也多出不少；设成 0 就回到传统的说法 ——
 * 月份只起引动作用，不算分量。一个改变你看到什么、而且没有定论的选择，
 * 不该藏在看不见的地方。
 */
export function MonthRatioPicker(
  { value, onChange, pending }: { value: number; onChange: (r: number) => void; pending: boolean },
) {
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  return (
    <div className="m-card">
      <h3>每个月算多少分量</h3>
      <div className="m-chips" style={{ marginTop: 10, marginBottom: 8 }}>
        {MONTH_RATIOS.map((r) => (
          <button key={r} className={`m-chip${r === value ? " on" : ""}`} onClick={() => onChange(r)}>
            {r === 0 ? "不算" : `一年的 ${pct(r)}`}
            {r === DEFAULT_MONTH_RATIO ? "（默认）" : ""}
          </button>
        ))}
      </div>
      {pending && <p className="dim" role="status">正在重新计算…</p>}
      <p className="dim">
        这套方法里，一年有一年的分量，每个月也可以算进一份 —— 默认是一年的一半。
        选「不算」，就回到传统的说法：月份只起引动作用，不算分量。
      </p>
      <p className="dim" style={{ marginTop: 8 }}>
        它影响「起伏」那一栏：月份算分量时，起伏能细到哪个月，段数也会多出不少；
        不算时只细到哪一年。<strong>这个比例没有古籍依据</strong>，是可以换的选择，
        不是定论。
      </p>
    </div>
  );
}

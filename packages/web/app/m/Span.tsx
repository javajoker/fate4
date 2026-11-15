"use client";

import { SPANS, SPAN_LABEL, type SpanYears } from "@fate/core";

/**
 * 时间跨度切换。
 *
 * ## 它改变什么，不改变什么
 *
 * 跨度只决定**看多远**：人生轨迹列几步大运、起伏扫多少年。
 * 它不改变任何一年的数 —— σ 的基准窗固定为起运后 60 年，跨度更长时，
 * 窗外的年份用同一把尺子量，同一年的结论在任何跨度下相同。
 *
 * ## 为什么要把「可能看不出变化」写出来
 *
 * 普通读者档本来就不给未到来的时段。切到更长的跨度，多出来的几乎都是将来 ——
 * 于是在这一档上往往什么都没变。不写明的话，用户会以为开关坏了。
 */
export function SpanPicker(
  { value, onChange, pending }:
  { value: SpanYears; onChange: (s: SpanYears) => void; pending: boolean },
) {
  return (
    <div className="m-card">
      <h3>看多远</h3>
      <div className="m-chips" style={{ marginTop: 10, marginBottom: 8 }}>
        {SPANS.map((s) => (
          <button key={s} className={`m-chip${s === value ? " on" : ""}`} onClick={() => onChange(s)}>
            {SPAN_LABEL[s]}
          </button>
        ))}
      </div>
      {pending && <p className="dim" role="status">正在按 {value} 年重新计算…</p>}
      <p className="dim">
        自起运起算，一步大运十年。它只决定<strong>看多远</strong>，不改变任何一年的数：
        常态的尺子固定取起运后 60 年，更远的年份用同一把尺子量。
      </p>
      <p className="dim" style={{ marginTop: 8 }}>
        超过一百年的部分已经超出任何人的寿数，反映的是这套方法本身的结构，不是一个人。
        普通读者档本来就不给未到来的时段，所以在这一档上切长往往看不出变化；
        「学习中」与「命理师」档才会多出更远的时段。180 年要多算几秒。
      </p>
    </div>
  );
}

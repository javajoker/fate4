"use client";

import { useState } from "react";
import type { PlainCard } from "@fate/core";

/**
 * 一张人话卡片。
 *
 * 「看依据」不是可选的装饰，是这个应用的诚实性所系：
 * 人话是概括，读者必须随时能看到被概括的是什么。故按钮恒在，
 * 且展开后显示的是**报告原文**，不是重新润色过的版本。
 */
export function Card({ card }: { card: PlainCard }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="m-card">
      <h3>{card.title}</h3>
      <p>{card.body}</p>
      <div className="m-why">
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "收起依据" : `看依据（${card.evidence.length} 条）`}
        </button>
        {open && (
          card.evidence.length === 0
            ? <p className="dim" style={{ marginTop: 9 }}>这一条没有可展开的推导。</p>
            : <ul>{card.evidence.map((e, i) => <li key={i}>{e.text}</li>)}</ul>
        )}
      </div>
    </div>
  );
}

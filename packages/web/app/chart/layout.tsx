"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChartProvider, useChart, useFragment } from "../../lib/chartContext";
import { withFrag } from "../../lib/format";

const TABS: readonly [string, string][] = [
  ["/chart", "盘面 · 力量"],
  ["/chart/strength", "旺衰 · 取用"],
  ["/chart/kin", "宫位 · 六亲"],
  ["/chart/luck", "大运"],
  ["/chart/year", "流年"],
  ["/chart/calendar", "月历 · 今日"],
  ["/chart/report", "完整报告"],
  ["/chart/params", "参数校准"],
];

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const frag = useFragment();
  const { record, error, loading } = useChart();

  return (
    <>
      <header className="top">
        <div className="inner">
          <a className="brand" href="/">四柱推演</a>
          <span className="dim" style={{ fontSize: 13 }}>{record?.label ?? ""}</span>
          <nav>
            {TABS.map(([href, name]) => (
              <a key={href} href={withFrag(href, frag)} className={path === href ? "active" : undefined}>
                {name}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <div className="shell">
        {loading && <p className="sub">计算中…</p>}
        {error !== null && <div className="card"><p>{error}</p><p><a href="/">回到排盘</a></p></div>}
        {!loading && error === null && record === null && (
          <div className="card">
            <p>未指定命盘。</p><p><a href="/">回到排盘</a></p>
          </div>
        )}
        {!loading && error === null && record !== null && children}
      </div>
    </>
  );
}

export default function ChartLayout({ children }: { children: ReactNode }) {
  return <ChartProvider><Shell>{children}</Shell></ChartProvider>;
}

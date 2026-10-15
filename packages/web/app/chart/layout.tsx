"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AUDIENCE_LABEL, AUDIENCE_NOTE, AUDIENCES } from "@fate/core";
import { ChartProvider, useChart, useFragment } from "../../lib/chartContext";
import { withFrag } from "../../lib/format";

const TABS: readonly [string, string][] = [
  ["/chart", "盘面 · 力量"],
  ["/chart/persona", "性格 · 偏好"],
  ["/chart/strength", "旺衰 · 取用"],
  ["/chart/kin", "宫位 · 六亲"],
  ["/chart/luck", "大运"],
  ["/chart/year", "流年"],
  ["/chart/curves", "生命曲线"],
  ["/chart/nodes", "统计节点"],
  ["/chart/calendar", "月历 · 今日"],
  ["/chart/daily", "当日运程"],
  ["/chart/report", "完整报告"],
  ["/chart/params", "参数校准"],
];

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const frag = useFragment();
  const { record, error, loading, audience, setAudience } = useChart();

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
        {/*
          读者档摆在顶上而不是藏进「参数校准」。
          它会改变你看到什么 —— 一个改变你看到什么的开关，不该让人不知道它存在。
          术语版默认就按「学习中」给：进到这里的人已经在看干支与权重了。
        */}
        {!loading && error === null && record !== null && (
          <div className="audbar">
            <span className="dim">以什么身份看</span>
            {AUDIENCES.map((a) => (
              <button key={a} className={a === audience ? "" : "ghost"}
                onClick={() => setAudience(a)}>
                {AUDIENCE_LABEL[a]}
              </button>
            ))}
            <span className="dim">{AUDIENCE_NOTE[audience]}</span>
          </div>
        )}
        {!loading && error === null && record !== null && audience === "lay" && (
          <p className="sub">
            这几页是术语版，写给在学这套东西的人。只想看结论的话，
            <a href="/m">移动版</a>把同一份推演换成了平常话。
          </p>
        )}
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

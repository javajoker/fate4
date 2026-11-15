"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AUDIENCE_LABEL, AUDIENCE_NOTE, AUDIENCES, SPANS, SPAN_LABEL } from "@fate/core";
import { ChartProvider, useChart, useFragment } from "../../lib/chartContext";
import { withFrag } from "../../lib/format";

/**
 * 顶栏分两组，而且**必须分**。
 *
 * 前十二页读的是同一张八字；「星盘」读的是同一个时刻的星空 ——
 * 它不是四柱的又一个视图，是另一套占法。混在一排里，
 * 读者会把它当成四柱的一个分支，而那正好说反了。
 *
 * 四柱在前、占多数、不加标记；另一套在后、单独一条、带组名。
 * 主次由位置与数量定，不靠加粗。
 */
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

/**
 * 同一个出生时刻的另外两套占法。
 *
 * 两者要的输入正相反，摆在一起读者自己就看得出来：
 * 星盘要经纬度（真天体，算星历），紫微连地点都不要（虚星，纯算术）。
 */
const OTHER_TABS: readonly [string, string][] = [
  ["/chart/sky", "星盘 · 七政四余与西洋古典"],
  ["/chart/ziwei", "紫微斗数"],
];

/**
 * 跟着时间跨度走的页面。其余页（盘面、性格、旺衰……）读的是本命，与跨度无关，
 * 不摆这个开关 —— 一个与当前页无关的开关，只会让人以为它也管这一页。
 */
const SPAN_PAGES: ReadonlySet<string> = new Set([
  "/chart/luck", "/chart/year", "/chart/curves", "/chart/nodes", "/chart/report",
]);

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const frag = useFragment();
  const { record, error, loading, audience, setAudience, span, setSpan } = useChart();

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
            <span className="navgroup">另一套占法</span>
            {OTHER_TABS.map(([href, name]) => (
              <a key={href} href={withFrag(href, frag)}
                className={path === href ? "active other" : "other"}>
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
        {!loading && error === null && record !== null && SPAN_PAGES.has(path) && (
          <div className="audbar">
            <span className="dim">时间跨度（自起运起算）</span>
            {SPANS.map((s) => (
              <button key={s} className={s === span ? "" : "ghost"} onClick={() => setSpan(s)}>
                {SPAN_LABEL[s]}
              </button>
            ))}
            <span className="dim">
              大运 {span / 10} 柱。统计节点与曲线界线的 σ 取<b>这一整段</b>：
              换跨度会重算，同一年的 z 分数随之改变；逐年的数值不变。
            </span>
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

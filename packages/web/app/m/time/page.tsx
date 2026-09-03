"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildChart, buildReport, dailyOutlook, plainCards, plainYaociCards, dailyNarrative,
  AXIS_DIRECTIONAL, favorPlain, SYSTEM_LABEL, type BirthInput,
} from "@fate/core";
import { Card } from "../Card";
import { loadBirth } from "../store";
import { Disclaimer } from "../page";

/**
 * 「时间」页 —— 今天、本月、今年，以及按年的提示。
 *
 * 「按年可能需要注意的事件」这一项刻意**不列事件**：一套按出生时刻推演的模型
 * 给不出「会发生什么」。给得出的是「哪一年结构上的张力最大」——
 * 那是一句关于结构的话，不是一句关于未来的话。
 * 这个差别在人话里最容易糊掉，故正文里明写。
 */
export default function TimePage() {
  const [birth, setBirth] = useState<BirthInput | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"今年" | "本月" | "今天" | "按年">("今天");

  useEffect(() => { setBirth(loadBirth()); setReady(true); }, []);

  const data = useMemo(() => {
    if (birth === null) return null;
    const d = new Date();
    const now = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    try {
      const chart = buildChart(birth);
      const r = buildReport(chart, { includeNodes: true, now });
      return { plain: plainCards(r), report: r, daily: dailyOutlook(chart, now) };
    } catch { return null; }
  }, [birth]);

  if (!ready) return <p className="m-lede">载入中…</p>;
  if (birth === null) {
    return (
      <>
        <h1 className="m-h1">时间</h1>
        <p className="m-lede">先在「我」那一页填一次出生信息，这一页才有内容。</p>
        <a className="m-btn" href="/m"
          style={{ display: "block", textAlign: "center", textDecoration: "none" }}>去填写</a>
      </>
    );
  }
  if (data === null) return <p className="m-lede">算不出来。</p>;

  const cards = data.plain.cards.filter((c) => c.section === tab);

  return (
    <>
      <h1 className="m-h1">时间</h1>
      <div className="m-chips">
        {(["今天", "本月", "今年", "按年"] as const).map((t) => (
          <button key={t} className={`m-chip${t === tab ? " on" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "按年" ? <ByYear report={data.report} /> : (
        <>
          {cards.map((c) => <Card key={c.id} card={c} />)}
          {tab === "今天" && <TodayCross daily={data.daily} />}
          {tab === "今天" && <TodayYaoci daily={data.daily} />}
        </>
      )}

      <Disclaimer plain={data.plain.disclaimer} technical={data.plain.disclaimerTechnical} />
    </>
  );
}

/** 按年的提示 —— 说的是哪一年张力大，不是那一年会发生什么。 */
function ByYear({ report }: { report: ReturnType<typeof buildReport> }) {
  const [open, setOpen] = useState<number | null>(null);
  const rows = report.years.curve.slice(0, 16);
  return (
    <>
      <p className="m-note">
        这里列的是每一年的结构与你本命契合到什么程度，不是那一年会发生什么 ——
        一套按出生时刻推演的模型给不出后者。契合度低也不等于不好：
        它衡量的是张力大小，而张力大的年份在传统语境里同样对应变动与转折。
      </p>
      {rows.map((y) => (
        <div className="m-card" key={y.year}>
          <h3>{y.year} 年</h3>
          <p>{favorPlain(y.favorIndex)}。</p>
          <div className="m-why">
            <button onClick={() => setOpen(open === y.year ? null : y.year)}>
              {open === y.year ? "收起依据" : "看依据"}
            </button>
            {open === y.year && (
              <ul>
                <li>该年干支 {y.pillar.stem}{y.pillar.branch}。</li>
                <li>
                  顺逆指数 {y.favorIndex.toFixed(1)} ——
                  衡量当年五行结构与本命喜用的契合度，不是运气好坏。
                </li>
                <li>单轮留存 {y.vitality.toFixed(3)}。</li>
              </ul>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * 今天这一格说的是什么事 —— 爻辞一路。
 *
 * 与 `TodayCross` 分开：那一块比的是两套推法的**取向**，这一块给的是**所指**。
 * 混在一起，读者会以为爻辞也在给今天打分。
 */
function TodayYaoci({ daily }: { daily: ReturnType<typeof dailyOutlook> }) {
  const cards = plainYaociCards(daily.liuyao.yaoci, dailyNarrative(daily), "d");
  return (
    <>
      <div className="m-sec">今天说的是什么事</div>
      {cards.map((c) => <Card key={c.id} card={c} />)}
    </>
  );
}

/** 今天的第二套说法 —— 两侧并列，不合并。 */
function TodayCross({ daily }: { daily: ReturnType<typeof dailyOutlook> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="m-card">
      <h3>还有另一套说法</h3>
      <p>
        今天这一天，除了按出生信息推的那一套，还有一套只看今天这个时刻的推法。
        两套各说各的，不合并成一个结论 —— 它们本就是同一天干支的两种算法，
        说到一处去不算互相印证，说不到一处也不代表哪一边错了。
      </p>
      <div className="m-why">
        <button onClick={() => setOpen(!open)}>{open ? "收起" : "看两套各说了什么"}</button>
        {open && (
          <ul>
            {daily.comparisons.map((c) => (
              <li key={c.axis}>
                <b>{c.axis}</b>（{c.kind}）
                {c.claims.map((x) => (
                  <div key={x.system} style={{ marginTop: 3 }}>
                    {SYSTEM_LABEL[x.system]}
                    {AXIS_DIRECTIONAL[c.axis]
                      ? `：${x.polarity === "中性" ? "未表态" : x.polarity}　` : "："}
                    {x.evidence}
                  </div>
                ))}
                <div style={{ marginTop: 3, opacity: 0.75 }}>{c.note}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

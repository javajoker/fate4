"use client";

import { useMemo, useState } from "react";
import {
  crossReading, loadParams, AXIS_DIRECTIONAL, SYSTEM_LABEL,
  TOPICS, TOPIC_CATEGORIES, type TopicCategory,
} from "@fate/core";

/**
 * 四家合参页 —— 与问事页一样不挂在 /chart 之下。
 *
 * 六爻、六壬、奇门都只要时刻；四柱流日才要生辰。故此页默认三家合参，
 * 命盘是可选的加项。做成命盘的标签页会让人以为三家也读了八字。
 */

const CITIES: readonly (readonly [string, string, number])[] = [
  ["上海", "Asia/Shanghai", 121.47], ["北京", "Asia/Shanghai", 116.41],
  ["广州", "Asia/Shanghai", 113.26], ["台北", "Asia/Taipei", 121.56],
  ["香港", "Asia/Hong_Kong", 114.17], ["新加坡", "Asia/Singapore", 103.82],
];

const KIND_TONE: Readonly<Record<string, string>> = {
  一致: "各家方向相同", 分歧: "各家方向相反", 单侧表态: "仅一家给出方向",
  无从比对: "各家皆无话可说", 并列: "此轴不判方向", 单侧: "仅一家有判据",
};

export default function CrossPage() {
  const params = useMemo(() => loadParams({}), []);
  const [place, setPlace] = useState(0);
  const [cat, setCat] = useState<TopicCategory>("自身");
  const [topicId, setTopicId] = useState("self.fortune");
  const [tick, setTick] = useState(0);

  const topics = TOPICS.filter((t) => t.category === cat && t.use.kind !== "caller");

  const r = useMemo(() => {
    const [, tz, lon] = CITIES[place]!;
    const n = new Date();
    try {
      return crossReading({
        year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate(),
        hour: n.getHours(), minute: n.getMinutes(),
        timeZone: tz, longitude: lon, topicId,
      }, params);
    } catch { return null; }
  }, [place, topicId, params, tick]);

  return (
    <>
      <header className="top"><div className="inner">
        <a className="brand" href="/">四柱推演</a>
        <nav>
          <a href="/">排盘</a><a href="/ask">问事</a>
          <a href="/cross" className="active">合参</a>
          <a href="/book">书</a>
        </nav>
      </div></header>
      <div className="shell">
        <h1>三家合参</h1>
        <p className="sub">
          六爻、六壬、奇门各起各的，逐轴并列陈述，不作合并。三者都是同一时刻干支的
          确定性函数 —— 方向一致不构成互相印证，方向相反也不代表哪一家有误。
          此处不给出综合取向，也不排「哪一家更准」。
        </p>

        <div className="card">
          <div className="row">
            <select value={place} onChange={(e) => setPlace(Number(e.target.value))}>
              {CITIES.map((c, i) => <option key={c[0]} value={i}>{c[0]}</option>)}
            </select>
            <select value={cat} onChange={(e) => {
              const c = e.target.value as TopicCategory;
              setCat(c);
              const first = TOPICS.find((t) => t.category === c && t.use.kind !== "caller");
              if (first !== undefined) setTopicId(first.id);
            }}>
              {TOPIC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button onClick={() => setTick(tick + 1)}>此刻起盘</button>
          </div>
          <p className="dim">
            占事只决定六爻取哪一爻为用神 —— 六壬与奇门不分占事，它们的断言不随之改变。
          </p>
        </div>

        {r === null ? <p className="dim">起盘失败。</p> : (
          <>
            <div className="card">
              <h3>各家所起</h3>
              <table>
                <tbody>
                  <tr>
                    <td>六爻</td>
                    <td>
                      {r.liuyao.judgement.gua.ben.name}
                      {r.liuyao.judgement.gua.bian === null
                        ? "（六爻皆静）" : ` → ${r.liuyao.judgement.gua.bian.name}`}
                    </td>
                  </tr>
                  <tr>
                    <td>六壬</td>
                    <td>
                      {r.liuren.sanchuan.keti}课，三传 {r.liuren.sanchuan.chu} →{" "}
                      {r.liuren.sanchuan.zhong} → {r.liuren.sanchuan.mo}
                    </td>
                  </tr>
                  <tr>
                    <td>奇门</td>
                    <td>
                      {r.qimen.term}{r.qimen.yuan}，{r.qimen.yin ? "阴" : "阳"}遁 {r.qimen.ju} 局；
                      值符{r.qimen.zhifu}、值使{r.qimen.zhishi}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {r.comparisons.map((c) => (
              <div className="card" key={c.axis}>
                <h3>{c.axis}　<span className="dim">{c.kind} · {KIND_TONE[c.kind]}</span></h3>
                <table>
                  <thead><tr><th>体系</th><th>取向</th><th>依据</th></tr></thead>
                  <tbody>
                    {c.claims.map((x) => (
                      <tr key={x.system}>
                        <td>{SYSTEM_LABEL[x.system]}</td>
                        <td>{AXIS_DIRECTIONAL[c.axis]
                          ? (x.polarity === "中性" ? "未表态" : x.polarity) : "—"}</td>
                        <td>{x.evidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="dim">{c.note}</p>
              </div>
            ))}

            <div className="card">
              <h3>小结</h3>
              <p>逐轴对照：{r.summary}</p>
              <p className="dim">
                此处不给出「总体如何」的合成判断，也不给比数 ——
                「多数判顺」不是某成把握，那是把计数当概率。
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}

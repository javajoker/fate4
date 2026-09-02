"use client";

import { useMemo, useState } from "react";
import {
  buildQuestionReport, cast, castMomentOf, dress, judge, loadParams,
  pickYongshen, plainQuestion, TOPICS, TOPIC_CATEGORIES,
  type Liuqin, type TopicCategory,
} from "@fate/core";
import { Card } from "../Card";
import { Disclaimer } from "../page";
import { CITIES } from "../store";

/**
 * 「问事」页 —— 就一件具体的事起一卦。
 *
 * 三件必须让用户知道的事，都写在页面上而不是折叠起来：
 *
 * 1. **不需要出生信息** —— 卦属于起卦的那个时刻，不属于问卜的人。
 * 2. **同一时段内所有人问所有事，得到同一个卦** —— 区分不同的事靠取不同的位置。
 * 3. **同一个问题当天只起一次** —— 允许重问等于允许一直摇到满意为止。
 */

const JOURNAL = "fate.m.journal.v1";
type Entry = { key: string; at: string; recordedAt: string };

async function fingerprint(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text.normalize("NFKC").trim());
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
const readJournal = (): Entry[] => {
  try { const r = localStorage.getItem(JOURNAL); return r === null ? [] : JSON.parse(r) as Entry[]; }
  catch { return []; }
};

export default function AskPage() {
  const params = useMemo(() => loadParams({}), []);
  const [cat, setCat] = useState<TopicCategory>("财");
  const [topicId, setTopicId] = useState("wealth.seek");
  const [relation, setRelation] = useState<Liuqin>("父母");
  const [question, setQuestion] = useState("");
  const [place, setPlace] = useState(0);
  const [out, setOut] = useState<{
    report: ReturnType<typeof buildQuestionReport>; replayed: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [why, setWhy] = useState(false);

  const topics = TOPICS.filter((t) => t.category === cat);
  const topic = TOPICS.find((t) => t.id === topicId) ?? topics[0]!;

  const ask = async () => {
    setErr(null); setWhy(false);
    try {
      const [, tz, lon] = CITIES[place]!;
      const n = new Date();
      const at = {
        year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate(),
        hour: n.getHours(), minute: n.getMinutes(), timeZone: tz, longitude: lon,
      };
      const moment = castMomentOf(at);
      const qh = question.trim() === "" ? null : await fingerprint(question);
      const key = qh === null ? null
        : `${moment.pillars.day.stem}${moment.pillars.day.branch}|${topic.id}|${qh}`;
      const journal = readJournal();
      const prior = key === null ? undefined : journal.find((e) => e.key === key);
      const m = prior === undefined ? moment : castMomentOf(JSON.parse(prior.at) as typeof at);

      const gua = dress(cast(m, { method: "time" }, params.liuyao), params.liuyao);
      const ys = pickYongshen(gua, topic.id, topic.use.kind === "caller" ? relation : undefined);
      const report = buildQuestionReport(judge(gua, ys, params.liuyao), params,
        qh === null ? {} : { questionFingerprint: qh });

      if (prior === undefined && key !== null) {
        localStorage.setItem(JOURNAL, JSON.stringify([
          ...journal, { key, at: JSON.stringify(at), recordedAt: new Date().toISOString() },
        ]));
      }
      setOut({ report, replayed: prior !== undefined });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setOut(null);
    }
  };

  return (
    <>
      <h1 className="m-h1">问一件事</h1>
      <p className="m-lede">
        这一页不需要你的出生信息 —— 它看的是你问的这个时刻。
        同一个时段里，所有人问所有事得到的是同一个结果，
        区分不同的事靠看结果里的哪一个位置。
      </p>

      <div className="m-form">
        <div className="m-field">
          <label>问什么</label>
          <select value={cat} onChange={(e) => {
            const c = e.target.value as TopicCategory;
            setCat(c); setTopicId(TOPICS.find((t) => t.category === c)!.id);
          }}>
            {TOPIC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          {topic.use.kind === "caller" && (
            <select value={relation} onChange={(e) => setRelation(e.target.value as Liuqin)}>
              {(["父母", "兄弟", "子孙", "妻财", "官鬼"] as const).map(
                (q) => <option key={q} value={q}>所问的人是{q}一路</option>)}
            </select>
          )}
        </div>
        <div className="m-field">
          <label>具体想问什么（可留空）</label>
          <input value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="写一句话" />
        </div>
        <div className="m-field">
          <label>你现在在哪</label>
          <select value={place} onChange={(e) => setPlace(Number(e.target.value))}>
            {CITIES.map((c, i) => <option key={c[0]} value={i}>{c[0]}</option>)}
          </select>
        </div>
        <button className="m-btn" onClick={() => { void ask(); }}>问</button>
      </div>

      <p className="m-note">
        你写的问题不出这台设备 —— 只在本机换算成一串指纹，用来记住「这个问题今天问过了」。
        同一个问题当天只起一次：允许反复重问，等于允许一直问到自己满意为止，
        那样得到的就不是占问，是挑选。留空则不记，可以反复问。
        {topic.restricted === true && (
          <> 　健康这一类的输出是受限的：不给病名、不给好转与否、也不给时间。
            身体上的事请看医生。</>
        )}
      </p>

      {err !== null && <div className="m-card"><p>{err}</p></div>}

      {out !== null && (
        <>
          {out.replayed && (
            <div className="m-card">
              <p className="dim">这个问题今天已经问过一次，这里显示的是当时的结果。</p>
            </div>
          )}
          <div className="m-sec">结果</div>
          <p className="m-lede">{plainQuestion(out.report).framing}</p>
          {plainQuestion(out.report).cards.map((c) => <Card key={c.id} card={c} />)}
          <div className="m-card">
            <div className="m-why" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
              <button onClick={() => setWhy(!why)}>
                {why ? "收起完整推演" : "看完整推演"}
              </button>
              {why && (
                <ul>
                  {out.report.casting.narrative.map((l, i) => <li key={`c${i}`}>{l.text}</li>)}
                  {out.report.topic.narrative.map((l, i) => <li key={`t${i}`}>{l.text}</li>)}
                  {out.report.gua.yaos.slice().reverse().map((y) => (
                    <li key={y.pos}>
                      第 {y.pos} 位　{y.liushen}　{y.liuqin}{y.stem}{y.branch}
                      {y.isShi ? "（世）" : y.isYing ? "（应）" : ""}
                      {y.moving ? "　动" : y.chongState === "暗动" ? "　暗动" : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <Disclaimer plain={plainQuestion(out.report).disclaimer}
            technical={out.report.disclaimerBottom} />
        </>
      )}
    </>
  );
}

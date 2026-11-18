"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildQuestionReport, cast, castMomentOf, dress, judge, loadParams,
  pickYongshen, plainQuestion, TOPICS, TOPIC_CATEGORIES,
  type CastInput, type CoinThrow, type Liuqin, type TopicCategory,
} from "@fate/core";
import { Card } from "../Card";
import { Coins } from "./Coins";
import { Tarot } from "./Tarot";
import { Disclaimer } from "../page";
import { CITIES, loadAudience, loadMarks, saveMark, type Mark, type Verdict } from "../store";

/**
 * 「问事」页 —— 就一件具体的事起一卦。
 *
 * 三件必须让用户知道的事，都写在页面上而不是折叠起来：
 *
 * 1. **不需要出生信息** —— 卦属于起卦的那个时刻，不属于问卜的人。
 * 2. **按时刻起时，同一时段内所有人问所有事，得到同一个卦** —— 区分不同的事靠取不同的位置。
 * 3. **同一个问题当天只起一次** —— 允许重问等于允许一直摇到满意为止。
 *
 * 起卦两种：按时刻（默认，梅花的取数法）与掷铜钱（六爻本法）。第 2 条只对前者成立 ——
 * 掷铜钱的结果由用户掷出来，时刻只定月建、日辰，故页首那段话随所选的起法换。
 */

const JOURNAL = "fate.m.journal.v1";
/**
 * `input` 是后加的：一事不二占要能**原样复出**那一卦，掷铜钱的六次就得记下来。
 * 旧记录没有这一项，它们当时只能按时刻起，故缺省即按时刻。
 */
type Entry = { key: string; at: string; recordedAt: string; input?: CastInput };

type How = "time" | "coin";
const HOW_LABEL: Readonly<Record<How, string>> = { time: "按现在的时刻", coin: "掷铜钱" };

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
  // 读者档影响应期那一张卡 —— 普通读者档不给指向未来的时段
  const params = useMemo(() => loadParams({ report: { audience: loadAudience() } }), []);
  const [method, setMethod] = useState<"liuyao" | "tarot">("liuyao");
  const [cat, setCat] = useState<TopicCategory>("财");
  const [topicId, setTopicId] = useState("wealth.seek");
  const [relation, setRelation] = useState<Liuqin>("父母");
  const [question, setQuestion] = useState("");
  const [place, setPlace] = useState(0);
  const [how, setHow] = useState<How>("time");
  // 六次掷齐才是一个合法输入，未齐时为 null
  const [coins, setCoins] = useState<readonly CoinThrow[] | null>(null);
  const [out, setOut] = useState<{
    report: ReturnType<typeof buildQuestionReport>; replayed: boolean; how: How;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 复盘：问过的事，事后回来记结果。与「回看」共用同一本账。
  const [askedKey, setAskedKey] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  useEffect(() => { setMarks(loadMarks()); }, []);
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

      // 问过的事原样复出当时那一卦 —— 连同当时的起法，不看现在选的是哪一种
      let input: CastInput;
      if (prior !== undefined) {
        input = prior.input ?? { method: "time" };
      } else if (how === "time") {
        input = { method: "time" };
      } else {
        if (coins === null || coins.length !== 6) {
          throw new Error("六次还没掷齐 —— 每一次都要把三枚的正反记下来。");
        }
        input = {
          method: "coin",
          throws: coins as [CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow],
        };
      }
      // 起法写进参数，报告「起卦法」一行与参数指纹才对得上实际用的那一种（桌面版同此）
      const p = input.method === params.liuyao.castMethod
        ? params
        : { ...params, liuyao: { ...params.liuyao, castMethod: input.method } };

      const gua = dress(cast(m, input, p.liuyao), p.liuyao);
      const ys = pickYongshen(gua, topic.id, topic.use.kind === "caller" ? relation : undefined);
      const report = buildQuestionReport(judge(gua, ys, p.liuyao), p,
        qh === null ? {} : { questionFingerprint: qh });

      if (prior === undefined && key !== null) {
        localStorage.setItem(JOURNAL, JSON.stringify([
          ...journal,
          { key, at: JSON.stringify(at), recordedAt: new Date().toISOString(), input },
        ]));
      }
      setOut({
        report, replayed: prior !== undefined,
        how: input.method === "coin" ? "coin" : "time",
      });
      setAskedKey(key);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setOut(null);
    }
  };

  return (
    <>
      <h1 className="m-h1">问一件事</h1>

      {/*
        两套方法摆在同一页，是为了让它们的差别看得见：
        六爻同一时刻重起得同一个卦，故有「一事不二占」；
        塔罗每抽一次就是一次新试验，故没有。
        分成两个标签，读者只会以为是两个功能。
      */}
      <div className="m-seg">
        <button className={method === "liuyao" ? "on" : undefined}
          onClick={() => setMethod("liuyao")}>六爻</button>
        <button className={method === "tarot" ? "on" : undefined}
          onClick={() => setMethod("tarot")}>塔罗</button>
      </div>

      {method === "tarot" ? <Tarot /> : (
      <>
      <p className="m-lede">
        {how === "time" ? (
          <>
            这一页不需要你的出生信息 —— 它看的是你问的这个时刻。
            同一个时段里，所有人问所有事得到的是同一个结果，
            区分不同的事靠看结果里的哪一个位置。
          </>
        ) : (
          <>
            这一页不需要你的出生信息。掷铜钱的话，结果由你掷出来的六次决定；
            问的这个时刻只用来定这个月、这一天的背景。
          </>
        )}
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
        <div className="m-field">
          <label>怎么起</label>
          <div className="m-seg" style={{ margin: 0 }}>
            {(["time", "coin"] as const).map((h) => (
              <button key={h} type="button" className={how === h ? "on" : undefined}
                onClick={() => setHow(h)}>{HOW_LABEL[h]}</button>
            ))}
          </div>
        </div>
        {how === "coin" && <Coins onChange={setCoins} />}
        <button className="m-btn" disabled={how === "coin" && coins === null}
          onClick={() => { void ask(); }}>
          {how === "coin" && coins === null ? "六次掷齐后再问" : "问"}
        </button>
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
              <p className="dim">
                这个问题今天已经问过一次（当时是{out.how === "coin" ? "掷铜钱" : "按时刻"}起的），
                这里显示的是当时的结果。
              </p>
            </div>
          )}
          <Followup
            askedKey={askedKey} marks={marks}
            onMark={(v) => {
              if (askedKey === null) return;
              setMarks(saveMark({
                key: `q${askedKey}`, kind: "question", verdict: v,
                // 问事的置信度取报告里最低的那一条 —— 一份判断的可靠程度
                // 由它最弱的一环决定，取平均会把那一环藏起来
                confidence: Math.min(...[...out.report.judgement.narrative,
                  ...out.report.topic.narrative].map((l) => l.confidence), 1),
                at: new Date().toISOString(),
              }));
            }}
          />
          <div className="m-sec">结果</div>
          <p className="m-lede">{plainQuestion(out.report).framing}</p>
          {plainQuestion(out.report).cards.map((c) => <Card key={c.id} card={c} />)}

          <div className="m-sec">说的是什么事</div>
          <p className="m-lede">
            上面几条说的是「这件事在结果里的分量」。下面几条说的是「说的是什么事」——
            它们来自《周易》的卦辞、爻辞和它们的传统转述，是引来的原话，一个字没改。
            两路各说各的，不互相印证。
          </p>
          {plainQuestion(out.report).yaoci.map((c) => <Card key={c.id} card={c} />)}
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
      )}
    </>
  );
}

/**
 * 复盘 —— 问过的事，事后回来记结果。
 *
 * 与「回看」共用同一本账，故两处的标注汇总在一起。
 * 只存指纹不存原文：一份能被翻出来的问卜日记，泄露的东西比生辰多得多。
 *
 * 「还没结果」是默认的一档，且**不计入命中**。没有它，用户会被逼着
 * 在事情还没落定时先表个态 —— 那个态度事后多半会被自己的记忆改写。
 */
function Followup({ askedKey, marks, onMark }: {
  askedKey: string | null;
  marks: readonly Mark[];
  onMark: (v: Verdict) => void;
}) {
  if (askedKey === null) return null;
  const cur = marks.find((m) => m.key === `q${askedKey}`);
  const LABEL: Readonly<Record<Verdict, string>> = {
    hit: "后来应验了", miss: "后来没应验", unclear: "说不清",
  };
  return (
    <div className="m-card">
      <h3>过些天回来记一笔</h3>
      <p className="dim">
        事情有结果之后再回到这一页、问同一个问题（当天会取出原来那一卦），
        然后标一下。标注只存在这台设备上，也不会回流去调整模型。
      </p>
      <div className="m-chips" style={{ marginTop: 10, marginBottom: 0 }}>
        {(["hit", "miss", "unclear"] as const).map((v) => (
          <button key={v} className={`m-chip${cur?.verdict === v ? " on" : ""}`}
            onClick={() => onMark(v)}>
            {LABEL[v]}
          </button>
        ))}
      </div>
      {cur === undefined && (
        <p className="dim" style={{ marginTop: 8 }}>
          事情还没落定就别急着标 —— 现在表的态，事后多半会被自己的记忆改写。
        </p>
      )}
    </div>
  );
}

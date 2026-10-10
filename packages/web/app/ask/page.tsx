"use client";

import { useMemo, useState } from "react";
import {
  buildQuestionReport, cast, castMomentOf, dress, judge, loadParams,
  monthLabel, pickYongshen, TOPICS, TOPIC_CATEGORIES,
  type CastInput, type CoinThrow, type Liuqin, type TopicCategory,
} from "@fate/core";
import { CoinCast } from "../../components/CoinCast";

/**
 * 问事页 —— 不挂在 /chart 之下。
 *
 * 六爻问事**不需要生辰**：卦属于起卦的时刻，不属于问卜的人。
 * 把它做成命盘的一个标签页，会让人以为它读了自己的八字。
 */

const CITIES: readonly (readonly [string, string, number])[] = [
  ["上海", "Asia/Shanghai", 121.47], ["北京", "Asia/Shanghai", 116.41],
  ["广州", "Asia/Shanghai", 113.26], ["台北", "Asia/Taipei", 121.56],
  ["香港", "Asia/Hong_Kong", 114.17], ["新加坡", "Asia/Singapore", 103.82],
];

/** 一事不二占的本地记录。只存指纹，不存原文。 */
const JOURNAL_KEY = "fate.liuyao.journal.v1";

async function fingerprint(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text.normalize("NFKC").trim());
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

type Entry = { key: string; at: string; input: CastInput; recordedAt: string };

function readJournal(): Entry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    return raw === null ? [] : (JSON.parse(raw) as Entry[]);
  } catch { return []; }
}

export default function AskPage() {
  const params = useMemo(() => loadParams({}), []);
  const [cat, setCat] = useState<TopicCategory>("财");
  const [topicId, setTopicId] = useState("wealth.seek");
  const [relation, setRelation] = useState<Liuqin>("父母");
  const [question, setQuestion] = useState("");
  const [place, setPlace] = useState(0);
  const [method, setMethod] = useState<"time" | "number" | "coin">("time");
  const [numA, setNumA] = useState("27");
  const [numB, setNumB] = useState("");
  // 掷钱：六掷齐备才是一个合法输入，故未齐时为 null，而不是一串半成品字符串。
  const [coins, setCoins] = useState<readonly CoinThrow[] | null>(null);
  const [result, setResult] = useState<{
    md: ReturnType<typeof buildQuestionReport>; replayed: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const topics = TOPICS.filter((t) => t.category === cat);
  const topic = TOPICS.find((t) => t.id === topicId) ?? topics[0]!;
  const needsRelation = topic.use.kind === "caller";

  const ask = async () => {
    setErr(null);
    try {
      const [, tz, lon] = CITIES[place]!;
      const now = new Date();
      const at = {
        year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
        hour: now.getHours(), minute: now.getMinutes(), timeZone: tz, longitude: lon,
      };
      const moment = castMomentOf(at);
      const qh = question.trim() === "" ? null : await fingerprint(question);
      const dayGz = `${moment.pillars.day.stem}${moment.pillars.day.branch}`;
      const key = qh === null ? null : `${dayGz}|${topic.id}|${qh}`;

      const journal = readJournal();
      const prior = key === null ? undefined : journal.find((e) => e.key === key);

      let input: CastInput;
      if (prior !== undefined) {
        input = prior.input;
      } else if (method === "time") {
        input = { method: "time" };
      } else if (method === "number") {
        const a = Number(numA);
        if (!Number.isInteger(a) || a <= 0) throw new Error("报数须为正整数。");
        const b = numB.trim() === "" ? undefined : Number(numB);
        input = b === undefined
          ? { method: "number", value: a }
          : { method: "number", value: a, second: b };
      } else {
        if (coins === null || coins.length !== 6) {
          throw new Error("六爻须掷齐六次，每次记下三枚铜钱的阴阳。");
        }
        input = {
          method: "coin",
          throws: coins as [
            CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow],
        };
      }

      const usedMethod = input.method;
      const p = usedMethod === params.liuyao.castMethod
        ? params
        : { ...params, liuyao: { ...params.liuyao, castMethod: usedMethod } };
      const m = prior === undefined ? moment : castMomentOf(JSON.parse(prior.at) as typeof at);
      const gua = dress(cast(m, input, p.liuyao), p.liuyao);
      const ys = pickYongshen(gua, topic.id, needsRelation ? relation : undefined);
      const report = buildQuestionReport(judge(gua, ys, p.liuyao), p, {
        ...(qh === null ? {} : { questionFingerprint: qh }),
      });

      if (prior === undefined && key !== null) {
        localStorage.setItem(JOURNAL_KEY, JSON.stringify([
          ...journal,
          { key, at: JSON.stringify(at), input, recordedAt: new Date().toISOString() },
        ]));
      }
      setResult({ md: report, replayed: prior !== undefined });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setResult(null);
    }
  };

  return (
    <>
      <header className="top"><div className="inner">
        <a className="brand" href="/">四柱推演</a>
        <nav><a href="/">排盘</a><a href="/ask" className="active">问事</a><a href="/cross">合参</a><a href="/book">书</a><a href="/compare-book">比较</a></nav>
      </div></header>
      <div className="shell">
        <h1>六爻问事</h1>
        <p className="sub">
          卦属于起卦的那个时刻，不属于问卜的人 —— 故此处不需要生辰。
          同一时辰内的所有问事得到同一个卦，区分不同的事靠取不同的用神。
        </p>

        <div className="card">
          <h3>一、所占何事</h3>
          <div className="row">
            <select value={cat} onChange={(e) => {
              const c = e.target.value as TopicCategory;
              setCat(c);
              setTopicId(TOPICS.find((t) => t.category === c)!.id);
            }}>
              {TOPIC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {needsRelation && (
              <select value={relation} onChange={(e) => setRelation(e.target.value as Liuqin)}>
                {(["父母", "兄弟", "子孙", "妻财", "官鬼"] as const).map(
                  (q) => <option key={q} value={q}>所问之人为{q}</option>)}
              </select>
            )}
          </div>
          {topic.restricted === true && (
            <p className="dim">
              健康类的输出受限：不给病名、不给预后、不给时间窗。
              只出五行脏腑的传统对照，健康相关的决定请咨询持证专业人士。
            </p>
          )}
        </div>

        <div className="card">
          <h3>二、问题（可留空）</h3>
          <input
            value={question} placeholder="写下要问的事"
            onChange={(e) => setQuestion(e.target.value)}
            style={{ width: "100%" }}
          />
          <p className="dim">
            问题不出本机：只在浏览器内算出一个十六位指纹用于「一事不二占」，
            原文既不上传也不存储。留空则不设防，可反复起卦。
          </p>
        </div>

        <div className="card">
          <h3>三、起卦法</h3>
          <div className="row">
            {(["time", "number", "coin"] as const).map((m) => (
              <label key={m}>
                <input type="radio" checked={method === m} onChange={() => setMethod(m)} />
                {{ time: "按时（梅花法）", number: "报数", coin: "掷钱（六爻本法）" }[m]}
              </label>
            ))}
            <select value={place} onChange={(e) => setPlace(Number(e.target.value))}>
              {CITIES.map((c, i) => <option key={c[0]} value={i}>{c[0]}</option>)}
            </select>
          </div>
          {method === "number" && (
            <div className="row">
              <input value={numA} onChange={(e) => setNumA(e.target.value)} placeholder="报一个数" />
              <input value={numB} onChange={(e) => setNumB(e.target.value)} placeholder="第二个数（可留空）" />
            </div>
          )}
          {method === "coin" && <CoinCast onChange={setCoins} />}
          {method === "number" && (
            <p className="dim">
              单数法在一个时辰内只有 24 种结果 —— 上卦、下卦、动爻位全由这个数决定，
              而 8 与 6 不互素。要全覆盖，给第二个数或改用掷钱。
            </p>
          )}
          <button
            onClick={() => { void ask(); }}
            disabled={method === "coin" && coins === null}
          >
            起卦
          </button>
        </div>

        {err !== null && <div className="card"><p>{err}</p></div>}

        {result !== null && <QuestionView r={result.md} replayed={result.replayed} />}
      </div>
    </>
  );
}

function QuestionView(
  { r, replayed }: { r: ReturnType<typeof buildQuestionReport>; replayed: boolean },
) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {replayed && (
        <div className="card">
          <p>
            一事不二占：本日已为该问题起过卦，此处显示的是首卦。
            允许重掷等于允许一直摇到满意为止 —— 那样得到的不是占卜，是筛选。
          </p>
        </div>
      )}
      <div className="card">
        <h3>卦象</h3>
        <div className="scroll">
          <table>
            <thead><tr>
              <th>爻</th><th>六神</th><th>六亲</th><th>干支</th>
              <th>世应</th><th>动静</th><th>月建</th><th>空破</th><th>变爻</th>
            </tr></thead>
            <tbody>
              {[...r.gua.yaos].reverse().map((y) => (
                <tr key={y.pos}>
                  <td>{y.pos}</td><td>{y.liushen}</td><td>{y.liuqin}</td>
                  <td>{y.stem}{y.branch}</td>
                  <td>{y.isShi ? "世" : y.isYing ? "应" : ""}</td>
                  <td>{y.moving ? "○ 动" : y.chongState === "暗动" ? "暗动" : ""}</td>
                  <td>{y.monthPhase}</td>
                  <td>{[
                    y.xunkong ? `空${y.xunkongNullified === null ? "" : `(${y.xunkongNullified})`}` : "",
                    y.yuepo ? `破${y.yuepoNullified === null ? "" : `(${y.yuepoNullified})`}` : "",
                  ].filter((x) => x !== "").join(" ")}</td>
                  <td>{y.bian === null ? ""
                    : `${y.bian.liuqin}${y.bian.stem}${y.bian.branch} ${y.bian.shengke}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.gua.fushen.length > 0 && (
          <p className="dim">
            伏神：{r.gua.fushen.map(
              (f) => `${f.liuqin}${f.stem}${f.branch}（伏于第 ${f.pos} 爻 ${f.feiLiuqin}${f.feiBranch} 之下）`)
              .join("、")}
          </p>
        )}
      </div>

      {([
        ["起卦", r.casting.narrative], ["占事与用神", r.topic.narrative],
        ["断论", r.judgement.narrative], ["应期", r.yingqi.narrative],
      ] as const).map(([title, lines]) => (
        <div className="card" key={title}>
          <h3>{title}</h3>
          <ul>
            {lines.map((l, i) => (
              <li key={i}>
                {l.text}
                {l.hedged && <span className="dim">　（低置信度，已改用留有余地的措辞）</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <YaociView r={r} />

      {r.yingqi.result.windows.length > 0 && (
        <div className="card">
          <h3>候选时段</h3>
          <div className="scroll">
            <table>
              <thead><tr><th>时段</th><th>距今</th><th>取候之由</th></tr></thead>
              <tbody>
                {r.yingqi.result.windows.map((w) => (
                  <tr key={`${w.year}-${w.branch}`}>
                    <td>{monthLabel(w)}</td>
                    <td>{w.monthsAhead} 个月</td>
                    <td>{w.reasons.join("；")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <button className="ghost" onClick={() => setOpen(!open)}>
          {open ? "收起" : "展开"}起卦算式与方法
        </button>
        {open && (
          <>
            <ul>{r.casting.narrative.map((l, i) => <li key={i}>{l.text}</li>)}</ul>
            <div className="scroll">
              <table>
                <tbody>
                  <tr><td>起卦法</td><td>{r.meta.castMethod}</td></tr>
                  <tr><td>引擎版本</td><td>{r.meta.engineVersion}</td></tr>
                  <tr><td>参数指纹</td><td>{r.meta.paramsHash}</td></tr>
                  {r.meta.questionFingerprint !== null && (
                    <tr><td>问题指纹</td><td>{r.meta.questionFingerprint}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="sub">{r.disclaimerBottom}</p>
    </>
  );
}

/**
 * 指事 —— 爻辞一路。
 *
 * 与上面几块**分开摆**，因为它不是本引擎写的话。引文用 blockquote 排，
 * 让「这是引来的」在视觉上也成立，而不只是在文案里声明一句。
 */
function YaociView({ r }: { r: ReturnType<typeof buildQuestionReport> }) {
  const y = r.yaoci.reading;
  const q = (x: { text: string | null; withheld: readonly string[] } | null) =>
    x === null ? null : x.text !== null
      ? <span>{x.text}</span>
      : <span className="dim">未通过措辞检查（{x.withheld.join("、")}）</span>;

  return (
    <div className="card">
      <h3>指事</h3>
      <ul>
        {r.yaoci.narrative.map((l, i) => <li key={i}>{l.text}</li>)}
      </ul>
      <p>
        本卦 <strong>{y.gua.ben.name}</strong>：{q(y.gua.ben.classic)}
        {y.gua.bian !== null && (
          <>　→　变卦 <strong>{y.gua.bian.name}</strong>：{q(y.gua.bian.classic)}</>
        )}
      </p>
      <div className="scroll">
        <table>
          <thead><tr><th>爻</th><th>位</th><th>爻辞</th><th>指事</th></tr></thead>
          <tbody>
            {y.picks.flatMap((pk) => [
              <tr key={`${pk.pos}-ben`}>
                <td>{pk.pos}</td>
                <td>{pk.role}{pk.isYongshen && "・用神位"}</td>
                <td>{q(pk.ben.classic)}</td>
                <td>{q(pk.ben.gist)}</td>
              </tr>,
              ...(pk.bian === null ? [] : [
                <tr key={`${pk.pos}-bian`}>
                  <td>{pk.pos}</td><td className="dim">变出</td>
                  <td>{q(pk.bian.classic)}</td>
                  <td>{q(pk.bian.gist)}</td>
                </tr>,
              ]),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBaseChart, buildChart, plainYear, type BirthInput } from "@fate/core";
import {
  ENOUGH, loadBirth, loadMarks, saveMark, clearMarks,
  type Mark, type Verdict,
} from "../store";
import { Share } from "../Share";

/**
 * 「回看」—— 挑一个你记得的年份，看模型当时的说法，然后标它准不准。
 *
 * ## 为什么先出说法、后翻年份
 *
 * 若先告诉用户「2018 年」，他会先想起那年发生了什么，再去说法里找对得上的部分。
 * 那样量到的是**他的记忆有多丰富**，不是模型有多准。
 * 故默认次序是：先出说法，用户想好了再翻年份。这一条不能省 ——
 * 省掉之后这个功能就只是个好玩的东西，不再是个检验。
 *
 * ## 标注不回流到引擎
 *
 * 用户的标注只存在本机、只给用户自己看。一旦拿它去调参数，
 * 事后偏误就直接进了模型，这套系统会朝着「让用户觉得准」的方向漂移 ——
 * 那正是所有算命系统最终会变成的样子。
 */

const LABEL: Readonly<Record<Verdict, string>> = {
  hit: "说中了", miss: "没说中", unclear: "说不清",
};

export default function RecallPage() {
  const [birth, setBirth] = useState<BirthInput | null>(null);
  const [ready, setReady] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => { setBirth(loadBirth()); setMarks(loadMarks()); setReady(true); }, []);

  const base = useMemo(() => {
    if (birth === null) return null;
    try { return buildBaseChart(buildChart(birth)); } catch { return null; }
  }, [birth]);

  /**
   * 候选年份 —— 用户 12 岁到今年之间，**打乱次序**。
   *
   * 按时间顺序排会让用户顺着读下去，读到后面就开始拿前一年的说法作参照；
   * 打乱之后每一条都得独立判断。种子取出生年，故同一个人每次进来次序一致 ——
   * 不然刷新一下就换一批，标过的和没标的混在一起。
   */
  const years = useMemo(() => {
    if (birth === null) return [];
    const now = new Date().getFullYear();
    const all: number[] = [];
    for (let y = birth.year + 12; y <= now; y++) all.push(y);
    let seed = birth.year * 7919 + birth.month * 31 + birth.day;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [all[i], all[j]] = [all[j]!, all[i]!];
    }
    return all;
  }, [birth]);

  const year = years[idx % Math.max(1, years.length)];
  const py = useMemo(
    () => (base === null || year === undefined ? null : plainYear(base, year)),
    [base, year],
  );

  if (!ready) return <p className="m-lede">载入中…</p>;
  if (birth === null) {
    return (
      <>
        <h1 className="m-h1">回看</h1>
        <p className="m-lede">先在「我」那一页填出生信息，才能回看。</p>
      </>
    );
  }
  if (py === null || year === undefined) return <p className="m-lede">算不出来。</p>;

  const marked = marks.find((m) => m.key === `y${year}`);
  const next = () => { setIdx(idx + 1); setRevealed(false); };
  const mark = (v: Verdict) => {
    setMarks(saveMark({
      key: `y${year}`, kind: "year", verdict: v,
      confidence: py.confidence, at: new Date().toISOString(),
    }));
  };

  return (
    <>
      <h1 className="m-h1">回看</h1>
      <p className="m-lede">
        这一页不预告任何事。它把模型对<b>某一个过去年份</b>的说法拿出来，
        由你来判断它说中了没有。<b>先读说法，想好了再翻年份</b> ——
        反过来的话，量到的是你的记忆有多丰富，不是模型有多准。
      </p>

      <div className="m-card">
        <p style={{ fontSize: 16, lineHeight: 1.7 }}>{py.headline}</p>
        {py.domains.length > 0 && (
          <ul className="m-list">
            {py.domains.map((d) => <li key={d.label}><b>{d.label}</b>：{d.text}</li>)}
          </ul>
        )}

        <div style={{ marginTop: 14 }}>
          {revealed ? (
            <p style={{ fontSize: 15 }}>
              说的是 <b style={{ fontSize: 22 }}>{year}</b> 年
              <span className="m-dim">（你 {year - birth.year} 岁前后）</span>
            </p>
          ) : (
            <button className="m-btn" onClick={() => setRevealed(true)}>
              我想好了，翻开是哪一年
            </button>
          )}
        </div>

        {revealed && (
          <div style={{ marginTop: 12 }}>
            <div className="m-chips">
              {(["hit", "miss", "unclear"] as const).map((v) => (
                <button key={v}
                  className={`m-chip${marked?.verdict === v ? " on" : ""}`}
                  onClick={() => mark(v)}>
                  {LABEL[v]}
                </button>
              ))}
            </div>
            {py.confidence < 0.6 && (
              <p className="m-dim" style={{ marginTop: 8 }}>
                模型自己对这一条就没什么把握（用神取得不确定，整条曲线都建在它上面）。
                标「没说中」时，这一条本来就不算它的强项。
              </p>
            )}
          </div>
        )}

        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <button className="m-btn ghost" onClick={next}>换一年</button>
        </div>
      </div>

      {revealed && (
        <Share title="回看" lines={[py.headline, ...py.domains.map((d) => `${d.label}：${d.text}`)]} />
      )}

      <Ledger marks={marks} onClear={() => { clearMarks(); setMarks([]); }} />
    </>
  );
}

/**
 * 「我的账」。
 *
 * 两件事必须做到：
 * 1. 样本量不足三十时**不出百分数** —— 那个数字会看起来像统计量而它不是
 * 2. 按模型自己的把握程度**分栏** —— 合成一个总数会抹掉最有意思的差别：
 *    模型说有把握的那些是不是真的更准
 */
function Ledger({ marks, onClear }: { marks: readonly Mark[]; onClear: () => void }) {
  if (marks.length === 0) {
    return (
      <div className="m-note">
        还没有标注。标过之后这里会出现你自己的一本账 ——
        它只存在这台设备上，也<b>不会回流去调整模型</b>：
        拿用户的印象去调参数，等于把事后偏误直接写进引擎。
      </div>
    );
  }

  const count = (xs: readonly Mark[], v: Verdict) => xs.filter((m) => m.verdict === v).length;
  const rows: readonly (readonly [string, readonly Mark[]])[] = [
    ["模型说有把握的", marks.filter((m) => m.confidence >= 0.7)],
    ["模型说不确定的", marks.filter((m) => m.confidence < 0.7)],
  ];
  const years = marks.filter((m) => m.kind === "year").length;
  const questions = marks.filter((m) => m.kind === "question").length;

  return (
    <div className="m-card">
      <h2 className="m-h2">我的账</h2>
      <p className="m-dim">
        共标了 {marks.length} 条（回看 {years} 条、问事复盘 {questions} 条）：
        说中 {count(marks, "hit")}、没说中 {count(marks, "miss")}、
        说不清 {count(marks, "unclear")}。
      </p>

      <table className="m-table">
        <thead><tr><th></th><th>说中</th><th>没说中</th><th>说不清</th></tr></thead>
        <tbody>
          {rows.map(([name, xs]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{count(xs, "hit")}</td>
              <td>{count(xs, "miss")}</td>
              <td>{count(xs, "unclear")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="m-note" style={{ marginTop: 10 }}>
        {marks.length < ENOUGH ? (
          <>
            <b>这些数字现在还说明不了什么。</b>
            {marks.length} 条太少 —— 十次里中六次，在完全靠猜的情况下也一点都不稀奇。
            所以这里不给百分比：给了，它会看起来像个统计量，而它不是。
            标到 {ENOUGH} 条以上再回来看。
          </>
        ) : (
          <>
            标了 {marks.length} 条，够看个大概了。
            真正有意思的不是总的命中比例，而是<b>上下两行有没有差别</b> ——
            模型说有把握的那些若并不更准，说明它的置信度没什么用；
            若确实更准，那这个置信度就是可以依靠的。
            即便如此，这仍是你对自己记忆的判断，不是一次对照实验。
          </>
        )}
      </p>

      <button className="m-btn ghost" style={{ marginTop: 10 }} onClick={onClear}>
        清空我的标注
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  drawSpread, SPREADS, spreadStateSpace, SUIT_NAME, SCHOOL_NOTE,
  TAROT_PENDING_CALIBRATION,
  type MajorNumbering, type SuitElementSchool, type TarotReading,
} from "@fate/core";
import { SiteNav } from "../../components/SiteNav";

/**
 * 塔罗页 —— 与问事页一样不要生辰，而且比问事页更彻底：**它连时刻都不要**。
 *
 * 这一页在本项目里有一个别的页没有的用处：它是那条「确定 / 随机」分界的
 * 一个可操作的对照。读者在这里按一下重抽，结果就变了；
 * 而四柱与六爻按时起卦那边，同一输入按多少次都是同一个结果。
 *
 * 故「再抽一次」这个按钮是刻意摆在显眼处的 —— 它不是便利功能，
 * 是这套方法的性质。页面也明说：这里没有「一事不二占」。
 */

export default function TarotPage() {
  const [spreadId, setSpreadId] = useState("three");
  const [numbering, setNumbering] = useState<MajorNumbering>("marseille");
  const [suitElement, setSuitElement] = useState<SuitElementSchool>("goldenDawn");
  const [withReversals, setWithReversals] = useState(false);
  const [reading, setReading] = useState<TarotReading | null>(null);

  const draw = () => setReading(drawSpread({
    spreadId, numbering, suitElement, withReversals,
  }));

  const spread = SPREADS.find((s) => s.id === spreadId)!;

  return (
    <>
      <SiteNav active="tarot" />
      <div className="shell">
        <h1>塔罗</h1>
        <p className="sub">
          九套占法里<strong>唯一一个起盘不需要知道今天是哪天</strong>的。
          它的天文含量为零，也不要生辰 —— 洗牌与切牌就是它的起法全部。
        </p>

        <div className="card">
          <h2>先说清楚这一页与别的页哪里不同</h2>
          <p>
            四柱、六爻按时起卦、星盘都是<strong>确定</strong>的：同一个输入，
            按多少次都是同一个结果，可以复算、可以对质。
          </p>
          <p>
            塔罗是<strong>随机</strong>的。你在这一页每按一次「抽牌」，
            得到的就是另一次独立试验 —— <strong>复算在这里没有意义</strong>，
            因为重抽本来就是另一回事。
          </p>
          <p>
            所以这里<strong>没有「一事不二占」</strong>。
            六爻那边有那条规矩，是因为反复重问一个确定性系统，
            等于一直问到自己满意为止 —— 那样得到的不是占问，是挑选。
            塔罗本来就按次计，那条规矩套不上来。
          </p>
          <p className="sub">
            这个差别不是风格，是「确定还是随机」那条分界的直接后果。
            见<a href="/compare-book/06">《测天，还是约定》第 6 章</a>。
          </p>
        </div>

        <div className="card">
          <h2>起牌</h2>
          <div className="tarot-controls">
            <label>牌阵
              <select value={spreadId} onChange={(e) => setSpreadId(e.target.value)}>
                {SPREADS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}（{s.positions.length} 张）
                  </option>
                ))}
              </select>
            </label>
            <label>大牌序号
              <select value={numbering}
                onChange={(e) => setNumbering(e.target.value as MajorNumbering)}>
                <option value="marseille">马赛系（8 正义 · 11 力量）</option>
                <option value="rws">韦特系（8 力量 · 11 正义）</option>
              </select>
            </label>
            <label>花色元素
              <select value={suitElement}
                onChange={(e) => setSuitElement(e.target.value as SuitElementSchool)}>
                <option value="goldenDawn">金色黎明（杖火 · 剑风）</option>
                <option value="swordsFire">另一系（杖风 · 剑火）</option>
              </select>
            </label>
            <label className="row">
              <input type="checkbox" checked={withReversals}
                onChange={(e) => setWithReversals(e.target.checked)} />
              用逆位
            </label>
            <button onClick={draw}>{reading === null ? "抽牌" : "再抽一次"}</button>
          </div>
          <p className="sub">
            三个开关都是<strong>流派选择，没有正确答案</strong>，
            故不替你定，并随结果声明用的是哪一系。
            {SCHOOL_NOTE[numbering]}；{SCHOOL_NOTE[suitElement]}。
          </p>
          <p className="sub">
            这个牌阵的状态数：
            <span className="mono">
              {spreadStateSpace(spread, withReversals).toLocaleString()}
            </span>
            {spread.id === "celtic"
              && "　—— 已超过地球上活过的人数总和。那不是优点：位置越多，"
                + "事后拼出一个说得通的故事就越容易。"}
          </p>
        </div>

        {reading !== null && (
          <>
            <div className="card">
              <h2>{reading.spread.name}</h2>
              <p className="sub">{reading.spread.note}</p>
              <div className="tarot-cards">
                {reading.cards.map((c) => (
                  <div key={c.position.index} className="tarot-card">
                    <div className="pos">
                      {c.position.index + 1}　{c.position.name}
                    </div>
                    <div className={c.reversed ? "face reversed" : "face"}>
                      <span className="nm">{c.card.name}</span>
                      {c.reversed && <span className="rev">逆</span>}
                    </div>
                    <div className="meta">
                      {c.majorNumber !== null
                        ? <>大牌 <span className="mono">{c.majorNumber}</span>
                          {c.card.unnamedInMarseille === true && (
                            <span className="dim">　马赛系牌面无名</span>)}</>
                        : <>{SUIT_NAME[c.card.suit!]}
                          <span className="dim">{c.suitElement}</span></>}
                    </div>
                    <div className="q">{c.position.question}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>这一抽的来历</h2>
              <ul>{reading.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              <p className="sub">
                随机源 <span className="mono">{reading.randomSource}</span>
                　—— 不是 <span className="mono">Math.random()</span>。
                后者在多数引擎里是可预测的伪随机数，而一个看起来随机、
                实际可预测的洗牌，比明说自己不随机更糟。
                取整也用拒绝采样而非取模：78 不整除 2<sup>32</sup>，
                取模会让小余数多出现 —— 偏差约 1e-8，实际看不出来，
                但「看不出来」不是正确的理由。
              </p>
            </div>
          </>
        )}

        <div className="card">
          <h2>为什么这里没有牌义</h2>
          <p>
            六爻那边，本项目给的是《周易》的<strong>爻辞原文</strong> ——
            一段可考的引文，加上结构分析。塔罗没有对应的东西：
          </p>
          <ul>
            <li>马赛系的小牌（首牌到十）<strong>本来就没有画面</strong>，
              只有花色符号的排列，十八世纪以前也没有成文的牌义</li>
            <li>韦特系（1909）的画面与牌义是<strong>新造的</strong>，
              且与马赛系不兼容</li>
            <li>各家差异之大，不存在一个可引的底本</li>
          </ul>
          <p>
            所以这一页给的是<strong>牌的身份与牌阵的问题</strong>，不给断语。
            一个没有底本的牌义表写出来只能是编的，
            而编出来的东西读起来与有来历的一模一样 ——
            那正是本项目从头到尾在防的那件事。
          </p>
          <p className="sub">
            牌阵其实是这套东西里最经得起说的部分：它是一组
            <strong>预先定好的问题</strong>，在抽牌之前就固定下来。
            那与「先看到牌再决定它回答什么」有本质区别 ——
            后者是事后编故事，而预先定位置至少把这条路堵上了一半。
          </p>
        </div>

        <div className="card">
          <h2>待核对</h2>
          <ul>{TAROT_PENDING_CALIBRATION.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </div>
    </>
  );
}

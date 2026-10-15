"use client";

import { useState } from "react";
import {
  drawSpread, SPREADS, spreadStateSpace, SUIT_NAME, loadParams,
  type TarotReading,
} from "@fate/core";

/**
 * 移动版塔罗。
 *
 * ## 为什么它与六爻放在同一个标签底下
 *
 * 两者都是「问一件具体的事」，但**规矩正好相反**：
 *
 * - 六爻有「一事不二占」—— 同一个问题当天只起一次
 * - 塔罗想抽几次抽几次
 *
 * 摆在一起，这个差别看得见；分成两个标签，读者只会以为是两个功能。
 * 而那个差别不是随意，是确定与随机的分别：六爻反复重问等于一直问到
 * 自己满意为止，而塔罗每一次抽本来就是一次新的试验。
 *
 * ## 这里同样不给牌义
 *
 * 理由与桌面版一样：塔罗没有六爻那样可引的底本。
 * 六爻那边本项目给的是《周易》爻辞原文；塔罗给不出对应的东西，
 * 故只给牌的身份与牌阵位置的问题。
 */

export function Tarot() {
  const [spreadId, setSpreadId] = useState("three");
  const [withReversals, setWithReversals] = useState(false);
  const [reading, setReading] = useState<TarotReading | null>(null);

  const spread = SPREADS.find((s) => s.id === spreadId)!;

  return (
    <>
      <p className="m-lede">
        洗牌就是它的起法全部。<strong>不要出生信息，也不要时刻</strong> ——
        九套占法里只有这一套，起牌连今天是哪天都不需要知道。
      </p>

      <div className="m-note">
        <strong>这里没有「一事不二占」。</strong>
        六爻那边有那条规矩，是因为同一个时刻重起会得到同一个卦，
        反复重问等于一直问到自己满意为止。
        塔罗每抽一次就是一次新的试验，<strong>重抽本来就是另一回事</strong> ——
        那是它的性质，不是漏洞。所以这一页随你抽多少次。
      </div>

      <div className="m-form">
        <div className="m-field">
          <label>用哪个牌阵</label>
          <select value={spreadId} onChange={(e) => {
            setSpreadId(e.target.value); setReading(null);
          }}>
            {SPREADS.map((s) => (
              <option key={s.id} value={s.id}>{s.name}（{s.positions.length} 张）</option>
            ))}
          </select>
        </div>
        <div className="m-field">
          <label className="inline">
            <input type="checkbox" checked={withReversals}
              onChange={(e) => { setWithReversals(e.target.checked); setReading(null); }} />
            用逆位
          </label>
        </div>
        <button className="m-btn"
          onClick={() => setReading(drawSpread({
            spreadId, params: loadParams({ tarot: { withReversals } }),
          }))}>
          {reading === null ? "抽牌" : "再抽一次"}
        </button>
      </div>

      <p className="m-lede" style={{ marginTop: 12, fontSize: 12 }}>
        {spread.note}
      </p>

      {reading !== null && (
        <>
          <h2 className="m-sec">{reading.spread.name}</h2>
          {reading.cards.map((c) => (
            <div className="m-card" key={c.position.index}>
              <h3>
                <span className="dim" style={{ fontWeight: 400, fontSize: 12 }}>
                  {c.position.index + 1}　{c.position.name}
                </span>
              </h3>
              <p style={{ fontFamily: "var(--serif)", fontSize: 17, marginBottom: 4 }}>
                {c.card.name}
                {c.reversed && (
                  <span className="dim" style={{ fontSize: 11, marginLeft: 7 }}>逆位</span>
                )}
              </p>
              <p className="dim">
                {c.majorNumber !== null
                  ? <>大牌 {c.majorNumber}
                    {c.card.unnamedInMarseille === true
                      && "　这一张在马赛系的牌面上本来就不写名字"}</>
                  : <>{SUIT_NAME[c.card.suit!]}　{c.suitElement}</>}
              </p>
              <p style={{ fontSize: 13.5, marginTop: 8, paddingTop: 8,
                borderTop: "1px dashed var(--line)" }}>
                {c.position.question}
              </p>
            </div>
          ))}

          <div className="m-note">
            <strong>这一页不给牌义，而且那不是省略。</strong>
            六爻那边本项目给的是《周易》的爻辞原文 —— 一段查得到的引文。
            塔罗没有对应的东西：马赛系的小牌本来就没有画面也没有成文牌义，
            韦特系（1909）的牌义是新造的，各家差异大到没有一个可引的底本。
            <br /><br />
            一份没有底本的牌义表写出来只能是编的，
            而编出来的东西读起来与有来历的一模一样。
            所以这里只给牌是哪一张、以及这个位置<strong>问的是什么</strong>。
          </div>

          <div className="m-note">
            这个牌阵一共有 {spreadStateSpace(reading.spread, withReversals).toLocaleString()} 种
            可能的结果。洗牌用的是浏览器的密码学随机源，不是普通的伪随机数 ——
            后者看起来随机而实际可预测，那比明说自己不随机更糟。
          </div>
        </>
      )}

      {reading === null && (
        <div className="m-note">
          牌阵是一组<strong>先定好的问题</strong>，在抽牌之前就固定下来。
          这件事要紧：先定位置、后翻牌，与先看到牌再决定它回答什么，
          是两回事 —— 后者是事后编故事。
        </div>
      )}
    </>
  );
}

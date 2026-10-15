"use client";

import { useMemo } from "react";
import {
  buildZiweiChart, readZiwei, ziweiStateSpace,
  ZIWEI_PENDING_CALIBRATION, discloses,
} from "@fate/core";
import { useChart } from "../../../lib/chartContext";

/**
 * 紫微斗数页。
 *
 * ## 排盘用十二宫的方图，不用列表
 *
 * 紫微的盘自古是**四方十二宫**：外圈十二格，顺着地支绕一圈，中间留白写基本资料。
 * 换成一张十二行的表，读起来是另一回事 —— 对宫（相隔六位）与三方四正
 * （相隔四位）在方图上一眼可见，在列表里要数行数。
 * 那些关系正是这套东西的全部，所以图形不是装饰。
 *
 * ## 这一页与「星盘」页的对照是刻意的
 *
 * 两页都排「星」，但：
 *
 * - 星盘的星是**真天体**，位置要算星历，要经纬度
 * - 紫微的星是**虚星**，由农历日与时辰的算术摆进宫位，连地点都不要
 *
 * 把这两页摆在同一组导航下，读者自己就能看出这个分别 ——
 * 而那比在书里写十遍都管用。
 */

/** 方图的十二格位置：地支 → [行, 列]，外圈顺时针，中间留空。 */
const GRID: Readonly<Record<number, readonly [number, number]>> = {
  5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],     // 巳 午 未 申
  4: [2, 1], 9: [2, 4],                            // 辰 … 酉
  3: [3, 1], 10: [3, 4],                           // 卯 … 戌
  2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4],     // 寅 丑 子 亥
};

export default function ZiweiPage() {
  const { record, audience, params } = useChart();

  const zw = useMemo(() => {
    if (record === null) return null;
    try { return buildZiweiChart(record.input, { params }); } catch { return null; }
  }, [record, params]);

  const reading = useMemo(() => (zw === null ? null : readZiwei(zw)), [zw]);
  const space = useMemo(() => ziweiStateSpace(), []);

  if (record === null) return null;
  if (zw === null) return <p className="sub">这张生辰排不出紫微盘。</p>;

  return (
    <>
      <p className="sub">
        与前面各页<strong>同一个出生时刻</strong>，但这一套既不查星历，
        也不看节气，<strong>连出生地点都不要</strong> ——
        整张盘由五个整数推出：农历年干支、农历月、农历日、时辰、性别。
      </p>

      <div className="card">
        <h2>基本</h2>
        <div className="kv">
          <div><span className="dim">农历</span>
            <b>{zw.lunar.year} 年{zw.lunar.isLeap ? "闰" : ""}{zw.lunar.month} 月
              {zw.lunar.day} 日</b></div>
          <div><span className="dim">年干支</span>
            <b>{zw.yearStem}{zw.yearBranch}</b>
            <span className="dim">（{zw.yearBasis}）</span></div>
          <div><span className="dim">五行局</span>
            <b>{zw.bureau.bureau}</b>
            <span className="dim">命宫 {zw.bureau.mingStem}{zw.bureau.mingBranch}
              · 纳音{zw.bureau.nayin}</span></div>
          <div><span className="dim">大限</span><b>{zw.limitDirection}</b></div>
        </div>
        <p className="sub">
          <strong>年干支取的是农历年，以正月初一为界</strong> ——
          而四柱的年柱以立春为界，两者差着十天到一个多月。
          生在这两个日子之间的人，两套给出的年干支不是同一个，
          而年干在这里决定四化、禄存、羊陀、魁钺。
        </p>
      </div>

      {zw.warnings.length > 0 && (
        <div className="card">
          <h2>这张盘的来历</h2>
          <ul>{zw.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <h2>命盘</h2>
        <div className="zw-grid">
          {zw.palaces.map((p) => {
            const [r, c] = GRID[p.index]!;
            return (
              <div key={p.index} className="zw-cell"
                style={{ gridRow: r, gridColumn: c }}>
                <div className="zw-stars">
                  {p.stars.map((s) => (
                    <span key={s.name} className={`zw-star g${s.group}`}>
                      {s.name}
                      {p.sihua.filter((h) => h.star === s.name).map((h) => (
                        <sup key={h.kind} className="zw-hua">{h.kind.slice(1)}</sup>
                      ))}
                    </span>
                  ))}
                </div>
                <div className="zw-foot">
                  <span className="zw-limit">
                    {p.majorLimit!.from}–{p.majorLimit!.to}
                  </span>
                  <span className="zw-name">
                    {p.name}
                    {p.isShen && <em>身</em>}
                  </span>
                  <span className={p.isMing ? "zw-gz on" : "zw-gz"}>
                    {p.stem}{p.branch}
                  </span>
                </div>
              </div>
            );
          })}
          <div className="zw-center">
            <div><b>{zw.yearStem}{zw.yearBranch}</b> 年
              {zw.gender === "male" ? "男" : "女"}</div>
            <div className="dim">{zw.bureau.bureau}　大限{zw.limitDirection}</div>
            <div className="dim" style={{ marginTop: 8 }}>
              {zw.sihua.map((h) => `${h.star}${h.kind}`).join("　")}
            </div>
          </div>
        </div>
        <p className="sub">
          宫名下方是该宫的干支，命宫标出。左侧数字是大限的起止岁数。
          星名右上角的单字是四化（禄权科忌）。
        </p>
      </div>

      {reading !== null && (
        <>
          <div className="card">
            <h2>盘面怎么读</h2>
            <p className="sub">
              紫微的读法从来<strong>不是一宫一宫单看</strong>，而是成组地看：
              本宫、对宫，加三合的另两宫 —— 合称<strong>三方四正</strong>，四宫同看。
              对命宫而言，那三合的两宫恰是<strong>财帛与官禄</strong>，
              那不是巧合，是十二宫逆行排布的直接后果。
            </p>

            {([["命宫", reading.ming], ["身宫", reading.shen]] as const).map(
              ([label, r]) => (
                <div key={label} style={{ marginTop: 14 }}>
                  <h3 style={{ fontSize: 14.5 }}>
                    {label}　<span className="dim">{r.palace.branch}
                      {r.palace.name}</span>
                  </h3>
                  <p style={{ fontSize: 14 }}>{r.why}。</p>
                  <table style={{ marginTop: 8 }}>
                    <thead>
                      <tr><th>位</th><th>宫</th><th>主星</th></tr>
                    </thead>
                    <tbody>
                      {r.sanfangStars.map((x) => (
                        <tr key={x.branch}>
                          <td className="dim">{x.role}</td>
                          <td><span className="mono dim">{x.branch}</span> {x.palace}</td>
                          <td>{x.majors.length === 0
                            ? <span className="dim">（无主星）</span>
                            : x.majors.join("、")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            <p className="sub" style={{ marginTop: 12 }}>
              某一宫没有主星时，传统做法是<strong>借对宫的主星来看</strong>。
              那不是权宜 —— 本宫与对宫本就同看，空宫只是把重心挪到了对面。
            </p>
          </div>

          {reading.geju.length > 0 && (
            <div className="card">
              <h2>格局</h2>
              <p className="sub">
                某几颗星凑在三方四正里，传统上另有名目。
                这里只收<strong>由落位直接判定、各家名目一致</strong>的几种。
              </p>
              <table>
                <thead>
                  <tr><th>名目</th><th>要哪几颗</th><th>见到</th><th>齐否</th></tr>
                </thead>
                <tbody>
                  {reading.geju.map((g) => (
                    <tr key={g.name}>
                      <td>{g.name}</td>
                      <td className="dim">{g.stars.join("、")}</td>
                      <td>{g.seen.join("、")}</td>
                      <td>{g.complete ? "齐" : <span className="dim">不齐</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reading.geju.map((g) => (
                <p key={g.name} className="sub" style={{ marginTop: 8 }}>
                  <strong>{g.name}</strong>　{g.why}
                </p>
              ))}
            </div>
          )}

          <div className="card">
            <h2>四化落在哪儿</h2>
            <p className="sub">
              四化不摆新星，它把<strong>已有的星所在的那一宫</strong>牵动起来。
              落在命宫三方四正内的，传统上认为与命宫直接相关。
            </p>
            <table>
              <thead>
                <tr><th>化</th><th>星</th><th>落宫</th><th>在命宫三方四正内</th></tr>
              </thead>
              <tbody>
                {reading.sihua.map((h) => (
                  <tr key={h.kind}>
                    <td>{h.kind}</td>
                    <td>{h.star}</td>
                    <td>{h.palace === null
                      ? <span className="dim">该星不在本实现收录之列</span>
                      : <><span className="mono dim">{h.branch}</span> {h.palace}</>}</td>
                    <td>{h.inMingSanfang ? "是" : <span className="dim">否</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>这一层解读到哪儿为止</h2>
            <ul>{reading.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        </>
      )}

      <div className="card">
        <h2>⚠️ 这些「星」不是天上的星</h2>
        <p>
          紫微、天府、贪狼、廉贞 —— 这些名字来自星官，
          但它们<strong>不是天体</strong>，是按农历日与时辰的算术规则
          摆进十二宫的<strong>虚星</strong>。
          真正的紫微垣（北极一带的星官）一次都不进计算。
        </p>
        <p>
          这不是贬低。虚星体系自有其一致性，而且完全可复算 ——
          问题只在于把它说成「观星」是归错了档。
          隔壁的<a href="/chart/sky">星盘</a>那一页排的才是真天体：
          那里要算星历，要经纬度；这里一样都不要。
        </p>
        <p className="sub">
          但别把结论推过头：紫微<strong>自己</strong>不算天象，
          它吃的农历却是实测的 —— 定朔要真算合朔，置闰要看中气。
          所以它落在「历法派生」这一档，不是「纯约定」那一档（那一档只有塔罗）。
        </p>
      </div>

      {discloses(audience, "numbers") && (
        <div className="card">
          <h2>这套起法能分出多少张不同的盘</h2>
          <p>
            输入的基数是 <span className="mono">60 × 12 × 30 × 12 × 2 =
            {" "}{space.inputs.toLocaleString()}</span>
            （农历年干支 × 月 × 日 × 时辰 × 性别）。
          </p>
          <p>
            但穷举之后，它们只落到
            {" "}<strong className="mono">{space.distinctCharts.toLocaleString()}</strong>
            {" "}张<strong>不同的盘</strong>上 ——
            恰好 {space.collapseRatio.toFixed(0)} 个输入合成一张。
            坍缩主要来自「日 → 紫微落点」是多对一：一局之内三十天只摊到十二宫。
          </p>
          <p className="sub">
            穷举还给出一个意外的结果：<strong>星曜布局唯一决定命宫位置与年干四化</strong>。
            把那两样加进比对的键，一张盘都没有多分出来。
          </p>
          <p className="sub">{space.note.replace(/\*\*/g, "")}</p>
        </div>
      )}

      <div className="card">
        <h2>待核对</h2>
        {discloses(audience, "calibrationNotes") ? (
          <ul>{ZIWEI_PENDING_CALIBRATION.map((x) => <li key={x}>{x}</li>)}</ul>
        ) : (
          <p className="sub">
            这一套用到 {ZIWEI_PENDING_CALIBRATION.length} 项尚未拿实体书核对的数据。
            清单是工程信息，这一档不展开；换到「学习中」或「命理师」可以看到。
          </p>
        )}
      </div>
    </>
  );
}

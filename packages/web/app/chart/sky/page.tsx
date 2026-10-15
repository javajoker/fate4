"use client";

import { useMemo } from "react";
import { asTT, deltaTSeconds, discloses } from "@fate/core";
import {
  skyChart, aspectsOf, compareWithHellenistic, ASPECT_NAME,
  SKY_PENDING_CALIBRATION, SIYU_DIGNITY_NOT_INCLUDED, BODY_NAME,
} from "@fate/core/sky";
import { useChart } from "../../../lib/chartContext";

/**
 * 星盘页 —— 同一个出生时刻的另一套读法。
 *
 * ## 为什么它在 /chart 底下，又与别的页不同类
 *
 * 它用的是**同一条命盘记录**（同一时刻、同一地点），故放在 /chart 之下
 * 是对的 —— 重新要一次生辰是多余的，而且会让人以为这是另一个人。
 *
 * 但它**不是四柱的又一个视图**，是另一套占法。故顶栏把它与前面十二页
 * 分成两组：那十二页读的是同一张八字，这一页读的是同一个时刻的星空。
 * 混在一排里，读者会以为「星盘」是四柱的一个分支，而那正好说反了。
 *
 * ## 纬度在这里第一次成为必需
 *
 * 四柱对地点的依赖只到真太阳时那一层，用经度，纬度根本不进算式。
 * 上升点要纬度，而且跟得很紧 —— 南北差一度，上升点就能差出几度。
 *
 * 故没有纬度时**不默认一个值**，而是明说这一套要它。
 * 随手填一个纬度算出来的上升点，看起来和真的一模一样。
 */

/** 两套读法并排。这张表是本页的主体 —— 同一行，两种读。 */
function BodyTable({ chart, audience }: {
  chart: ReturnType<typeof skyChart>;
  audience: "lay" | "student" | "practitioner";
}) {
  return (
    <div className="card">
      <h2>七政：同一组位置，两套读法</h2>
      <p className="sub">
        左边三列是位置，由星历算出，两套共用。
        右边两列是<strong>读法</strong> —— 它们各自把同一个位置换成了自己那套话。
      </p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>星</th>
              <th>宫（七政四余）</th>
              <th>宫（现代名）</th>
              <th style={{ textAlign: "right" }}>宫内度</th>
              <th className="split">七政四余</th>
              <th>西洋古典</th>
              {discloses(audience, "numbers") && (
                <th style={{ textAlign: "right" }}>黄经</th>
              )}
            </tr>
          </thead>
          <tbody>
            {chart.bodies.map((b, i) => {
              const q = chart.qizheng[i]!;
              return (
                <tr key={b.body}>
                  <td style={{ fontWeight: 600 }}>{b.name}</td>
                  <td>
                    <span className="mono dim">{q.palace.branch}</span> {q.palace.name}
                  </td>
                  <td className="dim">{b.sign}</td>
                  <td className="mono" style={{ textAlign: "right" }}>
                    {b.degree.toFixed(2)}°
                  </td>
                  <td className="split">
                    <span className="pills">
                      {q.states.map((s) => (
                        <span key={s} className="pill">{s}</span>
                      ))}
                    </span>
                  </td>
                  <td>
                    <span className="pills">
                      {b.dignities.map((h) => (
                        <span key={h.kind} className="pill" title={h.why}>
                          {DIGNITY_LABEL[h.kind] ?? h.kind}
                        </span>
                      ))}
                    </span>
                    {discloses(audience, "numbers") && (
                      <span className="mono dim" style={{ marginLeft: 6 }}>
                        {b.dignityScore > 0 ? `+${b.dignityScore}` : b.dignityScore}
                      </span>
                    )}
                  </td>
                  {discloses(audience, "numbers") && (
                    <td className="mono dim" style={{ textAlign: "right" }}>
                      {b.longitude.toFixed(3)}°
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sub" style={{ marginTop: 10 }}>
        两套的粗细不同，而这个差别是实的：西洋古典分五项（庙、旺、三分、界、面）
        且每项计分可加总；七政四余只分庙旺陷落平五档，<strong>不计分</strong>。
        同一颗土星在磨羯，那边是「庙 + 界」合计 7 分，这边就一个「庙」字 ——
        那是两种不同的野心，不是精度差异。
      </p>
    </div>
  );
}

const DIGNITY_LABEL: Readonly<Record<string, string>> = {
  domicile: "庙", exaltation: "旺", triplicity: "三分", bound: "界", face: "面",
  detriment: "陷", fall: "落", peregrine: "外来",
};

export default function SkyPage() {
  const { chart, record, audience } = useChart();

  const sky = useMemo(() => {
    if (chart === null) return null;
    const lat = chart.input.latitude;
    if (lat === undefined) return null;
    const jdUT = chart.birthJdUT;
    const jdTT = asTT(jdUT
      + deltaTSeconds(chart.input.year, chart.input.month).seconds / 86400);
    return skyChart(jdUT as never, jdTT, chart.input.longitude, lat);
  }, [chart]);

  if (chart === null || record === null) return null;

  // 纬度缺席时不猜一个值。随手填的纬度算出来的上升点看着和真的一样。
  if (chart.input.latitude === undefined) {
    return (
      <div className="card">
        <h2>这一套要纬度</h2>
        <p>
          四柱对出生地的依赖只到真太阳时那一层，用的是<strong>经度</strong>；
          纬度根本不进算式，所以前面十二页都不需要它。
        </p>
        <p>
          上升点不同：它是黄道与<strong>当地地平</strong>的交点，而地平由纬度定。
          同一时刻，南北差一度，上升点能差出几度 —— 足够换一个宫。
        </p>
        <p className="sub">
          这里不替你填一个默认纬度。随手填出来的上升点，
          看起来与真的一模一样，而你无从分辨。
        </p>
        <p><a href="/">回到排盘补上纬度</a></p>
      </div>
    );
  }

  if (sky === null) return <p className="sub">计算中…</p>;

  const aspects = aspectsOf(sky).filter((a) => a.orb <= 8);
  const sameTable = compareWithHellenistic();
  const allSame = sameTable.every((r) => r.domicileSame && r.exaltationSame);

  return (
    <>
      <p className="sub">
        与前面十二页<strong>同一个出生时刻、同一个地点</strong>，
        但这不是四柱的又一个视图 —— 是另一套占法。
        它的输入里多了一样东西：纬度。
      </p>

      <div className="card">
        <h2>四角与昼夜</h2>
        <div className="kv">
          <div><span className="dim">上升</span>
            <b className="mono">{sky.angles.ascendant.toFixed(2)}°</b>
            <span> {sky.ascendantSign}</span></div>
          <div><span className="dim">中天</span>
            <b className="mono">{sky.angles.midheaven.toFixed(2)}°</b></div>
          <div><span className="dim">昼夜</span>
            <b>{sky.isDay ? "昼盘" : "夜盘"}</b></div>
          {discloses(audience, "numbers") && (
            <>
              <div><span className="dim">当地恒星时</span>
                <b className="mono">{sky.angles.localSiderealTime.toFixed(3)}°</b></div>
              <div><span className="dim">黄赤交角</span>
                <b className="mono">{sky.angles.obliquity.toFixed(4)}°</b></div>
            </>
          )}
        </div>
        <p className="sub">
          <strong>昼夜在两套里的地位不同。</strong>西洋古典拿它定三分主星 ——
          同一颗星在同一度上，昼盘得三分之位，夜盘就不得，换一颗星来得。
          七政四余里昼夜不进规则。同一片天、同一个时刻，
          一方把「太阳在地平上还是地平下」编进了规则，另一方没有。
        </p>
        <p className="sub">
          上升点所在的那一宫，既是七政四余的<strong>命宫</strong>，
          也是西洋整宫制的<strong>第一宫</strong>。这里两套是同一宫。
        </p>
      </div>

      <BodyTable chart={sky} audience={audience} />

      <div className="card">
        <h2>四余</h2>
        <div className="kv">
          <div><span className="dim">罗睺（北交点）</span>
            <b className="mono">{sky.siyu.rahu.toFixed(2)}°</b>
            <span> {sky.siyu.rahuSign}</span></div>
          <div><span className="dim">计都（南交点）</span>
            <b className="mono">{sky.siyu.ketu.toFixed(2)}°</b>
            <span> {sky.siyu.ketuSign}</span></div>
          <div><span className="dim">月孛（月远地点）</span>
            <b className="mono">{sky.siyu.yuebei.toFixed(2)}°</b>
            <span> {sky.siyu.yuebeiSign}</span></div>
        </div>
        <p className="sub">
          四余常被当成虚构的符号，其实前三个<strong>是实打实的天文点</strong>：
          月亮轨道的升交点、降交点与远地点，也就是西洋占星里的
          North Node、South Node 与月亮远地点。它们不是类比，是同一批点。
        </p>
        <p className="sub">{SIYU_DIGNITY_NOT_INCLUDED}</p>
      </div>

      <div className="card">
        <h2>相位</h2>
        <p className="sub">
          古典的相位是<strong>整宫之间</strong>的关系，容许度是后世的事。
          两样分开标注，合成一套会让人以为古典占星有现代那种精确的 orb。
        </p>
        {aspects.length === 0
          ? <p className="sub">容许度 8° 之内没有成相的。</p>
          : (
            <table>
              <thead>
                <tr><th>甲</th><th>相</th><th>乙</th>
                  <th style={{ textAlign: "right" }}>差</th><th>整宫</th></tr>
              </thead>
              <tbody>
                {aspects.map((a, i) => (
                  <tr key={i}>
                    <td>{BODY_NAME[a.a]}</td>
                    <td>{ASPECT_NAME[a.kind]}</td>
                    <td>{BODY_NAME[a.b]}</td>
                    <td className="mono" style={{ textAlign: "right" }}>
                      {a.orb.toFixed(2)}°</td>
                    <td>{a.byWholeSign ? <span className="pill">整宫</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {sky.warnings.length > 0 && (
        <div className="card">
          <h2>这张星盘的来历</h2>
          <p className="sub">
            下面几条影响的是盘本身，不是对盘的解读。
          </p>
          <ul>{sky.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <h2>两张庙旺表为什么一模一样</h2>
        <p>
          把七政四余的庙旺与西洋古典的庙旺逐格摆开，
          {allSame ? <><strong>七格全同</strong>（名字不同，宫是同一宫）</>
            : <>有几格不同（见下表）</>}。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>星</th><th>庙（七政四余）</th><th>庙（西洋）</th>
                <th>同</th><th>旺 / 旺</th><th>同</th></tr>
            </thead>
            <tbody>
              {sameTable.map((r) => (
                <tr key={r.body}>
                  <td>{r.name}</td>
                  <td>{r.qizhengMiao.join("、")}</td>
                  <td className="dim">{r.westernDomicile.join("、")}</td>
                  <td>{r.domicileSame ? "✔" : "✗"}</td>
                  <td>{r.qizhengWang} / <span className="dim">{r.westernExaltation}</span></td>
                  <td>{r.exaltationSame ? "✔" : "✗"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 12 }}>
          看见这个，很容易写下一句：「东西方独立得出同一张表，
          可见它反映的是天本身。」<strong>这里不写那句话</strong>，两个理由。
        </p>
        <p>
          一、七政四余唐代随佛经与西域历法入华，印度一系与希腊化天文同源。
          同一张表出现在两处，最省事的解释是<strong>它只被发明过一次</strong> ——
          那是文化传播的证据，不是天文必然性的证据。
        </p>
        <p>
          二、更要紧：<strong>本项目这张表是凭记忆转录的，而转录者读过西洋那张表。</strong>
          一个读过 A 的人凭记忆写下 B，写出来的 B 像 A，
          不构成 B 本来就像 A 的证据 —— 它也可能只是记混了。
        </p>
        <p className="sub">
          所以这一项挂着待核对，并且注明：最好由<strong>不曾先读西洋表的人</strong>去核。
          一个已经知道答案的核对者，核不出那个答案是错的。
        </p>
        <p className="sub">
          能说的是另一件事：<strong>天是共用的，这一点有证据</strong> ——
          日月五星的黄经是同一组数，上升点是同一个点，
          而那些数由两套互相独立的实现逐点对过（最大差 {sky.accuracyArcsec}″）。
          表是不是独立产生的，这一点没有证据。
          天共用是测出来的，表相同是传下来的，两件事不能混。
        </p>
      </div>

      <div className="card">
        <h2>待核对</h2>
        {discloses(audience, "calibrationNotes") ? (
          <ul>{SKY_PENDING_CALIBRATION.map((x) => <li key={x}>{x}</li>)}</ul>
        ) : (
          <p className="sub">
            这一套用到 {SKY_PENDING_CALIBRATION.length} 项尚未拿实体书核对的数据。
            清单是工程信息，这一档不展开；换到「学习中」或「命理师」可以看到。
          </p>
        )}
      </div>
    </>
  );
}

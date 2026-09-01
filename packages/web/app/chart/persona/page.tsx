"use client";

import { useMemo } from "react";
import {
  buildReport, ELEMENT_TRAITS, GOD_TRAITS, label, NEIJING, PILLAR_LABEL,
  TEN_GODS, wuqiaoOf,
} from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { Narrative } from "../../../components/Narrative";
import { ElementRadar, InnerOuterBars } from "../../../components/charts";
import { num, pct } from "../../../lib/format";

export default function PersonaPage() {
  const { base } = useChart();
  const r = useMemo(
    () => (base === null ? null : buildReport(base, { curveYears: 1 })),
    [base],
  );
  if (base === null || r === null || r.persona === null) return null;
  const P = r.persona.persona;

  const rows = TEN_GODS.map((g) => ({ god: g, inner: P.inner[g], outer: P.outer[g] }));
  const highlight = P.divergentGods.map((d) => d.god);

  return (
    <>
      <h1>性格与偏好</h1>
      <p className="sub">
        内与外的划分取「透干为显，藏支为隐」—— 藏而不透的是心里那一面，透干显用的是外人看见的那一面。
        这两个词都是描述<b>结构</b>的，不是对人的评断。
      </p>

      <div className="grid2">
        <div className="card">
          <h3>内外十神对照</h3>
          <InnerOuterBars rows={rows} highlight={highlight} />
        </div>
        <div className="card">
          <h3>五行分布</h3>
          <ElementRadar layers={[{ name: "基础盘", values: base.propagation.byElement }]} />
          <p className="dim" style={{ fontSize: 12 }}>
            偏枯度 <b className="mono">{num(P.elements.skew, 3)}</b> ——
            此值不是缺陷指标，偏枯而成格成局者不在少数。
          </p>
        </div>
      </div>

      <div className="grid3">
        <div className="card">
          <h3>显隐比</h3>
          <p style={{ fontSize: 28, fontFamily: "var(--mono)", margin: 0 }}>{pct(P.revealRatio)}</p>
          <p className="dim" style={{ fontSize: 12 }}>
            结构区间本就窄：八成的盘落在 25%–36% 之间。只在这个区间内部比较才有意义。
          </p>
        </div>
        <div className="card">
          <h3>内外张力</h3>
          <p style={{ fontSize: 28, fontFamily: "var(--mono)", margin: 0 }}>
            {num(P.innerOuterTension, 3)}
          </p>
          <p className="dim" style={{ fontSize: 12 }}>
            按五组算。十档下为 {num(P.innerOuterTensionByGod, 3)} —— 会顶格，只作明细。
            <b>此值不含褒贬。</b>
          </p>
        </div>
        <div className="card">
          <h3>禀气底色</h3>
          <p style={{ fontSize: 28, fontFamily: "var(--serif)", margin: 0 }}>
            {P.silingStem}
            <span className="dim" style={{ fontSize: 14, marginLeft: 8 }}>{P.silingGod}</span>
          </p>
          <p className="dim" style={{ fontSize: 12 }}>月令当权者。是标注，不另加权。</p>
        </div>
      </div>

      <h2>分歧最大的几组</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>组</th><th className="num">内（藏）</th><th className="num">外（透）</th><th>倾向</th></tr></thead>
          <tbody>
            {P.divergentGroups.map((d) => (
              <tr key={d.group}>
                <td>{d.group}</td>
                <td className="num">{pct(d.inner)}</td>
                <td className="num">{pct(d.outer)}</td>
                <td>{d.delta > 0 ? "外显多于内蕴" : "内蕴多于外显"} {pct(Math.abs(d.delta))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>十神特质对照</h2>
      <p className="sub">
        四栏并列是必要的：同一个十神，适度与太过的解读相反 ——
        食神适中为温和从容，太过则疏懒无争。只看它在不在，什么也说明不了。
        底本 <span className="mono">{P.source}</span>，可经参数替换。
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>十神</th><th className="num">占比</th>
              <th>藏（内）</th><th>透（外）</th><th>过旺</th><th>过弱 / 缺</th>
            </tr>
          </thead>
          <tbody>
            {TEN_GODS.map((g) => {
              const t = GOD_TRAITS[g];
              const share = (P.inner[g] * P.innerTotal + P.outer[g] * P.outerTotal)
                / (P.innerTotal + P.outerTotal);
              const isExcess = P.excess.includes(g);
              const isAbsent = P.absent.includes(g);
              const isWeak = P.deficient.includes(g);
              return (
                <tr key={g} style={{
                  background: isExcess || isAbsent ? "var(--accent-soft)" : undefined,
                }}>
                  <td>
                    {g}
                    {isExcess && <span className="pill">过旺</span>}
                    {isAbsent && <span className="pill">缺</span>}
                    {isWeak && <span className="pill">弱</span>}
                  </td>
                  <td className="num">{pct(share)}</td>
                  <td className={isExcess || isAbsent ? "dim" : undefined}>{t.inner.join("、")}</td>
                  <td className={isExcess || isAbsent ? "dim" : undefined}>{t.outer.join("、")}</td>
                  <td className={isExcess ? undefined : "dim"}>{t.excess.join("、")}</td>
                  <td className={isAbsent || isWeak ? undefined : "dim"}>{t.deficient.join("、")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>五行与五常</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>五行</th><th>五常</th><th className="num">占比</th><th className="num">受克</th><th>盛</th><th>弱</th></tr></thead>
          <tbody>
            {(Object.keys(ELEMENT_TRAITS) as (keyof typeof ELEMENT_TRAITS)[]).map((e) => {
              const t = ELEMENT_TRAITS[e];
              const strong = e === P.elements.strongest;
              const weak = e === P.elements.weakest;
              return (
                <tr key={e} style={{ background: strong || weak ? "var(--accent-soft)" : undefined }}>
                  <td>{e}{e === P.elements.mostAttacked && <span className="pill">受克最重</span>}</td>
                  <td>{t.virtue}</td>
                  <td className="num">{pct(P.elements.share[e])}</td>
                  <td className="num">{num(P.elements.attack[e])}</td>
                  <td className={strong ? undefined : "dim"}>{t.strong.join("、")}</td>
                  <td className={weak ? undefined : "dim"}>{t.weak.join("、")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>宫位</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>宫</th><th>位</th><th className="num">占全盘</th><th>宫中十神</th><th>受制</th><th>神煞</th></tr></thead>
          <tbody>
            {P.palaces.map((pal) => (
              <tr key={`${pal.pillar}.${pal.layer}`}>
                <td>{pal.palace}</td>
                <td className="dim">
                  {label(PILLAR_LABEL, pal.pillar)}{pal.layer === "stem" ? "干" : "支"}
                </td>
                <td className="num">{pct(pal.share)}</td>
                <td>
                  {pal.isDayMaster ? <span className="pill">日主</span>
                    : TEN_GODS.filter((g) => pal.gods[g] > 0)
                      .sort((a, b) => pal.gods[b] - pal.gods[a])
                      .map((g) => <span key={g} className="pill">{g} {num(pal.gods[g])}</span>)}
                </td>
                <td className="dim">{pal.afflicted.map((e) => e.narrativeTag).join("、") || "—"}</td>
                <td className="dim">{pal.shensha.map((h) => h.name).join("、") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Narrative lines={r.persona.narrative} />

      {r.body !== null && <BodySection body={r.body.body} lines={r.body.narrative} />}
    </>
  );
}

/**
 * §2.6 形体与脏腑。
 *
 * 界面上的措辞与报告层同源（`r.body.narrative`），此处只加表格与图例。
 * 表格里出现的全是器官名与配属，**没有一个病名** —— 这条由 core 的
 * `zh.medical.diseaseName` 规则无条件保证，界面不另设一套。
 */
function BodySection({ body, lines }: {
  body: NonNullable<ReturnType<typeof buildReport>["body"]>["body"];
  lines: NonNullable<ReturnType<typeof buildReport>["body"]>["narrative"];
}) {
  const els = Object.keys(body.details) as (keyof typeof body.details)[];
  return (
    <>
      <h2>形体与脏腑对照</h2>
      <p className="sub">
        以下是<b>传统对照</b>与<b>本盘数值</b>的并列陈述，不构成任何关于身体状况的判断，
        亦不指向任何具体病症。健康相关的决定请咨询持证专业人士。
      </p>

      <div className="grid2">
        <div className="card">
          <h3>寒热</h3>
          <p style={{ fontSize: 26, fontFamily: "var(--serif)", margin: 0 }}>
            {body.axes.heatLabel}
            <span className="mono dim" style={{ fontSize: 14, marginLeft: 10 }}>
              {num(body.axes.heat, 3)}
            </span>
          </p>
          <p className="dim" style={{ fontSize: 12 }}>热势（火 + ½木）− 寒势（水 + ½金），含月令修正。</p>
        </div>
        <div className="card">
          <h3>燥湿</h3>
          <p style={{ fontSize: 26, fontFamily: "var(--serif)", margin: 0 }}>
            {body.axes.drynessLabel}
            <span className="mono dim" style={{ fontSize: 14, marginLeft: 10 }}>
              {num(body.axes.dryness, 3)}
            </span>
          </p>
          <p className="dim" style={{ fontSize: 12 }}>
            燥势（火 + 燥土）− 湿势（水 + 湿土）。燥土藏于未戌，湿土藏于辰丑。
          </p>
        </div>
      </div>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>五行</th><th className="num">占比</th><th>虚实</th>
              <th className="num">受克份额偏离</th><th className="num">阳干份额</th>
              <th>脏</th><th>腑</th><th>窍</th><th>体</th><th>华</th><th>液</th><th>志</th><th>气</th>
            </tr>
          </thead>
          <tbody>
            {els.map((e) => {
              const d = body.details[e];
              const row = NEIJING[e];
              const focus = body.focus.includes(e);
              return (
                <tr key={e} style={{ background: focus ? "var(--accent-soft)" : undefined }}>
                  <td>{e}{focus && <span className="pill">详述</span>}</td>
                  <td className="num">{pct(d.share)}</td>
                  <td>{d.state}</td>
                  <td className="num">{num(d.attackDeviation, 2)}</td>
                  <td className="num">{pct(d.yangShare, 0)}</td>
                  <td>{row.zang}</td><td>{row.fu}</td>
                  <td>{wuqiaoOf(e, body.wuqiaoSource)}</td>
                  <td>{row.ti}</td><td>{row.hua}</td><td>{row.ye}</td>
                  <td>{row.zhi}</td><td>{row.qi}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="sub">
        五窍取
        <span className="mono"> {body.wuqiaoSource === "yinyangYingxiang"
          ? "《素问·阴阳应象大论》" : "《素问·金匮真言论》"} </span>
        一系。这是内经内部的<b>真实分歧</b>，非转录疏漏 ——
        阴阳应象大论作「心在窍为舌、肾在窍为耳」，金匮真言论作「心开窍于耳、肾开窍于二阴」。
        默认取前者（亦即后世主流），另一派可经参数切换，且随盘声明。
        配属表底本 <span className="mono">{body.neijingSource}</span>。
      </p>

      <Narrative lines={lines} />
    </>
  );
}

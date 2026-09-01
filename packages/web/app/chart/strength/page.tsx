"use client";

import { useMemo } from "react";
import { buildReport, BAND_LABEL_ZH, label, QUADRANT_LABEL, YONGSHEN_METHOD_LABEL } from "@fate/core";
import type { DerivationStep, Verdict } from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { Narrative } from "../../../components/Narrative";
import { num } from "../../../lib/format";

function Derivation({ steps }: { steps: readonly DerivationStep[] }) {
  return (
    <ol style={{ fontSize: 13, color: "var(--ink-2)", paddingLeft: 20 }}>
      {steps.map((d, i) => (
        <li key={i}><b>{d.step}</b> — {d.detail}</li>
      ))}
    </ol>
  );
}

function Alternatives<T>({ v, render }: { v: Verdict<T>; render: (t: T) => string }) {
  if (v.alternatives.length === 0) return null;
  return (
    <>
      <h3>替代解读</h3>
      <ul className="narrative">
        {v.alternatives.map((a, i) => (
          <li key={i} className="hedged">
            <b>{render(a.value)}</b> —— {a.reason}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function StrengthPage() {
  const { base } = useChart();
  const r = useMemo(
    () => (base === null ? null : buildReport(base, { curveYears: 1 })),
    [base],
  );
  if (r === null) return null;
  const S = r.strength;

  return (
    <>
      <h1>旺衰与取用</h1>
      <p className="sub">
        置信度不是装饰。落在阈值边缘的盘，报告会自动改用留有余地的措辞，并列出另一种取法 ——
        临界盘就是临界盘，不该被强行归类。
      </p>

      <Narrative lines={S.narrative} />

      <div className="grid2">
        <div className="card">
          <h3>日主旺衰</h3>
          <p style={{ fontSize: 24, fontFamily: "var(--serif)", margin: "4px 0" }}>
            {label(BAND_LABEL_ZH, S.strength.value)}
            <span className="mono dim" style={{ fontSize: 13, marginLeft: 10 }}>
              置信度 {num(S.strength.confidence, 2)}
            </span>
          </p>
          <Derivation steps={S.strength.derivation} />
          <Alternatives v={S.strength} render={(b) => label(BAND_LABEL_ZH, b)} />
        </div>
        <div className="card">
          <h3>通根明细</h3>
          <table>
            <thead><tr><th>支</th><th>等级</th><th className="num">贡献</th></tr></thead>
            <tbody>
              {S.rootDetail.length === 0 && <tr><td colSpan={3} className="dim">四支无根</td></tr>}
              {S.rootDetail.map((d, i) => (
                <tr key={i}><td>{d.branch}</td><td>{d.kind}</td>
                  <td className="num">{num(d.contribution, 2)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mono" style={{ marginTop: 8 }}>合计 {num(S.rootScore, 2)}</p>
        </div>
      </div>

      <h2>特殊格局</h2>
      <div className="card">
        <p>
          {S.specialPattern.value === null ? "未命中从格、专旺、化气三类特殊格局。"
            : S.specialPattern.value.kind === "congge"
              ? `从格（${S.specialPattern.value.subtype}），从${S.specialPattern.value.element}`
              : S.specialPattern.value.kind === "zhuanwang"
                ? `专旺格（${S.specialPattern.value.name}），归${S.specialPattern.value.element}`
                : `化气格，化${S.specialPattern.value.element}`}
          <span className="mono dim" style={{ marginLeft: 10 }}>
            置信度 {num(S.specialPattern.confidence, 2)}
          </span>
        </p>
        <Derivation steps={S.specialPattern.derivation} />
      </div>

      <h2>用神 · 喜忌</h2>
      <div className="card">
        <p>
          取 <b style={{ fontSize: 20 }}>{S.yongshen.value.primary}</b> 为用，
          法从<b>{label(YONGSHEN_METHOD_LABEL, S.yongshen.value.method)}</b>
          <span className="mono dim" style={{ marginLeft: 10 }}>
            置信度 {num(S.yongshen.confidence, 2)}
          </span>
        </p>
        <table style={{ maxWidth: 480, margin: "10px 0" }}>
          <tbody>
            <tr><th>喜神（生用神者）</th><td>{S.yongshen.value.xishen.join("、")}</td></tr>
            <tr><th>忌神（克用神者）</th><td>{S.yongshen.value.jishen.join("、")}</td></tr>
            <tr><th>仇神（生忌神者）</th><td>{S.yongshen.value.choushen.join("、")}</td></tr>
            <tr><th>闲神</th><td>{S.yongshen.value.xianshen.join("、")}</td></tr>
            <tr><th>用神在盘权重</th><td className="num">{num(S.yongshen.value.strength)}</td></tr>
          </tbody>
        </table>
        {S.yongshen.value.needsLuckSupport && (
          <p className="dim">
            用神无力：取向明确而盘中力量不足，须待大运送来同气方能起用。
            这一项常被略过，却直接决定运程的节奏。
          </p>
        )}
        <Derivation steps={S.yongshen.derivation} />
        <Alternatives v={S.yongshen} render={(y) => `取 ${y.primary}（${label(YONGSHEN_METHOD_LABEL, y.method)}）`} />
      </div>

      <h2>月令格局</h2>
      <div className="card">
        <p>
          <b style={{ fontSize: 18 }}>{S.geju.value.name}</b>
          　以 {S.geju.value.god} 定格　{S.geju.value.usage}
          <span className="mono dim" style={{ marginLeft: 10 }}>置信度 {num(S.geju.confidence, 2)}</span>
        </p>
        <p>相神 {S.geju.value.xiangshen.join("、") || "—"}　
          <span className="dim">败格之神 {S.geju.value.breakers.join("、") || "—"}</span></p>
        <Derivation steps={S.geju.derivation} />
      </div>

      {S.yongshenGejuTension && (
        <div className="card" style={{ borderColor: "var(--warm)" }}>
          <h3>取用与格局取向不一致</h3>
          <p>
            两条线在此<b>并列</b>呈现，不作合并。合并会把这张盘真正的张力所在抹掉 ——
            扶抑与格局本就是两条独立的判定线，允许不一致。
          </p>
        </div>
      )}

      <h2>宫星四象限速览</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>六亲</th><th>象限</th><th className="num">置信度</th></tr></thead>
          <tbody>
            {r.kin.readings.map((k) => (
              <tr key={k.kin}>
                <td>{k.label}</td>
                <td>{label(QUADRANT_LABEL, k.quadrant)}</td>
                <td className="num">{num(k.confidence, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

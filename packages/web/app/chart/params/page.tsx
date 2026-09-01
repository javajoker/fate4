"use client";

import { useMemo, useRef, useState } from "react";
import {
  buildChart, DEFAULT_PARAMS, evaluate, label, loadParams, paramsHash,
  BAND_LABEL_ZH, YONGSHEN_METHOD_LABEL, type PartialParams,
} from "@fate/core";
import { useChart } from "../../../lib/chartContext";
import { ElementRadar } from "../../../components/charts";
import { getAt, PARAM_GROUPS, setAt, type ParamSpec } from "../../../lib/paramSpec";
import { num, pct } from "../../../lib/format";
import { putChart } from "../../../lib/storage";

function Row({ item, value, def, onChange }: {
  item: ParamSpec; value: unknown; def: unknown; onChange: (v: unknown) => void;
}) {
  const dirty = JSON.stringify(value) !== JSON.stringify(def);
  return (
    <tr style={{ background: dirty ? "var(--accent-soft)" : undefined }}>
      <td style={{ width: 210 }}>
        {item.name}
        {item.tag !== undefined && <span className="pill" style={{ marginLeft: 6 }}>{item.tag}</span>}
        <div className="dim" style={{ fontSize: 11, lineHeight: 1.5 }}>{item.note}</div>
        <div className="mono dim" style={{ fontSize: 10 }}>{item.path}</div>
      </td>
      <td style={{ width: 260 }}>
        {item.spec.kind === "number" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="range" min={item.spec.min} max={item.spec.max} step={item.spec.step}
              value={Number(value)} style={{ flex: 1, padding: 0 }}
              onChange={(ev) => onChange(Number(ev.target.value))} />
            <input type="number" min={item.spec.min} max={item.spec.max} step={item.spec.step}
              value={Number(value)} style={{ width: 84 }}
              onChange={(ev) => onChange(Number(ev.target.value))} />
          </div>
        )}
        {item.spec.kind === "bool" && (
          <input type="checkbox" checked={Boolean(value)} style={{ width: 18 }}
            onChange={(ev) => onChange(ev.target.checked)} />
        )}
        {item.spec.kind === "enum" && (
          <select value={String(value)} onChange={(ev) => onChange(ev.target.value)} style={{ width: "100%" }}>
            {item.spec.options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        )}
      </td>
      <td className="num dim" style={{ width: 90 }}>
        {typeof def === "number" ? num(def, 3) : String(def)}
      </td>
      <td style={{ width: 60 }}>
        {dirty && <button className="ghost" onClick={() => onChange(def)}>还原</button>}
      </td>
    </tr>
  );
}

export default function ParamsPage() {
  const { chart, params, overrides, setOverrides, record } = useChart();
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => {
    if (chart === null) return null;
    try {
      const ev = evaluate({ chart, params });
      return { ev, err: null as string | null };
    } catch (e) {
      return { ev: null, err: String(e) };
    }
  }, [chart, params]);

  const base = useMemo(() => {
    if (record === null) return null;
    try {
      return evaluate({ chart: buildChart(record.input), params: DEFAULT_PARAMS });
    } catch { return null; }
  }, [record]);

  const change = (path: string, v: unknown) => {
    const next = setAt(overrides, path, v) as PartialParams;
    try {
      loadParams(next);          // 立刻校验：区间、枚举、结构不变量
      setErr(null);
      setOverrides(next);
    } catch (e) {
      setErr(String(e));
    }
  };

  if (chart === null || record === null) return null;

  return (
    <>
      <h1>参数校准</h1>
      <p className="sub">
        改一个系数，右侧盘面立即重算。一套有几十个自由参数的模型，没有这个面板是无法被验证的。
        每次改动都先跑一遍参数校验 —— 区间、枚举、以及**结构不变量**
        （天干地支占比之和须为 1、旺衰四阈值须严格递减、流月流日不得重算权重…），
        违反者会被当场拦下，不会静默产出一张错误的盘。
      </p>

      {err !== null && (
        <div className="card" style={{ borderColor: "var(--warm)" }}>
          <b>参数校验未通过，该项改动已被拒绝：</b>
          <pre className="export" style={{ maxHeight: 200 }}>{err}</pre>
        </div>
      )}

      <div className="card" style={{ position: "sticky", top: 56, zIndex: 5 }}>
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div className="dim" style={{ fontSize: 11 }}>日主旺衰</div>
            <b>{label(BAND_LABEL_ZH, result?.ev?.conclusions.strength.value ?? "")}</b>
            {base !== null && base.conclusions.strength.value !== result?.ev?.conclusions.strength.value && (
              <span className="dim"> ← {label(BAND_LABEL_ZH, base.conclusions.strength.value)}</span>
            )}
          </div>
          <div>
            <div className="dim" style={{ fontSize: 11 }}>同党占比</div>
            <b className="mono">{pct(result?.ev?.conclusions.party.ratio ?? 0, 2)}</b>
            {base !== null && (
              <span className="dim mono"> ← {pct(base.conclusions.party.ratio, 2)}</span>
            )}
          </div>
          <div>
            <div className="dim" style={{ fontSize: 11 }}>用神</div>
            <b>{result?.ev?.conclusions.yongshen.value.primary ?? "—"}</b>
            <span className="dim"> · {label(YONGSHEN_METHOD_LABEL,
              result?.ev?.conclusions.yongshen.value.method ?? "")}</span>
          </div>
          <div>
            <div className="dim" style={{ fontSize: 11 }}>参数快照</div>
            <b className="mono">{paramsHash(params)}</b>
          </div>
          <span style={{ flex: 1 }} />
          <button className="ghost" onClick={() => { setOverrides({}); setErr(null); }}>全部还原</button>
          <button onClick={() => void putChart({ ...record, overrides })}>存为本盘的参数</button>
        </div>
        {result?.ev !== null && result !== null && (
          <div style={{ marginTop: 10 }}>
            <ElementRadar size={190} layers={[
              ...(base === null ? [] : [{ name: "默认参数", values: base.propagation.byElement, dash: "4 3" }]),
              { name: "当前参数", values: result.ev.propagation.byElement },
            ]} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, margin: "14px 0" }}>
        <button className="ghost" onClick={() => {
          const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `fate-params-${paramsHash(params)}.json`;
          a.click();
          URL.revokeObjectURL(a.href);
        }}>导出参数集</button>
        <button className="ghost" onClick={() => fileRef.current?.click()}>导入参数集</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f === undefined) return;
            void f.text().then((t) => {
              try {
                const o = JSON.parse(t) as PartialParams;
                loadParams(o);
                setOverrides(o);
                setErr(null);
              } catch (e) { setErr(String(e)); }
            });
          }} />
      </div>

      {PARAM_GROUPS.map((g) => (
        <section key={g.title}>
          <h2>{g.title}</h2>
          <p className="sub">{g.intro}</p>
          <div className="scroll">
            <table>
              <thead><tr><th>参数</th><th>当前值</th><th className="num">默认</th><th></th></tr></thead>
              <tbody>
                {g.items.map((item) => (
                  <Row key={item.path} item={item}
                    value={getAt(params, item.path)}
                    def={getAt(DEFAULT_PARAMS, item.path)}
                    onChange={(v) => change(item.path, v)} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2>面板未覆盖的条目</h2>
      <p className="sub">
        上表覆盖的是影响最大、且调整安全的那一部分。其余条目（神煞开关、距离系数细目、
        刑害破系数等）可通过「导入参数集」直接写入 —— 导入同样要过一遍完整校验。
        默认值的真源始终是 <span className="mono">packages/core/src/params/defaults.ts</span>，
        <span className="mono">params/default.yaml</span> 是它的平行文档，两者由测试逐键断言一致。
      </p>
      <pre className="export">{JSON.stringify(overrides, null, 2)}</pre>
    </>
  );
}

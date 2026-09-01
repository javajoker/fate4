import type { PillarCell } from "@fate/core";
import { ELEMENT_COLOR } from "../lib/palette";
import { elementOf } from "@fate/core";

/** 命盘四柱表 —— 干支 + 藏干 + 十神 + 神煞 + 十二长生。 */
export function PillarTable({ cells }: { cells: readonly PillarCell[] }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th></th>
            {cells.map((c) => <th key={c.kind}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>宫（干）</th>
            {cells.map((c) => <td key={c.kind}>{c.stemPalace}</td>)}
          </tr>
          <tr>
            <th>天干</th>
            {cells.map((c) => (
              <td key={c.kind}>
                <span style={{ color: ELEMENT_COLOR[elementOf(c.stem)], fontSize: 20 }}>{c.stem}</span>
                <span className="dim" style={{ marginLeft: 6 }}>{c.stemTenGod}</span>
                <span className="mono dim" style={{ marginLeft: 6 }}>{c.stemWeight.toFixed(1)}</span>
              </td>
            ))}
          </tr>
          <tr>
            <th>地支</th>
            {cells.map((c) => (
              <td key={c.kind}>
                <span style={{ fontSize: 20 }}>{c.branch}</span>
                <span className="mono dim" style={{ marginLeft: 6 }}>{c.branchWeight.toFixed(1)}</span>
              </td>
            ))}
          </tr>
          <tr>
            <th>宫（支）</th>
            {cells.map((c) => <td key={c.kind}>{c.branchPalace}</td>)}
          </tr>
          <tr>
            <th>藏干</th>
            {cells.map((c) => (
              <td key={c.kind}>
                {c.hidden.map((h) => (
                  <div key={h.stem + h.role}>
                    <span style={{ color: ELEMENT_COLOR[elementOf(h.stem)] }}>{h.stem}</span>
                    <span className="dim"> {h.role} · {h.tenGod} </span>
                    <span className="mono">{h.weight.toFixed(1)}</span>
                    {h.siling && <span className="pill" style={{ marginLeft: 5 }}>司令</span>}
                    {h.revealed && <span className="pill">透</span>}
                  </div>
                ))}
              </td>
            ))}
          </tr>
          <tr>
            <th>纳音</th>
            {cells.map((c) => <td key={c.kind}>{c.nayin}</td>)}
          </tr>
          <tr>
            <th>空亡</th>
            {cells.map((c) => <td key={c.kind} className="mono">{c.xunKong.join("")}</td>)}
          </tr>
          <tr>
            <th>长生</th>
            {cells.map((c) => <td key={c.kind}>{c.changsheng}</td>)}
          </tr>
          <tr>
            <th>神煞</th>
            {cells.map((c) => (
              <td key={c.kind}>
                {c.shensha.map((s) => <span key={s} className="pill">{s}</span>)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

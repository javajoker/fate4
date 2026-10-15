"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildChart, buildBaseChart, buildReport, loadParams,
  baziPairing, PILLAR_DOMAIN, type PairInput,
} from "@fate/core";
import { SiteNav } from "../../components/SiteNav";
import { allCharts, type ChartRecord } from "../../lib/storage";

/**
 * 合盘页 —— 两张盘的结构关系。
 *
 * ## 这一页刻意做得比别页「冷」
 *
 * 合盘是一个人最可能拿去对另一个人下判断的地方，而那个人多半不在场。
 * 所以这一页：
 *
 * - **没有分数，没有进度条，没有任何可以一眼读成结论的图形**
 * - 结构关系逐条列出，让读者自己看
 * - 开头就说清楚它不是对一段关系的判断
 *
 * 做一个漂亮的「契合度 78%」只要半小时，而那半小时会把这个项目
 * 其余部分的全部克制一笔勾销。
 *
 * ## 两张盘都从本机已存的命盘里选
 *
 * 不在这一页另开一个输入表单：那会让人顺手填进一个随口问来的生辰。
 * 要合盘，先各自排一张盘 —— 多一步，而那一步值得。
 */

export default function PairPage() {
  const [saved, setSaved] = useState<ChartRecord[]>([]);
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");

  useEffect(() => {
    void allCharts().then((rs) => {
      setSaved(rs);
      if (rs.length > 0) setAId(rs[0]!.id);
      if (rs.length > 1) setBId(rs[1]!.id);
    });
  }, []);

  const params = useMemo(() => loadParams({}), []);

  const prep = (r: ChartRecord | undefined): PairInput | null => {
    if (r === undefined) return null;
    try {
      const chart = buildBaseChart(buildChart(r.input), params);
      const rep = buildReport(chart, { subject: "other" });
      return {
        chart,
        yongshen: {
          primary: rep.strength.yongshen.value.primary,
          xishen: rep.strength.yongshen.value.xishen,
        },
      };
    } catch { return null; }
  };

  const A = useMemo(() => prep(saved.find((r) => r.id === aId)),
    [saved, aId, params]);
  const B = useMemo(() => prep(saved.find((r) => r.id === bId)),
    [saved, bId, params]);

  const P = useMemo(() => (A === null || B === null ? null : baziPairing(A, B)),
    [A, B]);

  const labelOf = (id: string) => saved.find((r) => r.id === id)?.label ?? "—";

  return (
    <>
      <SiteNav active="pair" />
      <div className="shell">
        <h1>合盘</h1>
        <p className="sub">
          两张四柱盘之间的<strong>结构关系</strong>：哪两个干相合、
          哪两个支相冲、一方的用神在另一方盘里占多少权重。
        </p>

        <div className="card">
          <h2>这一页不给分数，一个都不给</h2>
          <p>
            本项目别处是给数的 —— 流年那边有顺逆指数。这里不给，
            理由不在技术，在这件事本身：
          </p>
          <p>
            流年的那个数说的是<strong>一个人与一段时间</strong>的结构契合度，
            抽象，而且那个人明年还能再看一次。
            合盘的数说的是<strong>两个具体的人</strong>。
            无论措辞怎么框，「我们合盘 42 分」只会被读成一句关于这段关系的
            判决 —— 因为读者正是为那句判决来的。
          </p>
          <p>
            而它可能促成的决定<strong>不可撤回</strong>，
            并且牵连一个没有参与的人。
          </p>
          <p className="sub">
            所以这里只列逐条的结构关系，不加总。<strong>加总就是替人下结论。</strong>
          </p>
        </div>

        {saved.length < 2 ? (
          <div className="card">
            <p>本机已存的命盘不足两张，合不了盘。</p>
            <p className="sub">
              这一页不另开输入表单 —— 那会让人顺手填进一个随口问来的生辰。
              要合盘，先各自<a href="/">排一张盘</a>。多一步，而那一步值得。
            </p>
          </div>
        ) : (
          <>
            <div className="card">
              <h2>选两张盘</h2>
              <div className="pair-pick">
                <label>甲方
                  <select value={aId} onChange={(e) => setAId(e.target.value)}>
                    {saved.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </label>
                <label>乙方
                  <select value={bId} onChange={(e) => setBId(e.target.value)}>
                    {saved.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {aId === bId && (
                <p className="sub">
                  两边选了同一张盘。算得出来，但那只是在看这张盘与自己的关系。
                </p>
              )}
            </div>

            {P !== null && (
              <>
                <div className="card">
                  <h2>日主之间</h2>
                  <p>{P.dayMaster.why}。</p>
                  <div className="kv" style={{ marginTop: 8 }}>
                    <div><span className="dim">{labelOf(aId)}</span>
                      <b>{P.dayMaster.aStem}</b>
                      <span className="dim">{P.dayMaster.aElement}</span></div>
                    <div><span className="dim">{labelOf(bId)}</span>
                      <b>{P.dayMaster.bStem}</b>
                      <span className="dim">{P.dayMaster.bElement}</span></div>
                    <div><span className="dim">关系</span>
                      <b>{P.dayMaster.relation}</b></div>
                  </div>
                  <p className="sub">
                    日主是一张盘的基准点，故两个日主的关系常被单看一眼。
                    但它<strong>只是十六组关系里的一组</strong> ——
                    下面那张表是全部。
                  </p>
                </div>

                <div className="card">
                  <h2>干支关系（{P.relations.length} 条）</h2>
                  {P.relations.length === 0 ? (
                    <p className="sub">
                      两张盘之间没有查到合、冲、害、三合。
                      那不是「没关系」，是这几种取法下没有命中。
                    </p>
                  ) : (
                    <div className="scroll">
                      <table>
                        <thead>
                          <tr><th>甲方柱</th><th>乙方柱</th><th>关系</th>
                            <th>干支</th><th>化</th><th>来历</th></tr>
                        </thead>
                        <tbody>
                          {P.relations.map((r, i) => (
                            <tr key={i}>
                              <td>{r.from}</td>
                              <td>{r.to}</td>
                              <td>{r.kind}</td>
                              <td className="mono">{r.a}{r.b}</td>
                              <td>{r.transformsTo ?? ""}</td>
                              <td className="dim">{r.why}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="sub">
                    柱位各自的取象：
                    {Object.entries(PILLAR_DOMAIN)
                      .map(([k, v]) => `${k}＝${v}`).join("；")}。
                    这是<strong>取象，不是断语</strong>。
                  </p>
                  <p className="sub">
                    <strong>相冲相害在传统取象里也不等于「不好」</strong> ——
                    冲是动，合是牵绊，两者各有各的用处，取决于要办什么事。
                    把它们读成吉凶，是把取象读成了判决。
                  </p>
                </div>

                <div className="card">
                  <h2>用神的供给</h2>
                  <p className="sub">
                    一方的用神（这套模型认为它的结构需要的五行）
                    在另一方盘里占多少权重。<strong>旁边是它在自己盘里的占比</strong> ——
                    没有这个对照，那个数读不出意思。
                  </p>
                  {([[labelOf(aId), labelOf(bId), P.aNeedsFromB],
                    [labelOf(bId), labelOf(aId), P.bNeedsFromA]] as const).map(
                    ([self, other, items]) => (
                      <div key={self} style={{ marginTop: 12 }}>
                        <h3 style={{ fontSize: 14 }}>{self} 的用神，在 {other} 盘里</h3>
                        <table>
                          <thead>
                            <tr><th>五行</th><th></th>
                              <th style={{ textAlign: "right" }}>在 {other} 盘</th>
                              <th style={{ textAlign: "right" }}>在自己盘</th></tr>
                          </thead>
                          <tbody>
                            {items.map((s) => (
                              <tr key={s.element}>
                                <td>{s.element}</td>
                                <td className="dim">{s.role}</td>
                                <td className="mono" style={{ textAlign: "right" }}>
                                  {(s.shareInOther * 100).toFixed(1)}%</td>
                                <td className="mono dim" style={{ textAlign: "right" }}>
                                  {(s.shareInSelf * 100).toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                </div>

                <div className="card">
                  <h2>读这一页的时候</h2>
                  <ul>{P.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

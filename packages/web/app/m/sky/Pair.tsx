"use client";

import { useMemo, useState } from "react";
import {
  buildChart, buildBaseChart, buildReport, loadParams,
  baziPairing, PILLAR_DOMAIN, type BirthInput, type PairInput,
} from "@fate/core";
import {
  CITIES, loadPartner, savePartner, clearPartner, type PartnerRecord,
} from "../store";

/**
 * 移动版合盘。
 *
 * ## 这一页刻意做得比别页「冷」
 *
 * 合盘是一个人最可能拿去对另一个人下判断的地方，而那个人多半不在场。
 * 所以：**没有分数、没有进度条、没有任何可以一眼读成结论的图形**。
 *
 * 做一个「契合度 78%」只要半小时，而那半小时会把这个项目其余部分的
 * 全部克制一笔勾销。
 *
 * ## 表单摆在说明之后，不是之前
 *
 * 桌面版要求两张盘都已存在，并明说不另开输入表单 ——
 * 那会让人顺手填进一个随口问来的生辰。
 * 移动版只存一个人，那条要求没法照搬，故改为：
 * **先读完那段说明，表单才出现**。多一步，而那一步值得。
 *
 * 第二张盘单独存（`fate.m.partner.v1`），随时可以单独清掉 ——
 * 它是另一个人的生辰，不该混进「我的资料」里悄悄留着。
 */

export function Pair({ birth }: { birth: BirthInput }) {
  const [partner, setPartner] = useState<PartnerRecord | null>(() => loadPartner());
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    label: "", date: "1992-11-03", time: "09:15",
    city: 0, gender: "female" as "male" | "female",
  });

  const params = useMemo(() => loadParams({}), []);

  const prep = (i: BirthInput): PairInput | null => {
    try {
      const chart = buildBaseChart(buildChart(i), params);
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

  const P = useMemo(() => {
    if (partner === null) return null;
    const a = prep(birth);
    const b = prep(partner.input);
    return a === null || b === null ? null : baziPairing(a, b);
  }, [partner, birth, params]);

  const submit = () => {
    const [Y, M, D] = f.date.split("-").map(Number);
    const [h, mi] = f.time.split(":").map(Number);
    const [name, tz, lon, lat] = CITIES[f.city]!;
    const r: PartnerRecord = {
      label: f.label.trim() === "" ? "对方" : f.label.trim(),
      input: {
        year: Y!, month: M!, day: D!, hour: h ?? 12, minute: mi ?? 0,
        gender: f.gender, timeZone: tz, longitude: lon, latitude: lat,
      },
    };
    void name;
    savePartner(r);
    setPartner(r);
    setOpen(false);
  };

  return (
    <>
      <p className="m-lede">
        两张四柱盘之间的<strong>结构关系</strong>：哪两个干相合、
        哪两个支相冲、一方的用神在另一方盘里占多少权重。
      </p>

      <div className="m-note">
        <strong>这一页不给分数，一个都不给。</strong>
        别处是给数的 —— 「时间」那边有顺逆指数。这里不给，
        理由不在技术，在这件事本身：
        <br /><br />
        那个数说的是<strong>两个具体的人</strong>。
        无论措辞怎么框，「我们合盘 42 分」只会被读成一句关于这段关系的判决。
        而它可能促成的决定<strong>不可撤回</strong>，
        并且牵连一个没有参与的人。
        <br /><br />
        所以这里只列逐条的结构关系，不加总。<strong>加总就是替你下结论。</strong>
      </div>

      <div className="m-note">
        ⚠️ 第二张盘是<strong>另一个人的生辰</strong>。
        它存在这台设备上，始终不出本机 ——
        但那是技术上的保证，与那个人知不知道这件事无关。两者是两回事。
      </div>

      {partner === null && !open && (
        <button className="m-btn" onClick={() => setOpen(true)}>
          填第二张盘
        </button>
      )}

      {open && (
        <div className="m-form" style={{ marginTop: 14 }}>
          <div className="m-field">
            <label>怎么称呼（可留空）</label>
            <input value={f.label} placeholder="便于日后辨认"
              onChange={(e) => setF({ ...f, label: e.target.value })} />
          </div>
          <div className="m-field">
            <label>出生日期（公历）</label>
            <input type="date" value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <div className="m-field">
            <label>出生时刻（当地钟表时）</label>
            <input type="time" value={f.time}
              onChange={(e) => setF({ ...f, time: e.target.value })} />
          </div>
          <div className="m-field">
            <label>出生城市</label>
            <select value={f.city}
              onChange={(e) => setF({ ...f, city: Number(e.target.value) })}>
              {CITIES.map((c, i) => <option key={c[0]} value={i}>{c[0]}</option>)}
            </select>
          </div>
          <div className="m-field">
            <label>性别</label>
            <select value={f.gender}
              onChange={(e) => setF({ ...f, gender: e.target.value as "male" })}>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>
          <button className="m-btn" onClick={submit}>合盘</button>
          <button className="m-btn ghost" onClick={() => setOpen(false)}>取消</button>
        </div>
      )}

      {partner !== null && (
        <>
          <h2 className="m-sec">日主之间</h2>
          <div className="m-card">
            <p>{P?.dayMaster.why}。</p>
            <p className="dim" style={{ marginTop: 8 }}>
              日主是一张盘的基准点，故两个日主的关系常被单看一眼。
              但它<strong>只是十六组关系里的一组</strong>。
            </p>
          </div>

          <h2 className="m-sec">干支关系（{P?.relations.length ?? 0} 条）</h2>
          {P !== null && P.relations.length === 0 ? (
            <div className="m-card">
              <p className="dim">
                两张盘之间没有查到合、冲、害、三合。
                那不是「没关系」，是这几种取法下没有命中。
              </p>
            </div>
          ) : (
            <div className="m-card">
              {P?.relations.map((r, i) => (
                <p key={i} style={{ fontSize: 13, marginBottom: 5 }}>
                  <span className="dim">{r.from}↔{r.to}</span>
                  <strong>{r.kind}</strong>
                  <span className="mono">{r.a}{r.b}</span>
                  {r.transformsTo !== undefined && (
                    <span className="dim">　化{r.transformsTo}</span>
                  )}
                </p>
              ))}
            </div>
          )}
          <div className="m-note">
            柱位各自的取象：
            {Object.entries(PILLAR_DOMAIN).map(([k, v]) => `${k}＝${v}`).join("；")}。
            这是<strong>取象，不是断语</strong>。
            <br /><br />
            <strong>相冲相害在传统取象里也不等于「不好」</strong> ——
            冲是动，合是牵绊，两者各有各的用处，取决于要办什么事。
            把它们读成吉凶，是把取象读成了判决。
          </div>

          <h2 className="m-sec">用神的供给</h2>
          <p className="m-lede" style={{ fontSize: 12.5, marginBottom: 10 }}>
            一方的用神（这套模型认为它的结构需要的五行）在另一方盘里占多少权重。
            <strong>旁边是它在自己盘里的占比</strong> ——
            没有这个对照，那个数读不出意思。
          </p>
          {([["你", partner.label, P?.aNeedsFromB ?? []],
            [partner.label, "你", P?.bNeedsFromA ?? []]] as const).map(
            ([self, other, items]) => (
              <div className="m-card" key={self}>
                <h3>{self} 的用神，在 {other} 盘里</h3>
                {items.map((s) => (
                  <p key={s.element} style={{ fontSize: 13.5, marginBottom: 3 }}>
                    {s.element}
                    <span className="dim">　{s.role}</span>
                    <span className="mono">{(s.shareInOther * 100).toFixed(1)}%</span>
                    <span className="dim mono">
                      　（自己盘 {(s.shareInSelf * 100).toFixed(1)}%）
                    </span>
                  </p>
                ))}
              </div>
            ))}

          <h2 className="m-sec">读这一页的时候</h2>
          <div className="m-card">
            {P?.notes.map((n) => (
              <p key={n} style={{ fontSize: 13, marginBottom: 7 }}>{n}</p>
            ))}
          </div>

          <button className="m-btn ghost" style={{ marginTop: 12 }}
            onClick={() => { clearPartner(); setPartner(null); }}>
            清除第二张盘
          </button>
          <p className="m-lede" style={{ fontSize: 11.5, marginTop: 8 }}>
            第二张盘单独存，可以单独清掉 ——
            它是另一个人的生辰，不该混进你的资料里悄悄留着。
          </p>
        </>
      )}
    </>
  );
}

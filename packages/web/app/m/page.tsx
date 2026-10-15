"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildChart, buildReport, loadParams, plainCards,
  type Audience, type BirthInput, type PlainSection,
} from "@fate/core";
import { Card } from "./Card";
import { CITIES, clearBirth, loadBirth, loadPlainSource, savePlainSource, saveBirth,
  loadAudience, saveAudience, type PlainSource } from "./store";
import { AudiencePicker, ProvenanceWarnings } from "./Audience";
import { AiHandoff } from "./AiHandoff";
import { Profile } from "./Profile";
import { Share } from "./Share";

/**
 * 「我」页 —— 采集出生信息，给出性格、身心、亲近的人、人生轨迹、起伏。
 *
 * 采集刻意简单：日期、时间、城市、性别。时辰不知道就明说不知道 ——
 * **不猜**，并告诉用户缺了它会少掉哪些内容。
 */
export default function MePage() {
  const [birth, setBirth] = useState<BirthInput | null>(null);
  const [ready, setReady] = useState(false);
  // 改资料：把采集表重新调出来，带上现有的值。与「清除」不同 ——
  // 后者是破坏性的，写错一位数字不该要人从头再来。
  const [editing, setEditing] = useState(false);
  const [sec, setSec] = useState<PlainSection>("性格");
  const [src, setSrc] = useState<PlainSource>("code");
  const [aud, setAud] = useState<Audience>("lay");

  useEffect(() => {
    setBirth(loadBirth()); setSrc(loadPlainSource()); setAud(loadAudience()); setReady(true);
  }, []);

  // 报告只算一次，人话与 AI 交接共用 —— 算两遍不但慢，
  // 两份报告的 now 还可能跨过午夜落在不同的一天上。
  const report = useMemo(() => {
    if (birth === null) return null;
    try {
      return buildReport(buildChart(birth), {
        includeNodes: true,
        params: loadParams({ report: { audience: aud } }),
        now: (() => { const d = new Date();
          return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }; })(),
      });
    } catch { return null; }
  }, [birth, aud]);

  const plain = useMemo(() => (report === null ? null : plainCards(report)), [report]);

  if (!ready) return <p className="m-lede">载入中…</p>;
  if (birth === null || editing) {
    return (
      <BirthForm
        {...(birth === null ? {} : { initial: birth })}
        onDone={(b) => { saveBirth(b); setBirth(b); setEditing(false); }}
        {...(birth === null ? {} : { onCancel: () => setEditing(false) })}
      />
    );
  }
  if (plain === null) return <p className="m-lede">算不出来，请检查出生信息。</p>;

  const sections = [...new Set(plain.cards.map((c) => c.section))]
    .filter((s): s is PlainSection => (["性格", "身心", "亲近的人", "人生轨迹", "起伏"] as string[]).includes(s));
  const shown = plain.cards.filter((c) => c.section === sec);

  return (
    <>
      <h1 className="m-h1">关于你</h1>
      <p className="m-lede">{plain.framing}</p>

      {report !== null && (
        <Profile birth={birth} pillars={report.chart.pillars}
          onEdit={() => setEditing(true)} />
      )}

      {/* 盘的来历 —— 任何读者档都出，它说的是盘本身，不是对盘的解读 */}
      <ProvenanceWarnings warnings={plain.provenanceWarnings} />

      <AudiencePicker value={aud} onChange={(a) => { setAud(a); saveAudience(a); }} />

      <div className="m-chips" style={{ display: src === "code" ? undefined : "none" }}>
        {sections.map((s) => (
          <button key={s} className={`m-chip${s === sec ? " on" : ""}`} onClick={() => setSec(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="m-chips" style={{ marginBottom: 10 }}>
        {([["code", "代码生成"], ["ai", "交给 AI"]] as const).map(([v, name]) => (
          <button key={v} className={`m-chip${src === v ? " on" : ""}`}
            onClick={() => { setSrc(v); savePlainSource(v); }}>
            {name}
          </button>
        ))}
      </div>

      {src === "ai" && report !== null && <AiHandoff report={report} />}

      {src === "code" && plain.sectionNotes[sec] !== undefined && (
        <p className="m-note" style={{ marginBottom: 12 }}>{plain.sectionNotes[sec]}</p>
      )}

      {src === "code" && shown.map((c) => <Card key={c.id} card={c} />)}

      {src === "code" && sec === "起伏" && plain.withheldNote !== null && (
        <p className="m-note">{plain.withheldNote}</p>
      )}

      {src === "code" && shown.length > 0 && (
        <Share title={`关于我 · ${sec}`} lines={shown.map((c) => `${c.title}：${c.body}`)} />
      )}

      <Disclaimer plain={plain.disclaimer} technical={plain.disclaimerTechnical} />
      <button className="m-btn ghost" onClick={() => { clearBirth(); setBirth(null); }}>
        清除本机保存的出生信息
      </button>
    </>
  );
}

/** 免责声明。人话版在前，技术版原文可展开 —— 改写过的东西，得让人看得到原件。 */
export function Disclaimer({ plain, technical }: { plain: string; technical: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="m-note">
      {plain}
      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
            font: "inherit", color: "var(--accent)" }}
        >
          {open ? "收起原文" : "看原文"}
        </button>
        {open && <p style={{ marginTop: 7 }}>{technical}</p>}
      </div>
    </div>
  );
}

const two = (n: number) => String(n).padStart(2, "0");

/** 采集表。给了 `initial` 即为「改」，否则为首次采集。 */
function BirthForm(
  { onDone, initial, onCancel }: {
    onDone: (b: BirthInput) => void;
    initial?: BirthInput;
    onCancel?: () => void;
  },
) {
  const [date, setDate] = useState(initial === undefined
    ? "1990-05-12"
    : `${initial.year}-${two(initial.month)}-${two(initial.day)}`);
  const [time, setTime] = useState(initial === undefined
    ? "14:30"
    : `${two(initial.hour)}:${two(initial.minute)}`);
  const [unknownHour, setUnknownHour] = useState(initial?.unknownHour === true);
  const [city, setCity] = useState(initial === undefined ? 0
    : Math.max(0, CITIES.findIndex(
      (c) => c[1] === initial.timeZone && c[2] === initial.longitude)));
  const [gender, setGender] = useState<"male" | "female">(
    initial?.gender === "female" ? "female" : "male");

  const submit = () => {
    const [Y, M, D] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    const [, tz, lon, lat] = CITIES[city]!;
    onDone({
      year: Y!, month: M!, day: D!,
      hour: unknownHour ? 12 : (h ?? 12), minute: unknownHour ? 0 : (mi ?? 0),
      // 纬度四柱用不到，但星盘要。随城市一并存下，免得日后再问一次
      gender, timeZone: tz, longitude: lon, latitude: lat,
      ...(unknownHour ? { unknownHour: true } : {}),
    });
  };

  return (
    <>
      <h1 className="m-h1">{initial === undefined ? "先说说你的出生信息" : "改一下出生信息"}</h1>
      <p className="m-lede">
        只存在这台设备上，不会上传。出生时间越准，结果越细 ——
        差一个小时可能就是另一套说法。
      </p>
      <div className="m-form">
        <div className="m-field">
          <label htmlFor="d">出生日期</label>
          <input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="m-field">
          <label htmlFor="t">出生时间</label>
          <input id="t" type="time" value={time} disabled={unknownHour}
            onChange={(e) => setTime(e.target.value)} />
          <label className="inline" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={unknownHour}
              onChange={(e) => setUnknownHour(e.target.checked)} />
            不知道具体时间
          </label>
        </div>
        <div className="m-field">
          <label htmlFor="c">出生城市</label>
          <select id="c" value={city} onChange={(e) => setCity(Number(e.target.value))}>
            {CITIES.map((x, i) => <option key={x[0]} value={i}>{x[0]}</option>)}
          </select>
        </div>
        <div className="m-field">
          <label htmlFor="g">性别</label>
          <select id="g" value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
        <button className="m-btn" onClick={submit}>
          {initial === undefined ? "开始" : "存下来"}
        </button>
        {onCancel !== undefined && (
          <button className="m-btn ghost" onClick={onCancel}>不改了</button>
        )}
      </div>
      {unknownHour && (
        <p className="m-note">
          不知道具体时间的话，与「晚年、子女、志向」相关的部分会算不出来，
          整体也会少掉将近三成的信息。这些地方会直接留白，不会拿别的顶上。
        </p>
      )}
    </>
  );
}

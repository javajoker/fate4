"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { disclaimerText, type BirthInput } from "@fate/core";
import { allCharts, deleteChart, newId, putChart, type ChartRecord } from "../lib/storage";
import { SiteNav } from "../components/SiteNav";
import { SystemsTable } from "../components/SystemsTable";

const TZ = [
  "Asia/Shanghai", "Asia/Taipei", "Asia/Hong_Kong", "Asia/Macau",
  "Asia/Singapore", "Asia/Tokyo", "Asia/Seoul", "America/Los_Angeles",
  "America/New_York", "Europe/London", "Australia/Sydney",
];

export default function Home() {
  const router = useRouter();
  const [saved, setSaved] = useState<ChartRecord[]>([]);
  const [f, setF] = useState({
    label: "", date: "1990-05-12", time: "14:30",
    gender: "male" as const, timeZone: "Asia/Shanghai",
    longitude: "121.47", latitude: "31.23", unknownHour: false,
  });

  useEffect(() => { void allCharts().then((r) => setSaved(r.sort((a, b) => b.createdAt - a.createdAt))); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const [Y, M, D] = f.date.split("-").map(Number);
    const [h, mi] = f.time.split(":").map(Number);
    const input: BirthInput = {
      year: Y!, month: M!, day: D!,
      hour: f.unknownHour ? 12 : h!, minute: f.unknownHour ? 0 : mi!,
      gender: f.gender, timeZone: f.timeZone,
      longitude: Number(f.longitude),
      ...(f.latitude === "" ? {} : { latitude: Number(f.latitude) }),
      ...(f.unknownHour ? { unknownHour: true } : {}),
    };
    const id = newId();
    await putChart({
      id, label: f.label.trim() === "" ? `${f.date} ${f.time}` : f.label.trim(),
      input, overrides: {}, createdAt: Date.now(),
    });
    router.push(`/chart#${id}`);
  };

  return (
    <>
      <SiteNav active="chart" />
      <div className="shell">
        <h1>排盘</h1>
        <p className="sub">
          全部计算在本机浏览器内完成。生辰数据存于本机 IndexedDB，不上传，
          命盘标识走 URL 片段（<span className="mono">#</span> 之后），不随请求发往任何服务器。
        </p>

        <form className="birth" onSubmit={submit}>
          <label>标注（可选）
            <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })}
              placeholder="便于日后辨认" />
          </label>
          <label>性别
            <select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value as "male" })}>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </label>
          <label>出生日期（公历）
            <input type="date" value={f.date} required
              onChange={(e) => setF({ ...f, date: e.target.value })} />
          </label>
          <label>出生时刻（当地钟表时）
            <input type="time" value={f.time} disabled={f.unknownHour} required={!f.unknownHour}
              onChange={(e) => setF({ ...f, time: e.target.value })} />
          </label>
          <label>时区
            <select value={f.timeZone} onChange={(e) => setF({ ...f, timeZone: e.target.value })}>
              {TZ.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </label>
          <label>出生地经度（东经为正）
            <input type="number" step="0.01" value={f.longitude} required
              onChange={(e) => setF({ ...f, longitude: e.target.value })} />
          </label>
          <label>出生地纬度
            <input type="number" step="0.01" value={f.latitude}
              onChange={(e) => setF({ ...f, latitude: e.target.value })} />
            <span className="hint">
              四柱用不到；<a href="/compare-book/02">星盘</a>要它才起得了上升点
            </span>
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 }}>
            <input type="checkbox" checked={f.unknownHour} style={{ width: 16 }}
              onChange={(e) => setF({ ...f, unknownHour: e.target.checked })} />
            时辰未知
          </label>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, marginTop: 6 }}>
            <button type="submit">排盘</button>
          </div>
        </form>

        <p className="sub" style={{ marginTop: 14 }}>
          时辰未知时，时柱与命宫缺省，依赖时柱的判定一律留白 —— 不作猜测。
          时刻按当地钟表时输入，引擎自行处理历史夏令时、经度时差与均时差。
        </p>

        <SystemsTable />

        {saved.length > 0 && (
          <>
            <h2>本机已存</h2>
            <div className="scroll">
              <table>
                <thead><tr><th>标注</th><th>生辰</th><th>性别</th><th></th></tr></thead>
                <tbody>
                  {saved.map((r) => (
                    <tr key={r.id}>
                      <td><a href={`/chart#${r.id}`}>{r.label}</a></td>
                      <td className="mono">
                        {r.input.year}-{String(r.input.month).padStart(2, "0")}-
                        {String(r.input.day).padStart(2, "0")}{" "}
                        {r.input.unknownHour === true ? "时辰未知"
                          : `${String(r.input.hour).padStart(2, "0")}:${String(r.input.minute).padStart(2, "0")}`}
                      </td>
                      <td>{r.input.gender === "male" ? "男" : "女"}</td>
                      <td>
                        <button className="ghost" onClick={() => {
                          void deleteChart(r.id).then(() => setSaved((s) => s.filter((x) => x.id !== r.id)));
                        }}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="disclaimer">{disclaimerText("zh-Hans")}</div>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import type { BirthInput, ChartSection } from "@fate/core";
import { CITIES } from "./store";

/**
 * 「我的资料」—— 出生信息的**回看与修改**，以及八字排盘本身。
 *
 * ## 原先只能清除，不能改
 *
 * 采集表只在首次出现；存下之后想改，唯一的入口是「清除本机保存的出生信息」——
 * 一个破坏性动作。写错一位数字就得从头再来，而出生时间恰恰是最容易记岔、
 * 也最需要试着改一改看看的那一项（差一个时辰就是另一套说法）。
 *
 * ## 八字放在折叠里，不放在正文
 *
 * 移动版的规矩是「人话在前，术语可展开」（见 docs/14-plain.md §1）。
 * 八字是彻头彻尾的术语，故它走的是与每张卡片「看依据」同一个位置：
 * 默认收起，点开可见，**而不是**在首页正中摆一张干支表。
 *
 * 收起时也要给一句框定 —— 读者点开前就该知道自己要看的是一套传统记法，
 * 不是什么体检报告。
 */

const CITY_OF = (b: BirthInput): string =>
  CITIES.find((c) => c[1] === b.timeZone && c[2] === b.longitude)?.[0]
  ?? `${b.timeZone}　东经 ${b.longitude}`;

const two = (n: number) => String(n).padStart(2, "0");

export function Profile(
  { birth, pillars, onEdit }: {
    birth: BirthInput;
    pillars: ChartSection["pillars"];
    onEdit: () => void;
  },
) {
  const [open, setOpen] = useState(false);
  return (
    <div className="m-card">
      <h3>你的资料</h3>
      <dl className="m-kv">
        <dt>出生日期</dt>
        <dd>{birth.year} 年 {birth.month} 月 {birth.day} 日</dd>
        <dt>出生时间</dt>
        <dd>
          {birth.unknownHour === true
            ? <span className="dim">不知道（时辰一项留白，没有拿别的顶上）</span>
            : `${two(birth.hour)}:${two(birth.minute)}`}
        </dd>
        <dt>出生城市</dt>
        <dd>{CITY_OF(birth)}</dd>
        <dt>性别</dt>
        <dd>{birth.gender === "male" ? "男" : "女"}</dd>
      </dl>

      <div className="m-why">
        <button onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "收起八字" : "看八字（传统记法）"}
        </button>
        {open && (
          <>
            <p className="dim" style={{ marginTop: 9 }}>
              下面这张表是把你的出生时刻换成传统的干支记法 ——
              上面所有的说法都是从它推出来的。它是一套记时的符号，不是对你的判断。
            </p>
            <table className="m-table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th></th>
                  {pillars.map((c) => <th key={c.kind}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>天干</th>
                  {pillars.map((c) => (
                    <td key={c.kind} className="gz">{c.stem}</td>
                  ))}
                </tr>
                <tr>
                  <th>地支</th>
                  {pillars.map((c) => (
                    <td key={c.kind} className="gz">{c.branch}</td>
                  ))}
                </tr>
                <tr>
                  <th>藏干</th>
                  {pillars.map((c) => (
                    <td key={c.kind} className="dim">
                      {c.hidden.map((h) => h.stem).join(" ")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th>纳音</th>
                  {pillars.map((c) => <td key={c.kind} className="dim">{c.nayin}</td>)}
                </tr>
              </tbody>
            </table>
            {birth.unknownHour === true && (
              <p className="dim" style={{ marginTop: 8 }}>
                时辰未知，故这张表里根本没有时柱那一列 —— 不是留了个空格，
                是那一柱不存在，也不参与任何一条说法。
              </p>
            )}
          </>
        )}
      </div>

      <button className="m-btn ghost" style={{ marginTop: 12 }} onClick={onEdit}>
        改一下出生信息
      </button>
    </div>
  );
}

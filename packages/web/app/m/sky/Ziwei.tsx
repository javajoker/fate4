"use client";

import { useMemo } from "react";
import { buildZiweiChart, type BirthInput } from "@fate/core";

/**
 * 移动版紫微盘。
 *
 * ## 为什么它与星盘放在同一个标签底下
 *
 * 两者都在读**同一个出生时刻**，而它们要的输入正相反：
 *
 * | | 星盘 | 紫微 |
 * | --- | --- | --- |
 * | 星是什么 | 真天体 | 虚星（算术摆出来的） |
 * | 要算星历 | 要 | **不要** |
 * | 要出生地点 | 要经纬度 | **一样都不要** |
 *
 * 摆在一起，这个分别自己就看得出来 —— 比在书里写十遍都管用。
 *
 * ## 手机上仍用方图
 *
 * 四方十二宫在手机上挤，但换成列表更糟：对宫与三方四正在方图上一眼可见，
 * 在列表里要数行数，而那些关系正是这套东西的全部。
 * 故保留方图，只把字号压下来。
 */

const GRID: Readonly<Record<number, readonly [number, number]>> = {
  5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],
  4: [2, 1], 9: [2, 4],
  3: [3, 1], 10: [3, 4],
  2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4],
};

export function Ziwei({ birth }: { birth: BirthInput }) {
  const zw = useMemo(() => {
    try { return buildZiweiChart(birth); } catch { return null; }
  }, [birth]);

  if (zw === null) return <p className="m-lede">这张生辰排不出紫微盘。</p>;

  return (
    <>
      <p className="m-lede">
        与「我」那一页同一个出生时刻，但这一套
        <strong>既不查星历，也不看节气，连出生地点都不要</strong> ——
        整张盘由五个数推出：农历年干支、农历月、农历日、时辰、性别。
      </p>

      <div className="m-note">
        <strong>这些「星」不是天上的星。</strong>
        紫微、天府、贪狼这些名字来自星官，但它们是按农历日与时辰的
        算术规则摆进十二宫的<strong>虚星</strong> ——
        真正的紫微垣（北极一带的星官）一次都不进计算。
        <br /><br />
        这不是贬低：虚星体系自有其一致性，而且完全可复算。
        问题只在于把它说成「观星」是归错了档。
        上面那一页的<strong>星盘</strong>排的才是真天体 ——
        那里要算星历、要经纬度，这里一样都不要。
      </div>

      <h2 className="m-sec">基本</h2>
      <div className="m-card">
        <p style={{ fontSize: 13.5 }}>
          农历 {zw.lunar.year} 年{zw.lunar.isLeap ? "闰" : ""}
          {zw.lunar.month} 月{zw.lunar.day} 日
          <strong>{zw.yearStem}{zw.yearBranch}</strong> 年
          {zw.gender === "male" ? "男" : "女"}
        </p>
        <p style={{ fontSize: 13.5, marginTop: 4 }}>
          <strong>{zw.bureau.bureau}</strong>
          <span className="dim">　命宫 {zw.bureau.mingStem}{zw.bureau.mingBranch}
            · 纳音{zw.bureau.nayin}　大限{zw.limitDirection}</span>
        </p>
        <p className="dim" style={{ marginTop: 8 }}>
          年干支取的是<strong>农历年</strong>，以正月初一为界 ——
          而四柱的年柱以立春为界，两者差着十天到一个多月。
          生在这两个日子之间的人，两套给出的年干支不是同一个。
        </p>
      </div>

      {zw.warnings.length > 0 && (
        <>
          <h2 className="m-sec">这张盘的来历</h2>
          <div className="m-card">
            {zw.warnings.map((w) => (
              <p key={w} style={{ fontSize: 13, marginBottom: 6 }}>{w}</p>
            ))}
          </div>
        </>
      )}

      <h2 className="m-sec">命盘</h2>
      <div className="zw-grid zw-m">
        {zw.palaces.map((p) => {
          const [r, c] = GRID[p.index]!;
          return (
            <div key={p.index} className="zw-cell" style={{ gridRow: r, gridColumn: c }}>
              <div className="zw-stars">
                {p.stars.map((s) => (
                  <span key={s.name} className={`zw-star g${s.group}`}>
                    {s.name}
                    {p.sihua.filter((h) => h.star === s.name).map((h) => (
                      <sup key={h.kind} className="zw-hua">{h.kind.slice(1)}</sup>
                    ))}
                  </span>
                ))}
              </div>
              <div className="zw-foot">
                <span className="zw-limit">{p.majorLimit!.from}–{p.majorLimit!.to}</span>
                <span className="zw-name">{p.name}{p.isShen && <em>身</em>}</span>
                <span className={p.isMing ? "zw-gz on" : "zw-gz"}>
                  {p.stem}{p.branch}
                </span>
              </div>
            </div>
          );
        })}
        <div className="zw-center">
          <div className="dim">{zw.sihua.map((h) => `${h.star}${h.kind}`).join("　")}</div>
        </div>
      </div>
      <p className="m-lede" style={{ fontSize: 11.5, marginTop: 8 }}>
        每格左下是大限起止岁数，中间是宫名，右下是该宫干支（命宫标出）。
        星名右上角的单字是四化（禄权科忌）。
      </p>

      <div className="m-note">
        紫微<strong>自己</strong>不算天象，但它吃的农历是实测的 ——
        定朔要真算合朔，置闰要看中气。所以它落在「历法派生」这一档，
        不是「纯约定」那一档（那一档只有塔罗）。
        这几档怎么分的，见<a href="/compare-book/02">比较那本书</a>。
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { asTT, buildChart, deltaTSeconds, PLAIN_DISCLAIMER } from "@fate/core";
import { skyChart, aspectsOf, ASPECT_NAME, BODY_NAME } from "@fate/core/sky";
import { SkyWheel, SkyWheelLegend } from "../../../components/SkyWheel";
import { CITIES, loadBirth } from "../store";
import { Disclaimer } from "../page";

/**
 * 移动版星盘页。
 *
 * ## 这一页与移动版其余各页不同，而且必须说出来
 *
 * 移动版的通篇承诺是「把推演结果换成平常话」。这一页**做不到那件事**，
 * 而且原因不是偷懒：
 *
 * 本项目的星盘（桌面版也一样）**根本不做解读** —— 它给的是位置、
 * 庙旺、相位与来历，没有一句断语。既然没有断语，也就没有「换成平常话」
 * 这一步可做。要换的只是术语，而术语换掉之后那些位置就说不清了。
 *
 * 于是这一页的做法是：**术语照用，但每个术语当场解释一句**。
 * 并在开头明说这一页与别页不同 —— 读者有权知道自己进了哪一种页面。
 *
 * ## 为什么圆图在手机上反而更合适
 *
 * 桌面版那张表一行七列，手机上要横向滚动。而圆图是**语言最少**的一种
 * 呈现：位置就是位置，不需要读文字就看得出谁挨着谁、谁对着谁。
 * 故这一页把圆图摆在最前，表格降为一个紧凑列表。
 */

export default function MobileSkyPage() {
  const [birth, setBirth] = useState<ReturnType<typeof loadBirth>>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { setBirth(loadBirth()); setReady(true); }, []);

  const sky = useMemo(() => {
    if (birth === null) return null;
    // 老的存档没有纬度（纬度是后加进城市表的）—— 按城市补一次，补不上就不算
    const lat = birth.latitude
      ?? CITIES.find((c) => c[1] === birth.timeZone && c[2] === birth.longitude)?.[3];
    if (lat === undefined) return null;
    try {
      const chart = buildChart(birth);
      const jdUT = chart.birthJdUT;
      const jdTT = asTT(jdUT + deltaTSeconds(birth.year, birth.month).seconds / 86400);
      return skyChart(jdUT as never, jdTT, birth.longitude, lat);
    } catch { return null; }
  }, [birth]);

  if (!ready) return <p className="m-lede">计算中…</p>;

  if (birth === null) {
    return (
      <>
        <h1 className="m-h1">星盘</h1>
        <p className="m-lede">这一页要先有出生信息。</p>
        <p><a className="m-btn" href="/m" style={{ display: "block", textAlign: "center" }}>
          去填出生信息</a></p>
      </>
    );
  }

  if (sky === null) {
    return (
      <>
        <h1 className="m-h1">星盘</h1>
        <p className="m-lede">
          这一页要知道你出生地的<strong>纬度</strong>，而你这份存档里没有。
        </p>
        <p className="m-lede">
          四柱用不到纬度 —— 它对出生地的依赖只到真太阳时那一层，用的是经度。
          星盘的上升点要纬度，而且南北差一度就能差出几度。
        </p>
        <p className="m-lede">
          在「我」那一页点「改一下出生信息」，重新选一次城市就补上了。
          这里不替你猜一个 —— 随手填出来的上升点，看起来与真的一模一样，
          而你无从分辨。
        </p>
        <p><a className="m-btn" href="/m" style={{ display: "block", textAlign: "center" }}>
          去补上</a></p>
      </>
    );
  }

  const aspects = aspectsOf(sky).filter((a) => a.orb <= 8);

  return (
    <>
      <h1 className="m-h1">星盘</h1>
      <p className="m-lede">
        与「我」那一页<strong>同一个出生时刻</strong>，但换了一套占法：
        七政四余与西洋古典占星。它们用的是同一组行星位置，读法不同。
      </p>

      <div className="m-note">
        <strong>这一页与别的页不一样：它有术语。</strong>
        别的页把推演结果换成了平常话，而这一页换不了 ——
        因为本项目的星盘<strong>根本不做解读</strong>，
        它只给位置、强弱与相位，没有一句断语。
        既然没有断语，也就没有「换成平常话」这一步可做。
        所以这里术语照用，但每个术语当场解释一句。
      </div>

      <h2 className="m-sec">这一刻的天</h2>
      <div className="m-card" style={{ padding: "12px 8px" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <SkyWheel chart={sky} aspects={aspects} size={330} />
        </div>
        <div style={{ padding: "0 7px" }}><SkyWheelLegend /></div>
      </div>

      <div className="m-card">
        <h3>怎么读这张圆图</h3>
        <p>
          左边那条横线是<strong>上升点</strong> —— 你出生那一刻，
          正从东方地平线升起的那一度。它是整张图的起点，
          也是唯一一个与<strong>出生地点</strong>有关的东西。
        </p>
        <p className="dim" style={{ marginTop: 8 }}>
          外圈是十二宫的名字，内圈的数字是宫位号，自上升点起算。
          圆心里的细线是相位：两颗星成特定角度时连起来。
          线型不同代表相位不同，<strong>不用颜色</strong> ——
          传统上有「吉相」「凶相」之说，给上红绿这张图就从结构图变成了评价图。
        </p>
      </div>

      <h2 className="m-sec">七政：七个天体在哪</h2>
      <p className="m-lede" style={{ marginBottom: 12 }}>
        「七政」就是日、月和肉眼看得见的五颗行星。
        两套占法读的是同一组位置，只是各自换了自己那套话。
      </p>
      {sky.bodies.map((b, i) => {
        const q = sky.qizheng[i]!;
        return (
          <div className="m-card" key={b.body}>
            <h3>
              {b.name}　<span style={{ fontWeight: 400 }}>{q.palace.name}</span>
              <span className="dim" style={{ marginLeft: 6 }}>
                {b.degree.toFixed(1)}°　第 {b.house} 宫
              </span>
            </h3>
            <p style={{ fontSize: 13.5 }}>
              七政四余作<strong>{q.states.join("")}</strong>；
              西洋古典作<strong>{b.dignities.map((h) => DIG[h.kind] ?? h.kind).join("、")}</strong>。
            </p>
            <p className="dim" style={{ marginTop: 6 }}>
              {b.dignities[0]?.why ?? ""}
            </p>
          </div>
        );
      })}
      <div className="m-note">
        <strong>两套的粗细不一样，这个差别是实的。</strong>
        西洋古典分五项（庙、旺、三分、界、面）还要计分；
        七政四余只分庙、旺、陷、落、平五档，<strong>不计分</strong>。
        那是两种不同的野心，不是精度差异。
      </div>

      <h2 className="m-sec">昼盘还是夜盘</h2>
      <div className="m-card">
        <h3>{sky.isDay ? "昼盘" : "夜盘"}</h3>
        <p>你出生那一刻，太阳在地平线{sky.isDay ? "之上" : "之下"}。</p>
        <p className="dim" style={{ marginTop: 7 }}>
          这一条在西洋古典里是硬规则：同一颗星在同一度上，
          昼盘得「三分」之位，夜盘就不得，换一颗星来得。
          而七政四余里昼夜<strong>不进规则</strong> ——
          同一片天、同一个时刻，一方把它编进了规则，另一方没有。
          天给的是位置，规则是人定的。
        </p>
      </div>

      {aspects.length > 0 && (
        <>
          <h2 className="m-sec">相位</h2>
          <div className="m-card">
            <p className="dim" style={{ marginBottom: 8 }}>
              两颗星之间成特定角度时，传统上认为它们彼此「看得见」。
            </p>
            {aspects.map((a, i) => (
              <p key={i} style={{ fontSize: 13.5, marginBottom: 3 }}>
                {BODY_NAME[a.a]} <span className="dim">{ASPECT_NAME[a.kind]}</span>{" "}
                {BODY_NAME[a.b]}
                <span className="dim">　差 {a.orb.toFixed(1)}°</span>
              </p>
            ))}
          </div>
        </>
      )}

      {sky.warnings.length > 0 && (
        <>
          <h2 className="m-sec">这张盘的来历</h2>
          <div className="m-card">
            {sky.warnings.map((w) => (
              <p key={w} style={{ fontSize: 13.5, marginBottom: 6 }}>{w}</p>
            ))}
          </div>
        </>
      )}

      <div className="m-note">
        这两套的庙旺表<strong>几乎一模一样</strong>，而本项目不拿这件事
        去论证「东西方独立得出同一张表」—— 七政四余唐代随佛经传入，
        与西洋占星同源，同一张表最省事的解释是它只被发明过一次。
        完整的理由见<a href="/compare-book/12">比较那本书</a>。
      </div>

      {/*
        免责声明与别页同一份。技术版那一栏这里给的是**这一套自己的边界**，
        不是四柱报告的结尾 —— 两套占法的边界不一样，拿错一份就是说错话。
      */}
      <Disclaimer plain={PLAIN_DISCLAIMER} technical={SKY_TECHNICAL_NOTE} />
    </>
  );
}

/** 这一页的技术版边界说明。与四柱报告的那一份不同，故另写一份。 */
const SKY_TECHNICAL_NOTE =
  "本页为七政四余与西洋古典占星的排盘实现。行星位置由 VSOP87D 级数算出，"
  + "黄经精度对独立实现实测不超过 25 角秒；上升点由视恒星时与地理纬度定。"
  + "庙旺、三分、界、面各表为传统转录，其中数项尚未经实体书核对，"
  + "另见比较书第 11、12 章。本页只给位置与结构，不含任何断语。";

const DIG: Readonly<Record<string, string>> = {
  domicile: "庙", exaltation: "旺", triplicity: "三分", bound: "界", face: "面",
  detriment: "陷", fall: "落", peregrine: "外来",
};

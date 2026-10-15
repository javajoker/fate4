"use client";

import type { skyChart, aspectsOf } from "@fate/core/sky";

/**
 * 星盘圆图 —— 自绘 SVG，与 `charts.tsx` 同一套做法（不引图表库）。
 *
 * ## 方位约定
 *
 * 上升点在**左**（九点钟），黄经增加的方向为**逆时针**，
 * 于是整宫制的第一宫自上升点向下展开，中天落在顶上附近。
 * 这是星盘圆图两千年来的画法，不是任选的。
 *
 * 屏幕角 θ = 180° + (λ − 上升)，再按 `x = cx + r·cosθ、y = cy − r·sinθ`
 * 落点（SVG 的 y 向下，故取负号）。
 *
 * ## 相位为什么不分颜色
 *
 * 传统上三分、六分称「吉相」，四分、对分称「凶相」。
 * 照着给红绿，这张图就从一张**结构图**变成了一张**评价图** ——
 * 而那正是本项目全站禁红绿的理由（见 `lib/palette.ts`）。
 *
 * 故相位只用一种中性色，靠**虚线样式**区分种类：
 * 实线为合，长划为对分，点线为四分，短划为三分与六分。
 * 样式是分类标记，读不出褒贬。
 *
 * ## 挤在一起的星
 *
 * 几颗星黄经相近时标签会叠在一起。做法是按黄经排序后逐个检查，
 * 与前一颗相差不足 7° 的就往外挪一圈 —— **不移动它的角度**。
 * 移动角度会让图上的位置与表里的度数对不上，那是在图上说谎；
 * 挪半径只是换个地方写字。
 */

type Chart = ReturnType<typeof skyChart>;
type Aspect = ReturnType<typeof aspectsOf>[number];

/** 相位的线型。分类标记，不含褒贬 —— 见文件头。 */
const ASPECT_DASH: Readonly<Record<string, string>> = {
  conjunction: "",
  opposition: "7 4",
  square: "1.5 3",
  trine: "4 3",
  sextile: "4 3",
};

const BODY_GLYPH: Readonly<Record<string, string>> = {
  sun: "日", moon: "月", mercury: "水", venus: "金",
  mars: "火", jupiter: "木", saturn: "土",
};

export function SkyWheel({ chart, aspects, size = 460 }: {
  chart: Chart;
  aspects: readonly Aspect[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rSignIn = rOuter - 26;      // 宫名环的内边
  const rHouseIn = rSignIn - 20;    // 宫位号环的内边
  const rPlanet = rHouseIn - 18;    // 星的落点
  const rHub = rPlanet - 46;        // 相位线的圆心区

  const asc = chart.angles.ascendant;
  /** 黄经 → 屏幕角（度）。 */
  const theta = (lon: number) => 180 + (lon - asc);
  const pt = (lon: number, r: number) => {
    const a = (theta(lon) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };

  // 宫界：整宫制，故界就在每一宫的 0°
  const signStart = Math.floor(asc / 30) * 30;
  const cusps = Array.from({ length: 12 }, (_, i) => signStart + i * 30);

  // 标签挤在一起时往外挪一圈，**不动角度**
  const placed = [...chart.bodies]
    .map((b, i) => ({ b, q: chart.qizheng[i]! }))
    .sort((x, y) => x.b.longitude - y.b.longitude);
  const ring: number[] = [];
  let prev = -999;
  let step = 0;
  for (const { b } of placed) {
    const gap = b.longitude - prev;
    step = gap < 7 ? step + 1 : 0;
    ring.push(step % 3);
    prev = b.longitude;
  }

  return (
    <svg width={size} height={size} role="img"
      aria-label="星盘圆图：上升点在左，黄经逆时针增加">
      {/* 三道环线 */}
      {[rOuter, rSignIn, rHouseIn, rHub].map((r) => (
        <circle key={r} cx={cx} cy={cy} r={r}
          fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}

      {/* 宫界与宫名 */}
      {cusps.map((c, i) => {
        const [x1, y1] = pt(c, rHouseIn);
        const [x2, y2] = pt(c, rOuter);
        const [lx, ly] = pt(c + 15, (rSignIn + rOuter) / 2);
        const [hx, hy] = pt(c + 15, (rHouseIn + rSignIn) / 2);
        const idx = (Math.floor(c / 30) % 12 + 12) % 12;
        return (
          <g key={c}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--line-strong)" strokeWidth={1} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
              fontSize={11.5} fill="var(--ink-2)">
              {PALACE[idx]}
            </text>
            <text x={hx} y={hy} textAnchor="middle" dominantBaseline="central"
              fontSize={10} fill="var(--ink-3)">
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* 四角：上升与中天。画得比宫界重，它们是这张图的骨架 */}
      {([["ASC", asc], ["MC", chart.angles.midheaven]] as const).map(([name, lon]) => {
        const [x1, y1] = pt(lon, rHub);
        const [x2, y2] = pt(lon, rOuter);
        const [tx, ty] = pt(lon, rOuter - 9);
        return (
          <g key={name}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--accent)" strokeWidth={1.5} />
            {/*
              标签底下垫一块底色：宫名摆在每宫正中，而上升点可以恰好落在
              那个正中附近 —— 实测过一张盘，ASC 与「双女」两字叠在一起。
              垫底比挪位置稳妥：挪位置只能躲开这一张盘。
            */}
            <rect x={tx - 12} y={ty - 6} width={24} height={12} rx={2}
              fill="var(--surface)" opacity={0.92} />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central"
              fontSize={9} fill="var(--accent)" fontWeight={600}>{name}</text>
          </g>
        );
      })}

      {/* 相位线 —— 只用一种中性色，靠线型区分种类 */}
      {aspects.filter((a) => a.orb <= 8).map((a, i) => {
        const la = chart.bodies.find((b) => b.body === a.a)!.longitude;
        const lb = chart.bodies.find((b) => b.body === a.b)!.longitude;
        const [x1, y1] = pt(la, rHub);
        const [x2, y2] = pt(lb, rHub);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="var(--ink-3)" strokeWidth={0.9} opacity={0.75}
            strokeDasharray={ASPECT_DASH[a.kind] || undefined} />
        );
      })}

      {/* 七政 */}
      {placed.map(({ b, q }, i) => {
        const r = rPlanet - ring[i]! * 17;
        const [x, y] = pt(b.longitude, r);
        const [tx, ty] = pt(b.longitude, rHouseIn - 1);
        const [bx, by] = pt(b.longitude, rHub);
        return (
          <g key={b.body}>
            {/* 自宫界指向落点的一小段，读者由它对回度数 */}
            <line x1={tx} y1={ty} x2={bx} y2={by}
              stroke="var(--line)" strokeWidth={0.75} />
            <circle cx={x} cy={y} r={11} fill="var(--surface)"
              stroke="var(--line-strong)" strokeWidth={1} />
            <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
              fontSize={11} fill="var(--ink)">{BODY_GLYPH[b.body]}</text>
            <text x={x} y={y + 17} textAnchor="middle" dominantBaseline="central"
              fontSize={8.5} fill="var(--ink-3)"
              style={{ fontFamily: "var(--mono)" }}>
              {b.degree.toFixed(0)}°{q.states[0] === "平" ? "" : q.states[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 宫名用七政四余那一套（阴阳、双女、人马、磨羯、宝瓶）—— 这张图属于那一边。 */
const PALACE: readonly string[] = [
  "白羊", "金牛", "阴阳", "巨蟹", "狮子", "双女",
  "天秤", "天蝎", "人马", "磨羯", "宝瓶", "双鱼",
];

/** 图例。线型的意思必须写出来，否则那几种虚线只是装饰。 */
export function SkyWheelLegend() {
  const rows: readonly (readonly [string, string])[] = [
    ["合", ASPECT_DASH.conjunction!],
    ["对分", ASPECT_DASH.opposition!],
    ["四分", ASPECT_DASH.square!],
    ["三分 / 六分", ASPECT_DASH.trine!],
  ];
  return (
    <div className="wheel-legend">
      {rows.map(([name, dash]) => (
        <span key={name}>
          <svg width={30} height={8} aria-hidden>
            <line x1={0} y1={4} x2={30} y2={4} stroke="var(--ink-3)"
              strokeWidth={1.1} strokeDasharray={dash || undefined} />
          </svg>
          {name}
        </span>
      ))}
      <span className="dim">
        相位只分线型，不分颜色 —— 三分六分传统称「吉」、四分对分称「凶」，
        给上红绿这张图就从结构图变成了评价图。
      </span>
    </div>
  );
}

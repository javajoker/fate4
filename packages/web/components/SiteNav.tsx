"use client";

/**
 * 站点顶栏 —— 把「九套占法」这件事做成看得见的结构。
 *
 * ## 为什么要分组
 *
 * 这个项目实现了七套占法，但它们不是平级的：
 * **四柱是主线**，其余几套各有各的用处，而且输入都不一样
 * （六爻只要一个时刻、不要生辰；星盘要时刻加经纬度；四柱要生辰）。
 *
 * 把它们平铺成一排链接，读者得不到这个结构 —— 看起来像五个同类的功能。
 * 分成三组之后，一眼能看出：一个主的，几个另外的，两本书。
 *
 * ## 主次靠位置与数量，不靠加粗
 *
 * 四柱在最前、单独一组、链接文字最短（「排盘」）。
 * 其余几套在后、合为一组、带组名。
 * 全站中性色板没有强调色可用（见 lib/palette.ts），
 * 而就算有，拿颜色分主次也会与「禁红绿」那条撞上。
 *
 * ## 一处定义，四处引用
 *
 * 此前这排链接在 `/`、`/ask`、`/cross` 各抄了一份，
 * 加第四个入口时就要改三处 —— 改漏一处，那一页的顶栏就少一个入口，
 * 而且不会有任何测试发现。
 */

export type NavKey = "chart" | "ask" | "cross" | "tarot" | "book" | "compare";

interface Item {
  readonly key: NavKey;
  readonly href: string;
  readonly label: string;
  /** 鼠标悬停时的一句说明 —— 各套占法要的输入不同，那是实质差异。 */
  readonly title: string;
}

/** 主线。四柱排盘，要生辰。 */
const PRIMARY: readonly Item[] = [
  { key: "chart", href: "/", label: "排盘", title: "四柱八字 —— 要出生年月日时与地点" },
];

/** 另几套占法。输入各不相同，故各自注明。 */
const OTHERS: readonly Item[] = [
  { key: "ask", href: "/ask", label: "问事", title: "六爻 —— 只要一个时刻，不要生辰" },
  { key: "cross", href: "/cross", label: "合参", title: "六爻 · 六壬 · 奇门 · 四柱流日 —— 同一时刻四家并列，不合并" },
  { key: "tarot", href: "/tarot", label: "塔罗", title: "洗牌即起法 —— 连时刻都不要，而且每抽一次都是另一次" },
];

/** 两本书。 */
const READING: readonly Item[] = [
  { key: "book", href: "/book", label: "书", title: "《一张盘是怎么算出来的》—— 这套四柱怎么算" },
  { key: "compare", href: "/compare-book", label: "比较", title: "《测天，还是约定》—— 九套占法在整片版图上的位置" },
];

function Group({ items, active }: { items: readonly Item[]; active: NavKey }) {
  return (
    <>
      {items.map((it) => (
        <a key={it.key} href={it.href} title={it.title}
          className={it.key === active ? "active" : undefined}>
          {it.label}
        </a>
      ))}
    </>
  );
}

export function SiteNav({ active }: { active: NavKey }) {
  return (
    <header className="top">
      <div className="inner">
        <a className="brand" href="/">四柱推演</a>
        <nav>
          <Group items={PRIMARY} active={active} />
          <span className="navgroup">另几套</span>
          <Group items={OTHERS} active={active} />
          <span className="navgroup">读物</span>
          <Group items={READING} active={active} />
        </nav>
      </div>
    </header>
  );
}

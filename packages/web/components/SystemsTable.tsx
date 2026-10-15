"use client";

import { SYSTEMS } from "@fate/core";

/**
 * 九套占法的落位，以及本项目各自做到了哪儿。
 *
 * ## 为什么首页要有这张表
 *
 * 这个项目实现了七套占法，但进来的人只看见一个排盘表单。
 * 没有这张表，「多套占法」这件事只存在于比较那本书里 ——
 * 而那本书在导航的最末，多数人不会点进去。
 *
 * ## 它不排名
 *
 * 表里没有「准确率」「推荐度」一类的列，因为那种列**答不出来**
 * （见《测天，还是约定》第 1 章）。能答的三件事是：
 * 输入是什么、天文含量多少、同一输入是否恒得同一结果。
 * 这三列全部来自 `compare/systems.ts` 的同一份注册表，
 * 与书里的数、与 CLI 的输出同源 —— 不在这里另记一份。
 *
 * ## 四柱的主次怎么表示
 *
 * 排在最前，并单独注一句「本项目的主线」。不加粗、不变色：
 * 全站中性色板没有强调色，而拿颜色分主次会与「禁红绿」那条撞上。
 */

/** 各套占法在本站的入口。没有界面的如实写明，不含糊成「敬请期待」。 */
const WHERE: Readonly<Record<string, { readonly href?: string; readonly text: string }>> = {
  sizhu: { href: "/", text: "本页排盘" },
  liuyao: { href: "/ask", text: "问事" },
  meihua: { href: "/ask", text: "问事（按时 / 报数起卦）" },
  liuren: { href: "/cross", text: "合参" },
  qimen: { href: "/cross", text: "合参" },
  qizheng: { href: "/chart/sky", text: "排盘后的「星盘」页" },
  astrology: { href: "/chart/sky", text: "排盘后的「星盘」页" },
  ziwei: { href: "/chart/ziwei", text: "排盘后的「紫微斗数」页" },
  tarot: { href: "/tarot", text: "塔罗" },
};

const ASTRO_NOTE: Readonly<Record<string, string>> = {
  实测天体: "不算星历就起不了盘",
  历法派生: "要一本准的历书，但不必自己算天",
  纯约定: "一张桌子就够了",
};

export function SystemsTable() {
  return (
    <>
      <h2>这个项目里的几套占法</h2>
      <p className="sub">
        九套常被笼统归为一类，或笼统分为「东方／西方」。两种分法都切不开
        什么有意义的东西。下面三列是<strong>答得出来</strong>的三件事 ——
        表里没有「谁更准」那一列，因为那一问没有答案。
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>占法</th>
              <th>传统</th>
              <th>天文含量</th>
              <th>输入</th>
              <th>同一输入</th>
              <th>在哪儿用</th>
            </tr>
          </thead>
          <tbody>
            {SYSTEMS.map((s) => {
              const w = WHERE[s.id] ?? { text: "—" };
              return (
                <tr key={s.id}>
                  <td>
                    {s.name}
                    {s.id === "sizhu" && (
                      <span className="dim" style={{ fontSize: 11, marginLeft: 6 }}>
                        本项目的主线
                      </span>
                    )}
                  </td>
                  <td className="dim">{s.tradition}</td>
                  <td title={ASTRO_NOTE[s.astronomy] ?? ""}>{s.astronomy}</td>
                  <td className="dim">{s.inputs.join(" · ")}</td>
                  <td className="dim">{s.determinism === "确定" ? "恒同" : "每次不同"}</td>
                  <td>
                    {w.href === undefined
                      ? <span className="dim">{w.text}</span>
                      : <a href={w.href}>{w.text}</a>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="sub">
        「天文含量」那一列把<strong>西洋占星与七政四余放在了一起</strong>，
        并把它们和四柱分开 —— 东西之分在这里完全失效。
        塔罗落单：它是九套里唯一一个起盘不需要知道今天是哪天的。
        这几条怎么算出来的，见<a href="/compare-book">《测天，还是约定》</a>。
      </p>
    </>
  );
}

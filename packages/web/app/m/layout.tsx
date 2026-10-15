"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import "./m.css";

/**
 * 移动版外壳。
 *
 * 与桌面版共用同一个 `@fate/core`，但**不共用页面** —— 桌面版是给愿意读
 * 术语的人看的，移动版是给不读术语的人看的。硬把两者塞进同一套组件里，
 * 结果通常是两边都不好用。
 *
 * 底部五个标签：了解自己 / 看时间 / 回看 / 问一件事 / 关于。

「回看」是这个应用里唯一不讲未来的一页，也是留存真正的来源 ——
用户在那里检验它准不准，而不是听它讲。见 docs/15-engagement.md。
 */

/**
 * 六个标签，排法按**读者在做什么**，不按占法分类：
 *
 *   我 / 时间 / 另两套 —— 都在看「我这个人（这一刻）」。「另两套」里装着
 *                        星盘与紫微：两者要的输入正相反，摆在一起看得出来
 *   回看              —— 唯一不讲未来的一页
 *   问事              —— 问一件具体的事（六爻与塔罗都在里面）
 *   关于
 *
 * 塔罗没有自己的标签：它与六爻同属「问一件事」，摆在一起正好让两者的
 * 差别看得见 —— 六爻有「一事不二占」，塔罗想抽几次抽几次，
 * 而那不是随意，是确定与随机的分别。
 */
const TABS: readonly (readonly [string, string, string])[] = [
  ["/m", "我", "◍"],
  ["/m/time", "时间", "◷"],
  ["/m/sky", "另两套", "◉"],
  ["/m/recall", "回看", "◈"],
  ["/m/ask", "问事", "◇"],
  ["/m/about", "关于", "◌"],
];

export default function MobileLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="m-shell">
      <main className="m-main">{children}</main>
      <nav className="m-tabs">
        {TABS.map(([href, label, icon]) => (
          <a key={href} href={href} className={path === href ? "on" : undefined}>
            <span className="ic">{icon}</span>
            <span className="tx">{label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

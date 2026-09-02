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
 * 底部四个标签对应用户提的两组功能：了解自己 / 看时间 / 问一件事 / 关于。
 */

const TABS: readonly (readonly [string, string, string])[] = [
  ["/m", "我", "◍"],
  ["/m/time", "时间", "◷"],
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

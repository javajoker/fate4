import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "四柱推演",
  description: "可复现、可审计、可校准的四柱命理计算实现",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}

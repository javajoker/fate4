import type { ReactNode } from "react";
import "./book.css";

/**
 * 書的外殼。
 *
 * 不複用全站的 `header.top` —— 那條頂欄是給排盤、問事、合參三個工具頁的，
 * 而書是**讀**的東西，不是工具。它要的是一條窄欄、一份目錄、一個可打印的版式，
 * 沒有一個按鈕。
 */
export const metadata = {
  title: "一張盤是怎麼算出來的",
  description: "四柱推演的理論與用法 —— 寫給用這個應用的人",
};

export default function BookLayout({ children }: { children: ReactNode }) {
  return <div className="bk">{children}</div>;
}

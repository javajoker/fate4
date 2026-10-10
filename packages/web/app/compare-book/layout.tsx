import type { ReactNode } from "react";
import "../book/book.css";

export const metadata = {
  title: "測天，還是約定",
  description: "九套占法的比較解剖 —— 天文含量、確定性、狀態空間",
};

export default function CompareBookLayout({ children }: { children: ReactNode }) {
  return <div className="bk">{children}</div>;
}

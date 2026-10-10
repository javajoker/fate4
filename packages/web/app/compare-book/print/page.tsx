import { CHAPTERS } from "../content";

export const metadata = { title: "測天，還是約定 · 全本" };

export default function PrintAll() {
  const idx = CHAPTERS.find((c) => c.slug === "index")!;
  const body = CHAPTERS.filter((c) => c.slug !== "index");
  return (
    <main className="bk-page bk-print">
      <header className="bk-cover">
        <h1>測天，還是約定</h1>
        <p className="bk-sub">九套占法的比較解剖</p>
        <p className="bk-cover-note">全本連排。瀏覽器「打印 → 存為 PDF」即得成品。</p>
      </header>
      <section className="bk-body bk-chapter" dangerouslySetInnerHTML={{ __html: idx.html }} />
      {body.map((c) => (
        <section key={c.slug} className="bk-body bk-chapter"
          dangerouslySetInnerHTML={{ __html: c.html }} />
      ))}
      <p className="bk-foot bk-noprint"><a href="/compare-book">← 回目錄</a></p>
    </main>
  );
}

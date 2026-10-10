import { CHAPTERS, ROUTE } from "./content";

export default function CompareBookIndex() {
  const idx = CHAPTERS.find((c) => c.slug === "index")!;
  return (
    <main className="bk-page">
      <article className="bk-body" dangerouslySetInnerHTML={{ __html: idx.html }} />
      <nav className="bk-nav">
        <span><a href="/book">另一本 · 一張盤是怎麼算出來的</a></span>
        <a className="bk-toc-link" href={`${ROUTE}/print`}>整本連排</a>
        <span><a href={`${ROUTE}/01`}>開始讀 →</a></span>
      </nav>
    </main>
  );
}

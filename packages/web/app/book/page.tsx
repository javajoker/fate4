import { CHAPTERS } from "./content";

/** 目錄頁。正文是 README 那一章，目錄表由它自己的 Markdown 給出。 */
export default function BookIndex() {
  const idx = CHAPTERS.find((c) => c.slug === "index")!;
  return (
    <main className="bk-page">
      <article className="bk-body" dangerouslySetInnerHTML={{ __html: idx.html }} />
      <nav className="bk-nav">
        <span />
        <a className="bk-toc-link" href="/book/print">整本連排（可打印成 PDF）</a>
        <span><a href="/book/01">開始讀 →</a></span>
      </nav>
      <p className="bk-foot">
        簡體原文在倉庫的 <span className="bk-ref">book/</span> 目錄；
        這裡是繁體版，由 <span className="bk-ref">toHant</span> 於構建期轉出。
      </p>
    </main>
  );
}

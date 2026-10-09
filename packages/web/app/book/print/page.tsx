import { CHAPTERS } from "../content";

/**
 * 整本連排 —— 打印成 PDF 用的那一頁。
 *
 * ## 為什麼不在倉庫裡放一個 .pdf
 *
 * 放了就會過期：書改一行，那個 PDF 就不再是書。而要在構建期生成 PDF
 * 得引一個瀏覽器引擎（puppeteer 一類），本項目的內核是零運行時依賴，
 * 不值得為一份附件破例。
 *
 * 故走瀏覽器自己的打印管線：這一頁把十四章連排，配一份 `@media print`
 * 樣式（見 book.css）—— 每章另起一頁、鏈接顯示原地址、頁邊距按 A4 設。
 * 瀏覽器「打印 → 存為 PDF」得到的就是成品，而且**永遠是當前版本**。
 */
export const metadata = { title: "一張盤是怎麼算出來的 · 全本" };

export default function PrintAll() {
  const body = CHAPTERS.filter((c) => c.slug !== "index");
  const idx = CHAPTERS.find((c) => c.slug === "index")!;
  return (
    <main className="bk-page bk-print">
      <header className="bk-cover">
        <h1>一張盤是怎麼算出來的</h1>
        <p className="bk-sub">四柱推演的理論與用法 —— 寫給用這個應用的人</p>
        <p className="bk-cover-note">
          全本連排。瀏覽器「打印 → 存為 PDF」即得成品。
        </p>
      </header>

      <section className="bk-body bk-chapter" dangerouslySetInnerHTML={{ __html: idx.html }} />

      {body.map((c) => (
        <section key={c.slug} className="bk-body bk-chapter"
          dangerouslySetInnerHTML={{ __html: c.html }} />
      ))}

      <p className="bk-foot bk-noprint">
        <a href="/book">← 回目錄</a>
      </p>
    </main>
  );
}

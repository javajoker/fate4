import { CHAPTERS } from "../content";
import { Nav } from "../Nav";

/** 靜態導出要求構建期就知道全部路徑。 */
export function generateStaticParams() {
  return CHAPTERS.filter((c) => c.slug !== "index").map((c) => ({ slug: c.slug }));
}

export default async function Chapter({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = CHAPTERS.find((x) => x.slug === slug);
  if (c === undefined) {
    return <main className="bk-page"><p>沒有這一章。<a href="/book">回目錄</a></p></main>;
  }
  return (
    <main className="bk-page">
      <article className="bk-body" dangerouslySetInnerHTML={{ __html: c.html }} />
      <Nav slug={c.slug} />
    </main>
  );
}

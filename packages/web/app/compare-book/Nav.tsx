"use client";

import { CHAPTERS, ROUTE } from "./content";

export function Nav({ slug }: { slug: string }) {
  const i = CHAPTERS.findIndex((c) => c.slug === slug);
  const prev = (i > 0 ? CHAPTERS[i - 1] : undefined) ?? null;
  const next = (i >= 0 ? CHAPTERS[i + 1] : undefined) ?? null;
  return (
    <nav className="bk-nav">
      <span>{prev === null ? null : <a href={`${ROUTE}/${prev.slug}`}>← {prev.title}</a>}</span>
      <a className="bk-toc-link" href={ROUTE}>目錄</a>
      <span>{next === null ? null : <a href={`${ROUTE}/${next.slug}`}>{next.title} →</a>}</span>
    </nav>
  );
}

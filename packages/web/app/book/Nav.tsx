"use client";

import { CHAPTERS } from "./content";

/**
 * 章節之間的上一章／下一章。
 *
 * 一本書在網頁上最容易丟的就是「我在哪、下一篇是什麼」。目錄在頂上，
 * 這一條在底下 —— 讀完一章不必回滾到頂。
 */
export function Nav({ slug }: { slug: string }) {
  const i = CHAPTERS.findIndex((c) => c.slug === slug);
  // `noUncheckedIndexedAccess` 下按下标取出来的是 `T | undefined`，
  // 故用 `?? null` 收口，而不是断言它一定在
  const prev = (i > 0 ? CHAPTERS[i - 1] : undefined) ?? null;
  const next = (i >= 0 ? CHAPTERS[i + 1] : undefined) ?? null;
  return (
    <nav className="bk-nav">
      <span>{prev === null ? null : <a href={`/book/${prev.slug}`}>← {prev.title}</a>}</span>
      <a className="bk-toc-link" href="/book">目錄</a>
      <span>{next === null ? null : <a href={`/book/${next.slug}`}>{next.title} →</a>}</span>
    </nav>
  );
}

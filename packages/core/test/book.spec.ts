import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toHant, unclassifiedOf, SIMPLIFIED_ONLY, TERMS } from "../src/report/hant.js";

/**
 * 《一张盘是怎么算出来的》的简繁转换。
 *
 * 书是目前喂给 `toHant` 的**最大一份外部语料** —— 它是面向读者的散文，
 * 用词远超报告模板的窄域，一次就带进 247 个未归类字与 8 个缺失词条。
 * 故这几条断言的价值不在「书能转」，而在它们会在**书被改动时**
 * 当场逮到新冒出来的未归类字：网页版的繁体是构建期转的，
 * 转不动就是构建失败，而不是读者打开页面才白屏。
 */
const DIRS = ["book", "book-compare", "reference"] as const;
const ROOT = resolve(import.meta.dirname, "../../..");
/** `<目录>/<文件>` 的扁平清单 —— 三处共用同一套断言。 */
const FILES: string[] = DIRS.flatMap((d) =>
  readdirSync(resolve(ROOT, d)).filter((f) => f.endsWith(".md")).map((f) => `${d}/${f}`));
const read = (f: string) => readFileSync(resolve(ROOT, f), "utf8");

describe("书的简繁转换", () => {
  it("两本书与书目都在，且不止一两篇", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(30);
    for (const d of DIRS) {
      expect(FILES.filter((f) => f.startsWith(`${d}/`)).length, d).toBeGreaterThan(5);
    }
  });

  it("**词条不得被软换行切断** —— 切断了就转不出来，而且错得很隐蔽", () => {
    // `toHant` 逐字扫，词条匹配不跨换行。正文是硬折行的散文，
    // 「农历」「星历」这种词一旦恰好折在中间，前半留在上一行、后半在下一行，
    // 两边各自都不构成词条 —— 于是「历」落单，当场抛错。
    // 实测撞上过一次（reference/中土-星命.md 的「农历」）。
    const bad: string[] = [];
    for (const f of FILES) {
      const lines = read(f).split("\n");
      for (let i = 0; i + 1 < lines.length; i++) {
        const a = lines[i]!; const b = lines[i + 1]!;
        if (a.trim() === "" || b.trim() === "") continue;   // 空行不是软换行
        const seam = a.slice(-6) + b.slice(0, 6);
        for (const k of Object.keys(TERMS)) {
          if (k.length < 2) continue;
          if (seam.includes(k) && !a.includes(k) && !b.includes(k)) {
            bad.push(`${f}:${i + 1} 「${k}」`);
          }
        }
      }
    }
    expect(bad, "以下词条被折行切断，把那一行重排即可").toEqual([]);
  });

  it("**每一个汉字都已归类** —— 新字出现时这里会指名道姓", () => {
    const un = unclassifiedOf(FILES.map(read).join("\n"));
    expect(un, `书里以下汉字未归类，请在 hant.ts 里明确：${un.join("")}`).toEqual([]);
  });

  it("**转得出来，且不抛错** —— 抛错在网页上就是构建失败", () => {
    for (const f of FILES) expect(() => toHant(read(f)), f).not.toThrow();
  });

  it("**繁体里没有一个简体字**", () => {
    for (const f of FILES) {
      const out = toHant(read(f));
      const leaked = SIMPLIFIED_ONLY.filter((c) => out.includes(c));
      expect(leaked, `${f} 残留简体：${leaked.join("")}`).toEqual([]);
    }
  });

  it("转换是幂等的", () => {
    for (const f of FILES) {
      const once = toHant(read(f));
      expect(toHant(once), f).toBe(once);
    }
  });

  it("书里那几个歧义字，取的是书里的那个义", () => {
    // 这六个字在书里各只有一种用法，故 AMBIGUOUS 的 pick 有定。
    // 若日后书里出现另一种用法（如「松树」），这条会提醒要改成词条。
    expect(toHant("门槛调松一点")).toBe("門檻調鬆一點");
    expect(toHant("人生轨迹")).toBe("人生軌跡");
    expect(toHant("自己看账")).toBe("自己看帳");
    expect(toHant("意思很朴素")).toBe("意思很樸素");
    expect(toHant("参数校准面板")).toBe("參數校準面板");
    expect(toHant("你填的问卷")).toBe("你填的問卷");
  });

  it("**反向对照：书里确实有需要转的字** —— 否则上面几条可能全绿而什么都没做", () => {
    const src = FILES.map(read).join("\n");
    const hit = SIMPLIFIED_ONLY.filter((c) => src.includes(c));
    expect(hit.length, "书里一个简体专用字都没有？那转换根本没发生").toBeGreaterThan(50);
  });
});

describe("书的结构", () => {
  it("**每张表都有分隔行** —— 没有它，Markdown 根本不把它当表", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const lines = read(f).split("\n");
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i]!;
        if (!ln.startsWith("|") || ln.trim().startsWith("|--")) continue;
        const nxt = lines[i + 1] ?? "";
        if (!/^\|\s*:?-{2,}/.test(nxt.trim())) bad.push(`${f}:${i + 1}`);
        while (i < lines.length && lines[i]!.startsWith("|")) i++;
      }
    }
    expect(bad, "以下表缺分隔行").toEqual([]);
  });

  it("**章节之间的链接都指向真实的文件**", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const dir = resolve(ROOT, f, "..");
      for (const m of read(f).matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
        const t = m[1]!;
        if (t.startsWith("http")) continue;
        // 以 / 开头的是**站内路由**（应用里的页面），不是文件
        if (t.startsWith("/")) continue;
        if (!existsSync(resolve(dir, t))) bad.push(`${f} → ${t}`);
      }
    }
    expect(bad, "断链").toEqual([]);
  });
});

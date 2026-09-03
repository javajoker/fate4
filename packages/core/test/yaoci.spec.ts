import { describe, expect, it } from "vitest";
import {
  GUA_SLOT, parseReceived, receivedHexagram, receivedIndexOf, receivedName,
  stageOf, yaociAt, yaociOf, YAOCI_PROVENANCE,
  type YaoPos, type YaociLocale,
} from "../src/yijing/yaoci.js";
import { HEXAGRAMS, hexagramOf, keyOf } from "../src/yijing/hexagrams.js";
import { RECEIVED_BINARY, zhHans, zhHant, en } from "@fate/data/yaoci";
import { castMomentOf } from "../src/liuyao/moment.js";
import { cast, type CoinThrow } from "../src/liuyao/cast.js";
import { dress } from "../src/liuyao/dress.js";
import { pickYongshen } from "../src/liuyao/yongshen.js";
import { judge } from "../src/liuyao/judge.js";
import {
  collectYaociText, relayerYaoci, yaociReading, QUOTE_PREFIX,
} from "../src/liuyao/yaoci.js";
import { buildQuestionReport } from "../src/liuyao/report.js";
import { renderQuestionMarkdown } from "../src/liuyao/markdown.js";
import { plainYaoci } from "../src/plain/question.js";
import { scanText } from "../src/report/guard.js";
import { scanPlain } from "../src/plain/guard.js";
import { SIMPLIFIED_ONLY } from "../src/report/hant.js";
import { buildChart } from "../src/chart/buildChart.js";
import { dailyOutlook } from "../src/liuyao/daily.js";
import { renderDailyMarkdown } from "../src/liuyao/markdown.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { loadParams } from "../src/params/load.js";

const P = DEFAULT_PARAMS;
const COIN = loadParams({ liuyao: { castMethod: "coin" } });
const at = (y: number, mo: number, d: number, h: number) => castMomentOf({
  year: y, month: mo, day: d, hour: h, minute: 30,
  timeZone: "Asia/Shanghai", longitude: 121.47,
});
const MOMENTS = [at(2026, 9, 2, 14), at(2026, 3, 15, 10), at(2025, 12, 5, 8)];

/** 遍历若干时刻 × 掷钱组合 —— 掷钱法能掷出六爻皆静，按时法不能。 */
function* allGua(stride = 17) {
  for (const m of MOMENTS) {
    for (let n = 0; n < 4096; n += stride) {
      const t = Array.from({ length: 6 }, (_, i) => ((n >> (i * 2)) & 3) as CoinThrow);
      yield dress(cast(m, { method: "coin", throws: t as never }, COIN.liuyao), COIN.liuyao);
    }
  }
}
const reading = (
  g: ReturnType<typeof dress>, locale: YaociLocale = "zh-Hans",
  layer: "technical" | "plain" = "technical",
) => yaociReading(g, pickYongshen(g, "career.promotion").value, { locale, layer });

// ═══════════════════════════════════════════════════════════

describe("**卦序的双重转录互为对质**", () => {
  it("照卦画查出来的卦，卦名必须等于语料自带的名单", () => {
    // 语料按通行本编号，本项目按京房八宫生成。搬过来的两份（卦画串、卦名）
    // 都可能抄错，而单独一份错了无从发觉 —— 故让它们互相指认。
    for (let i = 0; i < 64; i++) {
      expect(receivedHexagram(i).name, `通行本第 ${i + 1} 卦`).toBe(receivedName(i));
    }
  });

  it("六十四个卦画互不相同，且恰好覆盖本项目生成的六十四卦", () => {
    const keys = RECEIVED_BINARY.map((b) => keyOf(parseReceived(b)));
    expect(new Set(keys).size).toBe(64);
    expect(new Set(keys)).toEqual(new Set(HEXAGRAMS.map((h) => keyOf(h.lines))));
  });

  it("通行本序号与卦一一对应，来回一趟回到原处", () => {
    for (const h of HEXAGRAMS) {
      expect(receivedHexagram(receivedIndexOf(h)).name).toBe(h.name);
    }
  });

  it("卦画串的下标 0 是初爻 —— 与本项目同序", () => {
    // 反向对照：若语料按「自上而下」存，屯与蒙就会互换。
    expect(hexagramOf(parseReceived("100010")).name).toBe("水雷屯");
    expect(hexagramOf(parseReceived("010001")).name).toBe("山水蒙");
  });
});

describe("语料本身", () => {
  const PACKS: readonly [YaociLocale, typeof zhHans][] = [
    ["zh-Hans", zhHans], ["zh-Hant", zhHant], ["en", en],
  ];

  for (const [loc, pack] of PACKS) {
    it(`${loc}：64 卦 × 7 格，四类文字齐备`, () => {
      for (const field of ["CLASSIC", "GIST", "EXPAND"] as const) {
        expect(pack[field].length, `${loc}.${field}`).toBe(448);
      }
      expect(pack.STAGE.length).toBe(6);
      for (let h = 0; h < 64; h++) {
        expect(pack.GIST[h * 7], `${loc} 第 ${h} 卦的卦辞格不该有指事`).toBe("");
        for (let s = 0; s <= 6; s++) {
          expect(pack.CLASSIC[h * 7 + s]!.trim().length).toBeGreaterThan(0);
          expect(pack.EXPAND[h * 7 + s]!.trim().length).toBeGreaterThan(0);
          if (s > 0) expect(pack.GIST[h * 7 + s]!.trim().length).toBeGreaterThan(0);
        }
      }
    });
  }

  it("**繁体语料里没有一个简体字** —— 它不经 toHant，故只能自己干净", () => {
    const bad = new Set<string>();
    const S = new Set(SIMPLIFIED_ONLY);
    for (const field of ["CLASSIC", "GIST", "EXPAND", "STAGE"] as const) {
      for (const s of zhHant[field]) for (const ch of s) if (S.has(ch)) bad.add(ch);
    }
    expect([...bad], `繁体语料残留简体：${[...bad].join("")}`).toEqual([]);
  });

  it("出处与校验和记在案", () => {
    expect(YAOCI_PROVENANCE.sources.length).toBe(4);
    for (const s of YAOCI_PROVENANCE.sources) expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("**爻位下标：0 是卦辞，1–6 才是爻**", () => {
  // 原型在此处错了一位（0 基下标直接当格号），于是初爻取到卦辞、上爻取到五爻。
  // 爻辞原文自带爻题，正好可以逐格对质 —— 这一条错开一格必然全线失败。
  const HEAD: Readonly<Record<number, RegExp>> = {
    1: /^初[九六]/, 2: /^[九六]二/, 3: /^[九六]三/,
    4: /^[九六]四/, 5: /^[九六]五/, 6: /^上[九六]/,
  };

  it("每一格的爻辞原文都以对应的爻题起头", () => {
    for (let i = 0; i < 64; i++) {
      for (let s = 1 as YaoPos; s <= 6; s = (s + 1) as YaoPos) {
        expect(yaociAt(i, s).classic, `第 ${i} 卦第 ${s} 爻`).toMatch(HEAD[s]!);
      }
    }
  });

  it("卦辞格不带爻题，也没有一句话指事", () => {
    for (let i = 0; i < 64; i++) {
      const e = yaociAt(i, GUA_SLOT);
      expect(e.classic).not.toMatch(/^(?:初|上)?[九六][二三四五]?/);
      expect(e.gist).toBeNull();
      expect(e.expand.length).toBeGreaterThan(0);
    }
  });

  it("乾卦逐爻对得上典籍", () => {
    const qian = hexagramOf([1, 1, 1, 1, 1, 1]);
    expect(yaociOf(qian, 1).classic).toContain("潜龙勿用");
    expect(yaociOf(qian, 5).classic).toContain("飞龙在天");
    expect(yaociOf(qian, 6).classic).toContain("亢龙有悔");
    expect(yaociOf(qian, GUA_SLOT).classic).toContain("元");
  });

  it("爻位阶段只随位置变，不随卦变；六条各不相同", () => {
    const all = ([1, 2, 3, 4, 5, 6] as const).map((p) => stageOf(p));
    expect(new Set(all).size).toBe(6);
    expect(all.every((s) => s.length > 0)).toBe(true);
  });
});

describe("取爻", () => {
  it("有动爻则取动爻，位置逐一对上", () => {
    let seen = 0;
    for (const g of allGua(97)) {
      const moving = g.yaos.filter((y) => y.moving).map((y) => y.pos);
      if (moving.length === 0) continue;
      seen++;
      const r = reading(g);
      expect(r.method).toBe("动爻");
      expect(r.picks.map((p) => p.pos)).toEqual(moving);
      expect(r.picks.every((p) => p.role === "动爻")).toBe(true);
      expect(r.picks.every((p) => p.bian !== null)).toBe(true);
    }
    expect(seen).toBeGreaterThan(50);
  });

  it("**六爻皆静则取世应，且应是对方不是将来**", () => {
    let seen = 0;
    for (const g of allGua(1)) {
      if (g.yaos.some((y) => y.moving)) continue;
      seen++;
      const r = reading(g);
      expect(r.method).toBe("世应");
      expect(r.picks.map((p) => [p.pos, p.role]))
        .toEqual([[g.shi, "世爻"], [g.ying, "应爻"]]);
      // 静卦没有变卦，故没有「变过去」那一半 —— 原型把应爻当作「将来」正是
      // 因为这里空着，需要填点什么。空着就空着。
      expect(r.picks.every((p) => p.bian === null)).toBe(true);
      if (seen > 40) break;
    }
    expect(seen, "掷钱法应能掷出六爻皆静").toBeGreaterThan(10);
  });

  it("按时起卦恒得一个动爻 —— 故世应那一路只在掷钱下出现", () => {
    for (const m of MOMENTS) {
      const g = dress(cast(m, { method: "time" }, P.liuyao), P.liuyao);
      expect(g.yaos.filter((y) => y.moving).length).toBe(1);
      expect(reading(g).method).toBe("动爻");
    }
  });

  it("**指事不随占事而变** —— 它按象辞自己的规矩取爻，不看用神", () => {
    for (const g of allGua(211)) {
      const a = yaociReading(g, pickYongshen(g, "wealth.seek").value);
      const b = yaociReading(g, pickYongshen(g, "career.promotion").value);
      const strip = (r: typeof a) => JSON.stringify({
        method: r.method, gua: r.gua,
        picks: r.picks.map(({ isYongshen: _ignored, ...rest }) => rest),
      });
      expect(strip(a), "换一个占事，取到的爻与引文都该一样").toBe(strip(b));
    }
  });

  it("用神位只作记录 —— 命中率既非 0 也非 1", () => {
    // 反向对照：恒为 true 说明取爻偷看了用神；恒为 false 说明标记没接上。
    let hit = 0; let n = 0;
    for (const g of allGua(53)) { n++; if (reading(g).hitsYongshen) hit++; }
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThan(n);
  });
});

describe("**引文过闸 —— 不通过就不发**", () => {
  for (const layer of ["technical", "plain"] as const) {
    for (const locale of ["zh-Hans", "zh-Hant"] as const) {
      it(`${layer}/${locale}：发出去的每一段都过本层守卫`, () => {
        const scan = layer === "technical" ? scanText : scanPlain;
        for (const g of allGua(83)) {
          for (const c of collectYaociText(reading(g, locale, layer))) {
            expect(c.where.startsWith(QUOTE_PREFIX), "引文须带 quote: 前缀").toBe(true);
            expect(scan(c.text, c.where), `${c.where}：${c.text}`).toEqual([]);
          }
        }
      });
    }
  }

  it("**守卫确有咬合 —— 全通过可能只是因为闸没接上**", () => {
    let tech = 0; let plain = 0; let quoted = 0;
    for (const g of allGua(17)) {
      const t = reading(g, "zh-Hans", "technical");
      const q = reading(g, "zh-Hans", "plain");
      tech += t.withheldCount; plain += q.withheldCount; quoted += q.quoted;
    }
    expect(tech, "技术层一条都没拦下，闸多半没接上").toBeGreaterThan(0);
    expect(plain, "人话层一条都没拦下，闸多半没接上").toBeGreaterThan(0);
    // 也不该拦掉大半 —— 那说明规则与语料根本不兼容，该重新考虑载不载它
    expect(plain / quoted).toBeLessThan(0.1);
  });

  it("技术层不载爻位阶段与白话转述；人话层两样都载", () => {
    // 这两项通篇第二人称，技术层禁第二人称 —— 是构造上不载，不是取了被拦。
    for (const g of allGua(211)) {
      const t = reading(g, "zh-Hans", "technical");
      for (const p of t.picks) {
        expect(p.stage).toBeNull();
        expect(p.ben.expand).toBeNull();
      }
      const q = reading(g, "zh-Hans", "plain");
      for (const p of q.picks) {
        expect(p.stage).not.toBeNull();
        expect(p.ben.expand).not.toBeNull();
      }
    }
  });

  it("爻辞原文两层皆零拦 —— 经文本身不构成断言的形状", () => {
    for (const layer of ["technical", "plain"] as const) {
      const scan = layer === "technical" ? scanText : scanPlain;
      for (let i = 0; i < 64; i++) {
        for (let s = 0; s <= 6; s++) {
          const t = yaociAt(i, s as 0 | YaoPos).classic;
          expect(scan(t, `classic.${i}.${s}`), t).toEqual([]);
        }
      }
    }
  });

  it("**简繁拦下的条数相同** —— 反向对照：曾经是 47 比 1", () => {
    // 那 46 条的差额不是繁体语料更干净，是人话守卫只装了简体规则。
    // 补齐后又剩 25 条，那是「凶险」的繁体作「兇險」而机械派生给出「凶險」。
    for (const layer of ["technical", "plain"] as const) {
      let hans = 0; let hant = 0;
      for (const g of allGua(17)) {
        hans += reading(g, "zh-Hans", layer).withheldCount;
        hant += reading(g, "zh-Hant", layer).withheldCount;
      }
      expect(hant, `${layer} 层简繁拦下条数不等`).toBe(hans);
    }
  });
});

describe("换层", () => {
  it("relayer 只换引哪几项，取到的爻一个不变", () => {
    for (const g of allGua(97)) {
      const t = reading(g, "zh-Hans", "technical");
      const q = relayerYaoci(t, "plain");
      expect(q.method).toBe(t.method);
      expect(q.picks.map((p) => [p.pos, p.role, p.isYongshen]))
        .toEqual(t.picks.map((p) => [p.pos, p.role, p.isYongshen]));
      expect(q.gua.ben.received).toBe(t.gua.ben.received);
      expect(q.gua.bian?.received ?? null).toBe(t.gua.bian?.received ?? null);
      expect(q.hitsYongshen).toBe(t.hitsYongshen);
    }
  });

  it("已是本层则原样返回，不重扫", () => {
    const g = [...allGua(1301)][0]!;
    const q = reading(g, "zh-Hans", "plain");
    expect(relayerYaoci(q, "plain")).toEqual(q);
  });
});

describe("落到报告里", () => {
  const gua = dress(cast(MOMENTS[0]!, { method: "time" }, P.liuyao), P.liuyao);
  const ys = pickYongshen(gua, "career.promotion");
  const j = judge(gua, ys, P.liuyao);

  it("问事报告带上指事，且它的每一段都在统扫范围内", () => {
    const r = buildQuestionReport(j, P);
    expect(r.yaoci.narrative.length).toBeGreaterThan(0);
    expect(r.yaoci.reading.picks.length).toBeGreaterThan(0);
    expect(r.guard.violations).toEqual([]);
  });

  it("**繁体引文原样穿过 Markdown 的繁体转换** —— 不再被转一次", () => {
    const PH = loadParams({ report: { locale: "zh-Hant" } });
    const r = buildQuestionReport(j, PH, { locale: "zh-Hant" });
    const md = renderQuestionMarkdown(r);
    for (const c of collectYaociText(r.yaoci.reading)) {
      expect(md, `${c.where} 的引文在 Markdown 里被改动了`).toContain(c.text);
    }
    expect(md).not.toMatch(/⟦q\d+⟧/);
  });

  it("**当日运程的繁体里也没有简体引文** —— 读法建于参数语言，渲染语言另给", () => {
    // 实打实的 bug：`dailyOutlook` 用 `params.report.locale` 建读法，
    // 而 `renderDailyMarkdown(o, locale)` 的语言是调用方当场给的。
    // 两者不一致时，保护引文不被二次转换的那套占位符会忠实地保住**简体**爻辞，
    // 于是繁体文档里嵌着简体引文。`fate daily --locale zh-Hant` 一跑就露。
    const chart = buildChart({
      year: 1990, month: 6, day: 15, hour: 10, minute: 30,
      timeZone: "Asia/Shanghai", longitude: 121.47, gender: "male",
    });
    const o = dailyOutlook(chart, { year: 2026, month: 9, day: 4 }, P);
    expect(o.liuyao.yaoci.locale).toBe("zh-Hans");
    const md = renderDailyMarkdown(o, "zh-Hant");
    const leaked = SIMPLIFIED_ONLY.filter((c) => md.includes(c));
    expect(leaked, `繁体当日运程残留简体：${leaked.join("")}`).toEqual([]);
    // 反向对照：简体那一版照旧是简体，没被顺手转成繁体
    expect(renderDailyMarkdown(o, "zh-Hans")).toContain("指事");
  });

  it("人话层的指事卡片过人话守卫", () => {
    const cards = plainYaoci(buildQuestionReport(j, P));
    expect(cards.length).toBeGreaterThan(2);
    for (const c of cards) {
      expect(scanPlain(c.body, c.id), `${c.id}：${c.body}`).toEqual([]);
      expect(c.body).not.toContain("**");
    }
  });

  it("**指事不参与断卦** —— 断论与应期不含任何一条引文", () => {
    const r = buildQuestionReport(j, P);
    const decided = [...r.judgement.narrative, ...r.yingqi.narrative].map((l) => l.text).join("");
    for (const c of collectYaociText(r.yaoci.reading)) {
      expect(decided, "引文漏进了断论").not.toContain(c.text);
    }
  });
});

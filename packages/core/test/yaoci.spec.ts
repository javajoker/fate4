import { describe, expect, it } from "vitest";
import {
  GUA_GIST, GUA_SLOT, parseReceived, receivedHexagram, receivedIndexOf, receivedName,
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
  collectYaociText, pickSource, relayerYaoci, yaociReading, zhishiSlots, QUOTE_PREFIX,
} from "../src/liuyao/yaoci.js";
import { buildQuestionReport } from "../src/liuyao/report.js";
import { renderQuestionMarkdown } from "../src/liuyao/markdown.js";
import { plainYaoci, ZHISHI_RULE_PLAIN } from "../src/plain/question.js";
import { zhishiProse } from "../src/plain/zhishi.js";
import { scanText } from "../src/report/guard.js";
import { scanPlain } from "../src/plain/guard.js";
import { SIMPLIFIED_ONLY, toHant, unclassifiedOf } from "../src/report/hant.js";
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
        // 语料本身的卦辞格仍为空 —— 卦辞指事另放在 guaGist.ts，语料不动
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

describe("**卦辞指事（本项目撰述）**", () => {
  // 语料的卦辞格没有一句话指事，七例里只取卦辞的三例（静、三爻动、六爻动）
  // 指事一栏就空着。GUA_GIST 补上这一格 —— 它是本项目写的，不是搬来的，
  // 所以这里替它把语料那边由生成脚本与 SHA256 把住的几道关自己把一遍。
  const LOCS = ["zh-Hans", "zh-Hant", "en"] as const;

  it("三种语言各 64 条，无空条，且同一卦三语各不相同（没有漏译、错位成同一句）", () => {
    for (const loc of LOCS) {
      expect(GUA_GIST[loc]).toHaveLength(64);
      for (const g of GUA_GIST[loc]) expect(g.trim().length).toBeGreaterThan(0);
      expect(new Set(GUA_GIST[loc]).size, `${loc} 有重复条目`).toBe(64);
    }
  });

  it("**繁体与简体逐字对得上** —— 写死的繁体就是 toHant 的结果，且每个字都已归类", () => {
    // 繁体写死在文件里而不是运行时转（yijing 不该依赖报告层），
    // 故必须有人盯着两者不漂开：简体改了一个字，这里就红。
    for (let i = 0; i < 64; i++) {
      expect(GUA_GIST["zh-Hant"][i], `第 ${i + 1} 卦`).toBe(toHant(GUA_GIST["zh-Hans"][i]!));
    }
    expect(unclassifiedOf(GUA_GIST["zh-Hans"].join(""))).toEqual([]);
    const S = new Set(SIMPLIFIED_ONLY);
    const left = [...GUA_GIST["zh-Hant"].join("")].filter((c) => S.has(c));
    expect(left, `繁体残留简体：${left.join("")}`).toEqual([]);
  });

  it("每一条都过技术层与人话层两道守卫 —— 它会在技术层的指事栏里原样出现", () => {
    for (const loc of LOCS) {
      GUA_GIST[loc].forEach((g, i) => {
        expect(scanText(g, `guaGist.${loc}.${i}`), `${loc} 第 ${i + 1} 卦：${g}`).toEqual([]);
        expect(scanPlain(g, `guaGist.${loc}.${i}`), `${loc} 第 ${i + 1} 卦：${g}`).toEqual([]);
      });
    }
  });

  it("对得上卦：几条有辨识度的字眼落在对应的卦上（防整表错位一格）", () => {
    // 以白话转述为准写的，故挑转述里独有的意象来对质。卦序为通行本。
    const at = (n: number) => GUA_GIST["zh-Hans"][n - 1]!;
    expect(at(9)).toContain("密云");        // 小畜：密云不雨
    expect(at(10)).toContain("虎尾");       // 履
    expect(at(20)).toContain("酒香");       // 观：酒香不怕巷子深
    expect(at(28)).toContain("栋梁");       // 大过：栋桡
    expect(at(48)).toContain("耗尽");       // 井：资源耗尽
    expect(at(51)).toContain("惊雷");       // 震
    expect(at(64)).toContain("鸟尽弓藏");   // 未济
    expect(receivedName(0)).toBe("乾为天");
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

  it("卦辞格不带爻题；一句话指事取自 GUA_GIST", () => {
    for (const loc of ["zh-Hans", "zh-Hant", "en"] as const) {
      for (let i = 0; i < 64; i++) {
        const e = yaociAt(i, GUA_SLOT, loc);
        expect(e.classic).not.toMatch(/^(?:初|上)?[九六][二三四五]?/);
        expect(e.gist).toBe(GUA_GIST[loc][i]);
        expect(e.expand.length).toBeGreaterThan(0);
      }
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

/** 按掷钱结果直接起一卦。3 老阳、0 老阴（动），1 少阳、2 少阴（静）。 */
const coinGua = (throws: readonly CoinThrow[], m = MOMENTS[0]!) =>
  dress(cast(m, { method: "coin", throws: throws as never }, COIN.liuyao), COIN.liuyao);

describe("**指事七例：按动爻多寡取辞**", () => {
  // 期望表照规则逐条手写，不调实现里的任何一段 —— 否则测的是实现自己。
  const POS = [1, 2, 3, 4, 5, 6] as const;
  const expected = (moving: readonly number[]): [string, number, string][] => {
    const still = POS.filter((p) => !moving.includes(p));
    switch (moving.length) {
      case 0: return [["本卦", 0, "主"]];                                   // 本卦卦辞
      case 1: return [["本卦", moving[0]!, "主"]];                          // 本卦变爻
      case 2: return [["本卦", moving[1]!, "主"], ["本卦", moving[0]!, "次"]]; // 上者为主
      case 3: return [["本卦", 0, "体"], ["变卦", 0, "用"]];                 // 本体变用
      case 4: return [["变卦", still[0]!, "主"], ["变卦", still[1]!, "次"]];   // 下者为主
      case 5: return [["变卦", still[0]!, "主"]];                           // 变卦不变爻
      default: return [["变卦", 0, "主"]];                                  // 变卦卦辞
    }
  };

  it("六十四种动爻组合逐一对上", () => {
    for (let mask = 0; mask < 64; mask++) {
      const moving = POS.filter((p) => (mask >> (p - 1)) & 1);
      const got = zhishiSlots(moving).map((x) => [x.source, x.slot, x.role]);
      expect(got, `动爻 ${moving.join(",") || "无"}`).toEqual(expected(moving));
    }
  });

  it("几个手算的例子", () => {
    const sl = (m: number[]) => zhishiSlots(m).map((x) => `${x.source}${x.slot}${x.role}`);
    expect(sl([])).toEqual(["本卦0主"]);
    expect(sl([4])).toEqual(["本卦4主"]);
    expect(sl([5, 2])).toEqual(["本卦5主", "本卦2次"]);       // 次序无关；上者五爻为主
    expect(sl([1, 3, 6])).toEqual(["本卦0体", "变卦0用"]);
    expect(sl([1, 2, 4, 6])).toEqual(["变卦3主", "变卦5次"]); // 不变者三、五；下者三爻为主
    expect(sl([1, 2, 3, 4, 6])).toEqual(["变卦5主"]);
    expect(sl([1, 2, 3, 4, 5, 6])).toEqual(["变卦0主"]);
  });

  it("**本卦的爻只取动的，变卦的爻只取不动的**", () => {
    // 这是七例的骨架：动得少，事在本卦，读动处；动过半，事到变卦，读站得住的不动处。
    for (let mask = 0; mask < 64; mask++) {
      const moving = POS.filter((p) => (mask >> (p - 1)) & 1);
      for (const x of zhishiSlots(moving)) {
        if (x.slot === 0) continue;
        expect(moving.includes(x.slot as never), `动爻 ${moving.join(",")}`)
          .toBe(x.source === "本卦");
      }
    }
  });

  it("动爻位重复或越界即抛错", () => {
    expect(() => zhishiSlots([2, 2])).toThrow();
    expect(() => zhishiSlots([0])).toThrow();
    expect(() => zhishiSlots([7])).toThrow();
  });
});

describe("取辞落到卦上", () => {
  it("每一卦：所取之格与七例一致，引文出自对应那一卦的对应那一格", () => {
    const seen = new Set<number>();
    for (const g of allGua(17)) {
      const r = reading(g);
      const moving = g.yaos.filter((y) => y.moving).map((y) => y.pos);
      seen.add(r.count);
      expect(r.count).toBe(moving.length);
      expect([...r.moving]).toEqual(moving);
      expect(r.picks.map((x) => [x.source, x.slot, x.role]))
        .toEqual(zhishiSlots(moving).map((x) => [x.source, x.slot, x.role]));
      for (const x of r.picks) {
        const h = x.source === "本卦" ? g.ben : g.bian!;
        expect(x.quotes.classic.text).toBe(yaociOf(h, x.slot).classic);
        expect(x.quotes.gist.text ?? x.quotes.gist.withheld.length).toBeTruthy();
      }
    }
    expect([...seen].sort(), "掷钱法下七例都该出现").toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("乾六爻皆动：取变卦坤的卦辞 —— 语料无用九，乾坤不作例外", () => {
    const r = reading(coinGua([3, 3, 3, 3, 3, 3]));
    expect(r.gua.ben.name).toBe("乾为天");
    expect(r.gua.bian?.name).toBe("坤为地");
    expect(r.picks).toHaveLength(1);
    expect(r.picks[0]!.quotes.classic.text).toContain("牝马");
  });

  it("三爻动：本卦与变卦两段卦辞，本卦为体在前", () => {
    // 初、三、五爻老阳（动），二、四、上爻少阴（静）。
    const g = coinGua([3, 2, 3, 2, 3, 2]);
    const r = reading(g);
    expect(r.count).toBe(3);
    expect(r.picks.map((x) => [x.source, x.role])).toEqual([["本卦", "体"], ["变卦", "用"]]);
    expect(r.picks[0]!.quotes.classic.text).toBe(yaociOf(g.ben, GUA_SLOT).classic);
    expect(r.picks[1]!.quotes.classic.text).toBe(yaociOf(g.bian!, GUA_SLOT).classic);
  });

  it("**六爻皆静取本卦卦辞，不再看世应**", () => {
    let seen = 0;
    for (const g of allGua(1)) {
      if (g.yaos.some((y) => y.moving)) continue;
      seen++;
      const r = reading(g);
      expect(r.gua.bian).toBeNull();
      expect(r.picks.map((x) => [x.source, x.slot])).toEqual([["本卦", GUA_SLOT]]);
      expect(r.picks[0]!.quotes.classic.text).toBe(yaociOf(g.ben, GUA_SLOT).classic);
      if (seen > 40) break;
    }
    expect(seen, "掷钱法应能掷出六爻皆静").toBeGreaterThan(10);
  });

  it("按时起卦恒得一个动爻 —— 故默认走第二例，取本卦那一动爻", () => {
    for (const m of MOMENTS) {
      const g = dress(cast(m, { method: "time" }, P.liuyao), P.liuyao);
      const mv = g.yaos.filter((y) => y.moving).map((y) => y.pos);
      expect(mv.length).toBe(1);
      const r = reading(g);
      expect(r.picks.map((x) => [x.source, x.slot, x.role])).toEqual([["本卦", mv[0], "主"]]);
    }
  });

  it("**指事不随占事而变** —— 它按象辞自己的规矩取辞，不看用神", () => {
    for (const g of allGua(211)) {
      const a = yaociReading(g, pickYongshen(g, "wealth.seek").value);
      const b = yaociReading(g, pickYongshen(g, "career.promotion").value);
      const strip = (r: typeof a) => JSON.stringify({
        moving: r.moving, gua: r.gua,
        picks: r.picks.map(({ isYongshen: _ignored, ...rest }) => rest),
      });
      expect(strip(a), "换一个占事，取到的格与引文都该一样").toBe(strip(b));
    }
  });

  it("用神位只作记录 —— 命中率既非 0 也非 1；卦辞恒不算命中", () => {
    // 反向对照：恒为 true 说明取辞偷看了用神；恒为 false 说明标记没接上。
    let hit = 0; let n = 0;
    for (const g of allGua(53)) {
      const r = reading(g);
      for (const x of r.picks) if (x.slot === GUA_SLOT) expect(x.isYongshen).toBe(false);
      if (r.picks.every((x) => x.slot === GUA_SLOT)) continue;
      n++; if (r.hitsYongshen) hit++;
    }
    expect(hit).toBeGreaterThan(0);
    expect(hit).toBeLessThan(n);
  });
});

describe("**引文过闸 —— 不通过就不发**", () => {
  for (const layer of ["technical", "plain"] as const) {
    for (const locale of ["zh-Hans", "zh-Hant"] as const) {
      it(`${layer}/${locale}：发出去的每一段都过它该过的那道闸`, () => {
        for (const g of allGua(83)) {
          for (const c of collectYaociText(reading(g, locale, layer))) {
            expect(c.where.startsWith(QUOTE_PREFIX), "引文须带 quote: 前缀").toBe(true);
            // 白话转述恒走人话层的闸；其余随本层
            expect(c.gate).toBe(c.where.endsWith(".expand") ? "plain" : layer);
            const scan = c.gate === "technical" ? scanText : scanPlain;
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

  it("技术层不载爻位阶段；白话转述两层都载，且两层的取舍逐条相同", () => {
    // 白话转述两层都按人话层的闸过，所以同一条在两层要么都发、要么都拦。
    for (const g of allGua(211)) {
      const t = reading(g, "zh-Hans", "technical");
      const q0 = reading(g, "zh-Hans", "plain");
      t.picks.forEach((p, i) => {
        expect(p.stage).toBeNull();
        expect(p.quotes.expand).toEqual(q0.picks[i]!.quotes.expand);
      });
      const q = reading(g, "zh-Hans", "plain");
      for (const p of q.picks) {
        // 爻位阶段说的是爻位，卦辞没有爻位
        expect(p.stage === null).toBe(p.slot === GUA_SLOT);
        expect(p.quotes.expand).not.toBeNull();
      }
    }
  });

  it("**技术层的白话转述确实带着第二人称** —— 不然「换闸」就无从谈起", () => {
    // 反向对照：若技术层发出的白话转述里一个「你」都没有，说明它其实还在走技术层的闸
    // （或被拦光了），换闸这件事并没有生效。
    let withYou = 0; let withheld = 0;
    for (const g of allGua(83)) {
      for (const p of reading(g, "zh-Hans", "technical").picks) {
        if (p.quotes.expand.text === null) withheld++;
        else if (p.quotes.expand.text.includes("你")) withYou++;
      }
    }
    expect(withYou).toBeGreaterThan(50);
    // 人话层的闸照样在拦：祈使、占病预后之类
    expect(withheld).toBeGreaterThan(0);
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
  it("relayer 只换引哪几项，取到的格一个不变", () => {
    for (const g of allGua(97)) {
      const t = reading(g, "zh-Hans", "technical");
      const q = relayerYaoci(t, "plain");
      expect(q.moving).toEqual(t.moving);
      expect(q.count).toBe(t.count);
      expect(q.picks.map((p) => [p.source, p.slot, p.role, p.isYongshen]))
        .toEqual(t.picks.map((p) => [p.source, p.slot, p.role, p.isYongshen]));
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

  it("**七例各有各的取法说明**，且只在取到爻时才记用神位", () => {
    // 每一例挑一卦：0–6 个老阳，其余少阴
    for (let n = 0; n <= 6; n++) {
      const g = coinGua(Array.from({ length: 6 }, (_, i) => (i < n ? 3 : 2)) as CoinThrow[]);
      const ys2 = pickYongshen(g, "career.promotion");
      const r = buildQuestionReport(judge(g, ys2, COIN.liuyao), COIN);
      const ids = r.yaoci.narrative.map((l) => l.templateId);
      expect(ids, `${n} 爻动`).toContain(`liuyao.yaoci.rule${n}`);
      expect(ids.filter((i) => /^liuyao\.yaoci\.rule\d$/.test(i))).toHaveLength(1);
      const takesLines = n !== 0 && n !== 3 && n !== 6;
      expect(ids.includes("liuyao.yaoci.yongshen"), `${n} 爻动`).toBe(takesLines);
      expect(r.guard.violations).toEqual([]);

      // 说明里点名的主爻，就是表里排第一的那一格
      if (n === 2) expect(r.yaoci.narrative[0]!.text).toContain("以上者第 2 爻为主");
      if (n === 4) expect(r.yaoci.narrative[0]!.text).toContain("以下者第 5 爻为主");

      // Markdown：一格一行，不再有「变出」行
      const md = renderQuestionMarkdown(r);
      const sec = md.slice(md.indexOf("## §6 指事"), md.indexOf("## §7"));
      const rows = sec.split("\n").filter((l) => /^\| [主次体用] \|/.test(l));
      expect(rows).toHaveLength(r.yaoci.reading.picks.length);
      expect(sec).not.toContain("变出");
      // 每一条所取之辞下面都有白话转述，且带框定语
      expect(sec).toContain("白话转述 —— 语料作者对原文的现代转述");
      for (const pk of r.yaoci.reading.picks) {
        const x = pk.quotes.expand;
        expect(sec).toContain(x.text ?? `未通过措辞检查：${x.withheld.join("、")}`);
      }

      // 人话卡片过人话守卫；两条以上时标题带主次／体用
      const cards = plainYaoci(r);
      for (const c of cards) expect(scanPlain(c.body, c.id), `${c.id}：${c.body}`).toEqual([]);
      if (n === 3) {
        expect(cards.some((c) => c.title.endsWith("（这件事本身）"))).toBe(true);
        expect(cards.some((c) => c.title.endsWith("（它往哪里去）"))).toBe(true);
      }
      expect(new Set(cards.map((c) => c.id)).size, "卡片 id 不重").toBe(cards.length);
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

describe("**指事接成段落**（独立页面用）", () => {
  const OPEN: Readonly<Record<string, RegExp>> = {
    次: /^其次，/, 体: /^就这件事本身来说，/, 用: /^再看它往哪里去，/,
  };

  it("引文一字不改地出现在段落里；连接词按主／次／体／用各就各位；每一格爻辞都说阶段", () => {
    let seen = 0;
    for (const g of allGua(17)) {
      const r = reading(g, "zh-Hans", "plain");
      const z = zhishiProse(r);
      expect(z.rule.length).toBeGreaterThan(0);
      const byRole = new Map(z.paragraphs.map((p) => [p.role, p]));
      r.picks.forEach((pk) => {
        const para = byRole.get(pk.role);
        if (para === undefined) return;             // 整段都被拦下
        seen++;
        const body = para.text;
        for (const q of [pk.quotes.gist, pk.quotes.expand]) {
          // 句末标点可能被补上，故只查引文正文
          if (q.text !== null) expect(body, `${pk.role}：${q.text}`).toContain(q.text.replace(/[。？！]$/, ""));
        }
        // 爻辞的每一格各说各的阶段，紧跟在段首连接词后面；卦辞没有阶段
        if (pk.slot !== GUA_SLOT && pk.stage?.text != null) {
          const lead = pk.role === "次" ? "其次，" : "";
          expect(body.startsWith(lead + pk.stage.text), `${pk.role}：${body}`).toBe(true);
          if (pk.quotes.gist.text !== null) expect(body).toContain("这一步的要点是：");
        }
        if (pk.slot === GUA_SLOT) expect(body).not.toContain("这一步的要点是：");
        if (pk.role in OPEN) expect(body).toMatch(OPEN[pk.role]!);
        if (pk.role === "主" && pk.slot === GUA_SLOT) expect(body).toMatch(/^整体来看，/);
        expect(para.source).toBe(pickSource(r, pk));
        expect(para.title === null).toBe(pk.slot === GUA_SLOT);
        if (para.title !== null) expect(para.title).toMatch(/^(?:初|上)?[九六][二三四五]?$/);
      });
    }
    expect(seen).toBeGreaterThan(500);
  });

  it("接好的段落过人话守卫 —— 连接词不该把引文接成断言", () => {
    for (const g of allGua(17)) {
      for (const p of zhishiProse(reading(g, "zh-Hans", "plain")).paragraphs) {
        expect(scanPlain(p.text, "zhishi"), p.text).toEqual([]);
      }
    }
  });

  it("略去的段数如实计数；技术层的读法会先换到人话层", () => {
    let withheld = 0;
    for (const g of allGua(17)) {
      const t = reading(g, "zh-Hans", "technical");
      const z = zhishiProse(t);
      expect(z).toEqual(zhishiProse(reading(g, "zh-Hans", "plain")));
      withheld += z.withheld;
    }
    // 反向对照：白话转述有一成过不了人话守卫，一段都没略去说明计数没接上
    expect(withheld).toBeGreaterThan(0);
  });
});

describe("**指事接成段落：繁体与英文**", () => {
  const LOCS = ["zh-Hant", "en"] as const;

  it("引文取各自语言的语料原文，出现在段落里（英文句首可能被改成小写）", () => {
    for (const loc of LOCS) {
      for (const g of allGua(37)) {
        const r = reading(g, loc, "plain");
        const z = zhishiProse(r);
        expect(z.locale).toBe(loc);
        const all = z.paragraphs.map((p) => p.text).join("\n");
        for (const pk of r.picks) {
          for (const q of [pk.quotes.gist, pk.quotes.expand]) {
            if (q.text === null) continue;
            // 去掉首字（英文可能改了大小写）与句末标点（可能被补）再比
            const core = q.text.slice(1).replace(/[.。？！?!]$/, "");
            expect(all, `${loc}：${q.text}`).toContain(core);
          }
        }
      }
    }
  });

  it("繁体：本模块自己的话由简体机械转出，每个字都已归类，转出来没有残留简体", () => {
    const own = [
      ...ZHISHI_RULE_PLAIN, "其次，", "就这件事本身来说，", "再看它往哪里去，", "整体来看，",
      "这一步的要点是：", "具体来说，", "细说起来，", "本卦变卦卦辞第爻",
    ].join("");
    expect(unclassifiedOf(own)).toEqual([]);
    const S = new Set(SIMPLIFIED_ONLY);
    for (const g of allGua(37)) {
      const z = zhishiProse(reading(g, "zh-Hant", "plain"));
      const text = [z.rule, ...z.paragraphs.flatMap((p) => [p.text, p.source])].join("");
      const left = [...text].filter((ch) => S.has(ch));
      expect(left, `繁体残留简体：${left.join("")}`).toEqual([]);
    }
  });

  it("英文：逗号后的句首改小写，不出现「Secondly, When」", () => {
    for (const g of allGua(37)) {
      const z = zhishiProse(reading(g, "en", "plain"));
      expect(z.rule).toMatch(/^[A-Z].*\.$/);
      for (const p of z.paragraphs) {
        expect(p.text).not.toMatch(/(?:Secondly|concretely|detail|Overall|itself|heading), [A-Z][a-z]/);
        expect(p.source).toMatch(/^(?:Original|Changed) hexagram, No\. \d+ /);
        if (p.title !== null) expect(p.title).toMatch(/^(?:First|Second|Third|Fourth|Fifth|Top) (?:Nine|Six)$/);
      }
    }
  });

  it("接好的繁体、英文段落过人话守卫", () => {
    for (const loc of LOCS) {
      for (const g of allGua(37)) {
        for (const p of zhishiProse(reading(g, loc, "plain")).paragraphs) {
          expect(scanPlain(p.text, `zhishi.${loc}`), p.text).toEqual([]);
        }
      }
    }
  });
});

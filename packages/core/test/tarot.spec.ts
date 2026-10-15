import { describe, expect, it } from "vitest";
import {
  deck, DECK_SIZE, majorNumber, SUITS, RANKS, SUIT_ELEMENT,
  shuffle, drawSpread, SPREADS, spreadById, spreadStateSpace,
  cryptoRandom, TAROT_PENDING_CALIBRATION,
  type RandomSource, type Card,
} from "../src/tarot/index.js";
import { tarotDraws } from "../src/compare/statespace.js";
import { scanText } from "../src/report/guard.js";
import { scanPlain } from "../src/plain/guard.js";

describe("牌组的结构", () => {
  const D = deck();

  it("恒为 78 张，22 大牌 + 56 小牌，id 不重", () => {
    expect(D).toHaveLength(DECK_SIZE);
    expect(D.filter((c) => c.arcana === "major")).toHaveLength(22);
    expect(D.filter((c) => c.arcana === "minor")).toHaveLength(56);
    expect(new Set(D.map((c) => c.id)).size).toBe(78);
  });

  it("四花色各 14 张，位阶齐全", () => {
    for (const s of SUITS) {
      const cs = D.filter((c) => c.suit === s);
      expect(cs, s).toHaveLength(14);
      expect(new Set(cs.map((c) => String(c.rank))).size, s).toBe(RANKS.length);
    }
  });

  it("**韦特系只对调 8 与 11，其余一个不动**", () => {
    const by = (n: number) => D.find((c) => c.id === `major.${n}`)!;
    expect(majorNumber(by(8), "marseille")).toBe(8);     // 正义
    expect(majorNumber(by(8), "rws")).toBe(11);
    expect(majorNumber(by(11), "marseille")).toBe(11);   // 力量
    expect(majorNumber(by(11), "rws")).toBe(8);
    for (const n of [0, 1, 7, 9, 10, 12, 13, 21]) {
      expect(majorNumber(by(n), "rws"), `大牌 ${n}`).toBe(n);
    }
    // 两系下 22 个序号都必须恰好铺满 0–21，不重不漏
    for (const sys of ["marseille", "rws"] as const) {
      const ns = D.filter((c) => c.arcana === "major")
        .map((c) => majorNumber(c, sys)!).sort((a, b) => a - b);
      expect(ns, sys).toEqual([...Array(22).keys()]);
    }
  });

  it("小牌才有花色与位阶，大牌没有", () => {
    for (const c of D) {
      if (c.arcana === "major") {
        expect(c.suit, c.name).toBeUndefined();
        expect(majorNumber(c, "marseille"), c.name).not.toBeNull();
      } else {
        expect(c.suit, c.name).toBeDefined();
        expect(majorNumber(c, "marseille"), c.name).toBeNull();
      }
    }
  });

  it("**13 号在马赛系牌面无名** —— 那不是遗漏，是那套牌本来就不写", () => {
    expect(D.find((c) => c.id === "major.13")!.unnamedInMarseille).toBe(true);
    expect(D.filter((c) => c.unnamedInMarseille === true)).toHaveLength(1);
  });

  it("**两系元素归属的分歧只在权杖与宝剑之间**", () => {
    const a = SUIT_ELEMENT.goldenDawn;
    const b = SUIT_ELEMENT.swordsFire;
    expect(a.cups).toBe(b.cups);
    expect(a.pentacles).toBe(b.pentacles);
    expect(a.wands).not.toBe(b.wands);
    expect(a.swords).not.toBe(b.swords);
    // 两家都是「火风」这两个元素在对调，不是凭空换别的
    expect(new Set([a.wands, a.swords])).toEqual(new Set([b.wands, b.swords]));
  });
});

describe("洗牌", () => {
  /** 可复现的测试用随机源 —— 只用于测试，生产路径恒用 crypto。 */
  const seeded = (seed: number): RandomSource => {
    let s = seed >>> 0;
    return {
      id: `test.lcg(${seed})`,
      int(n: number) {
        s = (s * 1664525 + 1013904223) >>> 0;
        return Math.floor((s / 0x100000000) * n);
      },
    };
  };

  it("洗过之后仍是同一副牌 —— 不增不减不重", () => {
    const out = shuffle(deck(), seeded(42));
    expect(out).toHaveLength(78);
    expect(new Set(out.map((c) => c.id)).size).toBe(78);
  });

  it("**每张牌落到每个位置的概率均匀** —— 有偏的洗牌是这类系统最不该有的", () => {
    // 跟踪一张固定的牌落在前 6 个位置上的次数。
    // 均匀时每格期望 N/78；取 N = 78 × 400，期望 400。
    const N = 78 * 400;
    const rnd = seeded(7);
    const target = "major.0";
    const counts = new Array<number>(78).fill(0);
    for (let i = 0; i < N; i++) {
      const out = shuffle(deck(), rnd);
      counts[out.findIndex((c) => c.id === target)]! += 1;
    }
    const expected = N / 78;
    // 卡方检验，78 格 77 自由度。临界值 (p=0.001) 约 124.8
    const chi2 = counts.reduce((s, o) => s + (o - expected) ** 2 / expected, 0);
    expect(chi2, `χ² = ${chi2.toFixed(1)}，自由度 77`).toBeLessThan(124.8);
  });

  it("**反向对照：一个故意有偏的洗牌必须被同一个检验逮到**", () => {
    // 常见的错写法：每次与 [0, n) 中任一交换，而不是 [0, i]。
    // 它「实际看不出来」—— 正是这条检验要证明它看得出来。
    const rnd = seeded(7);
    const biased = (xs: readonly Card[]): readonly Card[] => {
      const a = [...xs];
      for (let i = a.length - 1; i > 0; i--) {
        const j = rnd.int(a.length);          // ← 错在这里
        const t = a[i]!; a[i] = a[j]!; a[j] = t;
      }
      return a;
    };
    const N = 78 * 400;
    const counts = new Array<number>(78).fill(0);
    for (let i = 0; i < N; i++) {
      counts[biased(deck()).findIndex((c) => c.id === "major.0")]! += 1;
    }
    const expected = N / 78;
    const chi2 = counts.reduce((s, o) => s + (o - expected) ** 2 / expected, 0);
    expect(chi2, `有偏版 χ² = ${chi2.toFixed(1)}，应当远超临界值`)
      .toBeGreaterThan(124.8);
  });

  it("**crypto 随机源无模偏** —— 用的是拒绝采样，不是取模", () => {
    // 78 不整除 2³²，取模会让小余数多出现。直接检验分布。
    const N = 78 * 600;
    const counts = new Array<number>(78).fill(0);
    for (let i = 0; i < N; i++) counts[cryptoRandom.int(78)]! += 1;
    const expected = N / 78;
    const chi2 = counts.reduce((s, o) => s + (o - expected) ** 2 / expected, 0);
    expect(chi2, `χ² = ${chi2.toFixed(1)}`).toBeLessThan(124.8);
    expect(Math.min(...counts)).toBeGreaterThan(0);
  });

  it("取值范围非正时抛错，不静默返回 0", () => {
    expect(() => cryptoRandom.int(0)).toThrow();
    expect(() => cryptoRandom.int(-3)).toThrow();
  });
});

describe("牌阵与抽牌", () => {
  it("三个牌阵齐全，位置数各如其名，每位都带一个问题", () => {
    expect(SPREADS.map((s) => s.positions.length)).toEqual([1, 3, 10]);
    for (const s of SPREADS) {
      for (const p of s.positions) {
        expect(p.question.length, `${s.id}.${p.name}`).toBeGreaterThan(4);
      }
      expect(new Set(s.positions.map((p) => p.index)).size).toBe(s.positions.length);
    }
    expect(spreadById("celtic")!.positions).toHaveLength(10);
    expect(spreadById("没这个")).toBeUndefined();
  });

  it("抽出的牌两两不同 —— 不放回", () => {
    for (let i = 0; i < 50; i++) {
      const r = drawSpread({ spreadId: "celtic" });
      expect(new Set(r.cards.map((c) => c.card.id)).size).toBe(10);
    }
  });

  it("**不给逆位时一张逆位都不出** —— 开关要真的关得掉", () => {
    for (let i = 0; i < 30; i++) {
      const r = drawSpread({ spreadId: "celtic", withReversals: false });
      expect(r.cards.every((c) => !c.reversed)).toBe(true);
    }
    // 反向对照：打开之后确实出得来
    let sawReversed = false;
    for (let i = 0; i < 30 && !sawReversed; i++) {
      sawReversed = drawSpread({ spreadId: "celtic", withReversals: true })
        .cards.some((c) => c.reversed);
    }
    expect(sawReversed, "打开逆位后 30 次抽牌里总该出现一张").toBe(true);
  });

  it("**重抽得到不同结果** —— 这是它的定义，不是漏洞", () => {
    const sig = () => drawSpread({ spreadId: "three" })
      .cards.map((c) => c.card.id).join("|");
    const seen = new Set(Array.from({ length: 40 }, sig));
    expect(seen.size, "40 次三张抽牌不该全同").toBeGreaterThan(30);
  });

  it("**状态数与 compare/statespace 同源** —— 不另算一遍", () => {
    const three = spreadById("three")!;
    expect(spreadStateSpace(three, true)).toBe(tarotDraws(3, true));
    expect(spreadStateSpace(three, false)).toBe(tarotDraws(3, false));
    expect(spreadStateSpace(three, true)).toBe(3_651_648);
    expect(spreadStateSpace(spreadById("one")!, false)).toBe(78);
  });

  it("流派随结果声明，不让读者猜用的是哪一系", () => {
    const r = drawSpread({ numbering: "rws", suitElement: "swordsFire", withReversals: true });
    expect(r.schools).toEqual({
      numbering: "rws", suitElement: "swordsFire", withReversals: true,
    });
    expect(r.randomSource).toBe("crypto.getRandomValues");
  });

  it("**花色元素随流派变，而且注明它是后加的注解**", () => {
    const rnd: RandomSource = { id: "fixed", int: () => 0 };
    const a = drawSpread({ spreadId: "celtic", suitElement: "goldenDawn", random: rnd });
    const b = drawSpread({ spreadId: "celtic", suitElement: "swordsFire", random: rnd });
    // 同一个随机源 → 同一批牌，只有元素那一栏可能不同
    expect(a.cards.map((c) => c.card.id)).toEqual(b.cards.map((c) => c.card.id));
    const minors = a.cards.filter((c) => c.card.arcana === "minor");
    if (minors.length > 0) {
      expect(a.notes.join()).toContain("金色黎明");
      expect(a.notes.join()).toContain("循环论证");
    }
  });

  it("**每次抽牌都说清三件事**：不可复算、无一事不二占、天文含量为零", () => {
    const n = drawSpread().notes.join("\n");
    expect(n).toContain("不可复算");
    expect(n).toContain("一事不二占");
    expect(n).toContain("不需要知道今天是哪天");
  });
});

describe("塔罗的诚实性约束", () => {
  it("**运行时字符串里不许有 Markdown 粗体** —— 界面上会渲染成星号", () => {
    const texts: string[] = [];
    for (const s of SPREADS) {
      texts.push(s.name, s.note, ...s.positions.flatMap((p) => [p.name, p.question]));
    }
    const r = drawSpread({ spreadId: "celtic", withReversals: true });
    texts.push(...r.notes, ...TAROT_PENDING_CALIBRATION);
    for (const t of texts) expect(t.includes("**"), t.slice(0, 40)).toBe(false);
  });

  it("**牌阵的位置问题过人话档守卫** —— 它们是对占问者说的，用「你」是对的", () => {
    // 技术档禁第二人称，人话档要用第二人称。牌阵的位置是问占问者的，
    // 故归人话档 —— 拿技术档去扫它，只会逼人把「你」删掉，
    // 而那会让问题读起来像在说别人的事。
    for (const s of SPREADS) {
      for (const p of s.positions) {
        expect(scanPlain(p.question, `tarot.${s.id}.${p.name}`), p.question).toEqual([]);
      }
    }
  });

  it("**系统自述的那几段两档都过** —— 它们不对任何人说话", () => {
    // notes 与待核对清单讲的是这套方法本身，不针对占问者，
    // 故两档都该干净。两档都扫是更强的断言。
    const r = drawSpread({ spreadId: "celtic", withReversals: true });
    const texts = [...r.notes, ...TAROT_PENDING_CALIBRATION,
      ...SPREADS.map((s) => s.note)];
    for (const t of texts) {
      expect(scanText(t, "tarot"), `技术档：${t.slice(0, 36)}`).toEqual([]);
      expect(scanPlain(t, "tarot"), `人话档：${t.slice(0, 36)}`).toEqual([]);
    }
  });

  it("**牌义确实没有收录** —— 缺口是真实的，不拿生成的话填上", () => {
    const D = deck();
    for (const c of D) {
      // Card 上只有身份字段，没有任何 meaning / keyword / upright / reversed 之类
      expect(Object.keys(c).sort()).toEqual(
        expect.arrayContaining(["id", "arcana", "name", "nameEn", "nameFr"].sort()));
      for (const k of Object.keys(c)) {
        expect(/mean|keyword|upright|interpret|断|义/.test(k), `${c.name}.${k}`).toBe(false);
      }
    }
    expect(TAROT_PENDING_CALIBRATION.join()).toContain("牌义不收录");
  });
});

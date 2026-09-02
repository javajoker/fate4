import { describe, expect, it } from "vitest";
import { castMomentOf } from "../src/liuyao/moment.js";
import { cast, type CoinThrow } from "../src/liuyao/cast.js";
import { dress } from "../src/liuyao/dress.js";
import {
  TOPICS, TOPIC_BY_ID, TOPIC_CATEGORIES, fourGodsOf, elementOfLiuqin,
} from "../src/liuyao/topics.js";
import { pickYongshen, TopicNeedsRelationError } from "../src/liuyao/yongshen.js";
import { strengthOf, dongInfluencesOn, YAO_BAND_ORDER } from "../src/liuyao/strength.js";
import { judge, OUTCOME_WORDS } from "../src/liuyao/judge.js";
import { liuqinOf, type Liuqin } from "../src/yijing/najia.js";
import { ELEMENTS } from "../src/types/ganzhi.js";
import { generatedBy, controlledBy } from "../src/ganzhi/algebra.js";
import { DEFAULT_PARAMS } from "../src/params/defaults.js";
import { loadParams } from "../src/params/load.js";

const P = DEFAULT_PARAMS.liuyao;
const COIN = loadParams({ liuyao: { castMethod: "coin" } }).liuyao;
const at = (y: number, mo: number, d: number, h: number) => castMomentOf({
  year: y, month: mo, day: d, hour: h, minute: 30,
  timeZone: "Asia/Shanghai", longitude: 121.47,
});
const M = at(2026, 9, 2, 14);
const G = dress(cast(M, { method: "time" }, P), P);
const LIUQIN: readonly Liuqin[] = ["父母", "兄弟", "子孙", "妻财", "官鬼"];

/**
 * 多个时刻 —— 覆盖类断言必须跨时刻。
 *
 * 初稿只用一个时刻，于是「平」档与「冲散」从未出现，看起来像实现漏了。
 * 其实是那张盘月建申、日辰卯：土爻恒被卯克，故永远落不到「平」；
 * 酉爻在申月恒旺，故逢冲永远是暗动而非冲散。
 * **单一时刻的覆盖率断言会把时刻的性质错当成代码的性质。**
 */
const MOMENTS = [
  at(2026, 9, 2, 14),   // 丙申月 己卯日
  at(2026, 3, 15, 10),  // 春月
  at(2026, 6, 20, 22),  // 夏月，夜时
  at(2025, 12, 5, 8),   // 冬月
  at(2024, 11, 8, 4),   // 另一年
  at(2023, 5, 1, 18),
];

/** 遍历若干时刻 × 掷钱组合。`stride` 用来给重的断言减量。 */
function* allGua(stride = 1, moments: readonly ReturnType<typeof at>[] = MOMENTS) {
  for (const m of moments) {
    for (let n = 0; n < 4096; n += stride) {
      const t = Array.from({ length: 6 }, (_, i) => ((n >> (i * 2)) & 3) as CoinThrow);
      yield dress(cast(m, { method: "coin", throws: t as never }, COIN), COIN);
    }
  }
}

describe("**四神由生克推出，不转录**", () => {
  it("原神生用神、忌神克用神、仇神生忌神 —— 逐条验方向", () => {
    for (const palace of ELEMENTS) {
      for (const yong of LIUQIN) {
        const g = fourGodsOf(yong, palace);
        const ey = elementOfLiuqin(palace, g.yong);
        expect(elementOfLiuqin(palace, g.yuan), `${palace}宫 ${yong} 的原神`)
          .toBe(generatedBy(ey));
        expect(elementOfLiuqin(palace, g.ji), `${palace}宫 ${yong} 的忌神`)
          .toBe(controlledBy(ey));
        expect(elementOfLiuqin(palace, g.chou), `${palace}宫 ${yong} 的仇神`)
          .toBe(generatedBy(controlledBy(ey)));
      }
    }
  });

  it("**六亲之间的关系与选哪个宫无关** —— 五个宫给出同一张旋转表", () => {
    const ref = LIUQIN.map((q) => fourGodsOf(q, "金"));
    for (const palace of ELEMENTS) {
      expect(LIUQIN.map((q) => fourGodsOf(q, palace)), `${palace}宫`).toEqual(ref);
    }
  });

  it("与典籍的旋转表逐行相符", () => {
    expect(fourGodsOf("妻财")).toEqual({ yong: "妻财", yuan: "子孙", ji: "兄弟", chou: "父母" });
    expect(fourGodsOf("官鬼")).toEqual({ yong: "官鬼", yuan: "妻财", ji: "子孙", chou: "兄弟" });
    expect(fourGodsOf("父母")).toEqual({ yong: "父母", yuan: "官鬼", ji: "妻财", chou: "子孙" });
    expect(fourGodsOf("子孙")).toEqual({ yong: "子孙", yuan: "兄弟", ji: "父母", chou: "官鬼" });
    expect(fourGodsOf("兄弟")).toEqual({ yong: "兄弟", yuan: "父母", ji: "官鬼", chou: "妻财" });
  });

  it("四神互不相同，恰好占五位中的四位", () => {
    for (const q of LIUQIN) {
      const g = fourGodsOf(q);
      expect(new Set([g.yong, g.yuan, g.ji, g.chou]).size).toBe(4);
    }
  });

  it("六亲的五行换算与 liuqinOf 互逆", () => {
    for (const palace of ELEMENTS) {
      for (const q of LIUQIN) {
        expect(liuqinOf(palace, elementOfLiuqin(palace, q))).toBe(q);
      }
    }
  });
});

describe("占事分类", () => {
  it("32 类，id 唯一，大类齐全", () => {
    expect(TOPICS).toHaveLength(32);
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(32);
    expect(new Set(TOPICS.map((t) => t.category))).toEqual(new Set(TOPIC_CATEGORIES));
  });

  it("**32 类全部可断，一类不落**", () => {
    for (const t of TOPICS) {
      const ys = pickYongshen(G, t.id, "父母");
      expect(() => judge(G, ys.value, P), t.id).not.toThrow();
    }
  });

  it("用神随人而定的占事，不给六亲即抛错，不悄悄挑一个", () => {
    const caller = TOPICS.filter((t) => t.use.kind === "caller");
    expect(caller.length).toBeGreaterThan(0);
    for (const t of caller) {
      expect(() => pickYongshen(G, t.id)).toThrow(TopicNeedsRelationError);
      expect(() => pickYongshen(G, t.id, "子孙")).not.toThrow();
    }
  });

  it("健康类标了受限，且只此一类", () => {
    expect(TOPICS.filter((t) => t.restricted === true).map((t) => t.id))
      .toEqual(["health.body"]);
    expect(TOPIC_BY_ID.get("health.body")!.category).toBe("健康");
  });

  it("未知占事抛错", () => {
    expect(() => pickYongshen(G, "no.such.topic")).toThrow();
  });
});

describe("Q2 用神", () => {
  it("独现即取，多现走阶梯，定不下来则两存", () => {
    let single = 0; let multi = 0; let tied = 0;
    for (const g of allGua()) {
      const v = pickYongshen(g, "wealth.seek");
      if (v.value.candidates.length === 1) single++;
      else if (v.value.candidates.length > 1) {
        multi++;
        if (v.alternatives.length > 0) tied++;
      }
    }
    expect(single, "从未出现独现").toBeGreaterThan(100);
    expect(multi, "从未出现多现 —— 那取舍阶梯没被验到").toBeGreaterThan(100);
    expect(tied, "多现却从不并列 —— 阶梯把一切都判死了，可疑").toBeGreaterThan(0);
  });

  it("**多现两存时，替代解读确实指向另一个爻**", () => {
    for (const g of allGua()) {
      const v = pickYongshen(g, "wealth.seek");
      for (const a of v.alternatives) {
        expect(a.value.yao).not.toBeNull();
        expect(a.value.yao!.pos).not.toBe(v.value.yao!.pos);
        expect(a.value.candidates).toEqual(v.value.candidates);
        expect(a.reason.length).toBeGreaterThan(8);
      }
      if (v.alternatives.length > 0) {
        expect(v.confidence, "两存时置信度该低于独现").toBeLessThan(0.75);
      }
    }
  });

  it("**用神不上卦必取伏神，且置信度低于出现者**", () => {
    let fu = 0;
    for (const g of allGua()) {
      const v = pickYongshen(g, "wealth.seek");
      if (v.value.yao !== null) continue;
      fu++;
      expect(v.value.fu, `${g.ben.name} 用神不上卦却无伏神`).not.toBeNull();
      expect(v.value.fu!.liuqin).toBe("妻财");
      expect(v.confidence).toBeLessThanOrEqual(0.55);
    }
    expect(fu, "四千余卦里一次伏藏都没有 —— 不可能").toBeGreaterThan(50);
  });

  it("世应类占事没有六亲用神，也没有原忌", () => {
    const v = pickYongshen(G, "self.fortune");
    expect(v.value.gods).toBeNull();
    expect(v.value.yao!.pos).toBe(G.shi);
    expect(pickYongshen(G, "other.counterparty").value.yao!.pos).toBe(G.ying);
  });
});

describe("Q3 力量", () => {
  it("五档穷尽，且四千余卦里五档都出得来", () => {
    const seen = new Set<string>();
    for (const g of allGua()) {
      for (const y of g.yaos) seen.add(strengthOf(g, y, COIN).value.band);
    }
    expect(seen).toEqual(new Set(YAO_BAND_ORDER));
  });

  it("**每一档都能回溯到阶梯的某一级** —— 结论不许没有出处", () => {
    for (const g of allGua(8)) {
      for (const y of g.yaos) {
        const s = strengthOf(g, y, COIN);
        expect(s.value.rung.length).toBeGreaterThan(0);
        expect(s.derivation.some((d) => d.step === "判档")).toBe(true);
        expect(s.derivation.some((d) => d.step === "月建")).toBe(true);
      }
    }
  });

  it("**空破状态恒记入推导，不论是否已解**", () => {
    let solved = 0;
    for (const g of allGua()) {
      for (const y of g.yaos) {
        if (!y.xunkong && !y.yuepo) continue;
        const s = strengthOf(g, y, COIN);
        const kong = s.derivation.find((d) => d.step === "空破");
        expect(kong, `第${y.pos}爻空破却未记入推导`).toBeDefined();
        if (y.xunkongNullified !== null) {
          expect(kong!.detail).toContain(y.xunkongNullified);
          solved++;
        }
      }
    }
    // 初稿只在「未解」时才记，于是「用神旬空但冲空则实」在推导链里一个字都没有
    expect(solved, "从未出现「已解」的空 —— 那这条断言没验到东西").toBeGreaterThan(50);
  });

  it("**暗动之爻能生克他爻，冲散之爻不能** —— 静爻里的例外", () => {
    let an = 0; let san = 0;
    for (const g of allGua()) {
      for (const y of g.yaos) {
        if (y.chongState === "暗动") {
          an++;
          expect(y.moving, "暗动之爻在卦面上仍是静的").toBe(false);
          expect(["旺", "相"]).toContain(y.monthPhase);
          // 它应当出现在他爻的 fromDong 里
          const other = g.yaos.find((x) => x.pos !== y.pos)!;
          const infl = dongInfluencesOn(g, other);
          const listed = infl.some((d) => d.from.pos === y.pos);
          const hasRel = y.element === other.element
            || generatedBy(other.element) === y.element
            || controlledBy(other.element) === y.element;
          expect(listed, `暗动的第${y.pos}爻未计入对第${other.pos}爻的作用`).toBe(hasRel);
        }
        if (y.chongState === "冲散") {
          san++;
          expect(["休", "囚", "死"]).toContain(y.monthPhase);
        }
      }
    }
    expect(an, "四千余卦里一个暗动都没有").toBeGreaterThan(100);
    expect(san, "四千余卦里一个冲散都没有").toBeGreaterThan(100);
  });

  it("静而无冲之爻不作用于他爻", () => {
    for (const g of allGua(4)) {
      for (const y of g.yaos) {
        for (const d of dongInfluencesOn(g, y)) {
          expect(d.from.moving || d.from.chongState === "暗动",
            `第${d.from.pos}爻既不动也非暗动，却在作用他爻`).toBe(true);
        }
      }
    }
  });
});

describe("**Q4 断论只出结构，不出结果**", () => {
  it("断论层的每一条都不含成败、吉凶、时点的字眼", () => {
    for (const g of allGua(16)) {
      for (const id of ["wealth.seek", "career.job", "health.body", "self.fortune"]) {
        const j = judge(g, pickYongshen(g, id).value, COIN);
        const text = j.findings.map(
          (f) => f.value + f.derivation.map((d) => d.step + d.detail).join("")).join("");
        for (const w of OUTCOME_WORDS) {
          expect(text.includes(w), `断论出现了成败字眼「${w}」：${g.ben.name} / ${id}`).toBe(false);
        }
        // 也不得出现具体日期
        expect(text).not.toMatch(/\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/);
      }
    }
  });

  it("六个方面齐全，用神伏藏时仍出力量一条", () => {
    for (const g of allGua(8)) {
      const ys = pickYongshen(g, "wealth.seek");
      const j = judge(g, ys.value, COIN);
      const aspects = new Set(j.findings.map((f) => f.aspect));
      expect(aspects.has("用神力量"), g.ben.name).toBe(true);
      expect(aspects.has("世应关系")).toBe(true);
      expect(aspects.has("卦象总体")).toBe(true);
      if (ys.value.yao === null) {
        expect(j.strength, "伏藏时不该有爻力").toBeNull();
        expect(aspects.has("用神动静"), "伏神不入动静之论").toBe(false);
      } else {
        expect(j.strength).not.toBeNull();
      }
    }
  });

  it("每条断论都带推导，置信度在合理区间", () => {
    for (const g of allGua(8)) {
      for (const f of judge(g, pickYongshen(g, "career.job").value, COIN).findings) {
        expect(f.derivation.length, f.aspect).toBeGreaterThan(0);
        expect(f.confidence).toBeGreaterThan(0.2);
        expect(f.confidence).toBeLessThanOrEqual(1);
      }
    }
  });

  it("反吟伏吟之卦，置信度确实被压低", () => {
    let checked = 0;
    for (const g of allGua()) {
      if (!g.flags.includes("反吟") && !g.flags.includes("伏吟")) continue;
      const y = g.yaos.find((x) => x.moving);
      if (y === undefined) continue;
      expect(strengthOf(g, y, COIN).confidence).toBeLessThan(0.75);
      checked++;
    }
    expect(checked, "一个反吟伏吟卦都没遇到").toBeGreaterThan(10);
  });
});

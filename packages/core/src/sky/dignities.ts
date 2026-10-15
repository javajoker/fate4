/**
 * 古典（希腊化）占星的必然尊贵 —— 庙、旺、三分、界、面，及其相反。
 *
 * ## 为什么做古典而不做现代
 *
 * 现代占星的解读是自由撰写的：同一个「火星在天蝎」，十本书十种说法，
 * 而且多半是心理学语汇。那一层无法进本项目的 `Verdict` ——
 * 不是因为它不好，是因为它**没有可判定的规则**，而这台引擎的全部做法
 * 是「每一条结论都指得回一条规则与一组输入」。
 *
 * 古典占星恰好相反：庙旺三分界面是**查表**，分数是**定值**，
 * 昼夜盘是**定义**，相位是**角距的整除关系**。整套是确定性的符号运算，
 * 与四柱的十神、神煞同构。于是它接得进来，而现代那一层接不进来。
 *
 * 另一个理由更实际：本项目的措辞守卫扫的是**断言的形状**。
 * 古典规则产出的是结构（「这颗星在它自己的庙」），现代解读产出的是
 * 人格判断与事件预告 —— 后者会被守卫挡住，而那不是守卫太严，
 * 是它本来就不该从一台排盘引擎里出来。
 *
 * ## ⚠️ 这几张表尚未核对
 *
 * 界（bounds）的 60 个条目、三分主星、面主星，均为**凭记忆转录**，
 * 未经实体书逐条核对。这与《穷通宝鉴》120 格调候表是同一类数据风险
 * （见 `docs/11-validation.md`），故一并列入 `PENDING_CALIBRATION`。
 *
 * 结构性检查能挡住一部分错误（界在每宫必须累加到 30°、五段的主星互不重复、
 * 庙与陷互为对宫、旺与落互为对宫），但**挡不住同构的张冠李戴** ——
 * 比如把白羊的界主星顺序记成金星在木星前。那种错误只有拿书逐条比才看得出。
 *
 * 界另有多家（埃及界、托勒密界、迦勒底界），本表取**埃及界**，
 * 因为希腊化时期的文献多用它。这是流派选择，不是正误。
 */

import { norm360 } from "../astro/angles.js";
import { signIndexOf, degreeInSign } from "./angles.js";

/** 古典七曜。天王星以外不入古典占星 —— 它们是十八世纪以后的事。 */
export type ClassicalBody =
  | "sun" | "moon" | "mercury" | "venus" | "mars" | "jupiter" | "saturn";

export const CLASSICAL_BODIES: readonly ClassicalBody[] = Object.freeze([
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
]);

export const BODY_NAME: Readonly<Record<ClassicalBody, string>> = Object.freeze({
  sun: "太阳", moon: "月亮", mercury: "水星", venus: "金星",
  mars: "火星", jupiter: "木星", saturn: "土星",
});

/**
 * 庙（domicile）—— 每宫的主星。
 *
 * 次序即黄道十二宫自白羊起。日月各主一宫（狮子、巨蟹），
 * 其余五星各主两宫，恰好 2 + 5×2 = 12，一个不多一个不少。
 * 这个配置本身是对称的：自狮子/巨蟹向两侧依次排水金火木土。
 * 由测试断言那个对称性 —— 它比逐条记忆更难记错。
 */
export const DOMICILE: readonly ClassicalBody[] = Object.freeze([
  "mars",     // 白羊
  "venus",    // 金牛
  "mercury",  // 双子
  "moon",     // 巨蟹
  "sun",      // 狮子
  "mercury",  // 处女
  "venus",    // 天秤
  "mars",     // 天蝎
  "jupiter",  // 人马
  "saturn",   // 摩羯
  "saturn",   // 宝瓶
  "jupiter",  // 双鱼
]);

/** 旺（exaltation）—— 星：宫序与其旺度。 */
export const EXALTATION: Readonly<Record<ClassicalBody, {
  readonly sign: number; readonly degree: number;
}>> = Object.freeze({
  sun: { sign: 0, degree: 19 },       // 白羊 19°
  moon: { sign: 1, degree: 3 },       // 金牛 3°
  mercury: { sign: 5, degree: 15 },   // 处女 15°
  venus: { sign: 11, degree: 27 },    // 双鱼 27°
  mars: { sign: 9, degree: 28 },      // 摩羯 28°
  jupiter: { sign: 3, degree: 15 },   // 巨蟹 15°
  saturn: { sign: 6, degree: 21 },    // 天秤 21°
});

/**
 * 三分主星（Dorothean）—— 每个元素三组：昼主、夜主、共主。
 *
 * 索引即元素：0 火（白羊狮子人马）、1 土、2 风、3 水。
 */
export const TRIPLICITY: readonly {
  readonly day: ClassicalBody; readonly night: ClassicalBody;
  readonly participating: ClassicalBody;
}[] = Object.freeze([
  { day: "sun", night: "jupiter", participating: "saturn" },     // 火
  { day: "venus", night: "moon", participating: "mars" },        // 土
  { day: "saturn", night: "mercury", participating: "jupiter" }, // 风
  { day: "venus", night: "mars", participating: "moon" },        // 水
]);

/** 宫序 → 元素序（火土风水循环）。白羊火、金牛土、双子风、巨蟹水，而后重复。 */
export const elementOfSign = (signIndex: number): number => signIndex % 4;

/**
 * 埃及界 —— 每宫五段，给出[主星, 该段终止度]。
 *
 * 每宫五段的终止度必须恰好以 30 收尾，且五段主星互不重复。
 * 两条都由测试断言 —— 它们挡得住漏抄与重复，挡不住顺序记反。
 */
export const EGYPTIAN_BOUNDS: readonly (readonly (readonly [ClassicalBody, number])[])[] =
  Object.freeze([
    [["jupiter", 6], ["venus", 12], ["mercury", 20], ["mars", 25], ["saturn", 30]],     // 白羊
    [["venus", 8], ["mercury", 14], ["jupiter", 22], ["saturn", 27], ["mars", 30]],     // 金牛
    [["mercury", 6], ["jupiter", 12], ["venus", 17], ["mars", 24], ["saturn", 30]],     // 双子
    [["mars", 7], ["venus", 13], ["mercury", 19], ["jupiter", 26], ["saturn", 30]],     // 巨蟹
    [["jupiter", 6], ["venus", 11], ["saturn", 18], ["mercury", 24], ["mars", 30]],     // 狮子
    [["mercury", 7], ["venus", 17], ["jupiter", 21], ["mars", 28], ["saturn", 30]],     // 处女
    [["saturn", 6], ["mercury", 14], ["jupiter", 21], ["venus", 28], ["mars", 30]],     // 天秤
    [["mars", 7], ["venus", 11], ["mercury", 19], ["jupiter", 24], ["saturn", 30]],     // 天蝎
    [["jupiter", 12], ["venus", 17], ["mercury", 21], ["saturn", 26], ["mars", 30]],    // 人马
    [["mercury", 7], ["jupiter", 14], ["venus", 22], ["saturn", 26], ["mars", 30]],     // 摩羯
    [["mercury", 7], ["venus", 13], ["jupiter", 20], ["mars", 25], ["saturn", 30]],     // 宝瓶
    [["venus", 12], ["jupiter", 16], ["mercury", 19], ["mars", 28], ["saturn", 30]],    // 双鱼
  ]);

/**
 * 面（decan / face）—— 每宫三段十度，主星按迦勒底序排下来。
 *
 * 迦勒底序是土木火日金水月，自白羊 0° 的火星起依次填满 36 个面，
 * 恰好循环整数次（36 = 7 × 5 + 1，故它不是简单的周期重复，
 * 而是连续填充）。故本表**由序列生成而非逐条转录** ——
 * 生成就不会抄错，而且规则本身比表更容易核对。
 */
const CHALDEAN: readonly ClassicalBody[] = Object.freeze([
  "saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon",
]);

export const faceRuler = (signIndex: number, decanIndex: number): ClassicalBody => {
  // 白羊第一面是火星，即迦勒底序的第 2 位（0 起）
  const n = signIndex * 3 + decanIndex;
  return CHALDEAN[(n + 2) % 7]!;
};

export type DignityKind =
  | "domicile" | "exaltation" | "triplicity" | "bound" | "face"
  | "detriment" | "fall" | "peregrine";

export interface DignityHit {
  readonly kind: DignityKind;
  /** 该项的传统计分。负数为不利。 */
  readonly score: number;
  /** 一句说明它凭什么成立 —— 与报告层的推导链同一用途。 */
  readonly why: string;
}

/**
 * 传统计分（Lilly 的那一套）。
 *
 * ⚠️ 这组分数**是约定，不是测量**。各家取值互有出入，且把五项不同性质的
 * 东西加成一个总分本身就是一种强假设。本模块给出总分，但报告层应当
 * 同时给出逐项命中 —— 总分掩盖「它靠什么得的分」，而那才是能讨论的部分。
 */
const SCORE: Readonly<Record<DignityKind, number>> = Object.freeze({
  domicile: 5, exaltation: 4, triplicity: 3, bound: 2, face: 1,
  detriment: -5, fall: -4, peregrine: -5,
});

/**
 * 一颗星在某黄经上的必然尊贵。
 *
 * @param isDay 昼盘与否 —— 三分主星取昼主还是夜主，全看这一项。
 *   它不是细节：换一个昼夜判定，三分那一项就换一颗星。
 */
export function dignitiesOf(
  body: ClassicalBody, longitude: number, isDay: boolean,
): readonly DignityHit[] {
  const sign = signIndexOf(longitude);
  const deg = degreeInSign(longitude);
  const hits: DignityHit[] = [];
  const signName = SIGN_LABEL[sign]!;

  if (DOMICILE[sign] === body) {
    hits.push({ kind: "domicile", score: SCORE.domicile, why: `${signName}为其庙` });
  }
  const ex = EXALTATION[body];
  if (ex.sign === sign) {
    hits.push({ kind: "exaltation", score: SCORE.exaltation,
      why: `${signName}为其旺（旺度 ${ex.degree}°）` });
  }
  const tri = TRIPLICITY[elementOfSign(sign)]!;
  if ((isDay ? tri.day : tri.night) === body) {
    hits.push({ kind: "triplicity", score: SCORE.triplicity,
      why: `${isDay ? "昼" : "夜"}盘，为该三分的${isDay ? "昼" : "夜"}主` });
  }
  for (const [ruler, end] of EGYPTIAN_BOUNDS[sign]!) {
    if (deg < end) {
      if (ruler === body) {
        hits.push({ kind: "bound", score: SCORE.bound, why: `落在其界内（至 ${end}°）` });
      }
      break;
    }
  }
  if (faceRuler(sign, Math.floor(deg / 10)) === body) {
    hits.push({ kind: "face", score: SCORE.face,
      why: `第 ${Math.floor(deg / 10) + 1} 面为其面` });
  }

  // 相反的两项由庙旺**推出**，不另立表 —— 另立表就有两份会不一致的真相
  if (DOMICILE[(sign + 6) % 12] === body) {
    hits.push({ kind: "detriment", score: SCORE.detriment,
      why: `${signName}为其庙的对宫，故为陷` });
  }
  if (ex.sign === (sign + 6) % 12) {
    hits.push({ kind: "fall", score: SCORE.fall,
      why: `${signName}为其旺的对宫，故为落` });
  }

  if (hits.length === 0) {
    hits.push({ kind: "peregrine", score: SCORE.peregrine,
      why: "五项必然尊贵一项不占，为外来（peregrine）" });
  }
  return hits;
}

const SIGN_LABEL: readonly string[] = Object.freeze([
  "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
  "天秤", "天蝎", "人马", "摩羯", "宝瓶", "双鱼",
]);

/** 逐项命中之和。**报告层不应只给这个数** —— 见 `SCORE` 的说明。 */
export const dignityScore = (hits: readonly DignityHit[]): number =>
  hits.reduce((s, h) => s + h.score, 0);

/**
 * 昼盘判定：太阳在地平之上即为昼。
 *
 * 用上升—下降轴而不是「日出到日落」的钟表时间：后者要先定义晨昏蒙影，
 * 而那又是一组没有公认答案的约定。几何地平是干净的。
 *
 * 边界情形（太阳正在上升点上）如实返回，不做特例 ——
 * 与节气落在节上、行星落在宫界上同一处理。
 */
export function isDayChart(sunLongitude: number, ascendant: number): boolean {
  // 太阳自上升点起逆时针 0–180° 为地平之下（周日视运动是顺时针）
  return norm360(sunLongitude - ascendant) > 180;
}

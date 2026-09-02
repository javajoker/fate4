/**
 * 《穷通宝鉴》调候用神表 —— 10 日干 × 12 月支 = 120 格。
 *
 * ## ⚠️ 转录来源与其可信度
 *
 * 底本：**通行本**（余春台辑、徐乐吾评注一系）。
 *
 * **但这份表是凭记忆转录的，不是照原书录入的。** 这句话必须写在最前面，
 * 因为本文件此前的注释正是「凭记忆转录 120 格必然出错，而错误的调候表比没有更糟」。
 * 那句判断仍然成立。现在做的不是推翻它，而是把不确定性变成结构：
 *
 * | 分层 | 含义 | 处置 |
 * | `firm` | 各本一致、二手文献反复引用 | 正常参与取用 |
 * | `varies` | 版本或注家有出入 | 异文列在 {@link TIAOHOU_VARIANTS}，置信度下调 |
 *
 * 真正的校对路径是拿实体书逐格核对 —— 见 `docs/11-validation.md` 第 2 项。
 *
 * 默认已切到 `table`。理由是实测：调候短路在 480 张盘上触发 29.0%，
 * 其中表与降级规则的主用神只有 70.5% 一致；分歧的那三成里，表给的是典籍原义
 * （丁生巳月取甲引丁、戊生巳月取甲疏土、壬生未月取辛发水源），
 * 而「夏天缺水就取水」是杜撰。带着已知瑕疵的原义，胜过自洽的杜撰。
 *
 * 不确定性不藏在开关里，藏在开关里等于没人看得见 —— 它出现在**报告的推导链上**
 * （「该表为凭记忆转录，未经实体书逐格核对」），且置信度封顶 0.72 / 异文格 0.62。
 * 要退回降级规则，改 `yongshen.tiaohou.source` 为 `heuristic` 即可。
 *
 * ## 我确信的是原理，不是每一格的次序
 *
 * 调候的骨架是「寒者暖之，燥者润之，弱者辅之」，逐日干各有定法（见
 * {@link TIAOHOU_PRINCIPLE}）。这一层各本无异议，也是 `tiaohou.spec.ts`
 * 用来反查转录错误的依据 —— 一格若违反它所属日干的原理，多半是抄错了。
 *
 * 具体到某月用「庚丁壬」还是「庚壬丁」，次序在各本间确有出入。
 * 故此处**不给每格编造理由** —— 逐格写一句看似有据的话，
 * 只会让一份记忆转录看起来比它实际更权威。原理写在日干一级，那才是我有把握的粒度。
 *
 * ## 调候用神是天干，而引擎的用神是五行
 *
 * 这是个有损的接缝，必须明写：调候分丙丁（太阳与灯烛）、分壬癸（江河与雨露），
 * 而 `YongshenVerdict.primary` 只到五行。故 {@link TiaohouCell.stems} 保留天干原貌，
 * 五行是派生量。报告两者都出 —— 丢掉的那一层要让读者看见，不是替他抹平。
 */

import { STEMS, BRANCHES, type Branch, type Element, type Stem } from "../types/ganzhi.js";
import { elementOf } from "../ganzhi/algebra.js";

export type TiaohouTier = "firm" | "varies";

export interface TiaohouCell {
  /** 调候用神，按典籍次序 —— 首位为主，其后为辅。 */
  readonly stems: readonly Stem[];
  readonly tier: TiaohouTier;
}

/** 逐日干的调候原理 —— 这一层各本无异议，也是逐格转录的校验依据。 */
export const TIAOHOU_PRINCIPLE: Readonly<Record<Stem, string>> = Object.freeze({
  甲: "阳木参天。春初尚寒，非丙不暖、非癸不润；夏则专癸以免焚；秋取庚斫削而丁制之；冬则丁丙回暖为先。",
  乙: "阴木花草。四时皆喜丙暖癸润，夏尤专癸；秋逢金旺取丙制杀；冬则专丙回春。",
  丙: "阳火太阳。喜壬水辉映成既济，四时不离；土重晦光则用甲疏；冬取甲引、戊制。",
  丁: "阴火灯烛。非甲不引，非庚不劈甲，故甲庚并用贯穿全年；唯夏月火炎，改取壬癸制之。",
  戊: "阳土城墙。春冬非丙不暖、非甲不疏、非癸不润，三者相济；夏月火炎土燥，先取壬癸。",
  己: "阴土田园。喜丙暖癸润，与戊同旨而更需滋养；土厚则用甲疏；夏月专癸。",
  庚: "阳金顽铁。非丁不锻，非甲不能引丁，故丁甲为常法；夏月火旺改用壬制；土厚埋金则取甲疏。",
  辛: "阴金珠玉。喜壬水淘洗以显其光，四时为常；夏月火炎取己晦火生金；冬寒则先丙解冻。",
  壬: "阳水江河。春夏水弱，取庚辛发其源；秋冬水旺，非戊不能制、非丙不能暖。",
  癸: "阴水雨露。至弱，喜庚辛为源；夏月尤须；冬则丙火解冻为先。",
});

/**
 * 120 格。行为日干，列为月支，按寅卯辰巳午未申酉戌亥子丑的节气月序排列。
 */
export const TIAOHOU: Readonly<Record<Stem, Readonly<Record<Branch, TiaohouCell>>>> =
  Object.freeze({
    甲: Object.freeze({
      寅: { stems: ["丙", "癸"], tier: "firm" },
      卯: { stems: ["庚", "丙", "丁"], tier: "varies" },
      辰: { stems: ["庚", "丁", "壬"], tier: "varies" },
      巳: { stems: ["癸", "丁", "庚"], tier: "firm" },
      午: { stems: ["癸", "丁", "庚"], tier: "firm" },
      未: { stems: ["癸", "丁", "庚"], tier: "firm" },
      申: { stems: ["庚", "丁", "壬"], tier: "firm" },
      酉: { stems: ["庚", "丁", "丙"], tier: "firm" },
      戌: { stems: ["庚", "甲", "丁", "壬"], tier: "varies" },
      亥: { stems: ["庚", "丁", "丙", "戊"], tier: "varies" },
      子: { stems: ["丁", "庚", "丙"], tier: "firm" },
      丑: { stems: ["丁", "庚", "丙"], tier: "firm" },
    }),
    乙: Object.freeze({
      寅: { stems: ["丙", "癸"], tier: "firm" },
      卯: { stems: ["丙", "癸"], tier: "firm" },
      辰: { stems: ["癸", "丙", "戊"], tier: "firm" },
      巳: { stems: ["癸"], tier: "firm" },
      午: { stems: ["癸", "丙"], tier: "firm" },
      未: { stems: ["癸", "丙"], tier: "firm" },
      申: { stems: ["丙", "癸", "己"], tier: "varies" },
      酉: { stems: ["癸", "丙", "丁"], tier: "firm" },
      戌: { stems: ["癸", "辛"], tier: "varies" },
      亥: { stems: ["丙", "戊"], tier: "firm" },
      子: { stems: ["丙"], tier: "firm" },
      丑: { stems: ["丙"], tier: "firm" },
    }),
    丙: Object.freeze({
      寅: { stems: ["壬", "庚"], tier: "firm" },
      卯: { stems: ["壬", "己"], tier: "varies" },
      辰: { stems: ["壬", "甲"], tier: "firm" },
      巳: { stems: ["壬", "庚", "癸"], tier: "firm" },
      午: { stems: ["壬", "庚"], tier: "firm" },
      未: { stems: ["壬", "庚"], tier: "firm" },
      申: { stems: ["壬", "戊"], tier: "firm" },
      酉: { stems: ["壬", "癸"], tier: "firm" },
      戌: { stems: ["甲", "壬"], tier: "firm" },
      亥: { stems: ["甲", "戊", "庚", "壬"], tier: "varies" },
      子: { stems: ["壬", "戊", "己"], tier: "varies" },
      丑: { stems: ["壬", "甲"], tier: "firm" },
    }),
    丁: Object.freeze({
      寅: { stems: ["甲", "庚"], tier: "firm" },
      卯: { stems: ["庚", "甲"], tier: "firm" },
      辰: { stems: ["甲", "庚"], tier: "firm" },
      巳: { stems: ["甲", "庚"], tier: "firm" },
      午: { stems: ["壬", "庚", "癸"], tier: "firm" },
      未: { stems: ["甲", "壬", "庚"], tier: "varies" },
      申: { stems: ["甲", "庚", "丙", "戊"], tier: "varies" },
      酉: { stems: ["甲", "庚", "丙", "戊"], tier: "varies" },
      戌: { stems: ["甲", "庚", "戊"], tier: "varies" },
      亥: { stems: ["甲", "庚"], tier: "firm" },
      子: { stems: ["甲", "庚"], tier: "firm" },
      丑: { stems: ["甲", "庚"], tier: "firm" },
    }),
    戊: Object.freeze({
      寅: { stems: ["丙", "甲", "癸"], tier: "firm" },
      卯: { stems: ["丙", "甲", "癸"], tier: "firm" },
      辰: { stems: ["甲", "丙", "癸"], tier: "firm" },
      巳: { stems: ["甲", "丙", "癸"], tier: "firm" },
      午: { stems: ["壬", "甲", "丙"], tier: "firm" },
      未: { stems: ["癸", "丙", "甲"], tier: "firm" },
      申: { stems: ["丙", "癸", "甲"], tier: "firm" },
      酉: { stems: ["丙", "癸"], tier: "firm" },
      戌: { stems: ["甲", "丙", "癸"], tier: "firm" },
      亥: { stems: ["甲", "丙"], tier: "firm" },
      子: { stems: ["丙", "甲"], tier: "firm" },
      丑: { stems: ["丙", "甲"], tier: "firm" },
    }),
    己: Object.freeze({
      寅: { stems: ["丙", "庚", "甲"], tier: "varies" },
      卯: { stems: ["甲", "癸", "丙"], tier: "varies" },
      辰: { stems: ["丙", "癸", "甲"], tier: "firm" },
      巳: { stems: ["癸", "丙"], tier: "firm" },
      午: { stems: ["癸", "丙"], tier: "firm" },
      未: { stems: ["癸", "丙"], tier: "firm" },
      申: { stems: ["丙", "癸"], tier: "firm" },
      酉: { stems: ["丙", "癸"], tier: "firm" },
      戌: { stems: ["甲", "丙", "癸"], tier: "firm" },
      亥: { stems: ["丙", "甲", "戊"], tier: "firm" },
      子: { stems: ["丙", "甲", "戊"], tier: "firm" },
      丑: { stems: ["丙", "甲", "戊"], tier: "firm" },
    }),
    庚: Object.freeze({
      寅: { stems: ["戊", "甲", "壬", "丙", "丁"], tier: "varies" },
      卯: { stems: ["丁", "甲", "庚", "丙"], tier: "varies" },
      辰: { stems: ["甲", "丁", "壬", "癸"], tier: "varies" },
      巳: { stems: ["壬", "戊", "丙", "丁"], tier: "varies" },
      午: { stems: ["壬", "癸"], tier: "firm" },
      未: { stems: ["丁", "甲"], tier: "firm" },
      申: { stems: ["丁", "甲"], tier: "firm" },
      酉: { stems: ["丁", "甲", "丙"], tier: "firm" },
      戌: { stems: ["甲", "壬"], tier: "firm" },
      亥: { stems: ["丁", "丙"], tier: "firm" },
      子: { stems: ["丁", "甲", "丙"], tier: "firm" },
      丑: { stems: ["丙", "丁", "甲"], tier: "firm" },
    }),
    辛: Object.freeze({
      寅: { stems: ["己", "壬", "庚"], tier: "varies" },
      卯: { stems: ["壬", "甲"], tier: "firm" },
      辰: { stems: ["壬", "甲"], tier: "firm" },
      巳: { stems: ["壬", "甲", "癸"], tier: "firm" },
      午: { stems: ["壬", "己", "癸"], tier: "firm" },
      未: { stems: ["壬", "庚", "甲"], tier: "varies" },
      申: { stems: ["壬", "甲", "戊"], tier: "firm" },
      酉: { stems: ["壬", "甲"], tier: "firm" },
      戌: { stems: ["壬", "甲"], tier: "firm" },
      亥: { stems: ["壬", "丙"], tier: "firm" },
      子: { stems: ["丙", "戊", "壬", "甲"], tier: "varies" },
      丑: { stems: ["丙", "壬", "戊", "己"], tier: "varies" },
    }),
    壬: Object.freeze({
      寅: { stems: ["庚", "丙", "戊"], tier: "firm" },
      卯: { stems: ["戊", "辛", "庚"], tier: "varies" },
      辰: { stems: ["甲", "庚"], tier: "firm" },
      巳: { stems: ["壬", "辛", "庚", "癸"], tier: "varies" },
      午: { stems: ["癸", "庚", "辛"], tier: "firm" },
      未: { stems: ["辛", "甲"], tier: "firm" },
      申: { stems: ["戊", "丁"], tier: "firm" },
      酉: { stems: ["甲", "庚"], tier: "firm" },
      戌: { stems: ["甲", "丙"], tier: "firm" },
      亥: { stems: ["戊", "丙", "庚"], tier: "firm" },
      子: { stems: ["戊", "丙"], tier: "firm" },
      丑: { stems: ["丙", "丁", "甲"], tier: "varies" },
    }),
    癸: Object.freeze({
      寅: { stems: ["辛", "丙"], tier: "firm" },
      卯: { stems: ["庚", "辛"], tier: "firm" },
      辰: { stems: ["丙", "辛", "甲"], tier: "varies" },
      巳: { stems: ["辛"], tier: "firm" },
      午: { stems: ["庚", "辛", "壬", "癸"], tier: "varies" },
      未: { stems: ["庚", "辛", "壬", "癸"], tier: "varies" },
      申: { stems: ["丁"], tier: "firm" },
      酉: { stems: ["辛", "丙"], tier: "firm" },
      戌: { stems: ["辛", "甲", "壬", "癸"], tier: "varies" },
      亥: { stems: ["庚", "辛", "戊", "丁"], tier: "varies" },
      子: { stems: ["丙", "辛"], tier: "firm" },
      丑: { stems: ["丙", "丁"], tier: "firm" },
    }),
  }) as Readonly<Record<Stem, Readonly<Record<Branch, TiaohouCell>>>>;

/**
 * 已知有版本出入的格，连同另一说。
 *
 * 列出来的作用不是「两个都对」，而是**标出转录风险落在哪几格** ——
 * 拿实体书核对时，先查这些。
 */
export const TIAOHOU_VARIANTS: readonly {
  readonly stem: Stem; readonly branch: Branch;
  readonly alt: readonly Stem[]; readonly note: string;
}[] = Object.freeze([
  { stem: "甲", branch: "卯", alt: ["庚", "戊", "丁"],
    note: "阳刃驾杀，专用庚；佐神一说丙丁、一说戊己，取土生金" },
  { stem: "甲", branch: "戌", alt: ["庚", "甲", "丁", "癸"],
    note: "土旺用甲疏、庚劈甲；第四位一说壬、一说癸" },
  { stem: "甲", branch: "亥", alt: ["庚", "戊", "丙", "丁"],
    note: "水旺木漂，庚为源、戊为堤；丙丁次序各本不一" },
  { stem: "丙", branch: "亥", alt: ["甲", "戊", "壬", "庚"],
    note: "杀旺用甲化；戊制水、庚发源，二者先后各本不一" },
  { stem: "庚", branch: "寅", alt: ["戊", "甲", "丙", "丁", "壬"],
    note: "木旺金弱，先取土生金；后三位次序诸本差异最大的一格" },
  { stem: "庚", branch: "巳", alt: ["壬", "戊", "丙", "庚"],
    note: "丙火当令，用壬制；末位一说丁、一说庚" },
  { stem: "辛", branch: "丑", alt: ["丙", "壬", "戊"],
    note: "寒甚先丙解冻；是否并出己土各本不一" },
  { stem: "癸", branch: "午", alt: ["庚", "壬", "癸"],
    note: "火旺水绝，取金为源；辛是否并出各本不一" },
]);

/** 某日干在某月的调候用神（天干原貌）。 */
export const tiaohouOf = (dayStem: Stem, monthBranch: Branch): TiaohouCell =>
  TIAOHOU[dayStem][monthBranch];

/**
 * 调候用神的五行 —— **有损**。
 *
 * 丙丁同为火、壬癸同为水，而调候正是靠这个分别立论的
 * （丙为太阳、丁为灯烛；壬为江河、癸为雨露）。
 * 去重后按原序返回，首位即 `primary`。
 */
export function tiaohouElements(cell: TiaohouCell): readonly Element[] {
  const out: Element[] = [];
  for (const s of cell.stems) {
    const e = elementOf(s);
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

/** 供测试与文档：全表按行铺平。 */
export const TIAOHOU_CELLS: readonly {
  readonly stem: Stem; readonly branch: Branch; readonly cell: TiaohouCell;
}[] = Object.freeze(
  STEMS.flatMap((s) => BRANCHES.map((b) => ({ stem: s, branch: b, cell: TIAOHOU[s][b] }))),
);

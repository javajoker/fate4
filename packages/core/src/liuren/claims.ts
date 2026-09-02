/**
 * 六壬 → 跨体系结构断言。
 *
 * 只翻译**六壬说得上话的那几条轴**，说不上的一条不编。
 * 六壬有它自己的语汇（课体、三传、天将），硬要每条轴都填满，
 * 得到的是凑数的断言 —— 而 crossref 层会把凑数的断言当成真的表态。
 *
 * | 轴 | 六壬的依据 |
 * | 我方位置 | 日干上神（第一课上神）与日干的生克 |
 * | 阻碍来源 | 初传与日干的生克；乘凶将者另记 |
 * | 事之动静 | 课体 —— 伏吟主停滞、返吟主反覆、六冲之类主变动 |
 *
 * **时间窗与方位不出。** 六壬的应期取法（三传所值、天将所临）与六爻的取候之法
 * 不是同一套词汇，硬对齐会造出「两个体系在同一轴上表态」的假象。
 */

import type { StructuralClaim } from "../divination/claim.js";
import { branchElement, controls, generates } from "../ganzhi/algebra.js";
import { JIGONG } from "./tables.js";
import { tianjiangOfSky, type LiurenPlate } from "./plate.js";
import { KE_TI_NOTE, type Sanchuan } from "./sanchuan.js";

/** 传统视为凶将者 —— 只作事象修饰，不参与生克，与六爻的六神同构。 */
const XIONG_JIANG = new Set(["螣蛇", "勾陈", "白虎", "玄武", "天空"]);

export function liurenClaims(p: LiurenPlate, s: Sanchuan): StructuralClaim[] {
  const jigong = JIGONG[p.pillars.day.stem];
  const dayEl = branchElement(jigong);
  const ganUpper = p.ke[0].upper;
  const upEl = branchElement(ganUpper);
  const upJiang = tianjiangOfSky(p, ganUpper);

  // ── 我方位置：日干上神与日干的生克 ──
  const supported = generates(upEl, dayEl) || upEl === dayEl;
  const attacked = controls(upEl, dayEl);
  const claims: StructuralClaim[] = [{
    system: "liuren", axis: "我方位置",
    polarity: supported ? "顺" : attacked ? "逆" : "中性",
    evidence: `日干${p.pillars.day.stem}寄宫${jigong}，其上神为${ganUpper}（${upEl}），`
      + `乘${upJiang}；日干属${dayEl}，`
      + (supported ? "上神生扶之" : attacked ? "上神克之" : "上神与日干无生克"),
    confidence: 0.75,
  }];

  // ── 阻碍来源：初传与日干的生克 ──
  const chuEl = branchElement(s.chu);
  const chuJiang = tianjiangOfSky(p, s.chu);
  const chuAttacks = controls(chuEl, dayEl);
  claims.push({
    system: "liuren", axis: "阻碍来源",
    polarity: chuAttacks ? "逆" : "中性",
    evidence: `初传${s.chu}（${chuEl}）乘${chuJiang}，`
      + (chuAttacks ? "克日干" : "不克日干")
      + (XIONG_JIANG.has(chuJiang) ? "；所乘之将传统列为凶将" : ""),
    // 别责、八专、伏吟的取法各家不一，置信度随之下调
    confidence: s.disputed ? 0.5 : 0.7,
  });

  // ── 事之动静：课体 ──
  claims.push({
    system: "liuren", axis: "事之动静",
    polarity: "中性",
    evidence: `${s.keti}课，三传 ${s.chu} → ${s.zhong} → ${s.mo}。${KE_TI_NOTE[s.keti]}`,
    confidence: s.disputed ? 0.55 : 0.8,
  });

  return claims;
}

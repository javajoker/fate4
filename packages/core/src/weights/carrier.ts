/**
 * 载体 —— 整套权重模型的唯一计算单位。
 *
 * 关键简化：**一切最终归约为天干**。
 * 天干直接是载体；地支不是载体，是载体的容器 —— 它把自己的分数
 * 按藏干比例下发给所含天干。于是命盘的力量状态就是一个 10 维向量，
 * 五行、阴阳、十神都只是同一份数据的不同投影，
 * 生克传导也只需定义「天干 × 天干」一套作用核。
 */

import type { Branch, Element, HiddenRole, Polarity, Stem } from "../types/ganzhi.js";

export type PillarKind = "year" | "month" | "day" | "hour" | "luck" | "annual" | "taiyuan";
export type Layer = "stem" | "branch";

export interface Position {
  readonly pillar: PillarKind;
  readonly layer: Layer;
  /** 藏干序号，0 = 本气。天干层为 null。 */
  readonly hiddenIndex: number | null;
}

export type CarrierFlag =
  | "DAY_MASTER"    // 日主本身
  | "SILING"        // 当权的月令藏干
  | "REVEALED"      // 该藏干在盘中有同字天干透出
  | "KONGWANG"      // 落旬空，待 L2 结算是否填实
  | "BOUND"         // 合绊（L2）
  | "TRANSFORMED"   // 合化成功（L2）
  | "CONTESTED"     // 争合妒合（L2）
  | "TOMB_SEALED"   // 闭库中的中气/余气（L2）
  | "TOMB_OPENED";  // 库已冲开（L2）

export interface TraceEntry {
  readonly layer: "L1" | "L2" | "L3";
  readonly round?: number;
  /** 规则标识，如 "L1.hiddenSplit"、"L2.chong.branch"。 */
  readonly rule: string;
  readonly from: number;
  readonly to: number;
  /** 触发方的载体 id。 */
  readonly cause: readonly string[];
  /** 本次实际用到的参数值 —— 让每一步都能被复算。 */
  readonly params: Readonly<Record<string, number>>;
  readonly note?: string;
}

export interface Carrier {
  /** 稳定标识，如 "month.branch.0"。同一盘内唯一。 */
  readonly id: string;
  readonly stem: Stem;
  readonly element: Element;
  readonly polarity: Polarity;
  readonly origin: "revealed" | "hidden";
  readonly position: Position;
  /** 藏干的宿主支；天干层为 null。 */
  readonly hostBranch: Branch | null;
  readonly role: HiddenRole | null;
  weight: number;
  /** 施加生克的能力系数，与自身权重独立。被合绊者仍在场，但施力打折。 */
  activity: number;
  flags: CarrierFlag[];
  trace: TraceEntry[];
}

export function carrierId(pos: Position): string {
  return pos.hiddenIndex === null
    ? `${pos.pillar}.${pos.layer}`
    : `${pos.pillar}.${pos.layer}.${pos.hiddenIndex}`;
}

export function addTrace(c: Carrier, entry: Omit<TraceEntry, "from" | "to">, to: number): void {
  c.trace.push({ ...entry, from: c.weight, to });
  c.weight = to;
}

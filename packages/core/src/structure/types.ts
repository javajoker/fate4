/** L2 结构层的事件与中间表示。 */

import type { Branch, Element, Stem } from "../types/ganzhi.js";
import type { Carrier, PillarKind } from "../weights/carrier.js";

export type StructureKind =
  | "sanhui" | "sanhe" | "banhe" | "gong" | "liuhe" | "ganhe"
  | "chong" | "ganchong" | "xing" | "hai" | "po" | "tombOpen" | "tombSealed";

export type Outcome =
  | "transformed"   // 合化成功，五行转为化神
  | "bound"         // 合而不化，活性打折
  | "contested"     // 争合妒合
  | "neutralized"   // 被裁决为不成立（合解冲，或冲被合解）
  | "broken"        // 合被冲破，降级为 bound
  | "applied"       // 直接生效（冲刑害破、局的增减）
  | "partial";      // 三刑只见两支等

/** 场上的一个地支位置。同一支可出现在多柱，故以位置而非支值标识。 */
export interface BranchSlot {
  readonly pillar: PillarKind;
  readonly branch: Branch;
  /** 该支下辖的藏干载体。 */
  readonly carriers: readonly Carrier[];
  /** 该支的当前总权重。 */
  readonly weight: number;
}

export interface StemSlot {
  readonly pillar: PillarKind;
  readonly stem: Stem;
  readonly carrier: Carrier;
}

export interface StructureEvent {
  readonly kind: StructureKind;
  readonly outcome: Outcome;
  /** 参与的载体 id。 */
  readonly participants: readonly string[];
  /** 参与的柱。 */
  readonly pillars: readonly PillarKind[];
  readonly branches?: readonly Branch[];
  readonly stems?: readonly Stem[];
  readonly transformedTo?: Element;
  /** 互解裁决的依据 —— 有争议时必须留下，否则无法回答「为什么不化」。 */
  readonly strengthScores?: { readonly he: number; readonly chong: number };
  readonly distanceCoef: number;
  /** 逐载体的权重变化量，供审计。 */
  readonly weightDelta: Readonly<Record<string, number>>;
  /** 逐载体的活性变化量。 */
  readonly activityDelta?: Readonly<Record<string, number>>;
  readonly narrativeTag: string;
  readonly note?: string;
}

export interface StructureResult {
  readonly carriers: readonly Carrier[];
  readonly events: readonly StructureEvent[];
}

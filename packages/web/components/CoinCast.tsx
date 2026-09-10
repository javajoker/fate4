"use client";

import { useState } from "react";
import type { CoinThrow } from "@fate/core";

/**
 * 掷钱起卦的交互 —— 六次，每次三枚。
 *
 * ## 为什么不只给一个输入框
 *
 * 原先这里要用户填 `121212` 六位数字，每位是那一掷的阳面数。它能用，
 * 但把一件**有次序、有仪式**的事压成了一串码：掷钱法的六次是自初爻向上
 * 逐爻积起来的，动爻可以有 0 到 6 个 —— 这两件事在一个输入框里都看不见。
 *
 * ## 两条路都留着，因为它们是两件事
 *
 * | | 谁在掷 | 用在什么时候 |
 * | **自己掷** | 用户手里的真铜钱 | 他真的在掷；应用只负责记 |
 * | **替我掷** | `crypto.getRandomValues` | 手边没有铜钱 |
 *
 * 只留后者等于把「应机」偷偷换成了伪随机数；只留前者等于逼没有铜钱的人
 * 自己编六个数。故两条都留，并在界面上写明第二条是机器掷的 ——
 * **不含糊过去**。这与本项目对按时起卦「同一时辰同一卦」的处理是同一条纪律：
 * 方法的前提写在明处，不伪装。
 *
 * ## 阳面是哪一面，各家不一
 *
 * 内核只认「三枚里的阳面数」（0–3），不认哪一面叫阳。有的门派以背为阳、
 * 有的以字为阳。故此处的铜钱只标阴阳，并在旁注明这件事由用户自己的门派定 ——
 * 替他选一个，等于替他选了一个门派。
 */

/** 一枚铜钱：`null` 未记，1 阳，0 阴。 */
type Face = 0 | 1 | null;
/** 一掷三枚。 */
type Row = readonly [Face, Face, Face];

const EMPTY: Row = [null, null, null];
const POS_LABEL = ["初", "二", "三", "四", "五", "上"] as const;

const complete = (r: Row): r is readonly [0 | 1, 0 | 1, 0 | 1] => r.every((f) => f !== null);
const yangCount = (r: Row): CoinThrow =>
  r.filter((f) => f === 1).length as CoinThrow;

/** 阳面数 → 爻性与动静。与 `cast.ts` 的表同源，此处只作显示。 */
function readYao(n: CoinThrow): { yang: boolean; moving: boolean; name: string } {
  switch (n) {
    case 3: return { yang: true, moving: true, name: "老阳・重" };
    case 2: return { yang: false, moving: false, name: "少阴・拆" };
    case 1: return { yang: true, moving: false, name: "少阳・单" };
    default: return { yang: false, moving: true, name: "老阴・交" };
  }
}

/** 一枚真随机的铜钱。`Math.random` 也够用，但既然有更好的就用更好的。 */
function tossOne(): 0 | 1 {
  const b = new Uint8Array(1);
  crypto.getRandomValues(b);
  return (b[0]! & 1) as 0 | 1;
}
const tossRow = (): Row => [tossOne(), tossOne(), tossOne()];

export interface CoinCastProps {
  /** 六掷齐备时回调；任一掷不全时给 null。 */
  readonly onChange: (throws: readonly CoinThrow[] | null) => void;
}

export function CoinCast({ onChange }: CoinCastProps) {
  const [rows, setRows] = useState<readonly Row[]>([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);
  const [byHand, setByHand] = useState(true);

  const push = (next: readonly Row[]) => {
    setRows(next);
    onChange(next.every(complete) ? next.map(yangCount) : null);
  };

  const setCoin = (i: number, k: number, v: Face) => {
    push(rows.map((r, ri) => (ri === i ? (r.map((f, ki) => (ki === k ? v : f)) as unknown as Row) : r)));
  };

  /** 替用户掷下一爻 —— 自初爻起，一爻一掷，与实际次序一致。 */
  const tossNext = () => {
    const i = rows.findIndex((r) => !complete(r));
    if (i < 0) return;
    push(rows.map((r, ri) => (ri === i ? tossRow() : r)));
  };
  const tossAll = () => push(rows.map(() => tossRow()));
  const reset = () => push([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]);

  const done = rows.filter(complete).length;

  return (
    <div className="coincast">
      <div className="row" style={{ marginBottom: 10 }}>
        {([[true, "我自己掷，这里只记结果"], [false, "手边没铜钱，替我掷"]] as const).map(
          ([v, name]) => (
            <label key={String(v)}>
              <input type="radio" checked={byHand === v} onChange={() => setByHand(v)} />
              {name}
            </label>
          ))}
      </div>

      {/* 自上而下画卦，自下而上填 —— 卦画的次序与掷钱的次序本就相反 */}
      <div className="coin-grid">
        {[5, 4, 3, 2, 1, 0].map((i) => {
          const r = rows[i]!;
          const filled = complete(r);
          const yao = filled ? readYao(yangCount(r)) : null;
          const isNext = !filled && rows.slice(0, i).every(complete);
          return (
            <div key={i} className={`coin-row${isNext ? " next" : ""}`}>
              <span className="coin-pos">{POS_LABEL[i]}</span>
              <span className="coins">
                {[0, 1, 2].map((k) => {
                  const f = r[k];
                  const cycle: Face = f === null ? 1 : f === 1 ? 0 : null;
                  return (
                    <button
                      key={k} type="button"
                      className={`coin${f === null ? " blank" : f === 1 ? " yang" : " yin"}`}
                      disabled={!byHand}
                      aria-label={`第 ${POS_LABEL[i]} 爻第 ${k + 1} 枚`}
                      onClick={() => setCoin(i, k, cycle)}
                    >
                      {f === null ? "" : f === 1 ? "阳" : "阴"}
                    </button>
                  );
                })}
              </span>
              <span className="yaoline" aria-hidden>
                {yao === null
                  ? <i className="seg pending" />
                  : yao.yang
                    ? <i className="seg" />
                    : <><i className="seg half" /><i className="seg half" /></>}
              </span>
              <span className="coin-note dim">
                {yao === null ? "—" : `${yangCount(r)} 阳・${yao.name}${yao.moving ? "（动）" : ""}`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        {!byHand && (
          <>
            <button type="button" className="ghost" onClick={tossNext} disabled={done === 6}>
              掷第 {POS_LABEL[Math.min(done, 5)]} 爻
            </button>
            <button type="button" className="ghost" onClick={tossAll}>六爻一次掷完</button>
          </>
        )}
        <button type="button" className="ghost" onClick={reset} disabled={done === 0}>重来</button>
        <span className="dim">已记 {done} / 6</span>
      </div>

      <p className="dim" style={{ marginTop: 8 }}>
        {byHand
          ? "自初爻起，掷一次记一次：每枚点一下阳、再点一下阴、第三下清空。三枚同面为老，老者为动爻。"
          : "这一档由 crypto.getRandomValues 掷，是伪随机数，不是「诚心所感」—— 说明白，不含糊过去。手边有铜钱就用上一档。"}
        {" "}哪一面算阳由你的门派定（有以背为阳的，也有以字为阳的），本引擎只认三枚里的阳面数。
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  complete, nextFace, readYao, useCoinRows, yangCount, type CoinCastProps,
} from "../../../components/CoinCast";

/**
 * 移动版的掷铜钱 —— 记法与桌面版（`components/CoinCast.tsx`）同一份，只是说法换成平常话。
 *
 * | 桌面版 | 这里 |
 * | 阳 / 阴 | 正 / 反 |
 * | 初爻 … 上爻 | 第一次 … 第六次（最下面 … 最上面） |
 * | 老阳・重（动） | 三枚都是正 · 在动 |
 *
 * 「正」就是桌面版的「阳」。哪一面算正由用户自己定 —— 有以字为正的，也有以背为正的；
 * 替他定一个，等于替他选了一个门派（桌面版同此理）。
 *
 * 「让手机替我掷」用的是 `crypto.getRandomValues`，不是用户自己掷的。
 * 这一点照桌面版写在明处，不含糊过去。
 */

const ORDINAL = ["第一次", "第二次", "第三次", "第四次", "第五次", "第六次"] as const;

export function Coins({ onChange }: CoinCastProps) {
  const { rows, setCoin, tossNext, tossAll, reset, done } = useCoinRows(onChange);
  const [byHand, setByHand] = useState(true);

  return (
    <div className="m-coins">
      <div className="m-seg">
        <button type="button" className={byHand ? "on" : undefined}
          onClick={() => setByHand(true)}>我自己掷</button>
        <button type="button" className={byHand ? undefined : "on"}
          onClick={() => setByHand(false)}>让手机替我掷</button>
      </div>

      <p className="m-coin-help">
        {byHand ? (
          <>
            准备三枚一样的硬币（有铜钱最好），两面里先定一面叫「正」——
            有人以有字的一面为正，也有人以背面为正，定了就一直这么算。
            然后掷六次，每次把三枚的正反点下来：点一下是正，再点一下是反，第三下清空。
            从最下面一行记起，一次一行往上。
          </>
        ) : (
          <>
            手机替你掷，用的是程序生成的随机数，不是你自己掷出来的 —— 这一点说在明处。
            手边有硬币，还是自己掷。
          </>
        )}
      </p>

      {/* 自上而下排，自下而上填 —— 第一次落在最下面，与传统的次序一致 */}
      <div className="m-coin-grid">
        {[5, 4, 3, 2, 1, 0].map((i) => {
          const r = rows[i]!;
          const filled = complete(r);
          const yao = filled ? readYao(yangCount(r)) : null;
          const isNext = !filled && rows.slice(0, i).every(complete);
          const n = filled ? yangCount(r) : null;
          return (
            <div key={i} className={`m-coin-row${isNext ? " next" : ""}`}>
              <span className="ord">
                {ORDINAL[i]}
                {i === 0 && <small>最下面</small>}
                {i === 5 && <small>最上面</small>}
              </span>
              <span className="coins">
                {[0, 1, 2].map((k) => {
                  const f = r[k] ?? null;
                  return (
                    <button
                      key={k} type="button"
                      className={`coin${f === null ? " blank" : f === 1 ? " yang" : " yin"}`}
                      disabled={!byHand}
                      aria-label={`${ORDINAL[i]}第 ${k + 1} 枚`}
                      onClick={() => setCoin(i, k, nextFace(f))}
                    >
                      {f === null ? "" : f === 1 ? "正" : "反"}
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
              <span className={`mv${yao?.moving === true ? " on" : ""}`}>
                {yao === null ? "" : yao.moving ? (n === 3 ? "三正 · 在动" : "三反 · 在动") : "不动"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="m-chips" style={{ alignItems: "center", marginBottom: 0 }}>
        {!byHand && (
          <>
            <button type="button" className="m-chip" onClick={tossNext} disabled={done === 6}>
              掷{ORDINAL[Math.min(done, 5)]}
            </button>
            <button type="button" className="m-chip" onClick={tossAll}>六次一起掷</button>
          </>
        )}
        <button type="button" className="m-chip" onClick={reset} disabled={done === 0}>重来</button>
        <span className="m-coin-count">已记 {done} / 6</span>
      </div>
    </div>
  );
}


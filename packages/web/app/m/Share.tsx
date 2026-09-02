"use client";

import { useState } from "react";

/**
 * 分享 —— **只分享人话文本**。
 *
 * 不含出生日期、时间、地点，也不含年份对照。
 * 「生辰数据不出本机」这条纪律不因为「分享」而松动 ——
 * 分享按钮是这类应用里最容易把隐私漏出去的一个地方，
 * 因为它看起来是用户主动的，于是没人再去想里面装了什么。
 *
 * 用 `navigator.share` 时同样只传文本，不传链接 ——
 * 链接会带上 URL 片段，而片段里是命盘标识。
 */
export function Share({ title, lines }: { title: string; lines: readonly string[] }) {
  const [done, setDone] = useState(false);
  const text = [title, "", ...lines, "",
    "—— 出自一套传统推演模型的结构描述，不预告将会发生什么。"].join("\n");

  const go = () => {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (typeof nav.share === "function") {
      void nav.share({ text }).catch(() => { /* 用户取消，无妨 */ });
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => { setDone(true); setTimeout(() => setDone(false), 2000); },
      () => { setDone(false); },
    );
  };

  return (
    <div className="m-note">
      <button className="m-btn ghost" onClick={go}>
        {done ? "已复制" : "分享这段话"}
      </button>
      <p style={{ marginTop: 8 }}>
        只分享上面这段文字。<b>不含你的出生日期、时间和地点</b> ——
        那些始终留在这台设备上。
      </p>
    </div>
  );
}

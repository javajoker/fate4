"use client";

import { useState } from "react";
import { renderMarkdown, type Report } from "@fate/core";

/**
 * AI 档 —— 导出技术报告，由用户自己交给 Skill。
 *
 * **不自动发送。** 本站纯静态、生辰数据不出本机；在浏览器里直连模型接口
 * 等于把出生信息发给第三方，与全站的隐私纪律相反。
 * 故此处只做一件事：把技术报告和转述规矩拼成一段可复制的文本。
 * 送不送、送给谁，是用户的决定。
 */
export function AiHandoff({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);

  const payload = [
    "请把下面这份推演结果讲成平常话。规矩：",
    "1 不给方位、属相、颜色、数字、日期这类可以照着做的指定；",
    "2 不作「适合／不适合」的适配判断（不说适合什么工作、该找什么样的人）；",
    "3 不出祈使句；",
    "4 不评相貌，形体只说倾向并标明是传统对照；",
    "5 不描述别人，只说「我与某类关系的相处结构」；",
    "6 每一条都说明它来自一套传统模型，不是对我本人的鉴定，也不预告将会发生什么。",
    "",
    "———— 推演结果 ————",
    renderMarkdown(report),
  ].join("\n");

  return (
    <div className="m-note">
      <b>AI 档</b>：这一档不会自动把你的信息发给任何人。
      本站是纯静态的，出生数据不出本机 —— 在浏览器里直连模型接口，
      等于把它发给第三方，那与本站的隐私做法相反。
      <div style={{ marginTop: 10 }}>
        <button className="m-btn" onClick={() => {
          void navigator.clipboard.writeText(payload).then(
            () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
            () => { setCopied(false); },
          );
        }}>
          {copied ? "已复制" : "复制给 AI 的内容"}
        </button>
      </div>
      <p style={{ marginTop: 8 }}>
        复制后交给 <code>bazi-plain</code> Skill 或任一模型。
        转述出来的措辞会更活，但它是语言模型不是查表 ——
        同一份判定两次转述未必一字不差；要逐字可复算的版本，用「代码生成」档。
      </p>
      <details style={{ marginTop: 8 }}>
        <summary>看要复制的内容</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, marginTop: 8 }}>
          {payload.slice(0, 1200)}
          {payload.length > 1200 ? "\n…（共 " + payload.length + " 字）" : ""}
        </pre>
      </details>
    </div>
  );
}

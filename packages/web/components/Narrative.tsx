import type { NarrativeLine } from "@fate/core";

/**
 * 叙述行。
 *
 * 降级为 hedged 的行显式标注 —— 读者有权知道哪一句是系统没把握的。
 * 把低置信度的判定与高置信度的排在一起而不加区分，是这一层最容易犯的错。
 */
export function Narrative({ lines }: { lines: readonly NarrativeLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="narrative">
      {lines.map((l, i) => (
        <li key={`${l.templateId}-${i}`} className={l.hedged ? "hedged" : undefined}>
          {l.text}
          {l.hedged && (
            <span className="flag">
              置信度 {l.confidence.toFixed(2)}，已改用留有余地的措辞
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

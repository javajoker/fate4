export const pct = (x: number, d = 1): string => `${(x * 100).toFixed(d)}%`;
export const num = (x: number, d = 1): string => x.toFixed(d);
export const pillarText = (p: { stem: string; branch: string } | null): string =>
  p === null ? "—" : `${p.stem}${p.branch}`;

/** 片段要跟着链接走 —— 否则换一页就丢了命盘。 */
export const withFrag = (path: string, frag: string): string =>
  frag === "" ? path : `${path}#${frag}`;

/**
 * 神煞的稳定唯一键。
 *
 * 名字不唯一（天乙贵人有两个落点），名字 + 起例也不唯一
 * （同一起例可落在同名支的两处）。必须带上落点。
 */
export const shenshaKey = (h: {
  name: string; basis: string;
  landsOn: { pillar: string; layer: string };
  branch: string | null; stem: string | null;
}): string => `${h.name}|${h.basis}|${h.landsOn.pillar}.${h.landsOn.layer}|${h.branch ?? h.stem ?? ""}`;

/** 同名神煞在展示时合并 —— 一格里出现两次「禄神」只是噪声。 */
export function dedupeByName<T extends { name: string }>(xs: readonly T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.name) ? false : (seen.add(x.name), true)));
}

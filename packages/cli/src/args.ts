/**
 * 参数解析。
 *
 * 用 `node:util` 的 `parseArgs`，不引第三方 —— CLI 是 Skill 的执行后端，
 * 依赖越少，出问题的地方越少。
 *
 * `strict: true` 的意义在于**未知选项报错而非静默忽略**：
 * `--gendre male` 若被默默丢掉，盘面照出，性别按缺省走，错得无声无息。
 */

import { parseArgs, type ParseArgsConfig } from "node:util";
import { UsageError } from "./io.js";

export type Options = Record<string, string | boolean | undefined>;

type OptionConfig = NonNullable<ParseArgsConfig["options"]>;

export function parse(argv: readonly string[], options: OptionConfig): Options {
  try {
    const { values } = parseArgs({
      args: [...argv], options, strict: true, allowPositionals: false,
    });
    return values as Options;
  } catch (e) {
    throw new UsageError(e instanceof Error ? e.message : String(e));
  }
}

export function req(v: Options, key: string): string {
  const x = v[key];
  if (typeof x !== "string" || x.length === 0) throw new UsageError(`缺少必需选项 --${key}`);
  return x;
}

export function num(v: Options, key: string): number | undefined {
  const x = v[key];
  if (x === undefined || typeof x === "boolean") return undefined;
  const n = Number(x);
  if (!Number.isFinite(n)) throw new UsageError(`--${key} 须为数字，实为 ${JSON.stringify(x)}`);
  return n;
}

export function reqNum(v: Options, key: string): number {
  const n = num(v, key);
  if (n === undefined) throw new UsageError(`缺少必需选项 --${key}`);
  return n;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{1,2}):(\d{2})$/;

export function parseDate(s: string, what = "--date"): { year: number; month: number; day: number } {
  const m = DATE.exec(s.trim());
  if (m === null) throw new UsageError(`${what} 须形如 YYYY-MM-DD，实为 ${JSON.stringify(s)}`);
  const year = Number(m[1]); const month = Number(m[2]); const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new UsageError(`${what} 的月或日超出范围：${s}`);
  }
  return { year, month, day };
}

export function parseTime(s: string): { hour: number; minute: number } {
  const m = TIME.exec(s.trim());
  if (m === null) throw new UsageError(`--time 须形如 HH:MM，实为 ${JSON.stringify(s)}`);
  const hour = Number(m[1]); const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new UsageError(`--time 超出范围：${s}`);
  return { hour, minute };
}

export function oneOf<T extends string>(
  v: Options, key: string, allowed: readonly T[], fallback: T,
): T {
  const x = v[key];
  if (x === undefined) return fallback;
  if (typeof x !== "string" || !(allowed as readonly string[]).includes(x)) {
    throw new UsageError(`--${key} 须为 ${allowed.join(" | ")} 之一，实为 ${JSON.stringify(x)}`);
  }
  return x as T;
}

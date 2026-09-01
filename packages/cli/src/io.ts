/**
 * CLI 的外部世界。
 *
 * 全部 I/O 走这一个接口，于是命令本身仍是纯函数，可在进程内测试 ——
 * 不必 spawn 子进程，也不必往磁盘写临时文件。
 * 「Skill 与 Web 结论逐字一致」这条验收要能被断言，前提正是命令可以被直接调用。
 */
export interface Io {
  readonly out: (s: string) => void;
  readonly err: (s: string) => void;
  readonly readFile: (p: string) => string;
  readonly writeFile: (p: string, s: string) => void;
  /** 当前日期。内核里没有 Date.now()，取系统时间是**外壳**的职责。 */
  readonly today: () => { year: number; month: number; day: number };
}

export class UsageError extends Error {
  constructor(message: string) { super(message); this.name = "UsageError"; }
}

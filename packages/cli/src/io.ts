/**
 * CLI 的外部世界。
 *
 * 全部 I/O 走这一个接口，于是命令本身仍是纯函数，可在进程内测试 ——
 * 不必 spawn 子进程，也不必往磁盘写临时文件。
 * 「Skill 与 Web 结论逐字一致」这条验收要能被断言，前提正是命令可以被直接调用。
 */
export interface Io {
  /**
   * 写一段输出。
   *
   * `kind` 说的是**这段文本是什么**，不是它长什么样：
   * `narrative` 是给人读的句子，`data` 是结构化转储（JSON），
   * `plain` 是人话版。三者各走各的守卫档 —— 见 `guardOutput`。
   *
   * 人话版单立一档，是因为它**放开第二人称却另加六条更硬的**：
   * 技术层禁「你」，人话层要用「你」，但同时禁方位属相、禁适配判断、禁祈使句。
   * 拿技术层的规则去扫人话，会把每一个「你」都拦下来；
   * 拿人话层的规则去扫技术叙述，则会漏掉那条第二人称的红线。
   */
  readonly out: (s: string, kind?: "narrative" | "data" | "plain") => void;
  readonly err: (s: string) => void;
  readonly readFile: (p: string) => string;
  readonly writeFile: (p: string, s: string) => void;
  /** 当前日期。内核里没有 Date.now()，取系统时间是**外壳**的职责。 */
  readonly today: () => { year: number; month: number; day: number };
}

export class UsageError extends Error {
  constructor(message: string) { super(message); this.name = "UsageError"; }
}

# @fate/skill

Claude Agent Skill 的载荷。

```
skill/
├── SKILL.md                    元数据与工作流程
├── scripts/                    对 @fate/cli 的薄封装
└── references/
    ├── terminology.md          术语对照，供解释名词
    ├── reading-guide.md        如何组织一次解读
    └── constraints.md          措辞禁令（docs/09-report §6）
```

脚本经 `FATE_BIN` 定位 CLI，默认 `../../cli/bin/fate.mjs`。
CLI 消费 `tsc -b` 的编译产物，故首次使用前需在仓库根目录跑一次
`pnpm install && pnpm typecheck`。

**Skill 与 Web 共用同一份 `@fate/core` 与同一套叙述模板。**
`report.sh` 的输出与网页上的完整报告逐字节相同 —— 这是构造保证，
由 `packages/cli/test/cli.spec.ts` 断言。

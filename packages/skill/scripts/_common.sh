#!/usr/bin/env bash
# 公共前导。所有脚本共用。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FATE="${FATE_BIN:-$HERE/../../cli/bin/fate.mjs}"

if [ ! -f "$FATE" ]; then
  echo "找不到 CLI：$FATE" >&2
  echo "先在仓库根目录执行 pnpm install && pnpm typecheck（CLI 消费 tsc 的编译产物）。" >&2
  exit 127
fi

fate() { node "$FATE" "$@"; }

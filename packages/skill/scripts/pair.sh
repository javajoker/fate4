#!/usr/bin/env bash
#   pair.sh --chart a.json --chart-b b.json [--json]
# 合盘：两张四柱盘的结构关系。⚠️ **不给分数**，也不出对任何一方的人格描述。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate pair "$@"

#!/usr/bin/env bash
#   topics.sh [--json]
# 列出三十二类占事及各自的用神。健康类标了「输出受限」。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate topics "$@"

#!/usr/bin/env bash
#   year_view.sh --chart chart.json --year 2026 [--json]
# 产出该年的六柱盘面、顺逆指数、触发的应期规则与按域聚合。
# 注意 domains[].tension：净值近零而张力高，是大起大落，不是平淡无事。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate year "$@"

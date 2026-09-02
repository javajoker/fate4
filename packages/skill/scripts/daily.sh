#!/usr/bin/env bash
#   daily.sh --chart chart.json [--date YYYY-MM-DD] [--json]
# 当日运程：四柱流日与六爻日卦**并列陈述，不作合并**。
# 两者都是当日干支的确定性函数 —— 方向一致不构成互相印证。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate daily "$@"

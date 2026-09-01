#!/usr/bin/env bash
#   report.sh --chart chart.json [--format markdown|json] [--now YYYY-MM-DD]
#             [--subject self|other]
#
# --subject other：用户给的是他人生辰。此时六亲叙述与神煞语义标签**整体不生成**。
# 报告与 Web 界面逐字一致 —— 两者是同一次调用。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate report "$@"

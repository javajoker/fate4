#!/usr/bin/env bash
#   plain.sh --chart chart.json [--section 性格|身心|亲近的人|人生轨迹|起伏|今年|本月|今天]
#            [--json]
#
# 人话版：把报告的判定换成平常话，每条附上它的技术原文作依据。
# **人话由枚举查表得到，不是重新撰写** —— 它不可能漂离技术层。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate plain "$@"

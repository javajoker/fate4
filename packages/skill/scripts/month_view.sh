#!/usr/bin/env bash
#   month_view.sh --chart chart.json --year 2026 --month 9 [--json]
# --month 取公历月 1–12，解析为「节落在该月内」的那个节气月。
# **流月不参与权重计算**，输出中不会有任何 weight 字段 —— 这是硬约束，不是遗漏。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate month "$@"

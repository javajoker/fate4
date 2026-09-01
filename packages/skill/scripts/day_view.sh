#!/usr/bin/env bash
#   day_view.sh --chart chart.json --date 2026-09-01 [--json]
# 流日只作引动，同样无权重字段。冲突只分「轻微」「明显」两档 ——
# 日层的分辨率本就不支持更细的判断。此处不出宜忌，不作预测。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate day "$@"

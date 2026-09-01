#!/usr/bin/env bash
# 排盘。产出命盘文件（JSON），后续所有脚本都引用它。
#
#   build_chart.sh --date 1990-05-12 --time 14:30 --city 上海 --gender male -o chart.json
#   build_chart.sh --date 1990-05-12 --unknown-hour --tz Asia/Shanghai --lon 121.47 \
#                  --gender female -o chart.json
#
# 城市表是便利而非权威：输出会回显所用经度与时区，请读给用户核对。
# 表外地点请给 --tz 与 --lon。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate chart "$@"

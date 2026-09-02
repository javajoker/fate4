#!/usr/bin/env bash
#   ask.sh --topic 占事id [--question 问题文本] (--city 城市 | --tz 时区 --lon 经度)
#          [--at "YYYY-MM-DD HH:MM"] [--method time|number|coin] [--journal f.json] [--json]
#
# 六爻问事。**不需要生辰** —— 卦属于起卦的时刻，不属于问卜的人。
# 同一时辰内的所有问事得到同一个卦，区分不同的事靠取不同的用神。
#
# --question 只在本机算指纹，原文不落盘、不进报告。
# 配 --journal 即启用「一事不二占」：同一问题同一日再问，返回首卦。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate ask "$@"

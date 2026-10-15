#!/usr/bin/env bash
#   ziwei.sh --chart c.json [--json]
# 紫微斗数：十二宫、十四主星、四化、大限，以及三方四正的盘面解读。
# ⚠️ 年干支以正月初一为界，与四柱的立春年可能不是同一个 —— 输出会说明。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate ziwei "$@"

#!/usr/bin/env bash
#   tarot.sh [--spread one|three|celtic] [--reversals] [--numbering marseille|rws]
# 塔罗：不要生辰，也不要时刻。⚠️ 本项目**不给牌义** —— 只给牌的身份与牌阵位置的问题。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate tarot "$@"

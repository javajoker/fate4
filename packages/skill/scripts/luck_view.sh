#!/usr/bin/env bash
#   luck_view.sh --chart chart.json [--json]
# 大运全表。每步取起、中、末三个样本 —— 前五年重天干、后五年重地支，
# 气象本就不同，**不要对三点取平均后只报一个数**。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate luck "$@"

#!/usr/bin/env bash
#   report.sh --chart chart.json [--format markdown|json] [--now YYYY-MM-DD]
#             [--subject self|other] [--nodes [--node-threshold 2.0]]
#
# --subject other：用户给的是他人生辰。此时六亲叙述与神煞语义标签**整体不生成**，
#                  §6.5 统计节点同样不生成。
# --nodes：加算 §6.5 统计节点（两层结论 + 趋吉避凶）。默认关闭 ——
#          它要按月跑满六十年，约 1.3 秒，比其余全部章节加起来还久。
#          用户问「哪几年要注意」「什么时候有变化」一类问题时才需要。
# --node-threshold：判据门槛，单位为标准差，默认 2.0。它是**取多少条**的旋钮，
#                   不是显著性水平 —— 调高只是少报几条。
#
# 报告与 Web 界面逐字一致 —— 两者是同一次调用。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate report "$@"

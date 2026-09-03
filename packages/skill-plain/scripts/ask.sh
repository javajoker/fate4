#!/usr/bin/env bash
#   ask.sh --topic 占事id [--question 问题文本] (--city 城市 | --tz 时区 --lon 经度)
#          [--journal f.json] [--plain]
#
# 占问。**本 Skill 一律加 --plain** —— 那一档输出的是已经过人话守卫的卡片，
# 自己从术语版翻一遍等于绕开那层守卫。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate ask --plain "$@"

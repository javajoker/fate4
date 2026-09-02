#!/usr/bin/env bash
#   cross.sh (--city 城市 | --tz 时区 --lon 经度) [--at "YYYY-MM-DD HH:MM"]
#           [--chart chart.json] [--topic 占事id] [--json]
#
# 四家合参：四柱流日 ∥ 六爻 ∥ 六壬 ∥ 奇门。不给 --chart 则三家。
# 各家并列陈述，**不作合并**。四家都是同一时刻干支的确定性函数 ——
# 方向一致不构成互相印证，方向相反也不代表哪一家有误。
source "$(dirname "${BASH_SOURCE[0]}")/_common.sh"
fate cross "$@"

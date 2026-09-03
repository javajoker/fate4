/**
 * 语料出处与校验和。
 *
 * 由 scripts/generate-yaoci.mjs 生成，**请勿手改**。
 */

export const YAOCI_PROVENANCE = {
  "dataset": "iching corpus",
  "description": "六十四卦爻辞原文、一句话指事、白话转述、六爻位阶段（简/繁/英）",
  "origin": "同作者的原型项目 prototypes/fate/fate/src/api",
  "note": "爻辞原文为《周易》公有领域文本；指事与白话转述为原型项目的撰述。",
  "sources": [
    {
      "file": "iching-base.js",
      "sha256": "badae66aedb8586a6e08eac0e9aa4585205ccc5a90280f6e5b424aa896895cbb"
    },
    {
      "file": "iching.zh-CN.js",
      "sha256": "0035323d9e9c6fa01b3e900953c4a6ede7b323ccb0b31302fa99fae3b096a148"
    },
    {
      "file": "iching.zh-TW.js",
      "sha256": "16c001afd2c55f2f279ff400bb195a170e85d2565501482ca4397507fc1924dc"
    },
    {
      "file": "iching.en.js",
      "sha256": "408f49a1c8ae23dabea440d38fb506dccb1b232df732d247f5332c4065f2abec"
    }
  ],
  "generated": "2026-09-03",
  "counts": {
    "hexagrams": 64,
    "slotsPerHexagram": 7,
    "entriesPerLocale": 448,
    "stages": 6
  }
} as const;

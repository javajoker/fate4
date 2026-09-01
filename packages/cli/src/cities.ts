/**
 * 出生地便捷表。
 *
 * ## 这是便利，不是权威
 *
 * 经度直接决定真太阳时，进而可能改变时支 —— 乌鲁木齐用东八区时钟，
 * 而它在东经 87.6°，与区时子午线差 32°，折合真太阳时**两小时余**。
 * 所以经度错了不是小事。
 *
 * 因此：
 * - 表里只收我能确信的城市，不求全；
 * - `--lon` 永远覆盖表值；
 * - 解析结果**一律回显**（见 commands/chart.ts），让人一眼能核；
 * - 有一条交叉校验：城市经度与其时区标称子午线之差不得超过 40°。
 *   这拦不住 0.5° 的小误差，但足以逮住符号写反、数位漏写这类粗错 ——
 *   而粗错正是凭记忆录入表格时最常犯的。
 *
 * 表外的地点请直接给 `--lon` 与 `--tz`。
 */

export interface City {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly timeZone: string;
  /** 东经为正。 */
  readonly longitude: number;
  readonly latitude: number;
}

export const CITIES: readonly City[] = Object.freeze([
  { name: "北京", aliases: ["beijing", "peking"], timeZone: "Asia/Shanghai", longitude: 116.41, latitude: 39.90 },
  { name: "上海", aliases: ["shanghai"], timeZone: "Asia/Shanghai", longitude: 121.47, latitude: 31.23 },
  { name: "广州", aliases: ["guangzhou", "canton"], timeZone: "Asia/Shanghai", longitude: 113.26, latitude: 23.13 },
  { name: "深圳", aliases: ["shenzhen"], timeZone: "Asia/Shanghai", longitude: 114.06, latitude: 22.55 },
  { name: "天津", aliases: ["tianjin"], timeZone: "Asia/Shanghai", longitude: 117.20, latitude: 39.13 },
  { name: "重庆", aliases: ["chongqing"], timeZone: "Asia/Shanghai", longitude: 106.55, latitude: 29.56 },
  { name: "成都", aliases: ["chengdu"], timeZone: "Asia/Shanghai", longitude: 104.07, latitude: 30.57 },
  { name: "西安", aliases: ["xian", "xi'an"], timeZone: "Asia/Shanghai", longitude: 108.95, latitude: 34.27 },
  { name: "武汉", aliases: ["wuhan"], timeZone: "Asia/Shanghai", longitude: 114.31, latitude: 30.59 },
  { name: "杭州", aliases: ["hangzhou"], timeZone: "Asia/Shanghai", longitude: 120.16, latitude: 30.27 },
  { name: "南京", aliases: ["nanjing"], timeZone: "Asia/Shanghai", longitude: 118.80, latitude: 32.06 },
  { name: "沈阳", aliases: ["shenyang"], timeZone: "Asia/Shanghai", longitude: 123.43, latitude: 41.80 },
  { name: "哈尔滨", aliases: ["harbin"], timeZone: "Asia/Shanghai", longitude: 126.53, latitude: 45.80 },
  { name: "长沙", aliases: ["changsha"], timeZone: "Asia/Shanghai", longitude: 112.94, latitude: 28.23 },
  { name: "郑州", aliases: ["zhengzhou"], timeZone: "Asia/Shanghai", longitude: 113.63, latitude: 34.75 },
  { name: "济南", aliases: ["jinan"], timeZone: "Asia/Shanghai", longitude: 117.00, latitude: 36.67 },
  { name: "青岛", aliases: ["qingdao"], timeZone: "Asia/Shanghai", longitude: 120.38, latitude: 36.07 },
  { name: "厦门", aliases: ["xiamen"], timeZone: "Asia/Shanghai", longitude: 118.09, latitude: 24.48 },
  { name: "福州", aliases: ["fuzhou"], timeZone: "Asia/Shanghai", longitude: 119.30, latitude: 26.08 },
  { name: "昆明", aliases: ["kunming"], timeZone: "Asia/Shanghai", longitude: 102.83, latitude: 24.88 },
  { name: "贵阳", aliases: ["guiyang"], timeZone: "Asia/Shanghai", longitude: 106.63, latitude: 26.65 },
  { name: "兰州", aliases: ["lanzhou"], timeZone: "Asia/Shanghai", longitude: 103.82, latitude: 36.06 },
  { name: "呼和浩特", aliases: ["hohhot"], timeZone: "Asia/Shanghai", longitude: 111.75, latitude: 40.84 },
  { name: "南宁", aliases: ["nanning"], timeZone: "Asia/Shanghai", longitude: 108.37, latitude: 22.82 },
  { name: "海口", aliases: ["haikou"], timeZone: "Asia/Shanghai", longitude: 110.20, latitude: 20.04 },
  { name: "乌鲁木齐", aliases: ["urumqi"], timeZone: "Asia/Shanghai", longitude: 87.62, latitude: 43.83 },
  { name: "拉萨", aliases: ["lhasa"], timeZone: "Asia/Shanghai", longitude: 91.11, latitude: 29.65 },
  { name: "香港", aliases: ["hongkong", "hong kong"], timeZone: "Asia/Hong_Kong", longitude: 114.17, latitude: 22.30 },
  { name: "澳门", aliases: ["macau", "macao"], timeZone: "Asia/Macau", longitude: 113.54, latitude: 22.19 },
  { name: "台北", aliases: ["taipei"], timeZone: "Asia/Taipei", longitude: 121.52, latitude: 25.03 },
  { name: "高雄", aliases: ["kaohsiung"], timeZone: "Asia/Taipei", longitude: 120.30, latitude: 22.63 },
  { name: "新加坡", aliases: ["singapore"], timeZone: "Asia/Singapore", longitude: 103.82, latitude: 1.35 },
  { name: "吉隆坡", aliases: ["kuala lumpur"], timeZone: "Asia/Kuala_Lumpur", longitude: 101.69, latitude: 3.14 },
  { name: "东京", aliases: ["tokyo"], timeZone: "Asia/Tokyo", longitude: 139.69, latitude: 35.69 },
  { name: "首尔", aliases: ["seoul"], timeZone: "Asia/Seoul", longitude: 126.98, latitude: 37.57 },
  { name: "曼谷", aliases: ["bangkok"], timeZone: "Asia/Bangkok", longitude: 100.50, latitude: 13.75 },
  { name: "伦敦", aliases: ["london"], timeZone: "Europe/London", longitude: -0.13, latitude: 51.51 },
  { name: "巴黎", aliases: ["paris"], timeZone: "Europe/Paris", longitude: 2.35, latitude: 48.86 },
  { name: "纽约", aliases: ["new york"], timeZone: "America/New_York", longitude: -74.01, latitude: 40.71 },
  { name: "洛杉矶", aliases: ["los angeles"], timeZone: "America/Los_Angeles", longitude: -118.24, latitude: 34.05 },
  { name: "旧金山", aliases: ["san francisco"], timeZone: "America/Los_Angeles", longitude: -122.42, latitude: 37.77 },
  { name: "温哥华", aliases: ["vancouver"], timeZone: "America/Vancouver", longitude: -123.12, latitude: 49.28 },
  { name: "多伦多", aliases: ["toronto"], timeZone: "America/Toronto", longitude: -79.38, latitude: 43.65 },
  { name: "悉尼", aliases: ["sydney"], timeZone: "Australia/Sydney", longitude: 151.21, latitude: -33.87 },
  { name: "墨尔本", aliases: ["melbourne"], timeZone: "Australia/Melbourne", longitude: 144.96, latitude: -37.81 },
]);

export function findCity(q: string): City | undefined {
  const k = q.trim().toLowerCase();
  return CITIES.find(
    (c) => c.name === q.trim() || c.aliases.includes(k) || c.name.toLowerCase() === k);
}

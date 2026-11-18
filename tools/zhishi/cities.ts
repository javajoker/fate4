/**
 * 地点：按时区分组的主要城市。
 *
 * 起卦要两样：时区（定当地的钟点）与经度（换真太阳时 —— 同在 UTC+8，乌鲁木齐与上海
 * 差两个多小时的太阳时，时辰可能就差一个）。所以同一时区里多列几座经度相差大的城市。
 *
 * 分组用的 UTC 偏移在运行时按当下算（`Intl`），夏令时自动跟上，不写死在表里。
 * 三种文字的城市名都直接写在这里：外国地名转繁体要动 hant.ts 的一大批字，不值得。
 */

export interface City {
  readonly tz: string;
  readonly lon: number;
  readonly hans: string;
  readonly hant: string;
  readonly en: string;
}

const C = (tz: string, lon: number, hans: string, hant: string, en: string): City => ({ tz, lon, hans, hant, en });

export const CITIES: readonly City[] = [
  // UTC+8
  C("Asia/Shanghai", 116.41, "北京", "北京", "Beijing"),
  C("Asia/Shanghai", 121.47, "上海", "上海", "Shanghai"),
  C("Asia/Shanghai", 113.26, "广州", "廣州", "Guangzhou"),
  C("Asia/Shanghai", 114.06, "深圳", "深圳", "Shenzhen"),
  C("Asia/Shanghai", 120.15, "杭州", "杭州", "Hangzhou"),
  C("Asia/Shanghai", 114.31, "武汉", "武漢", "Wuhan"),
  C("Asia/Shanghai", 104.07, "成都", "成都", "Chengdu"),
  C("Asia/Shanghai", 106.55, "重庆", "重慶", "Chongqing"),
  C("Asia/Shanghai", 108.95, "西安", "西安", "Xi'an"),
  C("Asia/Shanghai", 123.43, "沈阳", "瀋陽", "Shenyang"),
  C("Asia/Shanghai", 91.13, "拉萨", "拉薩", "Lhasa"),
  C("Asia/Shanghai", 87.62, "乌鲁木齐", "烏魯木齊", "Ürümqi"),
  C("Asia/Taipei", 121.56, "台北", "臺北", "Taipei"),
  C("Asia/Taipei", 120.68, "台中", "臺中", "Taichung"),
  C("Asia/Taipei", 120.30, "高雄", "高雄", "Kaohsiung"),
  C("Asia/Hong_Kong", 114.17, "香港", "香港", "Hong Kong"),
  C("Asia/Macau", 113.54, "澳门", "澳門", "Macau"),
  C("Asia/Singapore", 103.82, "新加坡", "新加坡", "Singapore"),
  C("Asia/Kuala_Lumpur", 101.69, "吉隆坡", "吉隆坡", "Kuala Lumpur"),
  C("Asia/Manila", 120.98, "马尼拉", "馬尼拉", "Manila"),
  C("Australia/Perth", 115.86, "珀斯", "伯斯", "Perth"),
  // 东亚、大洋洲
  C("Asia/Tokyo", 139.69, "东京", "東京", "Tokyo"),
  C("Asia/Seoul", 126.98, "首尔", "首爾", "Seoul"),
  C("Australia/Sydney", 151.21, "悉尼", "雪梨", "Sydney"),
  C("Australia/Melbourne", 144.96, "墨尔本", "墨爾本", "Melbourne"),
  C("Pacific/Auckland", 174.76, "奥克兰", "奧克蘭", "Auckland"),
  // 东南亚、南亚、中东
  C("Asia/Bangkok", 100.50, "曼谷", "曼谷", "Bangkok"),
  C("Asia/Ho_Chi_Minh", 106.63, "胡志明市", "胡志明市", "Ho Chi Minh City"),
  C("Asia/Jakarta", 106.85, "雅加达", "雅加達", "Jakarta"),
  C("Asia/Kolkata", 77.21, "新德里", "新德里", "New Delhi"),
  C("Asia/Kolkata", 72.88, "孟买", "孟買", "Mumbai"),
  C("Asia/Dubai", 55.27, "迪拜", "杜拜", "Dubai"),
  // 欧洲、非洲
  C("Europe/Moscow", 37.62, "莫斯科", "莫斯科", "Moscow"),
  C("Europe/Istanbul", 28.98, "伊斯坦布尔", "伊斯坦堡", "Istanbul"),
  C("Africa/Cairo", 31.24, "开罗", "開羅", "Cairo"),
  C("Africa/Johannesburg", 28.05, "约翰内斯堡", "約翰尼斯堡", "Johannesburg"),
  C("Europe/Berlin", 13.40, "柏林", "柏林", "Berlin"),
  C("Europe/Paris", 2.35, "巴黎", "巴黎", "Paris"),
  C("Europe/London", -0.13, "伦敦", "倫敦", "London"),
  // 美洲
  C("America/Sao_Paulo", -46.63, "圣保罗", "聖保羅", "São Paulo"),
  C("America/New_York", -74.01, "纽约", "紐約", "New York"),
  C("America/Toronto", -79.38, "多伦多", "多倫多", "Toronto"),
  C("America/Chicago", -87.63, "芝加哥", "芝加哥", "Chicago"),
  C("America/Mexico_City", -99.13, "墨西哥城", "墨西哥城", "Mexico City"),
  C("America/Denver", -104.99, "丹佛", "丹佛", "Denver"),
  C("America/Los_Angeles", -118.24, "洛杉矶", "洛杉磯", "Los Angeles"),
  C("America/Los_Angeles", -122.42, "旧金山", "舊金山", "San Francisco"),
  C("America/Vancouver", -123.12, "温哥华", "溫哥華", "Vancouver"),
  C("America/Anchorage", -149.90, "安克雷奇", "安克拉治", "Anchorage"),
  C("Pacific/Honolulu", -157.86, "檀香山", "檀香山", "Honolulu"),
];

/** 该时区此刻相对 UTC 的分钟数（含夏令时）。 */
export function offsetMinutes(tz: string, at = new Date()): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
    .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(part);
  if (m === null) return 0;
  const v = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -v : v;
}

/** 「UTC+8」「UTC−3」「UTC+5:30」。 */
export function offsetLabel(min: number): string {
  const sign = min < 0 ? "−" : "+";
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return min === 0 ? "UTC" : `UTC${sign}${h}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}`;
}

/** 按当下的 UTC 偏移分组，偏移由东往西（大到小）排；组内保持表里的次序。 */
export function groupByOffset(at = new Date()): { offset: number; cities: { index: number; city: City }[] }[] {
  const groups = new Map<number, { index: number; city: City }[]>();
  CITIES.forEach((city, index) => {
    const off = offsetMinutes(city.tz, at);
    if (!groups.has(off)) groups.set(off, []);
    groups.get(off)!.push({ index, city });
  });
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([offset, cities]) => ({ offset, cities }));
}

/** 按设备时区猜一个：同一时区的第一座城市；没有就取同一偏移的；再没有就台北。 */
export function guessCity(deviceTz: string, at = new Date()): number {
  const same = CITIES.findIndex((c) => c.tz === deviceTz);
  if (same >= 0) return same;
  const off = offsetMinutes(deviceTz, at);
  const near = CITIES.findIndex((c) => offsetMinutes(c.tz, at) === off);
  return near >= 0 ? near : CITIES.findIndex((c) => c.tz === "Asia/Taipei");
}

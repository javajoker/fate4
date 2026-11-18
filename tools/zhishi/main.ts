/**
 * 六爻指事 —— 独立页面的交互。由 `scripts/build-zhishi.mjs` 连同内核一起打包进单个 HTML。
 *
 * 只做一件事：起一卦，按七例取出卦辞、爻辞的转述，接成一段话。
 * 不装卦、不断卦、不取用神、不报应期 —— 那些是问事页的事；指事本就不看用神
 * （`liuyao/yaoci.ts`），所以这里连占事都不用选。
 *
 * 起卦、取辞、措辞守卫全用内核的同一份代码，不在这里另写：
 * 同一时刻、同样六次掷钱，这一页与问事页取到的是同样几段话。
 */

import { castMomentOf } from "../../packages/core/src/liuyao/moment.js";
import { cast, type CastInput, type CoinThrow } from "../../packages/core/src/liuyao/cast.js";
import { dress } from "../../packages/core/src/liuyao/dress.js";
import { yaociReading } from "../../packages/core/src/liuyao/yaoci.js";
import { zhishiProse } from "../../packages/core/src/plain/zhishi.js";
import { loadParams } from "../../packages/core/src/params/load.js";

/** 与移动版同一张表（`packages/web/app/m/store.ts`）：名、时区、经度。 */
const CITIES: readonly (readonly [string, string, number])[] = [
  ["上海", "Asia/Shanghai", 121.47], ["北京", "Asia/Shanghai", 116.41],
  ["广州", "Asia/Shanghai", 113.26], ["深圳", "Asia/Shanghai", 114.06],
  ["成都", "Asia/Shanghai", 104.07], ["西安", "Asia/Shanghai", 108.95],
  ["台北", "Asia/Taipei", 121.56], ["香港", "Asia/Hong_Kong", 114.17],
  ["新加坡", "Asia/Singapore", 103.82],
];

type How = "time" | "coin";
type Face = 0 | 1 | null;
type Row = [Face, Face, Face];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls !== undefined) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

let how: How = "time";
let byHand = true;
let rows: Row[] = Array.from({ length: 6 }, () => [null, null, null] as Row);

const complete = (r: Row): boolean => r.every((f) => f !== null);

/** 输入一变，上一次的结果就不再对应眼前的选择 —— 收起来，免得读者对着旧卦看新铜钱。 */
const invalidate = (): void => { $("out").hidden = true; };
const heads = (r: Row): CoinThrow => r.filter((f) => f === 1).length as CoinThrow;

/** 一枚真随机的铜钱 —— 与问事页同一个随机源。 */
function tossOne(): 0 | 1 {
  const b = new Uint8Array(1);
  crypto.getRandomValues(b);
  return (b[0]! & 1) as 0 | 1;
}

// ── 地点 ──────────────────────────────────────────────────

function initPlaces(): void {
  const sel = $<HTMLSelectElement>("place");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  CITIES.forEach(([name], i) => sel.append(new Option(name, String(i))));
  const guess = CITIES.findIndex(([, z]) => z === tz);
  sel.value = String(guess < 0 ? 0 : guess);
}

/** 所选城市此刻的墙上时间 —— 不取设备的本地时间，设备时区可能与所选城市不同。 */
function wallNow(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: n("year"), month: n("month"), day: n("day"), hour: n("hour"), minute: n("minute") };
}

// ── 掷铜钱 ────────────────────────────────────────────────

const ORDINAL = ["第一次", "第二次", "第三次", "第四次", "第五次", "第六次"] as const;

function renderCoins(): void {
  const grid = $("coinGrid");
  grid.replaceChildren();
  const done = rows.filter(complete).length;
  for (const i of [5, 4, 3, 2, 1, 0]) {
    const r = rows[i]!;
    const filled = complete(r);
    const isNext = !filled && rows.slice(0, i).every(complete);
    const row = el("div", `coin-row${isNext ? " next" : ""}`);

    const ord = el("span", "ord", ORDINAL[i]);
    if (i === 0) ord.append(el("small", undefined, "最下面"));
    if (i === 5) ord.append(el("small", undefined, "最上面"));

    const coins = el("span", "coins");
    r.forEach((f, k) => {
      const b = el("button", `coin${f === null ? " blank" : f === 1 ? " head" : " tail"}`,
        f === null ? "" : f === 1 ? "正" : "反");
      b.type = "button";
      b.disabled = !byHand;
      b.setAttribute("aria-label", `${ORDINAL[i]}第 ${k + 1} 枚`);
      b.addEventListener("click", () => {
        r[k] = f === null ? 1 : f === 1 ? 0 : null;
        invalidate();
        renderCoins();
      });
      coins.append(b);
    });

    const line = el("span", "line");
    line.setAttribute("aria-hidden", "true");
    const n = filled ? heads(r) : null;
    if (n === null) line.append(el("i", "seg pending"));
    // 一正（少阳）、三正（老阳）为阳爻，画实线；二正（少阴）、三反（老阴）为阴爻，画断线
    else if (n === 1 || n === 3) line.append(el("i", "seg"));
    else line.append(el("i", "seg half"), el("i", "seg half"));

    const mv = el("span", `mv${n === 0 || n === 3 ? " on" : ""}`,
      n === null ? "" : n === 3 ? "三正 · 在动" : n === 0 ? "三反 · 在动" : "不动");

    row.append(ord, coins, line, mv);
    grid.append(row);
  }

  $("coinCount").textContent = `已记 ${done} / 6`;
  $<HTMLButtonElement>("tossNext").textContent = `掷${ORDINAL[Math.min(done, 5)]}`;
  $<HTMLButtonElement>("tossNext").disabled = done === 6;
  $<HTMLButtonElement>("reset").disabled = done === 0;
  for (const id of ["tossNext", "tossAll"]) $(id).hidden = byHand;
  $("coinHelpHand").hidden = !byHand;
  $("coinHelpMachine").hidden = byHand;
  syncGo();
}

function syncGo(): void {
  const go = $<HTMLButtonElement>("go");
  const ready = how === "time" || rows.every(complete);
  go.disabled = !ready;
  go.textContent = ready ? "起卦" : "六次掷齐后再起卦";
}

// ── 起卦与输出 ────────────────────────────────────────────

function ask(): void {
  const [cityName, timeZone, longitude] = CITIES[Number($<HTMLSelectElement>("place").value)]!;
  const now = wallNow(timeZone);
  const moment = castMomentOf({ ...now, timeZone, longitude });
  const input: CastInput = how === "time"
    ? { method: "time" }
    : { method: "coin", throws: rows.map(heads) as [CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow] };
  const params = loadParams({ liuyao: { castMethod: input.method } });
  const gua = dress(cast(moment, input, params.liuyao), params.liuyao);
  const prose = zhishiProse(yaociReading(gua, null, { layer: "plain" }));

  const moving = gua.yaos.filter((y) => y.moving).map((y) => y.pos);
  const pad = (x: number) => String(x).padStart(2, "0");
  $("gua").textContent = `${gua.ben.name}${gua.bian === null ? "" : ` → ${gua.bian.name}`}`;
  $("meta").textContent = [
    how === "time" ? "按时刻起" : "掷铜钱起",
    `${now.year}-${pad(now.month)}-${pad(now.day)} ${pad(now.hour)}:${pad(now.minute)}（${cityName}）`,
    moving.length === 0 ? "六格都没动" : `第 ${moving.join("、")} 格在动`,
  ].join(" · ");
  $("rule").textContent = prose.rule;

  const paras = $("paras");
  paras.replaceChildren();
  for (const p of prose.paragraphs) {
    const block = el("div", "para");
    block.append(el("p", "text", p.text));
    block.append(el("p", "src", `出自 ${p.source}${p.title === null ? "" : `（${p.title}）`}`));
    paras.append(block);
  }
  if (prose.paragraphs.length === 0) {
    paras.append(el("p", "text", "取到的几段话都没通过措辞检查，这一次没有可以显示的内容。"));
  }

  const w = $("withheld");
  w.hidden = prose.withheld === 0;
  w.textContent = `有 ${prose.withheld} 段没通过本项目的措辞检查（绝对的说法、命令式的口气之类），未显示。`
    + "语料是外来的，不为它开例外。";

  const out = $("out");
  out.hidden = false;
  out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

// ── 接线 ──────────────────────────────────────────────────

function setHow(h: How): void {
  if (h !== how) invalidate();
  how = h;
  for (const b of document.querySelectorAll<HTMLButtonElement>("#how button")) {
    const on = b.dataset["how"] === h;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
  $("coins").hidden = h !== "coin";
  $("ledeTime").hidden = h !== "time";
  $("ledeCoin").hidden = h !== "coin";
  syncGo();
}

function setHand(v: boolean): void {
  byHand = v;
  for (const b of document.querySelectorAll<HTMLButtonElement>("#hand button")) {
    const on = (b.dataset["hand"] === "1") === v;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
  renderCoins();
}

function main(): void {
  initPlaces();
  for (const b of document.querySelectorAll<HTMLButtonElement>("#how button")) {
    b.addEventListener("click", () => setHow(b.dataset["how"] as How));
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("#hand button")) {
    b.addEventListener("click", () => setHand(b.dataset["hand"] === "1"));
  }
  $("tossNext").addEventListener("click", () => {
    const i = rows.findIndex((r) => !complete(r));
    if (i >= 0) rows[i] = [tossOne(), tossOne(), tossOne()];
    invalidate();
    renderCoins();
  });
  $("tossAll").addEventListener("click", () => {
    rows = rows.map(() => [tossOne(), tossOne(), tossOne()] as Row);
    invalidate();
    renderCoins();
  });
  $("reset").addEventListener("click", () => {
    rows = rows.map(() => [null, null, null] as Row);
    invalidate();
    renderCoins();
  });
  $("place").addEventListener("change", invalidate);
  $("go").addEventListener("click", () => {
    try { ask(); } catch (e) {
      const out = $("out");
      out.hidden = false;
      $("paras").replaceChildren(el("p", "text", `出错了：${e instanceof Error ? e.message : String(e)}`));
    }
  });
  setHow("time");
  setHand(true);
}

main();

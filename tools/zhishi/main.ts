/**
 * 六爻指事 —— 独立页面的交互。由 `scripts/build-zhishi.mjs` 连同内核一起打包进单个 HTML。
 *
 * 只做一件事：起一卦，按七例取出卦辞、爻辞的转述，接成一段话。
 * 不装卦、不断卦、不取用神、不报应期 —— 那些是问事页的事；指事本就不看用神
 * （`liuyao/yaoci.ts`），所以这里连占事都不用选。
 *
 * 起卦、取辞、措辞守卫全用内核的同一份代码，不在这里另写：
 * 同一时刻、同样六次掷钱，这一页与问事页取到的是同样几段话。
 *
 * ## 语言
 *
 * 简体、繁体、英文，外加「繁體＋EN」对照。引文取各自语言的语料原文；
 * 界面文案见 `i18n.ts`（繁体由简体机械转出）。换语言不重新起卦 —— 同一卦换一种文字读。
 */

import { castMomentOf } from "../../packages/core/src/liuyao/moment.js";
import { cast, type CastInput, type CoinThrow } from "../../packages/core/src/liuyao/cast.js";
import { dress, type DressedGua } from "../../packages/core/src/liuyao/dress.js";
import { yaociReading, type YaociPick } from "../../packages/core/src/liuyao/yaoci.js";
import { receivedIndexOf } from "../../packages/core/src/yijing/yaoci.js";
import { zhishiProse, type ZhishiParagraph } from "../../packages/core/src/plain/zhishi.js";
import { loadParams } from "../../packages/core/src/params/load.js";
import { toHant } from "../../packages/core/src/report/hant.js";
import { UI_SOURCE, fill, mapUi, type Ui } from "./i18n.js";

/** 与移动版同一张表（`packages/web/app/m/store.ts`）：时区、经度。名字在 i18n 里，次序一致。 */
const CITIES: readonly (readonly [string, number])[] = [
  ["Asia/Shanghai", 121.47], ["Asia/Shanghai", 116.41], ["Asia/Shanghai", 113.26],
  ["Asia/Shanghai", 114.06], ["Asia/Shanghai", 104.07], ["Asia/Shanghai", 108.95],
  ["Asia/Taipei", 121.56], ["Asia/Hong_Kong", 114.17], ["Asia/Singapore", 103.82],
];

type Lang = "zh-Hans" | "zh-Hant" | "en" | "bi";
type How = "time" | "coin";
type Face = 0 | 1 | null;
type Row = [Face, Face, Face];

const LANG_KEY = "fate.zhishi.lang";

// ── 小工具 ────────────────────────────────────────────────

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls !== undefined) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const store = {
  get(): string | null { try { return localStorage.getItem(LANG_KEY); } catch { return null; } },
  set(v: string): void { try { localStorage.setItem(LANG_KEY, v); } catch { /* 隐私模式等：只是不记住 */ } },
};

// ── 状态 ──────────────────────────────────────────────────

let lang: Lang = "zh-Hant";
let how: How = "time";
let byHand = true;
let rows: Row[] = Array.from({ length: 6 }, () => [null, null, null] as Row);
/** 上一次起的卦 —— 换语言时用它重画，不重新起卦。 */
let last: { gua: DressedGua; how: How; when: string; city: number } | null = null;

const uiCache = new Map<Lang, Ui>();
function ui(l: Lang = lang): Ui {
  const hit = uiCache.get(l);
  if (hit !== undefined) return hit;
  const u = l === "en" ? UI_SOURCE.en
    : l === "zh-Hans" ? UI_SOURCE["zh-Hans"]
      : mapUi(UI_SOURCE["zh-Hans"], toHant);
  uiCache.set(l, u);
  return u;
}
/** 引文用哪一种语料。对照模式以繁体为主。 */
const readLocale = (l: Lang) => (l === "bi" ? "zh-Hant" : l);
const isEn = () => lang === "en";

function defaultLang(): Lang {
  const saved = store.get();
  if (saved === "zh-Hans" || saved === "zh-Hant" || saved === "en" || saved === "bi") return saved;
  const nav = (navigator.language || "").toLowerCase();
  if (/^zh-(tw|hk|mo|hant)/.test(nav)) return "zh-Hant";
  if (nav.startsWith("zh")) return "zh-Hans";
  return "en";
}

const complete = (r: Row): boolean => r.every((f) => f !== null);
const heads = (r: Row): CoinThrow => r.filter((f) => f === 1).length as CoinThrow;

/** 一枚真随机的铜钱 —— 与问事页同一个随机源。 */
function tossOne(): 0 | 1 {
  const b = new Uint8Array(1);
  crypto.getRandomValues(b);
  return (b[0]! & 1) as 0 | 1;
}

/** 输入一变，上一次的结果就不再对应眼前的选择 —— 收起来，免得对着旧卦看新铜钱。 */
function invalidate(): void {
  last = null;
  $("result").hidden = true;
  $("navResult").hidden = true;
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

// ── 界面文案 ──────────────────────────────────────────────

function applyTexts(): void {
  const u = ui();
  document.documentElement.lang = lang === "en" ? "en" : lang === "zh-Hans" ? "zh-Hans" : "zh-Hant";
  document.title = lang === "en" ? `${u.brand} · 六爻指事` : `${u.title} · Six Lines`;
  for (const node of document.querySelectorAll<HTMLElement>("[data-t]")) {
    const v = (u as unknown as Record<string, unknown>)[node.dataset["t"]!];
    if (typeof v === "string") node.textContent = v;
  }
  // 地点：保留所选的那一项
  const sel = $<HTMLSelectElement>("place");
  const keep = sel.value;
  sel.replaceChildren(...u.cities.map((name, i) => new Option(name, String(i))));
  sel.value = keep === "" ? sel.value : keep;
  renderGuide();
  renderCoins();
  syncGo();
  if (last !== null) renderResult(false);
}

function renderGuide(): void {
  const u = ui();
  const body = $("guideBody");
  body.replaceChildren();
  u.guide.forEach((sec, i) => {
    const box = el("div");
    box.append(el("h3", undefined, sec.h));
    for (const p of sec.p) box.append(el("p", undefined, p));
    if (i === 2) {
      // 「读哪几段」一节后面接七例表
      const wrap = el("div", "table-wrap");
      const t = el("table");
      const head = el("tr");
      head.append(el("th", undefined, u.rulesHead[0]), el("th", undefined, u.rulesHead[1]));
      t.append(el("thead"));
      t.tHead!.append(head);
      const tb = el("tbody");
      u.rulesRows.forEach((r, n) => {
        const tr = el("tr");
        tr.append(el("td", undefined, String(n)), el("td", undefined, r));
        tb.append(tr);
      });
      t.append(tb);
      wrap.append(t);
      box.append(wrap, el("p", "small", u.rulesNote));
    }
    body.append(box);
  });
}

// ── 掷铜钱 ────────────────────────────────────────────────

function renderCoins(): void {
  const u = ui();
  const grid = $("coinGrid");
  grid.replaceChildren();
  const done = rows.filter(complete).length;
  for (const i of [5, 4, 3, 2, 1, 0]) {
    const r = rows[i]!;
    const filled = complete(r);
    const isNext = !filled && rows.slice(0, i).every(complete);
    const row = el("div", `coin-row${isNext ? " next" : ""}`);

    const ord = el("span", "ord", u.ordinal[i]);
    if (i === 0) ord.append(el("small", undefined, u.bottom));
    if (i === 5) ord.append(el("small", undefined, u.top));

    const coins = el("span", "coins");
    r.forEach((f, k) => {
      const b = el("button", `coin${f === null ? " blank" : f === 1 ? " head" : " tail"}`);
      if (f !== null) b.append(el("span", undefined, f === 1 ? u.heads : u.tails));
      b.type = "button";
      b.disabled = !byHand;
      b.setAttribute("aria-label", fill(u.coinAria, { ord: u.ordinal[i]!, k: k + 1 })
        + (f === null ? "" : `：${f === 1 ? u.heads : u.tails}`));
      b.addEventListener("click", () => {
        r[k] = f === null ? 1 : f === 1 ? 0 : null;
        invalidate();
        renderCoins();
      });
      coins.append(b);
    });

    const line = el("span", "rowline");
    line.setAttribute("aria-hidden", "true");
    const n = filled ? heads(r) : null;
    if (n === null) line.append(el("i", "pending"));
    // 一正、三正为阳（实线）；两正、三反为阴（断线）
    else if (n === 1 || n === 3) line.append(el("i"));
    else line.append(el("i", "half"), el("i", "half"));

    const mv = el("span", `mv${n === 0 || n === 3 ? " on" : ""}`, n === null ? "" : u.summary[n]);
    row.append(ord, coins, line, mv);
    grid.append(row);
  }

  $("coinCount").textContent = fill(u.count, { n: done });
  const next = $<HTMLButtonElement>("tossNext");
  next.textContent = fill(u.tossNext, { ord: u.ordinal[Math.min(done, 5)]! });
  next.disabled = done === 6;
  $<HTMLButtonElement>("reset").disabled = done === 0;
  next.hidden = byHand;
  $("tossAll").hidden = byHand;
  $("helpSelf").hidden = !byHand;
  $("helpMachine").hidden = byHand;
  for (const b of document.querySelectorAll<HTMLButtonElement>("#hand button")) {
    const on = (b.dataset["hand"] === "1") === byHand;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(on));
  }
  syncGo();
}

function syncGo(): void {
  const u = ui();
  const go = $<HTMLButtonElement>("go");
  const ready = how === "time" || rows.every(complete);
  go.disabled = !ready;
  go.textContent = ready ? u.go : u.goWaiting;
  $("goN").textContent = how === "coin" ? "3" : "2";
}

// ── 起卦 ──────────────────────────────────────────────────

function castNow(): void {
  const city = Number($<HTMLSelectElement>("place").value);
  const [timeZone, longitude] = CITIES[city]!;
  const now = wallNow(timeZone);
  const moment = castMomentOf({ ...now, timeZone, longitude });
  const input: CastInput = how === "time"
    ? { method: "time" }
    : {
      method: "coin",
      throws: rows.map(heads) as [CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow, CoinThrow],
    };
  const params = loadParams({ liuyao: { castMethod: input.method } });
  const gua = dress(cast(moment, input, params.liuyao), params.liuyao);
  const pad = (x: number) => String(x).padStart(2, "0");
  last = {
    gua, how, city,
    when: `${now.year}-${pad(now.month)}-${pad(now.day)} ${pad(now.hour)}:${pad(now.minute)}`,
  };
  renderResult(true);
}

// ── 结果 ──────────────────────────────────────────────────

/** 卦名：简体照原名；繁体转繁；英文给通行本卦序与繁体原名。 */
function guaName(h: DressedGua["ben"]): string {
  if (lang === "zh-Hans") return h.name;
  if (lang === "en") return `No. ${receivedIndexOf(h) + 1} · ${toHant(h.name)}`;
  return toHant(h.name);
}

/** 画一卦。`lines` 自下而上（下标 0 为第一格）。 */
function hexFigure(
  lines: readonly (0 | 1)[], caption: string, name: string,
  opts: { moving?: readonly number[]; picks: readonly YaociPick[] },
): HTMLElement {
  const u = ui();
  const fig = el("figure", "hex");
  const whole = opts.picks.find((p) => p.slot === 0);
  if (whole !== undefined) {
    fig.classList.add("whole");
    fig.append(el("span", "hex-badge", fill(u.guaPicked, { role: u.role[whole.role] })));
  }
  const box = el("div", "hex-lines");
  for (let i = 5; i >= 0; i--) {
    const pos = i + 1;
    const yang = lines[i] === 1;
    const moving = opts.moving?.includes(pos) ?? false;
    const pick = opts.picks.find((p) => p.slot === pos);
    const row = el("div", `hl${pick !== undefined ? " picked" : ""}`);
    row.style.setProperty("--i", String(i));
    row.append(el("span", "mk", moving ? (yang ? "○" : "×") : ""));
    const bar = el("span", "bar");
    bar.append(el("i"));
    if (!yang) bar.append(el("i"));
    row.append(bar, el("span", "tag", pick !== undefined ? u.role[pick.role] : ""));
    box.append(row);
  }
  const cap = el("figcaption");
  cap.append(el("span", "hex-role", caption), el("span", "hex-name", name));
  fig.append(box, cap);
  return fig;
}

function paragraphBlock(p: ZhishiParagraph, en: ZhishiParagraph | undefined): HTMLElement {
  const u = ui();
  const block = el("article", "para");
  const head = el("div", "para-head");
  head.append(el("span", "role", u.role[p.role]));
  head.append(el("span", "src", `${u.from} ${p.source}${p.title === null ? "" : ` · ${p.title}`}`));
  block.append(head, el("p", "text", p.text));
  if (en !== undefined) {
    const t = el("p", "text-en", en.text);
    t.lang = "en";
    const s = el("p", "src-en", `From ${en.source}${en.title === null ? "" : ` · ${en.title}`}`);
    s.lang = "en";
    block.append(t, s);
  }
  return block;
}

function renderResult(scroll: boolean): void {
  if (last === null) return;
  const u = ui();
  const { gua } = last;
  const reading = yaociReading(gua, null, { locale: readLocale(lang), layer: "plain" });
  const prose = zhishiProse(reading);
  const proseEn = lang === "bi" ? zhishiProse(yaociReading(gua, null, { locale: "en", layer: "plain" })) : null;

  const moving = gua.yaos.filter((y) => y.moving).map((y) => y.pos);
  const city = u.cities[last.city] ?? "";
  $("meta").textContent = [
    last.how === "time" ? u.castByTime : u.castByCoin,
    isEn() ? `${last.when} (${city})` : `${last.when}（${city}）`,
    moving.length === 0 ? u.movingNone : fill(u.moving, { list: moving.join(isEn() ? ", " : "、") }),
  ].join(" · ");

  // 卦画
  const fig = $("figure");
  fig.replaceChildren();
  const picksOf = (src: "本卦" | "变卦") => reading.picks.filter((p) => p.source === src);
  fig.append(hexFigure(gua.ben.lines, u.ben, guaName(gua.ben), { moving, picks: picksOf("本卦") }));
  if (gua.bian !== null) {
    fig.append(el("span", "arrow", "→"));
    fig.append(hexFigure(gua.bian.lines, u.bian, guaName(gua.bian), { picks: picksOf("变卦") }));
  } else {
    fig.append(el("p", "nobian", u.noBian));
  }
  fig.classList.remove("animate");
  if (scroll) { void fig.offsetWidth; fig.classList.add("animate"); }

  const legend = $("legend");
  legend.replaceChildren();
  const l1 = el("span"); l1.append(el("b", undefined, "○ ×"), document.createTextNode(u.legendMoving));
  const l2 = el("span"); l2.append(el("b", undefined, u.role.主), document.createTextNode(u.legendPicked));
  legend.append(l1, l2);

  const rule = $("rule");
  rule.replaceChildren(document.createTextNode(prose.rule));
  if (proseEn !== null) {
    const e = el("span", "en", proseEn.rule);
    e.lang = "en";
    rule.append(e);
  }

  const paras = $("paras");
  paras.replaceChildren();
  for (const p of prose.paragraphs) {
    paras.append(paragraphBlock(p, proseEn?.paragraphs.find((x) => x.role === p.role)));
  }
  if (prose.paragraphs.length === 0) paras.append(el("p", "text", fill(u.withheld, { n: prose.withheld })));

  const withheld = prose.withheld + (proseEn?.withheld ?? 0);
  const w = $("withheld");
  w.hidden = withheld === 0 || prose.paragraphs.length === 0;
  w.textContent = fill(u.withheld, { n: withheld });

  $("result").hidden = false;
  $("navResult").hidden = false;
  if (scroll) $("result").scrollIntoView({ block: "start" });
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
  syncGo();
}

function main(): void {
  lang = defaultLang();
  const langSel = $<HTMLSelectElement>("lang");
  langSel.value = lang;
  langSel.addEventListener("change", () => {
    lang = langSel.value as Lang;
    store.set(lang);
    applyTexts();
  });

  // 地点：按设备时区猜一个
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const guess = CITIES.findIndex(([z]) => z === tz);
  const place = $<HTMLSelectElement>("place");
  place.replaceChildren(...ui().cities.map((name, i) => new Option(name, String(i))));
  place.value = String(guess < 0 ? 0 : guess);
  place.addEventListener("change", invalidate);

  for (const b of document.querySelectorAll<HTMLButtonElement>("#how button")) {
    b.addEventListener("click", () => setHow(b.dataset["how"] as How));
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("#hand button")) {
    b.addEventListener("click", () => { byHand = b.dataset["hand"] === "1"; renderCoins(); });
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
  $("go").addEventListener("click", () => {
    try { castNow(); } catch (e) {
      $("result").hidden = false;
      $("paras").replaceChildren(el("p", "text",
        fill(ui().error, { msg: e instanceof Error ? e.message : String(e) })));
    }
  });

  setHow("time");
  applyTexts();
}

main();

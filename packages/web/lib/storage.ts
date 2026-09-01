/**
 * 本地存储 —— 生辰数据默认不出浏览器。
 *
 * 记录存 IndexedDB，标识走 URL **片段**（`#` 之后）。
 * 片段不随请求发往服务器，也不进任何访问日志 —— 这是把
 * 「不上传生辰」从一句承诺变成一个结构事实的关键。
 */

import type { BirthInput, PartialParams } from "@fate/core";

export interface ChartRecord {
  readonly id: string;
  readonly label: string;
  readonly input: BirthInput;
  readonly overrides: PartialParams;
  readonly createdAt: number;
}

const DB = "fate";
const STORE = "charts";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export const putChart = (r: ChartRecord): Promise<IDBValidKey> =>
  tx("readwrite", (s) => s.put(r) as IDBRequest<IDBValidKey>);
export const getChart = (id: string): Promise<ChartRecord | undefined> =>
  tx("readonly", (s) => s.get(id) as IDBRequest<ChartRecord | undefined>);
export const allCharts = (): Promise<ChartRecord[]> =>
  tx("readonly", (s) => s.getAll() as IDBRequest<ChartRecord[]>);
export const deleteChart = (id: string): Promise<undefined> =>
  tx("readwrite", (s) => s.delete(id) as IDBRequest<undefined>);

export function newId(): string {
  return crypto.randomUUID();
}

// ─────────────────────────────────────────────────────────
// 分享：把输入编进片段，而不是存服务端
// ─────────────────────────────────────────────────────────

const b64 = {
  enc: (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s: string) => new TextDecoder().decode(Uint8Array.from(
    atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))),
};

export const encodeShare = (input: BirthInput, overrides: PartialParams): string =>
  `s=${b64.enc(JSON.stringify({ i: input, o: overrides }))}`;

export function decodeShare(frag: string): { input: BirthInput; overrides: PartialParams } | null {
  if (!frag.startsWith("s=")) return null;
  try {
    const o = JSON.parse(b64.dec(frag.slice(2))) as { i: BirthInput; o: PartialParams };
    return { input: o.i, overrides: o.o ?? {} };
  } catch {
    return null;
  }
}

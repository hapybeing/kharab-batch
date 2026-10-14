// Browser read layer: every Arkiv read goes through `run()`, which
//  1. serves from the IndexedDB cache when fresh (no network, no budget),
//  2. otherwise calls the public node (keyless) and, on HTTP 429 or a network error, the explorer's independent shadow RPC,
//  3. records the call in the inspector log and the rolling read-budget window.
// No polling anywhere: reads happen only on a user action or a screen open.
import { RPC, SHADOW } from "../../lib/read.mjs";

// ---- IndexedDB cache (falls back to memory when IndexedDB is unavailable, e.g. private mode) ----
const mem = new Map();
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      const r = indexedDB.open("kharab-batch", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("cache");
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
async function idbGet(k) {
  const d = await db(); if (!d) return mem.get(k);
  return new Promise(res => { const tx = d.transaction("cache").objectStore("cache").get(k); tx.onsuccess = () => res(tx.result); tx.onerror = () => res(undefined); });
}
async function idbSet(k, v) {
  mem.set(k, v);
  const d = await db(); if (!d) return;
  try { d.transaction("cache", "readwrite").objectStore("cache").put(v, k); } catch { }
}

// ---- read budget: the public node allows ~100 keyless reads per IP per ~39 min (measured; arkiv/friction.md) ----
export const BUDGET = 100, WINDOW_MS = 39 * 60e3;
const stamps = () => JSON.parse(localStorage.getItem("kb_reads") || "[]").filter(t => Date.now() - t < WINDOW_MS);
export const budgetUsed = () => stamps().length;
function spend() { const s = stamps(); s.push(Date.now()); localStorage.setItem("kb_reads", JSON.stringify(s)); }

// ---- inspector log ----
export const LOG = [];
const subs = new Set();
export const onLog = fn => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach(f => f());
let checkId = 0, entryId = 0;
const BYID = new Map();
// Count every HTTP request to an Arkiv reader (a paged queryAll is several requests). The reader URL handed to a read carries
// "#<entry id>" so concurrent reads are attributed to the right inspector row; fetch never sends the fragment.
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  const u = typeof input === "string" ? input : input.url;
  if (u.startsWith(RPC) || u.startsWith(SHADOW)) { const id = +(u.split("#")[1] || 0); const e = BYID.get(id); if (e) e.requests++; spend(); }
  return realFetch(input, init);
};
export const newCheck = () => ++checkId;

/**
 * @param {string} id     catalogue id shown in the inspector, e.g. "Q1"
 * @param {string} q      the exact query string (for the inspector)
 * @param {(url:string)=>Promise<any>} fn  the read, given the reader URL
 * @param {{cacheKey?:string, ttl?:number, check?:number}} o
 */
export async function run(id, q, fn, o = {}) {
  const entry = { id, q, check: o.check || 0, at: Date.now(), reader: "", ms: 0, cached: false, requests: 0, n: ++entryId };
  if (o.cacheKey) {
    const c = await idbGet(o.cacheKey);
    if (c && Date.now() - c.t < (o.ttl ?? 10 * 60e3)) { entry.cached = true; entry.reader = "IndexedDB"; LOG.unshift(entry); emit(); return c.v; }
  }
  const t0 = performance.now();
  let v;
  BYID.set(entry.n, entry);
  try { entry.reader = "node RPC"; v = await fn(RPC + "#" + entry.n); }
  catch (e) {
    if (e.code === 429 || /fetch|network/i.test(e.message)) { entry.reader = "explorer shadow RPC (fallback)"; entry.fallback = e.code === 429 ? "429" : "network"; v = await fn(SHADOW + "#" + entry.n); }
    else { entry.error = e.message; LOG.unshift(entry); emit(); throw e; }
  } finally { BYID.delete(entry.n); }
  entry.ms = Math.round(performance.now() - t0);
  LOG.unshift(entry); if (LOG.length > 60) LOG.length = 60; emit();
  if (o.cacheKey) idbSet(o.cacheKey, { t: Date.now(), v });
  return v;
}

// ---- local recents (never leave the phone) ----
export const recents = () => JSON.parse(localStorage.getItem("kb_recent") || "[]");
export function addRecent(b) { const r = [b, ...recents().filter(x => x !== b)].slice(0, 6); localStorage.setItem("kb_recent", JSON.stringify(r)); }

// ---- My list (IndexedDB only; never sent anywhere) ----
export async function getList() { return (await idbGet("watchlist")) || []; }
export async function setList(l) { await idbSet("watchlist", [...new Set(l)]); }

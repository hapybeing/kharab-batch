// Read side of drug-alert/1: raw JSON-RPC only (no SDK), so the same code runs in Node, the browser and
// against the explorer's independent shadow RPC. Exports the query catalogue (Q1…) and the verdict rule.
import { productWords } from "./words.mjs";
import { releaseOf, daysBetween } from "./dates.mjs";
export const RPC = "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
export const SHADOW = "https://tiramisu.explorer.arkiv.network/api/shadow-rpc/experimental";
export const DEAD = "0x000000000000000000000000000000000000dead";

export async function call(method, params, url = RPC) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (r.status === 429) { const e = new Error("read budget exhausted (HTTP 429)"); e.code = 429; e.retryAfter = r.headers.get("retry-after"); throw e; }
  const j = await r.json();
  if (j.error) { const e = new Error(`${method}: ${j.error.code} ${j.error.message}`); e.code = j.error.code; throw e; }
  return j.result;
}

const hexToBig = v => (typeof v === "string" && v.startsWith("0x") ? BigInt(v) : BigInt(v ?? 0));
/** Flatten an RPC entity: typed attributes → plain values (u64/i32 → Number). */
export function flat(e) {
  const a = {};
  for (const at of e.attributes || []) {
    if (at.type === "u64" || at.type === "i32" || at.type === "u256") { const n = hexToBig(at.value); a[at.name] = at.type === "i32" && n > 0x7fffffffn ? Number(n - 0x100000000n) : Number(n); }
    else a[at.name] = at.value;
  }
  return { key: e.key, owner: e.owner?.toLowerCase(), creator: e.creator?.toLowerCase(), expiresAt: e.expiresAt ? Number(hexToBig(e.expiresAt)) : undefined, createdAt: e.createdAt ? Number(hexToBig(e.createdAt)) : undefined, payload: e.payload, a };
}

export const SELECT = { key: true, owner: true, creator: true, expiresAt: true, createdAt: true, attributes: true };

export async function query(q, { url = RPC, select = SELECT, limit = 200, cursor, atBlock } = {}) {
  const opts = { select, limit: "0x" + limit.toString(16) };
  if (cursor) opts.cursor = cursor;
  if (atBlock) opts.atBlock = "0x" + BigInt(atBlock).toString(16);
  const r = await call("arkiv_query", [q, opts], url);
  return { entities: (r.data || []).map(flat), cursor: r.cursor, block: Number(hexToBig(r.blockNumber)) };
}
export async function queryAll(q, o = {}) {
  // A cursor is only valid at the block it was issued for, so every page after the first pins that block.
  const out = []; let cursor, block = o.atBlock;
  do { const r = await query(q, { ...o, cursor, atBlock: block }); out.push(...r.entities); cursor = r.cursor; block = block ?? r.block; } while (cursor);
  return { entities: out, block };
}
export async function count(q, url = RPC) { return Number(await call("arkiv_getEntityCount", [{ query: q }], url)); }

export const normBatch = s => { let b = String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); b = b.replace(/^(BATCHNO|BNO)(?=[A-Z0-9]{3,})/, ""); return b; };
const lit = s => String(s).replace(/'/g, "");

// ---- query catalogue (exact strings; see arkiv/schema.md) ----
export const Q = {
  check: (app, batch) => `app = str('${lit(app)}') AND batch = str('${lit(batch)}')`,                                            // Q1
  didYouMean: (app, prefix) => `app = str('${lit(app)}') AND type = str('alert') AND batch STARTSWITH str('${lit(prefix)}')`,       // Q2
  params: (app, root) => `app = str('${lit(app)}') AND type = str('params') AND $creator = addr(${root})`,                          // Q3
  gaps: (app, watch) => `app = str('${lit(app)}') AND type = str('pending') AND $creator = addr(${watch})`,                          // Q4
  gapsOlder: (app, watch, ymd) => `app = str('${lit(app)}') AND type = str('pending') AND $creator = addr(${watch}) AND since_ymd <= u64(${ymd})`, // Q5
  gapsInDate: (app, watch, ym) => `app = str('${lit(app)}') AND type = str('pending') AND $creator = addr(${watch}) AND exp_ym >= u64(${ym})`,     // Q6b
  links: (app, watch) => `app = str('${lit(app)}') AND type = str('link') AND $creator = addr(${watch})`,                             // Q7
  changes: (app, creators) => `app = str('${lit(app)}') AND type = str('change') AND (${creators.map(c => `$creator = addr(${c})`).join(" OR ")})`, // Q8
  month: (app, cdsco, ym) => `app = str('${lit(app)}') AND type = str('alert') AND $creator = addr(${cdsco}) AND src_ym = u64(${ym})`, // Q9
  bySnapshot: (app, snap) => `app = str('${lit(app)}') AND type = str('alert') AND snap = key(${snap})`,                              // Q10 / Q15
  newSince: (app, block) => `app = str('${lit(app)}') AND type = str('alert') AND $createdAt > u64(${block})`,                       // Q11 (raw only)
  expiring: (app, ym) => `app = str('${lit(app)}') AND type = str('alert') AND exp_ym = u64(${ym})`,                                 // Q12
  byCreator: (app, c) => `app = str('${lit(app)}') AND type = str('alert') AND $creator = addr(${c})`,                              // Q13
  heartbeats: app => `app = str('${lit(app)}') AND type = str('heartbeat')`,                                                       // Q14
  snapshots: app => `app = str('${lit(app)}') AND type = str('snapshot')`,                                                         // Q19 (snapshot health)
};

/**
 * Verdict (SPEC §8.5), a pure function of the Q1 result. `allow` = lowercase creator addresses of publisher mirrors.
 * RED: an allowlisted alert for this exact batch whose printed expiry has not passed (product agreement is confirmed by the user when the products differ).
 * AMBER: exact batch but alerts name different products (user must pick). RECORD: only expired alerts kept alive by extension. GREY: none.
 */
export function verdict(entities, { allow, nowYm, product, batch } = {}) {
  // One alert per row identity: an interrupted mirror run can leave a duplicate sealed alert (see arkiv/friction.md).
  const uniq = new Map(); for (const e of entities) if (e.a.type === "alert") { const k = e.creator + (e.a.rid || e.key); if (!uniq.has(k)) uniq.set(k, e); }
  const all = [...uniq.values()];
  const alerts = all.filter(e => allow.has(e.creator));
  const other = all.filter(e => !allow.has(e.creator));
  if (!alerts.length) return { level: "grey", alerts: [], other };
  const active = alerts.filter(e => !e.a.exp_ok || e.a.exp_ym >= nowYm);
  if (!active.length) return { level: "record", alerts, other };
  // Group alerts whose product names share a distinctive word (same rule as the state↔national matcher).
  const words = active.map(e => new Set(productWords(e.a.pname)));
  const group = active.map((_, i) => i);
  const root = i => (group[i] === i ? i : (group[i] = root(group[i])));
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) if ([...words[i]].some(w => words[j].has(w))) group[root(j)] = root(i);
  const groups = new Set(active.map((_, i) => root(i)));
  // A batch shorter than 4 characters collides too easily across firms: never red without the user naming the product.
  const short = batch != null && String(batch).length < 4;
  if (product) {
    const pw = new Set(productWords(product));
    const agree = active.filter((e, i) => [...words[i]].some(w => pw.has(w)));
    return agree.length ? { level: "red", alerts: agree, other, short } : { level: "amber", alerts: active, other, short };
  }
  if (short) return { level: "amber", alerts: active, other, short, products: [...groups].map(g => active[g].a.pname) };
  return { level: groups.size <= 1 ? "red" : "amber", alerts: active, other, short, products: [...groups].map(g => active[g].a.pname) };
}

/**
 * National lag for a verdict's alerts (pure): days from the earliest dated non-national alert (state list or stop-use notice)
 * to the declared release of the first national list that carries the batch. `national` = lowercase creator of MIRROR_CDSCO.
 * Returns { status: "carried", days, basis, firstYmd, firstSrc, list_ym, releaseYmd } | { status: "absent" } | null (nothing to compare).
 */
export function nationalLag(alerts, national) {
  const nat = alerts.filter(e => e.creator === national).sort((a, b) => a.a.src_ym - b.a.src_ym);
  const others = alerts.filter(e => e.creator !== national && e.a.src_ymd > 0).sort((a, b) => a.a.src_ymd - b.a.src_ymd);
  if (!nat.length) return alerts.length ? { status: "absent" } : null;
  if (!others.length) return { status: "carried", list_ym: nat[0].a.src_ym };
  const rel = releaseOf(nat[0].a.src_ym), first = others[0];
  return { status: "carried", days: daysBetween(first.a.src_ymd, rel.ymd), basis: rel.basis, firstYmd: first.a.src_ymd, firstSrc: first.a.src, list_ym: nat[0].a.src_ym, releaseYmd: rel.ymd, releaseSrc: rel.src };
}

/**
 * Whole-list snapshot health (pure; SPEC §8.2 outage guard applied on the read side). A sealed snapshot can't be edited, so a
 * snapshot written from a short read stays on chain forever; readers must not treat its missing rows as removals.
 * A whole-list snapshot (list_ym = 0) is "partial" when it says so (`scope = 'partial'`) or when its `count` is below half of the
 * largest earlier snapshot of the same source. Partial snapshots are shown flagged and are skipped as diff baselines.
 * Input: flat snapshot entities (any order). Output: Map key → { partial, reason, baseline } where baseline = the full snapshot to diff against.
 */
export function snapshotStatus(snaps) {
  const out = new Map(), bySrc = {};
  for (const s of snaps) (bySrc[s.a.src] ||= []).push(s);
  for (const list of Object.values(bySrc)) {
    list.sort((x, y) => (x.a.fetched || 0) - (y.a.fetched || 0));
    let maxCount = 0, lastFull = null;
    for (const s of list) {
      const whole = !s.a.list_ym;
      let partial = false, reason = "";
      if (s.a.scope === "partial") { partial = true; reason = "marked partial by the mirror"; }
      else if (whole && maxCount && s.a.count < maxCount / 2) { partial = true; reason = `count ${s.a.count} < half of earlier ${maxCount}: short read, not removals`; }
      out.set(s.key, { partial, reason, baseline: partial ? lastFull?.key ?? null : s.key });
      if (!partial) { lastFull = s; if (whole) maxCount = Math.max(maxCount, s.a.count || 0); }
    }
  }
  return out;
}

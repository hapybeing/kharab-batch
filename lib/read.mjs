// Read side of drug-alert/1: raw JSON-RPC only (no SDK), so the same code runs in Node, the browser and
// against the explorer's independent shadow RPC. Exports the query catalogue (Q1…) and the verdict rule.
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
  const out = []; let cursor, block;
  do { const r = await query(q, { ...o, cursor }); out.push(...r.entities); cursor = r.cursor; block = r.block; } while (cursor);
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
};

/**
 * Verdict (SPEC §8.5), a pure function of the Q1 result. `allow` = lowercase creator addresses of publisher mirrors.
 * RED: an allowlisted alert for this exact batch whose printed expiry has not passed (product agreement is confirmed by the user when the products differ).
 * AMBER: exact batch but alerts name different products (user must pick). RECORD: only expired alerts kept alive by extension. GREY: none.
 */
export function verdict(entities, { allow, nowYm, product } = {}) {
  const alerts = entities.filter(e => e.a.type === "alert" && allow.has(e.creator));
  const other = entities.filter(e => e.a.type === "alert" && !allow.has(e.creator));
  if (!alerts.length) return { level: "grey", alerts: [], other };
  const active = alerts.filter(e => !e.a.exp_ok || e.a.exp_ym >= nowYm);
  if (!active.length) return { level: "record", alerts, other };
  const toks = new Set(active.map(e => e.a.ptok));
  if (product) {
    const p = String(product).toLowerCase();
    const agree = active.filter(e => p.includes(e.a.ptok) || String(e.a.pname).toLowerCase().includes(p));
    return agree.length ? { level: "red", alerts: agree, other } : { level: "amber", alerts: active, other };
  }
  return { level: toks.size <= 1 ? "red" : "amber", alerts: active, other, products: [...toks] };
}

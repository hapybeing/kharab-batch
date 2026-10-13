#!/usr/bin/env node
// One mirror run: fetch every publisher, write new sealed alerts (+ a snapshot per source), then the WATCH
// observation round (new gap leases, closed gaps as sealed links, one atomic batch renewing every open lease
// together with WATCH's heartbeat), then each mirror's heartbeat.
//   node mirror/run.mjs [--offline] [--only cdsco,ka,mh,curated] [--no-watch] [--dry]
import fs from "node:fs";
import { fetchCdsco, fetchKspc, fetchMh, parseCdsco, parseKa, parseMh, parseCurated, PUBLISHERS } from "../lib/sources.mjs";
import { indexNational, nationalMatches, releaseOf, daysBetween } from "../lib/match.mjs";
import { alertCreate, alertDeadline, writeSealed, extendMany, loadLedger, saveLedger, lockLedger, APP, A, ExpirationTime, jsonToPayload } from "../lib/writer.mjs";
import { sha256hex, canonical } from "../lib/norm.mjs";
import { assertClean } from "../lib/scrub.mjs";
import { wallets } from "../lib/chain.mjs";
import { queryAll, Q } from "../lib/read.mjs";

const args = process.argv.slice(2);
const flag = f => args.includes(f);
const only = (args.find(a => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const want = s => !only.length || only.includes(s);
const RUN = process.env.GITHUB_RUN_ID ? `gha-${process.env.GITHUB_RUN_ID}` : `host-${new Date().toISOString().slice(0, 16)}`;
const MVER = "mirror/1.0";
const H = 3600_000, now = Date.now();
const today = (() => { const d = new Date(now + 5.5 * H); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); })();
const nowYm = Math.floor(today / 100);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const RAW = new URL("../state/raw/", import.meta.url).pathname;
fs.mkdirSync(RAW, { recursive: true });

function latestRaw(prefix) { const f = fs.readdirSync(RAW).filter(x => x.startsWith(prefix + "-")).sort().pop(); return f ? JSON.parse(fs.readFileSync(RAW + f)) : null; }
async function getRaw(src, fetcher) {
  if (flag("--offline")) return latestRaw(src);
  try { const r = await fetcher(); fs.writeFileSync(`${RAW}${src}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(r)); return r; }
  catch (e) { log(`fetch ${src} failed: ${e.message}; degraded run`); return null; }
}
const live = r => (r.exp_ok ? r.exp_ym >= nowYm : true);

if (!process.argv.includes("--dry")) lockLedger();
const L = loadLedger();
L.entities ||= {}; L.seen ||= {}; L.runs ||= [];
const W = wallets();
const report = { run: RUN, started: new Date(now).toISOString(), sources: {}, watch: {} };

// ---------- 1. fetch + parse ----------
const parsed = {};
if (want("cdsco")) { const r = await getRaw("cdsco", () => fetchCdsco()); if (r) parsed.cdsco = { rows: parseCdsco(r), fetched: r.fetched, raw_sha256: sha256hex(JSON.stringify(r)) }; }
if (want("ka")) { const r = await getRaw("ka", () => fetchKspc(+process.env.KA_PAGES || 4)); if (r) parsed.ka = { rows: parseKa(r), fetched: r.fetched, raw_sha256: sha256hex(canonical(r.page_sha256)), partial: r.rows.length < 800 }; }
if (want("mh")) { const r = await getRaw("mh", () => fetchMh()); if (r) parsed.mh = { rows: parseMh(r), fetched: r.fetched, raw_sha256: sha256hex(canonical(r.page_sha256)) }; }
if (want("curated")) { const list = JSON.parse(fs.readFileSync(new URL("../curated/notices.json", import.meta.url))); parsed.curated = { rows: parseCurated(list), fetched: new Date().toISOString(), raw_sha256: sha256hex(canonical(list)) }; }

// ---------- 2. per-source: snapshot + new sealed alerts ----------
const ROLE = { cdsco: "MIRROR_CDSCO", ka: "MIRROR_KA", mh: "MIRROR_MH", curated: "CURATOR" };
for (const [src, P] of Object.entries(parsed)) {
  const role = ROLE[src];
  const rows = P.rows;
  for (const r of rows) assertClean(r);
  const fresh = rows.filter(r => live(r) && !L.entities["alert|" + r.rid]);
  const expired = rows.filter(r => !live(r)).length;
  const rowsHash = sha256hex(rows.map(r => r.row).sort().join(""));
  const prevSnap = Object.values(L.entities).filter(e => e.type === "snapshot" && e.src === src).sort((a, b) => b.block - a.block)[0];
  report.sources[src] = { rows: rows.length, live: rows.filter(live).length, expired, new: fresh.length };
  // remember which identities the source carries now (for removal detection on the next runs)
  const prevSeen = new Set(L.seen[src]?.rids || []);
  const nowSeen = rows.map(r => r.rid);
  const missing = [...prevSeen].filter(x => !nowSeen.includes(x));
  report.sources[src].missing_since_last = missing.length;
  if (!fresh.length && prevSnap && prevSnap.rows === rowsHash) { log(src, "unchanged"); L.seen[src] = { rids: nowSeen, at: P.fetched }; continue; }
  if (flag("--dry")) { log(src, "would write", fresh.length, "alerts"); continue; }
  // snapshot (sealed) first: the alerts reference it, and its `new` count lets clients check completeness
  const months = {}; for (const r of rows) if (r.list) months[r.list] = (months[r.list] || 0) + 1;
  const snapPayload = { v: 1, src, fetched: P.fetched, source_url: PUBLISHERS[src === "curated" ? "tg" : src]?.source_url, raw_sha256: P.raw_sha256, run: RUN,
    expired_rows: expired, per_list_month: Object.keys(months).length ? months : undefined, row_hashes: rows.map(r => r.row.slice(2, 18)).sort() };
  const snapAttrs = { app: A.str(APP), v: A.u64(1), type: A.str("snapshot"), src: A.str(src), list_ym: A.u64(0), fetched: A.u64(Math.floor(Date.parse(P.fetched) / 1000)),
    count: A.u64(rows.length), new: A.u64(fresh.length), rows: A.bytes32(rowsHash), run: A.str(RUN) };
  if (prevSnap) snapAttrs.prev = A.key(prevSnap.key);
  let snap;
  if (prevSnap && prevSnap.rows === rowsHash) { snap = { key: prevSnap.key }; log(src, "resuming alerts for snapshot", snap.key); }
  else { [snap] = await writeSealed(role, [{ id: `snapshot|${src}|${RUN}`, create: { payload: jsonToPayload(snapPayload), contentType: "application/json", attributes: snapAttrs, expires: ExpirationTime.fromDays(400), flags: { readonly: true, permissionlessExtension: true } } }]);
  L.entities[snap.id] = { type: "snapshot", src, key: snap.key, tx: snap.tx, block: snap.block, rows: rowsHash, new: fresh.length, count: rows.length };
  log(src, "snapshot", snap.key, "new", fresh.length); }
  saveLedger(L);
  // Reconcile with the chain before writing: a run killed between a tx and the ledger save must not re-create rows.
  const onChain = await queryAll(Q.bySnapshot(APP, snap.key), { select: { key: true, attributes: true, creator: true } });
  const known = new Map(onChain.entities.filter(e => e.creator === W[role].toLowerCase()).map(e => [e.a.rid, e]));
  let healed = 0;
  for (const r of fresh) { const e = known.get(r.rid); if (e && !L.entities["alert|" + r.rid]) { L.entities["alert|" + r.rid] = { type: "alert", src: r.src, batch: r.batch, key: e.key, exp_ym: r.exp_ym, src_ymd: r.src_ymd, list: r.list || undefined, ptok: r.ptok, snap: snap.key, healed: true }; healed++; } }
  if (healed) { log(src, "reconciled", healed, "alerts already on chain"); saveLedger(L); }
  const items = fresh.filter(r => !L.entities["alert|" + r.rid]).map(r => ({ id: "alert|" + r.rid, create: alertCreate(r, snap.key, now), meta: r }));
  await writeSealed(role, items, { chunk: +process.env.CHUNK || 40, onChunk: (done, rc) => {
    for (const d of done) L.entities[d.id] = { type: "alert", src: d.meta.src, batch: d.meta.batch, key: d.key, tx: d.tx, block: d.block, exp_ym: d.meta.exp_ym, src_ymd: d.meta.src_ymd, list: d.meta.list || undefined, ptok: d.meta.ptok, snap: snap.key };
    saveLedger(L); log(src, "alerts +", done.length, "gas", rc.gasUsed);
  } });
  L.seen[src] = { rids: nowSeen, at: P.fetched };
  saveLedger(L);
}

// ---------- 3. WATCH observation round ----------
if (!flag("--no-watch") && !flag("--dry") && parsed.cdsco) {
  const national = indexNational(parsed.cdsco.rows);
  const natByRid = new Map(parsed.cdsco.rows.map(r => [r.rid, r]));
  const stateRows = [...(parsed.ka?.rows || []), ...(parsed.mh?.rows || [])].filter(r => live(r) && (r.src === "mh" || r.src_ymd >= 20250101) && L.entities["alert|" + r.rid]);
  const newLinks = [], newPending = [], renew = [];
  for (const s of stateRows) {
    const sa = L.entities["alert|" + s.rid];
    const matches = nationalMatches(s, national).filter(n => L.entities["alert|" + n.rid]).sort((a, b) => a.src_ym - b.src_ym);
    const pend = L.entities["pending|" + s.rid];
    if (matches.length) {
      if (L.entities["link|" + s.rid]) continue;
      const n = matches[0], na = L.entities["alert|" + n.rid];
      const rel = releaseOf(n.src_ym);
      const lag = s.src_ymd ? daysBetween(s.src_ymd, rel.ymd) : 0;
      const witnessed = !!(pend && na.block > pend.block);
      const payload = { v: 1, state: { src: s.src, batch_raw: s.batch_raw, product: s.product, date: s.src_ymd || null }, national: { list: n.list, tab: n.tab, release_ymd: rel.ymd, basis: rel.basis, lab_name: n.lab_name },
        method: "exact batch + shared product word (or hand-judged equivalence in mirror/same_batch.json)", computed_by: "Kharab Batch matcher (WATCH); not a government statement" };
      const attrs = { app: A.str(APP), v: A.u64(1), type: A.str("link"), batch: A.str(s.batch), src: A.str(s.src), sa: A.key(sa.key), na: A.key(na.key),
        lag_d: A.i32(lag), lag_basis: A.str(s.src_ymd ? rel.basis : "undated"), lag_w: A.u64(0), witnessed: A.bool(witnessed) };
      newLinks.push({ id: "link|" + s.rid, create: { payload: jsonToPayload(payload), contentType: "application/json", attributes: attrs, expires: ExpirationTime.atDate(alertDeadline(s, now)), flags: { readonly: true, permissionlessExtension: true } }, meta: { s, lag } });
    } else if (pend) {
      renew.push(pend.key);
    } else {
      const since = s.src_ymd || today;
      const payload = { v: 1, state: { src: s.src, batch_raw: s.batch_raw, product: s.product, date: s.src_ymd || null, first_seen: today }, national_checked: "CDSCO NSQ + spurious tabs, all months 2024–latest",
        caveat: "A state result can be challenged; a central referee lab may later find the batch standard. This records what was published, not which lab is right.", computed_by: "Kharab Batch matcher (WATCH)" };
      const attrs = { app: A.str(APP), v: A.u64(1), type: A.str("pending"), batch: A.str(s.batch), src: A.str(s.src), of: A.key(sa.key), since_ymd: A.u64(since), exp_ym: A.u64(s.exp_ym || 0) };
      newPending.push({ id: "pending|" + s.rid, create: { payload: jsonToPayload(payload), contentType: "application/json", attributes: attrs, expires: ExpirationTime.atDate(new Date(now + 36 * H)), flags: { readonly: true } }, meta: { s, since } });
    }
  }
  report.watch = { state_rows: stateRows.length, new_links: newLinks.length, new_pending: newPending.length, renewed: renew.length };
  log("watch", report.watch);
  if (newLinks.length) await writeSealed("WATCH", newLinks, { chunk: 20, onChunk: done => { for (const d of done) L.entities[d.id] = { type: "link", src: d.meta.s.src, batch: d.meta.s.batch, key: d.key, tx: d.tx, block: d.block, lag_d: d.meta.lag }; saveLedger(L); } });
  if (newPending.length) await writeSealed("WATCH", newPending, { chunk: 20, seal: false, onChunk: done => { for (const d of done) L.entities[d.id] = { type: "pending", src: d.meta.s.src, batch: d.meta.s.batch, key: d.key, tx: d.tx, block: d.block, since_ymd: d.meta.since, observations: 1 }; saveLedger(L); } });
  // heartbeat for WATCH rides in the same batch as the lease renewals: one block = one observation time
  const hbW = L.entities["heartbeat|WATCH"];
  const keys = [...renew, ...(hbW ? [hbW.key] : [])];
  if (keys.length) {
    const txs = await extendMany("WATCH", keys, new Date(now + 36 * H));
    for (const k of renew) { const e = Object.values(L.entities).find(x => x.key === k); if (e) { e.observations = (e.observations || 1) + 1; e.last_obs_block = txs[0].block; } }
    if (hbW) hbW.last_block = txs[txs.length - 1].block;
    report.watch.renew_txs = txs;
    saveLedger(L);
  }
}

// ---------- 4. heartbeats (each mirror wallet) ----------
if (!flag("--dry")) {
  const roles = [...new Set([...Object.keys(parsed).map(s => ROLE[s]), ...(parsed.cdsco && !flag("--no-watch") ? ["WATCH"] : [])])];
  for (const role of roles) {
    const hb = L.entities["heartbeat|" + role];
    const src = Object.entries(ROLE).find(([, r]) => r === role)?.[0] || "watch";
    const degraded = src !== "watch" && !parsed[src];
    if (!hb) {
      const [h] = await writeSealed(role, [{ id: "heartbeat|" + role, create: { payload: jsonToPayload({ v: 1, role, src, mver: MVER, run: RUN }), contentType: "application/json",
        attributes: { app: A.str(APP), v: A.u64(1), type: A.str("heartbeat"), src: A.str(src), mver: A.str(degraded ? MVER + "+degraded" : MVER) }, expires: ExpirationTime.atDate(new Date(now + 30 * H)), flags: { readonly: true } } }], { seal: false });
      L.entities[h.id] = { type: "heartbeat", src, key: h.key, tx: h.tx, block: h.block };
    } else if (role !== "WATCH") {
      const [t] = await extendMany(role, [hb.key], new Date(now + 30 * H)); hb.last_block = t.block;
    }
    saveLedger(L);
  }
}

if (flag("--dry")) { log("dry run: nothing written"); process.exit(0); }
report.finished = new Date().toISOString();
L.runs.push(report); if (L.runs.length > 200) L.runs = L.runs.slice(-200);
saveLedger(L);
fs.mkdirSync(new URL("../evidence/runs/", import.meta.url).pathname, { recursive: true });
fs.writeFileSync(new URL(`../evidence/runs/${report.started.replace(/[:.]/g, "-")}.json`, import.meta.url).pathname, JSON.stringify(report, null, 1) + "\n");
log("done", JSON.stringify(report.sources), JSON.stringify(report.watch));
process.exit(0);

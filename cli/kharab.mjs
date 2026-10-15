#!/usr/bin/env node
// kharab — read the Kharab Batch? ledger straight from Arkiv, without our website.
//   kharab check <batch> [--reader rpc|explorer|both] [--block N]
//   kharab gap [--src ka|mh] [--min-days 60]
//   kharab changes [--month 2026-06]
//   kharab verify <entityKey>          re-fetch the publisher's source and recompute the row hash
//   kharab keep <entityKey> --until YYYY-MM   (needs KEEPER_KEY or PRIVATE_KEY in the environment)
//   kharab snapshots [--src ka]        source snapshots; a short read is flagged PARTIAL (never removals)
//   kharab mirror --src mh|ka [--label NAME] [--dry]   run YOUR OWN mirror: MIRROR_KEY=<funded Tiramisu key> (your wallet, your $creator)
//   kharab agree --src mh [--a 0x…] [--b 0x…]          compare two independent publishers of one source, row by row
import { query, queryAll, count, verdict, nationalLag, snapshotStatus, Q, RPC, SHADOW, normBatch, call } from "../lib/read.mjs";
import { releaseOf } from "../lib/dates.mjs";
import fs from "node:fs";

const W = JSON.parse(fs.readFileSync(new URL("../wallets.json", import.meta.url)));
const APP = process.env.KHARAB_APP || "kharab";
const low = a => a.toLowerCase();
const ALLOW = new Set([W.MIRROR_CDSCO, W.MIRROR_KA, W.MIRROR_MH, W.CURATOR].map(low));
const NAME = { [low(W.MIRROR_CDSCO)]: "CDSCO national list", [low(W.MIRROR_KA)]: "Karnataka DCD (KSPC list)", [low(W.MIRROR_MH)]: "Maharashtra FDA", [low(W.CURATOR)]: "Curated notice (Telangana DCA / WHO)", [low(W.WATCH)]: "Kharab Batch matcher", [low(W.HISTORY)]: "Reconstructed history" };
const [cmd, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf("--" + n); return i >= 0 ? rest[i + 1] : d; };
const nowYm = (() => { const d = new Date(Date.now() + 19800e3); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; })();
const ymdTxt = n => n ? `${String(n).slice(6, 8)}-${String(n).slice(4, 6)}-${String(n).slice(0, 4)}` : "";
const ymTxt = n => n ? `${String(n).slice(0, 4)}-${String(n).slice(4, 6)}` : "?";

async function check(batchIn) {
  const batch = normBatch(batchIn);
  const reader = opt("reader", "rpc"), atBlock = opt("block");
  const urls = reader === "both" ? [RPC, SHADOW] : reader === "explorer" ? [SHADOW] : [RPC];
  const results = [];
  for (const url of urls) results.push(await query(Q.check(APP, batch), { url, atBlock }));
  const r = results[0];
  const v = verdict(r.entities, { allow: ALLOW, nowYm, batch });
  const label = { red: "RED  — failed a government lab test / stop-use notice", amber: "AMBER — same batch number, different products: check which is yours", grey: "GREY — not on any list we mirror. This is NOT a safety guarantee.", record: "RECORD — batch expired; kept as record" }[v.level];
  console.log(`Batch ${batch} · ${label}  (block ${r.block})`);
  for (const e of v.alerts) {
    const a = e.a;
    console.log(`  • ${NAME[e.creator] || e.creator}: ${a.pname} · ${a.class}/${a.test} · ${a.src_ymd ? "dated " + ymdTxt(a.src_ymd) : "list " + ymTxt(a.src_ym)} · exp ${ymTxt(a.exp_ym)}`);
    console.log(`      key ${e.key}  owner ${e.owner === "0x000000000000000000000000000000000000dead" ? "0x…dEaD (sealed)" : e.owner}`);
  }
  const lag = nationalLag(v.alerts, low(W.MIRROR_CDSCO));
  if (lag?.status === "absent") console.log("  ↳ NOT on the national CDSCO portal (no NSQ or spurious row for this batch in any month the mirror reads)");
  if (lag?.status === "carried" && lag.days != null) console.log(`  ↳ national list ${ymTxt(lag.list_ym)} (${lag.basis === "declared" ? "declared" : "released on/after"} ${ymdTxt(lag.releaseYmd)}) carried it ${lag.days} days after the first notice (${lag.firstSrc}, ${ymdTxt(lag.firstYmd)})`);
  if (v.short) console.log("  ⚠ batch shorter than 4 characters: confirm the product on your pack");
  for (const e of r.entities.filter(x => x.a.type === "pending")) console.log(`  ⏳ state finding not on the national list since ${ymdTxt(e.a.since_ymd)} (lease renewed by each observation; expires at block ${e.expiresAt})`);
  for (const e of r.entities.filter(x => x.a.type === "link")) console.log(`  ↳ national list carried it ${e.a.lag_d} days after the state date (${e.a.lag_basis})`);
  for (const e of r.entities.filter(x => x.a.type === "change")) console.log(`  ⚠ change: ${e.a.kind} (${e.a.evid}) in list ${ymTxt(e.a.list_ym)}`);
  if (v.other.length) console.log(`  (${v.other.length} entities by other writers hidden; not in the publisher allowlist)`);
  if (results.length === 2) {
    const sig = x => x.entities.map(e => e.key + JSON.stringify(e.a) + e.creator + e.owner).sort().join("|");
    console.log(sig(results[0]) === sig(results[1]) ? `2/2 readers agree (node RPC block ${results[0].block}, explorer index block ${results[1].block})` : "READERS DISAGREE (one may lag a few blocks; re-run)");
  }
  if (v.alerts.length) console.log("The failure is specific to the batch tested; it does not cover other batches of the product (CDSCO).");
}

async function gap() {
  const src = opt("src"), minDays = +opt("min-days", 0);
  const { entities, block } = await queryAll(Q.gaps(APP, W.WATCH));
  const today = (() => { const d = new Date(Date.now() + 19800e3); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
  const days = n => Math.round((today - Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100)) / 864e5);
  const rows = entities.filter(e => !src || e.a.src === src).map(e => ({ ...e, days: days(e.a.since_ymd) })).filter(e => e.days >= minDays).sort((a, b) => b.days - a.days);
  console.log(`${rows.length} state findings not on the national list (block ${block})`);
  for (const e of rows.slice(0, +opt("limit", 50))) console.log(`  ${e.a.src.toUpperCase()}  ${e.a.batch.padEnd(14)} waiting ${String(e.days).padStart(4)} d  exp ${ymTxt(e.a.exp_ym)}  ${e.key}`);
}

async function changes() {
  const m = opt("month"); const ym = m ? +m.replace("-", "") : 0;
  const { entities } = await queryAll(Q.changes(APP, [W.MIRROR_CDSCO, W.MIRROR_KA, W.MIRROR_MH, W.HISTORY]));
  const rows = entities.filter(e => !ym || e.a.list_ym === ym);
  const by = {}; for (const e of rows) by[e.a.kind] = (by[e.a.kind] || 0) + 1;
  console.log(`${rows.length} changes${ym ? " in list " + m : ""}:`, by);
  for (const e of rows.slice(0, +opt("limit", 40))) console.log(`  ${ymTxt(e.a.list_ym)} ${e.a.kind.padEnd(13)} ${e.a.batch.padEnd(14)} ${e.a.evid}  before ${e.a.before.slice(0, 14)}… after ${e.a.after.slice(0, 14)}…`);
}

async function verify(key) {
  const e = await call("arkiv_getEntity", [key]).catch(() => null);
  const r = await query(`$key = key(${key})`, { select: { key: true, creator: true, attributes: true, payload: true } });
  const ent = r.entities[0]; if (!ent) { console.log("entity not found (expired?) — see the explorer history"); return; }
  const { parseCdsco, parseKa, parseMh, fetchCdsco, fetchKspc, fetchMh } = await import("../lib/sources.mjs");
  const a = ent.a;
  let rows;
  if (a.src === "cdsco") { const y = String(a.src_ym).slice(0, 4); rows = parseCdsco(await fetchCdsco([y], ["nsq", "spurious"])); }
  else if (a.src === "ka") rows = parseKa(await fetchKspc(20));
  else if (a.src === "mh") rows = parseMh(await fetchMh());
  else { console.log("curated notice: compare the payload's pdf_sha256 with the source PDF"); return; }
  const hit = rows.find(x => x.rid === a.rid);
  if (!hit) { console.log(`DIFF: the source no longer carries this row identity (removed or changed)`); return; }
  console.log(hit.row === a.row ? `MATCH: source row hash ${a.row} recomputed from ${hit.source_url}` : `DIFF: source row now hashes to ${hit.row}, entity says ${a.row}`);
}

async function snapshots() {
  const src = opt("src");
  const { entities, block } = await queryAll(Q.snapshots(APP), { select: { key: true, creator: true, attributes: true } });
  const own = entities.filter(e => ALLOW.has(e.creator) && (!src || e.a.src === src));
  const st = snapshotStatus(own);
  console.log(`${own.length} source snapshots (block ${block})`);
  for (const s of own.sort((a, b) => a.a.fetched - b.a.fetched)) {
    const x = st.get(s.key);
    console.log(`  ${s.a.src.padEnd(8)} ${new Date(s.a.fetched * 1000).toISOString().slice(0, 16)}Z  rows ${String(s.a.count).padStart(5)}  new ${String(s.a.new).padStart(5)}  ${x.partial ? "PARTIAL: " + x.reason + " (diff baseline " + (x.baseline || "none").slice(0, 12) + "…)" : "full"}  ${s.key}`);
  }
}

async function keep(key) {
  const until = opt("until"); if (!until) throw new Error("--until YYYY-MM required");
  const { createWalletClient, ExpirationTime } = await import("@arkiv-network/sdk");
  const { tiramisu } = await import("@arkiv-network/sdk/chains");
  const { http } = await import("viem"); const { privateKeyToAccount } = await import("viem/accounts");
  if (process.env.KHARAB_SECRETS) (await import("../lib/chain.mjs")).loadSecrets();   // key file outside the repo
  const pk = process.env.KEEPER_KEY || process.env.PRIVATE_KEY || process.env.KEEPER_DEMO_KEY; if (!pk) throw new Error("set KEEPER_KEY to a funded Tiramisu key");
  const w = createWalletClient({ chain: tiramisu, transport: http(RPC), account: privateKeyToAccount(pk) });
  const [y, m] = until.split("-").map(Number);
  const r = await w.extendEntity({ entityKey: key, expires: ExpirationTime.atDate(new Date(Date.UTC(y, m, 0, 23, 59))) });
  console.log(`kept ${key} until ${until}: tx ${r.txHash}`);
}

// ---- third-party mirror: anyone with a funded key publishes the same source under their own unforgeable $creator ----
async function mirror() {
  const src = opt("src"); if (!["mh", "ka"].includes(src)) throw new Error("--src mh|ka (the two state lists; CDSCO is ~2,500 rows and needs a bigger wallet)");
  const label = (opt("label", "independent mirror") || "").replace(/[^\w .-]/g, "").slice(0, 40);
  if (process.env.KHARAB_SECRETS) (await import("../lib/chain.mjs")).loadSecrets();
  const pk = process.env.MIRROR_KEY; if (!pk && !rest.includes("--dry")) throw new Error("set MIRROR_KEY to your own funded Tiramisu key (faucet: https://hub.arkiv.network/faucet)");
  process.env.THIRDPARTY_KEY = pk || "";
  process.env.KHARAB_JOURNAL ||= new URL("../state/tmp/third-party-journal.jsonl", import.meta.url).pathname;
  fs.mkdirSync(new URL("../state/tmp/", import.meta.url), { recursive: true });
  const S = await import("../lib/sources.mjs"); const Wr = await import("../lib/writer.mjs"); const { sha256hex } = await import("../lib/norm.mjs");
  const { assertClean } = await import("../lib/scrub.mjs");
  const raw = src === "mh" ? await S.fetchMh() : await S.fetchKspc(20);
  const rows = src === "mh" ? S.parseMh(raw) : S.parseKa(raw);
  if (src === "ka" && raw.rows.length < 800) throw new Error(`short KSPC read (${raw.rows.length} rows): refusing to publish a partial snapshot`);
  for (const r of rows) assertClean(r);
  const live = rows.filter(r => (r.exp_ok ? r.exp_ym >= nowYm : true));
  const me = pk ? (await import("viem/accounts")).privateKeyToAccount(pk).address : "0x0000000000000000000000000000000000000000";
  const mine = pk ? (await queryAll(`app = str('${APP}') AND type = str('alert') AND src = str('${src}') AND $creator = addr(${me})`, { select: { key: true, attributes: true } })).entities : [];
  const have = new Set(mine.map(e => e.a.rid));
  const fresh = live.filter(r => !have.has(r.rid));
  console.log(`${src}: ${rows.length} rows fetched from ${S.PUBLISHERS[src].source_url} · ${live.length} in date · ${have.size} already published by ${me} · ${fresh.length} to write`);
  if (rest.includes("--dry") || !fresh.length) { if (!fresh.length) console.log("nothing new"); }
  else {
    const now = Date.now();
    const snapPayload = { v: 1, src, fetched: raw.fetched, source_url: S.PUBLISHERS[src].source_url, raw_sha256: sha256hex(JSON.stringify(raw.page_sha256)), run: "cli-" + new Date(now).toISOString().slice(0, 16), label, row_hashes: rows.map(r => r.row.slice(2, 18)).sort() };
    const rowsHash = sha256hex(rows.map(r => r.row).sort().join(""));
    // resume: a run interrupted after its snapshot reuses that snapshot instead of sealing a duplicate
    const prev = (await queryAll(`app = str('${APP}') AND type = str('snapshot') AND src = str('${src}') AND $creator = addr(${me}) AND rows = bytes32(${rowsHash})`, { select: { key: true } })).entities[0];
    const [snap] = prev ? [{ key: prev.key, tx: "(resumed)" }] : await Wr.writeSealed("THIRDPARTY", [{ id: "snapshot", create: { payload: Wr.jsonToPayload(snapPayload), contentType: "application/json",
      attributes: { app: Wr.A.str(APP), v: Wr.A.u64(1), type: Wr.A.str("snapshot"), src: Wr.A.str(src), list_ym: Wr.A.u64(0), fetched: Wr.A.u64(Math.floor(Date.parse(raw.fetched) / 1000)), count: Wr.A.u64(rows.length), new: Wr.A.u64(fresh.length), rows: Wr.A.bytes32(rowsHash), run: Wr.A.str(snapPayload.run) },
      expires: Wr.ExpirationTime.fromDays(400), flags: { readonly: true, permissionlessExtension: true } } }]);
    console.log(`  snapshot ${snap.key}  tx ${snap.tx}`);
    const out = await Wr.writeSealed("THIRDPARTY", fresh.map(r => ({ id: r.rid, create: Wr.alertCreate(r, snap.key, now) })), { chunk: +process.env.CHUNK || 20, onChunk: d =>  // ≤20 sealed alerts per tx: the RPC caps a tx at ~5.1 M gas (arkiv/friction.md #1)
      console.log(`  +${d.length} sealed alerts  tx ${d[0].tx}`) });
    console.log(`  ${out.length} alerts written, each sealed to 0x…dEaD in its creating batch`);
  }
  if (pk && !rest.includes("--dry")) {
    const hbq = await queryAll(`app = str('${APP}') AND type = str('heartbeat') AND $creator = addr(${me})`, { select: { key: true, attributes: true } });
    const w = (await import("../lib/chain.mjs")).walletFor("THIRDPARTY");
    const deadline = new Date(Date.now() + 30 * 3600e3);
    if (hbq.entities[0]) { const r = await w.extendEntity({ entityKey: hbq.entities[0].key, expires: Wr.ExpirationTime.atDate(deadline) }); console.log(`  heartbeat renewed ${hbq.entities[0].key}  tx ${r.txHash}`); }
    else { const [h] = await Wr.writeSealed("THIRDPARTY", [{ id: "heartbeat", create: { payload: Wr.jsonToPayload({ v: 1, role: "third-party", label, src, mver: "kharab-cli/0.1" }), contentType: "application/json",
      attributes: { app: Wr.A.str(APP), v: Wr.A.u64(1), type: Wr.A.str("heartbeat"), src: Wr.A.str(src), mver: Wr.A.str("kharab-cli/0.1 third-party"), label: Wr.A.str(label) }, expires: Wr.ExpirationTime.atDate(deadline), flags: { readonly: true } } }], { seal: false });
      console.log(`  heartbeat ${h.key}  tx ${h.tx}`); }
    console.log(`Done. Compare with the operator's mirror:  kharab agree --src ${src} --b ${me}`);
  }
}

// ---- agreement between two publishers of the same source: same row identity (rid) → same row hash? ----
async function agree() {
  const src = opt("src", "mh");
  const a = opt("a", W[{ mh: "MIRROR_MH", ka: "MIRROR_KA", cdsco: "MIRROR_CDSCO" }[src]]); let b = opt("b");
  if (!b) { // find other creators that published this source and announce themselves with a heartbeat
    const hb = (await queryAll(`app = str('${APP}') AND type = str('heartbeat') AND src = str('${src}')`, { select: { key: true, creator: true, attributes: true } })).entities;
    b = hb.map(e => e.creator).find(c => c !== low(a) && !Object.values(W).map(low).includes(c)); if (!b) throw new Error("no independent publisher of " + src + " found; pass --b 0x…");
  }
  const get = async c => (await queryAll(`app = str('${APP}') AND type = str('alert') AND src = str('${src}') AND $creator = addr(${c})`, { select: { key: true, creator: true, owner: true, attributes: true } }));
  const [A_, B_] = [await get(a), await get(b)];
  const mapA = new Map(A_.entities.map(e => [e.a.rid, e])), mapB = new Map(B_.entities.map(e => [e.a.rid, e]));
  let same = 0; const diff = [], onlyB = [];
  for (const [rid, e] of mapB) { const x = mapA.get(rid); if (!x) onlyB.push(e); else if (x.a.row === e.a.row && x.a.batch === e.a.batch && x.a.exp_ym === e.a.exp_ym) same++; else diff.push([x, e]); }
  const onlyA = [...mapA.keys()].filter(r => !mapB.has(r));
  const sealedB = B_.entities.filter(e => e.owner === DEAD_).length;
  console.log(`Source ${src.toUpperCase()} · publisher A ${a} (${NAME[low(a)] || "?"}) ${mapA.size} alerts · publisher B ${b} ${mapB.size} alerts (${sealedB} sealed)  (blocks ${A_.block}/${B_.block})`);
  console.log(`  ${same}/${mapB.size} of B's rows: same row identity and same row hash as A  → AGREE`);
  console.log(`  ${diff.length} same identity, different content${diff.length ? ": " + diff.slice(0, 5).map(([x]) => x.a.batch).join(", ") : ""}`);
  console.log(`  ${onlyB.length} only in B${onlyB.length ? ": " + onlyB.slice(0, 8).map(e => e.a.batch).join(", ") : ""}`);
  console.log(`  ${onlyA.length} only in A (e.g. rows A sealed earlier whose printed expiry has since passed, so a fresh mirror skips them)`);
  console.log("Apps should SHOW agreement, never merge: each claim keeps its own $creator.");
}
const DEAD_ = "0x000000000000000000000000000000000000dead";

const cmds = { check: () => check(rest[0]), gap, changes, verify: () => verify(rest[0]), keep: () => keep(rest[0]), snapshots, mirror, agree };
if (!cmds[cmd]) { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 12).map(l => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(cmd ? 1 : 0); }
cmds[cmd]().then(() => process.exit(0), e => { console.error(e.message); process.exit(1); });

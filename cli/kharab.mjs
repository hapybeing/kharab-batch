#!/usr/bin/env node
// kharab — read the Kharab Batch? ledger straight from Arkiv, without our website.
//   kharab check <batch> [--reader rpc|explorer|both] [--block N]
//   kharab gap [--src ka|mh] [--min-days 60]
//   kharab changes [--month 2026-06]
//   kharab verify <entityKey>          re-fetch the publisher's source and recompute the row hash
//   kharab keep <entityKey> --until YYYY-MM   (needs KEEPER_KEY or PRIVATE_KEY in the environment)
//   kharab snapshots [--src ka]        source snapshots; a short read is flagged PARTIAL (never removals)
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
  const pk = process.env.KEEPER_KEY || process.env.PRIVATE_KEY; if (!pk) throw new Error("set KEEPER_KEY to a funded Tiramisu key");
  const w = createWalletClient({ chain: tiramisu, transport: http(RPC), account: privateKeyToAccount(pk) });
  const [y, m] = until.split("-").map(Number);
  const r = await w.extendEntity({ entityKey: key, expires: ExpirationTime.atDate(new Date(Date.UTC(y, m, 0, 23, 59))) });
  console.log(`kept ${key} until ${until}: tx ${r.txHash}`);
}

const cmds = { check: () => check(rest[0]), gap, changes, verify: () => verify(rest[0]), keep: () => keep(rest[0]), snapshots };
if (!cmds[cmd]) { console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 10).map(l => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(cmd ? 1 : 0); }
cmds[cmd]().then(() => process.exit(0), e => { console.error(e.message); process.exit(1); });

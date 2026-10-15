// Writes drug-alert/1 entities. Every record type (alert, snapshot, change, link) is created readonly +
// permissionlessExtension and sealed to 0x…dEaD in the SAME batch (predictEntityKeys + changeOwnership).
// Leases (pending, heartbeat) are readonly and stay with their owner so only the owner can renew them.
import fs from "node:fs";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk";
import { str, u64, i32, bool, key, bytes32 } from "@arkiv-network/sdk/attr";
import { publicClient, walletFor, DEAD, rpc } from "./chain.mjs";
import { monthEnd } from "./norm.mjs";
import { assertClean } from "./scrub.mjs";

export const APP = process.env.KHARAB_APP || "kharab";
const DAY = 86400_000;
const LEDGER = process.env.KHARAB_LEDGER || new URL("../state/ledger.json", import.meta.url).pathname;
const JOURNAL = process.env.KHARAB_JOURNAL || new URL("../state/journal.jsonl", import.meta.url).pathname;

/** Single-writer lock on the ledger (mirror runs, history and params scripts must not overlap). Stale after 2 h. */
export function lockLedger() {
  const f = LEDGER + ".lock";
  try { const st = fs.statSync(f); if (Date.now() - st.mtimeMs > 2 * 3600_000) fs.unlinkSync(f); } catch { }
  try { fs.writeFileSync(f, String(process.pid), { flag: "wx" }); } catch { throw new Error(`ledger is locked by another writer (${f})`); }
  const release = () => { try { fs.unlinkSync(f); } catch { } };
  process.on("exit", release);
  return release;
}
export function loadLedger() { try { return JSON.parse(fs.readFileSync(LEDGER, "utf8")); } catch { return { app: APP, entities: {} }; } }
export function saveLedger(l) { fs.mkdirSync(new URL("../state/", import.meta.url).pathname, { recursive: true }); fs.writeFileSync(LEDGER, JSON.stringify(l, null, 1) + "\n"); }
function journal(o) { fs.appendFileSync(JOURNAL, JSON.stringify({ t: new Date().toISOString(), app: APP, ...o }) + "\n"); }

/** Alert lifetime: printed expiry month end + 30 days; unparseable expiry → source date + 36 months (flagged by exp_ok=false). */
export function alertDeadline(row, now = Date.now()) {
  if (row.exp_ok) return new Date(monthEnd(row.exp_ym).getTime() + 30 * DAY);
  const base = row.src_ym ? monthEnd(row.src_ym) : new Date(now);
  return new Date(base.getTime() + 36 * 30.44 * DAY);
}

export function alertPayload(row) {
  const p = { v: 1, product: row.product, batch_raw: row.batch_raw, mfg: row.mfg, exp: row.exp, result: row.result, remarks: row.remarks || undefined,
    firm_reply: row.firm_reply || undefined, lab_name: row.lab_name, list: row.list || undefined, nsq_date: row.nsq_date || undefined, mfr_label: row.mfr_label,
    source_url: row.source_url, report_url: row.report_url, source_note: row.source_note, pdf_sha256: row.pdf_sha256, doc: row.doc, tab: row.tab };
  for (const k of Object.keys(p)) if (p[k] === undefined || p[k] === "") delete p[k];
  return p;
}

export function alertCreate(row, snapKey, now = Date.now()) {
  const payload = alertPayload(row);
  assertClean(payload); assertClean({ pname: row.pname, lab_name: row.lab_name });
  const attributes = {
    app: str(APP), v: u64(1), type: str("alert"), batch: str(row.batch), src: str(row.src), ptok: str(row.ptok || "-"), pname: str(row.pname || "-"),
    exp_ym: u64(row.exp_ym || 0), exp_ok: bool(!!row.exp_ok), src_ym: u64(row.src_ym || 0), src_ymd: u64(row.src_ymd || 0),
    class: str(row.class), test: str(row.test), lab: str(row.lab), rstate: str(row.rstate), row: bytes32(row.row), rid: bytes32(row.rid),
  };
  if (snapKey) attributes.snap = key(snapKey);
  return { payload: jsonToPayload(payload), contentType: "application/json", attributes, expires: ExpirationTime.atDate(alertDeadline(row, now)), flags: { readonly: true, permissionlessExtension: true } };
}

/**
 * Create sealed records in batches. `items` = [{create, id, meta}], all signed by `role`.
 * Returns [{id, key, tx}]. Each chunk is one atomic tx: N creates + N ownership transfers to 0x…dEaD.
 */
export async function writeSealed(role, items, { chunk = 40, seal = true, onChunk } = {}) {
  const w = walletFor(role), pub = publicClient(), out = [];
  for (let i = 0; i < items.length; i += chunk) {
    const part = items.slice(i, i + chunk);
    const preds = await pub.predictEntityKeys({ owner: w.account.address, count: part.length });
    const creates = part.map((it, j) => ({ ...it.create, salt: preds[j].salt }));
    let res, rc;
    try {
      res = await w.executeBatch(seal ? { creates, ownershipChanges: preds.map(p => ({ entityKey: p.key, newOwner: DEAD })) } : { creates });
      rc = await pub.waitForTransactionReceipt({ hash: res.txHash, timeout: 120_000 });
    } catch (e) {
      journal({ role, op: "batch-error", ids: part.map(p => p.id), err: String(e.shortMessage || e.message).slice(0, 300) });
      throw e;
    }
    if (rc.status !== "success") throw new Error(`batch reverted ${res.txHash}`);
    const keys = res.createdEntities;
    if (seal && !keys.every((k, j) => k === preds[j].key)) throw new Error(`predicted keys mismatch in ${res.txHash}`);
    part.forEach((it, j) => out.push({ id: it.id, key: keys[j], tx: res.txHash, block: Number(rc.blockNumber), meta: it.meta }));
    journal({ role, op: seal ? "create+seal" : "create", tx: res.txHash, block: Number(rc.blockNumber), gas: Number(rc.gasUsed), n: part.length });
    onChunk?.(out.slice(-part.length), rc);
  }
  return out;
}

/** Owner-only lease renewal for many keys in one atomic batch (one block = one observation time). */
export async function extendMany(role, keys, deadline, { chunk = 400 } = {}) {
  const w = walletFor(role), pub = publicClient(), txs = [];
  for (let i = 0; i < keys.length; i += chunk) {
    const part = keys.slice(i, i + chunk);
    const res = await w.executeBatch({ extensions: part.map(k => ({ entityKey: k, expires: ExpirationTime.atDate(deadline) })) });
    const rc = await pub.waitForTransactionReceipt({ hash: res.txHash, timeout: 120_000 });
    journal({ role, op: "extend", tx: res.txHash, block: Number(rc.blockNumber), gas: Number(rc.gasUsed), n: part.length });
    txs.push({ tx: res.txHash, block: Number(rc.blockNumber), n: part.length, gas: Number(rc.gasUsed) });
  }
  return txs;
}

export const A = { str, u64, i32, bool, key, bytes32 };
export { ExpirationTime, jsonToPayload, rpc };

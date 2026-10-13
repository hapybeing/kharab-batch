#!/usr/bin/env node
// HISTORY: reconstructed, pre-ledger changes to CDSCO's monthly lists (SPEC §1.4), written once under the HISTORY
// creator with evid='reconstructed'. Source: at-release PDFs archived by a trade site (The Health Master),
// diffed row by row against our 13 Oct 2026 portal snapshot (scripts/evidence/diff_hm.py, hm_diff.json).
// Each change carries the sha256 of the archived PDF (before) and the row hash of the portal row now (after).
import fs from "node:fs";
import { parseCdsco } from "../lib/sources.mjs";
import { writeSealed, loadLedger, saveLedger, lockLedger, APP, A, ExpirationTime, jsonToPayload } from "../lib/writer.mjs";
import { sha256hex, normBatch, ym } from "../lib/norm.mjs";

const HM = JSON.parse(fs.readFileSync(new URL("../evidence/history/hm_diff.json", import.meta.url)));
const PDF = JSON.parse(fs.readFileSync(new URL("../evidence/history/pdf_sha256.json", import.meta.url)));
const RAW = new URL("../state/raw/", import.meta.url).pathname;
const raw = JSON.parse(fs.readFileSync(RAW + fs.readdirSync(RAW).filter(f => f.startsWith("cdsco-")).sort().pop()));
const rows = parseCdsco(raw);
if (!process.argv.includes("--dry")) lockLedger();
const L = loadLedger();
const ZERO = "0x" + "00".repeat(32);
const MONTH = { "Nov-2025": "November-2025", "Dec-2025": "December-2025", "Feb-2026": "February-2026", "Mar-2026": "March-2026", "Apr-2026": "April-2026", "May-2026": "May-2026", "Jun-2026": "June-2026" };
const pdfUrl = (mon, part) => { const [m, y] = MONTH[mon].split("-"); const up = { November: "2025/12", December: "2026/01", February: "2026/03", March: "2026/04", April: "2026/05", May: "2026/06", June: "2026/07" }[m]; return `https://thehealthmaster.com/wp-content/uploads/${up}/Drug-Alert-${m}-${y}-${part}.pdf`; };

function findRow(list, batch, tab) {
  const b = normBatch(batch);
  return rows.find(r => r.list === list && r.batch === b && (!tab || r.tab === tab)) || rows.find(r => r.batch === b && (!tab || r.tab === tab));
}

const items = [];
const push = (kind, mon, part, batch, extra = {}) => {
  const tab = kind === "reclassified" ? "spurious" : "nsq";
  const r = kind === "removed" ? null : findRow(mon, batch, tab);
  const alert = r && L.entities["alert|" + r.rid];
  const before = "0x" + PDF[`Drug-Alert-${MONTH[mon]}-${part}.pdf`];
  const after = r ? r.row : sha256hex("absent:" + mon + ":" + normBatch(batch));
  const payload = { v: 1, kind, list: mon, part, batch_raw: batch, evid: "reconstructed",
    before: { what: `CDSCO ${mon} ${part} list as released (archived copy)`, url: pdfUrl(mon, part), sha256: before },
    after: r ? { what: "CDSCO portal row on 13 Oct 2026", tab: r.tab, list: r.list, product: r.product, lab_name: r.lab_name, mfr_label: r.mfr_label, firm_reply: r.firm_reply || undefined, row: r.row } : { what: "no row for this batch in any month or tab of the CDSCO portal on 13 Oct 2026" },
    note: extra.note };
  const attrs = { app: A.str(APP), v: A.u64(1), type: A.str("change"), batch: A.str(normBatch(batch)), src: A.str("cdsco"), kind: A.str(kind),
    of: A.key(alert ? alert.key : ZERO), list_ym: A.u64(ym(mon)), seen_ymd: A.u64(20261013), before: A.bytes32(before), after: A.bytes32(after), evid: A.str("reconstructed") };
  items.push({ id: `change|hist|${kind}|${mon}|${part}|${normBatch(batch)}`, create: { payload: jsonToPayload(payload), contentType: "application/json", attributes: attrs, expires: ExpirationTime.fromDays(400), flags: { readonly: true, permissionlessExtension: true } }, meta: { kind, mon, batch: normBatch(batch) } });
};

for (const [mon, part, , , , added] of HM) for (const [batch] of added) push("added_late", mon, part, batch);
for (const b of ["FND072001BH", "FND0725001BH", "13240334A"]) push("reclassified", "Dec-2025", "CDSCO", b, { note: "Row left the NSQ list and now sits in the spurious tab; the named manufacturer became 'Under Investigation'." });
push("reclassified", "Apr-2026", "States", "B95Y032", { note: "Row left the state NSQ list and now sits in the spurious tab." });
for (const b of ["825D167", "TC2439"]) push("reclassified", "May-2026", "CDSCO", b, { note: "Row moved to the spurious tab; firm reply: not manufactured by them." });
for (const b of ["LV113A", "LV130C", "LV082B"]) push("removed", "Dec-2025", "States", b, { note: "Kerala (RDTL Ernakulam) rows in the released list; absent from every month and tab on 13 Oct 2026." });

const todo = items.filter(i => !L.entities[i.id]);
console.log("history changes", items.length, "to write", todo.length, Object.entries(items.reduce((a, i) => (a[i.meta.kind] = (a[i.meta.kind] || 0) + 1, a), {})));
if (process.argv.includes("--dry")) process.exit(0);
await writeSealed("HISTORY", todo, { chunk: 20, onChunk: done => { for (const d of done) L.entities[d.id] = { type: "change", src: "cdsco", kind: d.meta.kind, list: d.meta.mon, batch: d.meta.batch, key: d.key, tx: d.tx, block: d.block, evid: "reconstructed" }; saveLedger(L); console.log("+", done.length); } });
process.exit(0);

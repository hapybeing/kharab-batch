// ROOT publishes the registry: which wallets are publisher mirrors, and the sha256 of the format spec.
// Readers find it with Q3 (type='params' AND $creator = ROOT). A new version is a new entity; ROOT renews it.
import fs from "node:fs";
import { writeSealed, loadLedger, saveLedger, lockLedger, APP, A, ExpirationTime, jsonToPayload } from "../lib/writer.mjs";
import { sha256hex } from "../lib/norm.mjs";
import { PUBLISHERS } from "../lib/sources.mjs";
import { wallets } from "../lib/chain.mjs";
lockLedger();
const W = wallets(), L = loadLedger();
const spec = fs.readFileSync(new URL("../arkiv/drug-alert-1.md", import.meta.url), "utf8");
const schema = sha256hex(spec);
const id = "params|" + schema;
if (L.entities[id]) { console.log("params already published", L.entities[id].key); process.exit(0); }
const pub = (src, creator, name_en, name_hi) => ({ src, creator, name_en, name_hi, source_url: PUBLISHERS[src]?.source_url });
const payload = { v: 1, format: "drug-alert/1", normaliser: "v1",
  publishers: [pub("cdsco", W.MIRROR_CDSCO, "CDSCO national NSQ/spurious list", "सीडीएससीओ राष्ट्रीय सूची"), pub("ka", W.MIRROR_KA, "Karnataka Drugs Control (KSPC NSQ list)", "कर्नाटक औषधि नियंत्रण"),
    pub("mh", W.MIRROR_MH, "Maharashtra FDA NSQ alerts", "महाराष्ट्र एफडीए"), { src: "tg|who|tn-dc", creator: W.CURATOR, name_en: "Curated notices (PDF sha256 in each)", name_hi: "चुनी हुई सूचनाएँ" }],
  computed: [{ role: "matcher", creator: W.WATCH, note: "pending/link entities are computed by Kharab Batch, not published by any government" }, { role: "history", creator: W.HISTORY, note: "changes reconstructed from archived at-release PDFs" }],
  caveats: { grey: "Not on any list we mirror is NOT a safety guarantee.", challenge: "A state result can be challenged; a referee lab may later find a batch standard." } };
const [p] = await writeSealed("ROOT", [{ id, create: { payload: jsonToPayload(payload), contentType: "application/json",
  attributes: { app: A.str(APP), v: A.u64(1), type: A.str("params"), schema: A.bytes32(schema) }, expires: ExpirationTime.fromDays(400), flags: { readonly: true } } }], { seal: false });
L.entities[id] = { type: "params", key: p.key, tx: p.tx, block: p.block, schema };
saveLedger(L);
console.log("params", p.key, p.tx, "schema", schema);

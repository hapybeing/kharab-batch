// Fetch every mirrored publisher now; writes state/raw/<src>-<ts>.json (scrubbed parse inputs only; KSPC sender column is never read).
import fs from "node:fs";
import { fetchCdsco, fetchKspc, fetchMh } from "../lib/sources.mjs";
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const which = process.argv.slice(2);
const want = s => !which.length || which.includes(s);
fs.mkdirSync("state/raw", { recursive: true });
if (want("ka")) { const k = await fetchKspc(+process.env.KA_PAGES || 20); fs.writeFileSync(`state/raw/ka-${ts}.json`, JSON.stringify(k)); console.log("ka", k.rows.length); }
if (want("mh")) { const m = await fetchMh(); fs.writeFileSync(`state/raw/mh-${ts}.json`, JSON.stringify(m)); console.log("mh", m.rows.length); }
if (want("cdsco")) { const c = await fetchCdsco(); fs.writeFileSync(`state/raw/cdsco-${ts}.json`, JSON.stringify(c)); console.log("cdsco", Object.entries(c.tabs).map(([t, m]) => t + ":" + Object.values(m).reduce((a, r) => a + r.length, 0)).join(" ")); }

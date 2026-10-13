// Personal-data audit over the latest raw snapshots: every string the writer would put on chain is scanned for
// name-like patterns (initials + capitalised word, "Dr./Shri/Smt", "Inspector <Name>"). Prints suspicious values
// so a human (or Hark) can extend lib/scrub.mjs. Exit 1 if anything suspicious remains.
import fs from "node:fs";
import { parseCdsco, parseKa, parseMh } from "../lib/sources.mjs";
import { alertPayload } from "../lib/writer.mjs";
const RAW = new URL("../state/raw/", import.meta.url).pathname;
const latest = p => { const f = fs.readdirSync(RAW).filter(x => x.startsWith(p + "-")).sort().pop(); return JSON.parse(fs.readFileSync(RAW + f)); };
const rows = [...parseCdsco(latest("cdsco")), ...parseKa(latest("ka")), ...parseMh(latest("mh"))];
const SUS = [/\b(?:Dr|Shri|Smt|Sh|Mr|Mrs|Ms|Kum)\.?\s+[A-Z][a-z]+/, /^\s*(?:[A-Z][.,]\s?){1,3}\s*[A-Z][a-z]{2,}\b(?!.*\b(?:Ltd|Pvt|Pharma|Labs?|Laborator))/, /\bInspector\s+[A-Z][a-z]+/, /\bD\.?I\.?\s*[-:,]\s*[A-Z][a-z]+/];
const FIELDS = ["lab_name", "remarks", "result", "firm_reply", "source_note", "pname"];
// Reviewed by hand: product names and an office, not people.
const REVIEWED = [/^P\.D\. Col\b/, /^I\.V\. Cannula/, /^Dr\. Wash\b/, /^Drugs Inspector Telangana$/];
const hits = new Map();
for (const r of rows) { const p = { ...alertPayload(r), pname: r.pname };
  for (const f of FIELDS) { const v = p[f]; if (typeof v === "string" && !v.startsWith("(officer name removed)") && SUS.some(re => re.test(v)) && !REVIEWED.some(re => re.test(v))) hits.set(f + " | " + v, (hits.get(f + " | " + v) || 0) + 1); } }
console.log(`rows ${rows.length}, suspicious distinct values ${hits.size}`);
for (const [k, n] of [...hits].sort((a, b) => b[1] - a[1]).slice(0, 80)) console.log(n, k.slice(0, 160));
process.exit(hits.size ? 1 : 0);

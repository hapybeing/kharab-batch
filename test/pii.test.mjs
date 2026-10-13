import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { scrubLab, assertClean, OFFICER_REMOVED } from "../lib/scrub.mjs";
import { parseKspcPage, parseCurated } from "../lib/sources.mjs";
const labs = JSON.parse(fs.readFileSync(new URL("./fixtures/officer_labs.json", import.meta.url)));
test("every known officer-name lab field is scrubbed", () => {
  for (const l of labs) { const s = scrubLab(l); assert.ok(s.startsWith(OFFICER_REMOVED), l); assert.throws(() => assertClean({ lab_name: l })); assert.doesNotThrow(() => assertClean({ lab_name: s })); }
});
test("lab names without people are untouched", () => {
  for (const l of ["CDL, Kolkata", "C.D.L. Kolkata", "Drugs Testing Laboratory, Chennai-06", "FDAL, Mumbai", "CDSCO, East Zone, Kolkata", "RDTL, Chandigarh", "Drugs Inspector Telangana"]) assert.equal(scrubLab(l), l);
});
test("phone/e-mail gate, with batch exemption", () => {
  assert.throws(() => assertClean({ remarks: "call 9876543210" })); assert.throws(() => assertClean({ result: "write to a@b.in" }));
  assert.doesNotThrow(() => assertClean({ batch: "9876543210", batch_raw: "9876543210" }));
});
test("KSPC parser never reads the Sender Name column", () => {
  const html = `<table id="equ-table"><tbody><tr class="tbl_detail"><td>1</td><td><strong>12-Oct-2026</strong></td><td><b>KL25817</b></td><td>Polyfate O Suspension</td><td>M/s KINGSTON AQUA <br> BADDI</td><td>Asha Synthetic <br> Tumkur Circle-ADC1</td><td>12-2025</td><td>11-2027</td><td>HUB</td></tr></tbody></table>`;
  const rows = parseKspcPage(html);
  assert.equal(rows.length, 1); assert.equal(rows[0].batch, "KL25817"); assert.equal(rows[0].lab, "HUB");
  assert.ok(!JSON.stringify(rows).includes("Asha Synthetic"));
});
test("curated notices are clean", () => {
  const n = parseCurated(JSON.parse(fs.readFileSync(new URL("../curated/notices.json", import.meta.url))));
  assert.equal(n.length, 7); for (const r of n) assertClean(r);
});

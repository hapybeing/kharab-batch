import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs";
import { STR } from "../web/src/i18n.js";
test("en and hi have exactly the same keys", () => assert.deepEqual(Object.keys(STR.hi).sort(), Object.keys(STR.en).sort()));
test("every T('key') literal used by the app exists in en", () => {
  const src = fs.readFileSync(new URL("../web/src/main.jsx", import.meta.url), "utf8");
  const keys = [...src.matchAll(/\bT\("([a-z_0-9-]+)"/g)].map(m => m[1]);
  for (const k of keys.filter(k => !k.endsWith("_"))) assert.ok(k in STR.en, "missing key " + k);
});
test("placeholders match between languages", () => { for (const k in STR.en) assert.deepEqual((STR.hi[k].match(/\{\w+\}/g) || []).sort(), (STR.en[k].match(/\{\w+\}/g) || []).sort(), k); });
test("vocabulary rule: never 'TTL'", () => { for (const l in STR) for (const k in STR[l]) assert.ok(!/\bTTL\b/.test(STR[l][k]), k); });
test("kn (partial, machine-translated) only uses known keys with matching placeholders", () => {
  for (const k in STR.kn) { if (k === "mt_note") continue; assert.ok(k in STR.en, "unknown kn key " + k); assert.deepEqual((STR.kn[k].match(/\{\w+\}/g) || []).sort(), (STR.en[k].match(/\{\w+\}/g) || []).sort(), k); }
  assert.ok(/machine-translated/.test(STR.kn.mt_note));
});

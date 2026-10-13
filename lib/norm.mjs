// drug-alert/1 normaliser: batch numbers, product tokens, dates, row identity and row hash.
// Pure functions, shared by the mirror, the CLI and the web app.
import { createHash } from "node:crypto";
import { STOP, productWords, productsAgree } from "./words.mjs";
export { STOP, productWords, productsAgree };

export const NORMALISER = "v1";

const EMPTY = new Set(["", "NA", "NIL", "NOTMENTIONED", "NOTAVAILABLE", "NOTGIVEN", "UNKNOWN"]);

/** Normalise one batch string: uppercase, keep A–Z0–9, drop a leading "BNO"/"BATCHNO". */
export function normBatch(s) {
  let b = String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  b = b.replace(/^(BATCHNO|BNO)(?=[A-Z0-9]{3,})/, "");
  return EMPTY.has(b) ? "" : b;
}

/** Split a multi-batch cell ("A1/A2", "X & Y", "P, Q and R") into normalised batches (≥3 chars). */
export function splitBatches(s) {
  const raw = String(s ?? "");
  const parts = raw.split(/\s*(?:\/|,|&|;|\band\b)\s*/i).map(normBatch).filter(b => b.length >= 3);
  const whole = normBatch(raw);
  if (parts.length <= 1) return whole.length >= 3 ? [whole] : (whole ? [whole] : []);
  return [...new Set(parts)];
}

/** First distinctive product token (the `ptok` attribute). */
export function ptok(s) { return productWords(s)[0] || ""; }

const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12 };

/** Parse an expiry/mfg/list date into YYYYMM (number) or 0. Accepts "Apr-2027", "04-2027", "04/2027", "01/10/2027", "2027-04-30", "OCT-2025". */
export function ym(s) {
  const t = String(s ?? "").trim().toUpperCase();
  let m;
  if ((m = t.match(/^([A-Z]{3,4})[\s\-./']*(\d{2,4})$/)) && MON[m[1]]) return yfix(+m[2]) * 100 + MON[m[1]];
  if ((m = t.match(/^(\d{1,2})[\-/.](\d{1,2})[\-/.](\d{4})$/))) return +m[3] * 100 + +m[2];          // dd/mm/yyyy
  if ((m = t.match(/^(\d{4})[\-/.](\d{1,2})(?:[\-/.]\d{1,2})?$/))) return +m[1] * 100 + +m[2];         // yyyy-mm(-dd)
  if ((m = t.match(/^(\d{1,2})[\-/.\s](\d{2,4})$/)) && +m[1] >= 1 && +m[1] <= 12) return yfix(+m[2]) * 100 + +m[1]; // mm-yyyy
  if ((m = t.match(/^\d{1,2}[\-\s]([A-Z]{3})[A-Z]*[\-\s](\d{2,4})$/)) && MON[m[1]]) return yfix(+m[2]) * 100 + MON[m[1]]; // dd-Mon-yyyy
  return 0;
}
function yfix(y) { return y < 100 ? 2000 + y : y; }

/** Parse "12-Oct-2026" → 20261012 (number) or 0. */
export function ymd(s) {
  const m = String(s ?? "").trim().toUpperCase().match(/^(\d{1,2})[\-\s/]([A-Z]{3})[A-Z]*[\-\s/](\d{4})$/);
  if (!m || !MON[m[2]]) return 0;
  return +m[3] * 10000 + MON[m[2]] * 100 + +m[1];
}

/** Last day of a YYYYMM month as a Date (UTC, 23:59:59). */
export function monthEnd(ymv) {
  const y = Math.floor(ymv / 100), mo = ymv % 100;
  return new Date(Date.UTC(y, mo, 0, 23, 59, 59));
}

/** Canonical JSON (sorted keys, no whitespace) and its sha256 as 0x-hex (the `row` attribute). */
export function canonical(obj) {
  if (Array.isArray(obj)) return "[" + obj.map(canonical).join(",") + "]";
  if (obj && typeof obj === "object") return "{" + Object.keys(obj).sort().map(k => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
  return JSON.stringify(obj ?? null);
}
export function sha256hex(s) { return "0x" + createHash("sha256").update(s).digest("hex"); }
export function rowHash(fields) { return sha256hex(canonical(fields)); }

/** Truncate a UTF-8 string to at most n bytes without splitting a character. */
export function truncBytes(s, n) {
  const b = Buffer.from(String(s ?? ""), "utf8");
  if (b.length <= n) return String(s ?? "");
  let out = b.subarray(0, n).toString("utf8");
  while (Buffer.byteLength(out) > n || out.endsWith("\uFFFD")) out = out.slice(0, -1);
  return out;
}

// Personal-data gate (SPEC §8.4). The writer refuses to sign anything that fails `assertClean`.
//
// 1. KSPC "Sender Name" (a drug inspector's name) is never read: the Karnataka parser whitelists columns.
// 2. CDSCO's own lab field sometimes starts with an officer's name ("A.S Examplekar Palghar-Zone-1 FDA, Lab Mumbai",
//    "V.P. Samplewad, Pune-Zone 2"; synthetic examples, real names never enter the repo). `scrubLab` replaces that prefix.
// 3. Every string field is checked for Indian mobile numbers and e-mail addresses, except `batch`/`batch_raw`,
//    where some real batch numbers look like phone numbers.

export const OFFICER_REMOVED = "(officer name removed)";

// Initials (one to three, with dots) followed by a surname, at the start of the field.
const OFFICER_PREFIX = /^\s*((?:[A-Z][.,]\s?){1,3}[A-Z]?[.,]?\s*[A-Z][a-z]+)[,\s]+/;
// Generic lab/office words that must not be mistaken for a surname.
const NOT_A_NAME = /^(?:[A-Z]\.\s?){1,3}(?:Lab|Labs|Laboratory|FDA|CDL|CDTL|RDTL|DTL|Zone|Govt|Government)\b/i;

export function scrubLab(s) {
  const t = String(s ?? "");
  if (NOT_A_NAME.test(t)) return t;
  const m = t.match(OFFICER_PREFIX);
  if (!m) return t;
  const rest = t.slice(m[0].length);
  // Only scrub when the remainder still looks like a place/office (keeps e.g. "C.D.L. Kolkata" intact).
  if (!/zone|fda|lab|circle|office|district|division/i.test(rest)) return t;
  return `${OFFICER_REMOVED} ${rest}`.trim();
}

const PHONE = /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const EXEMPT = new Set(["batch", "batch_raw", "row", "rid", "id", "source_url", "report_url", "pdf_sha256", "sha256"]);
const HEX = /^0x[0-9a-fA-F]{64}$/;

/** Throws if any string inside `obj` carries a phone number, an e-mail, or an unscrubbed officer prefix. */
export function assertClean(obj, path = "") {
  if (obj == null) return;
  if (typeof obj === "string") {
    const field = path.split(".").pop();
    if (EXEMPT.has(field) || HEX.test(obj)) return;
    if (PHONE.test(obj)) throw new Error(`PII gate: phone-like number in ${path}`);
    if (EMAIL.test(obj)) throw new Error(`PII gate: e-mail in ${path}`);
    if ((field === "lab" || field === "lab_name") && scrubLab(obj) !== obj) throw new Error(`PII gate: officer name in ${path}`);
    return;
  }
  if (Array.isArray(obj)) { obj.forEach((v, i) => assertClean(v, `${path}[${i}]`)); return; }
  if (typeof obj === "object") for (const [k, v] of Object.entries(obj)) assertClean(v, path ? `${path}.${k}` : k);
}

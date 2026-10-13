// State ↔ national matching (SPEC §8.3) and source-dated lag.
import fs from "node:fs";
import { sameBatch } from "./sources.mjs";
const SAME = JSON.parse(fs.readFileSync(new URL("../mirror/same_batch.json", import.meta.url), "utf8"));

// Dates on which a national monthly list was declared, where a public report gives one (else lower bound = 1st of the next month).
export const DECLARED = {
  202510: { ymd: 20251121, src: "https://ianslive.in/cdsco-labs-flag-211-drug-samples-as-not-of-standard-quality-in-october--20251121110525" },
  202601: { ymd: 20260221, src: "https://www.pharmabiz.com/NewsDetails.aspx?aid=184396&sid=2" },
  202606: { ymd: 20260722, src: "https://thehealthmaster.com/2026/07/22/drug-alert-159-drug-samples-declared-as-nsq-in-june-2026" },
  202608: { ymd: 20260923, src: "https://thehealthmaster.com/2026/09/23/drug-alert-220-drug-samples-declared-as-nsq-in-august-2026/" },
};
export function releaseOf(list_ym) {
  if (DECLARED[list_ym]) return { ymd: DECLARED[list_ym].ymd, basis: "declared" };
  const y = Math.floor(list_ym / 100), m = list_ym % 100;
  return { ymd: (m === 12 ? (y + 1) * 10000 + 101 : y * 10000 + (m + 1) * 100 + 1), basis: "lower-bound" };
}
const toDate = n => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100));
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400_000);

export function indexNational(rows) { const m = new Map(); for (const r of rows) { if (!m.has(r.batch)) m.set(r.batch, []); m.get(r.batch).push(r); } return m; }

/** National rows matching a state row: exact batch + product agreement, or a hand-judged equivalence. */
export function nationalMatches(stateRow, byBatch) {
  const hand = SAME[stateRow.src]?.[stateRow.batch];
  if (hand) return (byBatch.get(hand) || []).slice();
  return (byBatch.get(stateRow.batch) || []).filter(n => sameBatch(stateRow, n));
}

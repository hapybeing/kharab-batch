// State ↔ national matching (SPEC §8.3) and source-dated lag.
import fs from "node:fs";
import { sameBatch } from "./sources.mjs";
const SAME = JSON.parse(fs.readFileSync(new URL("../mirror/same_batch.json", import.meta.url), "utf8"));

import { DECLARED, releaseOf, daysBetween } from "./dates.mjs";
export { DECLARED, releaseOf, daysBetween };

export function indexNational(rows) { const m = new Map(); for (const r of rows) { if (!m.has(r.batch)) m.set(r.batch, []); m.get(r.batch).push(r); } return m; }

/** National rows matching a state row: exact batch + product agreement, or a hand-judged equivalence. */
export function nationalMatches(stateRow, byBatch) {
  const hand = SAME[stateRow.src]?.[stateRow.batch];
  if (hand) return (byBatch.get(hand) || []).slice();
  return (byBatch.get(stateRow.batch) || []).filter(n => sameBatch(stateRow, n));
}

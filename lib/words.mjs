// Product-word rules of drug-alert/1 (pure, no Node built-ins: shared by the mirror, the CLI and the browser).
// Words that never identify a product (dosage forms, salts, units). Same list as the verification scripts.
export const STOP = new Set(("tablets tablet ip i p usp bp injection inj syrup suspension capsules capsule oral solution sodium " +
  "hydrochloride hcl and with the for gastro resistant extended release prolonged film coated dispersible dry mg ml w v tabs " +
  "cream gel drops plus forte vet sustained modified chewable powder sachet lotion ointment hydrobromide phosphate sulphate " +
  "potassium calcium vitamin acid").split(" "));

/** Distinctive product words (≥4 chars, not a stopword), lowercase. */
export function productWords(s) {
  return [...new Set((String(s ?? "").toLowerCase().match(/[a-z][a-z0-9]+/g) || []).filter(w => w.length >= 4 && !STOP.has(w)))];
}

/** Two product strings agree when they share at least one distinctive word. */
export function productsAgree(a, b) {
  const A = new Set(productWords(a));
  return productWords(b).some(w => A.has(w));
}


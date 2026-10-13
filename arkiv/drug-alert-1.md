# drug-alert/1 — normalisation and identity

The open format every Kharab Batch? entity follows. Anyone can run their own mirror with these rules and produce the same `row` and `rid` hashes from the same public source. Reference implementation: `lib/norm.mjs` (normaliser `v1`) and `lib/sources.mjs`.

## Batch number (`batch` attribute)
1. Uppercase.
2. Remove every character except `A–Z` and `0–9`.
3. Remove a leading `BNO` or `BATCHNO` when at least 3 characters follow.
4. Empty, `NA`, `NIL`, `NOTMENTIONED`, `NOTAVAILABLE`, `NOTGIVEN`, `UNKNOWN` → no alert (the row still counts in the snapshot).
5. A cell holding several batches is split on `/`, `,`, `&`, `;` and the word `and`; each part (≥3 characters) becomes its own alert.

Examples: `SR-13` → `SR13`; `B.No. AL24002` → `AL24002`; `KL25817/KL25818` → `KL25817`, `KL25818`.

## Product token (`ptok`)
The first word of the product name, lowercased, that is at least 4 characters long and is not in this stop list (dosage forms, salts, units):

```
tablets tablet ip i p usp bp injection inj syrup suspension capsules capsule oral solution sodium hydrochloride hcl
and with the for gastro resistant extended release prolonged film coated dispersible dry mg ml w v tabs cream gel
drops plus forte vet sustained modified chewable powder sachet lotion ointment hydrobromide phosphate sulphate
potassium calcium vitamin acid
```

Two product names *agree* when they share at least one such word. A batch number alone is never enough for a red verdict: batch numbers are not unique across manufacturers.

## Dates
- `exp_ym`, `src_ym`: `YYYYMM` as a number. Accepted inputs: `Apr-2027`, `04-2027`, `04/2027`, `01/10/2027` (dd/mm/yyyy), `2027-04-30`, `12-Oct-2026`.
- `src_ymd`: `YYYYMMDD` for day-dated sources (Karnataka, notices); `0` otherwise.
- `exp_ok = false` when the printed expiry cannot be parsed.

## Row identity (`rid`) and row hash (`row`)
`rid = sha256(id)` where `id` is:

| Source | id |
|---|---|
| CDSCO | `cdsco|{tab}|{src_ym}|{batch}|{ptok}|{lab name, lowercased, a–z0–9 only}` |
| Karnataka | `ka|{src_ymd}|{batch}|{ptok}` |
| Maharashtra | `mh|{batch}|{ptok}` |
| Curated notice | `{src}|{document sha256}|{batch}` |

`row = sha256(canonical JSON of the parsed row)`, canonical = keys sorted, no whitespace. `kharab verify <key>` re-fetches the publisher's page, re-parses it and recomputes `row`: MATCH means the source still says exactly what we sealed.

## Personal data
- The Karnataka list's "Sender Name" column (a drug inspector) is never read: the parser whitelists columns.
- A CDSCO lab field that starts with an officer's initials and surname is rewritten to `(officer name removed) <office>`.
- Every string is checked for Indian mobile numbers and e-mail addresses before signing (batch fields exempt).
- The writer refuses to sign a row that fails these checks (`lib/scrub.mjs`, tests in `test/pii.test.mjs`, audit in `scripts/pii-audit.mjs`).

## Lifetimes (Entity Expiration)
| Type | Expires |
|---|---|
| alert | end of the printed expiry month + 30 days (unparseable expiry: source month + 36 months) |
| change, snapshot, params | 400 days |
| link | the state alert's lifetime |
| pending | 36 hours, renewed by each observation (Lifetime Extension by WATCH) |
| heartbeat | 30 hours, renewed by each run |

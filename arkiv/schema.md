# Kharab Batch? — Arkiv schema (`drug-alert/1`)

Network: Arkiv **Tiramisu** testnet, chain 7738577, RPC `https://rpc.tiramisu.db-chain.testnet.arkiv.network` (HTTP + WSS), block time 2 s.
Writes: `@arkiv-network/sdk` 0.8.1 (`executeBatch`, `predictEntityKeys`, `extendEntity`). Reads: raw `arkiv_query` / `arkiv_getEntityCount` JSON-RPC ([`lib/read.mjs`](../lib/read.mjs)), identical code in the browser, the CLI and against the explorer's shadow RPC.
Live counts on 14 Oct 2026 (block ≈552,900): 2,917 `alert`, 211 `pending`, 115 `link`, 146 `change`, 7 `snapshot`, 6 `heartbeat`, 1 `params`.

## 1. Wallets (creators) and roles

Trust comes from `$creator`, never from an attribute anyone can type. Addresses: [`wallets.json`](../wallets.json).

| Role | Address | Creates | Notes |
|---|---|---|---|
| ROOT | `0x7611d9613C2756D72f5b1351482c3c00ed5F147D` | `params` | publisher allowlist + schema hash |
| MIRROR_CDSCO | `0xC7bd0b3731ed69a3c769050668CdBF4EdB609Ea9` | `alert` (src=cdsco), `snapshot`, `heartbeat` | national NSQ + spurious tabs |
| MIRROR_KA | `0x4D4995700800e9891b487A9AF143fDadA653AfDd` | same, src=ka | Karnataka (KSPC NSQ list) |
| MIRROR_MH | `0x25FD47556c8b93F98AC6fD0b53a9BD5648433b93` | same, src=mh | Maharashtra FDA |
| CURATOR | `0xfAB7A74e90fAF5Fbe2306e4BE5bAE138513f498E` | `alert` src ∈ {tg, who} | hand-curated notices with PDF sha256 |
| WATCH | `0xb36181b9b26613284863Ddf3b6b939967986aF0E` | `pending`, `link`, `heartbeat` | our matcher; labelled "computed by our matcher, not a government statement" |
| HISTORY | `0xa37a95a6f431d6AC5F9429DfE384FaD2537aFD6f` | `change` (evid=reconstructed) | from archived at-release PDFs |
| KEEPER_DEMO | `0x024f89A3eEa3BD52a043e664dE1EdA438260B876` | — (extends only) | labelled demo of "keep as record" |
| THIRD_PARTY_DEMO *(not in the allowlist)* | `0x1b793aD502B611e5E62cdc288F1741fc46166000` | `alert` (src=mh), `snapshot`, `heartbeat` (`label`) | an independent mirror run with `kharab mirror` from a fresh faucet-funded wallet on 16 Oct. **Disclosure: this wallet is also ours**; it proves the open path end to end. Never counted in a verdict; shown as "independently re-published, same row hash" |

## 2. Common attributes

| Attr | Type | Why |
|---|---|---|
| `app` | str `kharab` (tests: `kharab-test`) | namespace; every query ANDs it |
| `v` | u64 `1` | schema version |
| `type` | str | `alert` · `snapshot` · `change` · `pending` · `link` · `heartbeat` · `params` |
| `batch` | str | normalised batch (`SR-13` → `SR13`, [drug-alert-1.md](drug-alert-1.md)); one query returns every type for a batch |

## 3. Types

### `alert` — one per official row, first time seen
| Attr | Type | Example | Why |
|---|---|---|---|
| `src` | str | `cdsco` `ka` `mh` `tg` `who` | display only |
| `rid` | str | row identity hash | dedupe (an interrupted run left 20 duplicates; readers count each `creator+rid` once) |
| `row` | bytes32 | sha256 of the canonical row | `kharab verify` recomputes it from the live source |
| `ptok` | str | `coldrif` | first distinctive product word |
| `pname` | str ≤120 B | `Coldrif Syrup (Paracetamol…)` | payload-less readers can render the card |
| `exp_ym` | u64 | `202704` | active-warning rule; "expiring" ranges |
| `exp_ok` | bool | `true` | false = expiry unparseable |
| `src_ym` | u64 | `202510` | list month |
| `src_ymd` | u64 | `20251004` (0 if none) | day-dated sources; lag maths |
| `class` | str | `nsq` `spurious` `adulterated` `misbranded` | wording |
| `test` | str | `deg-eg` `assay` `dissolution` `sterility` `description` `other` `na` | "toxic contamination" filter |
| `lab` / `rstate` | str | `central`/`state`/`who`, `ka`/`tg`/`mh`/`in` | central vs state |
| `snap` | key | snapshot key | completeness: count of `snap = key(S)` must equal `S.new` |

Payload (JSON ≤2 KB): verbatim row (product, batch_raw, mfg, exp, result, remarks, firm reply, lab name with officer names removed), label manufacturer, source URL, PDF sha256 for notices.
**Expiration:** last day of `exp_ym` + 30 days. Rows already past expiry are not written (counted in the snapshot).
**Flags:** `readonly` + `permissionlessExtension`; owner → `0x…dEaD` in the creating batch (sealed).

### `snapshot` — one per source read whose content changed
`src` str · `list_ym` u64 (0 = whole list) · `fetched` u64 unix s · `count` u64 rows read · `new` u64 alerts created under it · `rows` bytes32 (hash of the sorted row hashes) · `prev` key · `run` str · `scope` str (reserved: `partial`; readers honour it, the current mirror writes no snapshot at all on a short read).
Payload: sorted 8-byte row hashes, fetch URL, raw sha256, expired-row count. **Expiration:** 400 d. Flags: readonly + permissionlessExtension, sealed.

**Partial snapshots.** A sealed snapshot can never be edited, so a snapshot written from a short read stays on chain. Readers apply `snapshotStatus()` ([`lib/read.mjs`](../lib/read.mjs)): a whole-list snapshot is *partial* when `scope = 'partial'` or its `count` is below half the largest earlier snapshot of the same source. Partial snapshots are shown flagged (app *About → Ledger health*, `kharab snapshots`) and are never a diff baseline, so their missing rows never read as removals. Known case: `0x0cb0b77f…ae77a1` (KA, 13 Oct 18:40 IST, count 193 vs 810). Since 14 Oct the mirror reads the full Karnataka list every run and writes no snapshot at all on a short read (heartbeat `mver` says `degraded`).

### `change` — a difference between two snapshots, or a reconstruction
`src` · `kind` (`added_late` `removed` `reclassified` `field_changed` `revised_notice` `reappeared`) · `of` key (affected alert, zero if never alive) · `list_ym` u64 · `seen_ymd` u64 · `before` bytes32 (row hash, or the at-release PDF sha256) · `after` bytes32 · `evid` (`witnessed` by a MIRROR, `reconstructed` by HISTORY).
Payload: before/after rows verbatim + both source URLs + sha256. **Expiration:** max(alert life, 400 d). Sealed.

### `pending` — the gap lease (state finding with no national match)
`of` key (state alert) · `src` · `since_ymd` u64 · `exp_ym` u64. **Expiration: 36 h lease, renewed by observation.** Flags: readonly only (only WATCH may extend), not sealed. If the watcher stops, the row disappears: a gap is a claim about *now*.

### `link` — gap closed (national alert matches a state alert)
`sa` key · `na` key · `lag_d` i32 (source-dated days) · `lag_basis` str (`declared`/`lower-bound`/`undated`) · `lag_w` u64 · `witnessed` bool. Written in the **same batch** as the national alert. Expiration = state alert life. Sealed.

### `heartbeat` — one per mirror wallet
`src` · `mver` (e.g. `mirror/1.0`, `+degraded`). 30 h lease extended each run. Third-party mirrors add `label` (str, self-declared) and `mver = kharab-cli/0.1 third-party`.

**Third-party mirrors (open write path).** Anyone runs `MIRROR_KEY=… npx github:hapybeing/kharab-batch mirror --src mh|ka`: same `drug-alert/1` shapes (sealed snapshot + sealed alerts with `snap = key(S)` + heartbeat), under *their* `$creator`. Readers compare by row identity: `kharab agree --src mh` → for every `rid` the other wallet published, is the `row` hash identical to ours (Q20/Q21 below)? Apps **show** agreement and **never merge**: the verdict counts the ROOT allowlist only.

### `params` — ROOT registry
`schema` bytes32. Payload: publishers (name en/hi, creator, source URL), normaliser version, caveats. 400 d.

## 4. Lifetimes at a glance
| Type | Expiration | Product reason |
|---|---|---|
| alert | printed expiry + 30 d | the batch can't be sold after expiry; +30 d covers home stock |
| change | max(alert life, 400 d) | publisher behaviour must outlast a year of audits |
| snapshot | 400 d | a year of diff baselines |
| link | state alert's life | a lag matters while the batch may be in use |
| pending | 36 h, renewed per run | a gap is only true while re-observed |
| heartbeat | 30 h, renewed per run | liveness |
| params | 400 d | registry |

## 5. Query catalogue (the app and CLI run only these)
`$C` MIRROR_CDSCO, `$W` WATCH, `$H` HISTORY. Strings are exact ([`lib/read.mjs#Q`](../lib/read.mjs)).

| # | Where | Query |
|---|---|---|
| Q1 | Check (1 query per hit) | `app = str('kharab') AND batch = str('SR13')` |
| Q2 | Did-you-mean (only on a miss) | `app = str('kharab') AND type = str('alert') AND batch STARTSWITH str('SR1')` limit 50 |
| Q3 | Params | `app = str('kharab') AND type = str('params') AND $creator = addr(ROOT)` |
| Q4 | Gap ledger (+ cursor, `atBlock` pinned) | `app = str('kharab') AND type = str('pending') AND $creator = addr($W)` |
| Q5 | Waiting > N days | Q4 `AND since_ymd <= u64(20260814)` |
| Q6 | Gap counters (raw count) | `arkiv_getEntityCount({query: Q4})`, and Q4 `AND exp_ym >= u64(202610)` |
| Q7 | Closed gaps | `app = str('kharab') AND type = str('link') AND $creator = addr($W)` |
| Q8 | Changed feed | `app = str('kharab') AND type = str('change') AND ($creator = addr($C) OR … OR $creator = addr($H))` |
| Q9 | Month browser | `… type = str('alert') AND $creator = addr($C) AND src_ym = u64(202606)` |
| Q10/Q15 | Completeness / WS refresh | `app = str('kharab') AND type = str('alert') AND snap = key(S)` |
| Q11 | New since block (raw only) | `… type = str('alert') AND $createdAt > u64(B)` |
| Q12 | Expiring this month | `… type = str('alert') AND exp_ym = u64(202610)` |
| Q13 | Publisher track record | `… type = str('alert') AND $creator = addr($K)` |
| Q14 | Heartbeats | `app = str('kharab') AND type = str('heartbeat')` |
| Q19 | Snapshot health | `app = str('kharab') AND type = str('snapshot')` → `snapshotStatus()` |
| Q20 | One publisher's copy of a source (agreement) | `app = str('kharab') AND type = str('alert') AND src = str('mh') AND $creator = addr($K)` (run for both wallets; compare `rid` → `row`) |
| Q21 | Independent mirrors | Q14 results whose `$creator` is not in `wallets.json` (About → Independent mirrors) |
| Q17 | Second reader | Q1 via `POST https://tiramisu.explorer.arkiv.network/api/shadow-rpc/experimental` |

Read budget: a check is 1 query (2 on a miss); every result is cached in IndexedDB; no polling. The in-app Inspector lists each query, reader, request count and timing.

## 6. Verdict rule (pure function `verdict()`, shared by app and CLI; 25 fixtures in `test/verdict.test.mjs`)
- **RED:** an allowlisted alert with this exact batch, printed expiry not passed, and all such alerts name one product (distinctive-word agreement) — or the user picked the product.
- **AMBER:** same batch, different products, or batch shorter than 4 characters: the user picks.
- **RECORD:** only expired alerts (still readable because someone extended them). Never red.
- **GREY:** nothing; "not a safety guarantee".
Strangers' entities never change the verdict; they are counted under "unknown writers".

## 7. Off Arkiv, deliberately
Inspectors' names (scrubbed with tests), users' searches and saved lists (IndexedDB only), private keys, access keys.

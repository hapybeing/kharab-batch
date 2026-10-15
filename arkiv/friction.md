# Friction report — building Kharab Batch? on Arkiv

Versions: `@arkiv-network/sdk@0.8.1`, `viem@2.57.5`, Node 22.23, Tiramisu chain 7738577 (node client `reth/v2.5.0-189c0df`), explorer `tiramisu.explorer.arkiv.network`. Dates are IST, 12–14 Oct 2026.
Every item below was reproduced by us; raw output with timestamps is in [friction-log.md](friction-log.md), scripts in `scripts/spikes/d1.mjs` and `scripts/friction/`.

## Issues

### 1. Batches fail above ~5.1 M gas with an opaque `BAD_REQUEST`
- **Surface:** `walletClient.executeBatch` → `eth_estimateGas` on the public RPC.
- **Repro:** `KHARAB_SECRETS=… node scripts/friction/batch-limit.mjs` (writes to `app='kharab-test'`).
- **Expected:** batches up to the 36 M block gas limit, or a clear "gas cap exceeded" error.
- **Actual:** n=27 alert-shaped creates OK (4,786,832 gas); n=30 fails with `EntityMutationError: Transaction failed: Execution error without revert data`, viem details `"BAD_REQUEST"`. Tiny creates: n=30 OK (5,111,360), n=40 fails. The cut follows gas, not bytes (~5.1–5.3 M).
- **Impact:** our first production load failed; the SDK can't tell callers to split.
- **Fix suggestion:** document the RPC gas cap; return `-32000 gas cap exceeded (5,000,000)`; let `executeBatch` auto-chunk.
- **Workaround:** 20 creates + 20 ownership transfers per tx (`lib/writer.mjs`).

### 2. Cursor pagination breaks when a block lands mid page-through
- **Surface:** `arkiv_query` with `cursor`.
- **Repro:** page 2,900 alerts with `limit 200` and no `atBlock`.
- **Expected:** a cursor stays valid (it encodes its block), or docs say "pin `atBlock`".
- **Actual:** `-32005 cursor belongs to a different query, block or select — start a new page-through` after a couple of pages (2 s blocks).
- **Fix suggestion:** document it in the querying guide; have the SDK pin the first page's block.
- **Workaround:** `lib/read.mjs#queryAll` passes `atBlock` = first page's `blockNumber` on every later page. (Error text is clear: good.)

### 3. `$createdAt` blocked by the SDK builder, accepted raw
- **Surface:** SDK query builder vs `arkiv_query`.
- **Expected:** consistent behaviour.
- **Actual:** SDK throws `InvalidPredicateError "$createdAt" is returned in query results but carries no index`; the same predicate sent raw returns 100 hits.
- **Fix suggestion:** either index it officially (it is the natural "new since my last visit" filter) or reject it on the node too.

### 4. Filtered counts only via raw RPC, and only as an object
- **Surface:** `getEntityCount()` / `arkiv_getEntityCount`.
- **Actual:** SDK `getEntityCount()` takes no filter (returns chain-wide 2,089). Raw accepts `{query: "…"}`; a bare string → `-32602 … expected struct CountRequest`.
- **Fix suggestion:** add `getEntityCount({ query })` to the SDK; accept the string form like `arkiv_query`.

### 5. Read-cost headers are half there
- **Surface:** HTTP response headers of the public RPC (re-checked 14 Oct 11:05 IST with curl).
- **Expected:** `Access-Control-Expose-Headers` lists `Arkiv-Cost` and `Arkiv-Quota-Used-Percent`, so a browser app can show its remaining budget.
- **Actual:** `arkiv_query` returns `arkiv-cost: 100` but no `Arkiv-Quota-Used-Percent`; `arkiv_getEntityCount` returns neither. `ratelimit: limit=600, remaining=…` is present.
- **Impact:** our budget meter has to count requests itself against the ~100-query / 39-min keyless budget (tech research, 12 Oct).
- **Fix suggestion:** send the quota header on every metered method.

### 6. WebSocket events: no server-side filter
- **Surface:** `watchEntityEvents` (no `fromBlock`) over `webSocket(WSS)`.
- **Actual:** ~25 s delivered 259 events chain-wide, 206 of them ours; the SDK exposes no owner/creator/topic filter, so every client filters a firehose.
- **Fix suggestion:** accept `owner`/`creator`/attribute filters in the subscription (log topics already carry the owner).

### 7. Who extended a sealed entity is not in the event
- **Surface:** `ExpiryExtended` log of a `permissionlessExtension` entity owned by `0x…dEaD`.
- **Actual:** the owner topic is `0x…dEaD`; the extender is only recoverable from `tx.from`.
- **Fix suggestion:** add the caller to the event (it is the whole point of community extension).

### 8. Equal-target extension: docs disagree with each other and with the node
- **Expected:** JSON-RPC docs: equal expiry reverts. TS docs: no-op.
- **Actual:** accepted, and an `ExpiryExtended` log is emitted.
- **Fix suggestion:** pick one behaviour and document it.

### 9. Sealed + readonly means a mistaken record can only be *annotated by convention*
- **Surface:** product design with `readonly` + ownership → `0x…dEaD`.
- **What happened (our bug):** on 13 Oct 18:40 IST our mirror fetched only the first 4 pages of the Karnataka list (193 of 810 rows) and sealed a snapshot with `count = 193` (`0x0cb0b77f…ae77a1`). A naive reader diffing it would see 617 "removals".
- **Expected (from Arkiv):** nothing different; immutability is the feature. But there is no first-class way to attach a correction to a sealed entity, so every reader must implement the same rule.
- **What we did:** a pure reader rule `snapshotStatus()` (partial = `scope='partial'` or count < ½ of the largest earlier snapshot) with tests, shown flagged in the app and in `kharab snapshots`; the mirror now reads the full list every run and writes no snapshot on a short read.
- **Suggestion:** a documented "annotation" pattern (e.g. an `annotates = key(X)` convention) in the best-practices guide.

### 10. Faucet needs a browser wallet, SIWE and a captcha
- **Actual:** no headless path; we automated SIWE + the Cap widget in headless Chromium (`work/sdk/pwfaucet.mjs` in our workspace).
- **Fix suggestion:** a rate-limited API faucet for CI.

### 11. Our own: duplicate sealed alerts after an interrupted run
- The 13 Oct 09:00 run was killed between a confirmed batch and our local ledger save; 20 CDSCO alerts exist twice (sealed, undeletable). Readers dedupe by `creator + rid` (fixture 06/23); the mirror now reconciles with the chain (`snap = key(S)`) before writing.

### 12. `eth_getLogs` is capped at 100,000 blocks, which is only ~55 hours on Tiramisu
- **Surface:** `eth_getLogs` on the public RPC (14 Oct, head ≈553,700).
- **Repro:** `eth_getLogs({address: 0x44…44, fromBlock: "0x0", toBlock: "latest", topics: [ExpiryExtended, <entityKey>]})`.
- **Expected:** the full history of one entity's extensions (it is filtered to one key, so the result is tiny), or a documented limit.
- **Actual:** `-32602 query exceeds max block range 100000`. With 2 s blocks that is ~55 h, so "who kept this record alive since it was created?" needs a window loop from `$createdAt`.
- **Impact:** our Proof drawer's "Who extended this record?" (Q18) walks 100k-block windows from the entity's creation block, then reads `tx.from` per log (see #7).
- **Fix suggestion:** document the cap next to the events guide; allow unbounded ranges when `topics[1]` (entity key) is set; or add an `arkiv_getEntityHistory(key)` method.

### 13. WebSocket delivery of large batches: works (tested after a false alarm)
- **Surface:** raw `eth_subscribe("logs", {address, topics})` over WSS.
- **What happened:** two of our live tests saw no events for a 212-extension batch; we suspected dropped logs. `scripts/friction/ws-batch-delivery.mjs` then extended 10/50/100/150/200 entities per tx with a filtered and an unfiltered subscription open: **every log was delivered on both** (10/10 … 200/200). The cause was our test timing (the browser closed 3 s before the renewal block). A full live run then ticked 211 gap rows in the open app with 0 HTTP reads. Recorded so others don't chase the same ghost; the only real gap is #6 (no SDK-level filter; raw `topics` filtering on `owner` works).

### 14. A new publisher hits the gas cap (#1) on its very first write
- **Context (16 Oct 01:17 IST):** running our open `kharab mirror --src mh` from a brand-new wallet (THIRD_PARTY_DEMO `0x1b793aD502B611e5E62cdc288F1741fc46166000`, funded 10 GLM by the Hub faucet), with the CLI's first draft batching 40 alerts + 40 seal transfers per tx.
- **Expected:** either success or an error naming the limit.
- **Actual:** the snapshot tx (1 create + seal, 204,672 gas) landed; the 40+40 alert batch failed with `Transaction failed: Execution error without revert data` (`@arkiv-network/sdk` 0.8.1). Same root cause as #1, rediscovered by a "third party" who had not read our notes: the cap is invisible to every new integrator.
- **Repro:** `MIRROR_KEY=<fresh funded key> CHUNK=40 node cli/kharab.mjs mirror --src mh`.
- **Fix in our CLI:** default 20 per tx; a re-run resumes from the already-sealed snapshot (looked up by `rows = bytes32(…)` under the same `$creator`) instead of sealing a duplicate. The real run then wrote 91 sealed alerts in 5 txs (`0x7671d404…`, `0x1b628ea6…`, `0x9af0753a…`, `0x6643fe13…`, `0x84cd3e79…`).
- **Suggestion:** same as #1: a named error and auto-chunking in `executeBatch`.

### 10b. Faucet update: headless claim works once you hold a captcha token
- On 16 Oct the Hub faucet funded a fresh wallet headlessly: SIWE nonce → verify → `POST /api/faucet {recipient, captchaToken}` → `202 accepted, amountGlm "10"`, balance 10 GLM a few seconds later. The only browser step left is solving the Cap widget for the token. Still worth an API path for CI (#10).

## What went smoothly (same rigour)
| Tested | Expected | Happened |
|---|---|---|
| `predictEntityKeys` + create + `changeOwnership → 0x…dEaD` in one `executeBatch` | predicted = minted keys; sealed atomically | yes (281,632 gas for 2+2) |
| Former owner deletes a sealed entity | rejected | rejected with a clear message |
| 211 owner-only `extendEntity` in one batch | one tx | 1 tx, exactly 10,000 gas per extension (vs 25,210 standalone); 14 Oct block 552,460 |
| Stranger extends an owner-only lease | rejected | rejected |
| `batch STARTSWITH str('SR1')` on `str` | works | works (did-you-mean) |
| `atBlock` 100…400,000 blocks back | answers | all answered (whole chain since the 1 Oct restart) |
| Explorer shadow RPC vs node for `key`, `bytes32`, `bool`, `u64`, `str` | same results | byte-identical attributes and counts; `check --reader both` → "2/2 readers agree" |
| CORS on RPC, shadow RPC, explorer `/api/entity/:key` | callable from a browser | `Access-Control-Allow-Origin: *` on all three |
| Raw `eth_subscribe("logs")` with `topics: [[EntityCreated, ExpiryExtended], null, [5 owners]]` from a browser | node-side filtering, no polling | 211 lease renewals delivered in one block; app ticked every gap row, 0 HTTP reads in 198 s (`evidence/qa/e2e-live-ws-local-2026-10-14.json`) |
| Stranger-style "keep as record" on a sealed alert (`kharab keep … --until 2027-04` signed by KEEPER_DEMO) | accepted, visible | tx `0x2e0b7704…fdb3a1`, block 553,718; expiry moved to block 9,139,894; extender recovered via `tx.from` |
| Keyless reads from a static site (GitHub Pages) | works with no backend | SR-13 red in 0.85 s from a cold 360×640 Chromium; ≤2 queries per check |

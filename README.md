# Kharab Batch? (ख़राब बैच?)

**Type a batch number from your medicine strip or bottle: every Indian drug alert we mirror, who published it and when, on a sealed Arkiv ledger that shows what the national list misses or quietly changes.**

**Live app:** https://hapybeing.github.io/kharab-batch/ · independent mirror: https://kharab-batch.vercel.app · (Surge mirror `kharab-batch.surge.sh`: pending, see *Hosting*)
**Docs:** [arkiv/schema.md](arkiv/schema.md) (entities, attributes, lifetimes, queries) · [arkiv/friction.md](arkiv/friction.md) · [arkiv/drug-alert-1.md](arkiv/drug-alert-1.md) (open format) · [arkiv/friction-log.md](arkiv/friction-log.md) (raw dated log)
**Demo video (2:36, English captions; Hindi track + Hindi-captioned cut):** [watch on Pages](https://hapybeing.github.io/kharab-batch/video/kharab-batch-demo.mp4) · [release video-v1](https://github.com/hapybeing/kharab-batch/releases/tag/video-v1) · [script + timestamps](video/script.md) · captions [en](video/en.srt) / [hi](video/hi.srt)
**Network:** Arkiv Tiramisu testnet (chain 7738577), `@arkiv-network/sdk` 0.8.1 for writes, raw JSON-RPC for reads. MIT licence.

> Built for the Arkiv Global Tour Stop (9–18 Oct 2026). Tracks: Best Indian Use Case, Censorship Resistance, Open Source, Security.
> Not medical advice and not an accusation: a public-interest index of what Indian regulators published, word for word.

## Try it in 60 seconds (phone or desktop, no login, no wallet)

| Type | You should see |
|---|---|
| `SR-13` | **Red**: Coldrif syrup, DEG/EG contamination. Telangana stop-use notice 4 Oct 2025 → WHO alert 13 Oct → CDSCO national list OCT-2025 declared 21 Nov 2025: **"carried it 48 days after the first notice"** |
| `R01GL2523` | **Red** from Telangana + WHO, and **"not on the national CDSCO portal"** (no NSQ or spurious row in any month the mirror reads) |
| any random string | **Grey** + "This is not a safety guarantee" |
| *Gap ledger* tab | 211 Karnataka/Maharashtra findings that the national list does not carry; each row is an Arkiv lease re-checked every mirror run |
| *Changed* tab | Jun 2026 **+34** rows added after release · May 2026 **2** moved to the spurious list · Dec 2025 **3** removed from every month, each with the sha256 of the archived at-release PDF |
| *Inspector* (bottom of every screen) | the exact Arkiv queries each check made: **1** for a hit, **2** for a miss (did-you-mean), 0 when cached in IndexedDB |

The same answers without our site:

```bash
npx github:hapybeing/kharab-batch check SR-13 --reader both     # node RPC and the explorer's independent reader must agree
npx github:hapybeing/kharab-batch gap --src ka --min-days 60
npx github:hapybeing/kharab-batch changes --month 2026-06
npx github:hapybeing/kharab-batch snapshots                     # source snapshots, partial reads flagged
```

or with curl (Q1, no key):

```bash
curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"arkiv_query\",\"params\":[\"app = str('kharab') AND batch = str('SR13')\",{\"limit\":\"0x20\",\"select\":{\"key\":true,\"creator\":true,\"owner\":true,\"attributes\":true}}]}"
```

## The problem (India)

When a government lab fails a batch of medicine, the warning is scattered and slow:
- **Late.** Telangana told the public to stop using Coldrif batch SR-13 on 4 Oct 2025 after child deaths (24 by Oct 2025; 26 by Oct 2026). The searchable national NSQ list carried it 48 days later.
- **Missing.** Two other DEG-contaminated syrups in WHO Alert N°5/2025 are still not on the national portal a year on. Of 428 distinct Karnataka findings (Jan 2025–Jul 2026), **267 have no CDSCO row with that batch** (hand-verified sample; method in `scripts/evidence/`).
- **Changed without a changelog.** Against archived at-release copies of seven monthly lists we found **≥137 rows added after release, 6 reclassified (changing who is named as manufacturer) and 3 that vanished**.

Who uses it: parents and patients holding a strip, chemists, ASHA/health workers, and journalists. Hindi first, English second, phone-first.

Caveat that ships on every card: a state result can be challenged and a central referee lab may later find the batch standard. "Not on the national list" is a fact about publication, not a verdict on the batch.

## How it uses Arkiv (each feature changes what the user sees)

| Feature | How | What you see |
|---|---|---|
| Typed attributes vs payload | `batch`, `src`, `class`, `test` are `str`; `exp_ym`, `src_ym`, `src_ymd`, `since_ymd` are `u64`; payload = verbatim regulator row | the card, gap ledger and changed feed render from attributes alone (the explorer's payload-less reader gives the same card) |
| `$creator` as the publisher axis | one wallet per publisher mirror; verdicts only count allowlisted creators | publisher chips; "N records by unknown writers hidden" |
| Entity Expiration per type | alert = printed expiry + 30 d; gap lease 36 h; heartbeat 30 h; snapshot/change 400 d | an expired batch turns "kept as record", never red |
| Lifetime Extension as a lease | every mirror run renews all open gap leases in **one** batch tx (211 leases, 10k gas each) | "re-checked 2 h ago" + lease bar; stop checking and the row expires |
| Creation flags + sealing | alerts/changes/snapshots are `readonly` + `permissionlessExtension`, owner transferred to `0x…dEaD` in the creating batch | Proof drawer: "sealed: nobody can edit or delete it, including us" |
| Batches | create + seal; national alert + gap link; all lease renewals + heartbeat | a gap never shows "closed" without the alert that closed it |
| Second reader | the same query against the explorer's shadow RPC | `--reader both` → "2/2 readers agree" |

Full schema and the exact query strings: [arkiv/schema.md](arkiv/schema.md).

## What stays off Arkiv

Drug inspectors' names (removed even where the national portal embeds them; blocking scrubber with tests), your searches and saved list (IndexedDB on your phone only), keys and access keys (never in the bundle).

## Wallets (creators on Tiramisu)

See [wallets.json](wallets.json); explorer: `https://tiramisu.explorer.arkiv.network/address/<address>`.
ROOT `0x7611…147D` · MIRROR_CDSCO `0xC7bd…9Ea9` · MIRROR_KA `0x4D49…AfDd` · MIRROR_MH `0x25FD…3b93` · CURATOR `0xfAB7…498E` · WATCH `0xb361…aF0E` · HISTORY `0xa37a…FD6f` · KEEPER_DEMO `0x024f…B876`.

## Setup

```bash
npm i && npm test                      # 48 tests: normaliser, PII scrubber (inspector names), 25 verdict fixtures, lag, snapshot health, i18n parity
cd web && npm i && npx vite build      # → docs/ (relative base: works at a domain root and at /kharab-batch/)
KHARAB_SECRETS=/path/outside/repo/.env node mirror/run.mjs   # one mirror run (needs funded role keys)
PW=…/playwright/index.mjs BASE=https://hapybeing.github.io/kharab-batch/ node scripts/e2e.mjs   # phone-viewport acceptance tests
```

## Hosting

- GitHub Pages from `main:/docs` (canonical): https://hapybeing.github.io/kharab-batch/
- Vercel static mirror (same `docs/` files, `scripts/deploy-vercel.mjs`): https://kharab-batch.vercel.app
- Surge (`kharab-batch.surge.sh`): planned; the Surge CLI token could not be obtained from the build sandbox on 14 Oct (see the repo history).
- The mirror runs on Hark's scheduler (00:40/06:40/12:40/18:40 IST) because Actions secrets can't be set from our tooling; every run commits `evidence/runs/*.json`.

QA evidence: `evidence/qa/` (end-to-end run on the public URL, Lighthouse mobile: performance 96, accessibility 100, best practices 100 on 14 Oct).

## Disclosure

Built 12–18 Oct 2026 inside the build window by Gaurang Kumar (Indian national, solo) with Hark, an AI agent, writing most of the code. No pre-existing code. MIT.

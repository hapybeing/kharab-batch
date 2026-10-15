# Kharab Batch? (ख़राब बैच?)

**Type the batch number from a medicine strip or syrup bottle. If an Indian regulator failed that batch, the screen turns red and shows who published it, when it was first public (an Arkiv block nobody can backdate, including us), and whether the national list carries it. Hindi first, phone first, no login, no wallet.**

| | |
|---|---|
| **Live app** | https://hapybeing.github.io/kharab-batch/ · independent host: https://kharab-batch.vercel.app |
| **Demo video (2:36)** | [MP4 on Pages](https://hapybeing.github.io/kharab-batch/video/kharab-batch-demo.mp4) · [script + timestamps](video/script.md) · captions [en](video/en.srt) / [hi](video/hi.srt) |
| **Arkiv docs** | [arkiv/schema.md](arkiv/schema.md) (entities, attributes, lifetimes, every query) · [arkiv/friction.md](arkiv/friction.md) (14 issues, versions, repro) · [arkiv/drug-alert-1.md](arkiv/drug-alert-1.md) (open data contract) |
| **Evidence** | [EVIDENCE.md](EVIDENCE.md): tx hashes, e2e runs on both URLs, CLI transcripts, third-party mirror run |
| **Network** | Arkiv Tiramisu testnet (chain 7738577) · `@arkiv-network/sdk` 0.8.1 for writes, raw JSON-RPC for reads |
| **Tracks** | Best Indian Use Case · Censorship Resistance · Open Source · Security |
| **Licence** | MIT · built 12–18 Oct 2026 · AI-assisted (see Disclosure) |

> Not medical advice and not an accusation: a public-interest index of what Indian regulators published, word for word.

## Reproduce three claims in 3 minutes (no key, no account)

Every command reads Tiramisu directly; none touches our website or any server of ours. `npx` fetches this repo.

**1. Coldrif SR-13: the national list carried it 48 days after the first stop-use notice.**
```bash
npx -y github:hapybeing/kharab-batch check SR-13 --reader both
```
Expected (abridged, 16 Oct 2026):
```
Batch SR13 · RED  — failed a government lab test / stop-use notice
  • Curated notice (Telangana DCA / WHO): Coldrif Syrup … dated 04-10-2025 … owner 0x…dEaD (sealed)
  • CDSCO national list: Coldrif Syrup … list 2025-10 … owner 0x…dEaD (sealed)
  ↳ national list 2025-10 (declared 21-11-2025) carried it 48 days after the first notice (tg, 04-10-2025)
2/2 readers agree (node RPC block …, explorer index block …)
```
In the app: type `SR-13` → red card, "48 days". Same query by hand (Q1):
```bash
curl -s https://rpc.tiramisu.db-chain.testnet.arkiv.network -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"arkiv_query\",\"params\":[\"app = str('kharab') AND batch = str('SR13')\",{\"limit\":\"0x20\",\"select\":{\"key\":true,\"creator\":true,\"owner\":true,\"attributes\":true}}]}"
```

**2. State findings the national list does not carry: 212 live leases, each renewed only when our mirror re-observes the gap.**
```bash
npx -y github:hapybeing/kharab-batch gap --limit 3
```
Expected: `212 state findings not on the national list (block …)` then rows like `KA 03BF2358 waiting 652 d exp 2026-11 0x…` (the count moves as findings close or expire). Query Q4: `app = str('kharab') AND type = str('pending') AND $creator = addr(0xb36181b9b26613284863Ddf3b6b939967986aF0E)`. In the app: *Gap ledger* tab, row count = Q4.

**3. A second, independent publisher agrees row for row (and can't make anything red on its own).**
```bash
npx -y github:hapybeing/kharab-batch agree --src mh
```
Expected:
```
Source MH · publisher A 0x25FD…3b93 (Maharashtra FDA) 91 alerts · publisher B 0x1b79…6000 91 alerts (91 sealed)
  91/91 of B's rows: same row identity and same row hash as A  → AGREE
```
Publisher B (`THIRD_PARTY_DEMO`) was created on 16 Oct from a **fresh wallet funded by the Arkiv faucet** and ran our open `kharab mirror --src mh`. **Honest disclosure: that wallet is also ours**; it proves anyone can run the path, but a genuinely independent operator is still needed. In the app: type `KT26012` → red (from MIRROR_MH) + "Independently re-published by 1 other wallet with the same row hash"; *About → Independent mirrors*. The verdict only ever counts the ROOT allowlist.

Run your own mirror (any funded Tiramisu key; faucet: https://hub.arkiv.network/faucet):
```bash
MIRROR_KEY=0x… npx -y github:hapybeing/kharab-batch mirror --src mh --label "your-name"
```

## On-chain evidence: wallets that create our entities (Tiramisu)

Explorer: `https://tiramisu.explorer.arkiv.network/address/<address>` · machine-readable: [wallets.json](wallets.json)

| Role | Address | Creates |
|---|---|---|
| ROOT | `0x7611d9613C2756D72f5b1351482c3c00ed5F147D` | `params` (publisher allowlist, schema hash) |
| MIRROR_CDSCO | `0xC7bd0b3731ed69a3c769050668CdBF4EdB609Ea9` | national NSQ/spurious `alert`, `snapshot`, `heartbeat` |
| MIRROR_KA | `0x4D4995700800e9891b487A9AF143fDadA653AfDd` | Karnataka `alert`, `snapshot`, `heartbeat` |
| MIRROR_MH | `0x25FD47556c8b93F98AC6fD0b53a9BD5648433b93` | Maharashtra `alert`, `snapshot`, `heartbeat` |
| CURATOR | `0xfAB7A74e90fAF5Fbe2306e4BE5bAE138513f498E` | hand-curated Telangana/WHO/TN notices (`alert` + PDF sha256) |
| WATCH | `0xb36181b9b26613284863Ddf3b6b939967986aF0E` | gap leases (`pending`), closed gaps (`link`), `heartbeat` |
| HISTORY | `0xa37a95a6f431d6AC5F9429DfE384FaD2537aFD6f` | reconstructed `change` records from archived PDFs |
| KEEPER_DEMO | `0x024f89A3eEa3BD52a043e664dE1EdA438260B876` | no creates; extends a sealed record ("keep as record") |
| THIRD_PARTY_DEMO *(ours, not allowlisted)* | `0x1b793aD502B611e5E62cdc288F1741fc46166000` | independent MH mirror via `kharab mirror` |

Sample transactions: [EVIDENCE.md](EVIDENCE.md).

## Try it in 60 seconds (phone or desktop)

| Type | You should see |
|---|---|
| `SR-13` | **Red**: Coldrif syrup, DEG/EG contamination. Telangana stop-use notice 4 Oct 2025 → WHO alert 13 Oct → CDSCO national list OCT-2025 declared 21 Nov 2025: **"carried it 48 days after the first notice"** |
| `R01GL2523` | **Red** from Telangana + WHO, and **"not on the national CDSCO portal"** |
| `KT26012` | **Red** from Maharashtra FDA + "independently re-published … same row hash" |
| any random string | **Grey** + "This is not a safety guarantee" |
| *Gap ledger* tab | 212 Karnataka/Maharashtra findings the national list does not carry; each row is an Arkiv lease re-checked every mirror run |
| *Changed* tab | Jun 2026 **+34** rows added after release · May 2026 **2** moved to the spurious list · Dec 2025 **3** removed from every month, each with the sha256 of the archived at-release PDF |
| *Inspector* (bottom of every screen) | the exact Arkiv queries each screen made: **1** for a hit, **2** for a miss, 0 when cached in IndexedDB |

More CLI: `check <batch> --reader both` · `gap --src ka --min-days 60` · `changes --month 2026-06` · `snapshots` · `verify <entityKey>` (re-fetches the regulator's page and recomputes the row hash) · `mirror` · `agree`.

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
| Lifetime Extension as a lease | every mirror run renews all open gap leases in **one** batch tx (213 extensions incl. heartbeat = 2,130,000 gas on 16 Oct, tx `0x2b31c4e2…`) | "re-checked 2 h ago" + lease bar; stop checking and the row expires |
| Creation flags + sealing | alerts/changes/snapshots are `readonly` + `permissionlessExtension`, owner transferred to `0x…dEaD` in the creating batch | Proof drawer: "sealed: nobody can edit or delete it, including us" |
| Batches | create + seal; national alert + gap link; all lease renewals + heartbeat | a gap never shows "closed" without the alert that closed it |
| Open write path, `$creator` comparison | `kharab mirror` lets any wallet publish the same sealed shapes; `kharab agree` compares `rid → row` across two creators | "independently re-published, same row hash"; About → Independent mirrors |
| Second reader | the same query against the explorer's shadow RPC | `--reader both` → "2/2 readers agree" |

Full schema and the exact query strings: [arkiv/schema.md](arkiv/schema.md).

## What stays off Arkiv

Drug inspectors' names (removed even where the national portal embeds them; blocking scrubber with tests), your searches and saved list (IndexedDB on your phone only), keys and access keys (never in the bundle).

## Setup

```bash
npm i && npm test                      # 50 tests: normaliser, PII scrubber (inspector names), 25 verdict fixtures, lag, snapshot health, i18n parity
cd web && npm i && npx vite build      # → docs/ (relative base: works at a domain root and at /kharab-batch/)
KHARAB_SECRETS=/path/outside/repo/.env node mirror/run.mjs   # one mirror run (needs funded role keys)
bash scripts/e2e-both.sh                # 17 phone-viewport acceptance checks on both live URLs (installs chromium + playwright-core if missing)
```

## Hosting

- GitHub Pages from `main:/docs` (canonical): https://hapybeing.github.io/kharab-batch/
- Vercel static mirror (same `docs/` files, `scripts/deploy-vercel.mjs`): https://kharab-batch.vercel.app
- Surge (`kharab-batch.surge.sh`): planned; the Surge CLI token could not be obtained from the build sandbox on 14 Oct (see the repo history).
- The mirror runs on Hark's scheduler (00:40/06:40/12:40/18:40 IST) because Actions secrets can't be set from our tooling; every run commits `evidence/runs/*.json`.

QA evidence: `evidence/qa/` (end-to-end run on the public URL, Lighthouse mobile: performance 96, accessibility 100, best practices 100 on 14 Oct).

## Disclosure

Built 12–18 Oct 2026 inside the build window by Gaurang Kumar (Indian national, solo). **LLM use:** most of the code, docs and the video script were written by Hark, an AI agent (Anthropic Claude models), directed and reviewed by Gaurang. No pre-existing code. Data: public regulator pages only; inspectors' names are scrubbed before anything is written. MIT.

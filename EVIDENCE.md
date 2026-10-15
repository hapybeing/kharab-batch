# Evidence

Everything here can be checked on the Tiramisu explorer (`https://tiramisu.explorer.arkiv.network/tx/<hash>`, `/address/<wallet>`, `/entity/<key>`) or re-run from this repo. Nothing is a screenshot of a claim we can't reproduce.

## Live acceptance tests (both public URLs)

`bash scripts/e2e-both.sh` runs `scripts/e2e.mjs` in a fresh headless Chromium at 360×640 (Hindi locale) against https://hapybeing.github.io/kharab-batch/ and https://kharab-batch.vercel.app.

| Run | File | Result |
|---|---|---|
| 16 Oct 2026 | `evidence/qa/e2e-hapybeing.github.io-2026-10-16.json`, `evidence/qa/e2e-kharab-batch.vercel.app-2026-10-16.json` | all checks pass on both URLs, 0 console errors |
| 14 Oct 2026 | `evidence/qa/e2e-*-2026-10-14.json` | see `evidence/qa/README.md` (one 429 console line explained there) |

Checks: Hindi default · SR-13 red ≤ 2 s cold · 48-day lag · ≤ 3 queries per check · English toggle · R01GL2523 "not on the national portal" · KT26012 red + independent mirror agrees (no 1900 date) · random → grey + caveat · gap rows = Q4 · no "Jan 1900" in the gap ledger · inspector counts screen reads on a cold open · changed-feed counts + PDF sha · partial KA snapshot flagged · heartbeat hours render · independent mirror listed · 0 console errors.

## Third-party mirror (16 Oct 2026, ~01:17–01:25 IST)

Wallet `THIRD_PARTY_DEMO` = `0x1b793aD502B611e5E62cdc288F1741fc46166000`, generated fresh, funded 10 GLM by the Arkiv Hub faucet (SIWE + captcha token, `202 accepted`). **It is our wallet too**: the demo shows the open path works end to end, not that an outside operator exists yet.

| Step | Tx / key |
|---|---|
| sealed snapshot (MH, 165 rows read, 91 in date) | entity `0x87b3ca310af2954ed6902b69a94877d06fd25912d7b98c4601929730dd83a85d`, tx `0x9ffdec9893c4f35f4fecb2bdd5e43612961c3f2c87fef5553d24004e6645b6da` |
| 91 sealed alerts in 5 txs (20+20+20+20+11) | `0x7671d40435f39b6b00dc331638e1b00092dea805a1a06732265d209099e678a9`, `0x1b628ea6ea03f3bf8893fd0324c9a66d0ef22b07c793272f3ee1794cb882725e`, `0x9af0753ae6dc2e42b854040946dbc5cbc3f2fe16d5fb3a821b9b301a1a654eec`, `0x6643fe139ef4fd829cd17d3ec7f4139a70a7fa114ea3e7a1d19522f141b87aad`, `0x84cd3e79a373ca42792b26e075167e29b9903cf4e70a5878e4f409eb19886738` |
| heartbeat (label THIRD_PARTY_DEMO) | entity `0x9278bd89f3ca9eea4e245a3b4a76601144028c1d2bc3e252cf514fbb02170653`, create tx `0x0b66294912723c904c350ac469b7355faf71957bf06cde73511e47b6389de210`, renewal tx `0x3a73b2c54dd85f5e426f7f7d23dd1c45f1ef0342fdf2d59919203410f497d9ac` |
| first attempt (40+40 per tx) failed on the gas cap | recorded as arkiv/friction.md #14 |

Transcripts: `evidence/qa/third-party-mirror-mh-2026-10-16.txt` (first run incl. the failure, then the resumed run), `evidence/qa/third-party-mirror-mh-rerun-2026-10-16.txt` (idempotent re-run: 0 to write, heartbeat renewed), `evidence/qa/agree-mh-2026-10-16.txt` (`91/91 … AGREE`). Screens: `evidence/qa/indep-mirror-KT26012.png`, `evidence/qa/indep-mirror-about.png`.

## Operator mirror (sample transactions)

| What | Tx |
|---|---|
| first sealed CDSCO alert batch (create + changeOwnership → 0x…dEaD), 13 Oct 09:14 IST | `0x9cbe7a8ae122a8eb09dc6611a943b6f69e8f2bdab2f27ce634355f7b54c3fe1f` |
| one atomic lease-renewal batch: 213 extensions (212 gap leases + WATCH heartbeat), 16 Oct 00:41 IST | `0x2b31c4e2dc983555879a4960144da5c1ff37f0d085dc464c97f824a913a3d159` |
| every mirror run | `evidence/runs/*.json` (one file per run, committed) |

## CLI transcripts

`evidence/qa/cli-2026-10-16.txt`: `check R01GL2523`, `gap`, `changes --month 2026-06`, `check KT26012` (shows the independent re-publisher), `agree --src mh`. `evidence/qa/cli-2026-10-14.txt`: `check --reader both` 2/2 agree, `verify` MATCH on a Karnataka and a CDSCO alert, `snapshots` with the partial snapshot flagged.

## Data provenance

`evidence/history/pdf_sha256.json` (archived at-release PDFs behind every reconstructed change), `evidence/history/hm_diff.json`. PII gate: `npm run audit:pii` + `test/pii.test.mjs`.

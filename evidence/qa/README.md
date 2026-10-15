# QA evidence

## 16 Oct 2026
- `e2e-hapybeing.github.io-2026-10-16.json`, `e2e-kharab-batch.vercel.app-2026-10-16.json`: `bash scripts/e2e-both.sh` (fresh headless Chromium, 360×640, hi-IN). Confirms the two earlier unverified fixes are live (About heartbeat "last ran ≈ N h ago", no "[object Object]"; gap ledger has no "Jan 1900"), plus new checks: inspector header on a cold #/gap open, KT26012 independent-mirror line, About → Independent mirrors, Maharashtra undated list (no 1900), Kannada result card. When many runs come from one sandbox IP inside ~39 min, the public node returns HTTP 429 and the only failing check is "no console errors" (browser-logged 429; the app falls back to the explorer reader and every functional check still passes), same as 14 Oct below.
- `third-party-mirror-mh-2026-10-16.txt`, `third-party-mirror-mh-rerun-2026-10-16.txt`, `agree-mh-2026-10-16.txt`: THIRD_PARTY_DEMO mirror run (ours, disclosed) and the 91/91 agreement.
- `cli-2026-10-16.txt`: check R01GL2523, gap, changes, check KT26012, agree.
- `indep-mirror-KT26012.png`, `indep-mirror-about.png`: the two screens.

## 14 Oct 2026

- `e2e-kharab-batch.vercel.app-2026-10-14.json`: all 11 checks pass (scripts/e2e.mjs, fresh headless Chromium, 360×640).
- `e2e-hapybeing.github.io-2026-10-14.json`: the last run (≈12:00 IST). All 10 functional checks pass (SR-13 red, 48-day lag, ≤3 queries, Hindi→English, R01GL2523 not on the national portal, random → grey, gap rows = Q4 = 212, changed feed counts + PDF sha, partial KA snapshot flagged). The "no console errors" check failed **only** because, after ~15 test runs from one sandbox IP, the public node answered HTTP 429 (keyless read budget used up); the app fell back to the explorer's shadow RPC as designed and every answer was still correct. The browser itself logs "Failed to load resource: 429", which the app cannot suppress. An earlier run on the same URL, before the budget ran out, passed all 11 checks (commit 8cf4af9's predecessor runs; see PLAN.md review log). The commit message of 2954505 says "all D2 acceptance tests pass": that is true of the functional tests, not of this console-error check; corrected here rather than by rewriting history.
- `e2e-live-ws-local-2026-10-14.json` + `gap-live-ws.png`: D3 WebSocket test: 211 gap rows ticked "re-checked just now" while the screen stayed open, 0 HTTP reads in 198 s.
- `lighthouse-2026-10-14.json`: Lighthouse 12 mobile scores (sandbox Chromium; see PLAN.md for the note on sandbox layout cost).
- `cli-2026-10-14.txt`: `check --reader both` → 2/2 readers agree; `verify` → MATCH on a Karnataka and a CDSCO alert; `snapshots --src ka` with the partial snapshot flagged.

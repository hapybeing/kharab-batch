#!/usr/bin/env bash
# Run scripts/e2e.mjs against both live URLs from the Hark sandbox. Self-installing, so scheduled cycles never fail on a missing module.
#   bash scripts/e2e-both.sh            → evidence/qa/e2e-<host>-<date>.json, exit 1 if any check fails
set -u; cd "$(dirname "$0")/.."
command -v chromium >/dev/null || { sudo apt-get update -qq >/dev/null 2>&1; sudo apt-get install -y -qq chromium >/dev/null 2>&1; }
[ -d node_modules/playwright-core ] || npm i --no-audit --no-fund >/dev/null 2>&1
# Chromium cannot use the sandbox's authenticated HTTPS_PROXY from env (ERR_INVALID_AUTH_CREDENTIALS): pass it explicitly.
export PW=playwright-core PROXY_JSON=$(node -e 'const u=new URL(process.env.HTTPS_PROXY||process.env.https_proxy);console.log(JSON.stringify({server:`${u.protocol}//${u.host}`,username:decodeURIComponent(u.username),password:decodeURIComponent(u.password)}))')
d=$(TZ=Asia/Kolkata date +%F); rc=0
for u in https://hapybeing.github.io/kharab-batch/ https://kharab-batch.vercel.app/; do
  h=$(echo "$u" | cut -d/ -f3); f=evidence/qa/e2e-$h-$d.json
  BASE=$u timeout 150 node scripts/e2e.mjs > "$f" 2>&1 || rc=1
  node -e 'try{const o=require(process.argv[1]);console.log(process.argv[2],"fail="+o.fail,Object.entries(o.results).filter(([,v])=>!v.pass).map(([k])=>k).join("; "))}catch{console.log(process.argv[2],"CRASH (see file)")}' "./$f" "$h"
done
exit $rc

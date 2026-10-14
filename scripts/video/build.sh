#!/usr/bin/env bash
# Rebuild the demo video from scratch: live screen capture → narration → 1080p composite → captions.
#   PW=/path/to/playwright/index.mjs scripts/video/build.sh [build_dir]
# Needs: Node 22 + Playwright, Chromium (/usr/bin/chromium or CHROMIUM=…), ffmpeg 7 with libass, Python 3 + `pip install edge-tts`,
# fonts-noto-core (Noto Sans + Noto Sans Devanagari). Network: the live app, the Arkiv Tiramisu RPC/explorer, Microsoft TTS.
# In the Hark sandbox also: PROXY=1 PROXY_MOD=…/work/sdk/pwproxy.mjs for Chromium, and relay.py for edge-tts (aiohttp rejects the proxy user).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
export OUT="$(realpath -m "${1:-$HERE/build}")"; mkdir -p "$OUT"

# 1. the real CLI session shown in the terminal scene (only re-run when REFRESH_CLI=1, so the video matches the committed transcript)
if [ "${REFRESH_CLI:-0}" = 1 ]; then
  ( cd "$REPO"; { echo "# Real CLI session captured for the demo video, $(TZ=Asia/Kolkata date '+%a %Y-%m-%d %H:%M IST'), from a checkout of hapybeing/kharab-batch (Node $(node -v))"
    echo '$ node cli/kharab.mjs check SR-13 --reader both'; s=$(date +%s.%N); node cli/kharab.mjs check SR-13 --reader both; e=$(date +%s.%N); echo "# took $(python3 -c "print(round($e-$s,1))") s"
    echo '$ node cli/kharab.mjs verify 0x6455c19c89a20c6f9b15d07079d92cda7dfda0738b28c38fa791abba610eedb6'; s=$(date +%s.%N); node cli/kharab.mjs verify 0x6455c19c89a20c6f9b15d07079d92cda7dfda0738b28c38fa791abba610eedb6; e=$(date +%s.%N); echo "# took $(python3 -c "print(round($e-$s,1))") s"
  } > video/terminal-session.txt )
fi

# 2. narration (one clip per cue + word timings)
if [ -n "${HTTPS_PROXY:-}" ] && ! pgrep -f "relay.py" >/dev/null; then (setsid nohup python3 "$HERE/relay.py" 8899 >/tmp/relay.log 2>&1 </dev/null &); sleep 1; fi
env -u HTTPS_PROXY -u HTTP_PROXY TTS_PROXY="${HTTPS_PROXY:+http://127.0.0.1:8899}" python3 "$HERE/tts.py" "$OUT"

# 3. stills + live captures (a fresh Chromium; the keyless RPC budget is ~100 reads / 39 min, the run uses < 20)
node "$HERE/panels.mjs"
node "$HERE/capture.mjs" hook proof wallets sealed keeper
node "$HERE/capture.mjs" inspector gap changed term

# 4. compose (segments + narration + captions), then burn English and Hindi variants
python3 "$HERE/compose.py" "$OUT" plan
python3 "$HERE/compose.py" "$OUT" final en
python3 "$HERE/compose.py" "$OUT" final hi
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT/kharab-batch-demo.mp4"
echo "→ $OUT/kharab-batch-demo.mp4  $OUT/kharab-batch-demo-hi.mp4  $OUT/en.srt  $OUT/hi.srt"

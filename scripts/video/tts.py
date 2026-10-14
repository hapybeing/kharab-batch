#!/usr/bin/env python3
"""Narration: one edge-tts (Microsoft neural, en-IN) clip per cue + word timings.
   python3 tts.py <out_dir>   (needs relay.py running on 127.0.0.1:8899 in the Hark sandbox; elsewhere set TTS_PROXY='')"""
import asyncio, json, os, sys, subprocess
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(HERE, "script.json")))
OUT = sys.argv[1] if len(sys.argv) > 1 else "build"
os.makedirs(f"{OUT}/tts", exist_ok=True)
PROXY = os.environ.get("TTS_PROXY", "http://127.0.0.1:8899") or None

async def one(c):
    mp3, js = f"{OUT}/tts/{c['id']:02d}.mp3", f"{OUT}/tts/{c['id']:02d}.json"
    if os.path.exists(js) and os.path.getsize(mp3) > 0 and json.load(open(js)).get("key") == c["tts"] + S["rate"] + S["voice"]:
        return
    for attempt in range(3):
        try:
            com = edge_tts.Communicate(c["tts"], S["voice"], rate=S["rate"], boundary="WordBoundary", proxy=PROXY)
            words = []
            with open(mp3, "wb") as f:
                async for ch in com.stream():
                    if ch["type"] == "audio": f.write(ch["data"])
                    elif ch["type"] == "WordBoundary":
                        words.append({"t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7, "w": ch["text"]})
            dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).decode())
            json.dump({"key": c["tts"] + S["rate"] + S["voice"], "tts": c["tts"], "dur": dur, "words": words}, open(js, "w"))
            return
        except Exception as e:
            print("retry", c["id"], e, file=sys.stderr); await asyncio.sleep(3)
    raise SystemExit(f"TTS failed for cue {c['id']}")

async def main():
    for c in S["cues"]: await one(c)
    tot = sum(json.load(open(f"{OUT}/tts/{c['id']:02d}.json"))["dur"] for c in S["cues"])
    print(f"cues {len(S['cues'])} speech {tot:.1f}s")

asyncio.run(main())

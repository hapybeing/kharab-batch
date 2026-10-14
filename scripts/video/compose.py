#!/usr/bin/env python3
"""Assemble the demo: timeline from the narration, one 1080p segment per visual, captions (ASS burn + SRT en/hi).
   python3 compose.py <build_dir> plan     → timeline.json, en.srt, hi.srt, en.ass, hi.ass, narration.wav, segments
   python3 compose.py <build_dir> final <lang>   → burn captions (run in the background: ~1–2 min)
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
B = sys.argv[1]; MODE = sys.argv[2] if len(sys.argv) > 2 else "plan"
S = json.load(open(os.path.join(HERE, "script.json")))
PHONE = json.load(open(f"{B}/panels/phone.json"))
FPS = 30
LEAD, GAP, TAIL, END = 0.45, 0.32, 0.15, 1.6   # before a new visual, between cues, after last word, after the last cue
PHONE_VIS = {"hook", "lang", "who", "proof", "wallets", "proofexp", "inspector", "gap", "changed"}
DESK_VIS = {"sealed", "keeper"}

def sh(*a): subprocess.run(a, check=True)
def dur(p): return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).decode())

# ---------- timeline ----------
t = 0.0; cues = []; prev_vis = None
for c in S["cues"]:
    m = json.load(open(f"{B}/tts/{c['id']:02d}.json"))
    w = m["words"]; speech_end = w[-1]["t"] + w[-1]["d"] + TAIL
    t += LEAD if c["vis"] != prev_vis else GAP
    cues.append({**c, "start": round(t, 3), "len": round(speech_end, 3), "words": w})
    t += speech_end; prev_vis = c["vis"]
TOTAL = round(t + END, 3)
segs = []
for c in cues:
    if segs and segs[-1]["vis"] == c["vis"]: segs[-1]["cues"].append(c["id"])
    else: segs.append({"vis": c["vis"], "start": round(c["start"] - (LEAD if not segs else LEAD), 3), "cues": [c["id"]]})
segs[0]["start"] = 0.0
for i, s in enumerate(segs):
    s["end"] = segs[i + 1]["start"] if i + 1 < len(segs) else TOTAL
    s["dur"] = round(s["end"] - s["start"], 3)
byid = {c["id"]: c for c in cues}

# ---------- captions ----------
def chunks(c, lang):
    parts = c[lang].split("|"); en_parts = c["en"].split("|")
    w = c["words"]; total = sum(len(x) for x in en_parts)
    times, acc = [0.0], 0
    wl = [x["w"] for x in w]; wchars = [len(x) + 1 for x in wl]; wt = sum(wchars)
    for p in en_parts[:-1]:
        acc += len(p); f = acc / total; cum = 0
        for x, wc in zip(w, wchars):
            cum += wc
            if cum / wt >= f: times.append(x["t"] + x["d"]); break
    out = []
    for i, p in enumerate(parts):
        a = c["start"] + (times[i] if i else 0)
        b = c["start"] + (times[i + 1] if i + 1 < len(times) else c["len"])
        out.append((a, b + (0.25 if i + 1 == len(parts) else 0), p.strip()))
    return out

def ts(x, sep=","):
    h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f"{h:02d}:{m:02d}:{int(s):02d}{sep}{int(round((s - int(s)) * 1000)) % 1000:03d}"
def ass_ts(x): return f"{int(x // 3600)}:{int(x % 3600 // 60):02d}:{x % 60:05.2f}"

def write_subs(lang):
    srt, ev = [], []
    n = 0
    for c in cues:
        style = "Side" if c["vis"] in PHONE_VIS else "Full"
        for a, b, txt in chunks(c, lang):
            n += 1; srt.append(f"{n}\n{ts(a)} --> {ts(b)}\n{txt}\n")
            ev.append(f"Dialogue: 0,{ass_ts(a)},{ass_ts(b)},{style},,0,0,0,,{txt}")
    open(f"{B}/{lang}.srt", "w").write("\n".join(srt))
    font = "Noto Sans Devanagari" if lang == "hi" else "Noto Sans"
    hdr = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Side,{font},42,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,3,14,0,2,800,70,46,1
Style: Full,{font},42,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,1,0,0,0,100,100,0,0,3,14,0,2,150,150,36,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    open(f"{B}/{lang}.ass", "w").write(hdr + "\n".join(ev) + "\n")

# ---------- segments ----------
def clip_meta(name):
    p = f"{B}/clips/{name}.json"
    return json.load(open(p)) if os.path.exists(p) else {}

def build_seg(i, s):
    vis, D = s["vis"], s["dur"]; out = f"{B}/seg/{i:02d}_{vis}.mp4"
    enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS), "-t", f"{D:.3f}", "-an"]
    if vis in ("close", "proofexp"):
        bg = f"{B}/panels/{vis}.png"
        if vis == "close":
            sh("ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", bg, "-vf", "format=yuv420p", *enc, out)
        else:  # still: the Proof drawer's Entity Expiration line (last frame of the proof clip)
            sh("ffmpeg", "-y", "-v", "error", "-sseof", "-0.2", "-i", f"{B}/clips/proof.mp4", "-frames:v", "1", "-update", "1", f"{B}/seg/proof_last.png")
            fc = f"[1:v]scale={PHONE['w']}:{PHONE['h']}:flags=lanczos[p];[0:v][p]overlay={PHONE['x']}:{PHONE['y']},format=yuv420p"
            sh("ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", bg, "-loop", "1", "-i", f"{B}/seg/proof_last.png", "-filter_complex", fc, *enc, out)
        return out
    clip = f"{B}/clips/{vis}.mp4"; L = clip_meta(vis).get("seconds") or dur(clip)
    pre = []; start_pad = 0.0; speed = 1.0; inpoint = 0.0; hold_from = None
    if vis == "hook":   # land the verdict on "Red, in under two seconds"
        mk = clip_meta("hook")["markers"]; target = byid[3]["start"] - s["start"] - 0.1
        delta = target - mk["verdict"]
        if delta >= 0: start_pad = delta
        else: inpoint = -delta
    elif vis == "term":  # replay of the real transcript: fit so the MATCH line lands before the segment ends
        speed = max(1.0, (clip_meta("term")["markers"]["verify_done"] + 1.5) / D)
    elif L > D:
        speed = min(L / D, 1.45)
    vf = []
    if inpoint: pre += ["-ss", f"{inpoint:.3f}"]
    chain = f"setpts=PTS/{speed:.4f}" if speed != 1 else "setpts=PTS"
    if hold_from is not None: chain = f"trim=0:{hold_from},setpts=PTS-STARTPTS"
    chain += f",tpad=start_duration={start_pad:.3f}:start_mode=clone:stop_mode=clone:stop_duration={D + 5:.3f}"
    if vis in PHONE_VIS:
        fc = f"[1:v]{chain},scale={PHONE['w']}:{PHONE['h']}:flags=lanczos[p];[0:v][p]overlay={PHONE['x']}:{PHONE['y']}:shortest=0,format=yuv420p"
        sh("ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", f"{B}/panels/{vis}.png", *pre, "-i", clip, "-filter_complex", fc, *enc, out)
    elif vis in DESK_VIS:
        fc = f"[1:v]{chain},scale=1728:810:flags=lanczos[p];[0:v][p]overlay=96:20,format=yuv420p"
        sh("ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", f"{B}/panels/{vis}.png", *pre, "-i", clip, "-filter_complex", fc, *enc, out)
    else:  # term: already 1920×1080
        sh("ffmpeg", "-y", "-v", "error", *pre, "-i", clip, "-vf", chain + ",format=yuv420p", *enc, out)
    s.update({"speed": speed, "start_pad": round(start_pad, 3), "inpoint": round(inpoint, 3), "clip_len": round(L, 2)})
    return out

def narration():
    parts = []; t = 0.0; lst = []
    os.makedirs(f"{B}/aud", exist_ok=True)
    for c in cues:
        gap = c["start"] - t
        sil = f"{B}/aud/s{c['id']:02d}.wav"; sh("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", f"{gap:.3f}", sil)
        cw = f"{B}/aud/c{c['id']:02d}.wav"; sh("ffmpeg", "-y", "-v", "error", "-i", f"{B}/tts/{c['id']:02d}.mp3", "-t", f"{c['len']:.3f}", "-ar", "24000", "-ac", "1", "-af", "afade=t=out:st=%.3f:d=0.12" % (c['len'] - 0.12), cw)
        lst += [sil, cw]; t = c["start"] + c["len"]
    sil = f"{B}/aud/end.wav"; sh("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", f"{TOTAL - t:.3f}", sil); lst.append(sil)
    open(f"{B}/aud/list.txt", "w").write("".join(f"file '{os.path.abspath(x)}'\n" for x in lst))
    sh("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", f"{B}/aud/list.txt", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", f"{B}/narration.wav")

if MODE == "plan":
    os.makedirs(f"{B}/seg", exist_ok=True)
    write_subs("en"); write_subs("hi"); narration()
    only = set(filter(None, os.environ.get("ONLY", "").split(",")))
    files = []
    for i, s in enumerate(segs):
        f = f"{B}/seg/{i:02d}_{s['vis']}.mp4"
        files.append(build_seg(i, s) if (not only or s["vis"] in only or not os.path.exists(f)) else f)
    open(f"{B}/seg/list.txt", "w").write("".join(f"file '{os.path.abspath(f)}'\n" for f in files))
    sh("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", f"{B}/seg/list.txt", "-c", "copy", f"{B}/base.mp4")
    json.dump({"total": TOTAL, "segments": segs, "cues": [{k: v for k, v in c.items() if k != "words"} for c in cues]}, open(f"{B}/timeline.json", "w"), indent=1, ensure_ascii=False)
    print("total", TOTAL, "base", dur(f"{B}/base.mp4"))
    for s in segs: print(f"{s['start']:7.2f} {s['dur']:6.2f} {s['vis']:10s} cues {s['cues']} {s.get('speed','')} pad {s.get('start_pad','')} in {s.get('inpoint','')} clip {s.get('clip_len','')}")
elif MODE == "final":
    lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    out = f"{B}/kharab-batch-demo{'' if lang == 'en' else '-' + lang}.mp4"
    # burned captions in `lang`; soft subtitle tracks: English + Hindi (mov_text)
    sh("ffmpeg", "-y", "-v", "error", "-i", f"{B}/base.mp4", "-i", f"{B}/narration.wav", "-i", f"{B}/en.srt", "-i", f"{B}/hi.srt",
       "-map", "0:v", "-map", "1:a", "-map", "2", "-map", "3", "-vf", f"ass={B}/{lang}.ass",
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
       "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata:s:s:0", "title=English", "-metadata:s:s:1", "language=hin", "-metadata:s:s:1", "title=हिंदी",
       "-metadata", "title=Kharab Batch? (ख़राब बैच?) — demo", "-movflags", "+faststart", "-t", f"{dur(B + '/base.mp4'):.3f}", out)
    print(out, dur(out))

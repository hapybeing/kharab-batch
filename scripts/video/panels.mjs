// 1920×1080 backgrounds: phone scenes get a phone bezel on the left and a fact panel on the right; full-frame scenes
// (explorer, terminal) get a label strip; the closing card lists the links and the friction items.
// Every fact here is from work/verify/VERIFICATION.md, README.md or arkiv/friction.md.
//   PW=… OUT=build node panels.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(process.env.PW || "playwright");
const OUT = process.env.OUT || "build";
fs.mkdirSync(`${OUT}/panels`, { recursive: true });
export const PHONE = { x: 190, y: 64, w: 522, h: 928 }; // where compose.py overlays the 720×1280 phone clip

const P = {
  hook: { k: "Kharab Batch? · ख़राब बैच?", h: "Type the batch number on your medicine. See every regulator's alert.", b: [
    "Coldrif cough syrup, batch SR-13: linked to the deaths of at least 24 children (Oct 2025)",
    "Telangana stop-use notice: 4 Oct 2025",
    "CDSCO national list OCT-2025, declared 21 Nov 2025: <b>48 days later</b>"],
    s: "Telangana DCA Press Note 78/DCA/2025 · The Hindu, 11 Oct 2025 · IANS (list declared 21 Nov 2025)" },
  lang: { k: "Why India", h: "Drug warnings are scattered across regulators", b: [
    "State drug controllers, WHO and the national CDSCO list publish separately, in different formats",
    "One box checks every publisher we mirror",
    "Hindi by default, English in one tap · phone-first · no login, no wallet"],
    s: "Not medical advice: a public-interest index of what regulators published, word for word" },
  who: { k: "Why India", h: "What the national list does not carry", b: [
    "R01GL2523: in WHO Alert N°5/2025 and a Telangana stop-use notice; no CDSCO row (NSQ or spurious), Jan 2024 – Aug 2026",
    "Karnataka: <b>267 of 428</b> distinct findings (Jan 2025 – Jul 2026) have no CDSCO row with that batch",
    "A state result can be challenged: “not on the national list” is about publication, not a verdict on the batch"],
    s: "CDSCO portal fetched 13 Oct 2026 · method and hand-checked sample: work/verify, scripts/evidence" },
  proof: { k: "Why Arkiv", h: "A record that nobody can quietly rewrite, including us", b: [
    "<code>$creator</code>: the publisher's own mirror wallet",
    "<code>$owner</code> = 0x…dEaD: sealed in the creating transaction",
    "Creation flags: readonly + permissionless extension"],
    s: "Proof drawer on every card · live data, Arkiv Tiramisu testnet" },
  wallets: { k: "Why Arkiv · $creator", h: "One mirror wallet per publisher", b: [
    "MIRROR_CDSCO · MIRROR_KA · MIRROR_MH · CURATOR (Telangana / WHO notices)",
    "Verdicts count only allowlisted creators; unknown writers are hidden",
    "Open write path: anyone can run <code>kharab mirror</code>; a fresh faucet wallet re-published 91 Maharashtra rows, <code>kharab agree</code>: 91/91 identical (that demo wallet is ours too: disclosed)"],
    s: "wallets.json · arkiv/schema.md" },
  proofexp: { k: "Arkiv · Entity Expiration", h: "A warning lives as long as the batch can be sold", b: [
    "Alert: printed expiry + 30 days (SR-13: 31 May 2027)",
    "Gap lease 36 h · heartbeat 30 h · snapshot and change 400 days",
    "After expiry: “kept as record”, never red"],
    s: "arkiv/schema.md §Lifetimes" },
  inspector: { k: "How we use Arkiv", h: "One Arkiv query per check", b: [
    "<code>app = str('kharab') AND batch = str('SR13')</code>",
    "Keyless reads from a static site, cached on the phone (IndexedDB)",
    "No timers, no polling: every read is listed in the inspector"],
    s: "Typed attributes: batch, src, class are str; exp_ym, src_ym, since_ymd are u64" },
  gap: { k: "How we use Arkiv · Lifetime Extension", h: "Each gap is a lease, renewed only while it is true", b: [
    "Every mirror run extends all open gap leases in one batch transaction",
    "Stop re-checking and the row expires on its own",
    "One filtered <code>eth_subscribe</code>: live test, 211 rows ticked, 0 HTTP reads in 198 s"],
    s: "evidence/qa/e2e-live-ws-local-2026-10-14.json" },
  changed: { k: "What changed, and when", h: "The national list is edited after release", b: [
    "Jun 2026: <b>+34</b> rows added after release",
    "May 2026: <b>2</b> moved to the spurious list",
    "Dec 2025: <b>3</b> removed from every month",
    "Seven monthly lists vs archived at-release PDFs (sha256 on chain): ≥137 added · 6 reclassified · 3 removed"],
    s: "At-release PDFs (The Health Master) vs CDSCO portal snapshot of 13 Oct 2026" },
};
const LABEL = {
  sealed: "Arkiv explorer · the SR-13 CDSCO alert: CREATE and TRANSFER to 0x…dEaD in the same transaction, Entity Expiration set",
  keeper: "Arkiv explorer · Lifetime Extension of a sealed alert, sent from our labelled KEEPER_DEMO wallet (0x024f…B876)",
};
const friction = fs.readFileSync(path.join(HERE, "../../arkiv/friction.md"), "utf8").split("\n").filter(l => /^### \d+\./.test(l)).map(l => l.replace(/^### /, "").replace(/`/g, "").replace(/\*/g, ""));

const css = `body{margin:0;width:1920px;height:1080px;overflow:hidden;background:radial-gradient(circle at 20% 30%,#1e293b,#0b1020 70%);color:#e2e8f0;font-family:"Noto Sans","Noto Sans Devanagari",sans-serif}
code{font-family:"DejaVu Sans Mono",monospace;font-size:.85em;color:#fde68a}b{color:#fca5a5}`;
const phoneBg = (k, v) => `<!doctype html><meta charset="utf-8"><style>${css}
.ph{position:absolute;left:${PHONE.x - 14}px;top:${PHONE.y - 14}px;width:${PHONE.w + 28}px;height:${PHONE.h + 28}px;border-radius:44px;background:#020617;box-shadow:0 30px 80px #000a,0 0 0 2px #334155}
.r{position:absolute;left:800px;top:84px;width:1040px}
.k{font-size:26px;letter-spacing:.06em;text-transform:uppercase;color:#38bdf8;font-weight:700}
h1{font-size:50px;line-height:1.15;margin:16px 0 30px;color:#f8fafc}
ul{margin:0;padding-left:34px}li{font-size:31px;line-height:1.36;margin:0 0 18px}
.s{margin-top:22px;font-size:20px;color:#94a3b8}</style>
<div class="ph"></div><div class="r"><div class="k">${v.k}</div><h1>${v.h}</h1><ul>${v.b.map(x => `<li>${x}</li>`).join("")}</ul><div class="s">${v.s}</div></div>`;
const fullBg = t => `<!doctype html><meta charset="utf-8"><style>${css}.l{position:absolute;left:96px;top:846px;font-size:25px;color:#cbd5e1}.f{position:absolute;left:94px;top:18px;width:1732px;height:812px;box-shadow:0 0 0 2px #334155;border-radius:6px}</style><div class="f"></div><div class="l">${t}</div>`;
const close = `<!doctype html><meta charset="utf-8"><style>${css}
.c{position:absolute;left:110px;top:70px;width:1700px}h1{font-size:72px;margin:0;color:#f8fafc}h1 span{color:#fca5a5}
.u{font-size:50px;margin:26px 0 6px;color:#7dd3fc;font-family:"DejaVu Sans Mono",monospace}.u2{font-size:30px;color:#94a3b8;font-family:"DejaVu Sans Mono",monospace}
.g{margin-top:40px;font-size:27px;color:#38bdf8;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
ol{columns:2;column-gap:60px;margin:12px 0 0;padding-left:34px}ol li{font-size:26px;line-height:1.35;margin-bottom:6px;color:#cbd5e1;break-inside:avoid}
.n{margin-top:22px;font-size:24px;color:#94a3b8}</style>
<div class="c"><h1>Kharab Batch? <span>ख़राब बैच?</span></h1>
<div class="u">hapybeing.github.io/kharab-batch</div><div class="u2">mirror: kharab-batch.vercel.app · code (MIT): github.com/hapybeing/kharab-batch</div>
<div class="g">Arkiv friction, each reproduced (arkiv/friction.md)</div><ol>${friction.map(f => `<li>${f.replace(/^\d+\.\s*/, "")}</li>`).join("")}</ol>
<div class="n">Arkiv Tiramisu testnet · Not medical advice: a lab result covers only the batch tested.</div></div>`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/usr/bin/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const shot = async (name, html) => { await pg.setContent(html); await pg.waitForTimeout(150); await pg.screenshot({ path: `${OUT}/panels/${name}.png` }); };
for (const [k, v] of Object.entries(P)) await shot(k, phoneBg(k, v));
for (const [k, t] of Object.entries(LABEL)) await shot(k, fullBg(t));
await shot("close", close);
await b.close();
fs.writeFileSync(`${OUT}/panels/phone.json`, JSON.stringify(PHONE));
console.log("panels", Object.keys(P).length + Object.keys(LABEL).length + 1, "friction items", friction.length);

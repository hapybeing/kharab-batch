// Screen capture of the LIVE app and the Arkiv explorer for the demo video. No mock-ups: every frame is the public site
// rendered by headless Chromium (CDP screencast), phone clips at 360×640 CSS px × DPR 2 (720×1280), desktop at 1280×600 × 1.5 (1920×900).
//   PW=/path/playwright/index.mjs OUT=build node capture.mjs [clip ...]
// In the Hark sandbox: PROXY=1 routes Chromium through the sandbox proxy (work/sdk/pwproxy.mjs).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const { chromium } = await import(process.env.PW || "playwright");
const OUT = process.env.OUT || "build";
const BASE = (process.env.BASE || "https://hapybeing.github.io/kharab-batch/").replace(/\/?$/, "/");
const EXPLORER = "https://tiramisu.explorer.arkiv.network";
const SR13_CDSCO = "0x6455c19c89a20c6f9b15d07079d92cda7dfda0738b28c38fa791abba610eedb6"; // CDSCO national alert for SR13 (sealed)
const KEEP_TX = "0x2e0b7704075bbedf350c7910a3a5723452d44c0e4550cd248a882cd023fdb3a1";    // KEEPER_DEMO Lifetime Extension of a sealed alert
fs.mkdirSync(`${OUT}/clips`, { recursive: true });

const launch = { executablePath: process.env.CHROMIUM || "/usr/bin/chromium", args: ["--no-sandbox", "--hide-scrollbars"] };
if (process.env.PROXY) launch.proxy = (await import(process.env.PROXY_MOD || "../../../work/sdk/pwproxy.mjs")).proxyOpt();
const browser = await chromium.launch(launch);
const errors = [];

async function phone(lang = "hi") {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === "hi" ? "hi-IN" : "en-IN" });
  await ctx.addInitScript(l => { if (!localStorage.getItem("kb_lang")) localStorage.setItem("kb_lang", l); }, lang);
  const p = await ctx.newPage();
  p.on("console", m => m.type() === "error" && errors.push(m.text())); p.on("pageerror", e => errors.push(String(e)));
  return p;
}
async function desktop() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 1.5 });
  return ctx.newPage();
}

// CDP screencast recorder → constant-30-fps H.264 clip; markers are seconds from clip start.
async function record(name, page, size, fn) {
  const dir = `${OUT}/clips/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = []; let t0 = null; const markers = {};
  cdp.on("Page.screencastFrame", async f => {
    const ts = f.metadata.timestamp; if (t0 === null) t0 = ts;
    const file = `${dir}/f${String(frames.length).padStart(5, "0")}.jpg`;
    fs.writeFileSync(file, Buffer.from(f.data, "base64")); frames.push({ file, t: ts - t0 });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => { });
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: size[0], maxHeight: size[1], everyNthFrame: 1 });
  const wall0 = Date.now() / 1000;
  const mark = k => { markers[k] = Date.now() / 1000 - wall0; };
  await page.waitForTimeout(400);
  await fn(mark);
  const end = Date.now() / 1000 - wall0;
  await cdp.send("Page.stopScreencast"); await page.waitForTimeout(200);
  if (!frames.length) throw new Error("no frames for " + name);
  // screencast timestamps start at the first frame, wall clock at startScreencast; align on wall clock (offset ≈ first frame latency)
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const d = (i + 1 < frames.length ? frames[i + 1].t : Math.max(end, frames[i].t + 0.1)) - frames[i].t;
    lines.push(`file '${frames[i].file.split("/").pop()}'`, `duration ${Math.max(d, 0.001).toFixed(4)}`);
  }
  lines.push(`file '${frames.at(-1).file.split("/").pop()}'`);
  fs.writeFileSync(`${dir}/list.txt`, lines.join("\n"));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${dir}/list.txt`, "-vf", `fps=30,scale=${size[0]}:${size[1]}:flags=lanczos,format=yuv420p`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", `${OUT}/clips/${name}.mp4`]);
  fs.writeFileSync(`${OUT}/clips/${name}.json`, JSON.stringify({ frames: frames.length, seconds: end, markers, at: new Date().toISOString() }));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(name, frames.length, "frames", end.toFixed(1) + "s", JSON.stringify(markers));
}
const PH = [720, 1280], DT = [1920, 900];
const smooth = (p, sel, block = "center") => p.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: b }), [sel, block]);
const scrollBy = (p, y) => p.evaluate(y => window.scrollBy({ top: y, behavior: "smooth" }), y);

const CLIPS = {
  // Hook + lang + who: one cold Hindi session, continuous
  async hook() {
    const p = await phone("hi");
    await p.goto(BASE, { waitUntil: "networkidle" });
    await record("hook", p, PH, async mark => {
      await p.waitForTimeout(4200);
      mark("type"); await p.type("#batch", "SR-13", { delay: 170 }); await p.waitForTimeout(250);
      mark("submit"); await p.click(".search button");
      await p.waitForSelector("[data-verdict]", { timeout: 20000 }); mark("verdict");
      await p.waitForTimeout(3500);
      await smooth(p, "[data-lag]"); await p.waitForTimeout(1200); mark("lag");
      await p.waitForTimeout(6500);
    });
    await record("lang", p, PH, async mark => {
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await p.waitForTimeout(1300);
      mark("en"); await p.click(".langs button[lang=en]"); await p.waitForTimeout(2200);
      await smooth(p, ".pubs", "start"); await p.waitForTimeout(3000);
      await scrollBy(p, 260); await p.waitForTimeout(3500);
    });
    await record("who", p, PH, async mark => {
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await p.waitForTimeout(900);
      await p.fill("#batch", ""); await p.type("#batch", "R01GL2523", { delay: 110 }); await p.click(".search button");
      await p.waitForFunction(() => document.querySelector("[data-national=absent]"), null, { timeout: 20000 }); mark("verdict");
      await p.waitForTimeout(1800);
      await smooth(p, "[data-national=absent]"); await p.waitForTimeout(9000);
    });
    await p.context().close();
  },
  async proof() {
    const p = await phone("en");
    await p.goto(BASE + "#/b/SR13"); await p.waitForSelector("[data-verdict]", { timeout: 20000 }); await p.waitForTimeout(500);
    await record("proof", p, PH, async mark => {
      const s = await p.$$("details.proof summary"); const last = s.at(-1);
      await last.scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
      await last.click(); mark("open"); await p.waitForTimeout(700);
      await p.evaluate(() => { const d = [...document.querySelectorAll("details.proof")].at(-1); window.scrollTo({ top: d.getBoundingClientRect().top + scrollY - 70, behavior: "smooth" }); });
      await p.waitForTimeout(5200);
    });
    await p.context().close();
  },
  async wallets() {
    const p = await phone("en");
    await p.goto(BASE + "#/about"); await p.waitForSelector("[data-partial]", { timeout: 30000 }); await p.waitForTimeout(1500);
    // the "Publisher wallets (creators)" list: one creator wallet per publisher mirror
    await p.evaluate(() => { const ul = [...document.querySelectorAll("ul.small.mono")].at(-1); const h = ul.previousElementSibling || ul; window.scrollTo({ top: h.getBoundingClientRect().top + scrollY - 60 }); });
    await p.waitForTimeout(600);
    await record("wallets", p, PH, async () => { await p.waitForTimeout(6500); });
    await p.context().close();
  },
  async sealed() {
    const p = await desktop();
    await p.goto(`${EXPLORER}/entity/${SR13_CDSCO}`, { waitUntil: "networkidle", timeout: 45000 }); await p.waitForTimeout(1500);
    await record("sealed", p, DT, async () => {
      await p.waitForTimeout(2200);
      await p.evaluate(() => window.scrollTo({ top: 9999, behavior: "smooth" })); await p.waitForTimeout(6500);
    });
  },
  async keeper() {
    const p = await desktop();
    await p.goto(`${EXPLORER}/tx/${KEEP_TX}`, { waitUntil: "networkidle", timeout: 45000 }); await p.waitForTimeout(1500);
    await record("keeper", p, DT, async () => {
      await p.waitForTimeout(3500);
      await p.evaluate(() => window.scrollTo({ top: 9999, behavior: "smooth" })); await p.waitForTimeout(5500);
    });
  },
  async inspector() {
    const p = await phone("en");
    await p.goto(BASE + "#/b/SR13"); await p.waitForSelector("[data-verdict]", { timeout: 20000 }); await p.waitForTimeout(800);
    await p.evaluate(() => { const d = document.querySelector("details.inspector"); d.open = true; });
    await p.waitForTimeout(400);
    await p.evaluate(() => { const d = document.querySelector("details.inspector"); window.scrollTo({ top: d.getBoundingClientRect().top + scrollY - 40 }); });
    await p.waitForTimeout(400);
    await record("inspector", p, PH, async () => { await p.waitForTimeout(4500); });
    await p.context().close();
  },
  async gap() {
    // top of the ledger (count, oldest rows with lease bars), then straight to the inspector's WebSocket line
    const p = await phone("en");
    await p.goto(BASE + "#/gap"); await p.waitForSelector("[data-q4]", { timeout: 30000 }); await p.waitForTimeout(800);
    await p.evaluate(() => window.scrollTo({ top: 0 }));
    await record("gap", p, PH, async mark => {
      await p.waitForTimeout(9200);
      await p.evaluate(() => { const d = document.querySelector("details.inspector"); d.open = true; });
      await p.waitForTimeout(150);
      await p.evaluate(() => { const b = document.querySelector("[data-ws-status]"); window.scrollTo({ top: b.getBoundingClientRect().top + scrollY - 330 }); });
      mark("ws"); await p.waitForTimeout(10000);
    });
    await p.context().close();
  },
  async changed() {
    const p = await phone("en");
    await p.goto(BASE + "#/changed"); await p.waitForSelector("[data-month]", { timeout: 30000 }); await p.waitForTimeout(800);
    const top = (sel, off) => p.evaluate(([s, o]) => { const e = document.querySelector(s); window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - o, behavior: "smooth" }); }, [sel, off]);
    await record("changed", p, PH, async mark => {
      await p.waitForTimeout(3500);
      await top('[data-month="202606"]', 60); await p.waitForTimeout(3200); mark("jun");
      await p.click('[data-month="202606"] summary'); await p.waitForTimeout(300);
      await p.click('[data-month="202605"] summary'); await top('[data-month="202605"]', 60); await p.waitForTimeout(3200); mark("may");
      await p.click('[data-month="202605"] summary'); await p.waitForTimeout(300);
      // December: summary, archived-PDF sha and the three removed rows only
      await p.click('[data-month="202512"] summary'); await top('[data-month="202512"]', 60); mark("dec"); await p.waitForTimeout(5500);
      await p.click('[data-month="202512"] summary'); await p.waitForTimeout(300);
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await p.waitForTimeout(6000);
    });
    await p.context().close();
  },
};

// Terminal: the real CLI transcript replayed (term.mjs writes OUT/term.html)
CLIPS.term = async () => {
  await import("./term.mjs");
  const p = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await p.goto("file://" + fs.realpathSync(`${OUT}/term.html`));
  await record("term", p, [1920, 1080], async mark => {
    await p.waitForFunction(() => window.done0, null, { timeout: 30000 }); mark("check_done");
    await p.waitForFunction(() => window.done1, null, { timeout: 30000 }); mark("verify_done");
    await p.waitForTimeout(2500);
  });
};

const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS);
for (const k of want) {
  for (let a = 1; a <= 2; a++) {
    try { await CLIPS[k](); break; } catch (e) { console.log("clip", k, "attempt", a, "failed:", e.message.split("\n")[0]); if (a === 2) process.exitCode = 1; await new Promise(r => setTimeout(r, 5000)); }
  }
}
fs.writeFileSync(`${OUT}/clips/console-errors.json`, JSON.stringify(errors, null, 1));
console.log("console errors:", errors.length);
await browser.close();

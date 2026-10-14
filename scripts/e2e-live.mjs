// D3 live test: open the Gap ledger, keep it open, count every HTTP request to an Arkiv reader while a mirror run renews the
// gap leases elsewhere. Pass = rows tick "re-checked just now" over the WebSocket with ZERO extra HTTP reads (no polling).
//   PW=… BASE=… WAIT_S=110 node scripts/e2e-live.mjs
const { chromium } = await import(process.env.PW || "playwright");
const BASE = (process.env.BASE || "http://127.0.0.1:8080/").replace(/\/?$/, "/");
const launch = { executablePath: process.env.CHROMIUM || "/usr/bin/chromium", args: ["--no-sandbox"] };
if (process.env.PROXY_JSON) launch.proxy = JSON.parse(process.env.PROXY_JSON);
const b = await chromium.launch(launch);
const page = await (await b.newContext({ viewport: { width: 360, height: 640 }, isMobile: true })).newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e))); page.on("console", m => m.type() === "error" && errors.push(m.text()));
let reads = 0, armed = false; page.on("request", r => { if (armed && /tiramisu/.test(r.url()) && r.method() === "POST") reads++; });
let wsFrames = 0; page.on("websocket", ws => ws.on("framereceived", () => wsFrames++));
await page.goto(BASE + "#/gap"); await page.waitForSelector("[data-q4]", { timeout: 30000 });
armed = true; const t0 = Date.now();
const until = Date.now() + (+process.env.WAIT_S || 100) * 1000;
let fresh = 0;
while (Date.now() < until) { await page.waitForTimeout(3000); fresh = await page.$$eval("[data-fresh='1']", l => l.length); if (fresh >= +(process.env.EXPECT || 1) && Date.now() - t0 > 20000) break; }
await page.click(".inspector summary");
const ws = await page.getAttribute("[data-ws-events]", "data-ws-events"), status = await page.getAttribute("[data-ws-status]", "data-ws-status");
if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + "/gap-live.png" });
const out = { base: BASE, seconds_open: Math.round((Date.now() - t0) / 1000), rows_ticked_live: fresh, ws_status: status, ws_events_matched: +ws, ws_frames: wsFrames, http_reads_while_open: reads, errors };
out.pass = fresh > 0 && reads === 0 && status === "live" && errors.length === 0;
console.log(JSON.stringify(out, null, 1)); await b.close(); process.exit(out.pass ? 0 : 1);

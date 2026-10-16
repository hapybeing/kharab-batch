// Embed check: a third-party host page loads widget.js, gets a sandboxed iframe, the check runs inside it, and the frame resizes.
//   BASE=https://hapybeing.github.io/kharab-batch/ PW=playwright-core PROXY_JSON=… node scripts/e2e-embed.mjs
const { chromium } = await import(process.env.PW || "playwright");
const BASE = (process.env.BASE || (process.env.DOCS ? "http://kb.local/" : "http://127.0.0.1:8765/")).replace(/\/?$/, "/");
const launch = { executablePath: process.env.CHROMIUM || "/usr/bin/chromium", args: ["--no-sandbox"] };
if (process.env.PROXY_JSON) launch.proxy = JSON.parse(process.env.PROXY_JSON);
const browser = await chromium.launch(launch);
const HOST = process.env.SAMESITE ? BASE + "__host/" : (BASE.startsWith("https") ? "https://pharmacy.example/" : "http://pharmacy.example/");
// DOCS=docs serves the built folder from disk at http://kb.local/ (no dev server needed, and sandbox loopback is flaky)
const fs = await import("node:fs"), path = await import("node:path");
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: +(process.env.DSF || 2) });
const page = await ctx.newPage();
if (process.env.DOCS) await ctx.route("http://kb.local/**", r => { let f = new URL(r.request().url()).pathname; if (f.endsWith("/")) f += "index.html"; const fp = path.join(process.env.DOCS, f); if (!fs.existsSync(fp)) return r.fulfill({ status: 404, body: "" }); const ext = path.extname(fp); r.fulfill({ body: fs.readFileSync(fp), contentType: { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".webmanifest": "application/manifest+json" }[ext] || "application/octet-stream" }); });
const errors = []; page.on("response", r => { if (r.status() >= 400) errors.push("HTTP " + r.status() + " " + r.url()); }); page.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); page.on("pageerror", e => errors.push(String(e)));
let wsCount = 0; page.on("websocket", () => wsCount++);
const out = { base: BASE, results: {} }; let fail = 0;
const ok = (n, c, i) => { out.results[n] = { pass: !!c, ...(i || {}) }; if (!c) fail++; };
// host page on another origin (route-fulfilled), as a pharmacy site would write it
await page.route(HOST + "**", r => r.fulfill({ contentType: "text/html", body: `<!doctype html><meta name=viewport content="width=device-width"><link rel=icon href=data:,><body style="font-family:sans-serif;padding:12px"><h2>Shree Medicals</h2><p>Check your batch:</p><div data-kharab-batch data-lang="en" data-batch="SR-13"></div><script async src="${BASE}widget.js"></script>` }));
await page.goto(HOST);
const fh = await page.waitForSelector("iframe", { timeout: 10000 });
const frame = await fh.contentFrame();
ok("iframe sandboxed + titled", (await fh.getAttribute("sandbox")) === "allow-scripts allow-same-origin allow-popups" && /check a medicine batch/.test(await fh.getAttribute("title")));
await frame.waitForSelector("[data-verdict]", { timeout: 20000 });
ok("embed: SR-13 red inside the frame", (await frame.getAttribute("[data-verdict]", "data-verdict")) === "red");
ok("embed: no nav / inspector / counters", !(await frame.$("nav")) && !(await frame.$(".inspector")) && !(await frame.$(".counters")));
ok("embed: opened no WebSocket (read-only, nothing subscribed)", wsCount === 0, { wsCount });
await page.waitForTimeout(1500); await fh.scrollIntoViewIfNeeded(); await page.waitForTimeout(3000);
const h = await fh.evaluate(e => e.getBoundingClientRect().height);
ok("frame grew to fit the result (>260 px)", h > 300 && h < 1400, { h });
ok("footer link opens the full check", /#\/b\/SR-?13/i.test((await frame.getAttribute("footer a", "href")) || ""), { href: await frame.getAttribute("footer a", "href") });

const inner = await frame.evaluate(() => ({ wrap: Math.ceil(document.querySelector(".wrap").getBoundingClientRect().height), foot: !!document.querySelector("footer") }));
ok("frame height fits its content (no clipping, ≤ 40 px slack)", h >= inner.wrap && h - inner.wrap <= 40, { frame: h, content: inner.wrap });
if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + "/embed-host.png", fullPage: true }); await fh.screenshot({ path: process.env.SHOTS + "/embed-frame.png" }); }
// empty widget (no preset batch): type one
const p2 = await ctx.newPage(); p2.on("response", r => { if (r.status() >= 400) errors.push("HTTP " + r.status() + " " + r.url()); }); p2.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
await p2.goto(BASE + "?embed=1&lang=hi");
await p2.fill("#batch", "SR-13"); await p2.click(".search button"); await p2.waitForSelector("[data-verdict]", { timeout: 20000 });
ok("embed (hi, typed): red", (await p2.getAttribute("[data-verdict]", "data-verdict")) === "red" && (await p2.getAttribute("html", "lang")) === "hi");
// the main app is unchanged
await p2.goto(BASE); await p2.waitForSelector("nav");
ok("main app still has nav", !!(await p2.$("nav")) && !(await p2.$("[data-embed]")));
ok("no console errors", errors.length === 0, { errors });
out.fail = fail; console.log(JSON.stringify(out, null, 1)); await browser.close(); process.exit(fail ? 1 : 0);

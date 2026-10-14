// End-to-end check of a deployed build in a fresh headless Chromium at a 360×640 phone viewport.
//   PW=/path/to/playwright/index.mjs BASE=https://kharab-batch.surge.sh node scripts/e2e.mjs
// Asserts the SPEC §16 D2 acceptance tests that a browser can see; prints JSON; exits 1 on any failure.
const { chromium } = await import(process.env.PW || "playwright");
const BASE = (process.env.BASE || "http://127.0.0.1:8080/").replace(/\/?$/, "/");
const launch = { executablePath: process.env.CHROMIUM || "/usr/bin/chromium", args: ["--no-sandbox"] };
if (process.env.PROXY_JSON) launch.proxy = JSON.parse(process.env.PROXY_JSON);
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "hi-IN" });
const page = await ctx.newPage();
const errors = []; page.on("console", m => { if (m.type() === "error") errors.push(m.text()); }); page.on("pageerror", e => errors.push(String(e)));
const out = { base: BASE, results: {} }; let fail = 0;
const ok = (name, cond, info) => { out.results[name] = { pass: !!cond, ...(info || {}) }; if (!cond) fail++; };
const shot = n => process.env.SHOTS && page.screenshot({ path: `${process.env.SHOTS}/${n}.png`, fullPage: false });

// SR-13 → red ≤2 s (cold: no cache)
await page.goto(BASE, { waitUntil: "networkidle" });
ok("hindi default", (await page.textContent("h1")).includes("ख़राब"));
await page.fill("#batch", "SR-13");
let t0 = Date.now(); await page.click(".search button");
await page.waitForSelector("[data-verdict]", { timeout: 15000 }); const ms = Date.now() - t0;
ok("SR-13 red ≤2 s", (await page.getAttribute("[data-verdict]", "data-verdict")) === "red" && ms <= 2000, { ms });
ok("SR-13 lag 48 days", (await page.getAttribute("[data-lag]", "data-lag").catch(() => null)) === "48");
await shot("sr13-hi");
// inspector: ≤3 queries per check
await page.click(".inspector summary");
const insp = await page.textContent(".inspector summary");
const n = +(insp.match(/(\d+)\s*(network|नेटवर्क)/) || [])[1];
ok("≤3 queries per check", n >= 1 && n <= 3, { inspector: insp.trim() });
// Hindi → English toggle
await page.click(".langs button[lang=en]");
ok("English toggle", (await page.textContent("[data-verdict]")).includes("Failed a government lab test") && (await page.getAttribute("html", "lang")) === "en");
await shot("sr13-en");
// R01GL2523 → red + not on national portal
await page.goto(BASE + "#/b/R01GL2523"); await page.waitForSelector("[data-verdict]", { timeout: 15000 });
ok("R01GL2523 red + not on national portal", (await page.getAttribute("[data-verdict]", "data-verdict")) === "red" && (await page.textContent("[data-national=absent]")).includes("not on the national"));
// random string → grey + caveat
const rnd = "QZ" + Math.random().toString(36).slice(2, 8).toUpperCase();
await page.goto(BASE + "#/b/" + rnd); await page.waitForSelector("[data-verdict]", { timeout: 15000 });
ok("random → grey + caveat", (await page.getAttribute("[data-verdict]", "data-verdict")) === "grey" && (await page.textContent(".card")).includes("not a safety guarantee"), { batch: rnd });
// gap ledger rows = Q4 count (compared with an independent raw count from Node)
await page.goto(BASE + "#/gap"); await page.waitForSelector("[data-q4]", { timeout: 20000 });
const q4 = +(await page.getAttribute("[data-q4]", "data-q4")); const rows = await page.$$eval(".list li", l => l.length);
ok("gap rows = Q4", rows === q4 && (!process.env.Q4 || q4 === +process.env.Q4), { rows, q4, expected: process.env.Q4 });
await shot("gap");
// changed feed: Jun-26 +34, May-26 2 reclassified, Dec-25 3 removed, each with PDF sha
await page.goto(BASE + "#/changed"); await page.waitForSelector("[data-month]", { timeout: 20000 });
const kind = (m, k) => page.getAttribute(`[data-month="${m}"] [data-kind=${k}]`, "data-n").catch(() => null);
const sha = m => page.$eval(`[data-month="${m}"]`, el => /sha256 0x[0-9a-f]{8}/.test(el.textContent)).catch(() => false);
const jun = await kind(202606, "added_late"), may = await kind(202605, "reclassified"), dec = await kind(202512, "removed");
ok("changed feed counts + PDF sha", jun === "34" && may === "2" && dec === "3" && await sha(202606) && await sha(202605) && await sha(202512), { jun, may, dec });
await shot("changed");
// about: partial KA snapshot flagged
await page.goto(BASE + "#/about"); await page.waitForSelector("[data-partial]", { timeout: 20000 });
ok("partial KA snapshot flagged", (await page.$$("[data-partial='1']")).length >= 1);
ok("no console errors", errors.length === 0, { errors });
out.fail = fail; console.log(JSON.stringify(out, null, 1));
await browser.close(); process.exit(fail ? 1 : 0);

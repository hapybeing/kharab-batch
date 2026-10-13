// Publisher fetchers and parsers → canonical drug-alert/1 rows.
// Every parser whitelists the columns it reads; personal data never enters a row (see lib/scrub.mjs).
import { normBatch, splitBatches, ptok, productWords, ym, ymd, rowHash, sha256hex, truncBytes } from "./norm.mjs";
import { scrubLab } from "./scrub.mjs";

export const UA = "kharab-batch-mirror/1 (+https://github.com/hapybeing/kharab-batch)";
const sleep = ms => new Promise(r => setTimeout(r, ms));

export const PUBLISHERS = {
  cdsco: { name_en: "CDSCO national NSQ/spurious list", name_hi: "सीडीएससीओ राष्ट्रीय सूची", role: "MIRROR_CDSCO", source_url: "https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug" },
  ka: { name_en: "Karnataka Drugs Control Dept (via KSPC NSQ list)", name_hi: "कर्नाटक औषधि नियंत्रण विभाग", role: "MIRROR_KA", source_url: "https://kspcdic.com/nsq_records/search/0/0/0/0" },
  mh: { name_en: "Maharashtra FDA NSQ alerts", name_hi: "महाराष्ट्र एफडीए", role: "MIRROR_MH", source_url: "https://fda.maharashtra.gov.in/nsq-alerts/" },
  tg: { name_en: "Telangana DCA stop-use notices", name_hi: "तेलंगाना डीसीए", role: "CURATOR", source_url: "https://dca.telangana.gov.in/" },
  who: { name_en: "WHO Medical Product Alerts", name_hi: "विश्व स्वास्थ्य संगठन (WHO)", role: "CURATOR", source_url: "https://www.who.int/teams/regulation-prequalification/incidents-and-SF/full-list-of-who-medical-product-alerts" },
};

// ---------- helpers ----------
export function classify(text, tab) {
  const t = String(text || "");
  if (tab === "spurious" || /spurious/i.test(t)) return "spurious";
  if (/adulterat/i.test(t)) return "adulterated";
  if (/misbrand/i.test(t)) return "misbranded";
  return "nsq";
}
export function testKind(text) {
  const t = String(text || "");
  if (/diethylene|ethylene\s*glycol|\bDEG\b|\bEG\b|adulterat/i.test(t)) return "deg-eg";
  if (/steril|bacterial endotoxin|particulate/i.test(t)) return "sterility";
  if (/dissolution|disintegration/i.test(t)) return "dissolution";
  if (/assay|content|identification|identity/i.test(t)) return "assay";
  if (/description|appearance|label/i.test(t)) return "description";
  return t ? "other" : "na";
}
const STATE_HINTS = [
  [/karnataka|bengaluru|bangalore|bellary|ballari|hubli|belagavi|mysuru/i, "ka"], [/maharashtra|mumbai|pune|sambhaji|nagpur|palghar|fdal/i, "mh"],
  [/chennai|tamil|madurai|coimbatore/i, "tn"], [/kerala|ernakulam|thiruvananthapuram|kozhikode/i, "kl"], [/telangana|hyderabad/i, "tg"],
  [/andhra|vijayawada|guntur/i, "ap"], [/gujarat|vadodara|ahmedabad/i, "gj"], [/rajasthan|jaipur|udaipur|jodhpur/i, "rj"],
  [/himachal|baddi|h\.p|sundernagar/i, "hp"], [/uttarakhand|dehradun|fdtl/i, "uk"], [/punjab|kharar|chandigarh/i, "pb"],
  [/madhya|jabalpur|bhopal|indore|m\.p/i, "mp"], [/west bengal|paschim/i, "wb"], [/haryana/i, "hr"], [/uttar pradesh|lucknow/i, "up"],
  [/bihar|patna/i, "br"], [/odisha|bhubaneswar/i, "od"], [/assam|guwahati/i, "as"], [/goa\b/i, "ga"], [/delhi/i, "dl"], [/jammu|kashmir/i, "jk"],
];
export function stateOf(lab) { for (const [re, s] of STATE_HINTS) if (re.test(lab || "")) return s; return "xx"; }
const CENTRAL = /\b(CDL|CDTL|RDTL|CDSCO|Central Drugs|IPC|NIB|National Institute of Biologicals)\b/i;

/** Firm name + town/state only (no street address). */
export function mfrLabel(s) {
  const t = String(s || "").replace(/<br\s*\/?>/gi, ",").replace(/\s+/g, " ").trim();
  if (!t || /under investigation/i.test(t)) return t;
  const firm = t.split(/,|\b(?:plot|survey|sy\.?\s?no|khasra|kh\.?\s?no|vill(?:age)?|unit|door|no\.\s?\d|sector|phase|gat|s\.?\s?no)\b/i)[0].trim();
  const segs = t.split(",").map(x => x.replace(/[\d\-–()]+/g, " ").replace(/\b(dist|distt|district|tal|tehsil|pin)\b\.?/gi, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const tail = segs.length > 1 ? segs[segs.length - 1] : "";
  return truncBytes(tail && !firm.toLowerCase().includes(tail.toLowerCase()) ? `${firm}, ${tail}` : firm, 160);
}

function finish(r) {
  r.ptok = ptok(r.product);
  r.pname = truncBytes(String(r.product || "").replace(/\s+/g, " ").trim(), 120);
  r.exp_ym = ym(r.exp);
  r.exp_ok = r.exp_ym > 200000;
  r.rid = sha256hex(r.id);
  const { row, ...rest } = r;
  r.row = rowHash(rest);
  return r;
}

// ---------- CDSCO ----------
const CB = "https://cdscoonline.gov.in/CDSCO";
async function cdscoSession() {
  const r = await fetch(CB + "/viewPublicNSQDrug", { headers: { "User-Agent": UA } });
  const cookie = (r.headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ");
  await r.arrayBuffer();
  return async path => {
    let x, err;
    for (let attempt = 0; attempt < 5; attempt++) {
      try { x = await fetch(CB + path, { headers: { "User-Agent": UA, cookie, connection: "close" } }); if (x.ok) break; err = new Error("HTTP " + x.status); }
      catch (e) { err = e; x = null; }
      await sleep(2000 * (attempt + 1));
    }
    if (!x) throw new Error(`CDSCO ${path}: ${err?.message}`);
    if (!x.ok) throw new Error(`CDSCO ${path}: HTTP ${x.status}`);
    const buf = Buffer.from(await x.arrayBuffer());
    let s = buf.toString("utf8"); if (s.includes("\uFFFD")) s = new TextDecoder("windows-1252").decode(buf);
    return JSON.parse(s);
  };
}
/** Fetch raw CDSCO months. Returns {fetched, tabs: {nsq: {"Aug-2026": [...]}, spurious: {...}}}. */
export async function fetchCdsco(years = ["2024", "2025", "2026"], tabs = ["nsq", "spurious"]) {
  const get = await cdscoSession();
  const out = { fetched: new Date().toISOString(), tabs: {} };
  for (const tab of tabs) {
    out.tabs[tab] = {};
    const fn = tab === "nsq" ? "filteredNsqDrugTable" : "filteredSpuriousDrugTable";
    for (const y of years) {
      let months = [];
      try { months = await get(`/publicReportingMonths?year=${y}&tab=${tab}`); } catch (e) { months = []; }
      for (const m of months) {
        const rows = (await get(`/${fn}?month=${m}-${y}&source=All&tab=${tab}`)).aaData || [];
        out.tabs[tab][`${m}-${y}`] = rows; await sleep(800);
      }
    }
  }
  return out;
}
export function parseCdsco(raw) {
  const rows = [];
  for (const [tab, months] of Object.entries(raw.tabs)) for (const [list, items] of Object.entries(months)) for (const it of items) {
    const product = it.str_product_name || it.product_name_from_dtl || "";
    const labRaw = it.str_reported_by_lab_or_state || "";
    const lab_name = scrubLab(labRaw);
    const src_ym = ym(it.dt_reporting_month_year || list);
    const resultText = it.str_nsq_result || "";
    const central = it.str_reporting_source === "CDSCO Labs" || (it.str_reporting_source !== "State Lab" && CENTRAL.test(labRaw));
    for (const batch of splitBatches(it.str_batch_no)) {
      const p = ptok(product);
      rows.push(finish({
        src: "cdsco", tab, list, src_ym, src_ymd: 0, product, batch, batch_raw: it.str_batch_no || "",
        mfg: it.dt_manufacturing_date || "", exp: it.dt_expiry_date || "",
        class: classify(tab === "spurious" ? "spurious" : resultText, tab), test: testKind(resultText),
        lab: central ? "central" : "state", lab_name, rstate: central ? "in" : stateOf(labRaw),
        result: resultText, remarks: it.str_nsq_remarks || "", firm_reply: it.str_firm_reply || "",
        mfr_label: mfrLabel(it.str_manufactured_by), source_url: PUBLISHERS.cdsco.source_url,
        id: `cdsco|${tab}|${src_ym}|${batch}|${p}|${lab_name.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      }));
    }
  }
  return dedupe(rows);
}

// ---------- Karnataka (KSPC) ----------
const KB = "https://kspcdic.com/nsq_records/search/0/0/0/";
const cell = s => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
/** Parse one KSPC page. Columns: Sl, NSQ Date, BatchNo, Sample Name, Mfg Name, [Sender Name — never read], Mfg Date, Expiry Date, Lab. */
export function parseKspcPage(html) {
  const i = html.indexOf('id="equ-table"'); if (i < 0) return [];
  const body = html.slice(i, html.indexOf("</table>", i));
  const out = [];
  for (const tr of body.split(/<tr class="tbl_detail">/).slice(1)) {
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)(?=<td|<\/tr>|$)/g)].map(m => m[1]);
    if (tds.length < 9) continue;
    out.push({ nsq_date: cell(tds[1]), batch: cell(tds[2]), product: cell(tds[3]), mfr: cell(tds[4]), mfg: cell(tds[6]), exp: cell(tds[7]), lab: cell(tds[8]) });
  }
  return out;
}
export async function fetchKspc(pages = 4) {
  const rows = [], hashes = [];
  for (let p = 0; p < pages; p++) {
    const r = await fetch(KB + p * 50, { headers: { "User-Agent": UA } });
    const html = await r.text();
    hashes.push(sha256hex(html));
    const got = parseKspcPage(html);
    rows.push(...got);
    if (got.length < 50) break;
    await sleep(800);
  }
  return { fetched: new Date().toISOString(), rows, page_sha256: hashes };
}
export function parseKa(raw) {
  const rows = [];
  for (const it of raw.rows) {
    const d = ymd(it.nsq_date);
    for (const batch of splitBatches(it.batch)) {
      const p = ptok(it.product);
      rows.push(finish({
        src: "ka", tab: "nsq", list: "", src_ym: Math.floor(d / 100), src_ymd: d, product: it.product, batch, batch_raw: it.batch,
        mfg: it.mfg, exp: it.exp, class: "nsq", test: "na", lab: "state", lab_name: `Karnataka DTL (${it.lab})`, rstate: "ka",
        result: "Not of Standard Quality (Karnataka list gives no test detail)", remarks: "", firm_reply: "",
        mfr_label: mfrLabel(it.mfr), source_url: PUBLISHERS.ka.source_url, nsq_date: it.nsq_date,
        id: `ka|${d}|${batch}|${p}`,
      }));
    }
  }
  return dedupe(rows);
}

// ---------- Maharashtra FDA ----------
export async function fetchMh() {
  const r = await fetch(PUBLISHERS.mh.source_url, { headers: { "User-Agent": "Mozilla/5.0 " + UA }, redirect: "follow" });
  const html = await r.text();
  const out = [];
  for (const tr of html.split(/<tr[^>]*>/).slice(1)) {
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => cell(m[1]));
    if (tds.length < 7 || !/^\d+$/.test(tds[0])) continue;
    out.push({ product: tds[1], mfr: tds[2], batch: tds[3], mfg: tds[4], exp: tds[5], reason: tds[6] });
  }
  return { fetched: new Date().toISOString(), rows: out, page_sha256: [sha256hex(html)] };
}
export function parseMh(raw) {
  const rows = [];
  for (const it of raw.rows) for (const batch of splitBatches(it.batch)) {
    const p = ptok(it.product);
    rows.push(finish({
      src: "mh", tab: "nsq", list: "", src_ym: 0, src_ymd: 0, product: it.product, batch, batch_raw: it.batch,
      mfg: it.mfg, exp: it.exp, class: classify(it.reason), test: testKind(it.reason), lab: "state", lab_name: "Maharashtra FDA", rstate: "mh",
      result: it.reason, remarks: "", firm_reply: "", mfr_label: mfrLabel(it.mfr), source_url: PUBLISHERS.mh.source_url,
      id: `mh|${batch}|${p}`,
    }));
  }
  return dedupe(rows);
}

// ---------- curated notices ----------
export function parseCurated(list) {
  return dedupe(list.map(n => finish({ ...n, batch: normBatch(n.batch_raw), id: `${n.src}|${n.doc}|${normBatch(n.batch_raw)}` })));
}

function dedupe(rows) {
  const seen = new Map();
  for (const r of rows) if (r.batch && !seen.has(r.id)) seen.set(r.id, r);
  return [...seen.values()];
}

/** Same batch AND the products share a distinctive word (SPEC §8.3). */
export function sameBatch(a, b) {
  if (a.batch !== b.batch || a.batch.length < 4) return false;
  const A = new Set(productWords(a.product));
  return productWords(b.product).some(w => A.has(w));
}

import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { releaseOf } from "../../lib/dates.mjs";
import { query, queryAll, verdict, nationalLag, snapshotStatus, Q, normBatch, SELECT } from "../../lib/read.mjs";
import W from "../../wallets.json";
import { t } from "./i18n.js";
import { run, newCheck, LOG, onLog, budgetUsed, BUDGET, recents, addRecent } from "./data.js";
import "./style.css";

const APP = "kharab";
const low = a => a.toLowerCase();
const DEAD = "0x000000000000000000000000000000000000dead";
const ALLOW = new Set([W.MIRROR_CDSCO, W.MIRROR_KA, W.MIRROR_MH, W.CURATOR].map(low));
const NAT = low(W.MIRROR_CDSCO);
const PUB = {
  [low(W.MIRROR_CDSCO)]: { en: "CDSCO national list", hi: "CDSCO राष्ट्रीय सूची", url: "https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug" },
  [low(W.MIRROR_KA)]: { en: "Karnataka Drugs Control", hi: "कर्नाटक औषधि नियंत्रण", url: "https://kspcdic.com/nsq_records/search/0/0/0/0" },
  [low(W.MIRROR_MH)]: { en: "Maharashtra FDA", hi: "महाराष्ट्र FDA", url: "https://fda.maharashtra.gov.in/nsq-alerts/" },
  [low(W.CURATOR)]: { en: "Curated notice", hi: "चुनी हुई सूचना", url: "https://dca.telangana.gov.in/" },
  [low(W.WATCH)]: { en: "Kharab Batch matcher", hi: "ख़राब बैच मिलानकर्ता" },
  [low(W.HISTORY)]: { en: "Reconstructed history", hi: "पुनर्निर्मित इतिहास" },
};
const SRCNAME = { tg: { en: "Telangana DCA stop-use notice", hi: "तेलंगाना DCA रोक-सूचना" }, who: { en: "WHO Medical Product Alert", hi: "WHO चिकित्सा उत्पाद चेतावनी" }, "tn-dc": { en: "Tamil Nadu Drugs Control notice", hi: "तमिलनाडु औषधि नियंत्रण सूचना" } };
const CHANGERS = [W.MIRROR_CDSCO, W.MIRROR_KA, W.MIRROR_MH, W.HISTORY];
const EXPLORER = "https://tiramisu.explorer.arkiv.network";
const BLOCK_S = 2; // Tiramisu block time (measured over 1,000 blocks)
const IST = 19800e3;
const nowYm = (() => { const d = new Date(Date.now() + IST); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; })();
const todayUTC = (() => { const d = new Date(Date.now() + IST); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
const ymd2date = n => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100));
const loc = lang => (lang === "hi" ? "hi-IN" : "en-IN");
const fmtYmd = (n, lang) => n ? ymd2date(n).toLocaleDateString(loc(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
const fmtYm = (n, lang) => n ? new Date(Date.UTC(Math.floor(n / 100), n % 100 - 1, 1)).toLocaleDateString(loc(lang), { month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const fmtDate = (ms, lang) => new Date(ms).toLocaleDateString(loc(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const daysSince = n => Math.round((todayUTC - ymd2date(n)) / 864e5);
const short = h => h ? h.slice(0, 10) + "…" + h.slice(-6) : "";
const num = (n, lang) => Number(n).toLocaleString(loc(lang));
const pubName = (e, lang) => (SRCNAME[e.a.src] || PUB[e.creator] || { en: e.creator })[lang] || PUB[e.creator]?.en || e.creator;
const blockToMs = (b, at) => Date.now() + (b - at) * BLOCK_S * 1000;

function lev(a, b) { // edit distance, for did-you-mean only (never red)
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const route = () => {
  const h = location.hash;
  const m = h.match(/^#\/b\/([^/?]+)/);
  if (m) return { tab: "check", batch: decodeURIComponent(m[1]) };
  for (const k of ["gap", "changed", "about"]) if (h.startsWith("#/" + k)) return { tab: k };
  return { tab: "check" };
};

function App() {
  const [lang, setLang] = useState(localStorage.getItem("kb_lang") || "hi");
  const [r, setR] = useState(route());
  useEffect(() => { const f = () => setR(route()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  useEffect(() => { localStorage.setItem("kb_lang", lang); document.documentElement.lang = lang; document.title = t(lang, "doc_title"); }, [lang]);
  const T = (k, v) => t(lang, k, v);
  return <div class="wrap">
    <header>
      <h1><a href="#/check">{T("app")}</a></h1>
      <div class="langs" role="group" aria-label="Language / भाषा">{["hi", "en"].map(l => <button aria-pressed={l === lang} class={l === lang ? "on" : ""} lang={l} onClick={() => setLang(l)}>{l === "hi" ? "हिंदी" : "EN"}</button>)}</div>
    </header>
    <nav aria-label={T("nav")}>{["check", "gap", "changed", "about"].map(k => <a href={"#/" + k} aria-current={r.tab === k ? "page" : undefined} class={r.tab === k ? "on" : ""}>{T("tabs_" + k)}</a>)}</nav>
    <main>
      {r.tab === "check" && <Check T={T} lang={lang} batch={r.batch} />}
      {r.tab === "gap" && <Gap T={T} lang={lang} />}
      {r.tab === "changed" && <Changed T={T} lang={lang} />}
      {r.tab === "about" && <About T={T} lang={lang} />}
    </main>
    <Inspector T={T} />
    <footer>{T("footer")} · <a href="https://github.com/hapybeing/kharab-batch">GitHub</a> · MIT</footer>
  </div>;
}

function Check({ T, lang, batch }) {
  const [input, setInput] = useState(batch || "");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [product, setProduct] = useState("");
  async function go(b0) {
    const b = normBatch(b0); if (!b) return;
    setBusy(true); setErr(""); setProduct("");
    const cid = newCheck(), t0 = performance.now();
    try {
      const q1 = Q.check(APP, b);
      const r = await run("Q1", q1, url => query(q1, { url }), { cacheKey: "q1:" + b, ttl: 10 * 60e3, check: cid });
      const v = verdict(r.entities, { allow: ALLOW, nowYm, batch: b });
      let near = [];
      if (v.level === "grey" && b.length >= 4) {
        const q2 = Q.didYouMean(APP, b.slice(0, 3));
        const r2 = await run("Q2", q2, url => query(q2, { url, limit: 50, select: { key: true, creator: true, attributes: true } }), { cacheKey: "q2:" + b.slice(0, 3), ttl: 60 * 60e3, check: cid });
        const seen = new Set();
        near = r2.entities.filter(e => ALLOW.has(e.creator) && e.a.batch !== b && lev(e.a.batch, b) <= 2 && !seen.has(e.a.batch) && seen.add(e.a.batch)).slice(0, 4);
      }
      addRecent(b);
      setRes({ batch: b, ...r, v, near, ms: Math.round(performance.now() - t0), cid });
    } catch (e2) { setErr(e2.code === 429 ? T("err_429") : e2.message); }
    setBusy(false);
  }
  useEffect(() => { if (batch) { setInput(batch); go(batch); } else setRes(null); }, [batch]);
  const submit = e => { e.preventDefault(); const b = normBatch(input); if (!b) return; if (location.hash === "#/b/" + b) go(b); else location.hash = "#/b/" + b; };
  const rec = recents();
  return <section>
    <p class="tag">{T("tagline")}</p>
    <form onSubmit={submit} class="search" role="search">
      <label class="sr" for="batch">{T("placeholder")}</label>
      <input id="batch" value={input} onInput={e => setInput(e.target.value)} placeholder={T("placeholder")} autocapitalize="characters" autocomplete="off" spellcheck={false} enterkeyhint="search" />
      <button disabled={busy}>{busy ? "…" : T("check")}</button>
    </form>
    <div class="try"><span class="muted small">{T("try")}</span>{["SR-13", "R01GL2523", "AL-24002"].map(b => <a href={"#/b/" + normBatch(b)} class="pill">{b}</a>)}</div>
    {!res && !busy && rec.length > 0 && <div class="try"><span class="muted small">{T("recent")}</span>{rec.map(b => <a href={"#/b/" + b} class="pill">{b}</a>)}<small class="muted">{T("recent_note")}</small></div>}
    {err && <p class="err" role="alert">{err}</p>}
    {busy && <p class="muted" aria-live="polite">{T("loading")}</p>}
    {res && !busy && <Result T={T} lang={lang} r={res} product={product} setProduct={setProduct} />}
    {!res && !busy && <Counters T={T} lang={lang} />}
  </section>;
}

function Counters({ T, lang }) {
  const [c, setC] = useState(null);
  useEffect(() => {
    const q = Q.gaps(APP, W.WATCH);
    run("Q4", q, url => queryAll(q, { url }), { cacheKey: "q4", ttl: 15 * 60e3 }).then(r => setC({ n: r.entities.length, inDate: r.entities.filter(e => e.a.exp_ym >= nowYm).length })).catch(() => { });
  }, []);
  return <p class="counters">{T("counters_pub")}{c && <> · <a href="#/gap">{T("counters_gap", { n: num(c.n, lang), m: num(c.inDate, lang) })}</a></>}</p>;
}

function Result({ T, lang, r, product, setProduct }) {
  const v0 = r.v;
  const v = product ? verdict(r.entities, { allow: ALLOW, nowYm, batch: r.batch, product }) : v0;
  const icon = { red: "⛔", amber: "⚠", grey: "○", record: "▣" }[v.level];
  const pend = r.entities.filter(e => e.a.type === "pending" && e.creator === low(W.WATCH));
  const links = r.entities.filter(e => e.a.type === "link" && e.creator === low(W.WATCH));
  const changes = r.entities.filter(e => e.a.type === "change" && CHANGERS.map(low).includes(e.creator));
  const lag = nationalLag(v.alerts, NAT);
  const first = v.alerts[0]?.a;
  const when = e => e.a.src_ymd || releaseOf(e.a.src_ym).ymd;
  const sorted = v.alerts.slice().sort((a, b) => when(a) - when(b));
  return <div class={"card " + v.level} aria-live="polite">
    <div class="verdict"><span class="icon" aria-hidden="true">{icon}</span><div><b data-verdict={v.level}>{T(v.level)}</b><small>{T(v.level + "_sub")}</small></div></div>
    {first && <p class="prod">{first.pname} · <span class="mono">{r.batch}</span> · {T("exp")} {fmtYm(first.exp_ym, lang)}</p>}
    {v.short && <p class="small">⚠ {T("short_batch")}</p>}
    {v.level === "amber" && !product && <div class="pick"><p class="small">{T("pick")}</p>{(v.products || []).map(p => <button onClick={() => setProduct(p)}>{p}</button>)}</div>}
    {v.alerts.length > 0 && <>
      <h3>{T("publishers")}</h3>
      <ul class="pubs">{sorted.map(e => <li>
        <span class="chip">{pubName(e, lang)}</span>
        {" "}{e.a.src_ymd ? fmtYmd(e.a.src_ymd, lang) : `${T("list")} ${fmtYm(e.a.src_ym, lang)} (${releaseOf(e.a.src_ym).basis === "declared" ? T("declared") + " " + fmtYmd(releaseOf(e.a.src_ym).ymd, lang) : T("released_after") + " " + fmtYmd(releaseOf(e.a.src_ym).ymd, lang)})`} · {T("cls_" + e.a.class) || e.a.class}{e.a.test && e.a.test !== "na" ? " · " + (T("test_" + e.a.test) || e.a.test) : ""}
        <Proof T={T} lang={lang} e={e} block={r.block} />
      </li>)}</ul>
      {lag?.status === "absent" && <p class="gapline" data-national="absent">↳ {T("national")}: <b>{T("not_national")}</b><br /><small>{T("not_national_sub")}</small></p>}
      {lag?.status === "carried" && lag.days != null && <p class="gapline" data-lag={lag.days}>↳ {T("lag_line", { d: lag.days, list: fmtYm(lag.list_ym, lang), rel: fmtYmd(lag.releaseYmd, lang) })}{lag.basis === "lower-bound" ? " " + T("lag_lb") : ""}{lag.releaseSrc && <> · <a href={lag.releaseSrc} target="_blank" rel="noopener">{T("source")} ↗</a></>}</p>}
      {links.map(l => <p class="gapline">↳ {T("national_after", { d: l.a.lag_d })} {l.a.lag_basis === "lower-bound" ? T("lag_lb") : ""} <small class="muted">({T("by_matcher")})</small></p>)}
      {pend.map(p => <p class="gapline">⏳ {T("waiting", { date: fmtYmd(p.a.since_ymd, lang) })} <small class="muted">({T("by_matcher")})</small><br /><small>{T("caveat_state")}</small></p>)}
      <p class="small">⚠ {T("changes")}: {changes.length ? changes.map(c => `${T(c.a.kind)} (${T(c.a.evid)}, ${T("list")} ${fmtYm(c.a.list_ym, lang)})`).join("; ") : T("no_changes")}</p>
      <blockquote>{T("caveat_cdsco")}</blockquote>
    </>}
    {v.level === "grey" && <>
      <p class="small">{T("grey_scope")}</p>
      {r.near.length > 0 && <p class="small">{T("did_you_mean")} {r.near.map(e => <a class="pill" href={"#/b/" + e.a.batch}>{e.a.batch}</a>)}<br /><small class="muted">{T("near_note")}</small></p>}
    </>}
    {v.other.length > 0 && <p class="small muted">{T("other_writers", { n: v.other.length })}</p>}
    <p class="small muted">{T("read_at", { b: num(r.block, lang), ms: r.ms })}</p>
  </div>;
}

function Proof({ T, lang, e, block }) {
  const [open, setOpen] = useState(false);
  const sealed = e.owner === DEAD;
  return <details class="proof" onToggle={ev => setOpen(ev.target.open)}>
    <summary>{T("proof")}</summary>
    {open && <dl>
      <dt>{T("key")}</dt><dd class="mono">{e.key}</dd>
      <dt>{T("creator")}</dt><dd><span class="chip">{PUB[e.creator]?.[lang] || "?"}</span> <span class="mono">{e.creator}</span></dd>
      <dt>{T("owner")}</dt><dd>{sealed ? T("sealed") : <span class="mono">{e.owner}</span>}</dd>
      <dt>{T("flags")}</dt><dd>{T("flags_val")}</dd>
      <dt>{T("expires")}</dt><dd>{T("expires_val", { date: fmtDate(blockToMs(e.expiresAt, block), lang), b: num(e.expiresAt, lang) })}</dd>
      {e.createdAt && <><dt>{T("created")}</dt><dd>{T("created_val", { b: num(e.createdAt, lang), date: fmtDate(blockToMs(e.createdAt, block), lang) })}</dd></>}
      <dt>{T("verify_cli")}</dt><dd class="mono copy">npx github:hapybeing/kharab-batch verify {e.key}</dd>
      <dd><a href={`${EXPLORER}/entity/${e.key}`} target="_blank" rel="noopener">{T("explorer")} ↗</a>{PUB[e.creator]?.url && <> · <a href={PUB[e.creator].url} target="_blank" rel="noopener">{T("source")} ↗</a></>}</dd>
    </dl>}
  </details>;
}

function Gap({ T, lang }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const q = Q.gaps(APP, W.WATCH);
    run("Q4", q, url => queryAll(q, { url }), { cacheKey: "q4", ttl: 15 * 60e3 }).then(setD).catch(e => setErr(e.message));
  }, []);
  if (err) return <p class="err" role="alert">{err}</p>;
  if (!d) return <p class="muted">{T("loading")}</p>;
  const rows = d.entities;
  const sorted = rows.slice().sort((a, b) => a.a.since_ymd - b.a.since_ymd);
  const inDate = rows.filter(e => e.a.exp_ym >= nowYm).length;
  const bySrc = {}; for (const e of rows) bySrc[e.a.src] = (bySrc[e.a.src] || 0) + 1;
  const LEASE = 36 * 3600 / BLOCK_S;
  return <section>
    <h2>{T("gap_title")}</h2>
    <p class="big" data-q4={rows.length}>{T("gap_count", { n: num(rows.length, lang), m: num(inDate, lang) })}</p>
    <p class="small muted">{Object.entries(bySrc).map(([s, n]) => `${s.toUpperCase()} ${num(n, lang)}`).join(" · ")} · {T("read_block", { b: num(d.block, lang) })}</p>
    <p class="small">{T("sort_hint")}</p>
    <p class="small muted">{T("caveat_state")}</p>
    <ul class="list">{sorted.map(e => {
      const obs = e.expiresAt - LEASE; const ago = Math.max(0, Math.round((d.block - obs) * BLOCK_S / 3600));
      const left = Math.max(0, Math.min(1, (e.expiresAt - d.block) / LEASE));
      return <li><a href={"#/b/" + e.a.batch}>
        <span class="chip">{e.a.src.toUpperCase()}</span> <span class="mono">{e.a.batch}</span>
        <span class="right">{T("days_waiting", { d: num(daysSince(e.a.since_ymd), lang) })}</span>
        <small>{fmtYmd(e.a.since_ymd, lang)} · {T("exp")} {fmtYm(e.a.exp_ym, lang)} · {T("rechecked", { h: ago })}</small>
        <span class="lease" role="img" aria-label={T("lease_left", { p: Math.round(left * 100) })}><i style={{ width: Math.round(left * 100) + "%" }} /></span>
      </a></li>;
    })}</ul>
  </section>;
}

function Changed({ T, lang }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const q = Q.changes(APP, CHANGERS);
    run("Q8", q, url => queryAll(q, { url, select: { ...SELECT, payload: true } }).then(r => ({ block: r.block, entities: r.entities.map(e => { let p = null; try { p = JSON.parse(new TextDecoder().decode(Uint8Array.from(e.payload.slice(2).match(/../g).map(h => parseInt(h, 16))))); } catch { } return { ...e, payload: undefined, p }; }) })), { cacheKey: "q8", ttl: 60 * 60e3 }).then(setD).catch(e => setErr(e.message));
  }, []);
  if (err) return <p class="err" role="alert">{err}</p>;
  if (!d) return <p class="muted">{T("loading")}</p>;
  const by = {}; for (const e of d.entities) (by[e.a.list_ym] ||= []).push(e);
  const tot = {}; for (const e of d.entities) tot[e.a.kind] = (tot[e.a.kind] || 0) + 1;
  return <section>
    <h2>{T("changed_title")}</h2>
    <p class="big">{Object.entries(tot).map(([k, n]) => `${num(n, lang)} ${T(k)}`).join(" · ")}</p>
    <p class="small muted">{T("changed_sub")}</p>
    {Object.keys(by).sort((a, b) => b - a).map((m, i) => {
      const k = {}; for (const e of by[m]) k[e.a.kind] = (k[e.a.kind] || 0) + 1;
      const pdfs = [...new Map(by[m].filter(e => e.p?.before?.sha256).map(e => [e.p.before.sha256, e.p.before])).values()];
      return <details class="month" open={i === 0} data-month={m}><summary><b>{fmtYm(+m, lang)}</b> — {Object.entries(k).map(([kk, n]) => <span data-kind={kk} data-n={n}>{(kk === "added_late" ? "+" : "") + num(n, lang)} {T(kk)} </span>)}</summary>
        <p class="small">{T("archived")} {pdfs.map(p => <span class="pdf"><a href={p.url} target="_blank" rel="noopener">{p.url.split("/").pop()}</a> <span class="mono">sha256 {short(p.sha256)}</span></span>)}</p>
        <ul class="list">{by[m].map(e => <li><a href={"#/b/" + e.a.batch}>
          <span class="mono">{e.a.batch}</span> <span class="chip">{T(e.a.kind)}</span> <span class="chip">{T(e.a.evid)}</span>
          <small>{e.p?.after?.product || ""}{e.p?.after?.tab ? ` · ${T("now_in")} ${e.p.after.tab}` : ""}{e.p?.note ? ` · ${e.p.note}` : ""}</small>
          <small class="mono">{T("before")} {short(e.a.before)} → {T("after")} {short(e.a.after)}</small></a></li>)}</ul>
      </details>;
    })}
  </section>;
}

function About({ T, lang }) {
  const [h, setH] = useState(null);
  useEffect(() => {
    const q = Q.snapshots(APP);
    run("Q19", q, url => queryAll(q, { url, select: { key: true, creator: true, attributes: true } }), { cacheKey: "q19", ttl: 30 * 60e3 })
      .then(r => { const own = r.entities.filter(e => ALLOW.has(e.creator)); setH({ list: own.sort((a, b) => b.a.fetched - a.a.fetched), st: snapshotStatus(own) }); }).catch(() => { });
  }, []);
  return <section class="about">
    <h2>{T("about_title")}</h2><p>{T("about_body")}</p><p>{T("off_chain")}</p>
    <h3>{T("health")}</h3>
    <p class="small muted">{T("health_sub")}</p>
    {h ? <ul class="list">{h.list.map(s => { const st = h.st.get(s.key); return <li data-partial={st.partial ? "1" : "0"}><span class="chip">{s.a.src.toUpperCase()}</span> {fmtDate(s.a.fetched * 1000, lang)} · {T("snap_rows", { n: num(s.a.count, lang), k: num(s.a.new, lang) })} {st.partial && <b class="warn">{T("partial")}</b>}
      {st.partial && <small>{T("partial_note", { n: num(s.a.count, lang) })}</small>}<small class="mono"><a href={`${EXPLORER}/entity/${s.key}`} target="_blank" rel="noopener">{short(s.key)}</a></small></li>; })}</ul> : <p class="muted">{T("loading")}</p>}
    <h3>{T("wallets")}</h3>
    <ul class="small mono">{Object.entries(W).map(([r, a]) => <li>{r}: <a href={`${EXPLORER}/address/${a}`} target="_blank" rel="noopener">{a}</a></li>)}</ul>
  </section>;
}

function Inspector({ T }) {
  const [, force] = useState(0);
  useEffect(() => onLog(() => force(x => x + 1)), []);
  const used = budgetUsed();
  const last = LOG[0]?.check;
  const thisCheck = last ? LOG.filter(e => e.check === last) : [];
  const net = thisCheck.reduce((s, e) => s + (e.cached ? 0 : e.requests || 1), 0);
  return <details class="inspector">
    <summary>{T("inspector")} · {last ? T("insp_check", { n: net, c: thisCheck.filter(e => e.cached).length }) : T("insp_idle")} · <span>{T("budget", { n: used, max: BUDGET })}</span></summary>
    <div class="meter" role="meter" aria-valuemin="0" aria-valuemax={BUDGET} aria-valuenow={used} aria-label={T("budget", { n: used, max: BUDGET })}><i style={{ width: Math.min(100, used) + "%" }} /></div>
    <p class="small">{T("insp_note")}</p>
    <ol class="small">{LOG.slice(0, 12).map(e => <li><b>{e.id}</b> · {e.reader}{e.cached ? "" : ` · ${e.requests} ${e.requests === 1 ? "request" : "requests"} · ${e.ms} ms`}{e.fallback ? ` · ${e.fallback}` : ""}{e.error ? " · ✗ " + e.error : ""}<br /><code>{e.q}</code></li>)}</ol>
  </details>;
}

render(<App />, document.getElementById("app"));

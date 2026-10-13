import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { query, queryAll, count, verdict, Q, RPC, SHADOW, normBatch } from "../../lib/read.mjs";
import W from "../../wallets.json";
import { t } from "./i18n.js";
import "./style.css";

const APP = "kharab";
const low = a => a.toLowerCase();
const ALLOW = new Set([W.MIRROR_CDSCO, W.MIRROR_KA, W.MIRROR_MH, W.CURATOR].map(low));
const PUB = {
  [low(W.MIRROR_CDSCO)]: { en: "CDSCO national list", hi: "सीडीएससीओ राष्ट्रीय सूची", short: "CDSCO" },
  [low(W.MIRROR_KA)]: { en: "Karnataka Drugs Control (KSPC list)", hi: "कर्नाटक औषधि नियंत्रण", short: "KA" },
  [low(W.MIRROR_MH)]: { en: "Maharashtra FDA", hi: "महाराष्ट्र एफडीए", short: "MH" },
  [low(W.CURATOR)]: { en: "Curated notice", hi: "चुनी हुई सूचना", short: "Notice" },
};
const SRCNAME = { tg: { en: "Telangana DCA stop-use notice", hi: "तेलंगाना डीसीए रोक-सूचना" }, who: { en: "WHO Medical Product Alert", hi: "WHO चिकित्सा उत्पाद चेतावनी" } };
const EXPLORER = "https://tiramisu.explorer.arkiv.network";
const nowYm = (() => { const d = new Date(Date.now() + 19800e3); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; })();
const todayUTC = (() => { const d = new Date(Date.now() + 19800e3); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
const ymd2date = n => new Date(Date.UTC(Math.floor(n / 10000), Math.floor(n / 100) % 100 - 1, n % 100));
const fmtYmd = (n, lang) => n ? ymd2date(n).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
const fmtYm = (n, lang) => n ? new Date(Date.UTC(Math.floor(n / 100), n % 100 - 1, 1)).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const daysSince = n => Math.round((todayUTC - ymd2date(n)) / 864e5);
const short = h => h ? h.slice(0, 8) + "…" + h.slice(-4) : "";

let QUERIES = Number(sessionStorage.getItem("kb_q") || 0);
const bump = () => { QUERIES++; sessionStorage.setItem("kb_q", QUERIES); };
async function read(fn) {
  bump();
  try { return await fn(RPC); } catch (e) { if (e.code === 429 || /fetch/i.test(e.message)) { bump(); return await fn(SHADOW); } throw e; }
}
function cached(k, ttl, fn) {
  const c = JSON.parse(localStorage.getItem(k) || "null");
  if (c && Date.now() - c.t < ttl) return Promise.resolve(c.v);
  return fn().then(v => { try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch { } return v; });
}

function App() {
  const [lang, setLang] = useState(localStorage.getItem("kb_lang") || "hi");
  const [tab, setTab] = useState(location.hash.startsWith("#/gap") ? "gap" : location.hash.startsWith("#/changed") ? "changed" : location.hash.startsWith("#/about") ? "about" : "check");
  useEffect(() => { localStorage.setItem("kb_lang", lang); document.documentElement.lang = lang; }, [lang]);
  const T = (k, v) => t(lang, k, v);
  return <div class="wrap">
    <header>
      <h1>{T("app")}</h1>
      <div class="langs">{["hi", "en"].map(l => <button class={l === lang ? "on" : ""} onClick={() => setLang(l)}>{l === "hi" ? "हिं" : "EN"}</button>)}</div>
    </header>
    <nav>{["check", "gap", "changed", "about"].map(k => <a href={"#/" + k} class={tab === k ? "on" : ""} onClick={() => setTab(k)}>{T("tabs_" + k)}</a>)}</nav>
    <main>
      {tab === "check" && <Check T={T} lang={lang} />}
      {tab === "gap" && <Gap T={T} lang={lang} />}
      {tab === "changed" && <Changed T={T} lang={lang} />}
      {tab === "about" && <About T={T} />}
    </main>
    <footer>{T("budget", { n: QUERIES })} · Arkiv Tiramisu · <a href="https://github.com/hapybeing/kharab-batch">GitHub</a></footer>
  </div>;
}

function Check({ T, lang }) {
  const initial = decodeURIComponent((location.hash.match(/#\/b\/([^/?]+)/) || [])[1] || "");
  const [input, setInput] = useState(initial);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(e, b0) {
    e?.preventDefault();
    const b = normBatch(b0 ?? input); if (!b) return;
    location.hash = "#/b/" + encodeURIComponent(b);
    setBusy(true); setErr("");
    try {
      const r = await cached("kb_q1_" + b, 10 * 60e3, () => read(url => query(Q.check(APP, b), { url })));
      setRes({ batch: b, ...r, v: verdict(r.entities, { allow: ALLOW, nowYm }) });
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }
  useEffect(() => { if (initial) go(null, initial); }, []);
  return <section>
    <p class="tag">{T("tagline")}</p>
    <form onSubmit={go} class="search">
      <input value={input} onInput={e => setInput(e.target.value)} placeholder={T("placeholder")} autocapitalize="characters" autocomplete="off" spellcheck={false} aria-label={T("placeholder")} />
      <button disabled={busy}>{busy ? "…" : T("check")}</button>
    </form>
    <div class="try">{["SR-13", "R01GL2523", "AL-24002"].map(b => <button onClick={() => { setInput(b); go(null, b); }}>{b}</button>)}</div>
    {err && <p class="err">{err}</p>}
    {busy && <p class="muted">{T("loading")}</p>}
    {res && !busy && <Result T={T} lang={lang} r={res} />}
  </section>;
}

function Result({ T, lang, r }) {
  const { v } = r;
  const icon = { red: "⛔", amber: "⚠️", grey: "○", record: "🗄" }[v.level];
  const pend = r.entities.filter(e => e.a.type === "pending" && low(e.creator) === low(W.WATCH));
  const links = r.entities.filter(e => e.a.type === "link" && low(e.creator) === low(W.WATCH));
  const changes = r.entities.filter(e => e.a.type === "change" && [W.MIRROR_CDSCO, W.MIRROR_KA, W.MIRROR_MH, W.HISTORY].map(low).includes(low(e.creator)));
  const hasNational = v.alerts.some(e => low(e.creator) === low(W.MIRROR_CDSCO));
  const first = v.alerts[0]?.a;
  return <div class={"card " + v.level}>
    <div class="verdict"><span class="icon" aria-hidden="true">{icon}</span><div><b>{T(v.level)}</b><small>{T(v.level + "_sub")}</small></div></div>
    {first && <p class="prod">{first.pname} · <span class="mono">{r.batch}</span> · {T("exp")} {fmtYm(first.exp_ym, lang)}</p>}
    {v.alerts.length > 0 && <>
      <h3>{T("publishers")}</h3>
      <ul class="pubs">{v.alerts.sort((a, b) => (a.a.src_ymd || a.a.src_ym * 100) - (b.a.src_ymd || b.a.src_ym * 100)).map(e => <li>
        <span class="chip">{(SRCNAME[e.a.src] || PUB[e.creator])[lang] || PUB[e.creator].en}</span>
        {" "}{e.a.src_ymd ? fmtYmd(e.a.src_ymd, lang) : `${T("list")} ${fmtYm(e.a.src_ym, lang)}`} · {e.a.class}{e.a.test !== "na" ? " · " + e.a.test : ""}
        <Proof T={T} e={e} />
      </li>)}</ul>
      {!hasNational && <p class="gapline">↳ {T("national")}: <b>{T("not_national")}</b></p>}
      {links.map(l => <p class="gapline">↳ {T("national_after", { d: l.a.lag_d })} {l.a.lag_basis === "lower-bound" ? "(≥)" : ""}</p>)}
      {pend.map(p => <p class="gapline">⏳ {T("waiting", { date: fmtYmd(p.a.since_ymd, lang) })}<br /><small>{T("caveat_state")}</small></p>)}
      <p class="small">⚠ {T("changes")}: {changes.length ? changes.map(c => T(c.a.kind) + ` (${T(c.a.evid)}, ${fmtYm(c.a.list_ym, lang)})`).join("; ") : T("no_changes")}</p>
      <blockquote>{T("caveat_cdsco")}</blockquote>
    </>}
    {v.other.length > 0 && <p class="small muted">{T("other_writers", { n: v.other.length })}</p>}
    <p class="small muted">block {r.block}</p>
  </div>;
}

function Proof({ T, e }) {
  const [open, setOpen] = useState(false);
  return <details class="proof" onToggle={ev => setOpen(ev.target.open)}>
    <summary>{T("proof")}</summary>
    {open && <dl>
      <dt>{T("key")}</dt><dd class="mono">{e.key}</dd>
      <dt>{T("creator")}</dt><dd class="mono">{e.creator}</dd>
      <dt>{T("owner")}</dt><dd class="mono">{e.owner === "0x000000000000000000000000000000000000dead" ? T("sealed") : e.owner}</dd>
      <dt>{T("expires")}</dt><dd>block {e.expiresAt}</dd>
      <dt>{T("verify_cli")}</dt><dd class="mono">npx github:hapybeing/kharab-batch verify {short(e.key)}</dd>
      <dd><a href={`${EXPLORER}/entity/${e.key}`} target="_blank" rel="noopener">{T("explorer")} ↗</a></dd>
    </dl>}
  </details>;
}

function Gap({ T, lang }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { cached("kb_gap", 15 * 60e3, () => read(url => queryAll(Q.gaps(APP, W.WATCH), { url }))).then(r => setRows(r.entities)); }, []);
  if (!rows) return <p class="muted">{T("loading")}</p>;
  const sorted = rows.slice().sort((a, b) => a.a.since_ymd - b.a.since_ymd);
  const inDate = rows.filter(e => e.a.exp_ym >= nowYm).length;
  return <section>
    <h2>{T("gap_title")}</h2>
    <p class="big">{T("gap_count", { n: rows.length, m: inDate })}</p>
    <p class="small muted">{T("sort_hint")}</p>
    <p class="small">{T("caveat_state")}</p>
    <ul class="list">{sorted.map(e => <li><a href={"#/b/" + e.a.batch} onClick={() => setTimeout(() => location.reload(), 0)}>
      <span class="chip">{e.a.src.toUpperCase()}</span> <span class="mono">{e.a.batch}</span>
      <span class="right">{T("days_waiting", { d: daysSince(e.a.since_ymd) })}</span>
      <small>{fmtYmd(e.a.since_ymd, lang)} · {T("exp")} {fmtYm(e.a.exp_ym, lang)}</small></a></li>)}</ul>
  </section>;
}

function Changed({ T, lang }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { cached("kb_chg", 30 * 60e3, () => read(url => queryAll(Q.changes(APP, [W.MIRROR_CDSCO, W.MIRROR_KA, W.MIRROR_MH, W.HISTORY]), { url }))).then(r => setRows(r.entities)); }, []);
  if (!rows) return <p class="muted">{T("loading")}</p>;
  const by = {}; for (const e of rows) (by[e.a.list_ym] ||= []).push(e);
  return <section>
    <h2>{T("changed_title")}</h2>
    <p class="small muted">{T("changed_sub")}</p>
    {Object.keys(by).sort((a, b) => b - a).map(m => {
      const k = {}; for (const e of by[m]) k[e.a.kind] = (k[e.a.kind] || 0) + 1;
      return <details class="month"><summary><b>{fmtYm(+m, lang)}</b> — {Object.entries(k).map(([kk, n]) => `${n} ${T(kk)}`).join(" · ")}</summary>
        <ul class="list">{by[m].map(e => <li><a href={"#/b/" + e.a.batch} onClick={() => setTimeout(() => location.reload(), 0)}><span class="mono">{e.a.batch}</span> <span class="chip">{T(e.a.kind)}</span> <small>{T(e.a.evid)} · before {short(e.a.before)} → after {short(e.a.after)}</small></a></li>)}</ul>
      </details>;
    })}
  </section>;
}

function About({ T }) {
  return <section class="about">
    <h2>{T("about_title")}</h2><p>{T("about_body")}</p><p>{T("off_chain")}</p>
    <h3>Publishers (creator wallets)</h3>
    <ul class="small mono">{Object.entries(W).map(([r, a]) => <li>{r}: <a href={`${EXPLORER}/address/${a}`} target="_blank" rel="noopener">{a}</a></li>)}</ul>
  </section>;
}

render(<App />, document.getElementById("app"));

// Live updates over Arkiv's WebSocket: ONE `eth_subscribe("logs")` on the Arkiv operation address, filtered on the node by
// event (EntityCreated, ExpiryExtended) and by owner topic (our mirror + WATCH wallets). No fromBlock, no polling timers.
//  - ExpiryExtended with owner = WATCH  → a gap lease was renewed by an observation: the gap screen ticks "re-checked just now" with no query.
//  - EntityCreated with owner = a mirror → new records; after the burst settles, ONE snapshot query finds the new snapshot key(s) and
//    ONE query per new snapshot (`snap = key(S)`) fetches its alerts, which are matched against "My list" on this phone only.
import W from "../../wallets.json";
import { query, Q } from "../../lib/read.mjs";
import { run } from "./data.js";

export const WSS = "wss://rpc.tiramisu.db-chain.testnet.arkiv.network";
const OP = "0x4400000000000000000000000000000000000044";
// keccak256 of the event signatures in @arkiv-network/sdk 0.8.1 (ENTITY_EVENTS_ABI); checked in test/live.test.mjs
export const TOPIC = {
  created: "0xb282d7c494b8899aa8015cd07be621530beb03409eb8c5e8fdc1411ba64356a5",
  extended: "0x10dc3526654c9ba4e2370b1bfcbc0de087d141a5694b3d3305d37df7e6705d4b",
};
const low = a => a.toLowerCase();
const pad = a => "0x" + low(a).slice(2).padStart(64, "0");
const WATCH = pad(W.WATCH);
export const OWNERS = [W.WATCH, W.MIRROR_CDSCO, W.MIRROR_KA, W.MIRROR_MH, W.CURATOR].map(pad);
export const filter = () => ({ address: OP, topics: [[TOPIC.created, TOPIC.extended], null, OWNERS] });

export const STATS = { status: "off", subId: "", events: 0, extended: 0, created: 0, matched: 0, queries: 0, since: 0, lastBlock: 0 };
const subs = new Set();
export const onLive = fn => { subs.add(fn); return () => subs.delete(fn); };
const emit = ev => subs.forEach(f => f(ev));

let ws = null, burst = [], timer = null, retry = 0;
export function startLive(getWatchlist) {
  if (ws) return;
  STATS.status = "connecting"; STATS.since = Date.now(); emit({ kind: "status" });
  ws = new WebSocket(WSS);
  ws.onopen = () => { retry = 0; ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["logs", filter()] })); };
  ws.onmessage = m => {
    const j = JSON.parse(m.data);
    if (j.id === 1) { STATS.subId = j.result || ""; STATS.status = j.result ? "live" : "error: " + (j.error?.message || "?"); emit({ kind: "status" }); return; }
    const l = j.params?.result; if (!l) return;
    STATS.events++; STATS.lastBlock = Number(l.blockNumber);
    const key = l.topics[1], owner = l.topics[2];
    const expiresAt = Number(BigInt("0x" + l.data.slice(2, 66)));
    if (l.topics[0] === TOPIC.extended) { STATS.extended++; if (owner === WATCH) emit({ kind: "extended", key, expiresAt, block: STATS.lastBlock }); }
    else if (l.topics[0] === TOPIC.created) { STATS.created++; burst.push(key); clearTimeout(timer); timer = setTimeout(() => settle(getWatchlist), 8000); }
    emit({ kind: "tick" });
  };
  ws.onclose = () => { ws = null; STATS.status = "reconnecting"; emit({ kind: "status" }); setTimeout(() => startLive(getWatchlist), Math.min(30e3, 2e3 * 2 ** retry++)); };
}

async function settle(getWatchlist) {
  const keys = new Set(burst.map(low)); burst = [];
  const list = await getWatchlist(); if (!list.length) return;     // nothing to match: spend no reads
  const qs = Q.snapshots("kharab");
  STATS.queries++;
  const snaps = (await run("Q19", qs, url => query(qs, { url, select: { key: true, creator: true, attributes: true } }))).entities.filter(s => keys.has(low(s.key)));
  const want = new Set(list);
  for (const s of snaps) {
    const q = Q.bySnapshot("kharab", s.key);
    STATS.queries++;
    const r = await run("Q15", q, url => query(q, { url, select: { key: true, creator: true, attributes: true } }));
    const hits = r.entities.filter(e => want.has(e.a.batch));
    if (hits.length) { STATS.matched += hits.length; emit({ kind: "watch-hit", hits, src: s.a.src }); }
  }
  emit({ kind: "tick" });
}

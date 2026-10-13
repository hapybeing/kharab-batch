// D1 spikes (a–i). Writes only under app='kharab-test'. Output is logged verbatim into arkiv/friction-log.md.
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk";
import { str, u64, key, bytes32, bool } from "@arkiv-network/sdk/attr";
import { eq, gt, and } from "@arkiv-network/sdk/query";
import { publicClient, walletFor, rpc, DEAD, SHADOW, EXPLORER, loadSecrets } from "../../lib/chain.mjs";
import { http, keccak256, toHex } from "viem";
import { createWalletClient } from "@arkiv-network/sdk";
import { privateKeyToAccount } from "viem/accounts";
import { chain, RPC } from "../../lib/chain.mjs";
loadSecrets();
const log = (...a) => console.log(new Date().toISOString(), ...a.map(x => typeof x === "string" ? x : JSON.stringify(x, (k, v) => typeof v === "bigint" ? v.toString() : v)));
const pub = publicClient();
const owner = createWalletClient({ chain, transport: http(RPC, { retryCount: 0 }), account: privateKeyToAccount(process.env.FUNDER_KEY) });
const stranger = walletFor("KEEPER_DEMO");
const RUN = "spike-" + Date.now();
const H = keccak256(toHex(RUN));

// f) WebSocket watcher first (no fromBlock)
const wsc = publicClient({ ws: true });
const seen = [];
const unwatch = wsc.watchEntityEvents({ onEvent: e => { seen.push(e); }, onError: e => log("ws error", e.message) });
await new Promise(r => setTimeout(r, 1500));

// a) create 2 sealed entities in one batch (predictEntityKeys + changeOwnership → dEaD)
const preds = await pub.predictEntityKeys({ owner: owner.account.address, count: 2 });
const creates = preds.map((p, i) => ({
  payload: jsonToPayload({ i, run: RUN }), contentType: "application/json", salt: p.salt,
  attributes: { app: str("kharab-test"), type: str("alert"), batch: str(i ? "SR13X" : "SR13"), run: str(RUN), exp_ym: u64(202704), row: bytes32(H), ok: bool(true), of: key(preds[0].key) },
  expires: ExpirationTime.fromHours(6), flags: { readonly: true, permissionlessExtension: true },
}));
const t0 = Date.now();
const a = await owner.executeBatch({ creates, ownershipChanges: preds.map(p => ({ entityKey: p.key, newOwner: DEAD })) });
const ra = await pub.waitForTransactionReceipt({ hash: a.txHash });
log("a) batch create+seal", { tx: a.txHash, created: a.createdEntities, predicted: preds.map(p => p.key), match: a.createdEntities.every((k, i) => k === preds[i].key), gas: ra.gasUsed, ms: Date.now() - t0, status: ra.status });
const ea = await pub.getEntity(a.createdEntities[0]);
log("a) entity", { owner: ea.owner, creator: ea.creator, expiresAt: ea.expiresAt });

// a2) owner tries to delete after sealing (expect revert: no longer owner)
try { await owner.deleteEntity({ entityKey: a.createdEntities[0] }); log("a2) delete after seal: ACCEPTED (unexpected)"); } catch (e) { log("a2) delete after seal rejected:", e.shortMessage || e.message.split("\n")[0]); }

// b) stranger extends the sealed entity
const head = await pub.getBlockNumber();
const b = await stranger.extendEntity({ entityKey: a.createdEntities[0], expires: ExpirationTime.fromHours(12) });
const rb = await pub.waitForTransactionReceipt({ hash: b.txHash });
const tx = await pub.getTransaction({ hash: b.txHash });
log("b) stranger extend", { tx: b.txHash, status: rb.status, gas: rb.gasUsed, from: tx.from, logs: rb.logs.map(l => l.topics) });
// b2) equal-target extend
const e1 = await pub.getEntity(a.createdEntities[0]);
try { const r = await stranger.extendEntity({ entityKey: a.createdEntities[0], expires: ExpirationTime.atBlock(e1.expiresAt) }); const rr = await pub.waitForTransactionReceipt({ hash: r.txHash }); log("b2) equal-target extend accepted", { status: rr.status, logs: rr.logs.length }); } catch (e) { log("b2) equal-target extend rejected:", e.shortMessage || e.message.split("\n")[0]); }

// c) owner extends readonly leases: 100 creates (2 batches of 50) then extend all 100 in one batch
const leaseKeys = [];
for (let j = 0; j < 2; j++) {
  const r = await owner.executeBatch({ creates: Array.from({ length: 50 }, (_, i) => ({ payload: jsonToPayload({ j, i }), contentType: "application/json", attributes: { app: str("kharab-test"), type: str("pending"), run: str(RUN), since_ymd: u64(20250101 + i) }, expires: ExpirationTime.fromHours(36), flags: { readonly: true } })) });
  const rr = await pub.waitForTransactionReceipt({ hash: r.txHash }); leaseKeys.push(...r.createdEntities); log("c) create 50 leases", { gas: rr.gasUsed });
}
const t1 = Date.now();
const c = await owner.executeBatch({ extensions: leaseKeys.map(k => ({ entityKey: k, expires: ExpirationTime.fromHours(40) })) });
const rc = await pub.waitForTransactionReceipt({ hash: c.txHash });
log("c) extend 100 readonly leases in one batch", { tx: c.txHash, status: rc.status, gas: rc.gasUsed, perExt: Number(rc.gasUsed) / 100, logs: rc.logs.length, ms: Date.now() - t1 });
// c2) stranger extends a non-permissionless lease (expect revert)
try { await stranger.extendEntity({ entityKey: leaseKeys[0], expires: ExpirationTime.fromHours(48) }); log("c2) stranger extend of owner-only lease: ACCEPTED (unexpected)"); } catch (e) { log("c2) stranger extend of owner-only lease rejected:", e.shortMessage || e.message.split("\n")[0]); }

// d) STARTSWITH on str
const qd = await rpc("arkiv_query", [`app = str('kharab-test') AND run = str('${RUN}') AND batch STARTSWITH str('SR1')`, { select: { key: true, attributes: true } }]);
log("d) STARTSWITH", { n: qd.data.length });
// e) raw $createdAt + filtered count; SDK builder with $createdAt
const qe = await rpc("arkiv_query", [`app = str('kharab-test') AND run = str('${RUN}') AND $createdAt > u64(${head - 100n})`, {}]);
log("e) raw $createdAt", { n: qe.data.length });
try { await pub.select({ key: true }).where(and(eq("app", str("kharab-test")), gt("$createdAt", u64(1n)))).fetch(); log("e) SDK $createdAt accepted"); } catch (e) { log("e) SDK $createdAt:", e.name, (e.shortMessage || e.message).split("\n")[0]); }
const cnt = await rpc("arkiv_getEntityCount", [{ query: `app = str('kharab-test') AND run = str('${RUN}') AND type = str('pending')` }]).catch(e => "ERR " + e.message);
log("e) filtered count (object param)", cnt);
const cnt2 = await rpc("arkiv_getEntityCount", [`app = str('kharab-test') AND run = str('${RUN}') AND type = str('pending')`]).catch(e => "ERR " + e.message);
log("e) filtered count (string param)", cnt2);
log("e) SDK getEntityCount()", await pub.getEntityCount());

// g) atBlock depth
for (const back of [100n, 10000n, 100000n, 400000n]) {
  const blk = head - back;
  try { const r = await rpc("arkiv_query", ["type = str('x-never')", { atBlock: toHex(blk) }]); log("g) atBlock", { back, ok: true, blockNumber: r.blockNumber }); }
  catch (e) { log("g) atBlock", { back, err: e.message }); }
}
// h) shadow-RPC parity
await new Promise(r => setTimeout(r, 8000));
const qq = `app = str('kharab-test') AND run = str('${RUN}') AND type = str('alert')`;
const sel = { select: { key: true, owner: true, creator: true, attributes: true, expiresAt: true } };
const r1 = await rpc("arkiv_query", [qq, sel]); const r2 = await rpc("arkiv_query", [qq, sel], SHADOW).catch(e => ({ err: e.message }));
log("h) node", r1.data?.[0]); log("h) shadow", r2.data?.[0] ?? r2);
const kq = `app = str('kharab-test') AND of = key(${preds[0].key})`, bq = `app = str('kharab-test') AND row = bytes32(${H})`, boq = `app = str('kharab-test') AND run = str('${RUN}') AND ok = true`;
for (const q of [kq, bq, boq]) { const n1 = (await rpc("arkiv_query", [q, {}])).data.length; const n2 = await rpc("arkiv_query", [q, {}], SHADOW).then(r => r.data.length).catch(e => "ERR " + e.message); log("h) parity", { q: q.slice(25, 60), node: n1, shadow: n2 }); }
// i) explorer entity API + CORS
const ri = await fetch(`${EXPLORER}/api/entity/${a.createdEntities[0]}`, { headers: { Origin: "https://hapybeing.github.io" } });
log("i) explorer /api/entity", { status: ri.status, acao: ri.headers.get("access-control-allow-origin"), body: (await ri.text()).slice(0, 600) });
const rs = await fetch(SHADOW, { method: "OPTIONS", headers: { Origin: "https://hapybeing.github.io", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
log("i) shadow preflight", { status: rs.status, acao: rs.headers.get("access-control-allow-origin") });
const rr2 = await fetch(RPC, { method: "OPTIONS", headers: { Origin: "https://hapybeing.github.io", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" } });
log("i) rpc preflight", { status: rr2.status, acao: rr2.headers.get("access-control-allow-origin") });

// f) results
await new Promise(r => setTimeout(r, 3000)); unwatch();
const mine = new Set([...a.createdEntities, ...leaseKeys]);
const kinds = {}; for (const e of seen) { if (mine.has(e.entityKey)) kinds[e.type] = (kinds[e.type] || 0) + 1; }
log("f) WS events total", seen.length, "ours by type", kinds, "sample", seen.find(e => e.type === "ExpiryExtended" && mine.has(e.entityKey)));
process.exit(0);

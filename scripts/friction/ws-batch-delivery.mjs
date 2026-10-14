// Friction repro: are ExpiryExtended logs from one big executeBatch delivered over a WebSocket eth_subscribe("logs")?
// Creates 200 tiny entities (app='kharab-test', 2 h), subscribes (raw WS: filtered by address+topic+owner, and unfiltered),
// then extends them in batches of 10, 50, 100, 150, 200 and compares logs delivered vs logs in each receipt.
//   KHARAB_SECRETS=… node scripts/friction/ws-batch-delivery.mjs   (signs with FUNDER_KEY)
import { createWalletClient, ExpirationTime, jsonToPayload } from "@arkiv-network/sdk";
import { str, u64 } from "@arkiv-network/sdk/attr";
import { http, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import WebSocket from "ws";
import { chain, RPC, WSS, publicClient, loadSecrets } from "../../lib/chain.mjs";
loadSecrets();
const acct = privateKeyToAccount(process.env.FUNDER_KEY);
const w = createWalletClient({ chain, transport: http(RPC, { retryCount: 0 }), account: acct }), pub = publicClient();
const EXT = keccak256(toHex("ExpiryExtended(bytes32,address,uint64)"));
const owner = "0x" + acct.address.slice(2).toLowerCase().padStart(64, "0");
const run = "wsdeliv-" + Date.now(), keys = [];
for (let i = 0; i < 200; i += 25) {
  const r = await w.executeBatch({ creates: Array.from({ length: 25 }, (_, j) => ({ payload: jsonToPayload({ i: i + j }), contentType: "application/json", expires: ExpirationTime.fromHours(2), attributes: { app: str("kharab-test"), v: u64(1), type: str("wsprobe"), run: str(run) } })) });
  await pub.waitForTransactionReceipt({ hash: r.txHash }); keys.push(...r.createdEntities);
}
console.log("created", keys.length, "entities, run", run);
const ws = new WebSocket(WSS); const sub = {}; const got = { filtered: {}, unfiltered: {} };
await new Promise(res => ws.on("open", res));
ws.on("message", m => { const j = JSON.parse(m); if (j.id) { sub[j.result] = j.id === 1 ? "filtered" : "unfiltered"; return; } const l = j.params.result; if (l.topics[0] !== EXT || l.topics[2] !== owner) return; const s = sub[j.params.subscription]; got[s][l.transactionHash] = (got[s][l.transactionHash] || 0) + 1; });
ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["logs", { address: "0x4400000000000000000000000000000000000044", topics: [EXT, null, owner] }] }));
ws.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_subscribe", params: ["logs", { address: "0x4400000000000000000000000000000000000044" }] }));
await new Promise(r => setTimeout(r, 3000));
const out = [];
let h = 3;
for (const n of [10, 50, 100, 150, 200]) {
  const r = await w.executeBatch({ extensions: keys.slice(0, n).map(k => ({ entityKey: k, expires: ExpirationTime.fromHours(h++) })) });
  const rc = await pub.waitForTransactionReceipt({ hash: r.txHash });
  await new Promise(res => setTimeout(res, 8000));
  out.push({ n, tx: r.txHash, block: Number(rc.blockNumber), receipt_logs: rc.logs.length, ws_filtered: got.filtered[r.txHash] || 0, ws_unfiltered: got.unfiltered[r.txHash] || 0 });
  console.log(JSON.stringify(out.at(-1)));
}
ws.close(); process.exit(0);

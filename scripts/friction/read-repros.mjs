// Friction repros for the READ-ONLY items (#2, #3, #4, #5, #12 in arkiv/friction.md).
// No key, no writes, ~20 keyless RPC calls. Prints one PASS/FAIL line per item: PASS means "we still see the behaviour we reported".
//   node scripts/friction/read-repros.mjs            (add --json to also print the raw evidence)
import { createPublicClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { gt } from "@arkiv-network/sdk/query";
import { http, keccak256, toHex } from "viem";
import { RPC } from "../../lib/read.mjs";

const raw = async (method, params) => {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, headers: Object.fromEntries(r.headers), error: j.error, result: j.result };
};
const out = {}, lines = [];
const report = (n, title, pass, detail) => { out[n] = { title, pass, detail }; lines.push(`${pass ? "PASS" : "FAIL"}  #${n}  ${title}  — ${detail}`); };
const app = { query: "app = str('kharab') AND type = str('alert')" };
const sel = { key: true };

// #2 cursor pagination without atBlock: page through until the node rejects the cursor (needs a block to land: ~2 s per block).
{
  let cursor, pages = 0, err = null;
  try {
    do {
      const r = await raw("arkiv_query", [app.query, { select: sel, limit: "0x32", ...(cursor ? { cursor } : {}) }]);
      if (r.error) { err = `${r.error.code} ${r.error.message}`; break; }
      cursor = r.result.cursor; pages++;
      await new Promise(s => setTimeout(s, 1200)); // a realistic client pace; blocks are ~2 s
    } while (cursor && pages < 14);
  } catch (e) { err = String(e); }
  report(2, "cursor invalid once a block lands mid page-through", !!err && /cursor/i.test(err), err ? `after ${pages} pages: ${err}` : `not reproduced in ${pages} pages (the node may have pinned the block now)`);
}

// #3 $createdAt: SDK builder rejects, raw RPC accepts.
{
  let sdkErr = null;
  try {
    gt("$createdAt", 1); // the SDK predicate builder throws before anything is sent
  } catch (e) { sdkErr = (e.shortMessage || e.message || String(e)).split("\n")[0]; }
  const r = await raw("arkiv_query", [`$createdAt > u64(1) AND app = str('kharab')`, { select: sel, limit: "0x64" }]);
  const n = r.result?.data?.length ?? 0;
  report(3, "$createdAt: SDK builder rejects, raw RPC accepts", !!sdkErr && n > 0, `SDK: ${sdkErr ?? "accepted"}; raw: ${r.error ? r.error.message : n + " hits"}`);
}

// #4 filtered count: SDK getEntityCount() has no filter; raw wants an object, rejects a bare string.
{
  const obj = await raw("arkiv_getEntityCount", [{ query: app.query }]);
  const str = await raw("arkiv_getEntityCount", [app.query]);
  let sdkArgs = null;
  try { const c = createPublicClient({ chain: tiramisu, transport: http(RPC) }); sdkArgs = c.getEntityCount.length; } catch {}
  report(4, "filtered count only via raw RPC, only as an object", obj.result != null && !!str.error, `object form → ${obj.result != null ? Number(BigInt(obj.result)) : obj.error?.message}; bare string → ${str.error ? str.error.code + " " + str.error.message.slice(0, 60) : "accepted"}; SDK getEntityCount declared params: ${sdkArgs}`);
}

// #5 read-cost headers: arkiv-cost present on arkiv_query, quota header missing, nothing on getEntityCount.
{
  const q = await raw("arkiv_query", [app.query, { select: sel, limit: "0x1" }]);
  const c = await raw("arkiv_getEntityCount", [{ query: app.query }]);
  const h = q.headers, ch = c.headers;
  const exposed = h["access-control-expose-headers"] || "(none)";
  report(5, "read-cost headers half there", "arkiv-cost" in h && !("arkiv-quota-used-percent" in h) && !("arkiv-cost" in ch), `arkiv_query: arkiv-cost=${h["arkiv-cost"]}, quota header ${"arkiv-quota-used-percent" in h ? "present" : "absent"}; getEntityCount: arkiv-cost ${"arkiv-cost" in ch ? ch["arkiv-cost"] : "absent"}; ratelimit=${h["ratelimit"]}; expose-headers=${exposed}`);
}

// #12 eth_getLogs block range cap.
{
  const EXT = keccak256(toHex("ExpiryExtended(bytes32,address,uint64)"));
  const r = await raw("eth_getLogs", [{ address: "0x4400000000000000000000000000000000000044", fromBlock: "0x0", toBlock: "latest", topics: [EXT, "0x" + "00".repeat(32)] }]);
  report(12, "eth_getLogs capped at 100,000 blocks (even for one entity key)", !!r.error && /range/i.test(r.error.message), r.error ? `${r.error.code} ${r.error.message}` : "accepted (cap lifted?)");
}

console.log(lines.join("\n"));
if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
process.exit(Object.values(out).every(x => x.pass) ? 0 : 1);

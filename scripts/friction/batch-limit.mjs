// Friction repro: how many alert-sized creates fit in one executeBatch before the RPC rejects it?
// Each create: 18 attributes + ~350 B JSON payload (same shape as a real alert), namespace app='kharab-test'.
//   KHARAB_SECRETS=... node scripts/friction/batch-limit.mjs [sizes...]   (signs with FUNDER_KEY)
import { createWalletClient, ExpirationTime, jsonToPayload } from "@arkiv-network/sdk";
import { str, u64, bool, bytes32 } from "@arkiv-network/sdk/attr";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, RPC, publicClient, loadSecrets } from "../../lib/chain.mjs";
import { sha256hex } from "../../lib/norm.mjs";
loadSecrets();
const w = createWalletClient({ chain, transport: http(RPC, { retryCount: 0 }), account: privateKeyToAccount(process.env.FUNDER_KEY) });
const pub = publicClient();
const blk = await pub.getBlock(); console.log("block gasLimit", blk.gasLimit.toString(), "number", blk.number.toString());
const sizes = process.argv.slice(2).map(Number); if (!sizes.length) sizes.push(20, 25, 30, 35, 40);
const run = "batchlimit-" + Date.now();
const TINY = !!process.env.TINY;
const mk = i => ({ payload: TINY ? jsonToPayload({ i }) : jsonToPayload({ v: 1, product: "Paracetamol Tablets IP 500 mg ".repeat(3), batch_raw: "TEST" + i, mfg: "Jan-2026", exp: "Dec-2027", result: "Does not conform to IP with respect to Dissolution test. ".repeat(3), lab_name: "CDL, Kolkata", source_url: "https://cdscoonline.gov.in/CDSCO/viewPublicNSQDrug" }),
  contentType: "application/json", expires: ExpirationTime.fromHours(2),
  attributes: { app: str("kharab-test"), v: u64(1), type: str("alert"), batch: str("TEST" + i), src: str("cdsco"), ptok: str("paracetamol"), pname: str("Paracetamol Tablets IP 500 mg"), exp_ym: u64(202712), exp_ok: bool(true), src_ym: u64(202608), src_ymd: u64(0), class: str("nsq"), test: str("dissolution"), lab: str("central"), rstate: str("in"), row: bytes32(sha256hex("r" + i)), rid: bytes32(sha256hex("i" + i)), run: str(run) } });
for (const n of sizes) {
  const t = Date.now();
  try { const r = await w.executeBatch({ creates: Array.from({ length: n }, (_, i) => mk(i)) }); const rc = await pub.waitForTransactionReceipt({ hash: r.txHash });
    console.log(JSON.stringify({ n, ok: true, gas: rc.gasUsed.toString(), perCreate: Math.round(Number(rc.gasUsed) / n), ms: Date.now() - t })); }
  catch (e) { console.log(JSON.stringify({ n, ok: false, err: String(e.shortMessage || e.message).slice(0, 200), details: String(e.details || e.cause?.details || e.cause?.cause?.details || "").slice(0, 200) })); }
}
process.exit(0);

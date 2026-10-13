// Shared chain helpers. Keys come from environment variables only (never from the repo).
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { http, webSocket } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";

export const RPC = "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
export const WSS = "wss://rpc.tiramisu.db-chain.testnet.arkiv.network";
export const EXPLORER = "https://tiramisu.explorer.arkiv.network";
export const SHADOW = EXPLORER + "/api/shadow-rpc/experimental";
export const DEAD = "0x000000000000000000000000000000000000dEaD";
export const chain = tiramisu;

/** Load KEY=VALUE lines from $KHARAB_SECRETS (a file outside the repo) into process.env. */
export function loadSecrets() {
  const f = process.env.KHARAB_SECRETS;
  if (f && fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}

export function publicClient(opts = {}) {
  return createPublicClient({ chain, transport: opts.ws ? webSocket(WSS) : http(RPC, { retryCount: opts.retry ?? 2 }) });
}

export function walletFor(role) {
  loadSecrets();
  const pk = process.env[`${role}_KEY`];
  if (!pk) throw new Error(`missing ${role}_KEY in environment`);
  const account = privateKeyToAccount(pk);
  return createWalletClient({ chain, transport: http(RPC, { retryCount: 0 }), account });
}

export function wallets() {
  return JSON.parse(fs.readFileSync(new URL("../wallets.json", import.meta.url), "utf8"));
}

/** Raw JSON-RPC call (used where the SDK cannot express a request, e.g. filtered counts). */
export async function rpc(method, params, url = RPC) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) { const e = new Error(`${method}: ${j.error.code} ${j.error.message}`); e.code = j.error.code; throw e; }
  return j.result;
}

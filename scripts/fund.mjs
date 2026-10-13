// Distribute test GLM from the build wallet (FUNDER_KEY) to the role wallets.
import { publicClient, chain, RPC, wallets, loadSecrets } from "../lib/chain.mjs";
import { createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
loadSecrets();
const amounts = { ROOT: "0.2", MIRROR_CDSCO: "2", MIRROR_KA: "0.6", MIRROR_MH: "0.3", CURATOR: "0.1", WATCH: "1", HISTORY: "0.3", KEEPER_DEMO: "0.05" };
const pub = publicClient();
const w = createWalletClient({ chain, transport: http(RPC), account: privateKeyToAccount(process.env.FUNDER_KEY) });
const W = wallets();
for (const [role, amt] of Object.entries(amounts)) {
  const bal = await pub.getBalance({ address: W[role] });
  if (bal >= parseEther(amt) / 2n) { console.log(role, "has", formatEther(bal)); continue; }
  const h = await w.sendTransaction({ to: W[role], value: parseEther(amt) });
  await pub.waitForTransactionReceipt({ hash: h });
  console.log(role, W[role], "+", amt, h);
}

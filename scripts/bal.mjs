import { publicClient, wallets } from "../lib/chain.mjs";
import { formatEther } from "viem";
const p=publicClient(); const W={...wallets(), BUILD:"0x43cBFAEe2420da081C94070B5E033AC5cb500516"};
for (const [r,a] of Object.entries(W)) console.log(r, formatEther(await p.getBalance({address:a})));
console.log("gasPrice", await p.getGasPrice());

import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs";
import { keccak256, toHex } from "viem";
const src = fs.readFileSync(new URL("../web/src/live.js", import.meta.url), "utf8");
test("WS topic constants equal keccak256 of the SDK 0.8.1 event signatures", () => {
  assert.ok(src.includes(keccak256(toHex("EntityCreated(bytes32,address,uint64,uint8)"))));
  assert.ok(src.includes(keccak256(toHex("ExpiryExtended(bytes32,address,uint64)"))));
  const sdk = fs.readFileSync(new URL("../node_modules/@arkiv-network/sdk/dist/entity-CniBgBSd.js", import.meta.url), "utf8");
  assert.ok(sdk.includes("event EntityCreated(bytes32 indexed entityKey, address indexed owner, uint64 expiresAt, uint8 creationFlags)"));
  assert.ok(sdk.includes("event ExpiryExtended(bytes32 indexed entityKey, address indexed owner, uint64 expiresAt)"));
});
test("live layer has no polling: no setInterval, no fromBlock", () => { assert.ok(!/setInterval/.test(src)); assert.ok(!/fromBlock\s*[:=]/.test(src)); });

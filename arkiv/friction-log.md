# Raw friction log (dated, unedited)

Versions: @arkiv-network/sdk 0.8.1, viem 2.57.5, Node v22.23.3, Tiramisu chain 7738577 (reth/v2.5.0-189c0df). Times IST.

## 2026-10-13 09:00 IST — build start
- 09:00 build started (repo scaffold, 8 role wallets generated and funded from the build wallet).

## 2026-10-13 09:04 IST — D1 spikes (scripts/spikes/d1.mjs, namespace app='kharab-test')
```
2026-10-13T03:34:46.897Z a) batch create+seal {"tx":"0x413c2f87706a8ed720254b308cb590ce3f61e2cc606186330b18e5c33a706233","created":["0x3be87ec7e5cb2a026caeca1535f7ffcb77f68708f5388f5516b292c3723e1357","0x8910a4c31b13eabbc48b74a87a79761c118954c260abae5cfa74770386fc0f1f"],"predicted":["0x3be87ec7e5cb2a026caeca1535f7ffcb77f68708f5388f5516b292c3723e1357","0x8910a4c31b13eabbc48b74a87a79761c118954c260abae5cfa74770386fc0f1f"],"match":true,"gas":"281632","ms":6194,"status":"success"}
2026-10-13T03:34:47.107Z a) entity {"owner":"0x000000000000000000000000000000000000dEaD","creator":"0x43cBFAEe2420da081C94070B5E033AC5cb500516","expiresAt":"517166"}
2026-10-13T03:34:47.830Z a2) delete after seal rejected: Transaction failed: entity 0x3be87ec7…3e1357 is owned by 0x000000000000000000000000000000000000dEaD, not 0x43cBFAEe2420da081C94070B5E033AC5cb500516
2026-10-13T03:34:54.274Z b) stranger extend {"tx":"0xb85edca412a5124e7201e69995cf6d2f2d80df170fe87226fa97e469f8db1cfa","status":"success","gas":"25210","from":"0x024f89a3eea3bd52a043e664de1eda438260b876","logs":[["0x10dc3526654c9ba4e2370b1bfcbc0de087d141a5694b3d3305d37df7e6705d4b","0x3be87ec7e5cb2a026caeca1535f7ffcb77f68708f5388f5516b292c3723e1357","0x000000000000000000000000000000000000000000000000000000000000dead"]]}
2026-10-13T03:35:00.252Z b2) equal-target extend accepted {"status":"success","logs":1}
2026-10-13T03:35:06.690Z c) create 50 leases {"gas":"5023840"}
2026-10-13T03:35:12.741Z c) create 50 leases {"gas":"5023840"}
2026-10-13T03:35:18.629Z c) extend 100 readonly leases in one batch {"tx":"0xe346ba2313981ff6623aeca6fbd82652bad4dd735aa260a3f2a0f500a1bd5b5c","status":"success","gas":"1000000","perExt":10000,"logs":100,"ms":5888}
2026-10-13T03:35:19.507Z c2) stranger extend of owner-only lease rejected: Transaction failed: entity 0x07be7a86…24d204 is owned by 0x43cBFAEe2420da081C94070B5E033AC5cb500516, not 0x024f89A3eEa3BD52a043e664dE1EdA438260B876
2026-10-13T03:35:19.706Z d) STARTSWITH {"n":2}
2026-10-13T03:35:19.905Z e) raw $createdAt {"n":100}
2026-10-13T03:35:19.905Z e) SDK $createdAt: InvalidPredicateError "$createdAt" is returned in query results but carries no index, so it cannot be filtered on. Select it and filter the results in JavaScript instead.
2026-10-13T03:35:20.098Z e) filtered count (object param) 100
2026-10-13T03:35:20.272Z e) filtered count (string param) ERR arkiv_getEntityCount: -32602 invalid params: ErrorObject { code: InvalidParams, message: "Invalid params", data: Some(RawValue("invalid type: string \"app = str('kharab-test') AND run = str('spike-1791862478978') AND type = str('pending')\", expected struct CountRequest at line 1 column 89")) }
2026-10-13T03:35:20.465Z e) SDK getEntityCount() 2089
2026-10-13T03:35:20.636Z g) atBlock {"back":"100","ok":true,"blockNumber":"0x7b99b"}
2026-10-13T03:35:20.811Z g) atBlock {"back":"10000","ok":true,"blockNumber":"0x792ef"}
2026-10-13T03:35:20.986Z g) atBlock {"back":"100000","ok":true,"blockNumber":"0x6335f"}
2026-10-13T03:35:21.164Z g) atBlock {"back":"400000","ok":true,"blockNumber":"0x19f7f"}
2026-10-13T03:35:29.922Z h) node {"key":"0x8910a4c31b13eabbc48b74a87a79761c118954c260abae5cfa74770386fc0f1f","owner":"0x000000000000000000000000000000000000dead","creator":"0x43cbfaee2420da081c94070b5e033ac5cb500516","expiresAt":"0x7e42e","attributes":[{"name":"app","type":"str","value":"kharab-test"},{"name":"batch","type":"str","value":"SR13X"},{"name":"exp_ym","type":"u64","value":"0x317d0"},{"name":"of","type":"key","value":"0x3be87ec7e5cb2a026caeca1535f7ffcb77f68708f5388f5516b292c3723e1357"},{"name":"ok","type":"bool","value":true},{"name":"row","type":"bytes32","value":"0x262d2b6488f95a7e764482197cfddcb09dbfe357af9f67baa1e6389fe972a172"},{"name":"run","type":"str","value":"spike-179186
2026-10-13T03:35:29.922Z h) shadow {"key":"0x8910a4c31b13eabbc48b74a87a79761c118954c260abae5cfa74770386fc0f1f","owner":"0x000000000000000000000000000000000000dead","creator":"0x43cbfaee2420da081c94070b5e033ac5cb500516","expiresAt":"0x7e42e","attributes":[{"name":"app","type":"str","value":"kharab-test"},{"name":"batch","type":"str","value":"SR13X"},{"name":"exp_ym","type":"u64","value":"0x317d0"},{"name":"of","type":"key","value":"0x3be87ec7e5cb2a026caeca1535f7ffcb77f68708f5388f5516b292c3723e1357"},{"name":"ok","type":"bool","value":true},{"name":"row","type":"bytes32","value":"0x262d2b6488f95a7e764482197cfddcb09dbfe357af9f67baa1e6389fe972a172"},{"name":"run","type":"str","value":"spike-1791
2026-10-13T03:35:30.293Z h) parity {"q":"AND of = key(0x3be87ec7e5cb2a026cae","node":2,"shadow":2}
2026-10-13T03:35:30.702Z h) parity {"q":"AND row = bytes32(0x262d2b6488f95a7","node":2,"shadow":2}
2026-10-13T03:35:31.100Z h) parity {"q":"AND run = str('spike-1791862478978'","node":2,"shadow":2}
2026-10-13T03:35:31.293Z i) explorer /api/entity {"status":200,"acao":"*","body":"{\"entityKey\":\"0x3be87ec7e5cb2a026caeca1535f7ffcb77f68708f5388f5516b292c3723e1357\",\"count\":4,\"totalOperations\":4,\"truncated\":false,\"names\":[\"blockNumber\",\"blockNumberDecimal\",\"blockDate\",\"position\",\"hash\",\"opIndex\",\"operationType\",\"operation\",\"entityKey\",\"contentType\",\"payloadSizeBytes\",\"attributes\",\"expiresAtBlocks\",\"newOwner\",\"isReference\",\"payloadReference\",\"referenceVerification\",\"referenceError\"],\"operations\":[[506366,\"506366\",\"2026-10-13T03:34:44.000Z\",0,\"0x413c2f87706a8ed720254b308cb590ce3f61e2cc606186330b18e5c33a706233\",0,1,\"create\",\"0x3be87ec7e5
2026-10-13T03:35:31.465Z i) shadow preflight {"status":204,"acao":"*"}
2026-10-13T03:35:31.647Z i) rpc preflight {"status":204,"acao":"*"}
2026-10-13T03:35:34.648Z f) WS events total 259 ours by type {"EntityCreated":102,"OwnershipTransferred":2,"ExpiryExtended":102} sample {"type":"ExpiryExtended","blockNumber":"506369","transactionHash":"0xb85edca412a5124e7201e69995cf6d2f2d80df170fe87226fa97e469f8db1cfa","logIndex":1,"entityKey":"0x3be87ec7e5cb2a026caeca1535f7ffcb77f68708f5388f5516b292c3723e1357","owner":"0x000000000000000000000000000000000000dEaD","expiresAt":"527969"}
```

### Notes on the spike output (09:10 IST)
- a) `predictEntityKeys` + `executeBatch({creates, ownershipChanges → 0x…dEaD})`: predicted keys == minted keys; sealed in one tx (281,632 gas for 2 creates + 2 transfers). Smooth.
- a2) Former owner `deleteEntity` after sealing → rejected: "entity … is owned by 0x…dEaD, not 0x43cB…". Expected; good error text.
- b) A stranger extended the sealed `permissionlessExtension` entity (25,210 gas). The `ExpiryExtended` log's owner topic is `0x…dEaD`, so **who extended is only recoverable from `tx.from`** (not from the event).
- b2) Extending to the **same** expiry was accepted and still emitted `ExpiryExtended` (1 log). JSON-RPC docs say equal → revert; TS docs say no-op. Neither matches exactly.
- c) 100 owner-only extensions in one `executeBatch`: gas **exactly 1,000,000 = 10,000 per extension**, vs 25,210 for a single `extendEntity` tx. A stranger extending an owner-only lease → rejected (good).
- d) `batch STARTSWITH str('SR1')` works on `str`.
- e) SDK builder rejects `$createdAt` with `InvalidPredicateError` ("carries no index"); the node accepts the same predicate in a raw `arkiv_query` (100 hits). Raw `arkiv_getEntityCount` accepts a filter only as an object `{query: "…"}`; a bare string → `-32602 … expected struct CountRequest`. SDK `getEntityCount()` takes no filter (returned 2,089 = chain-wide).
- g) `atBlock` 100 / 10,000 / 100,000 / 400,000 blocks back all answered (head ≈ 506,3xx), i.e. retention covers the whole chain since the 1 Oct restart.
- h) Explorer shadow-RPC returned byte-identical attributes for `key`, `bytes32`, `bool`, `u64`, `str` (and owner/creator/expiresAt) and the same hit counts for `key =`, `bytes32 =`, `bool` predicates.
- i) CORS: RPC, shadow-RPC (`OPTIONS` 204, `Access-Control-Allow-Origin: *`) and explorer `/api/entity/:key` (200, `*`) are all callable from a browser origin.
- f) WebSocket `watchEntityEvents` with no `fromBlock`: in ~25 s it delivered 259 events chain-wide; ours: 102 `EntityCreated`, 2 `OwnershipTransferred`, 102 `ExpiryExtended`. The SDK offers no owner/topic filter, so the client filters a firehose.

## 2026-10-13 09:14 IST — first production load
- `executeBatch` with **40 creates + 40 ownership transfers** (each create ≈18 attributes + ≈350 B JSON payload; ≈196 k gas each, ≈8 M gas total) failed client-side with `EntityMutationError: Transaction failed: Execution error without revert data`, cause `HTTP request failed … Details: "BAD_REQUEST"` (viem, during gas estimation). The same items in chunks of **20 + 20** (≈3.9 M gas) succeed every time. The 7-create batch earlier also worked. Threshold and cause (request size? gas cap on `eth_estimateGas`?) to be isolated in `scripts/friction/batch-limit.mjs`.
- A CDSCO snapshot payload with 4,420 eight-byte row hashes (≈80 KB JSON) cost 3,448,750 gas in one create: fine, but shows payload bytes dominate cost (~40 gas/B).

## 2026-10-13 14:10 IST — batch limit isolated (scripts/friction/batch-limit.mjs, app='kharab-test', build wallet)
Block gas limit reported by `eth_getBlock`: 36,000,000 (block 515,446).
```
alert-shaped creates (18 attrs, ~600 B payload): n=20 ok 3,545,760 gas · n=25 ok 4,432,240 · n=27 ok 4,786,832 · n=30 FAIL · n=40 FAIL
tiny creates (18 attrs, 8 B payload):           n=30 ok 5,111,360 gas · n=40 FAIL · n=60 FAIL
FAIL = EntityMutationError "Transaction failed: Execution error without revert data", viem details "BAD_REQUEST"
```
- The cut-off follows **gas, not request bytes**: it falls between ~5.11 M and ~5.32 M gas whatever the payload size, i.e. at about 1/7 of the block gas limit. Looks like an RPC-side cap on `eth_estimateGas`/tx gas that is not documented anywhere we could find.
- Expected: either the documented block limit applies, or a clear error ("gas cap 5,000,000 exceeded"). Actual: an opaque `BAD_REQUEST` with no revert data, thrown during gas estimation, so the SDK cannot tell the caller to split the batch.
- Workaround in `lib/writer.mjs`: chunks of 20 creates + 20 ownership transfers (~3.9 M gas).

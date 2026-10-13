import test from "node:test"; import assert from "node:assert/strict";
import { normBatch, splitBatches, ptok, ym, ymd, productsAgree, canonical, truncBytes } from "../lib/norm.mjs";
test("normBatch", () => {
  assert.equal(normBatch("SR-13"), "SR13"); assert.equal(normBatch("B.No. AL-24002"), "AL24002");
  assert.equal(normBatch("Batch No: R01GL2523"), "R01GL2523"); assert.equal(normBatch("Not mentioned"), ""); assert.equal(normBatch("NA"), ""); assert.equal(normBatch("."), "");
});
test("splitBatches", () => {
  assert.deepEqual(splitBatches("ABC123/ABC124"), ["ABC123", "ABC124"]);
  assert.deepEqual(splitBatches("X1001 & X1002 and X1003"), ["X1001", "X1002", "X1003"]);
  assert.deepEqual(splitBatches("SR-13"), ["SR13"]);
});
test("ptok + agreement", () => {
  assert.equal(ptok("Coldrif Syrup (Paracetamol, Phenylephrine Hydrochloride)"), "coldrif");
  assert.equal(ptok("Calcium Carbonate 500 MG + VIT. D3 Tablets IP (CALXIA 500)"), "carbonate");
  assert.ok(productsAgree("COLDRIF (paracetamol)", "Coldrif Syrup")); assert.ok(!productsAgree("Paracetamol Tablets", "Amoxicillin Capsules"));
});
test("dates", () => {
  for (const [s, v] of [["Apr-2027", 202704], ["04-2027", 202704], ["04/2027", 202704], ["01/10/2027", 202710], ["OCT-2025", 202510], ["2027-04-30", 202704], ["Sept-26", 202609], ["garbage", 0]]) assert.equal(ym(s), v, s);
  assert.equal(ymd("12-Oct-2026"), 20261012); assert.equal(ymd("x"), 0);
});
test("canonical + truncBytes", () => {
  assert.equal(canonical({ b: 1, a: [2, { d: 3, c: null }] }), '{"a":[2,{"c":null,"d":3}],"b":1}');
  assert.ok(Buffer.byteLength(truncBytes("ख़राब बैच ".repeat(20), 120)) <= 120);
});

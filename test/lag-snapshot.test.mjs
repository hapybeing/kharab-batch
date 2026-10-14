import test from "node:test"; import assert from "node:assert/strict";
import { nationalLag, snapshotStatus } from "../lib/read.mjs";
const N = "0xnational";
const al = (creator, src, src_ym, src_ymd) => ({ key: "0x" + Math.random().toString(16).slice(2), creator, a: { type: "alert", src, src_ym, src_ymd } });
test("SR-13: Telangana 4 Oct 2025 → CDSCO OCT-2025 list declared 21 Nov 2025 = 48 days", () => {
  const r = nationalLag([al(N, "cdsco", 202510, 0), al("0xcur", "tg", 202510, 20251004), al("0xcur", "who", 202510, 20251013)], N);
  assert.equal(r.status, "carried"); assert.equal(r.days, 48); assert.equal(r.basis, "declared"); assert.equal(r.firstSrc, "tg");
});
test("R01GL2523: notices but no national alert → absent", () => assert.equal(nationalLag([al("0xcur", "who", 202510, 20251013)], N).status, "absent"));
test("undeclared list month uses the 1st of the next month as a lower bound", () => { const r = nationalLag([al(N, "cdsco", 202603, 0), al("0xka", "ka", 202602, 20260210)], N); assert.equal(r.basis, "lower-bound"); assert.equal(r.days, 50); });
const snap = (key, src, count, fetched, extra = {}) => ({ key, a: { type: "snapshot", src, list_ym: 0, count, fetched, ...extra } });
test("the real KA case: 810-row snapshot then a 193-row snapshot → the 193 one is partial, baseline stays the 810 one", () => {
  const m = snapshotStatus([snap("0xka193", "ka", 193, 1760361047), snap("0xka810", "ka", 810, 1760344763), snap("0xmh", "mh", 165, 1760344763)]);
  assert.equal(m.get("0xka810").partial, false);
  assert.equal(m.get("0xka193").partial, true); assert.equal(m.get("0xka193").baseline, "0xka810");
  assert.equal(m.get("0xmh").partial, false);
});
test("a later full snapshot after a partial one is full again", () => {
  const m = snapshotStatus([snap("a", "ka", 810, 1), snap("b", "ka", 193, 2), snap("c", "ka", 827, 3)]);
  assert.deepEqual([m.get("a").partial, m.get("b").partial, m.get("c").partial], [false, true, false]);
});
test("scope='partial' is honoured even when the count looks normal", () => assert.equal(snapshotStatus([snap("a", "ka", 810, 1), snap("b", "ka", 800, 2, { scope: "partial" })]).get("b").partial, true));
test("a small first snapshot has no baseline to compare against → not flagged", () => assert.equal(snapshotStatus([snap("a", "curated", 7, 1)]).get("a").partial, false));

// A third-party mirror's alerts are shown for comparison but never change the verdict (authority = $creator allowlist).
import test from "node:test"; import assert from "node:assert/strict";
import { verdict } from "../lib/read.mjs";
const OP = "0x25fd47556c8b93f98ac6fd0b53a9bd5648433b93", TP = "0x1b793ad502b611e5e62cdc288f1741fc46166000";
const alert = (creator, extra = {}) => ({ key: "0x" + Math.random().toString(16).slice(2), creator, owner: "0x000000000000000000000000000000000000dead",
  a: { type: "alert", batch: "KT26012", src: "mh", pname: "Famotidine Tablets USP 40 mg", ptok: "famotidine", class: "nsq", test: "assay", exp_ym: 209912, exp_ok: true, src_ym: 0, src_ymd: 0, rid: "0xrid1", row: "0xrow1", ...extra } });
const allow = new Set([OP]);
test("third-party-only alert does not turn a batch red", () => { assert.equal(verdict([alert(TP)], { allow, nowYm: 202610, batch: "KT26012" }).level, "grey"); });
test("operator + agreeing third party: red, third party listed under other", () => {
  const v = verdict([alert(OP), alert(TP)], { allow, nowYm: 202610, batch: "KT26012" });
  assert.equal(v.level, "red"); assert.equal(v.alerts.length, 1); assert.equal(v.other.length, 1); assert.equal(v.other[0].a.row, v.alerts[0].a.row);
});

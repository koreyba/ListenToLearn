import assert from "node:assert/strict";
import test from "node:test";

test("passing fixture test", () => {});

test("first failing fixture test", () => {
  assert.equal("actual", "expected");
});

test("second failing fixture test", () => {
  throw new Error("intentional fixture failure");
});

test("skipped failure fixture test", { skip: "not relevant to this run" }, () => {});

test("todo failure fixture test", { todo: "not implemented in the fixture" }, () => {});

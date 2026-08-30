import test from "node:test";

test("successful fixture test", () => {});

test("skipped fixture test", { skip: "requires an unavailable fixture" }, () => {});

test("todo fixture test", { todo: "waiting for the sample implementation" }, () => {});

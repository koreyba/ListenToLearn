import assert from "node:assert/strict";
import test from "node:test";

const userContext = await import("../lib/user-context.ts").catch(() => ({}));

test("identity codec round-trips a Unicode user context without exposing raw JSON", () => {
  assert.equal(typeof userContext.encodeUserContext, "function");
  assert.equal(typeof userContext.decodeUserContext, "function");

  const context = {
    subject: "google-subject-123",
    email: "user@example.com",
    name: "Алиса Иванова",
  };
  const encoded = userContext.encodeUserContext(context);

  assert.notEqual(encoded.includes("user@example.com"), true);
  assert.deepEqual(userContext.decodeUserContext(encoded), context);
});

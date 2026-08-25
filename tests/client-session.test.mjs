import assert from "node:assert/strict";
import test from "node:test";

import {
  accountSession,
  signInHref,
  SIGN_OUT_HREF,
} from "../lib/client-session.ts";

test("account session uses the public optional-session endpoint and validates identity", async () => {
  const calls = [];
  const user = await accountSession(async (input, init) => {
    calls.push([input, init]);
    return Response.json({ user: { id: "subject-1", email: "learner@example.com", name: "Learner" } });
  });

  assert.deepEqual(user, { id: "subject-1", email: "learner@example.com", name: "Learner" });
  assert.deepEqual(calls, [["/api/session", { cache: "no-store", credentials: "same-origin" }]]);
});

test("account session safely falls back to guest for invalid or unavailable responses", async () => {
  assert.equal(await accountSession(async () => Response.json({ user: null })), null);
  assert.equal(await accountSession(async () => Response.json({ user: { id: "" } })), null);
  assert.equal(await accountSession(async () => new Response("bad", { status: 503 })), null);
  assert.equal(await accountSession(async () => { throw new Error("offline"); }), null);
});

test("account links preserve approved public return paths and use official Access logout", () => {
  assert.equal(signInHref("/videos"), "/login?returnTo=%2Fvideos");
  assert.equal(signInHref("/trainer?phrase=get+it"), "/login?returnTo=%2Ftrainer%3Fphrase%3Dget%2Bit");
  assert.equal(SIGN_OUT_HREF, "/cdn-cgi/access/logout");
});

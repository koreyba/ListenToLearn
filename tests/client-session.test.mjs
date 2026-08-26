import assert from "node:assert/strict";
import test from "node:test";

import {
  accountSession,
  completeSignOut,
  signInHref,
  APP_LOGOUT_HREF,
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

test("account links preserve approved public return paths and keep logout inside the app", () => {
  assert.equal(signInHref("/videos"), "/login?returnTo=%2Fvideos");
  assert.equal(signInHref("/trainer?phrase=get+it"), "/login?returnTo=%2Ftrainer%3Fphrase%3Dget%2Bit");
  assert.equal(SIGN_OUT_HREF, "/logout");
  assert.equal(APP_LOGOUT_HREF, "/api/logout");
});

test("logout revokes the Unmumble session and returns home without Access navigation", async () => {
  const calls = [];
  const completed = await completeSignOut(
    async (input, init) => {
      calls.push([input, init]);
      return new Response("signed out");
    },
    (target) => calls.push(["navigate", target]),
  );

  assert.equal(completed, true);
  assert.deepEqual(calls, [
    ["/api/logout", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    }],
    ["navigate", "/"],
  ]);
});

test("logout stays on the app error state when persistent guest mode cannot be set", async () => {
  const navigations = [];
  const completed = await completeSignOut(
    async () => { throw new Error("offline"); },
    (target) => navigations.push(target),
  );
  assert.equal(completed, false);
  assert.deepEqual(navigations, []);
});

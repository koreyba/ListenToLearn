import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_SESSION_COOKIE,
  APP_SESSION_MAX_AGE_SECONDS,
  LEGACY_SIGNED_OUT_COOKIE,
  appSessionCookie,
  appSessionTokenFromRequest,
  clearAppSessionCookies,
  hashAppSessionToken,
  issueAppSession,
  resolveAppSession,
  revokeAppSession,
} from "../lib/app-session.ts";

const ACTIVE_USER = {
  subject: "subject-1",
  email: "learner@example.com",
  name: "Learner",
};
const FIXED_NOW = new Date("2026-08-26T09:00:00.000Z");
const TOKEN_A = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
const TOKEN_B = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI";

function request(cookie = "") {
  return new Request("https://unmumble.example/api/session", {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

function fakeStore(record = null) {
  const calls = [];
  return {
    calls,
    async rotate(previousTokenHash, nextRecord, nowIso) {
      calls.push(["rotate", previousTokenHash, nextRecord, nowIso]);
    },
    async find(tokenHash) {
      calls.push(["find", tokenHash]);
      return record;
    },
    async revoke(tokenHash) {
      calls.push(["revoke", tokenHash]);
    },
  };
}

test("application cookie parser accepts only the exact bounded opaque token", () => {
  assert.equal(appSessionTokenFromRequest(request()), "");
  assert.equal(
    appSessionTokenFromRequest(request(`other=1; ${APP_SESSION_COOKIE}=${TOKEN_A}; suffix=ok`)),
    TOKEN_A,
  );
  assert.equal(
    appSessionTokenFromRequest(request(`fake_${APP_SESSION_COOKIE}=${TOKEN_A}; ${APP_SESSION_COOKIE}=bad`)),
    "",
  );
  assert.equal(appSessionTokenFromRequest(request(`${APP_SESSION_COOKIE}=${"a".repeat(44)}`)), "");
});

test("session issue rotates the current hash and stores only a new SHA-256 hash", async () => {
  const store = fakeStore();
  const issued = await issueAppSession(
    request(`${APP_SESSION_COOKIE}=${TOKEN_A}`),
    ACTIVE_USER,
    store,
    { now: FIXED_NOW, randomBytes: () => new Uint8Array(32).fill(2) },
  );
  const oldHash = await hashAppSessionToken(TOKEN_A);
  const newHash = await hashAppSessionToken(TOKEN_B);

  assert.equal(issued.token, TOKEN_B);
  assert.equal(issued.expiresAt, "2026-09-25T09:00:00.000Z");
  assert.deepEqual(store.calls, [[
    "rotate",
    oldHash,
    {
      tokenHash: newHash,
      userId: ACTIVE_USER.subject,
      createdAt: FIXED_NOW.toISOString(),
      expiresAt: "2026-09-25T09:00:00.000Z",
    },
    FIXED_NOW.toISOString(),
  ]]);
  assert.notEqual(newHash, TOKEN_B);
  assert.doesNotMatch(JSON.stringify(store.calls), new RegExp(TOKEN_B));
});

test("session resolution returns only an active D1 user and revokes an expired match", async () => {
  const activeStore = fakeStore({ user: ACTIVE_USER, expiresAt: "2026-08-27T09:00:00.000Z" });
  assert.deepEqual(
    await resolveAppSession(request(`${APP_SESSION_COOKIE}=${TOKEN_A}`), activeStore, { now: FIXED_NOW }),
    ACTIVE_USER,
  );
  assert.equal(activeStore.calls[0][0], "find");

  const expiredStore = fakeStore({ user: ACTIVE_USER, expiresAt: "2026-08-26T08:59:59.000Z" });
  assert.equal(
    await resolveAppSession(request(`${APP_SESSION_COOKIE}=${TOKEN_A}`), expiredStore, { now: FIXED_NOW }),
    null,
  );
  assert.equal(expiredStore.calls.at(-1)[0], "revoke");
  assert.equal(await resolveAppSession(request(), fakeStore(), { now: FIXED_NOW }), null);
});

test("logout revokes the current hash and cookie helpers use secure host-only attributes", async () => {
  const store = fakeStore();
  assert.equal(await revokeAppSession(request(`${APP_SESSION_COOKIE}=${TOKEN_A}`), store), true);
  assert.equal(store.calls[0][0], "revoke");
  assert.equal(await revokeAppSession(request(), fakeStore()), false);

  assert.equal(APP_SESSION_MAX_AGE_SECONDS, 30 * 24 * 60 * 60);
  assert.equal(
    appSessionCookie(TOKEN_A),
    `${APP_SESSION_COOKIE}=${TOKEN_A}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
  );
  assert.deepEqual(clearAppSessionCookies(), [
    `${APP_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    `${LEGACY_SIGNED_OUT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  ]);
});

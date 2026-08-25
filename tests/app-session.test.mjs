import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_SIGNED_OUT_COOKIE,
  appLogoutResponse,
  clearAppSignedOutCookie,
  hasAppSignedOutMarker,
} from "../lib/app-session.ts";

test("application logout marker uses a host-only HttpOnly cookie", async () => {
  const response = appLogoutResponse();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), { signedOut: true });
  assert.equal(
    response.headers.get("Set-Cookie"),
    `${APP_SIGNED_OUT_COOKIE}=1; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
  );
});

test("application logout marker parsing matches only the exact cookie", () => {
  assert.equal(hasAppSignedOutMarker(new Request("https://example.com")), false);
  assert.equal(hasAppSignedOutMarker(new Request("https://example.com", {
    headers: { Cookie: `other=1; ${APP_SIGNED_OUT_COOKIE}=1; suffix=ok` },
  })), true);
  assert.equal(hasAppSignedOutMarker(new Request("https://example.com", {
    headers: { Cookie: `fake_${APP_SIGNED_OUT_COOKIE}=1; ${APP_SIGNED_OUT_COOKIE}=0` },
  })), false);
});

test("explicit sign in clears the application logout marker", () => {
  assert.equal(
    clearAppSignedOutCookie(),
    `${APP_SIGNED_OUT_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  );
});

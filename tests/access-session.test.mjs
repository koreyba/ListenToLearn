import assert from "node:assert/strict";
import test from "node:test";
import {
  accessTokenFromRequest,
  optionalSessionResponse,
  verifyAccessJwtIdentity,
} from "../lib/access-session.ts";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";

test("Access assertion is authoritative and the application cookie is optional-session fallback only", () => {
  const headerRequest = new Request("https://listen-to-learn.example/api/session", {
    headers: {
      "Cf-Access-Jwt-Assertion": "header-token",
      Cookie: "other=ignored; CF_Authorization=cookie-token; suffix=ignored",
    },
  });
  assert.equal(accessTokenFromRequest(headerRequest), "header-token");
  assert.equal(accessTokenFromRequest(headerRequest, { allowCookie: true }), "header-token");

  const cookieRequest = new Request("https://listen-to-learn.example/api/session", {
    headers: { Cookie: "CF_Authorization=cookie-token; fake_CF_Authorization=forged" },
  });
  assert.equal(accessTokenFromRequest(cookieRequest), "");
  assert.equal(accessTokenFromRequest(cookieRequest, { allowCookie: true }), "cookie-token");
  assert.equal(accessTokenFromRequest(new Request("https://listen-to-learn.example/api/session"), { allowCookie: true }), "");
});

test("optional session response is no-store and exposes only verified display identity", async () => {
  const guest = optionalSessionResponse(null);
  assert.equal(guest.status, 200);
  assert.equal(guest.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await guest.json(), { user: null });

  const account = optionalSessionResponse({
    subject: "verified-subject",
    email: "learner@example.com",
    name: "Learner",
  });
  assert.deepEqual(await account.json(), {
    user: {
      id: "verified-subject",
      email: "learner@example.com",
      name: "Learner",
    },
  });
});

test("Access JWT verification accepts only valid issuer, audience, signature and lifetime", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  const getKey = createLocalJWKSet({ keys: [publicJwk] });
  const now = Math.floor(Date.now() / 1_000);
  const token = await new SignJWT({ email: "Learner@Example.com", name: "Learner" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://team.example")
    .setAudience("account-audience")
    .setSubject("subject-1")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);

  assert.deepEqual(await verifyAccessJwtIdentity(token, {
    issuer: "https://team.example",
    audiences: ["account-audience", "settings-audience"],
    getKey,
  }), {
    subject: "subject-1",
    email: "learner@example.com",
    name: "Learner",
  });

  await assert.rejects(() => verifyAccessJwtIdentity(token, {
    issuer: "https://team.example",
    audiences: ["wrong-audience"],
    getKey,
  }));

  await assert.rejects(() => verifyAccessJwtIdentity(token, {
    issuer: "https://wrong-team.example",
    audiences: ["account-audience"],
    getKey,
  }));

  const expired = await new SignJWT({ email: "learner@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://team.example")
    .setAudience("account-audience")
    .setSubject("subject-1")
    .setIssuedAt(now - 600)
    .setExpirationTime(now - 300)
    .sign(privateKey);
  await assert.rejects(() => verifyAccessJwtIdentity(expired, {
    issuer: "https://team.example",
    audiences: ["account-audience"],
    getKey,
  }));
});

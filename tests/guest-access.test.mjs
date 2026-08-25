import assert from "node:assert/strict";
import test from "node:test";
import {
  guestLoginRedirect,
  isPublicGuestRequest,
} from "../lib/guest-access.ts";

function request(path, method = "GET") {
  return new Request(`https://listen-to-learn.example${path}`, { method });
}

test("guest allowlist exposes only UI, static assets and read-only Tatoeba", () => {
  for (const path of [
    "/",
    "/trainer",
    "/trainer/",
    "/trainer.html",
    "/videos",
    "/videos/",
    "/caption-navigation.js",
    "/favicon.svg",
    "/_next/static/chunk.js",
    "/api/tatoeba?q=hello",
    "/api/tatoeba/audio/123",
  ]) {
    assert.equal(isPublicGuestRequest(request(path)), true, path);
  }
});

test("guest allowlist rejects account APIs, integrations, login and unknown paths", () => {
  for (const path of [
    "/login",
    "/api/me",
    "/api/phrases",
    "/api/examples?phraseId=preset-0",
    "/api/videos",
    "/api/translate",
    "/api/integrations",
    "/integrations",
    "/not-a-public-route",
  ]) {
    assert.equal(isPublicGuestRequest(request(path)), false, path);
  }
  assert.equal(isPublicGuestRequest(request("/api/tatoeba", "POST")), false);
});

test("login redirect is fixed to the public home marker and cannot become an open redirect", () => {
  assert.equal(
    guestLoginRedirect(request("/login?returnTo=https%3A%2F%2Fevil.example")).toString(),
    "https://listen-to-learn.example/?signedIn=1",
  );
});

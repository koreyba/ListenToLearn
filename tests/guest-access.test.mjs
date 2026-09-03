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
    "/library",
    "/library/",
    "/trainer",
    "/trainer/",
    "/trainer.html",
    "/practice",
    "/practice/",
    "/chat",
    "/chat/",
    "/videos",
    "/videos/",
    "/settings",
    "/settings/",
    "/integrations",
    "/integrations/",
    "/logout",
    "/api/session",
    "/api/catalog",
    "/caption-navigation.js",
    "/feedback-widget.css",
    "/feedback-widget.js",
    "/youglish-video-restore.js",
    "/video-progress-sync.js",
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
    "/api/ai/chats",
    "/not-a-public-route",
  ]) {
    assert.equal(isPublicGuestRequest(request(path)), false, path);
  }
  assert.equal(isPublicGuestRequest(request("/api/tatoeba", "POST")), false);
  assert.equal(isPublicGuestRequest(request("/api/catalog", "POST")), false);
});

test("guest allowlist accepts feedback submissions without requiring an account", () => {
  assert.equal(isPublicGuestRequest(request("/api/feedback", "POST")), true);
  assert.equal(isPublicGuestRequest(request("/api/feedback", "GET")), false);
});

test("login redirect is fixed to the public home marker and cannot become an open redirect", () => {
  assert.equal(
    guestLoginRedirect(request("/login?returnTo=https%3A%2F%2Fevil.example")).toString(),
    "https://listen-to-learn.example/library?signedIn=1",
  );
});

test("login redirect returns to an approved public page and rejects unsafe targets", () => {
  assert.equal(
    guestLoginRedirect(request("/login?returnTo=%2Fvideos")).toString(),
    "https://listen-to-learn.example/videos?signedIn=1",
  );
  assert.equal(
    guestLoginRedirect(request("/login?returnTo=%2Ftrainer%3Fphrase%3Dget%2Bit")).toString(),
    "https://listen-to-learn.example/trainer?phrase=get+it&signedIn=1",
  );
  assert.equal(
    guestLoginRedirect(request("/login?returnTo=%2Fintegrations")).toString(),
    "https://listen-to-learn.example/integrations?signedIn=1",
  );
  assert.equal(
    guestLoginRedirect(request("/login?returnTo=%2Fsettings")).toString(),
    "https://listen-to-learn.example/settings?signedIn=1",
  );
  assert.equal(
    guestLoginRedirect(request("/login?returnTo=%2Fchat")).toString(),
    "https://listen-to-learn.example/chat?signedIn=1",
  );
  for (const target of [
    "//evil.example",
    "/api/me",
    "/login",
    "/videos/../integrations",
    `/videos?value=${"x".repeat(2_000)}`,
  ]) {
    assert.equal(
      guestLoginRedirect(request(`/login?returnTo=${encodeURIComponent(target)}`)).toString(),
      "https://listen-to-learn.example/library?signedIn=1",
      target,
    );
  }
});

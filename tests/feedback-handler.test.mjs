import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackPostHandler } from "../lib/feedback/handler.ts";

const API_URL = "https://unmumble.online/api/feedback";
const ORIGIN = "https://unmumble.online";

function guardedPost(overrides = {}) {
  return createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("the rejected request must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("the rejected request must not schedule delivery"),
    rateLimit: async () => ({ ok: true }),
    ...overrides,
  });
}

function jsonRequest(payload, headers = {}) {
  return new Request(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...headers,
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

function imageForm(image) {
  const body = new FormData();
  body.set("category", "bug");
  body.set("message", "See the attachment.");
  body.set("pageUrl", `${ORIGIN}/practice`);
  body.set("website", "");
  body.set("image", image);
  return body;
}

function formRequest(body) {
  return new Request(API_URL, {
    method: "POST",
    headers: { Origin: ORIGIN },
    body,
  });
}

test("feedback handler persists a valid report and schedules Telegram delivery", async () => {
  const created = [];
  const scheduled = [];
  const deliveries = [];
  const repository = {
    async create(input) {
      created.push(input);
      return { id: "feedback-1", ...input, createdAt: "2026-09-03T12:00:00.000Z" };
    },
    async markTelegramDelivery() {},
  };
  const post = guardedPost({
    repository,
    getConfig: () => ({ botToken: "test-token", chatId: "test-chat" }),
    schedule: (promise) => scheduled.push(promise),
    deliver: async (input) => deliveries.push(input),
  });

  const response = await post(jsonRequest({
    category: "idea",
    message: "Add keyboard shortcuts.",
    pageUrl: `${ORIGIN}/practice?tab=learning`,
    website: "",
  }, { "User-Agent": "Test Browser/1.0" }));

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, id: "feedback-1" });
  assert.deepEqual(created, [{
    category: "idea",
    message: "Add keyboard shortcuts.",
    pageUrl: "/practice?tab=learning",
    userAgent: "Test Browser/1.0",
  }]);
  assert.equal(scheduled.length, 1);
  await scheduled[0];
  assert.equal(deliveries[0].submission.id, "feedback-1");
});

test("feedback handler keeps an attached image out of D1 and passes it only to delivery", async () => {
  const created = [];
  const scheduled = [];
  const deliveries = [];
  const post = guardedPost({
    repository: {
      async create(input) {
        created.push(input);
        return { id: "feedback-image", ...input, createdAt: "2026-09-03T12:00:00.000Z" };
      },
      async markTelegramDelivery() {},
    },
    schedule: (promise) => scheduled.push(promise),
    deliver: async (input) => deliveries.push(input),
  });
  const image = new File([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  ], "overlap.png", { type: "image/png" });
  const body = imageForm(image);
  body.set("message", "The play button overlaps the caption.");

  const response = await post(formRequest(body));

  assert.equal(response.status, 201);
  assert.deepEqual(created, [{
    category: "bug",
    message: "The play button overlaps the caption.",
    pageUrl: "/practice",
    userAgent: "",
  }]);
  await scheduled[0];
  assert.equal(deliveries[0].image.name, "overlap.png");
  assert.equal(deliveries[0].image.type, "image/png");
});

const invalidImages = [
  {
    name: "unsupported attachment",
    image: new File(["not an image"], "notes.txt", { type: "text/plain" }),
    status: 400,
    error: "Attach a JPEG, PNG, or WebP image.",
  },
  {
    name: "image larger than 5 MB",
    image: new File([new Uint8Array((5 * 1024 * 1024) + 1)], "huge.png", { type: "image/png" }),
    status: 413,
    error: "Keep the image under 5 MB.",
  },
  {
    name: "image whose bytes do not match its type",
    image: new File(["plain text"], "fake.png", { type: "image/png" }),
    status: 400,
    error: "The image content does not match its format.",
  },
];

for (const invalidImage of invalidImages) {
  test(`feedback handler rejects an ${invalidImage.name}`, async () => {
    const response = await guardedPost()(formRequest(imageForm(invalidImage.image)));
    assert.equal(response.status, invalidImage.status);
    assert.deepEqual(await response.json(), { error: invalidImage.error });
  });
}

test("feedback handler rejects cross-origin submissions before rate limiting", async () => {
  let rateLimitCalled = false;
  const post = guardedPost({
    rateLimit: async () => {
      rateLimitCalled = true;
      return { ok: true };
    },
  });
  const response = await post(jsonRequest(
    { category: "bug", message: "Spam", pageUrl: "/" },
    { Origin: "https://spam.example" },
  ));

  assert.equal(response.status, 403);
  assert.equal(rateLimitCalled, false);
  assert.deepEqual(await response.json(), { error: "Invalid request origin." });
});

test("feedback handler rejects a rate-limited request before touching D1", async () => {
  const response = await guardedPost({
    rateLimit: async () => ({ ok: false, status: 429 }),
  })(jsonRequest({ category: "bug", message: "Spam", pageUrl: "/" }));

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    error: "Too many feedback requests. Try again later.",
  });
});

test("feedback handler returns a bounded validation error", async () => {
  const response = await guardedPost()(jsonRequest({
    category: "bug",
    message: "",
    pageUrl: "/",
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Choose a type and write a message." });
});

test("feedback handler rejects oversized requests before parsing them", async () => {
  const response = await guardedPost()(jsonRequest("{}", { "Content-Length": "9000" }));
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "The request is too large." });
});

test("feedback handler enforces its body limit when Content-Length is absent", async () => {
  const response = await guardedPost()(jsonRequest({
    category: "bug",
    message: "x".repeat(9_000),
    pageUrl: "/",
    website: "",
  }));

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "The request is too large." });
});

test("feedback handler quietly drops honeypot submissions", async () => {
  const response = await guardedPost()(jsonRequest({
    category: "other",
    message: "Automated spam",
    pageUrl: "/",
    website: "spam.example",
  }));

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true });
});

test("feedback handler treats malformed JSON as an invalid request", async () => {
  const response = await guardedPost()(jsonRequest("{not-json"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid feedback request." });
});

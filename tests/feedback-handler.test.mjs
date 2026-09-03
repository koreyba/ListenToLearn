import assert from "node:assert/strict";
import test from "node:test";

test("feedback handler persists a valid report and schedules Telegram delivery", async () => {
  const handlerModule = await import("../lib/feedback/handler.ts").catch(() => null);
  assert.equal(typeof handlerModule?.createFeedbackPostHandler, "function", "feedback POST handler is required");

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
  const post = handlerModule.createFeedbackPostHandler({
    repository,
    getConfig: () => ({ botToken: "test-token", chatId: "test-chat" }),
    schedule: (promise) => scheduled.push(promise),
    deliver: async (input) => deliveries.push(input),
  });

  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://unmumble.online",
      "User-Agent": "Test Browser/1.0",
    },
    body: JSON.stringify({
      category: "idea",
      message: "Add keyboard shortcuts.",
      pageUrl: "https://unmumble.online/practice?tab=learning",
      website: "",
    }),
  }));

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
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].submission.id, "feedback-1");
});

test("feedback handler keeps an attached image out of D1 and passes it only to Telegram delivery", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const created = [];
  const scheduled = [];
  const deliveries = [];
  const repository = {
    async create(input) {
      created.push(input);
      return { id: "feedback-image", ...input, createdAt: "2026-09-03T12:00:00.000Z" };
    },
    async markTelegramDelivery() {},
  };
  const post = createFeedbackPostHandler({
    repository,
    getConfig: () => ({ botToken: "test-token", chatId: "test-chat" }),
    schedule: (promise) => scheduled.push(promise),
    deliver: async (input) => deliveries.push(input),
  });
  const body = new FormData();
  body.set("category", "bug");
  body.set("message", "The play button overlaps the caption.");
  body.set("pageUrl", "https://unmumble.online/practice");
  body.set("website", "");
  body.set("image", new File([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  ], "overlap.png", { type: "image/png" }));

  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: {
      Origin: "https://unmumble.online",
      "User-Agent": "Test Browser/1.0",
    },
    body,
  }));

  assert.equal(response.status, 201);
  assert.deepEqual(created, [{
    category: "bug",
    message: "The play button overlaps the caption.",
    pageUrl: "/practice",
    userAgent: "Test Browser/1.0",
  }]);
  await scheduled[0];
  assert.equal(deliveries[0].image.name, "overlap.png");
  assert.equal(deliveries[0].image.type, "image/png");
});

test("feedback handler rejects attachments that are not supported images", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("an invalid attachment must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("an invalid attachment must not be delivered"),
  });
  const body = new FormData();
  body.set("category", "bug");
  body.set("message", "See the attachment.");
  body.set("pageUrl", "https://unmumble.online/practice");
  body.set("website", "");
  body.set("image", new File(["not an image"], "notes.txt", { type: "text/plain" }));

  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: { Origin: "https://unmumble.online" },
    body,
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Attach a JPEG, PNG, or WebP image." });
});

test("feedback handler rejects images larger than 5 MB", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("an oversized image must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("an oversized image must not be delivered"),
  });
  const body = new FormData();
  body.set("category", "bug");
  body.set("message", "See the attachment.");
  body.set("pageUrl", "https://unmumble.online/practice");
  body.set("website", "");
  body.set("image", new File([
    new Uint8Array((5 * 1024 * 1024) + 1),
  ], "huge.png", { type: "image/png" }));

  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: { Origin: "https://unmumble.online" },
    body,
  }));

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "Keep the image under 5 MB." });
});

test("feedback handler rejects a file whose bytes do not match its image type", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("a spoofed image must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("a spoofed image must not be delivered"),
  });
  const body = new FormData();
  body.set("category", "bug");
  body.set("message", "See the attachment.");
  body.set("pageUrl", "https://unmumble.online/practice");
  body.set("website", "");
  body.set("image", new File(["plain text"], "fake.png", { type: "image/png" }));

  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: { Origin: "https://unmumble.online" },
    body,
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "The image content does not match its format." });
});

test("feedback handler rejects cross-origin submissions before touching D1", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("cross-origin feedback must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("cross-origin feedback must not schedule delivery"),
  });
  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://spam.example" },
    body: JSON.stringify({ category: "bug", message: "Spam", pageUrl: "/" }),
  }));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Invalid request origin." });
});

test("feedback handler returns a bounded validation error instead of throwing", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("invalid feedback must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("invalid feedback must not schedule delivery"),
  });
  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://unmumble.online" },
    body: JSON.stringify({ category: "bug", message: "", pageUrl: "/" }),
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Choose a type and write a message." });
});

test("feedback handler rejects oversized requests before parsing them", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("oversized feedback must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("oversized feedback must not schedule delivery"),
  });
  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": "9000",
      Origin: "https://unmumble.online",
    },
    body: "{}",
  }));

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "The request is too large." });
});

test("feedback handler enforces its body limit when Content-Length is absent", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("an oversized body must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("an oversized body must not be delivered"),
  });

  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://unmumble.online",
    },
    body: JSON.stringify({
      category: "bug",
      message: "x".repeat(9_000),
      pageUrl: "/",
      website: "",
    }),
  }));

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "The request is too large." });
});

test("feedback handler quietly drops honeypot submissions", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("honeypot feedback must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("honeypot feedback must not schedule delivery"),
  });
  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://unmumble.online" },
    body: JSON.stringify({
      category: "other",
      message: "Automated spam",
      pageUrl: "/",
      website: "spam.example",
    }),
  }));

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true });
});

test("feedback handler treats malformed JSON as an invalid request", async () => {
  const { createFeedbackPostHandler } = await import("../lib/feedback/handler.ts");
  const post = createFeedbackPostHandler({
    repository: {
      async create() { assert.fail("malformed feedback must not be stored"); },
      async markTelegramDelivery() {},
    },
    getConfig: () => null,
    schedule: () => assert.fail("malformed feedback must not schedule delivery"),
  });
  const response = await post(new Request("https://unmumble.online/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://unmumble.online" },
    body: "{not-json",
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid feedback request." });
});

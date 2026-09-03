import assert from "node:assert/strict";
import test from "node:test";

async function loadContracts() {
  return import("../lib/feedback/contracts.ts").catch(() => null);
}

test("feedback contract accepts a bounded beta report and keeps only its same-origin page", async () => {
  const contracts = await loadContracts();
  assert.equal(typeof contracts?.readFeedbackPayload, "function", "feedback payload parser is required");

  assert.deepEqual(
    contracts.readFeedbackPayload({
      category: "bug",
      message: "  Audio stops after replay.  ",
      pageUrl: "https://unmumble.online/trainer?phrase=get%20it#captions",
      website: "",
    }, "https://unmumble.online"),
    {
      ok: true,
      value: {
        category: "bug",
        message: "Audio stops after replay.",
        pageUrl: "/trainer?phrase=get%20it",
      },
    },
  );
});

test("feedback contract rejects missing fields and messages beyond the storage limit", async () => {
  const { readFeedbackPayload } = await import("../lib/feedback/contracts.ts");

  assert.deepEqual(
    readFeedbackPayload({ category: "bug", message: "", pageUrl: "/" }, "https://unmumble.online"),
    { ok: false, error: "Choose a type and write a message." },
  );
  assert.deepEqual(
    readFeedbackPayload({ category: "idea", message: "x".repeat(2_001), pageUrl: "/" }, "https://unmumble.online"),
    { ok: false, error: "Keep the message under 2000 characters." },
  );
});

test("feedback contract quietly identifies a filled honeypot as spam", async () => {
  const { readFeedbackPayload } = await import("../lib/feedback/contracts.ts");

  assert.deepEqual(
    readFeedbackPayload({
      category: "idea",
      message: "Buy cheap traffic",
      pageUrl: "/",
      website: "spam.example",
    }, "https://unmumble.online"),
    { ok: false, error: "Thanks for the feedback.", spam: true },
  );
});

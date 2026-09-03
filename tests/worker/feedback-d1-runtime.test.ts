/// <reference types="@cloudflare/vitest-plugin/types" />

import { env } from "cloudflare:workers";
import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

const testEnv = env as Cloudflare.Env & { TEST_MIGRATIONS: D1Migration[] };

beforeAll(async () => {
  await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
});

describe("feedback persistence in the Workers runtime", () => {
  it("stores a report before Telegram delivery and records successful delivery", async () => {
    const repositoryModule = await import("../../lib/feedback/repository.ts").catch(() => null);
    expect(typeof repositoryModule?.createFeedbackRepository).toBe("function");

    const repository = repositoryModule!.createFeedbackRepository(testEnv.DB, {
      createId: () => "feedback-runtime-1",
      now: () => "2026-09-03T12:00:00.000Z",
    });
    const submission = await repository.create({
      category: "bug",
      message: "Replay stopped.",
      pageUrl: "/trainer?phrase=get+it",
      userAgent: "Worker runtime test",
    });

    expect(submission).toEqual({
      id: "feedback-runtime-1",
      category: "bug",
      message: "Replay stopped.",
      pageUrl: "/trainer?phrase=get+it",
      userAgent: "Worker runtime test",
      createdAt: "2026-09-03T12:00:00.000Z",
    });
    expect(await testEnv.DB.prepare(`
      SELECT telegram_status FROM feedback_submissions WHERE id = ?
    `).bind(submission.id).first()).toEqual({ telegram_status: "pending" });

    await repository.markTelegramDelivery(submission.id, "sent");
    expect(await testEnv.DB.prepare(`
      SELECT telegram_status, telegram_delivered_at FROM feedback_submissions WHERE id = ?
    `).bind(submission.id).first()).toEqual({
      telegram_status: "sent",
      telegram_delivered_at: "2026-09-03T12:00:00.000Z",
    });
  });
});

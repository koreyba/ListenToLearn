import type { FeedbackCategory, FeedbackPayload } from "./contracts.ts";

export type FeedbackTelegramStatus = "sent" | "not_configured" | "failed";

export type FeedbackSubmission = FeedbackPayload & {
  id: string;
  userAgent: string;
  createdAt: string;
};

type CreateFeedbackInput = {
  category: FeedbackCategory;
  message: string;
  pageUrl: string;
  userAgent: string;
};

type FeedbackRepositoryDependencies = {
  createId?: () => string;
  now?: () => string;
};

export function createFeedbackRepository(
  db: D1Database,
  dependencies: FeedbackRepositoryDependencies = {},
) {
  const createId = dependencies.createId || (() => crypto.randomUUID());
  const now = dependencies.now || (() => new Date().toISOString());

  return {
    async create(input: CreateFeedbackInput): Promise<FeedbackSubmission> {
      const submission = {
        id: createId(),
        ...input,
        createdAt: now(),
      };
      await db.prepare(`
        INSERT INTO feedback_submissions (
          id, category, message, page_url, user_agent, telegram_status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `).bind(
        submission.id,
        submission.category,
        submission.message,
        submission.pageUrl,
        submission.userAgent,
        submission.createdAt,
      ).run();
      return submission;
    },

    async markTelegramDelivery(id: string, status: FeedbackTelegramStatus): Promise<void> {
      const deliveredAt = status === "sent" ? now() : null;
      await db.prepare(`
        UPDATE feedback_submissions
        SET telegram_status = ?, telegram_delivered_at = ?
        WHERE id = ?
      `).bind(status, deliveredAt, id).run();
    },
  };
}

export type FeedbackRepository = ReturnType<typeof createFeedbackRepository>;

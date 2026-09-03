import type { FeedbackSubmission, FeedbackTelegramStatus } from "./repository.ts";
import { sendFeedbackToTelegram, type FeedbackTelegramConfig } from "./telegram.ts";

type DeliverFeedbackDependencies = {
  submission: FeedbackSubmission;
  image?: File | null;
  config: FeedbackTelegramConfig | null;
  send?: typeof sendFeedbackToTelegram;
  mark: (id: string, status: FeedbackTelegramStatus) => Promise<void>;
  logError?: (event: Record<string, string>) => void;
};

export async function deliverFeedbackToTelegram({
  submission,
  image,
  config,
  send = sendFeedbackToTelegram,
  mark,
  logError = (event) => console.error(JSON.stringify(event)),
}: DeliverFeedbackDependencies): Promise<void> {
  if (!config) {
    await mark(submission.id, "not_configured");
    return;
  }
  try {
    await send(submission, config, undefined, image);
    await mark(submission.id, "sent");
  } catch {
    await mark(submission.id, "failed");
    logError({
      message: "feedback.telegram_delivery_failed",
      submissionId: submission.id,
      error: "Telegram delivery failed.",
    });
  }
}

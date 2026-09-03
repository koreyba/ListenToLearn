import type { FeedbackSubmission } from "./repository.ts";

export type FeedbackTelegramConfig = {
  botToken: string;
  chatId: string;
};

const categoryLabels = {
  bug: "Bug",
  idea: "Idea",
  other: "Other",
} as const;

const TELEGRAM_TIMEOUT_MS = 5_000;
const TELEGRAM_PHOTO_CAPTION_LENGTH = 1_024;

function messageText(submission: FeedbackSubmission) {
  return [
    "🗣 New beta feedback",
    `Type: ${categoryLabels[submission.category]}`,
    `Page: ${submission.pageUrl}`,
    `Created: ${submission.createdAt}`,
    `ID: ${submission.id}`,
    "",
    submission.message,
    "",
    `Browser: ${submission.userAgent || "Unknown"}`,
  ].join("\n");
}

async function postToTelegram(
  url: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Telegram Bot API returned HTTP ${response.status}.`);
    }
    if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
      throw new Error("Telegram Bot API rejected the message.");
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendFeedbackToTelegram(
  submission: FeedbackSubmission,
  config: FeedbackTelegramConfig,
  fetchImpl: typeof fetch = fetch,
  image: File | null = null,
): Promise<void> {
  const text = messageText(submission);
  if (image) {
    const photoBody = new FormData();
    photoBody.set("chat_id", config.chatId);
    photoBody.set("caption", Array.from(text).slice(0, TELEGRAM_PHOTO_CAPTION_LENGTH).join(""));
    photoBody.set("photo", image, image.name);
    try {
      await postToTelegram(
        `https://api.telegram.org/bot${config.botToken}/sendPhoto`,
        {
          method: "POST",
          body: photoBody,
        },
        fetchImpl,
      );
      return;
    } catch {
      // The image is intentionally ephemeral; retain the text notification only.
    }
  }
  await postToTelegram(
    `https://api.telegram.org/bot${config.botToken}/sendMessage`,
    {
        method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.chatId, text }),
    },
    fetchImpl,
  );
}

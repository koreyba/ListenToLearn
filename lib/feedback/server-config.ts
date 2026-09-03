import type { FeedbackTelegramConfig } from "./telegram.ts";

type FeedbackCloudflareEnvironment = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
};

export function readFeedbackTelegramConfig(input: unknown): FeedbackTelegramConfig | null {
  if (!input || typeof input !== "object") return null;
  const environment = input as FeedbackCloudflareEnvironment;
  const botToken = environment.TELEGRAM_BOT_TOKEN?.trim() || "";
  const chatId = environment.TELEGRAM_CHAT_ID?.trim() || "";
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

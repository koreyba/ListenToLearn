import type { FeedbackTelegramConfig } from "./telegram.ts";
import type { FeedbackRateLimitBinding, FeedbackRateLimitBindings } from "./rate-limit.ts";

type FeedbackCloudflareEnvironment = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  FEEDBACK_CLIENT_RATE_LIMITER?: FeedbackRateLimitBinding;
  FEEDBACK_EDGE_AGGREGATE_RATE_LIMITER?: FeedbackRateLimitBinding;
};

export function readFeedbackTelegramConfig(input: unknown): FeedbackTelegramConfig | null {
  if (!input || typeof input !== "object") return null;
  const environment = input as FeedbackCloudflareEnvironment;
  const botToken = environment.TELEGRAM_BOT_TOKEN?.trim() || "";
  const chatId = environment.TELEGRAM_CHAT_ID?.trim() || "";
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

export function readFeedbackRateLimitBindings(input: unknown): FeedbackRateLimitBindings {
  if (!input || typeof input !== "object") return {};
  const environment = input as FeedbackCloudflareEnvironment;
  return {
    clientLimiter: environment.FEEDBACK_CLIENT_RATE_LIMITER,
    edgeAggregateLimiter: environment.FEEDBACK_EDGE_AGGREGATE_RATE_LIMITER,
  };
}

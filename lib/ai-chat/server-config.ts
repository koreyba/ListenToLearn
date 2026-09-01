import { env } from "cloudflare:workers";
import type { AiChatRateLimitBinding } from "./rate-limit.ts";
import {
  isAiChatRuntimeConfigured,
  type AiChatServerConfig,
} from "./runtime.ts";

type AiChatCloudflareEnvironment = {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  AI_CHAT_USER_RATE_LIMITER?: AiChatRateLimitBinding;
  AI_CHAT_EDGE_AGGREGATE_RATE_LIMITER?: AiChatRateLimitBinding;
};

export function getAiChatServerConfig(): AiChatServerConfig {
  const serverEnvironment = env as unknown as AiChatCloudflareEnvironment;
  return {
    apiKey: serverEnvironment.OPENROUTER_API_KEY,
    model: serverEnvironment.OPENROUTER_MODEL,
  };
}

export function getAiChatRateLimitBindings() {
  const serverEnvironment = env as unknown as AiChatCloudflareEnvironment;
  return {
    userLimiter: serverEnvironment.AI_CHAT_USER_RATE_LIMITER,
    edgeAggregateLimiter: serverEnvironment.AI_CHAT_EDGE_AGGREGATE_RATE_LIMITER,
  };
}

export function isAiChatServerConfigured() {
  return isAiChatRuntimeConfigured(getAiChatServerConfig());
}

import { env } from "cloudflare:workers";
import type { AiChatServerConfig } from "./runtime.ts";

type AiChatCloudflareEnvironment = {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
};

export function getAiChatServerConfig(): AiChatServerConfig {
  const serverEnvironment = env as unknown as AiChatCloudflareEnvironment;
  return {
    apiKey: serverEnvironment.OPENROUTER_API_KEY,
    model: serverEnvironment.OPENROUTER_MODEL,
  };
}

export function isAiChatServerConfigured() {
  const config = getAiChatServerConfig();
  return Boolean(config.apiKey?.trim() && config.model?.trim());
}

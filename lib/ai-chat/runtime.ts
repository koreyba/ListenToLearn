import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { AI_CHAT_ERROR_CODES, AI_CHAT_LIMITS } from "./contracts.ts";

export type AiChatServerConfig = {
  apiKey?: string | null;
  model?: string | null;
};

export type AiChatRuntime = {
  model: LanguageModel;
  provenance: {
    provider: "openrouter";
    model: string;
  };
  timeoutMs: number;
  maxOutputTokens: number;
};

export type AiChatRuntimeResult =
  | { ok: true; value: AiChatRuntime }
  | {
      ok: false;
      error: { code: "not_configured"; status: 503 };
    };

type RuntimeDependencies = {
  createOpenRouter: typeof createOpenRouter;
};

const defaultDependencies: RuntimeDependencies = { createOpenRouter };

export type AiChatRuntimeFailure =
  | { code: "provider_timeout"; status: 504 }
  | { code: "provider_failed"; status: 502 };

export function mapAiChatRuntimeFailure(
  error: unknown,
  context: { timedOut?: boolean } = {},
): AiChatRuntimeFailure {
  const isSdkTimeout = typeof error === "object"
    && error !== null
    && "name" in error
    && error.name === "TimeoutError";
  return context.timedOut || isSdkTimeout
    ? { code: AI_CHAT_ERROR_CODES.providerTimeout, status: 504 }
    : { code: AI_CHAT_ERROR_CODES.providerFailed, status: 502 };
}

export type AiChatAssistantTextResult =
  | { ok: true; value: string }
  | { ok: false; error: { code: "empty_response"; status: 502 } };

export function normalizeAiChatAssistantText(text: string): AiChatAssistantTextResult {
  const normalized = text.replace(/\r\n?/gu, "\n").trim();
  return normalized
    ? { ok: true, value: normalized }
    : {
        ok: false,
        error: { code: AI_CHAT_ERROR_CODES.emptyResponse, status: 502 },
      };
}

export function createAiChatRuntime(
  config: AiChatServerConfig,
  dependencies: RuntimeDependencies = defaultDependencies,
): AiChatRuntimeResult {
  const apiKey = config.apiKey?.trim();
  const model = config.model?.trim();
  if (!apiKey || !model) {
    return {
      ok: false,
      error: { code: AI_CHAT_ERROR_CODES.notConfigured, status: 503 },
    };
  }

  const openrouter = dependencies.createOpenRouter({ apiKey });
  return {
    ok: true,
    value: {
      model: openrouter(model),
      provenance: { provider: "openrouter", model },
      timeoutMs: AI_CHAT_LIMITS.upstreamTimeoutMs,
      maxOutputTokens: AI_CHAT_LIMITS.outputTokens,
    },
  };
}

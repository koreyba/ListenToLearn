import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { AI_CHAT_ERROR_CODES, AI_CHAT_LIMITS } from "./contracts.ts";

export const AI_CHAT_OPENROUTER_MODELS = Object.freeze([
  "deepseek/deepseek-v4-flash-0731",
] as const);

export type AiChatServerConfig = {
  apiKey?: string | null;
  model?: string | null;
};

function configuredModelId(value: string | null | undefined) {
  const model = value?.normalize("NFKC").trim() || "";
  return (AI_CHAT_OPENROUTER_MODELS as readonly string[]).includes(model)
    ? model
    : "unknown";
}

export function describeAiChatConfiguredProvenance(
  config: AiChatServerConfig,
): AiChatRuntime["provenance"] {
  return {
    provider: "openrouter",
    model: configuredModelId(config.model),
  };
}

export function isAiChatRuntimeConfigured(config: AiChatServerConfig) {
  return Boolean(
    config.apiKey?.trim()
    && describeAiChatConfiguredProvenance(config).model !== "unknown",
  );
}

export type AiChatRuntime = {
  model: LanguageModel;
  provenance: {
    provider: string;
    model: string;
  };
  timeoutMs: number;
  maxOutputTokens: number;
  normalizeTelemetry(steps: readonly { providerMetadata?: unknown }[]): AiChatProviderTelemetry;
  mapFailure(error: unknown, context?: { timedOut?: boolean }): AiChatRuntimeFailure;
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

export type AiChatProviderTelemetry = {
  routedProviders: string[];
  cost: number | null;
  upstreamInferenceCost: number | null;
};

export type AiChatOpenRouterTelemetry = AiChatProviderTelemetry;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeProviderName(value: unknown): string | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  return normalized
    && normalized.length <= 80
    && /^[a-z0-9][a-z0-9 ._()+:/-]*$/iu.test(normalized)
    ? normalized
    : null;
}

function addSafeCost(total: number | null, value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return total;
  const next = (total ?? 0) + value;
  return Number.isFinite(next) ? next : total;
}

export function extractAiChatOpenRouterTelemetry(
  steps: readonly { providerMetadata?: unknown }[],
): AiChatOpenRouterTelemetry {
  const routedProviders: string[] = [];
  let cost: number | null = null;
  let upstreamInferenceCost: number | null = null;
  for (const step of steps) {
    const metadata = record(step.providerMetadata);
    const openrouter = record(metadata?.openrouter);
    if (!openrouter) continue;
    const provider = safeProviderName(openrouter.provider);
    if (provider && !routedProviders.includes(provider)) routedProviders.push(provider);
    const usage = record(openrouter.usage);
    cost = addSafeCost(cost, usage?.cost);
    const costDetails = record(usage?.costDetails);
    upstreamInferenceCost = addSafeCost(
      upstreamInferenceCost,
      costDetails?.upstreamInferenceCost,
    );
  }
  return { routedProviders, cost, upstreamInferenceCost };
}

export type AiChatRuntimeFailure =
  | { code: "provider_timeout"; status: 504 }
  | { code: "provider_rate_limited"; status: 429 }
  | { code: "provider_failed"; status: 502 };

function providerStatusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return null;
  const statusCode = error.statusCode;
  return typeof statusCode === "number" && Number.isInteger(statusCode)
    ? statusCode
    : null;
}

export function mapAiChatRuntimeFailure(
  error: unknown,
  context: { timedOut?: boolean } = {},
): AiChatRuntimeFailure {
  const isSdkTimeout = typeof error === "object"
    && error !== null
    && "name" in error
    && error.name === "TimeoutError";
  if (context.timedOut || isSdkTimeout) {
    return { code: AI_CHAT_ERROR_CODES.providerTimeout, status: 504 };
  }
  if (providerStatusCode(error) === 429) {
    return { code: AI_CHAT_ERROR_CODES.providerRateLimited, status: 429 };
  }
  return { code: AI_CHAT_ERROR_CODES.providerFailed, status: 502 };
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
  const configuredProvenance = describeAiChatConfiguredProvenance(config);
  const model = configuredProvenance.model === "unknown" ? "" : configuredProvenance.model;
  if (!isAiChatRuntimeConfigured(config) || !apiKey || !model) {
    return {
      ok: false,
      error: { code: AI_CHAT_ERROR_CODES.notConfigured, status: 503 },
    };
  }

  const openrouter = dependencies.createOpenRouter({ apiKey });
  return {
    ok: true,
    value: {
      // The model ID is code-allowlisted. Local vocabulary tools are supplied
      // explicitly by the generation layer; no server-side preset is involved.
      model: openrouter(model, {
        plugins: [],
        provider: {
          data_collection: "deny",
          zdr: true,
          require_parameters: true,
        },
      }),
      provenance: configuredProvenance,
      timeoutMs: AI_CHAT_LIMITS.upstreamTimeoutMs,
      maxOutputTokens: AI_CHAT_LIMITS.outputTokens,
      normalizeTelemetry: extractAiChatOpenRouterTelemetry,
      mapFailure: mapAiChatRuntimeFailure,
    },
  };
}

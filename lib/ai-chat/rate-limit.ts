import { AI_CHAT_ERROR_CODES, type AiChatErrorCode } from "./contracts.ts";

export const AI_CHAT_RATE_LIMIT_POLICY = Object.freeze({
  user: Object.freeze({ limit: 10, period: 60 }),
  edgeAggregate: Object.freeze({ limit: 100, period: 60 }),
});

export type AiChatRateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

type AiChatRateLimitBindings = {
  userId: string;
  userLimiter?: AiChatRateLimitBinding;
  edgeAggregateLimiter?: AiChatRateLimitBinding;
};

type AiChatRateLimitResult =
  | { ok: true }
  | { ok: false; error: { code: AiChatErrorCode; status: number } };

async function hashedUserKey(userId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(userId),
  );
  const hex = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return `ai-chat:user:${hex}`;
}

export async function enforceAiChatGenerationRateLimit(
  input: AiChatRateLimitBindings,
): Promise<AiChatRateLimitResult> {
  if (!input.userId || !input.userLimiter || !input.edgeAggregateLimiter) {
    return {
      ok: false,
      error: { code: AI_CHAT_ERROR_CODES.internalError, status: 503 },
    };
  }

  try {
    const userOutcome = await input.userLimiter.limit({
      key: await hashedUserKey(input.userId),
    });
    if (!userOutcome.success) {
      return {
        ok: false,
        error: { code: AI_CHAT_ERROR_CODES.providerRateLimited, status: 429 },
      };
    }

    // Cloudflare Rate Limiting counters are local to a Cloudflare location and
    // eventually consistent. This is an approximate edge abuse guard, not a
    // globally atomic quota or billing ledger.
    const edgeAggregateOutcome = await input.edgeAggregateLimiter.limit({
      key: "ai-chat:edge-aggregate",
    });
    return edgeAggregateOutcome.success
      ? { ok: true }
      : {
          ok: false,
          error: { code: AI_CHAT_ERROR_CODES.providerRateLimited, status: 429 },
        };
  } catch {
    return {
      ok: false,
      error: { code: AI_CHAT_ERROR_CODES.internalError, status: 503 },
    };
  }
}

export const FEEDBACK_RATE_LIMIT_POLICY = Object.freeze({
  client: Object.freeze({ limit: 5, period: 60 }),
  edgeAggregate: Object.freeze({ limit: 50, period: 60 }),
});

export type FeedbackRateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type FeedbackRateLimitBindings = {
  clientLimiter?: FeedbackRateLimitBinding;
  edgeAggregateLimiter?: FeedbackRateLimitBinding;
};

export type FeedbackRateLimitResult =
  | { ok: true }
  | { ok: false; status: 429 | 503 };

function clientIdentity(request: Request) {
  const address = request.headers.get("CF-Connecting-IP")?.trim().slice(0, 128);
  if (address) return address;
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" ? "local-development" : "";
}

async function hashedClientKey(identity: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity),
  );
  const hex = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return `feedback:client:${hex}`;
}

export async function enforceFeedbackRateLimit(
  request: Request,
  bindings: FeedbackRateLimitBindings,
): Promise<FeedbackRateLimitResult> {
  const identity = clientIdentity(request);
  if (!identity || !bindings.clientLimiter || !bindings.edgeAggregateLimiter) {
    return { ok: false, status: 503 };
  }

  try {
    const clientOutcome = await bindings.clientLimiter.limit({
      key: await hashedClientKey(identity),
    });
    if (!clientOutcome.success) return { ok: false, status: 429 };

    const aggregateOutcome = await bindings.edgeAggregateLimiter.limit({
      key: "feedback:edge-aggregate",
    });
    return aggregateOutcome.success
      ? { ok: true }
      : { ok: false, status: 429 };
  } catch {
    return { ok: false, status: 503 };
  }
}

import assert from "node:assert/strict";
import test from "node:test";

const rateLimitModule = await import("../lib/ai-chat/rate-limit.ts").catch(() => ({}));

function limiter(success = true) {
  const keys = [];
  return {
    keys,
    binding: {
      async limit({ key }) {
        keys.push(key);
        return { success };
      },
    },
  };
}

test("generation rate limits use a hashed account key and a per-location aggregate edge key", async () => {
  assert.deepEqual(rateLimitModule.AI_CHAT_RATE_LIMIT_POLICY, {
    user: { limit: 10, period: 60 },
    edgeAggregate: { limit: 100, period: 60 },
  });
  const user = limiter();
  const edgeAggregate = limiter();
  const result = await rateLimitModule.enforceAiChatGenerationRateLimit({
    userId: "account-private-subject",
    userLimiter: user.binding,
    edgeAggregateLimiter: edgeAggregate.binding,
  });

  assert.deepEqual(result, { ok: true });
  assert.match(user.keys[0], /^ai-chat:user:[a-f0-9]{64}$/u);
  assert.equal(user.keys[0].includes("account-private-subject"), false);
  assert.deepEqual(edgeAggregate.keys, ["ai-chat:edge-aggregate"]);
});

test("generation rate limits fail closed on denial, missing bindings, or binding errors", async () => {
  const denied = limiter(false);
  const unusedEdgeAggregate = limiter();
  assert.deepEqual(await rateLimitModule.enforceAiChatGenerationRateLimit({
    userId: "account-a",
    userLimiter: denied.binding,
    edgeAggregateLimiter: unusedEdgeAggregate.binding,
  }), {
    ok: false,
    error: { code: "provider_rate_limited", status: 429 },
  });
  assert.deepEqual(unusedEdgeAggregate.keys, []);

  assert.deepEqual(await rateLimitModule.enforceAiChatGenerationRateLimit({
    userId: "account-a",
  }), {
    ok: false,
    error: { code: "internal_error", status: 503 },
  });

  assert.deepEqual(await rateLimitModule.enforceAiChatGenerationRateLimit({
    userId: "account-a",
    userLimiter: {
      async limit() {
        throw new Error("private binding failure");
      },
    },
    edgeAggregateLimiter: limiter().binding,
  }), {
    ok: false,
    error: { code: "internal_error", status: 503 },
  });
});

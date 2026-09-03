import assert from "node:assert/strict";
import test from "node:test";

const rateLimitModule = await import("../lib/feedback/rate-limit.ts").catch(() => ({}));

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

function request(headers = {}) {
  return new Request("https://unmumble.online/api/feedback", { headers });
}

test("feedback rate limits use a hashed client address and an aggregate edge key", async () => {
  assert.deepEqual(rateLimitModule.FEEDBACK_RATE_LIMIT_POLICY, {
    client: { limit: 5, period: 60 },
    edgeAggregate: { limit: 50, period: 60 },
  });
  const client = limiter();
  const edgeAggregate = limiter();

  const result = await rateLimitModule.enforceFeedbackRateLimit(
    request({ "CF-Connecting-IP": "203.0.113.42" }),
    {
      clientLimiter: client.binding,
      edgeAggregateLimiter: edgeAggregate.binding,
    },
  );

  assert.deepEqual(result, { ok: true });
  assert.match(client.keys[0], /^feedback:client:[a-f0-9]{64}$/u);
  assert.equal(client.keys[0].includes("203.0.113.42"), false);
  assert.deepEqual(edgeAggregate.keys, ["feedback:edge-aggregate"]);
});

test("feedback rate limiting fails closed on denial, missing bindings, or missing client identity", async () => {
  const denied = limiter(false);
  const unusedAggregate = limiter();
  assert.deepEqual(await rateLimitModule.enforceFeedbackRateLimit(
    request({ "CF-Connecting-IP": "203.0.113.42" }),
    {
      clientLimiter: denied.binding,
      edgeAggregateLimiter: unusedAggregate.binding,
    },
  ), { ok: false, status: 429 });
  assert.deepEqual(unusedAggregate.keys, []);

  assert.deepEqual(await rateLimitModule.enforceFeedbackRateLimit(
    request({ "CF-Connecting-IP": "203.0.113.42" }),
    {},
  ), { ok: false, status: 503 });

  assert.deepEqual(await rateLimitModule.enforceFeedbackRateLimit(request(), {
    clientLimiter: limiter().binding,
    edgeAggregateLimiter: limiter().binding,
  }), { ok: false, status: 503 });
});

test("feedback rate limiting permits a stable local-development key", async () => {
  const client = limiter();
  const edgeAggregate = limiter();

  assert.deepEqual(await rateLimitModule.enforceFeedbackRateLimit(
    new Request("http://127.0.0.1:5174/api/feedback"),
    {
      clientLimiter: client.binding,
      edgeAggregateLimiter: edgeAggregate.binding,
    },
  ), { ok: true });
  assert.match(client.keys[0], /^feedback:client:[a-f0-9]{64}$/u);
});

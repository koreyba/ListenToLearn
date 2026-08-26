import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadController() {
  const source = await readFile(new URL("../public/video-progress-sync.js", import.meta.url), "utf8");
  const scheduled = [];
  let now = 1_000;
  const globalThis = {};
  vm.runInNewContext(source, {
    globalThis,
    setTimeout(callback, delay) {
      const timer = { callback, delay, cancelled: false };
      scheduled.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.cancelled = true;
    },
  });
  return {
    create: globalThis.ListenToLearnVideoProgressSync.create,
    scheduled,
    advance(milliseconds) { now += milliseconds; },
    now: () => now,
  };
}

test("progress sync sends immediately, then coalesces trailing playback updates to 15 seconds", async () => {
  const harness = await loadController();
  const sent = [];
  const sync = harness.create({
    intervalMs: 15_000,
    now: harness.now,
    send: async (value, options) => sent.push([value, options]),
  });

  sync.update({ seconds: 1 });
  await sync.idle();
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [[{ seconds: 1 }, { keepalive: false }]]);

  harness.advance(1_000);
  sync.update({ seconds: 2 });
  sync.update({ seconds: 3 });
  assert.equal(harness.scheduled.at(-1).delay, 14_000);
  assert.equal(sent.length, 1);

  harness.advance(14_000);
  harness.scheduled.at(-1).callback();
  await sync.idle();
  assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))), [{ seconds: 3 }, { keepalive: false }]);
});

test("progress sync flush bypasses the throttle once and marks navigation writes keepalive", async () => {
  const harness = await loadController();
  const sent = [];
  const sync = harness.create({
    intervalMs: 15_000,
    now: harness.now,
    send: async (value, options) => sent.push([value, options]),
  });

  sync.update({ seconds: 1 });
  await sync.idle();
  harness.advance(1_000);
  sync.update({ seconds: 9 });
  await sync.flush({ keepalive: true });

  assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1))), [{ seconds: 9 }, { keepalive: true }]);
  assert.equal(harness.scheduled.at(-1).cancelled, true);
});

test("progress sync skips unchanged snapshots and retries a failed latest snapshot", async () => {
  const harness = await loadController();
  let attempts = 0;
  const sent = [];
  const sync = harness.create({
    intervalMs: 15_000,
    now: harness.now,
    send: async (value) => {
      attempts += 1;
      if (attempts === 1) throw new Error("offline");
      sent.push(value);
    },
  });

  sync.update({ seconds: 5 });
  await sync.idle();
  assert.equal(attempts, 1);
  assert.equal(harness.scheduled.at(-1).delay, 15_000);

  harness.advance(15_000);
  harness.scheduled.at(-1).callback();
  await sync.idle();
  assert.equal(attempts, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), [{ seconds: 5 }]);

  const scheduledBefore = harness.scheduled.length;
  sync.update({ seconds: 5 });
  await sync.idle();
  assert.equal(harness.scheduled.length, scheduledBefore);
  assert.equal(attempts, 2);
});

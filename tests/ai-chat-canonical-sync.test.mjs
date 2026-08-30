import assert from "node:assert/strict";
import test from "node:test";

const syncModule = await import("../lib/ai-chat/canonical-sync.ts").catch(() => ({}));

test("canonical history applies only when a new snapshot arrives while idle", () => {
  assert.equal(typeof syncModule.observeCanonicalMessages, "function");

  const initial = [{ id: "opening" }];
  const staleDuringNextStream = [{ id: "opening" }, { id: "first-turn" }];
  const persistedAfterNextStream = [...staleDuringNextStream, { id: "second-turn" }];
  let observed = initial;

  const terminalStatusOnly = syncModule.observeCanonicalMessages(observed, initial, false);
  observed = terminalStatusOnly.observed;
  assert.equal(terminalStatusOnly.apply, false);

  const staleRefresh = syncModule.observeCanonicalMessages(observed, staleDuringNextStream, true);
  observed = staleRefresh.observed;
  assert.equal(staleRefresh.apply, false);

  const terminalAfterStaleRefresh = syncModule.observeCanonicalMessages(
    observed,
    staleDuringNextStream,
    false,
  );
  observed = terminalAfterStaleRefresh.observed;
  assert.equal(terminalAfterStaleRefresh.apply, false);

  const freshRefresh = syncModule.observeCanonicalMessages(
    observed,
    persistedAfterNextStream,
    false,
  );
  assert.equal(freshRefresh.apply, true);
  assert.equal(freshRefresh.observed, persistedAfterNextStream);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixturePath = new URL("./fixtures/youglish-live-caption-traces.json", import.meta.url);

test("sanitized live YouGlish traces cover passing baselines and provider-state races", async () => {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const serialized = JSON.stringify(fixture);

  assert.equal(fixture.schema, "listen-to-learn.youglish-live-caption-traces/v1");
  assert.ok(fixture.scenarios.length >= 4);
  assert.ok(fixture.scenarios.some(scenario => scenario.observedOutcome === "pass"));
  assert.ok(fixture.scenarios.some(scenario => scenario.observedOutcome === "fail"));
  assert.ok(fixture.scenarios.some(scenario =>
    scenario.events.some(event => event.type === "playerState")
      && scenario.events.some(event => event.type === "ui.navigate")
  ));
  assert.doesNotMatch(serialized, /youtube\.com|private .* caption|sensitive-/i);
});

test("every live trace names the contract that future reducer tests must enforce", async () => {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

  for (const scenario of fixture.scenarios) {
    assert.match(scenario.id, /^[a-z0-9-]+$/);
    assert.ok(scenario.initialHistory.length >= 2);
    assert.ok(scenario.events.length >= 4);
    assert.ok(scenario.contract.length >= 2);
    assert.ok(scenario.events.every((event, index, events) =>
      index === 0 || event.atMs >= events[index - 1].atMs
    ), `${scenario.id} events must be ordered by atMs`);
  }
});

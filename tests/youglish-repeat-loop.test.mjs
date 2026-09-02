import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import {
  assertDeltas,
  caption,
  createTrainer,
  observeVideo,
} from "./helpers/trainer-harness.mjs";

// Mirrors REPEAT_LEAD_IN_SECONDS in public/trainer.html.
const LEAD_IN_SECONDS = 0.4;

// Most contracts below are about the return position, so they disable the tail
// margin to keep the provider sequence synchronous. The tail has its own test.
const SYNCHRONOUS_RETURN = { REPEAT_TAIL_SECONDS: 0 };

// YouGlish reports a consumed caption as onCaptionConsumed(N) immediately
// followed by onCaptionChange(N + 1) that carries the playback position. The
// return move is anchored to the looped caption's start, minus the lead-in and
// the seek lag measured from earlier landings.
function returnDelta(targetStart, reportedPosition, seekLag = 0) {
  return (targetStart - LEAD_IN_SECONDS - seekLag) - reportedPosition;
}

function consumeInto(trainer, consumedId, nextCaption) {
  trainer.events.onCaptionConsumed({ id: consumedId });
  trainer.events.onCaptionChange(nextCaption);
}

async function openTrainer(t, { constants = {}, ...options } = {}) {
  const trainer = await createTrainer({
    ...options,
    constants: { ...SYNCHRONOUS_RETURN, ...constants },
  });
  t.after(trainer.close);
  return trainer;
}

async function loopingTrainer(t, options = {}) {
  const trainer = await openTrainer(t, options);
  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.repeat.click();
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");
  return trainer;
}

test("repeatReturnDelta computes an absolute backward move with a bounded lead-in", async () => {
  const source = await readFile(
    new URL("../public/caption-navigation.js", import.meta.url),
    "utf8",
  );
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  const navigation = sandbox.window.UnmumbleCaptionNavigation;

  assert.ok(Math.abs(navigation.repeatReturnDelta(603, 607.1, 0.4) - (-4.5)) < 1e-9);
  assert.equal(navigation.repeatReturnDelta(0.2, 5, 0.4), -5, "the lead-in never targets negative time");
  assert.equal(navigation.repeatReturnDelta(603, 602, 0), 1, "a position before the start yields a forward delta");
  assert.equal(navigation.repeatReturnDelta(603, 607, "not-a-number"), -4);
  assert.equal(navigation.repeatReturnDelta(null, 5, 0.4), null);
  assert.equal(navigation.repeatReturnDelta(603, undefined, 0.4), null);
});

test("Repeat returns to the consumed caption's start using the next caption's timestamp", async t => {
  const trainer = await loopingTrainer(t);

  trainer.events.onCaptionConsumed({ id: "a2" });
  assert.equal(trainer.widgetCalls.move.length, 0, "the return waits for the provider position");

  trainer.events.onCaptionChange(caption("a3", 607.1, "third"));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(603, 607.1)]);
  assert.match(trainer.controls.captionText.textContent, /second/);
  assert.doesNotMatch(trainer.controls.captionText.textContent, /third/);
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  trainer.events.onPlayerStateChange({ state: 3 });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a2", 603.2, "second"));

  assert.equal(trainer.widgetCalls.move.length, 1);
  assert.match(trainer.controls.captionText.textContent, /second/);
  assert.equal(trainer.controls.next.disabled, false, "the overshoot caption is cached as the next neighbor");
  assert.equal(trainer.controls.previous.disabled, false);
});

test("Repeat seeks stay anchored to the caption start across many cycles", async t => {
  const trainer = await loopingTrainer(t);
  const aim = 603 - LEAD_IN_SECONDS;

  for (let cycle = 0; cycle < 15; cycle += 1) {
    trainer.advanceTime(3_900);
    const reportedEnd = 607 + (cycle % 3) * 0.05;
    consumeInto(trainer, "a2", caption("a3", reportedEnd, "third"));
    assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, reportedEnd)]);

    trainer.events.onPlayerStateChange({ state: 3 });
    trainer.events.onPlayerStateChange({ state: 1 });
    // The seek lands exactly where it aimed, inside the previous caption.
    trainer.events.onCaptionChange(caption("a1", aim, "first"));
    trainer.events.onCaptionConsumed({ id: "a1" });
    trainer.events.onCaptionChange(caption("a2", 603 + (cycle % 4) * 0.03, "second"));
    assert.match(trainer.controls.captionText.textContent, /second/);
  }

  assert.equal(trainer.widgetCalls.move.length, 15);
  assert.ok(
    trainer.widgetCalls.move.every(delta => delta < -3.5),
    "the loop must never collapse into a sub-second repeat of the caption tail",
  );
});

test("Repeat calibrates the seek lag from where the return actually landed", async t => {
  const trainer = await loopingTrainer(t, { trace: true });

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 607)]);

  // Aimed at 602.6, landed at 602.9: the player applied the move 0.3 s late.
  trainer.events.onCaptionChange(caption("a1", 602.9, "first"));
  trainer.events.onCaptionConsumed({ id: "a1" });
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 607, 0.3)]);

  // Aimed at 602.3, landed at 602.4: the lag estimate averages to 0.2 s.
  trainer.events.onCaptionChange(caption("a1", 602.4, "first"));
  trainer.events.onCaptionConsumed({ id: "a1" });
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 607, 0.2)]);

  const lagEvents = trainer.trace().events.filter(event => event.type === "repeat.seek-lag");
  assert.deepEqual(lagEvents.map(event => event.lag), [0.3, 0.2]);
});

test("the caption after the looped one is neither shown nor looped while Repeat returns", async t => {
  const trainer = await loopingTrainer(t);

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assert.equal(trainer.widgetCalls.move.length, 1);
  assert.match(trainer.controls.captionText.textContent, /second/);

  trainer.events.onCaptionConsumed({ id: "a3" });
  assert.equal(trainer.widgetCalls.move.length, 1, "a consumed callback for another caption is ignored");

  trainer.events.onCaptionChange(caption("a2", 603.1, "second"));
  consumeInto(trainer, "a2", caption("a3", 607.05, "third"));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(603, 607), returnDelta(603, 607.05, 0.5)]);
  assert.match(trainer.controls.captionText.textContent, /second/);
});

test("Repeat waits when the return lands shortly before the looped caption", async t => {
  const trainer = await loopingTrainer(t);

  consumeInto(trainer, "a2", caption("a3", 607.05, "third"));
  assert.equal(trainer.widgetCalls.move.length, 1);

  trainer.events.onCaptionChange(caption("a1", 602.8, "first"));
  assert.equal(trainer.widgetCalls.move.length, 1, "landing in the previous caption needs no correction");
  assert.match(trainer.controls.captionText.textContent, /second/);

  trainer.events.onCaptionConsumed({ id: "a1" });
  assert.equal(trainer.widgetCalls.move.length, 1);

  trainer.events.onCaptionChange(caption("a2", 603.05, "second"));
  consumeInto(trainer, "a2", caption("a3", 607, "third"));

  assert.equal(trainer.widgetCalls.move.length, 2);
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 607, 0.2)]);
});

test("Repeat adopts the earlier natural boundary of a caption first seen mid-way", async t => {
  const trainer = await openTrainer(t);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603.5, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a2", 603.5, "second"));
  trainer.controls.repeat.click();

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603.5, 607)]);

  trainer.events.onCaptionChange(caption("a1", 603.5 - LEAD_IN_SECONDS, "first"));
  trainer.events.onCaptionConsumed({ id: "a1" });
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 607)]);
});

test("Repeat corrects an unexpected landing twice, then follows the caption that is playing", async t => {
  const trainer = await loopingTrainer(t);

  consumeInto(trainer, "a2", caption("a3", 607, "third"));

  trainer.events.onCaptionChange(caption("a5", 700, "fifth"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 700)]);
  assert.match(trainer.controls.captionText.textContent, /second/);

  trainer.events.onCaptionChange(caption("a6", 710, "sixth"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 710)]);
  assert.match(trainer.controls.captionText.textContent, /second/);

  trainer.events.onCaptionChange(caption("a7", 720, "seventh"));
  assert.equal(trainer.widgetCalls.move.length, 3, "corrections are bounded");
  assert.match(trainer.controls.captionText.textContent, /seventh/);
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  consumeInto(trainer, "a7", caption("a8", 724, "eighth"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(720, 724)]);
  assert.match(trainer.controls.captionText.textContent, /seventh/);
});

test("Repeat follows the visible caption when the bounded history evicts the looped one", async t => {
  const trainer = await openTrainer(t, { constants: { MAX_OBSERVED_CAPTIONS: 2 } });

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", 600, "first"));
  trainer.controls.repeat.click();
  const movesBefore = trainer.widgetCalls.move.length;

  // The new neighbor pushes the looped first caption out of the two-entry history.
  consumeInto(trainer, "a1", caption("a3", 607, "third"));

  assert.equal(trainer.widgetCalls.move.length, movesBefore, "no return to a caption that is no longer cached");
  assert.match(trainer.controls.captionText.textContent, /third/);
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  consumeInto(trainer, "a3", caption("a4", 611, "fourth"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(607, 611)]);
});

test("a forward wait during a correction does not calibrate the seek lag", async t => {
  const trainer = await loopingTrainer(t, { trace: true });

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move, [returnDelta(603, 607)]);

  // The player reports a position far before the target: waiting is the only option.
  trainer.events.onCaptionChange(caption("a0", 590, "zeroth"));
  assert.equal(trainer.widgetCalls.move.length, 1);
  assert.match(trainer.controls.captionText.textContent, /second/);

  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  assert.equal(trainer.trace().events.at(-1).state.repeat.seekLag, null);

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 607)]);
});

test("Repeat loops an untimed first caption with a timed return once its duration is measured", async t => {
  const trainer = await openTrainer(t);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(2_600);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  const replaysBefore = trainer.widgetCalls.replay;
  const movesBefore = trainer.widgetCalls.move.length;
  trainer.controls.repeat.click();

  consumeInto(trainer, "a1", caption("a2", 603.1, "second"));

  // The first caption started 2.6 s before the second one: 603 - 2.6 = 600.4.
  assertDeltas(trainer.widgetCalls.move.slice(movesBefore), [returnDelta(600.4, 603.1)]);
  assert.equal(trainer.widgetCalls.replay, replaysBefore, "no native replay once the start is measured");
  assert.match(trainer.controls.captionText.textContent, /first/);

  trainer.events.onCaptionChange(caption("a1", 600.1, "first"));
  assert.equal(trainer.controls.previous.disabled, true, "the first caption stays the replay anchor");

  consumeInto(trainer, "a1", caption("a2", 603, "second"));
  assert.equal(trainer.widgetCalls.move.length, movesBefore + 2);
  assert.match(trainer.controls.captionText.textContent, /first/);
});

test("an untimed first caption keeps its measured start across return cycles", async t => {
  const trainer = await openTrainer(t);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.controls.repeat.click();
  trainer.advanceTime(2_600);

  // Looping from the very first pass measures the 2.6 s duration on the overshoot.
  consumeInto(trainer, "a1", caption("a2", 603, "second"));
  assertDeltas(trainer.widgetCalls.move, [returnDelta(600.4, 603)]);

  for (let cycle = 0; cycle < 4; cycle += 1) {
    // Each return lands before the caption, so the wall clock until the next
    // caption is longer than the caption itself and must not re-measure it.
    trainer.events.onCaptionChange(caption("a1", 599.9, "first"));
    trainer.advanceTime(3_300);
    consumeInto(trainer, "a1", caption("a2", 603, "second"));
    assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(600.4, 603)]);
  }

  assert.equal(trainer.widgetCalls.replay, 0);
  assert.match(trainer.controls.captionText.textContent, /first/);
});

test("Repeat falls back to Replay for an untimed first caption without a measured duration", async t => {
  const trainer = await openTrainer(t);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  const replaysBefore = trainer.widgetCalls.replay;
  const movesBefore = trainer.widgetCalls.move.length;
  const commandsBefore = trainer.widgetCalls.commands.length;

  trainer.controls.repeat.click();
  consumeInto(trainer, "a1", caption("a2", 603.1, "second"));

  assert.equal(trainer.widgetCalls.replay, replaysBefore + 1);
  assert.equal(trainer.widgetCalls.move.length, movesBefore);
  assert.deepEqual(
    trainer.widgetCalls.commands.slice(commandsBefore),
    [{ command: "replay" }],
    "the loop replays without pause/play churn",
  );
  assert.match(trainer.controls.captionText.textContent, /first/);

  trainer.events.onCaptionChange(caption("a1", 599.9, "first"));
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("Repeat lets the caption switch settle before returning", async t => {
  const trainer = await loopingTrainer(t, { constants: { REPEAT_TAIL_SECONDS: 0.02 } });

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assert.equal(trainer.widgetCalls.move.length, 0, "the return is delayed by the tail margin");
  assert.match(trainer.controls.captionText.textContent, /second/);

  await new Promise(resolve => setTimeout(resolve, 60));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(603, 607 + 0.02)]);
  assert.match(trainer.controls.captionText.textContent, /second/);
});

test("Repeat stays on across a video change and loops the new video's first caption", async t => {
  const trainer = await loopingTrainer(t);

  observeVideo(trainer, "video-b", [caption("b1", 100, "other first")]);
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");
  assert.doesNotMatch(trainer.providerStatus.textContent, /disabled/i);

  consumeInto(trainer, "b1", caption("b2", 103.5, "other second"));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(100, 103.5)]);
  assert.match(trainer.controls.captionText.textContent, /other first/);
});

test("Repeat stays on across a video change whose first caption is untimed", async t => {
  const trainer = await loopingTrainer(t);

  observeVideo(trainer, "video-b", [caption("b1", undefined, "other first")]);
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");
  trainer.advanceTime(3_000);

  consumeInto(trainer, "b1", caption("b2", 103, "other second"));

  // The measured 3 s duration anchors the untimed first caption at 100.
  assertDeltas(trainer.widgetCalls.move, [returnDelta(100, 103)]);
  assert.equal(trainer.widgetCalls.replay, 0);
  assert.match(trainer.controls.captionText.textContent, /other first/);
});

test("Repeat stays on when a caption arrives without a timestamp", async t => {
  const trainer = await loopingTrainer(t);

  trainer.events.onCaptionChange(caption("a9", undefined, "untimed words"));

  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");
  assert.doesNotMatch(trainer.providerStatus.textContent, /disabled/i);

  trainer.events.onCaptionChange(caption("a3", 607, "third"));
  consumeInto(trainer, "a3", caption("a4", 611.3, "fourth"));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(607, 611.3)]);
});

test("Repeat stays on when the source switches away and back", async t => {
  const trainer = await loopingTrainer(t);

  trainer.controls.source("tatoeba").click();
  assert.equal(trainer.controls.repeat.hidden, true);
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  trainer.controls.source("youglish").click();
  assert.equal(trainer.controls.repeat.hidden, false);
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  observeVideo(trainer, "video-a", [caption("a1", 600, "first")]);
  consumeInto(trainer, "a1", caption("a2", 603.4, "second"));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(600, 603.4)]);
  assert.equal(trainer.scriptErrors.length, 0);
});

test("Repeat follows the caption selected with Next and Previous", async t => {
  const trainer = await openTrainer(t);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.controls.repeat.click();

  trainer.controls.next.click();
  trainer.events.onCaptionChange(caption("a3", 607.05, "third"));
  consumeInto(trainer, "a3", caption("a4", 611.2, "fourth"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(607, 611.2)]);
  assert.match(trainer.controls.captionText.textContent, /third/);

  // Aimed at 606.6, landed at 607.2: a 0.6 s seek lag is learned.
  trainer.events.onCaptionChange(caption("a3", 607.2, "third"));
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a2", 603.1, "second"));
  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(603, 607, 0.6)]);
  assert.match(trainer.controls.captionText.textContent, /second/);
});

test("a Next click after the consumed callback takes precedence over the Repeat return", async t => {
  const trainer = await openTrainer(t);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.controls.repeat.click();
  const movesBeforeNext = trainer.widgetCalls.move.length;

  trainer.events.onCaptionConsumed({ id: "a2" });
  trainer.controls.next.click();
  assertDeltas(trainer.widgetCalls.move.slice(movesBeforeNext), [4]);

  trainer.events.onCaptionChange(caption("a3", 607.05, "third"));
  assert.equal(trainer.widgetCalls.move.length, movesBeforeNext + 1, "no return seek follows the user's Next");
  assert.match(trainer.controls.captionText.textContent, /third/);

  consumeInto(trainer, "a3", caption("a4", 611, "fourth"));
  assertDeltas(trainer.widgetCalls.move.slice(-1), [returnDelta(607, 611)]);
});

test("duplicate consumed callbacks arm a single Repeat return", async t => {
  const trainer = await loopingTrainer(t);

  trainer.events.onCaptionConsumed({ id: "a2" });
  trainer.events.onCaptionConsumed({ id: "a2" });
  trainer.events.onCaptionChange(caption("a3", 607, "third"));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(603, 607)]);
});

test("Repeat falls back to a timed return when no caption follows the consumed callback", async t => {
  const trainer = await loopingTrainer(t, { constants: { REPEAT_OVERSHOOT_TIMEOUT_MS: 10 } });

  trainer.advanceTime(2_500);
  trainer.events.onCaptionConsumed({ id: "a2" });
  assert.equal(trainer.widgetCalls.move.length, 0);

  await new Promise(resolve => setTimeout(resolve, 40));

  assertDeltas(trainer.widgetCalls.move, [-(2.5 + LEAD_IN_SECONDS)]);
  assert.match(trainer.controls.captionText.textContent, /second/);
});

test("Repeat stops only when the user turns it off", async t => {
  const trainer = await loopingTrainer(t);

  trainer.controls.repeat.click();
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "false");

  consumeInto(trainer, "a2", caption("a3", 607, "third"));

  assert.equal(trainer.widgetCalls.move.length, 0);
  assert.match(trainer.controls.captionText.textContent, /third/);
});

test("Repeat can be enabled before the first caption arrives", async t => {
  const trainer = await openTrainer(t);

  trainer.controls.repeat.click();
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  observeVideo(trainer, "video-a", [caption("a1", 600, "first")]);
  consumeInto(trainer, "a1", caption("a2", 604, "second"));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(600, 604)]);
  assert.match(trainer.controls.captionText.textContent, /first/);
});

test("Repeat does not arm during a controlled Next", async t => {
  const trainer = await openTrainer(t);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.controls.repeat.click();
  const replaysBefore = trainer.widgetCalls.replay;

  trainer.controls.next.click();
  trainer.events.onCaptionConsumed({ id: "a1" });
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  assert.equal(trainer.widgetCalls.replay, replaysBefore, "the loop must not replay over the user's Next");
  assert.equal(trainer.widgetCalls.move.length, 0);
  assert.match(trainer.controls.captionText.textContent, /second/);

  consumeInto(trainer, "a2", caption("a3", 607, "third"));
  assertDeltas(trainer.widgetCalls.move, [returnDelta(603, 607)]);
});

test("a Replay click while looping retargets Repeat to the first caption", async t => {
  const trainer = await loopingTrainer(t);

  trainer.controls.replay.click();
  assert.equal(trainer.widgetCalls.replay, 1);
  trainer.events.onCaptionChange(caption("a1", 600, "first"));

  consumeInto(trainer, "a1", caption("a2", 603.1, "second"));

  assertDeltas(trainer.widgetCalls.move, [returnDelta(600, 603.1)]);
  assert.match(trainer.controls.captionText.textContent, /first/);
});

test("Repeat stays enabled before captions and during caption navigation or Replay", async t => {
  const trainer = await openTrainer(t);

  assert.equal(trainer.controls.repeat.disabled, false);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.controls.previous.click();
  assert.equal(trainer.controls.repeat.disabled, false);

  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.controls.replay.click();

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.repeat.disabled, false);
});

test("the local trace records Repeat cycles without provider identifiers", async t => {
  const trainer = await openTrainer(t, { trace: true });

  observeVideo(trainer, "sensitive-video-id", [
    caption("sensitive-caption-a", 600, "private first caption words"),
    caption("sensitive-caption-b", 603, "private second caption words"),
  ]);
  trainer.controls.repeat.click();
  consumeInto(trainer, "sensitive-caption-b", caption("sensitive-caption-c", 607, "private third caption words"));

  const trace = trainer.trace();
  const serialized = JSON.stringify(trace);
  const eventTypes = trace.events.map(event => event.type);

  assert.ok(eventTypes.includes("repeat.armed"));
  assert.ok(eventTypes.includes("repeat.overshoot"));
  const returnCommand = trace.events.find(event =>
    event.type === "widget.command" && event.reason === "repeat-return"
  );
  assert.ok(returnCommand);
  assert.ok(Math.abs(returnCommand.delta - returnDelta(603, 607)) < 0.01);
  assert.equal(returnCommand.state.repeat.enabled, true);
  assert.equal(trace.events.at(-1).state.repeat.returning, "caption-2");
  assert.doesNotMatch(serialized, /sensitive-/);
  assert.doesNotMatch(serialized, /private .* caption words/);
});

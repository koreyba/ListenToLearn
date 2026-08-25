import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";

const trainerPath = new URL("../public/trainer.html", import.meta.url);
const navigationPath = new URL("../public/caption-navigation.js", import.meta.url);

async function nextTurn() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function createTrainer({ playError = null, replayError = null } = {}) {
  const [trainerSource, navigationSource] = await Promise.all([
    readFile(trainerPath, "utf8"),
    readFile(navigationPath, "utf8"),
  ]);
  const html = trainerSource.replace(
    '<script src="/caption-navigation.js"></script>',
    `<script>${navigationSource}</script>`,
  );
  const widgetCalls = {
    fetch: [],
    move: [],
    pause: 0,
    play: 0,
    replay: 0,
  };
  let widgetEvents;

  class FakeWidget {
    constructor(_elementId, options) {
      widgetEvents = options.events;
    }

    fetch(...args) {
      widgetCalls.fetch.push(args);
    }

    move(delta) {
      widgetCalls.move.push(delta);
    }

    pause() {
      widgetCalls.pause += 1;
    }

    play() {
      widgetCalls.play += 1;
      if (playError) throw playError;
    }

    replay() {
      widgetCalls.replay += 1;
      if (replayError) throw replayError;
    }

    setSpeed() {}
  }

  const virtualConsole = new VirtualConsole();
  const scriptErrors = [];
  virtualConsole.on("jsdomError", error => scriptErrors.push(error));
  virtualConsole.on("error", error => scriptErrors.push(error));

  const dom = new JSDOM(html, {
    beforeParse(window) {
      window.YG = { Widget: FakeWidget };
      window.fetch = async () => ({
        ok: true,
        type: "basic",
        json: async () => ({}),
      });
      window.HTMLMediaElement.prototype.pause = function pause() {};
      window.HTMLMediaElement.prototype.play = async function play() {};
      window.localStorage.setItem(
        "connected-speech-trainer-v1:anonymous",
        JSON.stringify({ source: "youglish", exampleOrder: "ordered" }),
      );
    },
    pretendToBeVisual: true,
    runScripts: "dangerously",
    url: "https://listen-to-learn.test/trainer?phrase=test&phraseId=phrase-1",
    virtualConsole,
  });

  await nextTurn();
  assert.equal(scriptErrors.length, 0, scriptErrors.map(error => error.message).join("\n"));
  assert.equal(typeof dom.window.onYouglishAPIReady, "function");
  dom.window.onYouglishAPIReady();
  assert.ok(widgetEvents, "the fake widget must receive YouGlish event callbacks");
  widgetEvents.onPlayerReady();

  const document = dom.window.document;
  const controls = {
    next: document.getElementById("nextCaptionBtn"),
    previous: document.getElementById("prevCaptionBtn"),
    replay: document.getElementById("replayBtn"),
    repeat: document.getElementById("repeatCaptionBtn"),
    status: document.getElementById("captionNavigationHint"),
  };

  return {
    close: () => dom.window.close(),
    controls,
    events: widgetEvents,
    widgetCalls,
  };
}

function caption(id, time, text = id, video) {
  return {
    caption: encodeURIComponent(text),
    current_time: time,
    id,
    ...(video ? { video } : {}),
  };
}

function captionWithoutId(time, text, video) {
  return {
    caption: encodeURIComponent(text),
    current_time: time,
    ...(video ? { video } : {}),
  };
}

function assertDeltas(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(
      Math.abs(value - expected[index]) < 0.05,
      `expected movement ${value} to be within 0.05 seconds of ${expected[index]}`,
    );
  });
}

function observeVideo(trainer, videoId, entries) {
  trainer.events.onVideoChange({ trackNumber: 0, video: videoId });
  for (const entry of entries) trainer.events.onCaptionChange(entry);
}

test("one observed caption keeps both caption directions disabled", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [caption("a1", 600, "first")]);

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, true);
  assert.match(trainer.controls.status.textContent, /Observed captions: 1/);
});

test("two observed captions enable only the direction with a cached neighbor", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);

  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", 600, "first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("caption buttons follow cached neighbors immediately without a transient lock", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);

  trainer.controls.previous.click();

  assert.equal(trainer.widgetCalls.move.length, 1);
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.controls.previous.click();

  assert.equal(trainer.widgetCalls.move.length, 2);
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("missing target callbacks do not override neighbor-derived button state", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);

  trainer.controls.previous.click();

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("three observed captions allow one-caption navigation in both directions from the middle", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", 600, "first"));
  trainer.controls.next.click();
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  assertDeltas(trainer.widgetCalls.move, [-4, -3, 3]);
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);
});

test("Replay from the middle returns to the first caption without losing cached forward captions", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  trainer.controls.replay.click();
  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a1", 600, "first"));

  assert.equal(trainer.widgetCalls.replay, 1);
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
  assert.match(trainer.controls.status.textContent, /Observed captions: 3/);
});

test("Replay keeps forward navigation when the first caption has no timestamp", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));

  assert.equal(trainer.widgetCalls.replay, 1);
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("Replay without provider caption IDs unlocks on the first caption and restores Next", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    captionWithoutId(600, "first"),
    captionWithoutId(603, "second"),
  ]);

  trainer.controls.replay.click();
  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(captionWithoutId(600, "first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
  assert.equal(trainer.controls.replay.disabled, false);
  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
});

test("Replay exposes the first caption neighbors immediately without a callback", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);

  trainer.controls.replay.click();
  trainer.events.onCaptionChange(caption("a3", 607, "third"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("a repeated caption without a provider ID cannot create a phantom history entry", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    captionWithoutId(600, "first"),
    captionWithoutId(603, "second"),
  ]);

  trainer.events.onCaptionChange(captionWithoutId(607, "second"));

  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);

  trainer.controls.previous.click();

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("identical caption text outside the segment tolerance remains a distinct entry", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    captionWithoutId(600, "same words"),
    captionWithoutId(660, "same words"),
  ]);

  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, true);
});

test("Next from a timestamp-less Replay target plays only until the cached next caption", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  const moveCountBeforeNext = trainer.widgetCalls.move.length;

  trainer.controls.next.click();

  assert.equal(trainer.widgetCalls.move.length, moveCountBeforeNext);
  assert.ok(trainer.widgetCalls.play >= 1, "Next must use controlled playback without an invented seek");

  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  assert.ok(trainer.widgetCalls.pause >= 1, "controlled playback must stop at the cached next caption");
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
});

test("a failed controlled Next does not leave caption navigation permanently busy", async t => {
  const trainer = await createTrainer({ playError: new Error("play rejected") });
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));

  trainer.controls.next.click();

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("Replay requested while paused returns to the first caption without resuming playback", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });

  trainer.controls.replay.click();
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a1", 600, "first"));

  assert.equal(trainer.widgetCalls.replay, 1);
  assert.ok(trainer.widgetCalls.pause >= 1, "Replay must restore the paused state");
});

test("a rejected Replay does not pause a later unrelated caption event", async t => {
  const trainer = await createTrainer({ replayError: new Error("replay rejected") });
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });

  trainer.controls.replay.click();
  trainer.events.onCaptionChange(caption("a1", 600, "first"));

  assert.equal(trainer.widgetCalls.pause, 0);
});

test("returning to a previously visited video restores its observed caption history", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  observeVideo(trainer, "video-b", [
    caption("b1", 120, "other first"),
    caption("b2", 124, "other second"),
  ]);
  observeVideo(trainer, "video-a", [caption("a1", 600, "first")]);

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
  assert.match(trainer.controls.status.textContent, /Observed captions: 3/);
});

test("a duplicate onVideoChange for the active video does not erase its history", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a1", 600, "first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
});

test("a manual seek to a distant unseen range starts a segment with no cross-gap previous caption", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.events.onCaptionChange(caption("b1", 1800, "twenty minutes later"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, true);
});

test("caption navigation stays inside the active distant segment", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.events.onCaptionChange(caption("b1", 1800, "later first"));
  trainer.events.onCaptionChange(caption("b2", 1804, "later second"));

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);

  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("b1", 1800, "later first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("a manual seek to a known caption reactivates its earlier segment", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.events.onCaptionChange(caption("b1", 1800, "later first"));
  trainer.events.onCaptionChange(caption("b2", 1804, "later second"));
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", 600, "first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("a new caption inside a known segment range joins that segment", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.events.onCaptionChange(caption("a-between", 604, "inserted"));

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.controls.next.click();

  assertDeltas(trainer.widgetCalls.move.slice(-1), [3]);
});

test("an external caption change turns off Repeat for the previous caption", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.repeat.click();
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  trainer.events.onCaptionChange(caption("a1", 600, "first"));

  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "false");
});

test("out-of-order caption callbacks are navigated in timestamp order", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a3", 607, "third"),
    caption("a2", 603, "second"),
  ]);

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);
  trainer.controls.next.click();
  assertDeltas(trainer.widgetCalls.move.slice(-1), [4]);
});

test("a known caption callback without timing retains its cached timestamp", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", "600", "first"),
    caption("a2", "603", "second"),
  ]);
  trainer.events.onCaptionChange(caption("a2", "", "second refreshed"));

  trainer.controls.previous.click();
  assertDeltas(trainer.widgetCalls.move.slice(-1), [-3]);
});

test("captions with identical timestamps do not expose an unsafe zero-delta target", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 600, "second"),
  ]);

  assert.equal(trainer.controls.previous.disabled, true);
});

test("a duplicate caption ID with a distant timestamp cannot create a cross-gap seek", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.events.onCaptionChange(caption("a2", 1800, "second with provider drift"));

  trainer.controls.previous.click();
  assertDeltas(trainer.widgetCalls.move.slice(-1), [-3]);
});

test("a late caption tagged with the previous video cannot contaminate the active video", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  observeVideo(trainer, "video-b", [caption("b1", 120, "other first")]);

  trainer.events.onCaptionChange(caption("a3", 607, "late old-video caption", "video-a"));

  assert.match(trainer.controls.status.textContent, /Observed captions: 1/);
});

test("a caption carrying its video ID is retained when it arrives before onVideoChange", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onCaptionChange(caption("a1", 600, "first", "video-a"));
  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a2", 603, "second", "video-a"));

  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
  assert.equal(trainer.controls.previous.disabled, false);
});

test("an empty onVideoChange payload does not discard the active video cursor", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);

  trainer.events.onVideoChange({ trackNumber: 0, video: "" });

  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
});

test("Repeat stays enabled before captions and during caption navigation or Replay", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

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

test("a second Replay click is coalesced while the first Replay is unconfirmed", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);

  trainer.controls.replay.click();
  trainer.controls.replay.click();

  assert.equal(trainer.widgetCalls.replay, 1);
});

test("controlled Next releases its busy state if playback stops before the target", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.controls.next.click();

  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onPlayerStateChange({ state: 2 });

  assert.equal(trainer.controls.next.disabled, false);
});

test("switching video cancels controlled Next without pausing the new video", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.controls.next.click();

  observeVideo(trainer, "video-b", [caption("b1", 120, "other first")]);

  assert.equal(trainer.widgetCalls.pause, 0);
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, true);
});

test("duplicate caption-consumed callbacks trigger only one Repeat seek", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", 600, "first"));
  trainer.controls.repeat.click();
  const movementBeforeConsumed = trainer.widgetCalls.move.length;

  trainer.events.onCaptionConsumed({ id: "a1" });
  trainer.events.onCaptionConsumed({ id: "a1" });

  assert.equal(trainer.widgetCalls.move.length, movementBeforeConsumed + 1);
});

test("Repeat can seek again after the repeated caption is observed", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", 600, "first"));
  trainer.controls.repeat.click();
  const movementBeforeRepeat = trainer.widgetCalls.move.length;

  trainer.events.onCaptionConsumed({ id: "a1" });
  trainer.events.onCaptionChange(caption("a1", 600, "first"));
  trainer.events.onCaptionConsumed({ id: "a1" });

  assert.equal(trainer.widgetCalls.move.length, movementBeforeRepeat + 2);
});

test("a caption inside an inactive segment range reactivates that cached segment", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", 600, "first"),
    caption("a3", 607, "third"),
    caption("b1", 1800, "later first"),
    caption("b2", 1804, "later second"),
  ]);
  trainer.events.onCaptionChange(caption("a2", 604, "inserted into earlier range"));

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);
  trainer.controls.next.click();
  assertDeltas(trainer.widgetCalls.move.slice(-1), [3]);
});

test("a large backward manual seek starts a safe isolated segment", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("b1", 1800, "later first"),
    caption("b2", 1804, "later second"),
  ]);
  trainer.events.onCaptionChange(caption("a1", 600, "much earlier"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, true);
});

test("identical caption IDs remain isolated between video histories", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("same-1", 600, "A first"),
    caption("same-2", 603, "A second"),
  ]);
  observeVideo(trainer, "video-b", [
    caption("same-1", 120, "B first"),
    caption("same-2", 124, "B second"),
  ]);
  observeVideo(trainer, "video-a", [caption("same-1", 600, "A first")]);

  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

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

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.controls.previous.click();
  trainer.controls.next.click();

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

  assert.equal(trainer.widgetCalls.replay, 1);
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
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

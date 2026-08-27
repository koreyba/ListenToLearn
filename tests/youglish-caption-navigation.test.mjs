import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";

const trainerPath = new URL("../public/trainer.html", import.meta.url);
const navigationPath = new URL("../public/caption-navigation.js", import.meta.url);
const videoRestorePath = new URL("../public/youglish-video-restore.js", import.meta.url);
const liveTracePath = new URL("./fixtures/youglish-live-caption-traces.json", import.meta.url);

async function nextTurn() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function liveTraceScenario(id) {
  const fixture = JSON.parse(await readFile(liveTracePath, "utf8"));
  const scenario = fixture.scenarios.find(candidate => candidate.id === id);
  assert.ok(scenario, `missing live trace scenario: ${id}`);
  return scenario;
}

async function createTrainer({
  controlledTimeoutMs = null,
  playError = null,
  replayError = null,
  trace = false,
  url = "",
} = {}) {
  let nowMs = 1_000;
  const [rawTrainerSource, navigationSource, videoRestoreSource] = await Promise.all([
    readFile(trainerPath, "utf8"),
    readFile(navigationPath, "utf8"),
    readFile(videoRestorePath, "utf8"),
  ]);
  const trainerSource = controlledTimeoutMs === null
    ? rawTrainerSource
    : rawTrainerSource.replace(
        "const CONTROLLED_CAPTION_TIMEOUT_MS = 20_000;",
        `const CONTROLLED_CAPTION_TIMEOUT_MS = ${controlledTimeoutMs};`,
      );
  const html = trainerSource
    .replace(
      '<script src="/caption-navigation.js"></script>',
      `<script>${navigationSource}</script>`,
    )
    .replace(
      '<script src="/youglish-video-restore.js"></script>',
      `<script>${videoRestoreSource}</script>`,
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
      Object.defineProperty(window.performance, "now", {
        configurable: true,
        value: () => nowMs,
      });
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
    url: url || (trace
      ? "http://127.0.0.1/trainer?phrase=test&phraseId=phrase-1&captionTrace=1"
      : "https://listen-to-learn.test/trainer?phrase=test&phraseId=phrase-1"),
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
    playPause: document.getElementById("playPauseBtn"),
    replay: document.getElementById("replayBtn"),
    repeat: document.getElementById("repeatCaptionBtn"),
    status: document.getElementById("captionNavigationHint"),
    watchFullVideo: document.getElementById("watchFullVideoBtn"),
  };

  return {
    advanceTime: milliseconds => { nowMs += milliseconds; },
    close: () => dom.window.close(),
    controls,
    events: widgetEvents,
    providerStatus: document.getElementById("status"),
    location: () => dom.window.location.href,
    trace: () => JSON.parse(controls.previous.parentElement.dataset.trace || "{}"),
    widgetCalls,
  };
}

test("Continue in video retains the first marked locator after playback advances", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "w66ecIT-Xkk" });
  trainer.events.onCaptionChange(caption(
    "matched",
    100,
    "That is [[[the actual match]]] in this video.",
    "w66ecIT-Xkk",
  ));
  assert.equal(trainer.controls.watchFullVideo.hidden, false);

  trainer.events.onCaptionChange(caption(
    "later",
    104,
    "A later caption without provider markers.",
    "w66ecIT-Xkk",
  ));
  assert.equal(trainer.controls.watchFullVideo.hidden, false);

  const fetchCount = trainer.widgetCalls.fetch.length;
  trainer.controls.watchFullVideo.click();
  const fullVideoUrl = new URL(trainer.location());

  assert.equal(fullVideoUrl.searchParams.get("restoreQuery"), "the actual match");
  assert.equal(trainer.widgetCalls.fetch.length, fetchCount);
});

test("cold Full Video restore uses the immutable match, saved accent, and one resume move", async t => {
  const trainer = await createTrainer({
    url: "https://listen-to-learn.test/trainer?fullVideo=1&video=w66ecIT-Xkk&query=display+query&restoreQuery=the+actual+match&resumeCaption=mutable+last+caption&resumeTime=400&language=english&accent=uk",
  });
  t.after(trainer.close);

  assert.deepEqual(trainer.widgetCalls.fetch, [[
    "the actual match #w66ecIT-Xkk",
    "english",
    "uk",
  ]]);

  trainer.events.onVideoChange({ trackNumber: 0, video: "w66ecIT-Xkk" });
  trainer.events.onCaptionChange(caption(
    "anchor",
    100,
    "That is [[[the actual match]]] in this video.",
    "w66ecIT-Xkk",
  ));

  assertDeltas(trainer.widgetCalls.move, [300]);
  assert.equal(trainer.widgetCalls.pause, 0);

  trainer.events.onCaptionChange(caption(
    "resumed",
    400,
    "The mutable resumed caption.",
    "w66ecIT-Xkk",
  ));

  assertDeltas(trainer.widgetCalls.move, [300]);
  assert.equal(trainer.widgetCalls.pause, 1);
});

test("cold Full Video restore falls back to the stable anchor when timing is absent", async t => {
  const trainer = await createTrainer({
    url: "https://listen-to-learn.test/trainer?fullVideo=1&video=w66ecIT-Xkk&query=display+query&restoreQuery=the+actual+match&resumeTime=400&language=english&accent=uk",
  });
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "w66ecIT-Xkk" });
  trainer.events.onCaptionChange(caption(
    "anchor",
    undefined,
    "That is [[[the actual match]]] in this video.",
    "w66ecIT-Xkk",
  ));

  assert.deepEqual(trainer.widgetCalls.move, []);
  assert.equal(trainer.widgetCalls.pause, 1);
});

test("cold Full Video restore rejects a provider result for another video", async t => {
  const trainer = await createTrainer({
    url: "https://listen-to-learn.test/trainer?fullVideo=1&video=w66ecIT-Xkk&query=display+query&restoreQuery=the+actual+match&language=english&accent=uk",
  });
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "M7lc1UVf-VE" });

  assert.match(trainer.providerStatus.textContent, /could not restore the saved video/i);
  assert.deepEqual(trainer.widgetCalls.move, []);
});

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

test("local caption traces capture commands and state without retaining provider text or IDs", async t => {
  const trainer = await createTrainer({ trace: true });
  t.after(trainer.close);

  observeVideo(trainer, "sensitive-video-id", [
    caption("sensitive-caption-a", undefined, "private first caption words"),
    caption("sensitive-caption-b", 603, "private second caption words"),
  ]);
  trainer.controls.previous.click();

  const trace = trainer.trace();
  const serialized = JSON.stringify(trace);
  const eventTypes = trace.events.map(event => event.type);

  assert.equal(trace.version, "listen-to-learn.youglish-caption-trace/v1");
  assert.ok(eventTypes.includes("widget.video"));
  assert.ok(eventTypes.includes("widget.caption-applied"));
  assert.ok(eventTypes.includes("ui.caption-navigation"));
  assert.ok(eventTypes.includes("widget.command"));
  assert.doesNotMatch(serialized, /sensitive-video-id/);
  assert.doesNotMatch(serialized, /sensitive-caption/);
  assert.doesNotMatch(serialized, /private .* caption words/);
});

test("local caption traces record CaptionConsumed even when Repeat is off", async t => {
  const trainer = await createTrainer({ trace: true });
  t.after(trainer.close);

  observeVideo(trainer, "sensitive-video-id", [
    caption("sensitive-caption-a", undefined, "private first caption words"),
  ]);
  trainer.events.onCaptionConsumed({ id: "sensitive-caption-a" });

  const trace = trainer.trace();
  const consumed = trace.events.find(event => event.type === "widget.caption-consumed");
  assert.equal(consumed.caption, "caption-1");
  assert.doesNotMatch(JSON.stringify(consumed), /sensitive-caption|private first/);
});

test("local caption traces record playback speed for media-time measurements", async t => {
  const trainer = await createTrainer({ trace: true });
  t.after(trainer.close);

  trainer.events.onSpeedChange({ speed: 0.75 });

  const speedEvent = trainer.trace().events.find(event => event.type === "widget.speed");
  assert.equal(speedEvent.speed, 0.75);
  assert.equal(speedEvent.state.speed, 0.75);
});

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

test("an untimed first-caption edge reuses symmetric relative moves in both directions", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(4_000);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.events.onPlayerStateChange({ state: 2 });

  trainer.controls.previous.click();

  assertDeltas(trainer.widgetCalls.move, [-4]);
  assert.equal(trainer.widgetCalls.replay, 0);
  trainer.events.onCaptionChange(caption("a1", 604.5, "first"));
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.controls.next.click();

  assertDeltas(trainer.widgetCalls.move, [-4, 4]);
  assert.equal(trainer.widgetCalls.play, 0);
  trainer.events.onCaptionChange(caption("a2", 605, "second"));
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
});

test("buffering discards the old interval and restarts edge measurement on PLAYING", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(1_000);
  trainer.events.onPlayerStateChange({ state: 3 });
  trainer.advanceTime(5_000);
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.advanceTime(1_000);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.events.onPlayerStateChange({ state: 2 });

  trainer.controls.previous.click();

  assertDeltas(trainer.widgetCalls.move, [-1]);
  assert.equal(trainer.widgetCalls.replay, 0);
});

test("time already replayed inside the first caption is subtracted from the fast forward move", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(4_000);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));

  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.advanceTime(1_500);
  trainer.controls.next.click();

  assertDeltas(trainer.widgetCalls.move, [-4, 2.5]);
});

test("time already played inside the second caption is included in the fast backward move", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(4_000);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.advanceTime(1_000);

  trainer.controls.previous.click();

  assertDeltas(trainer.widgetCalls.move, [-5]);
});

test("time spent on another video cannot become an untimed caption edge", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(1_000);
  trainer.events.onVideoChange({ trackNumber: 1, video: "video-b" });
  trainer.events.onCaptionChange(caption("b1", 120, "other video"));
  trainer.advanceTime(5_000);
  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.events.onPlayerStateChange({ state: 2 });

  trainer.controls.previous.click();

  assert.equal(trainer.widgetCalls.move.length, 0);
  assert.equal(trainer.widgetCalls.replay, 1);
});

test("an untimed edge is measured in media time at reduced playback speed", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onSpeedChange({ speed: 0.75 });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(4_000);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.events.onPlayerStateChange({ state: 2 });

  trainer.controls.previous.click();

  assertDeltas(trainer.widgetCalls.move, [-3]);
});

test("local trace exposes the learned edge without provider caption content", async t => {
  const trainer = await createTrainer({ trace: true });
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "private-video" });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("private-a", undefined, "secret first"));
  trainer.advanceTime(4_000);
  trainer.events.onCaptionChange(caption("private-b", 603, "secret second"));

  const trace = trainer.trace();
  const applied = trace.events.filter(event => event.type === "widget.caption-applied").at(-1);

  assert.equal(applied.state.history[0].nextOffsetSeconds, 4);
  assert.doesNotMatch(JSON.stringify(applied), /private-|secret/);
});

test("a skipped cached neighbor cannot overwrite its learned edge with a farther caption", async t => {
  const trainer = await createTrainer({ trace: true });
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(4_000);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(8_000);
  trainer.events.onCaptionChange(caption("a3", 607, "third"));

  const trace = trainer.trace();
  const applied = trace.events.filter(event => event.type === "widget.caption-applied").at(-1);

  assert.equal(applied.state.history[0].nextOffsetSeconds, 4);
});

test("inserting a new neighbor invalidates an edge learned for the old neighbor", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.advanceTime(4_000);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.events.onCaptionChange(caption("a-between", 601, "inserted"));

  trainer.controls.previous.click();

  assert.equal(trainer.widgetCalls.move.length, 0);
  assert.equal(trainer.widgetCalls.replay, 1);
});

test("an untimed edge starts measuring when playback begins after the first caption callback", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.events.onPlayerStateChange({ state: -1 });
  trainer.advanceTime(1_000);
  trainer.events.onPlayerStateChange({ state: 3 });
  trainer.advanceTime(100);
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.advanceTime(5_000);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  trainer.events.onPlayerStateChange({ state: 2 });

  trainer.controls.previous.click();

  assertDeltas(trainer.widgetCalls.move, [-5]);
  assert.equal(trainer.widgetCalls.replay, 0);
});

test("an explicit Pause cancels controlled Next so the user can retry immediately", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.controls.next.click();

  trainer.controls.playPause.click();
  const playCountBeforeRetry = trainer.widgetCalls.play;
  trainer.controls.next.click();

  assert.equal(trainer.widgetCalls.play, playCountBeforeRetry + 1);
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

test("a late current_time cannot move an untimed first caption behind the second caption", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);

  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", 604.5, "first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.events.onCaptionChange(caption("a2", 605, "second"));

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
});

test("a no-ID replay anchor keeps its position when a later callback gains current_time", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    captionWithoutId(undefined, "first"),
    captionWithoutId(603, "second"),
  ]);

  trainer.controls.previous.click();
  trainer.events.onCaptionChange(captionWithoutId(604.5, "first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.events.onCaptionChange(captionWithoutId(604.8, "second"));

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
});

test("Replay keeps an untimed first caption before cached forward captions despite clock drift", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);

  trainer.controls.replay.click();
  trainer.events.onVideoChange({ trackNumber: 0, video: "video-a" });
  trainer.events.onCaptionChange(caption("a1", 604.5, "first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.events.onCaptionChange(caption("a2", 605, "second"));

  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
});

test("repeated back-and-forward playback cannot invert an untimed two-caption history", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);

  for (let cycle = 0; cycle < 2; cycle += 1) {
    trainer.controls.previous.click();
    trainer.events.onCaptionChange(caption("a1", 604.5 + cycle, "first"));
    assert.equal(trainer.controls.previous.disabled, true);
    assert.equal(trainer.controls.next.disabled, false);

    trainer.events.onCaptionChange(caption("a2", 605 + cycle, "second"));
    assert.equal(trainer.controls.previous.disabled, false);
    assert.equal(trainer.controls.next.disabled, true);
  }
  assert.match(trainer.controls.status.textContent, /Observed captions: 2/);
});

test("an untimed first caption remains the boundary of a three-caption history", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
    caption("a3", 607, "third"),
  ]);

  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a2", 608, "second"));
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", 609, "first"));

  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.events.onCaptionChange(caption("a2", 610, "second"));
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, false);

  trainer.events.onCaptionChange(caption("a3", 611, "third"));
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
  assert.match(trainer.controls.status.textContent, /Observed captions: 3/);
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

test("Repeat follows a newly selected caption until the user turns it off", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.controls.repeat.click();
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  trainer.controls.next.click();
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "true");

  const movementBeforeConsumed = trainer.widgetCalls.move.length;
  trainer.events.onCaptionConsumed({ id: "a2" });
  assert.equal(trainer.widgetCalls.move.length, movementBeforeConsumed + 1);

  trainer.controls.repeat.click();
  assert.equal(trainer.controls.repeat.getAttribute("aria-pressed"), "false");

  trainer.events.onCaptionConsumed({ id: "a2" });
  assert.equal(trainer.widgetCalls.move.length, movementBeforeConsumed + 1);
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

test("controlled Next survives provider state noise and restores the user's pause at its target", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);
  const liveRace = await liveTraceScenario("next-during-provider-state-race");

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);

  trainer.controls.playPause.click();
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));

  // A delayed callback from the Replay command must not overwrite the user's
  // explicit paused intent.
  trainer.events.onPlayerStateChange({ state: 1 });

  const playCountBeforeNext = trainer.widgetCalls.play;
  const pauseCountBeforeNext = trainer.widgetCalls.pause;
  trainer.controls.next.click();

  assert.equal(trainer.widgetCalls.play, playCountBeforeNext + 1);
  assert.equal(trainer.widgetCalls.pause, pauseCountBeforeNext);
  assert.doesNotMatch(trainer.controls.status.textContent, /Navigating/i);

  trainer.controls.next.click();
  assert.equal(trainer.widgetCalls.play, playCountBeforeNext + 1, "duplicate Next must be coalesced");

  const providerEvents = liveRace.events
    .slice(liveRace.events.findIndex(event => event.type === "ui.navigate") + 1)
    .filter(event => event.type === "playerState" || event.type === "caption");
  assert.deepEqual(
    providerEvents.filter(event => event.type === "playerState").slice(0, 3).map(event => event.state),
    [2, 3, 1],
  );
  for (const event of providerEvents) {
    if (event.type === "playerState") {
      trainer.events.onPlayerStateChange({ state: event.state });
      if (event.state === 2) {
        trainer.controls.next.click();
        assert.equal(
          trainer.widgetCalls.play,
          playCountBeforeNext + 1,
          "provider pause noise must not release the target intent",
        );
      }
    } else if (event.caption === "caption-2") {
      trainer.events.onCaptionChange(caption("a2", event.currentTime, "second"));
      break;
    }
  }

  assert.equal(trainer.widgetCalls.pause, pauseCountBeforeNext + 1);
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
});

test("controlled Next while playing waits for its target without playback command churn", async t => {
  const trainer = await createTrainer();
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));
  trainer.events.onPlayerStateChange({ state: 1 });

  const playCountBeforeNext = trainer.widgetCalls.play;
  const pauseCountBeforeNext = trainer.widgetCalls.pause;
  trainer.controls.next.click();

  assert.equal(trainer.widgetCalls.play, playCountBeforeNext);
  assert.equal(trainer.widgetCalls.pause, pauseCountBeforeNext);

  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.events.onPlayerStateChange({ state: 3 });
  trainer.events.onPlayerStateChange({ state: 1 });
  trainer.events.onCaptionChange(caption("a2", 603, "second"));

  assert.equal(trainer.widgetCalls.pause, pauseCountBeforeNext);
  assert.equal(trainer.controls.previous.disabled, false);
  assert.equal(trainer.controls.next.disabled, true);
});

test("Replay stays available and cancels a controlled Next", async t => {
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

  const replayCountBeforeCancel = trainer.widgetCalls.replay;
  assert.equal(trainer.controls.replay.disabled, false);

  trainer.controls.replay.click();

  assert.equal(trainer.widgetCalls.replay, replayCountBeforeCancel + 1);
  trainer.events.onCaptionChange(caption("a2", 603, "second"));
  assert.equal(trainer.controls.previous.disabled, true);
  assert.equal(trainer.controls.next.disabled, false);
});

test("controlled Next times out instead of retaining a stale target forever", async t => {
  const trainer = await createTrainer({ controlledTimeoutMs: 5 });
  t.after(trainer.close);

  observeVideo(trainer, "video-a", [
    caption("a1", undefined, "first"),
    caption("a2", 603, "second"),
  ]);
  trainer.events.onPlayerStateChange({ state: 2 });
  trainer.controls.previous.click();
  trainer.events.onCaptionChange(caption("a1", undefined, "first"));

  trainer.controls.next.click();
  const playCountBeforeTimeout = trainer.widgetCalls.play;
  const pauseCountBeforeTimeout = trainer.widgetCalls.pause;
  await new Promise(resolve => setTimeout(resolve, 15));

  assert.equal(trainer.widgetCalls.pause, pauseCountBeforeTimeout + 1);
  trainer.controls.next.click();

  assert.equal(trainer.widgetCalls.play, playCountBeforeTimeout + 1);
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

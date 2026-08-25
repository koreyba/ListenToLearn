import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadNavigation() {
  const source = await readFile(
    new URL("../public/caption-navigation.js", import.meta.url),
    "utf8",
  );
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.ListenToLearnCaptionNavigation;
}

function entry(id, startTime, segmentId) {
  return {
    firstSeen: Number(id.replace(/\D/g, "")) || 0,
    id,
    segmentId,
    startTime,
    videoId: "video-a",
  };
}

test("segment resolution keeps a known caption in its original segment", async () => {
  const navigation = await loadNavigation();
  const history = [
    entry("a1", 600, "segment-0"),
    entry("a2", 603, "segment-0"),
    entry("b1", 1800, "segment-1"),
  ];

  const resolved = navigation.resolveSegment(
    history,
    { id: "a2", startTime: 603, videoId: "video-a" },
    "segment-1",
    2,
  );

  assert.equal(resolved.segmentId, "segment-0");
  assert.equal(resolved.nextSegmentSequence, 2);
});

test("segment resolution inserts an unseen caption inside a known range", async () => {
  const navigation = await loadNavigation();
  const history = [
    entry("a1", 600, "segment-0"),
    entry("a3", 607, "segment-0"),
  ];

  const resolved = navigation.resolveSegment(
    history,
    { id: "a2", startTime: 604, videoId: "video-a" },
    "segment-0",
    1,
  );

  assert.equal(resolved.segmentId, "segment-0");
  assert.equal(resolved.nextSegmentSequence, 1);
});

test("the first timestamped neighbor stays with an untimed Replay anchor", async () => {
  const navigation = await loadNavigation();
  const history = [entry("a1", null, "segment-0")];

  const resolved = navigation.resolveSegment(
    history,
    { id: "a2", startTime: 603, videoId: "video-a" },
    "segment-0",
    1,
  );

  assert.equal(resolved.segmentId, "segment-0");
  assert.equal(resolved.nextSegmentSequence, 1);
});

test("segment resolution creates a new segment for a distant caption", async () => {
  const navigation = await loadNavigation();
  const history = [
    entry("a1", 600, "segment-0"),
    entry("a2", 603, "segment-0"),
    entry("a3", 607, "segment-0"),
  ];

  const resolved = navigation.resolveSegment(
    history,
    { id: "b1", startTime: 1800, videoId: "video-a" },
    "segment-0",
    1,
  );

  assert.equal(resolved.segmentId, "segment-1");
  assert.equal(resolved.nextSegmentSequence, 2);
});

test("neighbors never cross an active segment boundary", async () => {
  const navigation = await loadNavigation();
  const history = [
    entry("a1", 600, "segment-0"),
    entry("a2", 603, "segment-0"),
    entry("b1", 1800, "segment-1"),
    entry("b2", 1804, "segment-1"),
  ];

  const secondSegment = navigation.neighbors(history, 2, "video-a", "segment-1");
  assert.equal(secondSegment.previous, null);
  assert.equal(secondSegment.next.id, "b2");

  const firstSegment = navigation.neighbors(history, 1, "video-a", "segment-0");
  assert.equal(firstSegment.previous.id, "a1");
  assert.equal(firstSegment.next, null);
});

test("a caption exactly at the active segment tolerance stays in that segment", async () => {
  const navigation = await loadNavigation();
  const history = [entry("a1", 600, "segment-0")];

  const resolved = navigation.resolveSegment(
    history,
    { id: "a2", startTime: 630, videoId: "video-a" },
    "segment-0",
    1,
  );

  assert.equal(resolved.segmentId, "segment-0");
  assert.equal(resolved.nextSegmentSequence, 1);
});

test("a caption beyond the active segment tolerance starts a new segment", async () => {
  const navigation = await loadNavigation();
  const history = [entry("a1", 600, "segment-0")];

  const resolved = navigation.resolveSegment(
    history,
    { id: "a2", startTime: 630.001, videoId: "video-a" },
    "segment-0",
    1,
  );

  assert.equal(resolved.segmentId, "segment-1");
  assert.equal(resolved.nextSegmentSequence, 2);
});

test("invalid provider times never become seekable timestamps", async () => {
  const navigation = await loadNavigation();

  assert.equal(navigation.finiteTime(""), null);
  assert.equal(navigation.finiteTime(-1), null);
  assert.equal(navigation.finiteTime(Number.NaN), null);
  assert.equal(navigation.finiteTime(Number.POSITIVE_INFINITY), null);
  assert.equal(navigation.finiteTime(0), 0);
});

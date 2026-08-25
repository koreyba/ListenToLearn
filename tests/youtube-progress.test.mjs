import assert from "node:assert/strict";
import test from "node:test";
import {
  clearYouTubeProgress,
  normalizeYouTubeProgress,
  readYouTubeResume,
  readYouTubeProgress,
  updateYouTubeProgress,
} from "../lib/youtube-progress.ts";

test("malformed YouTube progress normalizes to an empty bounded state", () => {
  assert.deepEqual(normalizeYouTubeProgress({
    version: 99,
    videos: {
      "bad id": { seconds: -5, updatedAt: "not-a-date" },
    },
  }), {
    version: 1,
    videos: {},
  });
});

test("YouTube progress saves, reads and clears a video position", () => {
  const saved = updateYouTubeProgress(
    normalizeYouTubeProgress(null),
    "M7lc1UVf-VE",
    42.75,
    "2026-08-25T10:00:00.000Z",
    { captionId: "caption-42", captionText: "That takes real courage." },
  );

  assert.equal(readYouTubeProgress(saved, "M7lc1UVf-VE"), 42.75);
  assert.deepEqual(readYouTubeResume(saved, "M7lc1UVf-VE"), {
    seconds: 42.75,
    captionId: "caption-42",
    captionText: "That takes real courage.",
    updatedAt: "2026-08-25T10:00:00.000Z",
  });
  assert.equal(readYouTubeProgress(clearYouTubeProgress(saved, "M7lc1UVf-VE"), "M7lc1UVf-VE"), 0);
});

test("YouTube resume metadata is bounded and malformed captions are discarded", () => {
  const state = normalizeYouTubeProgress({
    videos: {
      "M7lc1UVf-VE": {
        seconds: 15,
        captionId: " caption-15 ",
        captionText: `  ${"word ".repeat(250)}  `,
        updatedAt: "2026-08-25T10:00:00.000Z",
      },
    },
  });

  assert.equal(state.videos["M7lc1UVf-VE"].captionId, "caption-15");
  assert.equal(state.videos["M7lc1UVf-VE"].captionText.length, 1_000);
});

test("YouTube progress ignores invalid and effectively completed positions", () => {
  const empty = normalizeYouTubeProgress(null);
  const negative = updateYouTubeProgress(empty, "M7lc1UVf-VE", -1);
  const oversized = updateYouTubeProgress(empty, "M7lc1UVf-VE", 700_000);
  const nearEnd = updateYouTubeProgress(empty, "M7lc1UVf-VE", 95, "2026-08-25T10:00:00.000Z");

  assert.equal(readYouTubeProgress(negative, "M7lc1UVf-VE"), 0);
  assert.equal(readYouTubeProgress(oversized, "M7lc1UVf-VE"), 0);
  assert.equal(readYouTubeProgress(nearEnd, "M7lc1UVf-VE", 100), 0);
  assert.equal(readYouTubeProgress(nearEnd, "M7lc1UVf-VE", 200), 95);
});

test("YouTube progress retains only the 200 newest valid videos", () => {
  const videos = Object.fromEntries(Array.from({ length: 201 }, (_, index) => {
    const videoId = `video${String(index).padStart(6, "0")}`;
    return [videoId, {
      seconds: index,
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    }];
  }));
  const state = normalizeYouTubeProgress({ videos });

  assert.equal(Object.keys(state.videos).length, 200);
  assert.equal(state.videos.video000000, undefined);
  assert.equal(state.videos.video000200.seconds, 200);
});

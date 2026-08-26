import assert from "node:assert/strict";
import test from "node:test";

import {
  legacyYoutubeProgressStorageKeys,
  youtubeProgressStorageKey,
} from "../lib/client-session.ts";
import { normalizeStoredVideoProgress, readVideoProgressInput } from "../lib/video-history.ts";

test("missing account progress preserves an existing resume anchor", () => {
  assert.deepEqual(readVideoProgressInput(undefined), { ok: true, value: null });
});

test("account video progress is bounded and normalized before D1 persistence", () => {
  assert.deepEqual(readVideoProgressInput({
    seconds: 42.75,
    captionId: " caption-42 ",
    captionText: `  ${"word ".repeat(250)}  `,
  }), {
    ok: true,
    value: {
      seconds: 42.75,
      captionId: "caption-42",
      captionText: "word ".repeat(200).trimEnd(),
    },
  });

  for (const value of [null, [], {}, { seconds: -1 }, { seconds: 604_801 }, { seconds: "NaN" }]) {
    assert.equal(readVideoProgressInput(value).ok, false);
  }
});

test("progress retry mirrors use Unmumble keys and recognize legacy keys", () => {
  assert.equal(youtubeProgressStorageKey(null), "unmumble-youtube-progress-v1:anonymous");
  assert.equal(youtubeProgressStorageKey("subject/A"), "unmumble-youtube-progress-v1:subject%2FA");
  assert.notEqual(youtubeProgressStorageKey("subject/A"), youtubeProgressStorageKey("subject/B"));
  assert.deepEqual(legacyYoutubeProgressStorageKeys(null), [
    "listen-to-learn-youtube-progress-v1:anonymous",
    "listen-to-learn-youtube-progress-v1",
  ]);
  assert.deepEqual(legacyYoutubeProgressStorageKeys("subject/A"), [
    "listen-to-learn-youtube-progress-v1:subject%2FA",
    "listen-to-learn-youtube-progress-v1",
  ]);
});

test("stored D1 progress is normalized again before it reaches the browser", () => {
  assert.deepEqual(normalizeStoredVideoProgress({
    seconds: 7,
    captionId: " caption-7 ",
    captionText: " observed caption ",
    updatedAt: "2026-08-25T10:00:00.000Z",
  }), {
    seconds: 7,
    captionId: "caption-7",
    captionText: "observed caption",
    updatedAt: "2026-08-25T10:00:00.000Z",
  });
  assert.deepEqual(normalizeStoredVideoProgress({
    seconds: -1,
    captionId: "must disappear",
    updatedAt: "not-a-date",
  }), { seconds: 0, captionId: "", captionText: "", updatedAt: "" });
});

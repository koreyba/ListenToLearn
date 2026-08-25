import assert from "node:assert/strict";
import test from "node:test";
import {
  isYouTubeVideoId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "../lib/youtube-player.ts";

test("YouTube helper accepts only canonical video ids and encodes provider URLs", () => {
  assert.equal(isYouTubeVideoId("M7lc1UVf-VE"), true);
  assert.equal(isYouTubeVideoId("not a video"), false);
  assert.equal(youtubeWatchUrl("M7lc1UVf-VE"), "https://www.youtube.com/watch?v=M7lc1UVf-VE");
  assert.equal(youtubeThumbnailUrl("M7lc1UVf-VE"), "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg");
  assert.equal(youtubeWatchUrl("not a video"), "");
});

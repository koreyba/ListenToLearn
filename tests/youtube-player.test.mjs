import assert from "node:assert/strict";
import test from "node:test";
import {
  isYouTubeVideoId,
  youtubePlayerVars,
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

test("YouTube player variables preserve native controls, English CC and origin", () => {
  assert.deepEqual(youtubePlayerVars("https://listen.example"), {
    controls: 1,
    playsinline: 1,
    cc_load_policy: 1,
    cc_lang_pref: "en",
    origin: "https://listen.example",
  });
});

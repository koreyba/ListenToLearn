import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFullVideoTrainerUrl,
  videoSpecificQuery,
} from "../lib/youglish-full-video.ts";

test("video-specific query preserves the phrase and appends one canonical video constraint", () => {
  assert.equal(
    videoSpecificQuery("  I don't know if it's  ", "w66ecIT-Xkk"),
    "I don't know if it's #w66ecIT-Xkk",
  );
  assert.equal(
    videoSpecificQuery("I don't know if it's #w66ecIT-Xkk", "w66ecIT-Xkk"),
    "I don't know if it's #w66ecIT-Xkk",
  );
  assert.equal(videoSpecificQuery("hello", "invalid"), "");
});

test("full-video URL uses the last caption for cold restore and retains the original query", () => {
  const url = new URL(buildFullVideoTrainerUrl({
    videoId: "w66ecIT-Xkk",
    originPhraseId: "base-0",
    originQuery: "I don't know if it's",
    originCaption: "I just think a mix would have been nice.",
    language: "english",
    accent: "us",
  }, {
    seconds: 2401.069,
    captionId: "187152571",
    captionText: "relatively in the weeds of actually allocating capital",
    updatedAt: "2026-08-25T10:00:00.000Z",
  }), "https://example.test");

  assert.equal(url.pathname, "/trainer");
  assert.equal(url.searchParams.get("fullVideo"), "1");
  assert.equal(url.searchParams.get("video"), "w66ecIT-Xkk");
  assert.equal(url.searchParams.get("query"), "I don't know if it's");
  assert.equal(url.searchParams.get("resumeCaption"), "relatively in the weeds of actually allocating capital");
  assert.equal(url.searchParams.get("resumeCaptionId"), "187152571");
  assert.equal(url.searchParams.get("resumeTime"), "2401.069");
  assert.equal(url.searchParams.get("language"), "english");
  assert.equal(url.searchParams.get("accent"), "us");
});

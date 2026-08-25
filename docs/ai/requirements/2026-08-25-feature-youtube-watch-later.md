---
phase: requirements
title: YouTube Watch Later Requirements
description: Save a YouGlish-discovered YouTube video for direct long-form viewing with local resume
---

# YouTube Watch Later Requirements

## Problem Statement

ListenToLearn currently saves a YouGlish result as a phrase-bound example and replays it through another YouGlish search for `query #videoId`. This is useful for pronunciation practice, but it does not support the distinct intent “this is a good video; save it and watch the whole thing later.” Replay consumes another YouGlish request, starts near the matched phrase, and does not restore long-form viewing progress after reload.

The first target user is the existing learner using YouGlish inside the trainer. Directly importing arbitrary YouTube URLs is a later scenario, not part of this increment.

## Goals & Objectives

- Keep the existing YouGlish phrase-example workflow intact while naming it clearly as a saved clip.
- Add a separate `Watch later` action for the current YouGlish video. It saves without navigating.
- Add a separate `Watch full video` action that opens the current video immediately without requiring it to be saved.
- Provide a public `/videos` view that lists saved videos and plays a selected video directly through the official YouTube IFrame Player.
- Restore the selected video's latest position after page reload in the same browser.
- Use native YouTube controls and native YouTube closed captions when the video supplies them.
- Keep guest data local and account-owned saved-video data isolated in D1.
- Deduplicate saved videos by YouTube video ID, independently of the phrase examples that led to them.

### Non-goals

- Importing or searching arbitrary YouTube URLs directly in ListenToLearn.
- Downloading video, audio, transcripts, caption tracks, or other YouTube content.
- Recreating YouGlish caption text, translation, previous/next-caption, or repeat-caption controls in the direct YouTube view.
- Cross-device synchronization of playback position in this increment.
- Replacing the YouGlish or Tatoeba provider tabs with YouTube.
- Automatically saving a video merely because the learner opens the full-video view.

## User Stories & Use Cases

- As a learner, I can save the current YouGlish video to `Watch later` without leaving the trainer.
- As a learner, I can open the current YouGlish video in the full-video view without saving it.
- As a learner, I can distinguish `Save clip` from `Watch later`; one remains phrase-bound, while the other is video-level.
- As a learner, I can open `Videos` from the app and see every video saved for later only once.
- As a learner, I can see the phrase/caption that led me to a saved video, even when a YouTube title is unavailable.
- As a learner, I can watch the whole video, use YouTube's timeline, speed, fullscreen, keyboard controls and native CC.
- As a learner, I can reload or close and reopen the page in the same browser and continue near my last saved position.
- As a learner, I can remove a saved video without deleting its phrase or saved YouGlish clips.
- As a guest, I can use the same flow with bounded local browser storage.
- As a signed-in user, my saved-video list belongs only to my account; playback position remains local to each browser in this increment.

### Edge cases

- No current YouGlish `videoId`: both full-video actions remain disabled.
- Duplicate save from another phrase: keep one video record and refresh its latest origin context instead of adding another card.
- Missing/blocked/private/non-embeddable YouTube video: show the YouTube player error and retain remove/back actions.
- Missing captions: the video remains playable; the app does not promise captions.
- Browser storage unavailable or malformed: start at zero, keep playback usable, and show a non-blocking message.
- Stored position is negative, non-finite, beyond a bounded maximum, or within the final seconds of a completed video: ignore/reset it.
- Guest local data exceeds its cap: retain the newest bounded records.
- Account API returns unauthorized: follow the existing authentication hint/session contract and never merge account and guest libraries silently.

## Success Criteria

- The trainer exposes separate `Save clip`, `Watch later`, and `Watch full video` meanings for YouGlish without changing Tatoeba save behavior.
- `Watch later` stores one video per `videoId` and does not navigate; `Watch full video` navigates without implicitly saving.
- `/videos` is guest-accessible and account-aware, supports list/open/remove, and has an explicit empty state.
- Opening a selected video does not load the YouGlish script or call `widget.fetch`.
- The direct player uses the official YouTube IFrame API with visible controls, `origin`, inline playback, and English CC requested by default.
- Playback position is saved at a bounded cadence plus pause/page-hide events and restored with `startSeconds` after reload.
- Guest normalization rejects malformed saved-video/progress input and enforces caps.
- Account API validates video IDs and origin context, scopes every query/mutation to the authenticated user, and never accepts a user ID from the client.
- D1 migration, targeted tests, TypeScript, lint, build, and diff checks pass.
- Manual smoke confirms save, direct playback, native CC when available, reload resume, removal, and unchanged saved-clip replay.

## Constraints & Assumptions

- Use the existing Vinext/React, static trainer, Cloudflare Worker, D1, authenticated API, and guest `localStorage` conventions.
- `onVideoChange` supplies the current YouTube video ID; it does not supply a stable full-video title. The MVP card uses origin phrase/caption plus a YouTube thumbnail/link. External metadata enrichment is deferred.
- The saved-video list is durable in D1 for signed-in users and in the existing bounded guest library for guests.
- Resume progress is intentionally browser-local for both modes. This is the smallest step consistent with moving from smaller to larger scenarios.
- A YouTube video ID is the canonical identity. Phrase/caption data is origin context, not part of uniqueness.
- YouTube controls and captions stay inside the unobscured official player. ListenToLearn does not scrape caption text or block YouTube branding/ads.
- Existing user changes on the original `codex/compact-player-controls` worktree are outside this isolated feature branch.

## Questions & Open Items

No material MVP questions remain. Deferred decisions are direct URL import, cross-device progress, richer YouTube metadata, and interactive full-video transcript controls.

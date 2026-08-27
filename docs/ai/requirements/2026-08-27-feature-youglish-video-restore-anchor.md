---
phase: requirements
title: Stable YouGlish Saved-Video Restore Requirements
description: Make newly saved YouGlish videos reopen independently from mutable resume captions
---

# Stable YouGlish Saved-Video Restore Requirements

## Problem Statement

`Continue in video` currently saves a YouGlish result, but a later cold open from
`/videos` searches for the last observed caption plus `#videoId`. The last
caption is playback progress, not the phrase that originally located the video,
so YouGlish can return zero results. The cold path also ignores the accent stored
with the video and uses the trainer preference instead. A warm transition works
only because it reuses the already loaded widget.

The learner therefore cannot rely on a newly added video reopening from the
Videos section.

## Goals & Objectives

- Persist an immutable YouGlish `restoreQuery` when a new video is added.
- Derive `restoreQuery` from the text marked by YouGlish as `[[[matched]]]` in
  the active caption, rather than from the mutable last caption.
- Reopen with exactly `restoreQuery #videoId` and the saved accent.
- Keep restore identity (`restoreQuery`, `videoId`, language/accent) separate
  from resume progress (seconds, caption ID/text).
- After the stable fetch restores the expected video, use the saved timestamp as
  a relative seek target when YouGlish supplies a current timestamp.
- Keep the warm `Continue in video` transition and account/guest ownership
  behavior unchanged.

### Non-goals

- No migration, repair, retry heuristic, or compatibility fallback for existing
  saved-video records. Records without `restoreQuery` may disappear.
- No switch to direct YouTube playback or transcript retrieval.
- No transcript storage or provider scraping.
- No guarantee of exact resume when every YouGlish callback omits timing; an
  untimed first matched caption must not be mistaken for final evidence that
  timing is unavailable.

## User Stories & Use Cases

- As a learner, when I add a new YouGlish result through `Continue in video`, I
  can later open that video from Videos even after restarting the browser.
- As a learner, my saved US/UK/All accent is used for the first restore request,
  regardless of my current trainer preference.
- As a learner, playback resumes near my saved timestamp when the provider
  exposes enough timing information.
- As a learner, I see `Restoring to mm:ss…` while YouGlish is still moving to my
  saved position, instead of mistaking the provider delay for a broken action.
- As a learner, that restoring state is prominent on the video while the
  YouGlish player remains visible and fully interactive, including its native
  pause and volume controls.
- As a learner, a provider result for another video is rejected instead of being
  presented as the saved video.
- As a learner with legacy saved data, I accept that entries without the new
  locator are not recoverable and are not retained through compatibility code.

## Success Criteria

- A new guest or account video cannot be persisted without a non-empty
  `restoreQuery` and valid YouTube video ID.
- The Videos page opens new records with `restoreQuery`, original display query,
  saved language/accent and independent resume metadata.
- Cold restore sends one initial `widget.fetch` for
  `restoreQuery #videoId`; neither `resumeCaption` nor `originQuery` becomes
  the locator.
- The first fetch uses the stored accent, including an empty accent for `All`.
- `onVideoChange` still verifies the expected video ID.
- With provider `current_time`, the trainer calls documented relative
  `widget.move(resumeTime - current_time)`, waits for a later caption timestamp
  to confirm the result, and retries at most three times when the provider
  remains far from the saved target.
- An untimed first caption keeps restore pending and starts playback until the
  first later timed caption can anchor the relative move; no move is calculated
  from missing timing.
- Cold restore exposes a visible, politely announced `Restoring to mm:ss…`
  status from initialization through provider confirmation. Success hides it;
  a provider error replaces it.
- The restoring status is rendered inside the video frame as a large overlay
  that does not receive pointer events or block the embedded player.
- Automated contracts cover extraction, guest/API/schema persistence, URL
  construction, cold widget fetch, accent, confirmed bounded resume and untimed
  anchor continuation.
- Full tests, build, TypeScript, lint, lifecycle lint and diff checks pass.

## Constraints & Assumptions

- The YouGlish Widget API requires search text even when constrained by a video
  ID; `#videoId` alone is not a supported restore contract.
- The documented `onCaptionChange.caption` markers identify the provider-matched
  text, and `widget.move(seconds)` is relative.
- `event.current_time` is an optional observed provider field already consumed
  by the trainer, not a guaranteed public contract. Real cold restores omit it
  on the matched first caption and provide it on the next caption, so restore
  must wait across that boundary.
- Saved videos remain bounded and deduplicated by `videoId` for both account and
  guest storage.
- The YouGlish widget remains mounted and interactive during restore; the app
  does not claim to mute it because the documented widget API has no mute call.
- The new D1 column may default to an empty string for migration safety, while
  reads expose only rows containing the new locator.

## Considered Approaches

- **Last resume caption:** rejected because progress text is mutable and may not
  be searchable by YouGlish.
- **Original UI query:** better than the last caption, but still broader than the
  exact provider match and already failed for some stored examples.
- **Provider-marked match plus video ID (chosen):** captures the phrase YouGlish
  demonstrably used to locate that exact result, while keeping progress separate.

## Questions & Open Items

No material open question remains. Legacy loss was explicitly accepted; the
untimed-first-caption behavior is now backed by a local provider trace.

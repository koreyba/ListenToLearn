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
- Measure and persist the original phrase playback time (`restoreAnchorTime`)
  once, while the video is discovered.
- After the stable fetch restores the expected video, seek from the persisted
  anchor on the first `PLAYING` event without waiting for a caption timestamp.
- Keep playback running when an actively playing result enters Full Video and
  after a cold restore reaches the saved position; only the learner pauses it.
- Keep the warm `Continue in video` transition and account/guest ownership
  behavior unchanged.

### Non-goals

- No migration, repair, retry heuristic, or compatibility fallback for existing
  saved-video records. Records without `restoreQuery` may disappear.
- No switch to direct YouTube playback or transcript retrieval.
- No transcript storage or provider scraping.
- No attempt to fabricate an anchor when discovery never produces a timed
  callback. `Continue in video` remains unavailable until the anchor is
  measurable, so new saved records never silently inherit the old delay.

## User Stories & Use Cases

- As a learner, when I add a new YouGlish result through `Continue in video`, I
  can later open that video from Videos even after restarting the browser.
- As a learner, my saved US/UK/All accent is used for the first restore request,
  regardless of my current trainer preference.
- As a learner, playback resumes near my saved timestamp when the provider
  exposes enough timing information.
- As a learner, switching to Full Video does not pause playback that was already
  running, and a completed restore continues from the saved position.
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
  `restoreQuery`, valid YouTube video ID and finite `restoreAnchorTime`.
- The Videos page opens new records with `restoreQuery`, original display query,
  saved language/accent and independent resume metadata.
- Cold restore sends one initial `widget.fetch` for
  `restoreQuery #videoId`; neither `resumeCaption` nor `originQuery` becomes
  the locator.
- The first fetch uses the stored accent, including an empty accent for `All`.
- `onVideoChange` still verifies the expected video ID.
- Discovery measures `restoreAnchorTime` from the first later finite
  `current_time` minus only the media time actually played since the matched
  callback; pause/buffering intervals are excluded.
- Once cold restore verifies the saved `videoId`, the trainer calls documented
  relative `widget.move(resumeTime - restoreAnchorTime)` on the first
  `PLAYING`, before any cold-load caption callback is required.
- Later provider timestamps confirm the result and permit at most two bounded
  corrections after the initial move when the provider remains far from the
  saved target.
- Warm Full Video entry and successful cold restore never issue an automatic
  `widget.pause()` command.
- Cold restore exposes a visible, politely announced `Restoring to mm:ss…`
  status from initialization through provider confirmation. Success hides it;
  a provider error replaces it.
- The restoring status is rendered inside the video frame as a large overlay
  that does not receive pointer events or block the embedded player.
- Automated contracts cover extraction, guest/API/schema persistence, URL
  construction, discovery-time anchor measurement, cold widget fetch, accent,
  caption-independent initial movement and confirmed bounded correction.
- Full tests, build, TypeScript, lint, lifecycle lint and diff checks pass.

## Constraints & Assumptions

- The YouGlish Widget API requires search text even when constrained by a video
  ID; `#videoId` alone is not a supported restore contract.
- The documented `onCaptionChange.caption` markers identify the provider-matched
  text, and `widget.move(seconds)` is relative.
- `event.current_time` is an optional observed provider field already consumed
  by the trainer, not a guaranteed public contract. It is used during discovery
  to measure the immutable anchor and after movement to confirm the result; it
  is no longer a gate before the first cold-resume move.
- Saved videos remain bounded and deduplicated by `videoId` for both account and
  guest storage.
- The YouGlish widget remains mounted and interactive during restore; the app
  does not claim to mute it because the documented widget API has no mute call.
- The new D1 anchor column defaults to `-1` for migration safety, while reads
  expose only rows containing both the locator and a non-negative anchor.

## Considered Approaches

- **Last resume caption:** rejected because progress text is mutable and may not
  be searchable by YouGlish.
- **Original UI query:** better than the last caption, but still broader than the
  exact provider match and already failed for some stored examples.
- **Provider-marked match plus video ID (chosen):** captures the phrase YouGlish
  demonstrably used to locate that exact result, while keeping progress separate.
- **Wait for a cold caption timestamp:** rejected for new records because it
  recreates the visible multi-second delay even though discovery already had
  enough information to measure and persist the phrase position.

## Questions & Open Items

No material open question remains. Legacy loss was explicitly accepted; both
discovery measurement and caption-independent first movement are backed by RED
contracts and a local real-widget trace.

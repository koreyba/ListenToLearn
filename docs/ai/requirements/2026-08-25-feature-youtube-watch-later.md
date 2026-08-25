---
phase: requirements
title: YouGlish Full Video Mode Requirements
description: Save a YouGlish-discovered video and continue long-form caption-aware viewing with resume
---

# YouGlish Full Video Mode Requirements

## Revision Status

This document supersedes the original direct-YouTube-player requirements. The native YouTube IFrame implementation in PR #15 does not satisfy the product requirement because it removes ListenToLearn captions, caption-level controls, translation, `To learn`, and `Listen`.

## Problem Statement

A learner can discover a useful YouTube video through YouGlish and practise the matched phrase, but cannot save that video as a long-form listening item and later continue watching it in the ListenToLearn learning interface. Reopening must return near the last watched place—at the last observed caption boundary after a cold load—while retaining current-caption learning actions.

The feature must not download or scrape the full transcript. It reuses the YouGlish widget as the caption and playback provider, stores only origin/restore metadata plus captions actually observed during the current browser session, and minimizes YouGlish searches.

## Goals & Objectives

- Add a distinct `Full video` experience for a video discovered in YouGlish.
- Save the source `videoId` and the exact `originalQuery` required to find that video again, together with language, accent and origin context.
- Preserve the live YouGlish widget when entering Full Video Mode from an active result, so the warm transition makes no new `widget.fetch` call.
- On a cold saved-video load, perform at most one YouGlish fetch using the last observed caption (or original query) constrained to the saved video, paused at that caption boundary.
- Preserve exact playback position for warm in-document navigation and return paused at the beginning of the last observed caption after a cold reload.
- Keep caption-aware learning actions for the currently observed caption: repeat, selection, translation, `To learn`, and `Listen`.
- Keep saved-video identity independent from phrase-bound saved clips and deduplicate by YouTube video ID.
- Preserve correct browser/app Back and Forward behavior between ordinary trainer mode and Full Video Mode.

### Non-goals

- Importing an arbitrary YouTube URL that was not discovered through a usable YouGlish query.
- Downloading video, audio, a full transcript, caption tracks, or other YouTube content.
- Using unofficial YouTube caption endpoints or a free third-party transcript service.
- Guaranteeing a zero-request cold restore; one YouGlish fetch is accepted.
- Using the native YouTube IFrame player as the primary Full Video Mode.
- Cross-device playback-position synchronization in this increment.
- `Save clip` inside Full Video Mode.
- Replaying the original matched phrase as a special anchor after entering Full Video Mode.
- Switching provider, result video, saved-example filters, or random/ordered result modes inside Full Video Mode.

## User Stories & Use Cases

- As a learner, I can save the current YouGlish video to `Watch later` without leaving the trainer.
- As a learner, I can enter Full Video Mode immediately from the current result without implicitly saving it.
- As a learner, I see the same ListenToLearn caption area and relevant learning controls while watching the whole video.
- As a learner, I can pause, resume, change speed, expand/fullscreen, repeat the current caption, and navigate through captions already observed in this session.
- As a learner, I can select text in the current caption, translate it, and add it to `To learn`.
- As a learner, I can press `Listen` for the current caption, open the ordinary trainer with my last selected provider, then press Back and return to the same saved video at the saved caption boundary, paused.
- As a learner, I can reload a saved video and accept one YouGlish search while the app restores my last observed caption paused.
- As a learner, I can remove a saved video without deleting phrases or saved clips created from it.
- As a guest, my saved videos and progress remain bounded in this browser.
- As a signed-in user, my saved-video list is account-owned; playback progress remains browser-local in this increment.

## Full Video Control Contract

### Retained

- Play/pause.
- Repeat current caption.
- Previous/next caption within the bounded observed-caption history.
- Playback speed.
- Expand/fullscreen.
- Current caption text and text selection.
- Translate selected/current text.
- `To learn`.
- `Listen`.

### Removed

- Replay/return to the original matched phrase.
- Previous/next YouGlish result video.
- `Save clip` and saved-example browsing.
- Random/ordered result controls.
- Provider switch inside Full Video Mode.

The native YouGlish/YouTube controls may remain where the widget itself owns them, but the ListenToLearn toolbar must follow this contract.

## Saved Data Contract

Each saved video must retain enough information for a deterministic restore attempt:

```text
videoId             canonical YouTube video ID
originalQuery       exact query that produced the saved YouGlish result
language            YouGlish language used for the result
accent              YouGlish accent/filter value when present
originPhraseId      optional ListenToLearn phrase reference
originCaption       caption visible when the video was saved
resumeTime          browser-local playback position in seconds for warm resume/display
resumeCaptionId     last observed YouGlish caption identifier
resumeCaptionText   last observed caption text used as the cold restore query
createdAt/updatedAt persistence metadata
```

`videoId` is the uniqueness key. Saving the same video again refreshes non-empty restore/origin metadata, including `originalQuery`, rather than creating a duplicate. A full transcript is never persisted.

## Restore Contract

### Warm transition

- Keep the existing YouGlish widget and loaded video alive.
- Pause and persist its current position before changing modes.
- Enter Full Video Mode using in-document history state; do not call `widget.fetch`.

### Cold load

- Start the widget with autoplay disabled.
- Fetch once with `resumeCaptionText #videoId`; fall back to `originalQuery #videoId` only when no observed resume caption exists.
- Verify that the loaded video ID matches the saved video.
- Keep playback paused; the real-provider spike confirms that the caption-constrained fetch opens at that caption.
- Cold resume is caption-level, not exact to the saved second.

If the video is not returned or the provider reports an error/quota limit, keep Back/removal available and do not claim an exact-second restore.

## Edge Cases

- Missing current `videoId` or `originalQuery`: disable save/full-video actions and explain why.
- Saved query no longer returns the video: keep the saved card and offer fallback/remove actions.
- Wrong video returned by the constrained fetch: do not reveal it as a successful restore.
- Missing resume-caption metadata: fall back to the original query and label the result as the original discovery point.
- Resume position is negative, non-finite, implausibly large, or at completion: normalize to zero.
- Duplicate save from a different phrase/query: retain one video and refresh latest valid restore context.
- Browser storage unavailable or malformed: keep viewing usable, start from zero, and show a non-blocking message.
- Caption history contains only the current caption: disable Previous/Next until another caption is observed.
- Caption callbacks stop during continuous playback: retain basic playback and show that learning controls are temporarily unavailable.
- Browser Back during restore: cancel/ignore stale callbacks and return to the prior history entry.

## Success Criteria

- Saving from YouGlish persists `videoId`, exact `originalQuery`, language/accent and origin caption.
- Warm entry into Full Video Mode reuses the live widget and performs zero new YouGlish searches.
- Cold entry performs no more than one `widget.fetch` and never refetches as captions change.
- A successful cold restore reveals the widget paused at the beginning of the last observed caption; warm Back restores the exact live position.
- Current captions continue updating during long-form playback and drive Repeat, selection, Translate, `To learn`, and `Listen`.
- `Listen` persists position before navigation; Back restores the same Full Video Mode state and does not autoplay.
- The Full Video toolbar contains the retained controls and none of the removed controls.
- No full transcript or unofficial YouTube caption endpoint is used.
- Guest/account ownership, deduplication, removal, storage bounds and existing saved-clip behavior remain correct.
- Targeted tests, TypeScript, lint, build, lifecycle lint and manual provider smoke pass before merge.

## Constraints & Assumptions

- YouGlish remains the playback/caption provider in Full Video Mode; YouTube remains the underlying media source.
- The same trainer document must own warm mode changes. `/videos` is a route/state representation, not a reason to destroy the active widget.
- The documented widget API does not provide an absolute seek/load-by-video contract. The current integration's caption `current_time` field and `move(delta)` behavior are provider-dependent and must be proven before implementation is accepted.
- Planning assumes one cold restore consumes one YouGlish search. Playback controls and caption callbacks must not create additional searches.
- The product must tolerate YouGlish quota/provider failure and never describe this flow as offline viewing.
- Saved-video list persistence remains D1 for signed-in users and bounded `localStorage` for guests. Resume remains browser-local.

## Required Provider Spike

Implementation is blocked until a real-widget spike answers all three questions:

1. Does the first cold-fetch `onCaptionChange` reliably expose a numeric timestamp for the loaded match?
2. Does `widget.move(resumeTime - loadedTime)` reliably restore short and long timestamps while paused?
3. Do caption-change callbacks continue for the whole video rather than only the original matched segment?

Failure of any answer returns the feature to design; it must not be hidden by automated fakes.

### Spike result — 2026-08-25

- The constrained fetch returned the expected video, but its first caption callback had `current_time = null`.
- `move(delta)` reached a 2400-second target within about 1.1 seconds and caption callbacks continued, but only after playback had started.
- Chrome blocked programmatic cold autoplay; a move issued before active playback did not persist an exact paused seek.
- A one-fetch query built from the last observed caption plus `#videoId` restored the expected video and exact saved caption paused, without transcript access.

Exact paused second-level cold restore therefore failed the provider gate. The approved contract is cold resume at the beginning of the last observed caption. This normally differs by only the remainder of one caption.

## Questions & Deferred Items

No material product question remains. Direct URL import, cross-device progress, full observed-history persistence, exact-second cold restore and richer video metadata remain deferred.

---
phase: requirements
title: Automatic Video History Requirements
description: Keep the full-video action aligned and make long-form viewing resumable without a separate Watch Later step
---

# Automatic Video History Requirements

## Problem Statement

The trainer needs to distinguish a guided phrase example from continuous viewing
without telling the learner to “watch video” while a video is already visible.
The CTA must remain close to `Save clip`, while redundant expand/collapse chrome
must not consume a separate row above a full-width player.

## Goals & Objectives

- Label the source chooser `Phrase example` and the transition `Continue in video`.
- Place `Continue in video` beside `Save clip` in the example-action group.
- Remove Expand/Collapse now that the provider media already uses the full width.
- Remove the built-in YouGlish title and control panel because the trainer owns
  the equivalent context and playback controls.
- Put accent selection in the trainer toolbar for YouGlish (`All`, `US`, `UK`,
  `AUS`). Replace numeric speed buttons with one turtle-icon Slow toggle that
  switches between `1×` and `0.75×`.
- Keep the example filters and actions aligned at supported desktop and mobile widths.
- Automatically add or refresh a video in history only when the learner chooses `Continue in video`.
- Repurpose `/videos` as a first-class `Videos` / `Continue watching` section.
- Preserve deduplication, resume metadata, guest/account ownership and removal.

### Non-goals

- Recording every YouGlish search result or short clip as history.
- Keeping separate `History` and `Watch later` collections in this MVP.
- Pinning, folders, tags, cross-device playback position or transcript storage.
- Changing Full Video caption, translation, `Listen`, `To learn` or resume behavior.

## User Stories & Use Cases

- As a learner, I understand that I am practicing a `Phrase example` and can
  choose `Continue in video` beside `Save clip` to leave the bounded example.
- As a learner, opening Full Video Mode automatically makes that video available under `Continue watching`.
- As a learner, repeatedly opening the same video refreshes one history item instead of creating duplicates.
- As a learner, I can resume or remove a history item from `/videos`.
- As a learner browsing ordinary YouGlish results, I do not accumulate history until I explicitly enter Full Video Mode.

## Success Criteria

- `Watch later` is absent from the trainer.
- `Continue in video` is beside `Save clip`; no media header or Expand/Collapse
  control remains.
- At mobile widths, `Continue in video` remains a labelled horizontal action,
  not an oversized icon-only square.
- Mobile filters and actions use the same two equal-width columns and 44px height.
- The action is hidden until the current YouGlish result has a valid video ID.
- For Tatoeba, `Save clip` spans the complete action row; no empty CTA column remains.
- A saved example names the available action as `Remove clip` or `Remove track`,
  rather than showing the ambiguous state label `Saved`.
- The embedded YouGlish surface contains neither its title component nor its
  duplicate control-button panel.
- The accent selector is hidden for Tatoeba and Full Video Mode; the Slow toggle
  remains available and exposes its pressed state accessibly.
- Clicking `Continue in video` first upserts the current video and then enters Full Video Mode using the existing warm transition.
- Guest and account history use the existing bounded video persistence and remain deduplicated by `videoId`.
- `/videos` is titled `Videos`, its main section is `Continue watching`, and cards remain ordered by most recent `updatedAt`.
- Existing Full Video controls, resume and phrase/clip behavior continue to pass regression tests.

## Constraints & Assumptions

- A history entry is created on the deliberate `Continue in video` action, even if the learner immediately navigates back.
- The existing `savedVideos` storage/API schema is reused; labels and write semantics change without a migration.
- If persistence fails, the warm Full Video transition still proceeds and shows a non-blocking persistence error.
- Guest history stays browser-local; account history remains D1 subject-scoped; playback progress stays browser-local.

## Questions & Open Items

No material open question remains. A separate pinned `Watch later` collection is deferred until observed demand.

---
phase: requirements
title: Automatic Video History Requirements
description: Keep the full-video action aligned and make long-form viewing resumable without a separate Watch Later step
---

# Automatic Video History Requirements

## Problem Statement

Adding `Watch full video` to the trainer's example-action row introduced a third action that wraps onto another line and visually displaces the example filters. The current `/videos` page also depends on a separate `Watch later` action, so a learner who deliberately enters Full Video Mode can still forget to save the video and lose the obvious path back to it.

## Goals & Objectives

- Place `Watch full video` with the current media controls, not with clip/filter controls.
- Keep the example filters and actions aligned at supported desktop and mobile widths.
- Automatically add or refresh a video in history only when the learner chooses `Watch full video`.
- Repurpose `/videos` as a first-class `Videos` / `Continue watching` section.
- Preserve deduplication, resume metadata, guest/account ownership and removal.

### Non-goals

- Recording every YouGlish search result or short clip as history.
- Keeping separate `History` and `Watch later` collections in this MVP.
- Pinning, folders, tags, cross-device playback position or transcript storage.
- Changing Full Video caption, translation, `Listen`, `To learn` or resume behavior.

## User Stories & Use Cases

- As a learner, I can choose `Watch full video` beside the current player without disturbing example filters.
- As a learner, opening Full Video Mode automatically makes that video available under `Continue watching`.
- As a learner, repeatedly opening the same video refreshes one history item instead of creating duplicates.
- As a learner, I can resume or remove a history item from `/videos`.
- As a learner browsing ordinary YouGlish results, I do not accumulate history until I explicitly enter Full Video Mode.

## Success Criteria

- `Watch later` is absent from the trainer.
- `Watch full video` is in the media-panel header, left of `Expand`, and does not change the height/alignment of the example settings row.
- Clicking `Watch full video` first upserts the current video and then enters Full Video Mode using the existing warm transition.
- Guest and account history use the existing bounded video persistence and remain deduplicated by `videoId`.
- `/videos` is titled `Videos`, its main section is `Continue watching`, and cards remain ordered by most recent `updatedAt`.
- Existing Full Video controls, resume and phrase/clip behavior continue to pass regression tests.

## Constraints & Assumptions

- A history entry is created on the deliberate `Watch full video` action, even if the learner immediately navigates back.
- The existing `savedVideos` storage/API schema is reused; labels and write semantics change without a migration.
- If persistence fails, the warm Full Video transition still proceeds and shows a non-blocking persistence error.
- Guest history stays browser-local; account history remains D1 subject-scoped; playback progress stays browser-local.

## Questions & Open Items

No material open question remains. A separate pinned `Watch later` collection is deferred until observed demand.

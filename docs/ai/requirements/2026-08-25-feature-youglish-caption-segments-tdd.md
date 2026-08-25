---
phase: requirements
title: Requirements & Problem Understanding
description: Clarify the problem space, gather requirements, and define success criteria
---

# Requirements & Problem Understanding

## Problem Statement

The trainer records YouGlish captions only for the active video and clears them
on every `onVideoChange`. Replay can therefore return the provider to the first
caption while the trainer forgets already observed forward captions. Returning
to a previous video also loses its history. A manual seek inside the iframe can
add a caption many minutes away to the same flat timeline, causing Previous or
Next to cross a large unobserved gap.

## Goals & Objectives

- Keep observed caption history independently for each YouGlish video in the
  current query/result session.
- Keep Previous and Next limited to already observed captions in the active
  contiguous playback segment.
- Synchronize the active caption after Replay, provider callbacks, and manual
  iframe seeks without deleting cached captions.
- Preserve paused playback when Replay was requested while paused.
- Retain the first caption even when it has no provider timestamp and preserve a
  safe way to reach its known next caption.

Non-goals:

- No complete transcript discovery, scraping, polling, D1 storage, or
  localStorage persistence.
- No navigation to captions that have never been observed.
- No caption navigation for Tatoeba.
- No deployment, commit, push, or production rollout in this implementation
  phase.

## User Stories & Use Cases

- With one observed caption, both directions are disabled.
- With captions `[1, 2]`, caption 2 enables only Previous; returning to caption
  1 enables only Next.
- With `[1, 2, 3]`, caption 2 enables both directions and each click moves one
  observed caption.
- Replay from caption 2 returns to caption 1 while keeping captions 2 and 3
  available.
- Switching `video A -> video B -> video A` restores A's observed history.
- A duplicate same-video `onVideoChange` does not erase history.
- A manual seek from around 10:00 to around 30:00 starts another active segment;
  caption controls never jump across that gap.
- Seeking to a known caption or a new time inside an existing segment reactivates
  or extends that segment.
- Changing the active caption outside Repeat disables Repeat for the old caption.

## Success Criteria

- The browser-contract tests in `tests/youglish-caption-navigation.test.mjs`
  pass.
- Replay retains cached forward navigation, including a timestamp-less first
  caption, and restores pause when required.
- Caption histories are isolated by current query session and video ID.
- Previous/Next return only neighbors from the active segment.
- Distant unexpected caption time changes create a segment boundary; known IDs
  and times inside a known range select that segment.
- All pre-existing tests, build, TypeScript, lint, and diff checks remain green.

## Constraints & Assumptions

- YouGlish caption IDs are opaque and timestamps are an optional, undocumented
  provider capability.
- The cross-origin iframe cannot be inspected for slider movements. Manual seeks
  must be inferred from caption ID/timing discontinuity.
- A conservative extra segment is preferable to a wrong multi-minute jump.
- Histories last only for the active query/result session and page lifetime.
- Buttons remain visible but disabled when no safe observed target exists.

## Questions & Open Items

No material product questions remain. The accepted provider risk is that missing
timing may require controlled playback to a known caption rather than a direct
relative seek.

---
phase: implementation
title: YouGlish Repeat Loop Fix
description: Implementation record for the sticky, drift-free caption Repeat toggle in the Trainer
---

# YouGlish Repeat Loop Fix

## Problem

Live traces (`captionTrace=1`) showed the Repeat loop degrading within a few
cycles until only the last half second of a caption was replayed, and the
toggle switching itself off after the loop drifted into the next caption or
onto another video.

The same-widget fetch approach from 2026-08-29 (pause, re-search the caption
text in the same widget, then loop it with native `replay()`) reloaded the clip
inside the frame on every retarget and switched the toggle off whenever the
search, the pause, or the video confirmation failed. This change replaces it;
the trainer no longer issues a fetch for Repeat.

Two provider facts drove the redesign:

- YouGlish reports the end of caption N as `onCaptionConsumed(N)` followed
  about 0.1 ms later by `onCaptionChange(N + 1)` that carries `current_time`.
- `widget.move(delta)` is applied relative to the player position at the moment
  the iframe processes the command. The previous `move(-elapsed)` return was
  therefore off by the command latency on every cycle, and the offset
  accumulated because the next cycle measured elapsed time from the drifted
  landing point.

## Changes

- `public/trainer.html`
  - The Repeat toggle is a pure user preference. Nothing in the trainer turns
    it off: video changes, missing timestamps, navigation failures, source or
    query resets, and player errors only clear the in-flight cycle.
  - The looped caption is always the caption shown to the user; Previous, Next,
    and Replay retarget the loop by changing the visible caption.
  - `onCaptionConsumed(N)` arms a cycle. The following caption callback is
    intercepted: the caption is cached as the next neighbor without changing
    the visible caption, and the return seek is computed as
    `(start(N) - lead-in) - current_time`, an absolute anchor that cannot drift.
  - An untimed first caption of a clip is looped with `widget.replay()`.
  - Landing shortly before the target waits for the caption to arrive; an
    unexpected landing is corrected at most twice, then the loop follows the
    caption that is actually playing. A timed fallback covers a consumed
    callback that is not followed by a caption callback.
  - The seek lag is measured, not configured: each return records where it
    aimed and where the first callback after it reported the player, and the
    averaged difference is added to the lead-in of later returns.
  - An untimed first caption gets a derived start once the transition to the
    next caption is observed during playback: next start minus the measured
    duration. Repeat then loops it with the same anchored `move`, so the
    provider keeps emitting consistent boundary callbacks. `widget.replay()`
    remains only as the fallback while no duration has been measured (after a
    native replay YouGlish skipped the following boundary callback in live
    traces, which let the loop slip to a later caption).
  - A caption first observed in mid-flight (after a seek) keeps its start only
    until an earlier observation arrives; the natural transition into the
    caption is better evidence and lowers the cached start.
  - The return is issued a short tail after the switch to the next caption so
    the last word survives subtitles that switch early. Both margins (lead-in
    0.4 s, tail 0.25 s) are uniform policy for the gap between subtitle timing
    and speech, which no provider signal exposes; they are not tuned per phrase.
  - A known caption observed again at a later position keeps its cached start
    but anchors the playback estimate to the reported position.
  - The local trace records `repeat.*` events, the loop state, and the
    calibrated seek lag.
- `public/caption-navigation.js`: `repeatReturnDelta(start, position, leadIn)`.

## Status

Complete. Verified against the live widget on localhost: repeated cycles land
at the same position at the caption start, the visible caption never changes
during a cycle, and the toggle stays pressed across videos.

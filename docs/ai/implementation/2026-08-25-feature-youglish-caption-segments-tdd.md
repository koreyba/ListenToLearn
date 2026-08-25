---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Development Setup

- Worktree: `.worktrees/feature-youglish-caption-segments-tdd`.
- Branch: `codex/youglish-caption-segments-tdd`, rebased onto `origin/main` at
  `a47c8a9`.
- Dependencies: `npm ci`, then JSDOM added as a test-only dependency.
- Task tracing is unavailable: `npx ai-devkit@latest task ...` reports
  `unknown command 'task'`.

## Code Structure

- `public/caption-navigation.js`: pure time, segment resolution, timeline upsert,
  segment-scoped neighbor, and seek-delta helpers.
- `public/trainer.html`: query-session/per-video controller and widget callbacks.
- `tests/caption-segments.test.mjs`: deterministic pure helper contract.
- `tests/youglish-caption-navigation.test.mjs`: real inline controller under
  JSDOM with fake `YG.Widget`.

## Implementation Notes

### Completed: segment helper

- `resolveSegment` retains a known caption's segment, places new times inside a
  known range, extends the active segment within 30 seconds, and otherwise
  allocates a new segment ID.
- `neighbors` and `adjacent` accept an optional segment ID while retaining the
  previous call contract when omitted.
- Focused proof: `node --test tests/caption-segments.test.mjs` passed 5/5 after
  the new tests first failed on the missing behavior.

### Completed: controller integration

- `captionVideoStates` stores independent history, cursor, active segment, and
  sequence values for each video in the active query session.
- Every caption is resolved into a segment before timeline upsert; buttons and
  movement use only active-segment neighbors.
- Replay uses the first observed caption ID as a pending confirmation target,
  retains forward history, and restores the paused state after confirmation.
- A timestamp-less Replay target reaches its already cached next caption through
  controlled playback, then pauses at the matching callback when required.
- Failed `play` and Replay commands clear pending intent immediately.
- Saved-example playback waits for the provider's `onVideoChange` event before
  switching video state, avoiding attribution of the old history to a new ID.

### Completed: live provider-state race

- A local-only, query-enabled recorder stores sanitized widget commands,
  provider events, and caption-navigation state without raw caption/video data.
- The captured `next-during-provider-state-race` fixture now drives the browser
  regression sequence `PAUSED -> BUFFERING -> PLAYING -> target caption`.
- Explicit user playback intent is separate from raw provider state. Controlled
  Next survives transient state callbacks, emits at most one required `play`,
  restores pause at its target, and expires after 20 seconds if unconfirmed.
- Replay is never disabled by controlled Next; activating it cancels the target
  intent and starts normal Replay synchronization.
- Waiting for a target does not add a visible status line or replace the current
  caption text.

### Completed: Replay acceleration hypothesis test

- The local-only trace now records sanitized `onCaptionConsumed` and playback
  speed signals. Raw caption text, provider IDs, and video IDs remain excluded.
- Three live examples showed that active playback duration is repeatable within
  roughly 0.20-0.24 seconds, including after conversion from 0.75x wall time.
- A duration-based `move()` skipped the cached B caption in two live attempts,
  both when sent before playback and after `PLAYING`.
- Treating Replay `current_time` as a separate playhead cursor reached the exact
  B callback and restored pause, but still replayed the whole A-to-B interval;
  it did not improve latency.
- Both acceleration experiments and their provisional tests were removed. The
  safe controlled-playback behavior remains unchanged.
- The official YouGlish Widget API documents only relative `move(seconds)` and
  exposes neither absolute seek nor a current-position getter:
  <https://youglish.com/api/doc/js-api>.

### Implemented: symmetric untimed-edge navigation

- A clean uninterrupted natural `A -> B` transition records media-time distance
  on untimed A without assigning it an absolute timestamp.
- Previous from B uses `move(-(edge + elapsedInB))`; Next from A uses
  `move(edge - elapsedInA)`. Both commands reuse one measured edge and preserve
  the stable cached order.
- Player-state discontinuities and video switches invalidate measurement.
  Reduced speed is converted from wall time to media time.
- An edge records its target caption ID and is used only while that caption is
  still the immediate cached neighbor. Skipped or newly inserted neighbors
  cannot overwrite or reuse the wrong distance.
- Missing or unsafe measurements retain the existing Replay and controlled-play
  path. The local trace exposes only numeric `nextOffsetSeconds`, never raw
  caption text or provider IDs.
- The deterministic contract, mutation proof, and exact-caption live smoke pass.

### Fixed: live first-caption event ordering

- A captured live trace showed the first caption callback arriving before
  `UNSTARTED -> BUFFERING -> PLAYING`. The original learned-edge contract assumed
  `PLAYING` arrived first, so no offset was recorded and Next fell back to a
  controlled target.
- Entering `PLAYING` with untimed A now resets A's observation point and
  continuity token. B measures only the uninterrupted media interval after that
  transition; buffering followed by another `PLAYING` safely restarts it.
- An explicit user Pause clears a controlled target and its timer. Provider
  pause/buffer callbacks remain observations and do not cancel the target.
- Both live-order regressions have focused RED -> GREEN and independent mutation
  proof.
- The post-fix live cycle learned `A -> B = 5.0125s`, issued
  `move(-5.079)` and `move(+4.949)`, confirmed exact A and B callbacks, and never
  entered controlled fallback.

## Integration Points

The YouGlish widget remains the only media provider. No server, database,
authentication, saved-example API, or Tatoeba changes are required.

## Error Handling

Missing timing never produces an invented fixed seek. Movement errors retain
the existing fail-closed blocked direction behavior. Controlled-playback and
Replay failures clear pending intent so controls and later callbacks stay safe.

## Performance Considerations

All state is page-local. Segment scans are bounded by captions observed during
the current query session; no polling or network work is added.

## Security Notes

No new secret, external endpoint, iframe inspection, caption scraping, or
persistent provider data is introduced.

## Final Review

- The controller matches the per-query -> per-video -> per-segment design.
- All helper exports have in-repository callers or direct contract tests.
- The new dependency is development-only and `npm ls --depth=0` reports a valid
  dependency tree with `jsdom@29.1.1` on the repository's Node 22.13 baseline.
- No API, schema, persistence, authentication, Worker binding, or Tatoeba
  contract changes were introduced.
- No blocking or important code-review findings remain.

---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Development Setup

- Worktree: `feature-phrase-navigation`, initially based on the merged MVP
  commit `b6c357108cc3d605438a12b389f20fb87e1e5359`; the Google-auth base now
  exists on `origin/main` as `3b607bf` and must be synchronized before push.
- Dependencies were installed with `npm ci`.
- Repository checks are `npm test`, `npx tsc --noEmit`, `npm run lint`,
  `git diff --check`, and `npx ai-devkit@latest lint --feature
  phrase-navigation`.
- The branch remains local until the post-sync gates pass. The adjacent
  Google-auth task is now merged, satisfying the user's push condition.

## Code Structure

- `public/caption-navigation.js`: small browser-safe pure helper module for
  finite timing validation, idempotent timeline upserts, adjacent lookup, and
  repeat/relative seek delta calculations.
- `public/trainer.html`: existing trainer controller, YouGlish event wiring,
  controls, asynchronous navigation state, and provider fallback UI.
- `tests/rendered-html.test.mjs`: rendered-source contracts, inline-script
  syntax validation, and deterministic helper tests.

## Implementation Notes

### Caption timeline

- `onCaptionChange` accepts an opaque provider `id` and only records an entry
  when `current_time` is finite and non-negative.
- Entries are scoped to the current YouGlish video, sorted by start time, and
  updated idempotently when the same ID is observed again.
- Player-state transitions retain the last known in-caption time across a pause,
  so a cached target does not assume the user paused exactly at the caption
  start.
- The timeline is cleared on query/source/saved-example/video changes. Timing
  and caption text are never persisted to localStorage or D1.

### Previous/next navigation

- A cached neighbor is reached with a relative `widget.move(delta)` derived
  from observed start times, then confirmed by the expected caption ID.
- An unobserved neighbor is discovered by paused, bounded `0.5` second moves;
  it stops at the first different caption event with a valid timestamp.
- One navigation may be in flight. Waiters have a timeout, and a token makes
  reset/source/video changes invalidate stale asynchronous results.
- The controls never call `widget.previous()`/`widget.next()` and never treat
  a fixed five-second rewind as phrase navigation.
- If no target event is confirmed, the corresponding direction is blocked until
  a fresh caption observation resets the boundary state.

### Repeat current caption

- `Повтор фразы` is a native toggle with `aria-pressed`.
- `onCaptionConsumed` is accepted only for the active opaque caption ID. The
  seek-back delta prefers the elapsed time estimate from `observedAt` and
  playback state, then a known next-caption interval, then a minimum bounded
  fallback.
- An unexpected caption ID, missing timing, failed movement, reset, or an
  overlapping navigation disables repeat and leaves a visible status message.
- Repeat never schedules an unbounded timer and never changes the YouGlish video
  track.

## Integration Points

- The helper script is loaded before the existing inline trainer controller.
- YouGlish remains an embedded cross-origin widget; the implementation uses
  only `move`, caption events, player state, and existing track controls.
- Tatoeba keeps its existing audio-track controls and does not enable timed
  caption actions.
- No server route, database schema, binding, secret, or auth behavior changed.

## Error Handling

- Missing helper, missing `move`, missing/invalid `current_time`, or provider
  event drift leaves phrase controls disabled with an explicit explanation.
- Movement exceptions are caught, pending waiters are cleared, and repeat is
  disabled rather than retried indefinitely.
- Caption navigation status is updated only after a verified target or bounded
  failure; existing video navigation remains available independently.

## Performance Considerations

- Idle playback has no polling or interval.
- Discovery is limited to 80 half-second steps and 2.5 seconds per command.
- Timeline data is kept only for the active video and is bounded by observed
  caption events.

## Security Notes

- No provider credentials, OAuth material, or new network endpoint was added.
- The implementation does not inspect the cross-origin iframe or call private
  YouGlish endpoints.

## Known Provider Boundary

`current_time` is observed in the current widget build but is not listed as a
stable property in the public YouGlish API documentation. If the provider stops
forwarding usable timing or changes event ordering, exact controls fail closed;
the branch does not claim a provider-level guarantee.

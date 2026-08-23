---
phase: requirements
title: Requirements & Problem Understanding
description: Clarify the problem space, gather requirements, and define success criteria
---

# Requirements & Problem Understanding

## Problem Statement

The merged MVP already receives YouGlish caption chunks and displays the current
caption, but its `Previous phrase` and `Next phrase` controls are disabled unless
the provider exposes undocumented caption-navigation methods. The documented
YouGlish API exposes second-based movement and previous/next video-track
movement, not a caption seek operation. A five-second rewind therefore cannot be
represented as an exact phrase transition.

The target user needs to stay in the current video and move one caption at a
time while listening. They also need an optional repeat mode for the current
caption. The feature must fail closed when the provider does not expose enough
timing information instead of silently providing an approximation.

Verified baseline on 2026-08-23:

- `public/trainer.html` receives `onCaptionChange` events with `caption` and `id`.
- The current official `widget.js` build also forwards `current_time` on that
  event, although the public API documentation does not list this property.
- The documented API provides `widget.move(seconds)`, `widget.next()`,
  `widget.previous()`, `widget.replay()`, and caption events; it does not
  document `previousCaption` or `nextCaption` methods.
- Tatoeba has audio-track navigation, not timed caption navigation, and is out
  of scope for this feature.

## Goals & Objectives

### Goals

- Add reliable YouGlish-only previous-caption and next-caption navigation inside
  the current video.
- Add a toggle that repeats the current YouGlish caption until disabled or until
  the current video/query changes.
- Keep video-track navigation separate from caption navigation.
- Serialize navigation commands, verify the caption event reached the requested
  target, and prevent stale asynchronous commands from changing the UI.
- Keep the existing public trainer, examples, saved-example flow, and auth/data
  boundaries unchanged.

### Non-goals

- No D1/API/schema changes.
- No scraping or proxying of YouGlish's private `/fetchcap.jsp` or iframe DOM.
- No claim that a fixed `move(-5)` is a phrase transition.
- No caption navigation for Tatoeba audio.
- No replacement of the YouGlish widget with a separately hosted YouTube player.

## User Stories & Use Cases

- As a learner, I can press `Предыдущая фраза` to move to the previous observed
  caption in the same YouGlish video.
- As a learner, I can press `Следующая фраза` to move to the next caption in the
  same video; if it has not been observed yet, the client performs a bounded,
  verified step search using the provider's movement API.
- As a learner, I can enable `Повтор фразы` and hear the current caption again
  when it is consumed; disabling it lets playback continue normally.
- As a learner, I see disabled controls and an honest explanation when the
  provider does not supply a usable caption timestamp.
- At the first/last reachable caption, the corresponding control is disabled or
  reports a bounded navigation failure without changing video tracks.
- Switching source, query, saved example, or video resets caption history,
  repeat state, pending commands, and navigation affordances.

## Success Criteria

- With timing-bearing `onCaptionChange` events, previous/next navigation lands on
  a different caption ID in the same video and does not call `widget.next()` or
  `widget.previous()`.
- Navigation controls are disabled while a seek command is pending; a timeout
  or unexpected caption ID restores a consistent state and shows an actionable
  status message.
- Repeat requests the same caption ID, does not change the video, and does not
  create overlapping timers or navigation loops. Turning repeat off prevents
  the next repeat action.
- When `current_time` is missing/invalid or the widget lacks `move`, the feature
  remains visibly unavailable; no `-5`-second fallback is labelled as phrase
  navigation.
- Existing `tests/rendered-html.test.mjs`, TypeScript, lint, build, and diff
  checks remain green; new tests cover timing detection, boundaries, stale
  command cancellation, and repeat-off behavior.
- Manual desktop/mobile smoke testing confirms keyboard-accessible controls,
  clear pressed/disabled states, and no regression of video navigation or
  caption translation actions.

## Constraints & Assumptions

- The implementation runs entirely in the browser around the existing
  cross-origin YouGlish widget; the iframe cannot be inspected directly.
- `current_time` is treated as an optional provider capability, not a guaranteed
  public contract. The UI must feature-detect it on every caption event.
- Caption IDs are treated as opaque strings. Ordering comes from observed
  events/history, not from numeric comparison.
- `widget.move(seconds)` is the only supported movement primitive available for
  local seeking. Movement must be bounded and confirmed by a caption event.
- The user explicitly permits local development now, but this branch must not be
  pushed until the neighboring Google-auth task has merged; the already merged
  MVP is the base.

## Alternatives Considered

- Fixed five-second movement: simple, but cannot guarantee one-caption movement
  and would mislead the learner. Rejected.
- Scrape private YouGlish endpoints or iframe internals: may expose richer
  timings, but is cross-origin/undocumented and can break without notice.
  Rejected for the production path.
- Timing-aware client state machine with a fail-closed fallback: uses only the
  public widget movement/events, verifies outcomes, and degrades honestly.
  Recommended.

## Questions & Open Items

No material product decision remains open for this implementation. The only
accepted external risk is provider drift: if YouGlish stops forwarding usable
`current_time` values, the controls will disable until a supported timing
contract is available.

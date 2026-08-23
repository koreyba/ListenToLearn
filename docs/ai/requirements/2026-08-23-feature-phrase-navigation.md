---
phase: requirements
title: Requirements & Problem Understanding
description: Clarify the problem space, gather requirements, and define success criteria
---

# Requirements & Problem Understanding

## Problem Statement

The merged MVP receives YouGlish caption chunks and keeps observed captions in a
per-video in-memory timeline, but its cached navigation path still waits for a
fresh `onCaptionChange` event after `widget.move()`. When the learner returns to
an already observed previous caption, YouGlish may not emit that event again, so
the UI stays busy until the navigation timeout. An unobserved neighbor cannot be
reliably addressed from the documented API and stays unavailable until normal
playback observes it.

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
  of scope for this feature. Its timed phrase-navigation group and phrase
  repeat control are hidden when Tatoeba is selected.

## Goals & Objectives

### Goals

- Add reliable YouGlish-only previous-caption and next-caption navigation inside
  the current video for captions already observed in the current video.
- Add a toggle that repeats the current YouGlish caption until disabled or until
  the current video/query changes.
- Keep video-track navigation separate from caption navigation.
- Serialize navigation commands, update cached targets immediately, and let
  later caption events reconcile the UI without blocking known navigation.
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
  same video when it has already been observed; an unknown neighbor stays
  disabled until normal playback observes it.
- As a learner, I can enable `Повтор фразы` and hear the current caption again
  when it is consumed; disabling it lets playback continue normally.
- As a learner using Tatoeba, I see only whole-track navigation; timed phrase
  controls are not shown because the source has no timed caption chunks.
- As a learner, I see disabled controls and an honest explanation when the
  YouGlish provider does not supply a usable caption timestamp.
- At the first/last reachable caption, the corresponding control is disabled or
  reports a bounded navigation failure without changing video tracks.
- Switching source, query, saved example, or video resets caption history,
  repeat state, pending commands, and navigation affordances.

## Success Criteria

- With timing-bearing `onCaptionChange` events, previous/next navigation lands on
  a cached different caption ID in the same video, updates the visible caption
  immediately, and does not call `widget.next()` or `widget.previous()`.
- A direction is disabled when its adjacent caption is not in the local timeline;
  a movement exception restores a consistent state and shows an actionable
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
  local seeking. For a cached target, the client uses the known timing and
  updates its local caption immediately; a later provider event can reconcile
  the display. Unknown neighbors are not discovered by blind stepping.
- The already merged MVP, including Google auth, is the base. Push remains a
  separate review/publish step after fresh validation.

## Alternatives Considered

- Fixed five-second movement: simple, but cannot guarantee one-caption movement
  and would mislead the learner. Rejected.
- Scrape private YouGlish endpoints or iframe internals: may expose richer
  timings, but is cross-origin/undocumented and can break without notice.
  Rejected for the production path.
- Timing-aware client state machine with a local cached-target fast path and a
  fail-closed boundary for unknown neighbors: uses only the public widget
  movement/events and degrades honestly. Recommended.

## Questions & Open Items

No material product decision remains open for this implementation. The only
accepted external risk is provider drift: if YouGlish stops forwarding usable
`current_time` values, the controls will disable until a supported timing
contract is available.

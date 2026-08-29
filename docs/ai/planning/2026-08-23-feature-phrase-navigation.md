---
phase: planning
title: Project Planning & Task Breakdown
description: Break down work into actionable tasks and estimate timeline
---

# Project Planning & Task Breakdown

## Milestones

- [x] M1 — Timing capability and caption timeline are implemented and covered by
  deterministic tests.
- [x] M2 — Previous/next phrase navigation is serialized, cache-aware, and
  separate from video navigation.
- [x] M3 — Repeat-current-caption is toggleable, verified across cycles, and
  fails closed on provider drift.
- [ ] M4 — Regression gates and desktop/mobile smoke evidence are complete;
  branch is ready to synchronize after review.

## Task Breakdown

### Phase 1: Foundation

- [x] T1.1 Add a `Повтор фразы` control with accessible pressed/disabled states
  and wire `onCaptionConsumed`/`onPlayerStateChange` events. Outcome: UI and
  provider events have an explicit contract. Depends on no code task; validate
  with rendered-source test and inline-script parse.
- [x] T1.2 Replace the method-presence caption stub with timing capability
  detection and a per-video timeline keyed by opaque ID and `current_time`.
  Outcome: duplicate events are idempotent and unsupported timing disables the
  feature. Validate with missing/invalid timing fixtures.

### Phase 2: Core Features

- [x] T2.1 Implement cached previous/next navigation using a known target
  caption and a synchronous local state update after the relative move. Outcome:
  no track change, no wait for a duplicate callback, and boundary-safe controls.
  Validate with cached-neighbor and movement-error cases.
- [x] T2.2 Keep an unobserved adjacent caption unavailable. Outcome: next and
  previous do not start a blind step search or hold the UI in a timeout; normal
  playback enables the direction once the neighbor is observed.
- [x] T2.3 Implement repeat on `onCaptionConsumed` using observed duration or a
  bounded elapsed estimate; keep it enabled and retarget it when the learner
  selects another caption in the same video. Outcome: repeat persists until the
  learner turns it off or playback context resets. Validate repeat-on,
  next-caption, repeat-off, reset, and failure fixtures.
- [x] T2.4 Stabilize long-running repeat by preferring the cached caption
  boundary over callback timing and keeping the target pinned when a provider
  race emits another caption during a pending seek. Validate ten delayed
  playback cycles and a mismatched provider callback.
- [x] T2.5 Replace boundary arithmetic after the live manual-seek failure.
  Reopen a timestamped or manually selected caption as a video-constrained
  native search result through a fresh widget, validate the returned
  video/text, and loop only with `replay()`. Validate the first phrase, timed
  phrases, manual seek, delayed cycles, and the short Replay-confirmation race
  without Repeat `move()` calls.
- [x] T2.6 Replace the temporary page reload transport with widget-only
  lifecycle management. Close the current widget, create a uniquely identified
  generation inside a stable host, and guard every callback by generation.
  Validate an unchanged URL, a replaced mount, stale-event rejection, manual
  seek retargeting, and native replay after exact caption confirmation.
- [x] T2.7 Remove widget replacement from Repeat. Pause the existing player,
  wait for `PAUSED`, fetch a bounded caption search in place, and accept only
  exact callbacks following `onFetchDone`. Validate one widget instance,
  stale-event rejection, playback restoration, manual seek, and fail-closed
  pause timeout.

### Phase 3: Integration & Polish

- [x] T3.1 Reset timeline, pending operations, and repeat on query/source/video/
  saved-example changes; keep Tatoeba whole-track behavior unchanged and hide
  its timed caption controls. Validate integration contracts and existing
  tests.
- [x] T3.2 Update implementation/testing/deployment/monitoring docs with actual
  behavior, provider drift fallback, and live smoke limitations. Validate
  feature-lint and diff check.
- [ ] T3.3 Run typecheck, lint, build, rendered tests, and manual desktop/mobile
  smoke. Record fresh evidence; do not push while either neighboring task is
  unmerged.

## Dependencies

- Initial base was the already merged phrase-navigation commit `e6cc2bf`.
- `current_time` and `move` must be present for exact controls to enable; this
  is an external, optional provider capability.
- Google-auth changes are already included in the `origin/main` base used for
  this fix; synchronize again before final validation/push if main advances.
- No D1 migration, secret, or Cloudflare configuration is needed.

## Sequencing & Evidence

1. T1.1 → T1.2: event contract and timeline before any movement.
2. T2.1 → T2.2: cached fast path before explicit unknown-neighbor boundary.
3. T2.3: repeat reuses the same timing/state guard and must not run in parallel
   with navigation.
4. T3.1 → T3.3: integration reset, docs, and full verification after behavior
   is implemented.

Each implementation task follows TDD: red fixture, minimal green code,
refactor, then fresh verification evidence.

## Risks & Mitigation

- Provider removes `current_time`: feature-detect every event and disable exact
  controls with an honest message.
- `move()` can throw or land across a boundary: one in-flight guard, cached
  target update, and a fail-closed direction after a movement error.
- Repeat target resolution fails or returns another video: verify video ID and
  normalized caption text, use a bounded timeout, and disable Repeat instead of
  falling back to timing arithmetic.
- Same-widget fetch receives callbacks from the previous result: reject all
  repeat-resolution video/caption callbacks until the new `onFetchDone`, then
  require the expected video and full normalized caption.
- Navigation changes the wrong video: assert `videoId` before accepting a
  target; never use track methods for phrase controls.
- Live widget behavior is unavailable in CI: deterministic fake-widget tests
  plus explicit manual smoke evidence; no claim based on static tests alone.

## Resources Needed

- Existing YouGlish widget API and current public trainer.
- Node test runner, TypeScript, ESLint, Vinext build, and Wrangler dry-run.
- A browser session for one live YouGlish timing/repeat smoke check after local
  implementation.
- Documentation/knowledge

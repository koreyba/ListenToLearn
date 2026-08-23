---
phase: planning
title: Project Planning & Task Breakdown
description: Break down work into actionable tasks and estimate timeline
---

# Project Planning & Task Breakdown

## Milestones

- [x] M1 — Timing capability and caption timeline are implemented and covered by
  deterministic tests.
- [x] M2 — Previous/next phrase navigation is serialized, bounded, verified,
  and separate from video navigation.
- [x] M3 — Repeat-current-caption is toggleable, verified across cycles, and
  fails closed on provider drift.
- [ ] M4 — Regression gates and desktop/mobile smoke evidence are complete;
  branch is ready to synchronize only after the Google-auth merge.

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

- [x] T2.1 Implement cached previous/next navigation using a verified target
  caption and serialized operation token. Outcome: no track change, no race,
  boundary-safe controls. Validate with fake widget events and timeout cases.
- [x] T2.2 Implement bounded half-second step search for an unobserved adjacent
  caption. Outcome: next/previous can discover a neighboring chunk without
  pretending fixed five-second movement is exact. Validate max-step and throw
  paths.
- [x] T2.3 Implement repeat on `onCaptionConsumed` using observed duration or a
  bounded elapsed estimate; verify same-ID cycles and disable on an unexpected
  caption. Outcome: repeat can be turned off without a stale loop. Validate
  repeat-on, repeat-off, reset, and failure fixtures.

### Phase 3: Integration & Polish

- [x] T3.1 Reset timeline, pending operations, and repeat on query/source/video/
  saved-example changes; keep Tatoeba audio/video behavior unchanged. Validate
  integration contracts and existing tests.
- [x] T3.2 Update implementation/testing/deployment/monitoring docs with actual
  behavior, provider drift fallback, and live smoke limitations. Validate
  feature-lint and diff check.
- [ ] T3.3 Run typecheck, lint, build, rendered tests, and manual desktop/mobile
  smoke. Record fresh evidence; do not push while either neighboring task is
  unmerged.

## Dependencies

- Initial base was the already merged MVP commit `b6c3571`; Google auth is now
  merged into `origin/main` at `3b607bf` and must be synchronized before push.
- `current_time` and `move` must be present for exact controls to enable; this
  is an external, optional provider capability.
- Google-auth changes are not yet merged into this worktree, but are confirmed
  merged into `origin/main`; synchronize them before final validation/push.
- No D1 migration, secret, or Cloudflare configuration is needed.

## Sequencing & Evidence

1. T1.1 → T1.2: event contract and timeline before any movement.
2. T2.1 → T2.2: verified cached path before bounded discovery fallback.
3. T2.3: repeat reuses the same timing/state guard and must not run in parallel
   with navigation.
4. T3.1 → T3.3: integration reset, docs, and full verification after behavior
   is implemented.

Each implementation task follows TDD: red fixture, minimal green code,
refactor, then fresh verification evidence.

## Risks & Mitigation

- Provider removes `current_time`: feature-detect every event and disable exact
  controls with an honest message.
- `move()` is asynchronous or lands across a boundary: one in-flight token,
  caption-event waiter, timeout, and bounded steps.
- Repeat estimate drifts: prefer observed neighboring start times, verify the
  same ID through the next consumed cycle, and disable on an unexpected ID.
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

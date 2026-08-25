---
phase: planning
title: Project Planning & Task Breakdown
description: Break down work into actionable tasks and estimate timeline
---

# Project Planning & Task Breakdown

## Milestones

- [x] Milestone 1: Agree on behavior and capture the RED browser-contract suite.
- [x] Milestone 2: Implement segment-aware, per-video caption state.
- [x] Milestone 3: Complete Green/Refactor verification and lifecycle review.

## Task Breakdown

### Phase 1: Pure caption state

- [x] T1: Add unit tests for segment identity, range placement, distant splits,
  and segment-scoped neighbors.
  - Outcome: helper behavior is deterministic without DOM/provider state.
  - Depends on: approved design.
  - Validation: focused helper tests fail before and pass after implementation.
- [x] T2: Implement the minimum segment resolver and neighbor filtering in
  `public/caption-navigation.js`.
  - Outcome: no navigation target can cross a video or segment boundary.
  - Depends on: T1.
  - Validation: helper tests and existing opaque-ID/timing tests pass.

### Phase 2: Trainer integration

- [x] T3: Replace the single active history lifecycle with a query-session map
  of per-video states.
  - Outcome: same-video callbacks are idempotent and `A -> B -> A` restores A.
  - Depends on: T2.
  - Validation: per-video RED tests turn green.
- [x] T4: Assign each caption event to a known, in-range, nearby, or new segment
  and render buttons from the active segment only.
  - Outcome: distant manual seeks never create cross-gap navigation.
  - Depends on: T2 and T3.
  - Validation: both distant-segment RED tests turn green.
- [x] T5: Synchronize Replay, preserve pause, and support safe Next from a
  timestamp-less replay target.
  - Outcome: Replay retains cached history and playback intent.
  - Depends on: T3 and T4.
  - Validation: Replay RED tests plus a controlled-playback regression test pass.

### Phase 3: Verification and review

- [x] T6: Refactor names/state transitions without changing behavior.
  - Validation: focused test stays green after every refactor.
- [x] T7: Run full tests, build, TypeScript, lint, AI docs lint, and diff checks;
  update implementation/testing docs with fresh evidence.
- [x] T8: Perform lifecycle code review for behavior, integration risk, security,
  and design alignment; resolve any blocking finding.

## Dependencies

- The deterministic fake widget and RED tests are already present.
- YouGlish live quota/network availability is not required for automated Green.
- No database, Worker binding, or remote deployment dependency exists.
- Task tracing is unavailable because the installed CLI reports
  `unknown command 'task'`.

## Timeline & Estimates

- Pure helper and tests: small.
- Controller integration and Replay fallback: medium and highest risk.
- Verification/review: small after Green.

Work remains within the current implementation session; no delivery date or
remote publication is implied.

## Risks & Mitigation

- Undocumented `current_time`: feature-detect and use controlled playback only
  toward an already observed ID.
- False segment merge: use a conservative 30-second maximum extension and keep
  distant ranges separate.
- Stale per-video state: reset the map on query/source/example-session changes.
- Inline controller complexity: keep placement rules pure and cover integration
  through JSDOM.
- Replay event ordering: use explicit pending target/playback-intent state and
  confirm via provider callbacks.

## Resources Needed

- Existing Node test runner, JSDOM, fake `YG.Widget`, and browser helper module.
- Existing repository build, TypeScript, ESLint, and AI DevKit checks.

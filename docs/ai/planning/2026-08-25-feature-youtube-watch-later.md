---
phase: planning
title: YouGlish Full Video Mode Implementation Plan
description: Revised plan for provider spike, shared widget, caption controls and resumable navigation
---

# YouGlish Full Video Mode Implementation Plan

## Revision Status

The original T1-T15 direct-YouTube implementation is superseded. Revision 2 reuses its bookmark/ownership foundations but replaces native playback with the shared YouGlish trainer and caption-level cold resume.

## Milestones

- [x] R2-M0: Real YouGlish widget spike proves or rejects the timestamp, move and continuous-caption contracts.
- [x] R2-M1: Saved-video persistence contains complete cold-restore metadata and migrates existing data safely.
- [x] R2-M2: A shared trainer shell supports warm/cold Full Video Mode with correct history and request counts.
- [x] R2-M3: The approved caption-learning controls work in Full Video Mode.
- [x] R2-M4: Automated and bounded real-provider verification pass; PR documentation describes only proven behavior and records the quota-limited rerun.

## Task Breakdown

### Phase 0: Provider feasibility gate

- [x] R2-T1: Build a disposable real-widget spike/harness that logs fetch count, video ID, caption text and callback timestamp without storing a transcript.
  - Outcome: provider behavior is observable before architecture implementation.
  - Dependencies: existing YouGlish runtime.
  - Validation: captured manual evidence for one known long video.
  - Covers: TS-P1, TS-P4.
- [x] R2-T2: Verify constrained cold fetch and paused relative movement at zero, short, mid-video and 40+ minute resume targets.
  - Outcome: exact paused cold restore rejected; active move reached 2401.069 for target 2400.
  - Dependencies: R2-T1.
  - Validation: actual callback timestamps before/after `move(delta)`; exactly one fetch per cold attempt.
  - Covers: TS-P1, TS-P2.
- [x] R2-T3: Verify caption callbacks continue beyond the original match during sustained playback and that warm mode changes require no fetch.
  - Outcome: prove current-caption controls can work for the whole viewing session.
  - Dependencies: R2-T1.
  - Validation: bounded timestamped callback sample plus fetch counter.
  - Covers: TS-P3, TS-P4.
- [x] R2-T4: Record the spike decision in requirements/design/testing. Stop and redesign if any cornerstone contract fails.
  - Outcome: no implementation proceeds on fake-only assumptions.
  - Dependencies: R2-T2-R2-T3.
  - Validation: explicit go/no-go result and measured tolerance.
  - Result: caption-level cold resume approved; exact-second cold resume deferred.

### Phase 1: Persistence reconciliation

- [x] R2-T5: Add failing guest/account contract tests for required `originalQuery`, language/accent normalization, duplicate refresh and legacy rows.
  - Outcome: restore metadata and migration policy are executable.
  - Dependencies: R2-T4 go decision.
  - Validation: targeted red tests.
  - Covers: TS-D1-TS-D4.
- [x] R2-T6: Reconcile guest schema, API and additive D1 migration with the R2 saved-data contract.
  - Outcome: every newly saved video is cold-restorable; legacy incomplete rows fail explicitly.
  - Dependencies: R2-T5.
  - Validation: targeted green tests, schema inspection and ownership checks.
- [x] R2-T7: Retain/refactor browser-local progress helpers for YouGlish timestamps and synchronous navigation flush.
  - Outcome: normalized resume state is provider-agnostic and bounded.
  - Dependencies: R2-T5.
  - Validation: progress unit tests including completion and malformed state.

### Phase 2: Shared shell and navigation

- [x] R2-T8: Add failing state-machine/history tests for Result → Full Video → Listen → Back and direct cold `/videos` entry.
  - Outcome: route semantics, no-autoplay and state preservation are locked first.
  - Dependencies: R2-T4.
  - Validation: deterministic controller tests.
  - Covers: TS-N1-TS-N5.
- [x] R2-T9: Refactor the trainer into one widget-owning shell with in-document mode routing and returned-video guards.
  - Outcome: warm transitions and Back reuse one live widget.
  - Dependencies: R2-T8.
  - Validation: warm transition/Back tests report zero additional fetches.
- [x] R2-T10: Replace the native YouTube player/view with the Full Video layout powered by the shared YouGlish widget.
  - Outcome: `/videos` preserves a distinct user view without losing learning UI.
  - Dependencies: R2-T9.
  - Validation: rendered contracts contain approved controls and no primary `YT.Player` implementation.

### Phase 3: Cold restore orchestration

- [x] R2-T11: Add failing tests for query construction, one-fetch limit and returned-video verification under the caption-level contract.
  - Outcome: the restore protocol and failures are deterministic.
  - Dependencies: R2-T4, R2-T6-R2-T7.
  - Validation: red controller tests.
  - Covers: TS-R1-TS-R8.
- [x] R2-T12: Implement paused cold caption-anchor restore and provider error propagation.
  - Outcome: successful reload opens the correct saved caption boundary paused.
  - Dependencies: R2-T11.
  - Validation: green fakes plus real-widget smoke using measured R2-T2 tolerance.
- [x] R2-T13: Keep fetch accounting structural (zero warm, one cold) without logging query/caption content.
  - Outcome: tests and smoke can prove warm=0, cold=1, caption progression=0.
  - Dependencies: R2-T12.
  - Validation: request-count scenarios.

### Phase 4: Caption-learning controls

- [x] R2-T14: Add failing tests for bounded observed-caption history and the Full Video control visibility matrix.
  - Outcome: retained/removed controls and navigation bounds are explicit.
  - Dependencies: R2-T9.
  - Validation: controller/rendered red tests.
  - Covers: TS-C1-TS-C8.
- [x] R2-T15: Implement current caption, bounded history, repeat, previous/next observed caption, speed and expand/fullscreen integration.
  - Outcome: long-form viewing keeps caption-level practice without a transcript.
  - Dependencies: R2-T14.
  - Validation: green unit/rendered tests and provider smoke.
- [x] R2-T16: Implement selection, Translate, `To learn` and `Listen`, including pause/persist/pushState and Back restoration.
  - Outcome: the current caption participates in the existing learning workflow.
  - Dependencies: R2-T15.
  - Validation: integration/state-machine tests and manual Back/Forward smoke.

### Phase 5: Verification and PR reconciliation

- [x] R2-T17: Run targeted tests, TypeScript/build, lint, full tests and lifecycle checks.
  - Outcome: fresh automated regression evidence.
  - Dependencies: R2-T5-R2-T16.
- [ ] R2-T18: Repeat real-provider end-to-end smoke after the daily quota resets; current smoke verified layout/control matrix and quota failure, while the earlier spike verified caption-anchor restore/long callbacks.
  - Outcome: cornerstone behavior is proven outside fakes.
  - Dependencies: R2-T17 and compatible preview runtime.
- [x] R2-T19: Reconcile implementation/testing/deployment/monitoring docs and prepare PR #15 description around R2 scope.
  - Outcome: no direct-player completion claim remains and all known limits are visible.
  - Dependencies: R2-T18.
- [x] R2-T20: Run final design-alignment/code review and lifecycle lint; fix blockers and reverify.
  - Outcome: branch is review-ready, not automatically merged.
  - Dependencies: R2-T19.

## Test Scenario Traceability

- Provider feasibility: R2-T1-R2-T4 → TS-P1-TS-P4.
- Restore data: R2-T5-R2-T7 → TS-D1-TS-D4.
- Navigation/history: R2-T8-R2-T10, R2-T16 → TS-N1-TS-N5.
- Cold restore: R2-T11-R2-T13 → TS-R1-TS-R8.
- Caption controls: R2-T14-R2-T16 → TS-C1-TS-C8.
- Regression/ownership: R2-T5-R2-T7, R2-T17-R2-T18 → TS-G1-TS-G5.

## Dependencies and Blockers

- **Provider gate outcome:** the exact-time path must not proceed; only the proven caption-anchor fallback can move forward after approval.
- **Resolved provider decision:** exact-time cold restore failed; caption-level cold resume passed and is approved.
- A provider-accessible long video with English captions is required for the spike.
- Preview runtime must support the configured Workers compatibility date for final smoke.
- No new transcript provider or unofficial YouTube API is allowed.
- Existing unmerged direct-player code must be carefully refactored; reusable persistence changes should not be discarded blindly.

## Sequencing Notes

- Use TDD after the provider gate: observe each relevant failure before production changes.
- Keep the native-player behavior available in git history, but remove it from the accepted runtime path.
- Do not infer provider behavior from mocks. Fakes validate our state machine only.
- Reconcile this plan after every completed task or cohesive task batch.

## Risks & Mitigation

- **Undocumented timestamp contract:** block implementation on real evidence and expose failure instead of guessing.
- **Relative move precision:** exact cold movement was rejected; preserve exact seconds only while the live widget survives.
- **Unexpected search usage:** centralize fetch, count every call in tests/smoke, and require explicit user retry.
- **Widget loss on navigation:** use one document and `pushState`; test `popstate` and page reload separately.
- **Caption history mistaken for transcript:** bound session history and never promise unseen captions.
- **Legacy bookmark without query:** retain/delete/fallback UX; never invent a query silently.
- **PR drift:** mark R1 as superseded now and update implementation/testing evidence only when R2 is proven.

## Progress Summary

R2 is review-ready under the approved caption-level contract. The latest provider rerun hit the YouGlish daily quota; the earlier bounded spike supplies successful caption-anchor/long-callback evidence. Commit, branch synchronization and PR publication remain.

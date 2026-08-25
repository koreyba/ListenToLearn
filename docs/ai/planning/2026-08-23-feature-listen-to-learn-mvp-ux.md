---
phase: planning
title: Project Planning & Task Breakdown
description: Break down work into actionable tasks and estimate timeline
---

# Project Planning & Task Breakdown

## Milestones

- [x] M0: Isolated feature worktree and lifecycle documents created; requirements/design/testing lint passes.
- [x] M1: Persist context and global sort/example preferences without breaking existing data.
- [x] M2: Ship audio-first trainer layout, explicit navigation, all/saved filtering, and random traversal.
- [x] M3: Ship unified translation/save behavior for words and selections.
- [x] M4: Run implementation alignment, automated/manual verification, and final review.

## Task Breakdown

### Phase 1: Requirements and design

- [x] R1: Capture current behavior, MVP scope, non-goals, defaults, and explicit YouGlish caption-navigation limitation.
  - Outcome: requirements doc with no unresolved blocking decisions.
  - Validation: feature lint; requirements review against the configured template.
- [x] R2: Define data/API/UI design and test scenarios.
  - Outcome: design and testing docs cover every requirement and provider boundary.
  - Validation: design review and feature lint.

### Phase 2: Data, API, and library

- [x] D1: Add phrase context to schema/runtime migration and phrase API input/output; preserve optional DeepL behavior.
  - Depends on: R1/R2.
  - Validation: type-check, route/static tests, migration generation, phrase API contract assertions.
- [x] D2: Add global library sort preference, stable comparator, and consistent control/metadata on all four tabs.
  - Depends on: D1 for context response shape.
  - Validation: rendered/static assertions and manual four-tab/date/alphabet/reload check.

### Phase 3: Trainer workspace and provider traversal

- [x] T1: Recompose trainer markup/CSS into one desktop/mobile learning flow
  with settings and captions before controls and a policy-compliant media panel
  last.
  - Depends on: R2.
  - Validation: inline script parse, build, desktop/mobile browser smoke, >=200px widget check.
- [x] T2: Persist global all/saved mode, use random provider sequences, and retain saved-example phrase binding.
  - Depends on: T1; existing examples API.
  - Validation: static contracts, provider fixtures, manual reload and saved/all traversal.
- [x] T3: Separate caption/video navigation. Track caption history, feature-detect exact caption operations, and keep honest disabled fallback; wire provider video/audio previous/next.
  - Depends on: T2.
  - Validation: no `move(-5)` assertion, YouGlish event fixture, manual provider navigation.

### Phase 4: Translation and save flow

- [x] S1: Add one translation result action for `+ To Learn`; pass source text, original caption context, and available translation through the shared phrase-save path.
  - Depends on: D1 and T1.
  - Validation: route/UI assertions and manual word/short/full selection flows.
- [x] S2: Regress saved concrete examples and status promotion for preset/custom phrases.
  - Depends on: S1.
  - Validation: examples route tests and manual save/delete/reopen flows.

### Phase 5: Verification and handoff

- [x] V1: Run type-check, lint, tests, diff check, build, and Wrangler dry-run where available.
- [x] V2: Perform responsive/browser smoke and update implementation/testing docs with evidence.
- [x] V3: Final implementation alignment and code review; record deviations/follow-ups.

## Dependencies

- `npm ci` is complete in the feature worktree.
- Existing D1 runtime table creation is retained; the new context column needs both runtime compatibility and a generated migration.
- YouGlish and Tatoeba remain external/network-dependent; tests use static contracts/fixtures, while provider behavior is manually smoke-tested when network access is available.
- The actual DeepL secret remains owner-provided through the protected Integrations page and is never part of this change.

## Sequencing and estimates

- R1/R2: completed documentation work.
- D1/D2: one implementation section.
- T1/T2/T3: one implementation section, with T1 first because markup IDs and CSS are shared by all behavior.
- S1/S2: one implementation section after the API shape is stable.
- V1–V3: final validation section.

## Risks & Mitigation

- **Caption seek is not exposed by the provider:** maintain history and a feature-detection seam; keep controls disabled rather than faking a time jump.
- **Widget ad/size constraints:** keep the widget in its own >=200px media panel and never overlay app controls.
- **Old local/D1 state:** normalize browser settings and add an idempotent runtime column check/migration.
- **Random traversal resets unexpectedly:** cache one randomized sequence per phrase/provider key and rebuild only when the source list changes.
- **DeepL outage:** persist text/context and return pending feedback; never make saving depend on provider availability.
- **Static trainer regression:** compile the inline script in `tests/rendered-html.test.mjs` and run full build/lint after every coherent implementation section.

## Resources Needed

- Current repository code under `app/`, `public/trainer.html`, `db/`, `drizzle/`, and `tests/`.
- Official YouGlish Widget and JavaScript API documentation for the documented track/time/event boundary.
- Existing Tatoeba proxy and server-only DeepL integration.

---
phase: planning
title: Stable YouGlish Saved-Video Restore Plan
description: Ordered TDD, persistence, trainer integration, verification and PR delivery tasks
---

# Stable YouGlish Saved-Video Restore Plan

## Milestones

- [x] Milestone 1: Capture RED contracts for the stable locator and cold restore.
- [x] Milestone 2: Implement and integrate the new-format saved-video contract.
- [x] Milestone 3: Complete full verification, review, documentation and PR.
- [x] Milestone 4: Correct the preview-reported resume command race and update
  the existing PR.
- [x] Milestone 5: Replace fire-and-forget resume completion with provider-
  confirmed bounded retries and add preview-only diagnostics.
- [x] Milestone 6: Reproduce the real untimed-first-caption flow locally and
  keep restore alive until the next timed provider caption.
- [x] Milestone 7: Make the unavoidable provider wait explicit with a restoring
  status tied to confirmed resume state.
- [x] Milestone 8: Move restoring feedback onto the video without blocking the
  learner's access to native player controls.
- [x] Milestone 9: Remove the cold caption wait by measuring and persisting the
  phrase playback anchor when a new video is discovered.
- [x] Milestone 10: Remove automatic pause commands from warm Full Video entry
  and successful cold restore.

## Task Breakdown

### Phase 1: RED contracts

- [x] T1: Add pure helper tests for extracting marked YouGlish match text and
  calculating a bounded relative resume delta.
  - Outcome: provider marker and timing assumptions are executable.
  - Depends on: approved requirements/design.
  - Validation: focused test fails because the helper does not exist.
  - Scenarios: extraction, multiple markers, missing markers, missing/invalid time.
- [x] T2: Update URL, guest, schema/migration and API contract tests for required
  `restoreQuery`.
  - Outcome: every persistence boundary rejects or drops old-format records.
  - Depends on: T1 only for shared naming.
  - Validation: focused tests fail on missing types, fields, validation and SQL.
  - Scenarios: URL independence from resume caption, guest round-trip/upsert/drop,
    account round-trip/filter/migration.
- [x] T3: Add JSDOM fake-widget tests for cold fetch, saved accent, expected
  video, confirmed bounded resume movement and untimed-anchor continuation.
  - Outcome: the reported browser failure is reproduced at the provider boundary.
  - Depends on: current trainer harness.
  - Validation: test observes the current resume-caption fetch and wrong accent.

### Phase 2: Persistence and pure helpers

- [x] T4: Implement `public/youglish-video-restore.js` and load it before the
  trainer controller.
  - Outcome: marker extraction and resume math are pure, bounded and reusable.
  - Depends on: T1.
  - Validation: T1 turns green.
- [x] T5: Add `restoreQuery` to shared TypeScript URL/guest types, normalization,
  save/upsert, Videos direct-link parsing and URL construction.
  - Outcome: browser-local new records and navigation require the stable locator.
  - Depends on: T2.
  - Validation: URL and guest contracts turn green; old guest fixture is dropped.
- [x] T6: Add `restore_query` to the schema, generated append-only migration,
  API select/write/upsert/filter, and legacy-owner row copy.
  - Outcome: account records round-trip the new locator without backfill.
  - Depends on: T2.
  - Validation: schema/migration/API contracts turn green.

### Phase 3: Trainer integration

- [x] T7: Capture marker-derived `restoreQuery` in the active video origin and
  require it before showing/handling `Continue in video`.
  - Outcome: only restorable new video records are created.
  - Depends on: T4 and T5.
  - Validation: warm-transition/rendered persistence contracts pass.
- [x] T8: Thread `restoreQuery` through warm Full Video state, URLs, account
  progress sync, guest storage normalization and `popstate`.
  - Outcome: all entry and resume paths share one new-format contract.
  - Depends on: T5-T7.
  - Validation: rendered HTML and persistence contracts pass.
- [x] T9: Change cold fetch to `restoreQuery #videoId` with the saved accent,
  retain expected-video verification, and perform a relative resume.
  - Outcome: cold reopen selects the correct video independently from progress.
  - Depends on: T4, T7 and T8.
  - Validation: T3 turns green, including the untimed-first-caption path.

### Phase 4: Verification and delivery

- [x] T10: Run focused tests, full build/test suites, TypeScript, ESLint,
  migration/lifecycle lint and diff checks; update testing evidence.
- [x] T11: Reconcile planning and implementation docs, perform lifecycle review,
  and fix any blocking design, behavior, security or integration finding.
- [x] T12: Prepare a scoped conventional commit, push the feature branch and open
  a pull request. Do not merge or deploy.
- [x] T13: Reproduce the dropped resume command with a provider-readiness fake,
  implement the callback-safe resume state machine, run mutation/full
  verification, and update PR #26.
- [x] T14: Reproduce an accepted-but-ignored movement, keep the restore pending
  until a timed caption confirms it, retry at most three times, and expose the
  sanitized trace only on localhost or the branch-preview hostname.
- [x] T15: Capture a local YouGlish trace whose matched first caption has no
  `current_time`, write the failing contract, and start playback until the first
  later timed caption can drive resume movement.
- [x] T16: Add a RED browser/CSS contract for `Restoring to mm:ss…`, expose it
  before readiness and across untimed callbacks, then clear it only after
  confirmation or error without changing seek behavior.
- [x] T17: Add a RED public DOM/CSS contract for a dedicated in-player banner,
  render it prominently with `pointer-events: none`, and keep the widget visible
  and interactive throughout restore.
- [x] T18: Add RED persistence/URL/API contracts for required
  `restoreAnchorTime`, then add the append-only D1 field and guest/account
  propagation.
- [x] T19: Add a RED browser contract requiring `move` on first `PLAYING`
  before any cold caption callback, then use the saved anchor for that move.
- [x] T20: Reproduce the ended-video-to-new-result measurement race, fix the
  clock transition order, and verify the measured anchor in the real widget.
- [x] T21: Run a real cold restore 300 seconds from the discovered anchor and
  confirm YouTube reaches the target while YouGlish captions follow it.
- [x] T22: Add RED contracts for warm entry, confirmed cold restore and a cold
  open without saved progress, then remove the obsolete restore-pause state.

## Dependencies and Sequencing

- RED tests must be captured before production changes.
- The helper and persistence contracts can be implemented independently, but the
  trainer integration requires both.
- Schema generation follows the schema edit and must remain append-only.
- Full review starts only after all tests are green and docs reflect actual code.
- Live YouGlish availability is not required for deterministic automated proof;
  the implementation relies on the already researched official widget contract.

## Risks & Mitigation

- **Provider markers absent:** keep Continue hidden until a non-empty marked match
  arrives; never persist an invented locator.
- **Discovery timestamp missing:** do not expose Continue until a later timed
  callback permits a real anchor measurement; never persist a guessed value.
- **Cold first timestamp missing:** use the persisted discovery anchor and move
  on first `PLAYING`; a cold caption is not required for initial movement.
- **Callback loop after move:** wait for a new timed caption before permitting
  another move, and cap one cold restore at three attempts.
- **Wrong provider result:** preserve the expected-video check and error state.
- **Legacy rows resurfacing:** require the field on writes and filter/drop empty
  values on both account and guest reads.
- **Schema rollout ordering:** use a non-null `-1` anchor default and no backfill.

## Scope and Resources

- Existing Node test runner, JSDOM fake widget, TypeScript, Drizzle and AI DevKit
  checks are sufficient.
- No new package, provider, Worker binding, secret, deployment or production data
  operation is needed.
- The authorized deliverable is a pull request; merge and deployment remain out
  of scope.

## Progress Summary

T1-T22 are complete. The final contract waits for `onPlayerReady` and `PLAYING`,
prevents buffering from overwriting saved progress, and does not equate a
returned fire-and-forget `move` call with success. Discovery persists
`restoreAnchorTime`, so cold restore sends its initial movement on first
`PLAYING`; later provider timestamps only confirm or unlock one of three bounded
total attempts. Full Video entry and restore completion no longer issue an
automatic pause. The visible in-player banner remains coupled to pending state
without blocking native controls. Real-widget proof moved from `343.986` to a
saved `643.986` target before any timed cold caption, then confirmed at
`644.184`. RED/GREEN and full-suite evidence are maintained on PR #26.

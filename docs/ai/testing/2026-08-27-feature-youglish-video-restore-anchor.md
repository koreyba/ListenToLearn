---
phase: testing
title: Stable YouGlish Saved-Video Restore Testing Strategy
description: TDD contracts for provider locator persistence, cold restore and independent resume
---

# Stable YouGlish Saved-Video Restore Testing Strategy

## Test Coverage Goals

- Prove the reported cold-open failure path at the widget boundary.
- Cover every new storage/API/URL field and intentional legacy-data boundary.
- Keep provider behavior deterministic with a fake widget; no live YouGlish call
  is required in the automated suite.

## Unit and Contract Tests

- [x] Extract one or multiple marked `[[[...]]]` segments, normalize whitespace,
  and reject captions without a marked match.
- [x] Build a Full Video URL only with a valid `videoId`, `originQuery`,
  `restoreQuery`, and `restoreAnchorTime`; retain resume metadata independently.
- [x] Guest save/normalization round-trips both restore fields, refreshes them on
  deduplicating upsert, and drops legacy records without either field.
- [x] Account schema/migrations/API round-trip `restore_query` and
  `restore_anchor_seconds`, require both on new writes, and filter old rows.
- [x] Rendered trainer contracts pass both fields through guest/account history,
  Full Video URLs and progress sync.

## Browser Integration Tests

- [x] A cold Full Video URL fetches `restoreQuery #videoId`, not
  `resumeCaption #videoId`, and uses the saved accent on the first call.
- [x] A saved anchor arriving before `onPlayerReady` is not treated as the cold
  current position; after readiness, playback starts but no movement is sent
  until a finite provider timestamp arrives.
- [x] `onPlayerReady` arriving before `onVideoChange` does not start playback;
  the expected-video callback unlocks exactly one `play` request.
- [x] An accepted-but-ignored movement is retried only after a new timed caption;
  player-state noise cannot duplicate it, and retries stop after three moves.
- [x] A caption confirming the saved target keeps playback running and does not
  issue another move.
- [x] A cold sequence with saved anchor `40:00`, factual provider start `17:00`
  and target `43:00` avoids the speculative `+3:00` intermediate jump and sends
  one `+26:00` move after the factual timestamp.
- [x] A transient `BUFFERING` callback before the move cannot persist anchor time
  over the saved resume target.
- [x] Discovery with an untimed match measures the anchor from the first later
  timestamp minus only accumulated `PLAYING` time.
- [x] `ENDED -> BUFFERING -> PLAYING` starts the discovery clock after state
  application, avoiding the real `105` instead of `100` race.
- [x] `Restoring to mm:ss…` is visible before player readiness, remains through
  fetch/video/untimed-caption callbacks, and clears only when the saved position
  is confirmed.
- [x] The restoring output is a prominent child of the video frame with
  `pointer-events: none`, so it cannot intercept native player controls.
- [x] A zero-result provider response replaces restoring with the existing
  visible saved-video restore error instead of leaving the spinner active.
- [x] A mismatched `onVideoChange.video` remains rejected.
- [x] Warm `Continue in video` caches the first marker-derived locator across
  later unmarked captions, stores it, and still does
  not refetch or navigate the page.
- [x] Warm `Continue in video`, confirmed cold restore and a cold Full Video open
  without saved progress never issue an automatic pause.

## Regression Coverage

- [x] Existing caption navigation, replay/repeat, guest/account persistence,
  Videos removal and phrase-example flows remain green.
- [x] `npm test`, repository-wide Node tests, TypeScript, lint, lifecycle lint,
  migration generation and `git diff --check` pass.

## Test Data and Mocks

- Canonical valid video ID: `w66ecIT-Xkk`.
- Display query: `I don't know if it's`.
- Provider caption: `That is [[[the actual match]]] in this video.`.
- Stable locator: `the actual match`.
- Resume example: anchor `100s`, saved target `400s`, expected move `300s`.
- Fake YouGlish widget records `fetch`, `move`, `pause`, `play` and callbacks;
  the cold-resume contract can reject moves before provider readiness or active
  playback instead of treating every attempted call as successful.
- The feedback test models a provider that accepts the JavaScript call but then
  reports the unchanged anchor time before succeeding on the second attempt.
- The untimed-anchor test uses the observed saved target `470.574278...` and the
  next provider timestamp `469.022370...`; before the fix it fails because no
  playback is requested and the restore is cleared.
- The factual-position contract supplies `restoreAnchorTime=2400`, emits
  `PLAYING` at an unknown position and expects no move, then reports `1020` and
  expects exactly one `move(1560)` toward the `2580` target.
- The restoring-status test uses a `400s` target and verifies the public DOM
  state (dedicated semantic `<output>` inside the video frame, polite live
  region, visible state and `6:40` copy) rather than internal resume flags.

## Verification Commands

- `node --test tests/youglish-video-restore.test.mjs tests/youglish-full-video.test.mjs tests/guest-library.test.mjs tests/video-api-contract.test.mjs`
- `node --test tests/youglish-caption-navigation.test.mjs tests/rendered-html.test.mjs tests/trainer-video-persistence.test.mjs`
- `npm test`
- `node --test tests/*.test.mjs`
- `npx tsc --noEmit`
- `npm run lint`
- `npx ai-devkit@latest lint --feature youglish-video-restore-anchor`
- `git diff --check`

## Bug Tracking

Any use of `resumeCaption` or `originQuery` as the cold restore locator, ignored
saved accent, movement before a factual cold timestamp, repeated resume move,
cross-video acceptance, or persistence of a new record without `restoreQuery`
blocks the PR.

## Verification Record — 2026-08-27

- `npm test`: fresh Vinext build completed and 241/241 repository tests passed.
- Focused changed-path integration suite: 143/143 passed.
- `npm run lint`: 0 errors; two existing unused-disable warnings in generated
  `worker-configuration.d.ts`.
- `npx tsc --noEmit`, AI DevKit feature lint and `git diff --check`: exit 0.
- Mutation proof: replacing the cold locator with `resumeCaption` made the
  browser contract fail on `mutable last caption #w66ecIT-Xkk`; restoring
  `restoreQuery` returned the same test to GREEN.
- Preview follow-up RED: the provider-realistic fake discarded the pre-ready
  movement and the old implementation never retried it. GREEN waits for
  `onPlayerReady`, requests playback, waits for `PLAYING`, then sends the initial
  movement and restores pause on the resumed caption.
- A second RED exposed anchor-progress overwrite during the controlled
  `BUFFERING` transition. GREEN suppresses progress writes until restore settles.
- Follow-up mutation proofs fail when either readiness/playing gating or the
  progress-write guard is removed, then pass again when each fix is restored.
- Follow-up full verification: Vinext build and 241/241 tests pass; focused
  caption and rendered contracts pass 64/64 and 42/42; TypeScript, lifecycle
  lint and `git diff --check` pass; ESLint remains at 0 errors with the same two
  generated-file warnings.
- Post-push Sonar review reported cognitive complexity in the resume coordinator
  and possible super-linear backtracking in marker parsing. The coordinator was
  split into single-purpose helpers, the regex was replaced by an `indexOf`
  scanner, and multiline plus large unterminated-marker coverage was added.
- Second preview-follow-up RED: a returned first `move(300)` was treated as
  complete, so a subsequent unchanged `100s` callback paused at the phrase
  anchor instead of retrying. GREEN keeps the request pending, ignores
  player-state noise, retries after the unchanged timestamp, and pauses only
  when `400s` confirms the target.
- Retry-cap RED emitted five movements for five unchanged callbacks. GREEN caps
  the cold restore at three and displays a resume error after exhaustion. Review
  then exposed a later callback overwriting the saved target with the anchor;
  the final contract keeps automatic progress blocked for the failed session.
- Preview-trace RED proved diagnostics were localhost-only. GREEN allows the
  existing sanitized opt-in trace on the branch-preview suffix while a separate
  contract keeps it disabled on production.
- Final follow-up verification: fresh Vinext build and 244/244 repository tests
  pass; the changed-path suite passes 133/133; TypeScript, lifecycle lint and
  `git diff --check` pass; ESLint reports zero errors and the same two generated
  warnings.
- Third preview-follow-up RED: the real first callback had `current_time: null`;
  the old fallback produced `play = 0`, paused at the phrase, and made every
  movement retry unreachable. GREEN keeps restore pending, requests playback,
  waits for the next timed caption, and calculates the relative delta from that
  observed time. A local provider run reached `470.810` for saved `470.574` and
  paused.
- Restoring UX RED: the provider status had no live-region semantics and all
  non-error notices were hidden; before readiness it displayed the internal
  search message instead of the saved target. GREEN exposes
  `Restoring to 6:40…` through the full pending interval and removes it after a
  `399.8s` confirmation. Review RED then caught a zero-result response leaving
  the spinner active; GREEN replaces it with the saved-video restore error.
- Final restoring verification: fresh Vinext build and 246/246 repository tests
  pass; the focused caption/rendered/persistence suite passes 114/114; ESLint
  has zero errors and the same two generated warnings; TypeScript, lifecycle
  lint and `git diff --check` pass. A local real-widget browser run visibly
  rendered `Restoring to 7:50…`, then hid it after reporting
  `Full video ready at 7:50.`
- In-player banner RED failed because no dedicated output existed inside the
  media frame. GREEN passes the focused 4/4 contracts and the related 114/114
  suite. Changing its `pointer-events` to `auto` makes the focused contract fail;
  restoring `none` returns it to GREEN.
- Final real-widget validation rendered a 52px-high banner with 22px text inside
  `widgetFrame`; hit-testing its center returned `iframe#fr_yg-widget`, proving
  that the overlay does not intercept the player's pointer target. The banner
  became hidden after confirmed restore.
- Final banner verification: fresh Vinext build and 246/246 repository tests
  pass; ESLint has zero errors and the same two generated warnings; TypeScript,
  lifecycle lint and `git diff --check` pass.
- Persisted-anchor final verification: a fresh Vinext build and all 251/251
  repository tests pass. ESLint has zero errors and the same two generated-file
  warnings; TypeScript, lifecycle lint, dependency validation, repeat migration
  generation and `git diff --check` pass.
- A real local YouGlish run measured the discovery anchor at `343.986s`. A cold
  open targeting `643.986s` sent `move(300)` on the first `PLAYING` callback,
  before any timed cold caption; the next callbacks corrected by `-1.547s` and
  confirmed `644.184s`. This earlier optimization is superseded by the
  factual-position contract below because it could create a visible intermediate
  jump when the cold start differed from the discovery occurrence.
- Autopause follow-up RED: warm entry and both cold completion variants each
  observed one unwanted `pause`; GREEN removes the obsolete restore-pause state
  and all three focused contracts pass without changing explicit user pause or
  caption-navigation pause behavior.
- Autopause final verification: fresh Vinext build and 253/253 repository tests
  pass; the focused caption/rendered suite passes 116/116. ESLint has zero
  errors and the same two generated-file warnings; TypeScript, lifecycle lint,
  dependency validation and `git diff --check` pass.
- Intermediate-jump RED: the `40:00` saved anchor caused one movement on
  `PLAYING` before the provider reported its factual `17:00` start. GREEN emits
  no early movement, then one `+26:00` move to `43:00`; reverting the production
  change makes the same focused contract fail again with `1 !== 0`.
- Event-order RED: `onPlayerReady` requested playback before the expected video
  callback (`1 !== 0`). GREEN gates playback on verified `onVideoChange` and the
  focused expected-video, factual-position and wrong-video contracts pass 3/3.
- Final factual-position verification: fresh Vinext build and 254/254 repository
  tests pass; the focused caption/rendered/persistence suite passes 120/120.
  TypeScript, lifecycle lint, dependency validation and `git diff --check` pass;
  ESLint reports zero errors and the same two generated-file warnings.

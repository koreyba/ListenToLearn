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
- [x] Build a Full Video URL only with a valid `videoId`, `originQuery`, and
  `restoreQuery`; retain resume metadata without using it as the locator.
- [x] Guest save/normalization round-trips `restoreQuery`, refreshes it on
  deduplicating upsert, and drops legacy records without it.
- [x] Account schema/migration/API round-trip `restore_query`, require it on new
  writes, and filter old empty rows from reads.
- [x] Rendered trainer contracts pass `restoreQuery` through guest/account
  history, Full Video URLs and progress sync.

## Browser Integration Tests

- [x] A cold Full Video URL fetches `restoreQuery #videoId`, not
  `resumeCaption #videoId`, and uses the saved accent on the first call.
- [x] A timed anchor arriving before `onPlayerReady` issues no movement; after
  readiness, the paused player is started and a relative
  `move(resumeTime - current_time)` is sent only after `PLAYING`.
- [x] An accepted-but-ignored movement is retried only after a new timed caption;
  player-state noise cannot duplicate it, and retries stop after three moves.
- [x] A caption confirming the saved target pauses playback once and does not
  issue another move.
- [x] A real-shape cold sequence with an untimed matched caption requests
  playback, keeps restore pending, then calculates the move only when the next
  caption supplies `current_time`.
- [x] A transient `BUFFERING` callback before the move cannot persist anchor time
  over the saved resume target.
- [x] Missing `current_time` on the first caption issues no speculative move and
  does not abandon restore.
- [x] A mismatched `onVideoChange.video` remains rejected.
- [x] Warm `Continue in video` caches the first marker-derived locator across
  later unmarked captions, stores it, and still does
  not refetch or navigate the page.

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
saved accent, repeated resume move, cross-video acceptance, or persistence of a
new record without `restoreQuery` blocks the PR.

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

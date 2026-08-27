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
- [x] The expected video callback followed by a timed anchor caption issues one
  relative `move(resumeTime - current_time)`.
- [x] The resumed caption pauses playback once and does not issue another move.
- [x] Missing `current_time` issues no speculative move and leaves the correct
  video usable at its stable anchor.
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
- Fake YouGlish widget records `fetch`, `move`, `pause`, `play` and callbacks.

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

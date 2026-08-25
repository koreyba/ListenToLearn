---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy

## Test Coverage Goals

- Cover every new per-video, Replay, segment-placement, and neighbor branch.
- Exercise the real inline trainer controller in JSDOM with a deterministic fake
  `YG.Widget`; do not use a live provider as the only proof.
- Keep all pre-existing build and test gates green.

## Unit Tests

- [x] Known caption IDs keep their segment identity.
- [x] New captions inside a known range join that segment.
- [x] Distant captions create a distinct segment.
- [x] Neighbor lookup never crosses video or segment boundaries.
- [x] Duplicate caption IDs remain idempotent (covered by the existing opaque-ID
  timeline regression in `tests/rendered-html.test.mjs`).

## Integration Tests

`tests/youglish-caption-navigation.test.mjs`:

- [x] One-caption boundary matrix.
- [x] Two-caption Previous/Next matrix.
- [x] Three-caption middle navigation.
- [x] Replay preserves forward history.
- [x] Replay preserves Next for a timestamp-less first caption.
- [x] Timestamp-less first caption can reach its cached next caption safely.
- [x] Failed controlled playback releases the pending navigation state.
- [x] Replay requested while paused restores pause.
- [x] Rejected Replay clears stale pause intent.
- [x] `video A -> video B -> video A` restores A.
- [x] Duplicate same-video `onVideoChange` preserves history.
- [x] Distant manual seek starts a new segment.
- [x] Navigation remains inside the distant segment.
- [x] Seeking to a known caption reactivates its segment.
- [x] A new caption inside a known range joins it.
- [x] External caption change disables Repeat for the old caption.

## End-to-End Tests

- [ ] Live YouGlish smoke: observe three captions and navigate `3 -> 2 -> 1 -> 2`.
- [ ] Live Replay smoke from paused caption 2.
- [ ] Live iframe seek smoke across a large time gap.

Live smoke is provider/quota dependent and is not required for deterministic
unit/integration completion.

## Test Data

- Video A near `600`, `603`, and `607` seconds.
- Video B near `120` and `124` seconds.
- A distant segment in video A near `1800` and `1804` seconds.
- A replay-only first caption with no `current_time`.

## Test Reporting & Coverage

RED baseline on 2026-08-25:

- `npm test`: build passed; 38 tests; 31 passed and 7 intentional failures.
- All 40 pre-existing tests passed separately.
- `npm run lint`: 0 errors and two pre-existing generated warnings.
- `npx tsc --noEmit` and `git diff --check`: passed.

Completion requires fresh `npm test`, all pre-existing tests, TypeScript, lint,
AI docs lint, and diff-check evidence.

GREEN verification on 2026-08-25 after rebasing onto `origin/main` `a47c8a9`:

- `npm test`: production build passed; 50/50 configured tests passed.
- `node --test tests/*.test.mjs`: 65/65 repository tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 0 errors and two pre-existing warnings in
  generated `worker-configuration.d.ts`.
- `git diff --check`: passed.
- Base AI docs lint passed. All seven feature documents passed content checks;
  the feature command reports only that AI DevKit expects the unprefixed branch
  `feature-youglish-caption-segments-tdd`, while this repository requires the
  `codex/` branch prefix.
- `npm ls --depth=0`: passed with no invalid or missing dependency.

## Manual Testing

- Verify buttons remain visible and disabled at boundaries.
- Verify caption text and media position stay aligned after Replay and seek.
- Verify Tatoeba controls are unchanged.

## Performance Testing

No load test is needed. Verify there is no polling and each caption event performs
only bounded in-memory work.

## Bug Tracking

Any provider mismatch must record the actual event order and available fields.
Do not replace a missing timestamp with an unlabeled fixed seek.

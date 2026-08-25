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

## Exploratory Edge Matrix

Local TDD follow-up on 2026-08-25 added 25 active edge tests. The initial RED
run for the first 19 had 39 total, 30 passed and 9 failures. A later live smoke
found two more regressions; their focused RED run passed 0/2. After the minimal
production-code fixes, later live smokes corrected the pending-state contract.
The final correction established that caption buttons derive only from cached
neighbors, not command state; four focused behavior checks initially passed
0/4. The focused suite now passes 46/46.

Passing characterization cases:

- timestamps exactly at and just beyond the 30-second segment boundary;
- invalid provider times, including zero as a valid timestamp;
- out-of-order caption callbacks sorted by timestamp;
- a known caption callback with missing timing retains its cached time;
- switching video cancels controlled Next without pausing the new video;
- a new time inside an inactive segment range reactivates that segment;
- a large backward seek starts an isolated segment;
- identical caption IDs remain isolated between videos.

Former RED cases now fixed:

- equal timestamps expose a zero-delta caption target that cannot be confirmed;
- a known ID with a wildly changed timestamp stretches/reorders its segment and
  produces a cross-gap movement (`-1193s` instead of `-3s` in the fixture);
- a late caption tagged with video A is stored in active video B;
- a timestamped caption tagged with its video is lost when it arrives before
  `onVideoChange`;
- an empty `onVideoChange` payload switches away from the valid active cursor;
- Replay pending does not disable competing Previous actions;
- a second Replay click sends a duplicate provider command;
- controlled Next remains permanently busy if playback stops before its target;
- duplicate `onCaptionConsumed` callbacks issue duplicate Repeat seeks.
- caption callbacks without a provider ID receive a history-length-based ID,
  so Replay never recognizes the first caption and keeps navigation blocked.
- Repeat is incorrectly disabled while waiting for captions, navigation, or
  Replay even though it is an always-available user toggle.
- Previous/Next are incorrectly disabled by a transient command lock instead of
  being derived only from the active caption's cached neighbors;
- repeated no-ID callbacks for the same caption with a drifting `current_time`
  create phantom history entries and expose a nonexistent Previous target.

Evidence command:

`node --test tests/caption-segments.test.mjs tests/youglish-caption-navigation.test.mjs`

Final local verification:

- `npm test`: production build plus configured tests passed 75/75;
- `node --test tests/*.test.mjs`: repository tests passed 93/93;
- `npm run lint`: 0 errors and two pre-existing generated warnings;
- `npx tsc --noEmit` and `git diff --check`: passed.

The fixes keep the first trusted timestamp for a known caption ID, reject
zero-delta targets, bind tagged caption events to their video, ignore empty video
changes, include Replay in the shared pending state, release controlled Next on
an early playback stop, acknowledge Repeat movement only after its caption is
observed again, and stabilize missing provider IDs by matching caption text and
timing. Previous/Next enabled state now depends only on cached neighbors; command
pending never disables them. Repeated current-caption callbacks inside the
30-second segment tolerance reuse the same entry, while identical text outside
that tolerance remains distinct. Repeat is never disabled in YouGlish mode.
These local changes have not been pushed to PR #14.

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
- [x] Captured provider state noise cannot cancel controlled Next.
- [x] Explicit pause is restored when the target caption arrives after noise.
- [x] Playing controlled Next emits no pause/play command churn.
- [x] Duplicate Next is coalesced before and after transient pause callbacks.
- [x] Replay remains available and cancels controlled Next.
- [x] An unconfirmed controlled Next expires instead of remaining stale.
- [x] Controlled Next adds no visible navigation-status message.

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
These changes are tracked in PR #14.

## Live Provider-Race Follow-up

Fresh local verification on 2026-08-25:

- `npm test`: production build and configured tests passed 84/84.
- `node --test tests/*.test.mjs`: all repository tests passed 104/104.
- `npx tsc --noEmit`, `git diff --check`, and base AI-docs lint passed.
- `npm run lint`: 0 errors and the same two generated-file warnings.
- Feature AI-doc content checks passed; the command retains the known branch-name
  mismatch because AI DevKit expects the unprefixed branch while the repository
  requires `codex/`.
- Mutation proof: replacing the desired-playback decision with raw
  `playerState === 1` made the captured-race test fail; restoring the fix made it
  pass again.
- Live YouGlish acceptance: from an explicitly paused replay anchor, Next issued
  one controlled `play`, retained its target through `BUFFERING -> PLAYING`,
  selected the cached next caption after about five seconds, restored `PAUSED`,
  kept Replay enabled, and rendered no visible navigation-status message.

## Replay Acceleration Hypothesis

TDD diagnostics added two passing contracts:

- `onCaptionConsumed` is traced even when Repeat is off, using only tokenized
  caption identity;
- `onSpeedChange` records the accepted speed required to compare wall time with
  media time.

Live measurements:

- 1x example 1: initial 4.025s, Replay 3.793s, difference 0.232s;
- 1x example 2: initial 5.071s, Replay 4.833s, difference 0.239s;
- 0.75x example: initial 5.027s media time, Replay 4.827s, difference 0.200s.

The measurement itself was stable, but the proposed seek contract failed live:

- moving by measured duration minus 0.4s skipped B and produced later captions;
- delaying the same move until `PLAYING` also skipped B;
- moving from Replay `current_time` to B's observed time confirmed B and restored
  pause, but took 4.9s and therefore provided no acceleration.

The provisional accelerator and its tests were removed. The suite retains the
safe controlled-playback behavior and the two diagnostic trace tests.

Fresh post-revert verification on 2026-08-25:

- `npm test`: build and configured tests passed 86/86;
- `node --test tests/*.test.mjs`: repository tests passed 106/106;
- TypeScript, diff check, base AI-docs lint, and ESLint passed; ESLint retained
  the two existing generated-file warnings and reported zero errors;
- live baseline issued only controlled `play`, confirmed exact B after 6.0s,
  restored pause, and ended at caption index 1.

## Symmetric Untimed-Edge TDD

New RED -> GREEN contracts cover:

- one clean four-second `A -> B` transition issuing symmetric `-4/+4` moves;
- elapsed playback inside B extending the backward move;
- elapsed playback inside A reducing the forward move;
- buffering discarding the old interval and restarting measurement on PLAYING;
- a video switch invalidating measurement after returning to cached history;
- 0.75x wall-time conversion into media time;
- a skipped cached neighbor not overwriting the nearer learned edge;
- an inserted neighbor invalidating an edge bound to the old neighbor;
- sanitized local tracing of the learned numeric edge.

Mutation proof: forcing the learned delta to `null` makes the symmetric movement
test fail (`0 !== 1` movement count); restoring the implementation makes it pass.
Live exact-caption verification is blocked by the current YouGlish daily quota
and must remain explicitly pending rather than inferred from the fake widget.

Fresh deterministic verification on 2026-08-25:

- `npm test`: production build and configured tests passed 95/95;
- `node --test tests/*.test.mjs`: repository tests passed 115/115;
- `npx tsc --noEmit`, `git diff --check`, base AI-docs lint, and
  `npm ls --depth=0` passed;
- ESLint passed with 0 errors and the same two generated-file warnings;
- feature AI-doc content checks passed; its command retains the known branch
  naming mismatch because it expects the unprefixed feature branch rather than
  repository-required `codex/youglish-caption-segments-tdd`.

## Live First-Caption Ordering Regression

The browser trace reproduced two gaps that the synthetic order had missed:

- caption A may arrive before `UNSTARTED -> BUFFERING -> PLAYING`; edge timing
  must start from the later `PLAYING` transition and still produce a symmetric
  relative move;
- after controlled Next begins while playback is already running, an explicit
  user Pause must cancel the target so the next click can retry immediately.

Both tests failed before their fixes (`0 !== 1` expected movement/play count),
passed after implementation, failed again when each fix was independently
removed, and passed after restoration. Provider state noise remains distinct
from the explicit UI Pause and therefore does not cancel controlled navigation.

Fresh post-fix verification:

- `npm test`: production build and configured tests passed 97/97;
- `node --test tests/*.test.mjs`: repository tests passed 117/117;
- TypeScript, diff check, and base AI-docs lint passed;
- ESLint passed with 0 errors and the same two generated-file warnings.

Live post-fix acceptance:

- the provider emitted caption A before its player-state sequence, matching the
  reported browser trace;
- the controller learned `nextOffsetSeconds = 5.0125` for A -> B;
- Previous issued learned-edge `move(-5.079)` and confirmed exact A;
- immediate Next issued learned-edge `move(+4.949)` and confirmed exact B;
- both transitions completed without controlled fallback, and the final button
  state exposed Previous with Next disabled at B.

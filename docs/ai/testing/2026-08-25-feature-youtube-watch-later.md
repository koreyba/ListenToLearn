---
phase: testing
title: YouGlish Full Video Mode Testing Strategy
description: Provider spike and tests for saved restore metadata, shared-widget navigation, captions and resume
---

# YouGlish Full Video Mode Testing Strategy

## Revision Status

The native-YouTube-player checks are superseded. R2 automated checks and the bounded provider spike are recorded below; unchecked items need a fresh provider run after quota reset.

## Test Coverage Goals

- Prove cornerstone YouGlish behavior with the real widget before relying on fakes.
- Make fetch counts, history transitions and paused resume deterministic in controller tests.
- Cover guest/account restore metadata, ownership and migration.
- Cover the complete retained/removed Full Video control matrix.
- Preserve existing Tatoeba, YouGlish result and phrase/saved-clip behavior.
- Never download or store a full transcript in tests or runtime.

## Real Provider Feasibility Gate

- [x] **TS-P1 — FAILED EXACT-TIME GATE:** A constrained cold fetch returned the expected video, but the first caption callback exposed no finite timestamp.
- [x] **TS-P2 — FAILED EXACT-TIME GATE:** Active movement reached 2401.069 for a 2400-second target; movement before active playback did not retain the seek.
- [x] **TS-P3:** Caption callbacks continued after the original segment and after the long active move.
- [x] **TS-P4:** Source contract confirms warm transition = 0 fetch, cold restore = 1 fetch and caption progression = 0 fetch.
- [x] **TS-P5 — FALLBACK:** One fetch for the last observed caption plus video ID restored the expected video and caption paused.

Capture bounded callback samples and counts, not a full transcript. Any failed cornerstone scenario is a design blocker.

The exact-time design is rejected. TS-P5 is the approved cold-resume contract.

## Saved Data and Ownership

- [x] **TS-D1:** Guest/account save requires valid `videoId`, non-empty bounded `originalQuery`, language and valid optional accent/context.
- [x] **TS-D2:** Duplicate `videoId` keeps one bookmark and refreshes latest valid query/context.
- [x] **TS-D3:** Existing records migrate additively; legacy records without a query are retained but cannot start a cold restore.
- [x] **TS-D4:** Account GET/POST/DELETE remain subject-scoped; guest normalization/caps remain bounded.

## Navigation and State

- [x] **TS-N1:** Result → Full Video uses `pushState`, reuses the widget, pauses it and preserves current time without a fetch.
- [x] **TS-N2:** Full Video → Listen persists immediately, opens the selected caption in the last ordinary provider, and pushes history.
- [x] **TS-N3:** Browser Back from Listen restores the same video at the saved caption boundary paused with one cold fetch; Back from a warm Full Video transition reuses the paused widget with no fetch.
- [x] **TS-N4:** Forward restores the corresponding trainer/listen URL state without deleting video progress.
- [x] **TS-N5:** Direct `/videos` links redirect to the trainer cold path; reload uses the saved caption anchor.

## Cold Restore Controller

- [x] **TS-R1:** Query builder preserves `originalQuery` and appends exactly one canonical video constraint.
- [x] **TS-R2:** Restore performs at most one automatic `widget.fetch`.
- [x] **TS-R3:** Wrong returned video ID reports restore failure.
- [ ] **TS-R4:** First finite callback timestamp produces `delta = resumeTime - loadedTime`.
- [x] **TS-R5:** The real provider spike restored the saved caption text/ID paused.
- [x] **TS-R6:** Missing query is rejected, wrong video reports failure and provider/quota errors remain visible in the widget.
- [x] **TS-R7:** There is no silent automatic retry; another navigation/reload is an explicit potentially billable fetch.
- [x] **TS-R8:** Cold `autoStart: 0` prevents playback/autoplay before the restored caption is presented.

TS-R4 is retained only for active/warm relative movement and is not part of the approved cold path.

## Caption and Control Contract

- [x] **TS-C1:** Caption callbacks update current text/time and append a deduplicated memory history capped at 200.
- [x] **TS-C2:** Previous/Next traverses only observed captions and disables at known boundaries.
- [x] **TS-C3:** Repeat loops the current caption and never returns to the original saved match.
- [x] **TS-C4:** Play/pause, speed and expand/fullscreen remain available.
- [x] **TS-C5:** Text selection and Translate retain the existing selection flow.
- [x] **TS-C6:** `To learn` retains the existing selected-text phrase flow.
- [x] **TS-C7:** `Listen` follows TS-N2/TS-N3 and uses the provider saved before Full Video Mode forces YouGlish.
- [x] **TS-C8:** Replay-anchor, result-video Prev/Next, Save clip, saved-example filters, random/ordered and provider switch are absent in Full Video Mode.

## Regression and Failure Boundaries

- [x] **TS-G1:** Ordinary YouGlish search/result navigation and saved-clip replay remain unchanged outside Full Video Mode.
- [x] **TS-G2:** Tatoeba behavior and controls remain unchanged.
- [x] **TS-G3:** Removing a video never deletes a phrase or saved clip.
- [x] **TS-G4:** Malformed browser storage, unavailable provider/quota and missing captions retain safe remove/back behavior.
- [x] **TS-G5:** No runtime/test path calls an unofficial YouTube captions endpoint or persists a full transcript.

## Automated Test Layers

- Pure/unit tests: data normalization, query construction, progress, observed-caption history and control selectors.
- Pure/source contracts: query construction, zero-fetch warm transition, one-fetch cold transition and history wiring.
- Rendered contracts: visible controls/states, history transitions and absence of the primary native YouTube player path.
- API/schema contracts: validation, subject ownership, deduplication and additive migration.
- Existing full suite: phrase, provider, auth, guest, responsive and build regressions.

Fakes prove ListenToLearn behavior only. They cannot satisfy TS-P1-TS-P4.

## Test Data

- Use one fixed short-caption fixture and one real 40+ minute YouGlish-indexed video for the provider gate.
- Use distinct `originalQuery` values for duplicate-refresh tests.
- Use two authenticated subjects for ownership tests.
- Use malformed progress, missing queries and wrong video IDs as negative cases.
- Provider evidence stores only the minimum caption samples necessary to establish callback continuity.

## Verification Commands

- Targeted Node/controller/rendered tests during TDD.
- `npx tsc --noEmit`.
- `npm run lint`.
- `npm test`.
- `git diff --check`.
- `npx ai-devkit@latest lint`.
- `npx ai-devkit@latest lint --feature youtube-watch-later`.

Exact fresh counts and provider observations are recorded only after R2 implementation. Previous R1 pass counts are not evidence of R2 completion.

## Manual Desktop and Mobile Smoke

- [ ] Save a current YouGlish result and verify the persisted exact query/provider options.
- [ ] Enter Full Video Mode warm; verify UI/control matrix, paused time and zero fetch.
- [ ] Play across many captions; verify current caption, history, Repeat, selection, Translate and `To learn`.
- [ ] Use `Listen`, then Back and Forward; verify state/time, pause and fetch counts.
- [ ] Reload after short and long viewing sessions; verify one-fetch restore at the last observed caption boundary.
- [ ] Exercise missing-query, mismatch, missing-time, timeout, quota and explicit Retry states.
- [ ] Verify guest/account list, deduplication and removal.
- [ ] Verify keyboard focus, screen-reader labels, fullscreen and responsive layout.

## Release Blockers

- Any failed TS-P1-TS-P4 provider contract.
- Additional automatic fetches beyond the documented warm/cold contract.
- Incorrect video or exact-second precision presented as a successful restore.
- Loss of required caption-learning controls.
- Cross-user data exposure, transcript scraping/storage, or phrase/clip deletion caused by video removal.

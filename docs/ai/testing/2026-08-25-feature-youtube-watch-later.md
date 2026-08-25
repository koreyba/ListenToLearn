---
phase: testing
title: YouTube Watch Later Testing Strategy
description: Tests for saved-video ownership, guest storage, direct playback and resume
---

# YouTube Watch Later Testing Strategy

## Test Coverage Goals

Cover every new pure helper branch, authenticated API validation/ownership branch that can be exercised locally, rendered UI contract, and player/resume state transition. External YouTube and YouGlish behavior uses deterministic fakes plus a bounded manual smoke; tests never scrape provider content.

## Unit Tests

### Guest saved videos

- [x] Version-1 guest state normalizes to version 2 without losing phrases/examples.
- [x] Valid video save deduplicates by video ID and refreshes origin context.
- [x] Invalid IDs and malformed records are rejected.
- [x] Remove affects only the selected video and not phrase examples.
- [x] Saved-video cap keeps the newest records.

### YouTube progress helper

- [x] Missing/malformed storage normalizes to an empty state.
- [x] Valid seconds save and load by video ID.
- [x] Negative, non-finite, oversized and near-completion positions reset safely.
- [x] Progress cap and explicit clear work.

### Player controller seam

- [x] Player options include visible controls, inline playback, English CC and origin.
- [x] Resume uses `startSeconds` and does not autoplay.
- [x] Playing starts a bounded save cadence; pause/page-hide/cleanup flush once.
- [x] Ended clears progress; player errors retain direct YouTube fallback.

## Integration Tests

- [x] `saved_videos` schema and migration enforce `(user_id, youtube_video_id)` uniqueness.
- [ ] `GET /api/videos` returns only current-user rows in updated order.
- [ ] `POST /api/videos` rejects invalid IDs/body/origin phrase and upserts a valid owned record.
- [ ] `DELETE /api/videos` cannot delete another user's row.
- [x] Guest allowlist exposes `/videos` but keeps `/api/videos` authenticated.
- [x] Trainer `Watch later` selects guest storage or account API without changing saved-example behavior.

## End-to-End / Rendered Contract Tests

- [x] Trainer renders distinct `Save clip`, `Watch later`, and `Watch full video` actions for YouGlish.
- [x] Tatoeba retains `Save track` and does not show YouTube-only actions.
- [x] Videos page renders empty/list/player/remove states and links to library/source phrase.
- [x] Direct player loads YouTube IFrame API and does not load YouGlish widget code.
- [x] URL `?video=<valid-id>` opens the player without automatically saving the video.
- [x] Existing phrase, Tatoeba, YouGlish clip, guest-mode, auth and compact-layout tests remain green.

## Test Data

- Use fixed valid video ID `M7lc1UVf-VE` in code fixtures; no playback network request is required for automated tests.
- Use two authenticated user subjects to prove ownership boundaries.
- Use malformed IDs, records and progress maps as explicit negative fixtures.
- Fake the `YT.Player` object and browser lifecycle events for controller tests.

The current automated player coverage is a pure configuration/progress seam plus rendered lifecycle contracts. Real IFrame callbacks and D1 ownership execution remain in the manual preview smoke because the repository has no browser/D1 integration harness for route modules.

## Test Reporting & Coverage

- Targeted Node tests for new helpers/routes/rendered contracts.
- `npx tsc --noEmit`.
- `npm run lint`.
- `npm test` (includes a fresh production build).
- `git diff --check`.
- Record exact pass/fail counts and any intentionally manual provider boundary.

Fresh final results after syncing `origin/main`: 17 helper tests passed, 3 guest-boundary tests passed, and full `npm test` completed a production build plus 33 passing tests. TypeScript, ESLint, diff-check, base docs lint and feature docs lint all exited 0. ESLint reports two existing warnings in generated `worker-configuration.d.ts` and no errors.

## Manual Testing

- [ ] In YouGlish, verify `Save clip` still replays through saved examples.
- [ ] Save the current video with `Watch later`; confirm no navigation and one Videos card.
- [ ] Open the same video with `Watch full video`; confirm it is not implicitly duplicated/saved.
- [ ] Play, seek, pause, reload and confirm resume near the saved point.
- [ ] Confirm native CC appears when the selected video supplies English captions.
- [ ] Remove the video and confirm phrase/clip data remains.
- [ ] Repeat guest and signed-in list flows.
- [ ] Test mobile and desktop layout, keyboard focus, screen-reader labels and a blocked/private video fallback.

## Performance Testing

No load test is required for the bounded personal library. Verify progress writes occur no more frequently than the five-second cadence plus lifecycle flushes, list view makes no YouTube player request until a video is selected, and account list uses the `(user_id, updated_at)` index.

## Bug Tracking

Treat cross-user data exposure, arbitrary embed injection, or destructive phrase/example deletion as release-blocking. Treat provider unavailability as a recoverable error when the direct YouTube link remains available.

## Current Environment Limit

Local visual smoke could not start on 2026-08-25: the installed Workers runtime supports compatibility dates only through `2026-05-22`, while the project requires `2026-08-23`. This is an environment/toolchain mismatch, not evidence for or against runtime behavior. Preview D1 and real YouTube/YouGlish smoke therefore remain unchecked.

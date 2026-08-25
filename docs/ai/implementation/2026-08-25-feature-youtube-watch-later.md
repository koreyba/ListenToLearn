---
phase: implementation
title: YouTube Watch Later Implementation
description: Implemented files, decisions, evidence and remaining tasks
---

# YouTube Watch Later Implementation

## Development Setup

- Active worktree: `.worktrees/feature-youtube-watch-later`.
- Branch: `feature-youtube-watch-later`.
- Bootstrap: `npm ci`; baseline `npm run build` passed.
- Task tracing is unavailable because `ai-devkit` reports `unknown command 'task'`.

## Code Structure

- `lib/guest-library.ts`: version-2 guest schema and bounded saved-video helpers.
- `lib/youtube-progress.ts`: pure browser-progress normalization/read/update/clear helpers.
- `tests/guest-library.test.mjs`: guest migration, validation, deduplication, independence and cap contracts.
- `tests/youtube-progress.test.mjs`: resume validation, completion reset and cap contracts.
- `db/schema.ts`, `drizzle/0009_absurd_blob.sql`: account saved-video table and indexes.
- `app/api/videos/route.ts`: authenticated list/upsert/remove API.
- `lib/auth.ts`: legacy-owner saved-video transfer.
- `lib/guest-access.ts`: public Videos page with protected account API.
- `app/videos/page.tsx`: account/guest library, direct selection, removal and browser-history synchronization.
- `app/videos/youtube-player.tsx`: official IFrame API lifecycle and browser-local resume writes.
- `lib/youtube-player.ts`: validated provider URLs and native player options.
- `public/trainer.html`: distinct clip save, video bookmark and direct full-video actions.

## Implementation Notes

### Completed T1-T3

- Existing guest phrases and saved examples survive v1-to-v2 normalization.
- A saved video is keyed by its 11-character YouTube video ID and stores optional origin phrase/query/caption.
- Duplicate guest saves keep stable identity/creation time, refresh non-empty origin context and move to the front.
- Removing a saved video never removes a phrase example.
- Guest videos and progress maps are capped at 200 newest records.
- Progress accepts only finite non-negative positions up to seven days and resets within ten seconds of known completion.

### TDD evidence

- Each behavior was first observed failing for the missing contract.
- Current targeted command: `node --experimental-strip-types --test tests/guest-library.test.mjs tests/youtube-progress.test.mjs`.
- Result: 15 passed, 0 failed.

### Completed T4-T7

- `saved_videos` is additive and unique per `(user_id, youtube_video_id)`.
- Optional origin phrase IDs are accepted only for visible preset/user-owned phrases.
- GET, upsert and delete bind the authenticated subject in every row operation.
- Duplicate account saves keep stable identity and creation time while refreshing non-empty origin context.
- Existing legacy-owner migration now carries and then removes legacy saved videos atomically with other user data.
- `/videos` is guest-public; `/api/videos` remains outside the guest allowlist.
- Fresh evidence: `npx tsc --noEmit` passed; 3 guest-boundary tests and 30 rendered/adjacent contracts passed.

### Completed T8-T12

- `/videos?video=<id>` plays a valid direct selection without a POST or YouGlish script.
- Cards list bounded account/guest records, show local resume time, update browser history, and remove only the video bookmark.
- The player requests native controls and English CC, cues stored `startSeconds`, saves every five seconds plus lifecycle events, and clears completed positions.
- The trainer keeps Tatoeba `Save track`, renames the YouGlish phrase example to `Save clip`, and adds independent `Watch later` and `Watch full video` actions.
- `Watch later` does not navigate; `Watch full video` does not save.
- Account request parsing is bounded and returns explicit 400/413 responses for invalid or oversized JSON.

## Integration Points

Guest helpers are called from the static trainer and `/videos` client page. Account persistence is available through `/api/videos`. Progress remains a pure value layer; browser JSON/localStorage error handling stays in the UI boundary.

## Error Handling

Malformed records are discarded without throwing. Invalid mutations return normalized unchanged state. Browser-storage and provider failures leave playback/list actions available with a bounded visible message.

## Security Notes

Only strict YouTube video IDs enter saved-video/progress state. No arbitrary URL, embed markup, transcript or media content is stored.

## Remaining Work

No implementation task remains. Runtime D1/provider and responsive visual smoke require a preview/runtime compatible with the project's `2026-08-23` Workers compatibility date and remain required before deployment.

## Final Verification

- Helper suites: 17 passed, 0 failed.
- Guest route boundary: 3 passed, 0 failed.
- Full `npm test` after syncing `origin/main`: production build succeeded; 33 passed, 0 failed.
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0 with two pre-existing generated-file warnings and zero errors.
- `git diff --check`: exit 0.
- Base and feature AI-doc lint: exit 0.

## Final Review

The implementation matches the approved split between phrase-bound clips and video-level bookmarks. Account queries are subject-scoped, guest/progress input is bounded, arbitrary embed URLs are rejected, the schema change is additive, browser history is synchronized, and deletion does not cascade into phrases/examples. No blocking code finding remains. Preview migration execution and real YouTube/YouGlish behavior are intentionally not claimed by automated evidence.

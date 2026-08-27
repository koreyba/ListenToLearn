---
phase: implementation
title: Stable YouGlish Saved-Video Restore Implementation
description: Implemented provider locator persistence, cold restore and independent timestamp resume
---

# Stable YouGlish Saved-Video Restore Implementation

## Development Setup

- Worktree: `.worktrees/feature-youglish-video-restore-anchor`.
- Branch: `feature-youglish-video-restore-anchor`.
- Base: `origin/main` at `0774bb6`.
- Dependencies: `npm ci`; no package was added.
- Migration: generated with `npm run db:generate`.
- Task tracing: active as `youglish-video-restore-anchor` without actor flags
  because two Codex processes matched the repository and attribution was ambiguous.

## Code Structure

- `public/youglish-video-restore.js`: pure marker extraction and bounded relative
  resume delta.
- `public/trainer.html`: immutable per-video locator capture, guest persistence,
  Full Video URL/state, saved-accent fetch and one-shot resume movement.
- `lib/youglish-full-video.ts`: typed new-format origin and URL contract.
- `lib/guest-library.ts`: guest normalization/upsert requiring `restoreQuery`.
- `app/api/videos/route.ts`, `db/schema.ts`, `drizzle/0014_square_spectrum.sql`:
  account validation, round-trip, legacy-row filtering and append-only schema.
- `app/videos/page.tsx`: new-format direct-link and card navigation.
- `lib/auth.ts`: ownership transfer retains `restore_query`.
- `lib/guest-access.ts`: exposes the browser helper to public trainer sessions.
- Focused contracts live in `tests/youglish-video-restore.test.mjs`,
  `tests/youglish-caption-navigation.test.mjs` and the existing guest/API/rendered
  suites.

## Implemented Behavior

### Stable discovery identity

The trainer extracts YouGlish text inside `[[[...]]]` from the decoded provider
caption. The first non-empty match is cached for the active video and remains
unchanged as playback advances through later unmarked captions. A new fetch/video
session clears the cache. `Continue in video` is available only when both a
valid video ID and cached locator exist.

This immutable cache was added during implementation alignment: reading only the
current caption satisfied the initial happy path but lost the locator after the
next caption. The added RED browser contract caught and closed that gap without
changing the approved architecture.

### New-format persistence

`restoreQuery` is required by the guest save/upsert, typed Full Video origin,
trainer URL builder and account POST API. D1 stores it in
`restore_query TEXT NOT NULL DEFAULT ''`. Account GET excludes empty values and
guest normalization drops records without the field, intentionally implementing
the accepted loss of old saved videos without inference or retry code.

The account upsert refreshes the locator for a newly observed valid result.
Deduplication, owner scope, bounds, display query/caption and progress storage are
unchanged.

### Cold restore and resume

Cold Full Video initialization requires `videoId`, `originQuery` and
`restoreQuery`, then sends exactly `restoreQuery #videoId` with the saved
US/UK accent (or omits accent for All). `resumeCaption` remains progress metadata
and is never a search key. The existing `onVideoChange` expected-ID guard remains.

After the anchor caption arrives, the trainer clears a one-shot pending flag and,
when both times are finite and bounded, calls
`widget.move(resumeTime - current_time)`. It waits for the resumed caption before
restoring pause and persisting progress. Missing timing, a negligible delta or a
movement error falls back to the stable anchor without another search.

### Warm transition

The current widget is still paused and reused; no new fetch or navigation occurs.
The warm URL, guest/account history and later progress sync all carry the same
cached locator.

## Error Handling and Boundaries

- Invalid/missing locator records are rejected on write and absent on read.
- Marker absence keeps Continue unavailable rather than inventing a query.
- Provider timing is optional and never fabricated.
- Relative movement is bounded to the existing seven-day progress limit.
- Wrong-video callbacks still show the restore error and are not activated.
- Account access remains subject-scoped; guest state remains local and bounded.
- No YouTube integration, transcript request, provider scraping, deployment or
  production data operation was added.

## TDD and Verification Evidence

- Helper RED: 2 failures on the missing browser helper; GREEN: 2/2.
- Persistence/URL RED: 7 failures across guest, URL and D1 contracts; GREEN:
  19/19 focused contracts.
- Cold widget RED captured the exact old request:
  `mutable last caption #w66ecIT-Xkk`, accent `us`; GREEN uses
  `the actual match #w66ecIT-Xkk`, accent `uk`, and one `move(300)`.
- Public helper access RED: 1 allowlist failure; GREEN: 4/4 guest access tests.
- Advanced-caption locator RED: Continue became hidden after the next unmarked
  caption; GREEN retains the original locator and warm transition.
- Latest focused integration run: 143/143 passed.
- `npm test`: fresh build and 241/241 repository tests passed.
- ESLint reports 0 errors and two existing generated-file warnings; TypeScript,
  lifecycle lint and diff checks pass.
- Mutation proof fails on the old mutable-caption query and returns to GREEN on
  the implemented locator.

## Final Review

- No blocking, important or nice-to-have code finding remains.
- All typed and inline call sites carry `restoreQuery`; no caller was left on the
  old Full Video origin contract.
- Guest and account persistence enforce the same new-format boundary, and SQL
  placeholders/migration snapshots are consistent.
- The new helper has no dependency and is available through the guest asset
  allowlist; `npm ls --depth=0` reports a valid dependency tree.
- The migration is additive and reproducible: a second `npm run db:generate`
  reports no schema changes.
- Rollback cannot recover old data and does not attempt to; this matches the
  accepted scope and is documented explicitly.

The feature is ready to commit, push and open as a pull request. Merge and
deployment remain outside this lifecycle.

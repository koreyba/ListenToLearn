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
  Full Video URL/state, saved-accent fetch and confirmed bounded resume movement.
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

After the anchor caption arrives, the trainer retains the pending request until
the embedded player reports `onPlayerReady` and `PLAYING`. A real local trace
showed that YouGlish omits `current_time` on that first matched caption and
provides it on the next caption. The paused cold player is therefore started and
restore remains pending across the untimed anchor. Once a later callback has a
finite timestamp, the trainer calls `widget.move(resumeTime - current_time)` but
does not treat the returned fire-and-forget call as success. It waits for a later
timed caption: reaching the target within one second restores pause and progress,
while a timestamp still far away recalculates the delta and permits another
movement. Only a new timed caption can unlock a retry, and one cold restore is
capped at three moves.
A negligible delta completes at the observed caption without another search;
exhausted retries keep playback usable and display a resume error without
overwriting the known-good saved target.

The original PR implementation called `move` directly from the first caption
callback while cold Full Video used `autoStart: 0`. Its fake widget always fired
`onPlayerReady` before captions and recorded commands even when the provider
would not accept them, so the test proved an attempted call rather than an
effective resume. The callback-safe state machine and provider-readiness fake
close that preview-reported gap.

The second preview retest showed that readiness was still insufficient: the
documented widget method only posts a movement command and provides no completion
acknowledgement. The new feedback loop keeps the intent pending until
`onCaptionChange.current_time` confirms the result. Synthetic provider-state
noise cannot duplicate a move, and repeated unconfirmed callbacks stop after
three attempts.

The third preview retest exposed the actual upstream gate: the first matched
caption callback had `current_time: null`, and the implementation cleared the
resume request before any move path could run. A local provider run reproduced
`null`, then `468.924`, issued bounded deltas toward saved `470.574`, confirmed
`470.810`, and paused. The production change is deliberately one branch: an
untimed anchor requests or continues playback instead of clearing restore.

Transient `BUFFERING`/pause callbacks during controlled startup do not persist
the anchor timestamp. Progress writes remain suspended until the target caption
settles the restore, preventing a failed or interrupted attempt from replacing
the previously correct saved position. If all three moves remain unconfirmed,
automatic progress stays blocked for that failed Full Video session.

Cold resume now exposes the same state machine to the learner. The normally
hidden provider status is supplemented by a dedicated semantic output inside
the video frame. It renders a large `Restoring to mm:ss…` banner with a
reduced-motion-safe spinner before player readiness. Absolute positioning keeps
the banner attached to the media, while `pointer-events: none` lets clicks reach
the native YouGlish player, including pause and volume controls. Fetch,
video-change, readiness and untimed-caption callbacks preserve the message.
Confirming the target hides the banner and records `Full video ready at mm:ss.`;
provider errors hide it before displaying their existing error text. No timeout,
widget command or resume calculation was added, and the player is neither hidden
nor muted.

### Warm transition

The current widget is still paused and reused; no new fetch or navigation occurs.
The warm URL, guest/account history and later progress sync all carry the same
cached locator.

## Error Handling and Boundaries

- Invalid/missing locator records are rejected on write and absent on read.
- Marker absence keeps Continue unavailable rather than inventing a query.
- Provider timing is optional and never fabricated; an untimed first caption
  waits for a later timed callback.
- Pending resume is visible and accessible without making an unconfirmed
  provider movement look complete.
- Restoring feedback does not capture pointer input or remove access to the
  provider's own playback and volume controls.
- Relative movement is bounded to the existing seven-day progress limit.
- Resume attempts are callback-gated and capped at three per cold open.
- Wrong-video callbacks still show the restore error and are not activated.
- Account access remains subject-scoped; guest state remains local and bounded.
- No YouTube integration, transcript request, provider scraping, deployment or
  production data operation was added.
- Sanitized caption tracing is opt-in on localhost and the branch-preview host;
  it remains disabled on `unmumble.online` even when the query flag is present.

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
- Preview-follow-up mutation proofs fail when readiness/playing gates are removed
  and when buffering is allowed to overwrite progress; both return to GREEN with
  the callback-safe state machine and progress-write guard restored.
- Callback-confirmation mutation proof fails with one movement instead of the
  required retry when pending state is cleared before `widget.move`, then returns
  to GREEN when provider confirmation owns completion again.
- Final follow-up verification: fresh Vinext build and 244/244 repository tests
  pass; TypeScript, lifecycle lint and diff checks pass; ESLint remains at zero
  errors with the same two generated-file warnings.
- The post-push Sonar findings were resolved by decomposing the resume coordinator
  and replacing the marker regex with a bounded forward `indexOf` scan.
- In-player banner RED had no dedicated media-frame output; GREEN adds the
  prominent pass-through overlay without changing provider commands. A mutation
  to `pointer-events: auto` fails the focused rendered contract. The real local
  widget hit-test at the banner center resolves to `iframe#fr_yg-widget`, and the
  banner hides after the provider confirms the saved target.
- Final banner verification passes 246/246 repository tests, TypeScript,
  lifecycle lint and diff checks; ESLint remains at zero errors with the same two
  generated-file warnings.

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

The feature and preview follow-up are published on PR #26. Merge and production
deployment remain outside this lifecycle.

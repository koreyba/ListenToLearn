---
phase: design
title: Stable YouGlish Saved-Video Restore Design
description: Persist a provider-derived restore anchor and keep playback progress independent
---

# Stable YouGlish Saved-Video Restore Design

## Architecture Overview

```mermaid
flowchart LR
  Result[YouGlish result caption] --> Extract[Extract marked restoreQuery]
  Extract --> Measure[Measure restoreAnchorTime]
  Measure --> Save[Save video identity]
  Save --> Guest[Guest localStorage]
  Save --> Account[D1 saved_videos]
  Guest --> Videos[/videos]
  Account --> Videos
  Videos --> URL[Trainer URL with restoreQuery and progress]
  URL --> Fetch[fetch restoreQuery plus videoId with saved accent]
  Fetch --> Verify[Verify onVideoChange videoId]
  Verify --> Resume[Move from saved anchor on first PLAYING]
  Resume --> Player[Full Video Mode]
```

Restore and resume are deliberately separate. A stable provider-derived locator
selects the video; mutable local/account progress selects a later playback point.

## Data Model

Add `restore_query TEXT NOT NULL DEFAULT ''` and
`restore_anchor_seconds REAL NOT NULL DEFAULT -1` to `saved_videos`; add
`restoreQuery` and `restoreAnchorTime` to the guest/account public record.

```text
identity: videoId, restoreQuery, restoreAnchorTime, language, accent
display context: originPhraseId, originQuery, originCaption
progress: resumeSeconds, resumeCaptionId, resumeCaptionText, progressUpdatedAt
```

New writes require `videoId`, `originQuery`, `restoreQuery` and a finite,
non-negative `restoreAnchorTime`. Account reads filter out `restore_query = ''`
and `restore_anchor_seconds < 0`; guest normalization drops records without the
same fields. This intentionally retires legacy records without migration heuristics.
Deduplication remains `(userId, videoId)` / `videoId`, and an upsert refreshes the
locator from the current verified YouGlish result.

## API and URL Contracts

- `POST /api/videos` accepts and validates `restoreQuery` (240 characters) and
  `restoreAnchorTime` (0 through seven days).
- `GET /api/videos` returns both fields only for new-format rows.
- The one-time legacy-owner account copy includes `restore_query`, so a valid
  new-format record is not downgraded while ownership is transferred.
- `buildFullVideoTrainerUrl` requires both restore fields and emits them as
  `restoreQuery` and `restoreAnchorTime`. `query` remains display/phrase context.
- Resume caption ID/text remain optional diagnostics and local navigation state;
  they are never passed to `widget.fetch`.
- Full Video initialization calls
  `widget.fetch(videoSpecificQuery(restoreQuery, videoId), "english", accent)`;
  the accent argument is omitted only for saved `All`.

## Browser Components

- `public/youglish-video-restore.js` owns pure browser helpers for extracting all
  `[[[...]]]` match segments and calculating a safe relative resume delta.
- `public/trainer.html` loads the helper before trainer initialization, captures
  the locator in `currentVideoOrigin`, and shows `Continue in video` only after a
  valid video ID and marked match are both available.
- The warm transition stores/pushes the same `restoreQuery` but does not refetch.
- Cold initialization and Full Video `popstate` both require the new locator.
- During discovery, the first matched callback starts a media-time clock. The
  first later finite caption timestamp minus accumulated `PLAYING` time becomes
  `restoreAnchorTime`; buffering and pause stop the clock. Continue becomes
  available only after this value is measured and all persistence paths carry it.
- Cold resume verifies the expected video, waits for `onPlayerReady`, requests
  playback when needed, and sends
  `move(resumeTime - restoreAnchorTime)` in the first `PLAYING` callback without
  waiting for any cold-load caption. The command remains pending until a later
  `onCaptionChange.current_time` confirms the target within one second. A
  callback still far from the target recalculates the relative delta and permits
  another move, capped at three attempts; player-state noise alone cannot resend
  it. A negligible delta completes restore without a move. Resume values retain
  the existing seven-day upper bound before they can become a provider movement.
- Buffering/pause callbacks produced by this controlled startup cannot persist
  anchor progress over the saved target; progress writes resume only after the
  restore has settled. Exhausted retries keep automatic progress blocked for
  that failed session so the known-good saved target is not replaced by the
  phrase anchor.
- A dedicated semantic output inside `.widget-frame` becomes a prominent banner
  only while cold resume is pending. It shows `Restoring to mm:ss…` with a
  reduced-motion-safe activity indicator, survives fetch/readiness/caption
  callbacks, and is removed only by confirmed completion or a provider error.
  Absolute positioning keeps it visually attached to the video, while
  `pointer-events: none` leaves the underlying YouGlish pause, volume and other
  player interactions available. Provider errors continue to use the separate
  status output outside the iframe.
- `onVideoChange` keeps the existing expected-video guard.

## Resume State Machine

```mermaid
stateDiagram-v2
  [*] --> Fetching: cold Full Video URL
  Fetching --> Rejected: different video ID
  Fetching --> Verified: expected video ID
  Verified --> ReadyWait: player is not ready
  ReadyWait --> PlayWait: onPlayerReady
  Verified --> PlayWait: player ready but paused
  PlayWait --> Seeking: first PLAYING uses saved anchor
  Seeking --> Seeking: timed caption still far and attempts remain
  Seeking --> Failed: three moves remain unconfirmed
  Anchor --> Ready: already near target
  Seeking --> Ready: resumed caption callback
  Ready --> [*]: playback and progress continue
```

## Design Decisions

- Provider markers are chosen over `originQuery` because they represent the
  actual match returned for that video.
- A schema field is chosen over recomputing the locator later because marker
  information exists only during discovery.
- Relative resume uses documented `widget.move`; direct iframe or YouTube access
  is not introduced.
- A provider command being callable is not treated as proof that the embedded
  player is ready. Resume movement is gated by `onPlayerReady` and `PLAYING` so a
  paused or still-loading widget cannot silently discard the initial command.
- A returned `widget.move` call is not treated as acknowledgement. Only a later
  provider timestamp confirms movement; retries are callback-gated and bounded.
- An untimed cold first caption is irrelevant to initial movement because the
  phrase anchor was already measured and persisted during discovery.
- Full Video entry does not synthesize a pause. Warm entry preserves the current
  widget state, and cold restore keeps playing after provider confirmation.
- Legacy rows are filtered/dropped rather than migrated because the missing
  provider marker cannot be reconstructed reliably and the user accepted loss.

## Security, Privacy, and Performance

- Locator/query inputs use existing bounded plain-text normalization; no HTML is
  rendered from them.
- Account reads/writes remain session subject-scoped and guest data remains local.
- The cold path performs one provider fetch and at most three relative moves; no
  extra search retries or transcript requests are added.
- The restoring indicator adds no timer, provider command, request or seek; it
  only reflects the existing resume state machine.
- The banner does not hide, disable or mute the cross-origin widget; it adds one
  composited overlay only during the existing pending interval.

## Rollout

- Ship one append-only D1 migration with the `-1` anchor default required for
  existing tables; do not backfill or infer values.
- Deploying the migration before or with application code is safe: old rows stay
  stored but are absent from API results, and guest normalization drops the
  equivalent old local records.
- The deliverable for this lifecycle is a reviewed pull request. Deployment and
  production data mutation are outside the authorized scope.

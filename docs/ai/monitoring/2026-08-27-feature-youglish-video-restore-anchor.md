---
phase: monitoring
title: Stable YouGlish Saved-Video Restore Monitoring
description: Privacy-safe signals and smoke checks for new-format YouGlish video restores
---

# Stable YouGlish Saved-Video Restore Monitoring

## Key Signals

- `POST /api/videos` 400 responses for missing `restoreQuery` or
  `restoreAnchorTime` after release.
- Worker errors from saved-video GET/POST or D1 migration mismatch.
- User-visible “YouGlish could not restore the saved video” errors.
- Fresh Videos cards that produce “No examples found” on cold open.
- Continue remaining unavailable after a marked YouGlish result loads.
- More than three or very large relative resume movements for one cold open.

## Tools and Logging

Use existing CI, Cloudflare build/runtime logs and branch-preview smoke checks.
No analytics or provider polling is added.

Do not log caption bodies, `restoreQuery`, resume-caption text, provider query
content, auth headers or user identity beyond existing platform diagnostics.
The deterministic tests use synthetic text and the existing trace stays sanitized.

## Health Checks

- Guest and account: add a fresh result, advance to an unmarked caption, and
  confirm Continue still records one card.
- Cold-open with US, UK and All; verify the first fetch uses the saved choice.
- Reopen with progress: no movement before `onPlayerReady`/`PLAYING`; the first
  `PLAYING` immediately moves from persisted `restoreAnchorTime` even when no
  cold caption callback has arrived. Corrections occur only after a still-distant
  timestamp and stop after three total moves; progress resumes only after a
  confirmed target.
- Simulate discovery with an untimed match followed by a timed caption: media
  elapsed during `PLAYING` is subtracted and pause/buffering time is excluded.
- Simulate a different video ID: the trainer rejects it.
- Confirm old empty-locator account/guest records remain absent.

## Incident Response

Treat cross-user exposure, failure of all new video writes, or cross-video restore
as release-blocking. Preserve the failing URL parameters and sanitized callback
order, reproduce through the fake-widget contract, and fix forward when possible.
The deployment document contains the non-destructive rollback boundary.

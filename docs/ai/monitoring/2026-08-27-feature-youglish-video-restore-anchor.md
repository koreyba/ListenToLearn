---
phase: monitoring
title: Stable YouGlish Saved-Video Restore Monitoring
description: Privacy-safe signals and smoke checks for new-format YouGlish video restores
---

# Stable YouGlish Saved-Video Restore Monitoring

## Key Signals

- `POST /api/videos` 400 responses for missing `restoreQuery` after release.
- Worker errors from saved-video GET/POST or D1 migration mismatch.
- User-visible “YouGlish could not restore the saved video” errors.
- Fresh Videos cards that produce “No examples found” on cold open.
- Continue remaining unavailable after a marked YouGlish result loads.
- Repeated or very large relative resume movements for one cold open.

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
- Reopen with progress: one relative movement at most, then normal playback.
- Simulate missing timing: correct video opens at the stable match with no move.
- Simulate a different video ID: the trainer rejects it.
- Confirm old empty-locator account/guest records remain absent.

## Incident Response

Treat cross-user exposure, failure of all new video writes, or cross-video restore
as release-blocking. Preserve the failing URL parameters and sanitized callback
order, reproduce through the fake-widget contract, and fix forward when possible.
The deployment document contains the non-destructive rollback boundary.

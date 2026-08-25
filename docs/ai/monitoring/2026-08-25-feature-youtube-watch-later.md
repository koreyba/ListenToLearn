---
phase: monitoring
title: YouGlish Full Video Mode Monitoring
description: Operational signals for saved-video, restore, caption and request-count failures
---

# YouGlish Full Video Mode Monitoring

## Current Status

R2 is implemented but not deployed. These are preview/production observation targets; no production runtime-health claim exists yet.

## Key Signals

- `/api/videos` validation/4xx/5xx rate and D1 errors.
- `/videos` library availability and `/trainer?fullVideo=1` shell availability.
- Restore outcome classes: success, missing query, video mismatch and provider/quota error.
- Fetch counts by transition class: warm entry, cold restore, caption progression, Listen/Back and explicit Retry.
- Caption-callback continuity during manual/provider smoke.
- Browser-history and no-autoplay regressions.

## Expected Request Contract

- Warm transition from a live matching result: 0 fetches.
- Cold page entry/reload: 1 automatic fetch.
- Caption changes, controls and preserved-widget Back: 0 fetches.
- A manual reload/navigation retry: 1 additional fetch.

Any automatic count above this contract is a release blocker and rollback signal.

## Logging Strategy

Log only bounded event/error classes, fetch counts, video-match booleans and timing tolerance outcomes. Never log request bodies, `originalQuery`, caption text, transcript-like callback streams, progress history, tokens or user-provided URLs.

## Alerts & Notifications

No new alert integration is planned. Treat repeated API 5xx/missing-table failures, cross-user ownership failures, unexpected fetches, wrong-video restore, or false successful positioning as rollback triggers.

## Health Checks

- Fetch `/videos` as a guest and verify the shared trainer shell is available.
- Verify unauthenticated `/api/videos` remains protected.
- With an authenticated test user, save/list/remove one fixed video without reading another user's data.
- Verify warm/cold fetch counts and paused resume at the last observed caption boundary.
- Verify captions continue and required controls remain enabled during playback.
- Verify missing-query/provider/quota failures retain bookmark, progress, remove/back and ordinary YouGlish/YouTube fallback actions.

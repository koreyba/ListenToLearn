---
phase: monitoring
title: YouTube Watch Later Monitoring
description: Operational signals for saved-video and direct-player failures
---

# YouTube Watch Later Monitoring

## Key Metrics

- `/api/videos` 4xx/5xx rate and D1 errors.
- `/videos` document availability.
- Client-visible YouTube IFrame API/player errors during manual smoke.
- Migration availability of `saved_videos` before rollout.

## Logging Strategy

Log server-side API failure class and operation without request bodies, captions, progress maps, tokens or user-provided URLs. Client provider errors remain a bounded visible status; do not send viewing history to application logs.

## Alerts & Notifications

No new alert integration in this increment. Treat repeated `/api/videos` 5xx, missing-table errors, or cross-user ownership failures as rollback triggers.

## Health Checks

- Fetch `/videos` as a guest and verify 200.
- Verify unauthenticated `/api/videos` remains protected.
- With an authenticated test user, save/list/remove one fixed video ID without reading another user's data.
- Verify direct player fallback link remains available when YouTube playback fails.

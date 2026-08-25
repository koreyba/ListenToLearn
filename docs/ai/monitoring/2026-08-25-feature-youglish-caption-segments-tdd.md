---
phase: monitoring
title: Monitoring & Observability
description: Define monitoring strategy, metrics, alerts, and incident response
---

# Monitoring & Observability

## Key Signals

- Browser console errors from rejected `move`, `play`, or Replay commands.
- Reports of enabled controls crossing a large unobserved time gap.
- Reports of history loss after Replay or `video A -> B -> A`.
- Reports that paused playback resumes after Replay or controlled Next.

## Monitoring Tools

No new telemetry is added. Use existing browser diagnostics and issue reports;
the deterministic fake-widget suite is the primary regression monitor.

## Logging Strategy

Existing client-side command errors remain in `console.error`. Do not log full
captions, user selections, or iframe contents.

## Alerts & Notifications

No automated alert is warranted for page-local navigation state. Treat a
reproducible cross-gap jump or irreversible busy controls as a release blocker.

## Dashboards

None added.

## Incident Response

Capture the provider event order (`onVideoChange`, `onCaptionChange`, player
state), caption IDs, optional timestamps, and button state. Reproduce it in the
fake-widget test before changing segment rules.

## Health Checks

- Automated: full `npm test` plus lint and TypeScript.
- Optional live smoke after deployment: three-caption navigation, paused Replay,
  distant manual seek, and return to a previous video.

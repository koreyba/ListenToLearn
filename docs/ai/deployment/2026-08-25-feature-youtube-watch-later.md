---
phase: deployment
title: YouGlish Full Video Mode Deployment
description: Provider gate, migration and rollout boundaries for caption-aware saved-video playback
---

# YouGlish Full Video Mode Deployment

## Current Gate

R2 code is ready for PR review. It must not be merged until preview applies the additive migration and the saved-video/provider smoke passes. Production deployment is not authorized by this task.

## Infrastructure

Use the existing Cloudflare Worker/Vinext deployment, YouGlish integration and D1 database. No transcript service, unofficial YouTube API or paid resource may be added by this feature.

## Deployment Pipeline

- Run targeted tests, TypeScript, ESLint, full `npm test`, `git diff --check`, and lifecycle lint.
- Inspect additive migration `0010_early_angel.sql` for language/accent metadata; `origin_query` already exists in `0009`.
- Apply the reconciled migration in preview before code that requires the new fields.
- Deploy only after explicit deployment authorization.

## Environment Configuration

No new environment variable is planned. Existing YouGlish configuration remains authoritative. If the provider requires a new commercial/quota agreement, stop for an explicit product decision rather than adding an unapproved credential or paid dependency.

## Preview Smoke Gate

1. Verify current D1 migration history and apply the reconciled additive migration.
2. Deploy a compatible preview Worker.
3. Prove guest/account save, deduplication, ownership and removal.
4. Prove warm Full Video entry uses zero fetches.
5. Prove cold reload uses one fetch and restores the last observed caption boundary paused.
6. Prove continuous captions and the retained/removed control matrix.
7. Prove `Listen`, Back/Forward, resume and quota/provider failure handling.
8. Repeat critical navigation/layout checks on desktop and mobile.

## Database Migrations

Migration `0010_early_angel.sql` adds non-null `language` and `accent` columns with compatible defaults. It preserves existing phrase examples and saved-video rows. Legacy rows without `originQuery` remain visible but cannot start a cold restore. No destructive down migration is authorized.

## Logging and Privacy

Do not log `originalQuery`, caption text, transcript-like callback streams, progress history or user identifiers. Bounded provider diagnostics may log event class, fetch count, video-ID match result, timing tolerance result and error category.

## Rollback Plan

Roll back the Worker if Full Video Mode adds unexpected searches, restores the wrong video/time, loses required caption controls, or regresses trainer/history flows. Leaving an additive compatible table/column in place is preferred to destructive rollback; removal requires separate authorization.

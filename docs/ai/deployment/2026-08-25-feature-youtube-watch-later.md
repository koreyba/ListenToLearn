---
phase: deployment
title: YouTube Watch Later Deployment
description: Migration and release boundaries for the saved-video library
---

# YouTube Watch Later Deployment

## Infrastructure

Use the existing Cloudflare Worker/Vinext deployment and D1 database. No new service, secret, API key or paid resource is introduced.

## Deployment Pipeline

- Run targeted Node tests, TypeScript, ESLint, full `npm test`, and `git diff --check`.
- Apply the generated `saved_videos` D1 migration in preview before deploying application code that calls `/api/videos`.
- Deploy through existing scripts only after explicit deployment authorization.

## Environment Configuration

No new environment variables. The YouTube IFrame Player derives `origin` at runtime from `window.location.origin`.

## Deployment Steps

1. Verify migration SQL and current D1 migration history.
2. Apply migration in preview.
3. Deploy preview Worker.
4. Smoke guest `/videos`, account API ownership, YouGlish save, direct YouTube playback and resume.
5. Apply production migration and deploy only with explicit approval.

## Database Migrations

The migration adds `saved_videos` and its unique/ordering indexes. It does not rewrite `phrase_examples`. Roll back application code before dropping data; no destructive down migration is provided.

## Secrets Management

No YouTube or YouGlish secret is added. Existing authentication and integration secrets remain unchanged.

## Rollback Plan

Roll back the Worker to the preceding version if `/videos` or `/api/videos` regresses adjacent flows. Leaving the additive table in place is safe; deleting it requires a separate explicitly authorized migration.

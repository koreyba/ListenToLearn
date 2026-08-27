---
phase: deployment
title: Stable YouGlish Saved-Video Restore Deployment
description: Append-only D1 migration and PR-only rollout for new-format saved videos
---

# Stable YouGlish Saved-Video Restore Deployment

## Infrastructure

- Existing Cloudflare Worker, D1 databases and branch-preview pipeline.
- One new public static helper: `/youglish-video-restore.js`.
- No new service, binding, secret, environment variable or paid dependency.

## Build and CI Gates

- `npm test` must build the Worker bundle and pass the complete Node suite.
- ESLint, TypeScript, AI DevKit feature lint and `git diff --check` must pass.
- CI must apply D1 migrations before uploading/promoting the Worker, as enforced
  by the existing deployment contract tests.

## Database Migration

`drizzle/0014_square_spectrum.sql` adds:

```sql
ALTER TABLE saved_videos ADD restore_query text DEFAULT '' NOT NULL;
```

The migration is append-only and deliberately performs no backfill. Existing
account rows keep an empty locator and are excluded by the new API. Existing
guest rows are dropped during browser normalization. This is the explicitly
accepted data-loss boundary.

## Release Steps

1. Review and merge the pull request only after required checks pass.
2. Apply the migration to the target D1 database through the existing deploy
   script before the new Worker version is promoted.
3. On a preview/new deployment, find a fresh YouGlish result, advance at least
   one caption, choose Continue, and verify one Videos card appears.
4. Cold-open that card and verify the expected video, saved accent and resume
   position. If the first provider move is ignored, verify a later timed caption
   triggers a bounded retry and that the target confirmation restores pause.
5. Verify an old row without `restore_query` is absent and no repair is attempted.

For branch-preview diagnosis only, append `captionTrace=1` and inspect the
sanitized caption-navigation trace. The same parameter must not enable tracing
on production.

This lifecycle publishes only a pull request. No preview or production deployment
is authorized or performed here.

## Rollback

- Revert the application commit/PR; the additive column may remain safely in D1.
- A rollback restores the previous cold-open behavior and may expose empty-locator
  legacy rows again, so prefer fixing forward if the migration has shipped.
- Do not delete or backfill production rows as part of rollback.

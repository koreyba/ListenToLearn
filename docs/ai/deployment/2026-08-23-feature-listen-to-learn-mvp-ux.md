---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Infrastructure

The existing Cloudflare Worker + D1 + static assets deployment remains unchanged. This feature adds no new binding, route, secret, or production environment.

## Release Gates

Run `npx tsc --noEmit`, `npm run lint`, `node --test tests/rendered-html.test.mjs`, `./node_modules/.bin/vinext build`, `git diff --check`, and `./node_modules/.bin/wrangler deploy --dry-run`. The dry-run passed on 2026-08-23.

## Database Migration

`drizzle/0005_special_ogun.sql` adds `phrases.context` with a non-null empty default. The route also keeps an idempotent runtime compatibility check for existing D1 state. Apply the normal migration during the authorized deployment; no migration was applied to production in this task.

## Secrets

No new secret is required by MVP UX. DeepL and provider credentials remain in the existing server-side integration configuration. Do not add OAuth or provider secrets to this branch.

## Deployment Status

Implementation is ready for review in the isolated feature branch. No push, deploy, migration against production, or external state change was performed.

## Rollback

Use the existing Worker version rollback procedure. Before deployment, verify the migration backup/restore policy; the additive context column is backward-compatible with the updated route and old rows default to an empty context.

---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Infrastructure

The existing Cloudflare Worker, static assets, and D1 deployment remain
unchanged. The feature adds one static browser helper and changes the existing
trainer page; it adds no binding, route, migration, or secret.

## Release Gates

Before publication, run `npm test`, `npx tsc --noEmit`, `npm run lint`,
`git diff --check`, and `npx ai-devkit@latest lint --feature phrase-navigation`.
Manual smoke must cover YouGlish timing events, cached and unobserved neighbors,
repeat on/off, provider fallback, and the existing video controls.

## Deployment Status

The neighboring Google-auth task was confirmed merged into `origin/main` at
`3b607bf`. After synchronization and post-merge gates, the feature branch was
first pushed at `9fb6f7c` and its final remote HEAD is `77d5120`. No PR, deploy,
migration, or production state change was performed.

## Rollback

If published later, use the existing Worker version rollback. Since no schema or
server contract changes are involved, rollback is a static asset/code rollback;
there is no migration to reverse.

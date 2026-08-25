---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Infrastructure

No infrastructure change. The existing client assets continue through the
current Cloudflare Worker/Sites build and deployment path.

## Deployment Pipeline
**How do we deploy changes?**

### Build Process

- `npm ci`
- `npm test` (includes the production build and deterministic controller tests)
- `npm run lint` and `npx tsc --noEmit`

### CI/CD Pipeline

Use the repository's existing pipeline. This task does not authorize a preview
or production deployment.

## Environment Configuration

No new bindings, variables, flags, secrets, or database configuration.

## Deployment Steps
**What's the release process?**

1. Require the automated gates above to pass.
2. Use the existing preview/release workflow after separate approval.
3. Smoke Replay, Previous/Next, manual distant seek, and `A -> B -> A`.
4. Roll back the client asset revision if provider behavior differs in live use.

## Database Migrations

None.

## Secrets Management

No secret changes.

## Rollback Plan

Revert this client-only change and redeploy through the existing release path.
No persistent caption data or schema needs recovery.

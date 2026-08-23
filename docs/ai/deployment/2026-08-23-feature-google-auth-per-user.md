---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Infrastructure
**Where will the application run?**

- Production is the Cloudflare Worker `listen-to-learn` with Static Assets and the existing D1 database `listen-to-learn-db`.
- Cloudflare Access protects the Worker hostname and delegates login to the existing Google IdP. No new paid Cloudflare product is required.
- This release has one production environment; local validation uses Vinext/Wrangler and SQLite-compatible migration checks.

## Deployment Pipeline
**How do we deploy changes?**

### Build Process
- Run `bash scripts/sites-env.sh -- node_modules/.bin/vinext build`.
- Deploy with `npx wrangler deploy` after the commit is merged into `main`.
- `wrangler.jsonc` supplies the Worker, Static Assets, D1 binding, Access team domain, and accepted Access audiences. Secrets remain in Cloudflare.

### CI/CD Pipeline
- Gates: lifecycle lint, TypeScript, ESLint, bounded production build, rendered HTML/user-context tests, local migration checks, and diff review.
- GitHub PR is the review boundary; the requested release is merged into `main` only after the gates pass.
- Production deployment is an explicit Wrangler command followed by Cloudflare API/D1 readback and authenticated smoke validation.

## Environment Configuration
**What settings differ per environment?**

### Development
- Use the repository Node engine and local non-committed values only. Local identity headers are test-only and never an authorization mechanism.

### Staging
- No staging Worker is created in this free-plan release.

### Production
- Access team domain: `listen-to-learn-koreyba.cloudflareaccess.com`.
- Accepted audiences are the host-wide `Listen to Learn` application and the existing Integrations application.
- Required secret: the existing `INTEGRATIONS_ENCRYPTION_KEY`; Google client secret remains managed by Access.
- Monitor request, CPU, and error metrics without logging JWTs or plaintext API keys.

## Deployment Steps
**What's the release process?**

1. Confirm the intended diff, fresh local gates, `origin/main`, and the free-plan resource boundary.
2. Commit, push the PR, merge it into `main`, and verify the merge is on `origin/main`.
3. Apply `drizzle/0006_google_auth_per_user.sql` with `npx wrangler d1 migrations apply listen-to-learn-db --remote`.
4. Build and deploy with `npx wrangler deploy`.
5. Read back Worker/Access/D1 state and perform Google login, library/trainer, DeepL-optional, logout, and isolation smoke checks.
6. If smoke fails, capture evidence and roll back the Worker version before considering any data rollback.

## Database Migrations
**How do we handle schema changes?**

- Migrations are append-only files in `drizzle/` and are applied remotely with Wrangler after merge.
- Before applying, read the remote schema and row counts; never print ciphertext or secrets. Use a D1 export before any destructive migration.
- `0005` preserves existing phrase/example/secret values while assigning them to the explicit legacy owner. It is not reverted by deleting rows; Worker rollback must remain schema-compatible.

## Secrets Management
**How do we handle sensitive data?**

- `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are non-secret vars. `INTEGRATIONS_ENCRYPTION_KEY` is a Cloudflare Worker secret.
- Google client secret is held by Cloudflare Access. DeepL keys are encrypted in D1 per user and never returned to the browser.
- Encryption-key rotation requires a planned re-encryption migration and is out of scope here.

## Rollback Plan
**What if something goes wrong?**

- Roll back for Worker startup failure, authentication loops, a 5xx spike, or cross-account data-scope regression.
- Restore the previous Worker version, preserve the D1 migration, and fix forward with a compatible release; do not perform an ad hoc destructive D1 rollback.
- Record the failed gate, deployed version, D1 migration state, and user-visible impact before retrying.

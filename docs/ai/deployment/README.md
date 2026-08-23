---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Infrastructure

Production runs as the `listen-to-learn` Cloudflare Worker with Workers Assets and the existing D1 database `listen-to-learn-db`. Cloudflare Access protects the owner-only Integrations paths. The current deployment uses the account's free Worker/D1/Zero Trust resources.

## Release steps

1. Run tests, type-check, lint, `vinext build`, and Wrangler dry-run.
2. Apply pending D1 migrations remotely.
3. Confirm `INTEGRATIONS_ENCRYPTION_KEY` exists as a Worker Secret; never print its value.
4. Deploy with Wrangler.
5. Smoke-test public 200 routes and protected 302 routes.

The current migration `0004_clever_blonde_phantom.sql` is applied remotely. The current verified deployment version is `299a4d43-b7e4-42d6-b5c7-6fa88e928bd5`.

## Secrets and rollback

Provider keys belong in the protected Integrations page and encrypted D1, not Git. The encryption master key is a Worker Secret. A Worker rollback can use a previously verified deployment; D1 migrations are forward-only in this change, so schema rollback requires an explicit reviewed migration.

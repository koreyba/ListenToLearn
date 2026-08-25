---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Infrastructure

Production runs as the `listen-to-learn` Cloudflare Worker with Workers Assets
and D1 database `listen-to-learn-db`. Non-production branches upload versions
of the single `listen-to-learn-preview` Worker. Every branch receives a stable
branch alias and every commit receives an immutable version URL; all of those
versions bind the shared `listen-to-learn-preview-db`. No per-branch Worker or
D1 database is created. Cloudflare Access protects Worker preview URLs.

## Release steps

1. Run tests, type-check, lint, `vinext build`, and Wrangler dry-run.
2. For a non-production branch, run `npm run deploy:branch-preview`. It uses
   `wrangler versions upload`, so the branch alias advances without replacing
   the active shared preview deployment.
3. Do not apply D1 migrations automatically from feature branches. Coordinate
   an explicit shared-preview migration only when a branch requires a new,
   backward-compatible schema.
4. On `main`, apply pending production D1 migrations and run the guarded
   production deploy.
5. Smoke-test public production routes and the Access-protected branch preview.

Workers Builds must have exactly one non-production trigger for this repository:
the `listen-to-learn` Git connection runs `npm run deploy:branch-preview` for
non-production branches. Do not reconnect `listen-to-learn-preview` to Git;
that would create a second trigger which could promote feature branches to the
active shared preview deployment.

The current migration `0004_clever_blonde_phantom.sql` is applied remotely. The current verified deployment version is `299a4d43-b7e4-42d6-b5c7-6fa88e928bd5`.

## Secrets and rollback

Provider keys belong in the protected Integrations page and encrypted D1, not
Git. The encryption master key is a Worker Secret. A production rollback can
use a previously verified deployment. Branch aliases move only when a new
version from the same branch uploads successfully; a failed build leaves the
previous alias intact.

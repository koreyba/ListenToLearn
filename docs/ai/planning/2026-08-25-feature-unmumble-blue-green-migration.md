---
phase: planning
title: Unmumble Blue-Green Migration Plan
description: Ordered, reversible migration from ListenToLearn to Unmumble
---

# Unmumble Blue-Green Migration Plan

## Milestone 1: Isolated workspace and preview data

- [x] Create `feature-unmumble-blue-green-migration` from fresh `origin/main`.
- [x] Install dependencies and pass the baseline build.
- [x] Create `unmumble-preview-db` in EEUR.
- [x] Bind the migration branch preview config only to the new D1.
- [x] Apply current migrations, copy source preview data, and verify parity.

## Milestone 2: Parallel preview Worker

- [x] Configure Worker `unmumble-preview` and preserve branch-version guards.
- [x] Generate and install a fresh integration-encryption secret.
- [x] Protect branch-preview URLs with preview-only Cloudflare Access.
- [x] Upload a branch alias and verify the Access redirect.

## Milestone 3: Product rename

- [x] Rename visible branding and package metadata to Unmumble.
- [x] Migrate browser-storage keys backward-compatibly.
- [x] Update current docs while preserving historical evidence.
- [x] Run lint, tests, build, and Wrangler dry-run.

## Milestone 4: Production candidate and cutover

- [x] Create `unmumble-prod-db` and Worker `unmumble-prod`.
- [x] Apply all migrations and install a fresh production encryption secret.
- [x] Route `unmumble.online` to `unmumble-prod` with managed HTTPS.
- [x] Add temporary single-user production Access and deploy its AUD.
- [ ] Merge the Google-auth branch and replace temporary all-traffic Access with
  the approved guest/private-route model.

## Milestone 5: Stabilization and decommission

- [ ] Observe the new stack for an agreed period.
- [ ] Archive old data and obtain separate deletion approval.
- [ ] Delete old resources only after rollback is no longer required.

## Resolved import issue

Direct full-export import failed because exported `phrases` data referenced the
not-yet-created `users` table. The target stayed empty. Schema-first,
dependency-ordered data import then completed with matching row counts and no
foreign-key violations.

## Current focus

Publish this branch for review, merge the parallel Google-auth work, and then
configure Workers Builds so `main` deploys `unmumble-prod` and non-production
branches upload versions to `unmumble-preview`.

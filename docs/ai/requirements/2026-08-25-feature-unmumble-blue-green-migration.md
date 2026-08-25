---
phase: requirements
title: Unmumble Blue-Green Migration Requirements
description: Rename ListenToLearn and build an isolated Unmumble Cloudflare stack
---

# Unmumble Blue-Green Migration Requirements

## Problem

ListenToLearn must become Unmumble with explicit preview and production names,
fresh Cloudflare resources, and `unmumble.online` as the working application
domain. The old stack remains available as a short-term rollback source.

## Goals

- Rename the product, package, repository metadata, and current documentation.
- Create Worker `unmumble-preview` with D1 `unmumble-preview-db`.
- Create Worker `unmumble-prod` with D1 `unmumble-prod-db`.
- Route `unmumble.online` to `unmumble-prod` with Cloudflare-managed TLS.
- Protect branch previews and the current single-user production site with
  Cloudflare Access.
- Preserve browser data where inexpensive; copied integration secrets are not a
  requirement because neither new database contains them.

## Current increment

- Rename product code and browser-storage keys to Unmumble.
- Provision and deploy the two explicitly named Workers and databases.
- Generate fresh per-Worker integration-encryption secrets.
- Attach `unmumble.online` and verify HTTPS, Access, bindings, and database
  integrity.

## Non-goals

- No deletion of old ListenToLearn Workers or D1 databases in this increment.
- No Zero Trust account-subdomain rename while the parallel Google-auth branch
  still depends on the account-level Access configuration.
- No secret values in source, logs, documentation, or chat.

## Acceptance criteria

- Old Worker and D1 resources remain available.
- Both new D1 databases have all migrations, baseline phrases, and no
  foreign-key violations.
- Wrangler configs pin preview and production to their matching resources.
- Deployment guards continue to prevent accidental production deployment.
- The custom domain serves `unmumble-prod`; branch-preview aliases require
  Access.

## Hard gates

- `INTEGRATIONS_ENCRYPTION_KEY` must exist as a Cloudflare Worker secret in both
  new Workers and must never be committed or printed.
- The production all-traffic Access policy is temporary until the Google-auth
  branch is merged and route-level guest/auth behavior is revalidated.

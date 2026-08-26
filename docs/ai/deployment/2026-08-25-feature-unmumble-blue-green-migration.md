---
phase: deployment
title: Unmumble Blue-Green Deployment
description: Safe deployment and cutover sequence for the parallel Cloudflare stack
---

# Unmumble Blue-Green Deployment

## Preview

1. Apply migrations to `unmumble-preview-db` before uploading Worker code.
2. Install the Worker encryption secret without writing it to source or logs.
3. Keep the Worker Access scope at `Previews only`.
4. Upload branch versions through the pinned `branch-preview` target.
5. Promote `unmumble-preview` only for deliberate shared-preview checks.

The production deploy command remains explicitly gated with
`ALLOW_PRODUCTION_DEPLOY=1`.

## Production custom domain

The production hostname is `unmumble.online`, attached to `unmumble-prod` as a
Worker Custom Domain. Cloudflare created the routing/DNS integration and serves
managed HTTPS; no purchased Worker certificate is needed.

Production currently uses temporary all-traffic Access for the owner's account.
After the Google-auth branch is merged, revalidate route-level Access before
restoring public guest navigation.

## Builds after merge

- Configure `unmumble-prod` Workers Builds to deploy only `main` with the
  guarded production target.
- Configure non-production branches to upload versions to `unmumble-preview`.
- Disable the old ListenToLearn triggers only after the new triggers pass.

## Rollback

Before old-resource deletion, rollback is to remove the new custom-domain route
or return it to the old Worker and reopen the old production database. Old
resources require separate approval before deletion.

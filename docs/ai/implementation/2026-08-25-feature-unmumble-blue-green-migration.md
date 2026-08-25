---
phase: implementation
title: Unmumble Blue-Green Migration Implementation
description: Evidence and decisions for the parallel Cloudflare stack
---

# Unmumble Blue-Green Migration Implementation

## Workspace

- Worktree: `.worktrees/feature-unmumble-blue-green-migration`
- Branch: `feature-unmumble-blue-green-migration`
- Base: `origin/main` at `660707d`
- Bootstrap: `npm ci`; baseline `npm run build` passed.

## Cloudflare resources

- Source preview D1: `listen-to-learn-preview-db`
  (`2c137ca2-8b12-498f-98df-127eaa39e6d8`, EEUR).
- Target preview D1: `unmumble-preview-db`
  (`0d361b44-60ef-4c5b-b2ea-fe9d4d5020f1`, EEUR).
- Target production D1: `unmumble-prod-db`
  (`9e187b50-9012-45d9-aeec-40a573e59d79`, EEUR).
- Workers: `unmumble-preview` and `unmumble-prod`.
- Custom Domain: `unmumble.online` on `unmumble-prod`.
- Old ListenToLearn resources were not changed.

## Decisions and evidence

- A direct Wrangler full-export import failed with `no such table: main.users`.
  D1 rolled the import back; target remained at zero tables.
- Continue with current migrations first, then dependency-ordered data-only
  exports. Keep `d1_migrations` created by Wrangler migrations.
- The user explicitly accepted fresh production data and keys; encrypted-secret
  portability is no longer a cutover gate because both new D1 databases have
  zero integration-secret rows.

## Completed preview-data increment

- `wrangler.jsonc` preview environment and `wrangler.preview.jsonc` target
  `unmumble-preview` and only `unmumble-preview-db`.
- The deploy wrapper pins preview operations to `unmumble-preview` and guarded
  production operations to `unmumble-prod`.
- All migrations through `0010_early_angel.sql` are applied on the target.
- Source and target contain 1 user, 50 phrases, and zero rows in each remaining
  application table.
- `PRAGMA foreign_key_check` returned no rows; `saved_videos` contains `accent`
  and `language` columns.
- The private temporary SQL export was moved to Trash after verification.

## Completed product-rename increment

- Visible product branding, page metadata, package metadata, Worker comments,
  internal headers, and the caption-navigation browser namespace now use
  Unmumble.
- Browser state now uses `unmumble-*` keys. Reads copy legacy values into the
  new keys, while writes temporarily update both formats for rollback safety.
- The storage compatibility logic is shared by the React surfaces and mirrored
  in the standalone trainer.
- Integration-secret AES-GCM AAD values remain `listen-to-learn:*`; changing
  them would make existing encrypted values unreadable.
- Historical trace schemas, account-level Access domain, old production Worker
  and D1 names, and legacy migration inputs remain unchanged intentionally.
- README and current migration documents describe Unmumble while historical
  evidence is preserved.

## Next implementation

- Merge the parallel Google-auth branch, revalidate guest/private route
  semantics, and configure Workers Builds for the new Worker names.

## Completed Cloudflare cutover increment

- Created `unmumble-prod-db` in EEUR and applied migrations `0000` through
  `0010`.
- Generated distinct 32-byte base64url AES-GCM secrets and installed them as
  `INTEGRATIONS_ENCRYPTION_KEY` in both new Workers; values were never logged or
  persisted locally.
- Configured preview-only Access for `unmumble-preview` and verified a branch
  alias redirects with the new application AUD.
- Configured temporary all-traffic Access for `unmumble-prod`, deployed its new
  AUD, and routed `unmumble.online` as a Custom Domain.
- Deleted the temporary unqualified Worker `preview`; it had no route or unique
  data and is recoverable only by redeployment.
- Active production version at verification time:
  `79938b0b-65b3-4d01-8f13-df40ea7e6361`.

## Verification

- AI docs lint passed for `unmumble-blue-green-migration`.
- All direct Node tests passed 148/148; the build-backed `npm test` suite passed
  134/134.
- Rename contract tests passed 3/3, including legacy storage migration and
  encryption-AAD preservation.
- ESLint completed with 0 errors and 2 warnings in generated Wrangler types.
- Preview Wrangler dry-run reported only `unmumble-preview-db`.
- `git diff --check` returned no errors.
- `unmumble.online` returned the expected Access redirect after production
  policy activation; before activation its HTTPS guest response returned 200.
- Both new D1 databases contain 50 phrases, 1 baseline user, zero integration
  secrets, and no foreign-key violations.

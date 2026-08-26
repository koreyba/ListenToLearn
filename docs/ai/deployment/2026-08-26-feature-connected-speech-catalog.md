---
phase: deployment
title: Connected speech catalog deployment
description: Migration-first preview and production release contract for the typed catalog and Library
---

# Connected Speech Catalog Deployment

## Scope and Authorization

This feature adds Worker application code plus append-only D1 migration `0013_kind_trauma.sql`. The initial lifecycle run authorized commit, push, and PR creation only. After the preview exposed a missing-table error, the user explicitly authorized applying `0013` to preview D1 and automating preview migrations. Merge, production deployment, and production D1 mutation remain unauthorized.

## Infrastructure

- Cloudflare Worker/Vinext application with static assets.
- Separate preview and production Workers and D1 databases from `wrangler.jsonc`.
- No new service, binding, secret, provider, queue, or storage product.

## Release Gates

Before any authorized deployment:

1. Required PR checks are green and the reviewed commit SHA is fixed.
2. `node --test tests/*.test.mjs`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass for that SHA.
3. AI DevKit base/feature lint and `git diff --check` pass.
4. A clean local D1 migration produces 140 active analyses, 230 mechanism links, 154 phrase rows, and zero foreign-key violations.
5. A legacy upgrade fixture preserves progress, examples, video origins, and existing preset timestamps.

## Deployment Order

The database migration must precede application traffic because the new APIs query the optional-analysis tables.

### Preview

1. Confirm the target is the preview Worker and `unmumble-preview-db`.
2. Run the repository preview deployment wrapper. It applies pending preview D1 migrations before either branch-version upload or named-preview deployment and stops if migration application fails.
3. Verify the migration counts and `PRAGMA foreign_key_check`.
4. Upload/deploy the reviewed application commit only after the migration step succeeds.
5. Smoke `/library`, `/practice`, `/api/catalog`, account phrases, text-only custom creation, Add/Undo, and 390px/1200px layouts.
6. Observe the preview signals in the monitoring document before requesting production authorization.

### Production

1. Obtain explicit production approval and record the reviewed SHA.
2. Take the normal recoverable D1 backup/export checkpoint before migration.
3. Apply migration `0013_kind_trauma.sql` to production D1.
4. Verify counts, references, and foreign-key integrity before deploying application code.
5. Deploy the same reviewed SHA and run the bounded production smoke.

## Migration Safety

- The migration creates optional analysis/mechanism tables and upserts the 140 active cards.
- It does not delete or overwrite progress, examples, video origins, translations, statuses, or existing preset timestamps.
- Thirty-six reused preset IDs retain their references; fourteen unmatched presets remain without active analysis.
- The generator is deterministic and validates the canonical TypeScript catalog before writing SQL.

## Rollback

- If migration validation fails, stop before application deployment and restore/recover according to the normal D1 procedure.
- If the application smoke fails after a successful migration, roll the Worker back to the previous application version. The additive tables and retained phrase rows are compatible with the previous code and should remain in place.
- Do not delete catalog rows, analysis tables, or user data as an ad-hoc rollback.

## Secrets and Configuration

No new secrets or environment variables are required. Existing Access, D1, and translation-provider configuration remains unchanged.

## Preview Incident Evidence

- The failing preview had `0012_app_sessions.sql` as its latest applied migration; `0013_kind_trauma.sql` was pending and both catalog tables were absent.
- The authorized remote preview application completed all 515 statements successfully.
- The post-application preview database has no pending migrations, 140 active analyses, 230 mechanism links, 154 phrase rows, and no foreign-key violations.
- Production D1 was not queried or mutated during the incident fix.

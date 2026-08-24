---
phase: deployment
title: Deployment Strategy
description: Define deployment process, infrastructure, and release procedures
---

# Deployment Strategy

## Production target

ListenToLearn runs as the existing `listen-to-learn` Cloudflare Worker with Workers Assets and the existing D1 database `listen-to-learn-db`. The rollout adds no KV, R2, Durable Objects, Queues, Pages project, migration or paid product.

## Release evidence

- PR #5 merged the guest mode: `https://github.com/koreyba/ListenToLearn/pull/5`.
- PR #7 merged the production `/trainer` allowlist fix: `https://github.com/koreyba/ListenToLearn/pull/7`.
- Production deployment completed with Wrangler from merged code.
- Final Worker version: `f0fca2e8-75d3-46c7-b317-1c9f725c23d9`.
- Worker startup time: 19 ms; upload: 1,397.94 KiB (311.21 KiB gzip).

## Access rollout

The existing host-wide Access application `0d7ca644-4813-47a7-b973-bfa748141aff` was updated through Cloudflare MCP and read back successfully at `2026-08-23T21:19:31Z`. Its destinations are limited to `/login`, `/api/me`, `/api/phrases`, `/api/examples` and `/api/translate`. The existing Integrations application remains separate and protected for `/integrations` and `/api/integrations`; both Access audiences remain in `wrangler.jsonc`.

## Build and deploy procedure

1. Run `npx tsc --noEmit`, `npm run lint`, `node --test tests/*.test.mjs`, `git diff --check` and direct `vinext build`.
2. Run `node_modules/.bin/wrangler deploy --dry-run`.
3. Deploy with `node_modules/.bin/wrangler deploy` after merge to `main`.
4. Read back the Worker version and Access app through Cloudflare API/MCP.
5. Smoke public UI/Tatoeba, protected API/Integrations redirects and D1 row counts.

Historical note: the repository build wrapper could not run on macOS during this feature delivery. It was made portable with `scripts/run-bounded.mjs` on 2026-08-24; the equivalent direct `vinext build` had passed at delivery time.

## Database and secrets

No D1 schema change was introduced. Guest actions use browser localStorage and must not create rows. DeepL and other provider credentials remain encrypted/server-side and are unavailable in guest mode.

## Rollback

If production regresses, first restore the previous verified Worker version with Wrangler. If Access matching regresses, restore the prior host application destinations through the same Access API. Do not delete or reset D1 data as a first response.

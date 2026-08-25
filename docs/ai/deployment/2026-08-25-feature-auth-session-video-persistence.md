---
phase: deployment
title: Authentication Session and Video Persistence Deployment
description: Ordered D1, Worker, and Cloudflare Access rollout with exact readback and rollback gates
---

# Authentication Session and Video Persistence Deployment

## Infrastructure

- Cloudflare Worker/Vinext application `listen-to-learn`; preview Worker `listen-to-learn-preview`.
- Production D1 `listen-to-learn-db`; preview D1 `listen-to-learn-preview-db`.
- Existing Cloudflare Access account application `0d7ca644-4813-47a7-b973-bfa748141aff` and separate Settings application remain in place.
- Production accepts the current account and Settings audiences. Preview alone additionally accepts the stable `preview_worker` Access application audience; no application merge or policy replacement is part of this release.

## Release Preconditions

- Review-ready branch with all gates in the testing doc green.
- Explicit authorization to deploy and change Cloudflare Access.
- Fresh Access application GET readback immediately before mutation.
- Real Google-authenticated browser session available for manual smoke; credentials/tokens are never copied into logs or automation.

## Ordered Rollout

1. Capture aggregate-only preview D1 baseline: migration list, total `saved_videos`, rows with `progress_updated_at`.
2. Apply `0011_tranquil_siren.sql` to preview D1 and read back the four column definitions.
3. Deploy the preview Worker through the repository's preview deployment command.
4. Update the existing account Access application by adding only the exact preview and production `/api/videos` destinations. Preserve application ID, audience, 24-hour session, existing destinations, CORS/cookie settings, and policy.
5. Read the Access application back and diff every field; stop on any drift beyond the two destinations.
6. Preview smoke: guest public pages and optional session; unauthenticated `/api/videos` Access redirect; authenticated session, video create/progress/read/delete; Settings to public-page session continuity; Sign out.
7. Apply the additive migration to production D1 and read back schema.
8. Deploy production Worker.
9. Repeat the production smoke and aggregate D1 delta. Do not print subject, email, query, caption, cookie, or token values.

## Validation Gates

- Guest `GET /`, `/practice`, `/videos`, and `/trainer` remain `200`; `/integrations` remains Access-protected.
- Guest `GET /api/session` returns `200`, `no-store`, `{ "user": null }`.
- Unauthenticated `/api/videos` receives the Access flow rather than Worker `401`.
- Authenticated `/api/session` returns a verified user; `/api/videos` create/read/update/delete succeeds and a second browser restores resume data.
- Sign out via `/cdn-cgi/access/logout` returns all public surfaces to guest mode.
- Aggregate D1 change matches the smoke and guest navigation causes no D1 delta.

## Migration and Rollback

- Migration is additive and compatible with old rows through defaults; backfill is unnecessary.
- If schema application fails, stop before Worker deployment and investigate; do not hand-edit migration history.
- If Worker behavior fails but schema is healthy, roll back the Worker version. Leave additive columns in place.
- If Access routing fails, restore the exact pre-change Access application representation, then read back and verify. Do not delete either Access application.
- If account data isolation or identity verification fails, immediately restore the previous Worker and Access configuration and suspend further smoke writes.

## Secrets and Privacy

- `ACCESS_TEAM_DOMAIN` and accepted audiences stay in Worker variables; no new secret is introduced.
- Access cookies/JWTs and Google credentials are never displayed or persisted in artifacts.
- D1 verification uses counts/schema only unless a dedicated synthetic test account record is queried by a non-sensitive generated ID.

## Current Status

Local implementation and local D1 migration verification are complete. PR #19 has an automatically uploaded branch preview version. Remote preview/production migrations, Access mutation, preview promotion, production deploy, and the complete authenticated persistence smoke have not been executed because they require separate explicit operational authorization.

---
phase: deployment
title: Authentication Session and Video Persistence Deployment
description: D1 session migration, Worker rollout, Access login-only cutover, and verified rollback
---

# Authentication Session and Video Persistence Deployment

## Infrastructure

- Current production Worker `listen-to-learn`; preview Worker `listen-to-learn-preview`.
- Production D1 `listen-to-learn-db`; preview D1 `listen-to-learn-preview-db`.
- Main Google Access application `0d7ca644-4813-47a7-b973-bfa748141aff` becomes login-only.
- Redundant Settings/Integrations Access application `3e672ae7-ea8a-4d57-8b8e-53f4716c30fa` is removed after Worker cutover.
- Preview-wide Access application may remain an owner-only administrative gate. It is not an Unmumble session and its assertion is ignored outside `/login`.
- Separate `unmumble-*` Workers/Access resources belong to the blue/green rename work and are not deleted by this feature.

## Release Preconditions

- Requirements/design/planning/testing docs validate and all local gates pass.
- Fresh Access GET snapshots are saved without tokens/cookies before mutation.
- `app_sessions` migration exists, applies locally, and is additive.
- A real Google-authenticated browser is available for manual smoke; automation never enters or prints credentials.
- Rollback Worker version and exact Access application representations are known.

## Ordered Rollout

### Database and Worker preparation

1. Capture aggregate-only D1 baselines and list pending migrations in preview and production.
2. Apply `app_sessions` to preview D1 and read back table/index metadata.
3. Apply every pending migration to production D1 and read back table/index metadata.
4. Deploy the preview Worker while existing Access routes remain.
5. Deploy the same verified production Worker while existing Access routes remain.
6. Visit explicit `/login` in each environment, verify an application session row is created, and verify `/api/session` plus one account API.

Both Workers must be ready before the Access edit because the main Access application currently spans both environments.

### Shared Access cutover and smoke

1. Update the main Access application so its only product destinations are exact production and stable-preview `/login` paths. Preserve Google IdP, allow policy, audience, and session duration.
2. Delete the redundant Settings/Integrations Access application after snapshotting it for rollback.
3. Keep or narrow preview-wide Access as an operational gate; verify ordinary assertion injection does not create a product session.
4. Read all remaining Access apps back and compare destinations/policies/audiences with the approved target.
5. In preview and production, smoke guest pages, Settings, JSON `401`s, explicit login return, video/integration persistence, logout, refresh/navigation, and explicit re-login.
6. Confirm aggregate session/video changes match only authenticated smoke; guest navigation causes no D1 delta.

## Validation Gates

- Guest `GET /`, `/practice`, `/videos`, `/trainer`, and `/settings` return public UI without Access redirects.
- Guest `GET /api/session` returns `200 no-store` with null user.
- Guest account APIs return Worker JSON `401`, not Cloudflare redirect/HTML.
- Explicit `/login` enters Access, returns to the allowlisted UI target, sets `__Host-unmumble_session`, and creates one hashed D1 session row.
- The raw cookie value is absent from D1; expiry is at most 30 days.
- Authenticated phrase/example/video/integration APIs resolve one D1 user; video write/read/update/delete and cross-browser resume pass.
- Logout deletes the current D1 session, clears the cookie, stays branded, and Settings remains guest while Access global SSO is still active.
- Explicit Sign in after logout creates a different session token/hash.
- Main Access app protects only `/login`; redundant Settings app is absent; no unrelated Access app changed.

## Migration and Rollback

- Migration is additive; old learning rows require no backfill.
- If migration fails, stop before Worker deployment and do not edit migration history manually.
- If Worker smoke fails before Access cutover, restore the previous Worker version.
- If Access cutover fails, restore the main application from its exact snapshot and recreate the Settings application from its snapshot, then read back both.
- If product authorization fails after cutover, restore Access first to close the gap, then roll back Worker.
- `app_sessions` may remain after rollback. Deleting all session rows is explicitly allowed and forces clean login.

## Secrets and Privacy

- No new application secret is introduced. Session tokens use Web Crypto and only SHA-256 hashes are stored.
- Access JWTs, application cookies, session hashes, Google credentials, subjects, emails, captions, and queries are never displayed in artifacts or logs.
- D1 verification uses schema/index metadata and aggregate counts; browser smoke reports statuses and UI state only.

## Current Status

Migrations through `0012` are applied and read back in preview and production with no pending migrations. Both Worker deployments, shared Access cutover, and live smoke remain and must be proven in the order above.

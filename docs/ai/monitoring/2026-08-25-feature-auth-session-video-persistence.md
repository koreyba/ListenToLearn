---
phase: monitoring
title: Authentication Session and Video Persistence Monitoring
description: Privacy-safe operational checks for application sessions, account APIs, D1 progress, and sync failures
---

# Authentication Session and Video Persistence Monitoring

## Key Signals

- `/api/session`: status distribution and latency; a sudden 5xx increase blocks reliable account detection.
- `/api/logout`: status distribution; any non-2xx means server revocation was not confirmed.
- `/login`: Access authentication failures versus successful application-session exchanges.
- Account APIs: Worker JSON 401/4xx/5xx rates, latency, and request volume; Access redirects here indicate configuration drift.
- D1: aggregate active/expired `app_sessions`, `saved_videos`, rows with non-null `progress_updated_at`, migration state, and error rate.
- Client-visible symptom: `Progress is saved in this browser, but account sync failed.`
- Access application drift: the main application must protect only exact `/login`; the redundant Settings application must remain absent.

## Logging Strategy

- Existing Worker warnings/errors may record only operation name and generic exception message.
- Never log JWTs, cookies, assertion headers, subjects, emails, origin queries, captions, progress bodies, or decrypted integrations.
- Use Cloudflare request metadata and aggregate status counts for diagnosis; minimize retention to the platform/project standard.

## Release Monitoring

During the first smoke and observation window:

1. Confirm every public page including Settings is available and guest `/api/session` returns `{ "user": null }`.
2. Confirm unauthenticated account APIs return Worker JSON `401`, not Access redirects.
3. Watch `/login`, `/api/session`, `/api/logout`, and account API error rates after Worker/Access rollout.
4. Compare aggregate D1 session/video counts before/after one authenticated journey and one guest journey.
5. Recheck the Access application representation after rollout.

## Alert Conditions

- Critical: public learning pages enter an Access loop, account A can observe account B data, an Access assertion authorizes a non-login request, or identity verification accepts invalid tokens.
- High: authenticated `/api/videos` consistently 401/5xx, resume rows never gain `progress_updated_at`, or Sign out/refresh restores former-account data without explicit Sign in.
- Warning: session endpoint latency/error spike, elevated sync warnings, or video write volume materially exceeds the expected 15-second bound.

## Incident Response

1. Reproduce with request status and route only; do not collect tokens or personal payloads.
2. Distinguish Access login interception, application-session lookup/revocation, API validation, and D1 failure.
3. Compare current Access app/readback and D1 migration list with the deployment evidence.
4. Roll back Access or Worker according to the deployment runbook; additive D1 columns remain.
5. Verify guest availability, authenticated session continuity, subject isolation, and aggregate D1 behavior before closing.

## Health Checks

- Guest: `/api/session` is `200 no-store` with null user; public pages stay usable.
- Account APIs: unauthenticated requests return Worker JSON `401`; explicit `/login` alone enters Access.
- Authenticated synthetic journey: create/update/read/delete one video and verify resume timestamp advances.
- Cross-device: a second authenticated browser restores the server caption anchor.
- Logout: branded `/logout` removes the D1 session and cookie, returns to Library, remains guest across refresh/navigation/Settings despite global Access SSO, blocks former-account APIs, and explicit Sign in creates a new session.

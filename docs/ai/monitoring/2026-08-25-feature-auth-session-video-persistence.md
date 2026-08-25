---
phase: monitoring
title: Authentication Session and Video Persistence Monitoring
description: Privacy-safe operational checks for optional sessions, protected video APIs, D1 progress, and sync failures
---

# Authentication Session and Video Persistence Monitoring

## Key Signals

- `/api/session`: status distribution and latency; a sudden 5xx increase blocks reliable account detection.
- `/api/videos`: Access redirects for unauthenticated requests, Worker 401/4xx/5xx rates, latency, and request volume.
- D1: aggregate `saved_videos` count, rows with non-null `progress_updated_at`, migration state, and error rate.
- Client-visible symptom: `Progress is saved in this browser, but account sync failed.`
- Access application drift: destinations, audience, policy, and session duration compared with the release readback.

## Logging Strategy

- Existing Worker warnings/errors may record only operation name and generic exception message.
- Never log JWTs, cookies, assertion headers, subjects, emails, origin queries, captions, progress bodies, or decrypted integrations.
- Use Cloudflare request metadata and aggregate status counts for diagnosis; minimize retention to the platform/project standard.

## Release Monitoring

During the first smoke and observation window:

1. Confirm guest public-page availability and optional-session `200` behavior.
2. Confirm unauthenticated `/api/videos` is intercepted by Access.
3. Watch `/api/session` and `/api/videos` error rates after Worker/Access rollout.
4. Compare aggregate D1 counts before/after one synthetic authenticated journey and one guest journey.
5. Recheck the Access application representation after rollout.

## Alert Conditions

- Critical: public learning pages enter an Access loop, account A can observe account B data, Settings becomes public, or identity verification accepts invalid tokens.
- High: authenticated `/api/videos` consistently 401/5xx, resume rows never gain `progress_updated_at`, or Sign out leaves former-account data visible.
- Warning: session endpoint latency/error spike, elevated sync warnings, or video write volume materially exceeds the expected 15-second bound.

## Incident Response

1. Reproduce with request status and route only; do not collect tokens or personal payloads.
2. Distinguish Access interception, Worker verification, API validation, and D1 failure.
3. Compare current Access app/readback and D1 migration list with the deployment evidence.
4. Roll back Access or Worker according to the deployment runbook; additive D1 columns remain.
5. Verify guest availability, authenticated session continuity, subject isolation, and aggregate D1 behavior before closing.

## Health Checks

- Guest: `/api/session` is `200 no-store` with null user; public pages stay usable.
- Protected: unauthenticated `/api/videos` enters Access.
- Authenticated synthetic journey: create/update/read/delete one video and verify resume timestamp advances.
- Cross-device: a second authenticated browser restores the server caption anchor.
- Logout: branded `/logout` completes the official Access request, returns to Library, shows guest mode, and does not request former-account data.

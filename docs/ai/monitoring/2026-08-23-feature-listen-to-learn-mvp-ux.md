---
phase: monitoring
title: Monitoring & Observability
description: Define monitoring strategy, metrics, alerts, and incident response
---

# Monitoring & Observability

## Existing Signals

Keep the existing Worker logs and endpoint checks. The feature does not add analytics or personal-data telemetry.

## Important Error Signals

- `/api/phrases` errors around `context` migration or bounded payloads.
- `/api/examples` failures and mismatch between saved-example count and provider replay.
- `/api/tatoeba`/audio failures, empty provider responses, and stale request regressions.
- `/api/translate` unavailable responses; these must remain non-blocking for saving.
- YouGlish widget errors and unavailable exact-caption navigation; the UI must remain explicit rather than falling back to a misleading seek.

## Logging and Privacy

Retain existing diagnostic logging but never log DeepL/provider secrets, OAuth material, or full private user data. Captions are user-provided learning context and should not be promoted to analytics.

## Health Checks

Use the automated lifecycle gates and the responsive browser smoke checklist in the testing doc. Recheck provider-specific flows after external credentials/configuration are supplied.

## Incident Response

If a migration or route regression appears, stop rollout, use the existing Worker version rollback, and inspect D1 migration state before retrying. A provider outage should surface as the existing empty/error state and must not block local phrase persistence.

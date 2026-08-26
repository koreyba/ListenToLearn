---
phase: monitoring
title: Unmumble Blue-Green Monitoring
description: Isolation and health checks during migration and stabilization
---

# Unmumble Blue-Green Monitoring

## Verified baseline

- Both new D1 databases have no pending migrations or foreign-key violations.
- Preview and production configs contain only their matching new database UUID.
- Both Workers list `INTEGRATIONS_ENCRYPTION_KEY`; secret values are not exposed.
- Production and branch-preview Access redirects use their distinct AUDs.

## Preview checks

- Watch `unmumble-preview` deployment status, errors, Access redirects, and D1
  writes.
- Verify preview writes appear only in `unmumble-preview-db`.
- Smoke-test guest routes, authenticated routes, saved examples, videos, and
  integrations without printing credentials or encrypted values.

## Production stabilization

- Track `unmumble-prod` errors, authentication failures, data mutations, and
  custom-domain HTTPS.
- Confirm new production records exist only in `unmumble-prod-db`.
- After merging Google auth, smoke authenticated phrases, examples, videos, and
  integrations before narrowing the temporary production Access policy.
- Keep the old stack recoverable until the stabilization period and archival
  export are complete.

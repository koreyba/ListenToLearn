---
phase: monitoring
title: Monitoring & Observability
description: Define monitoring strategy, metrics, alerts, and incident response
---

# Monitoring & Observability

## Key Metrics
**What do we need to track?**

### Performance Metrics
- Worker request latency and CPU time, with D1 latency inferred from request timing.
- Requests and 4xx/5xx rates, especially 401 authentication failures and 5xx migration/configuration failures.
- Workers build/deploy status and Cloudflare account request limits.

### Business Metrics
- Authenticated visits, phrase mutations, saved-example mutations, and Integration status changes.
- DeepL configured success versus pending fallback; do not record keys or full user content.

### Error Metrics
- Group errors by authentication verification, D1 schema/data, DeepL upstream, and application route.
- Track repeated 401s, 5xxs, Access redirect loops, and failed migration/deploy commands.

## Monitoring Tools
**What tools are we using?**

- Cloudflare Workers dashboard for request count, CPU, errors, and deployments.
- Cloudflare Observability/Worker logs for bounded incident investigation.
- D1 read-only queries for schema and non-secret row counts; never query plaintext secrets.

## Logging Strategy
**What do we log and how?**

- Log a short event category and safe error message for JWT verification, route failures, migration checks, and DeepL upstream failures.
- Never log Access JWTs, identity header values, cookies, DeepL keys, ciphertext, or request bodies.
- Prefer aggregate metrics for long-term observation.

## Alerts & Notifications
**When and how do we get notified?**

### Critical Alerts
- Authentication failures or 5xx errors rise after a deploy → inspect version, Access audience, and D1 migration state.
- Any evidence of cross-user data → stop rollout, preserve evidence, and roll back the Worker while keeping D1 intact.

### Warning Alerts
- DeepL upstream failures increase → verify the user's optional integration status; phrase progression must still work.
- CPU/request usage approaches the free-plan limit → identify the route before adding any Cloudflare resource.

## Dashboards
**What do we visualize?**

- Worker overview: requests, CPU, errors, and latest deployment.
- D1 health: migration list, table/index shape, and non-secret row counts.
- Access overview: application policy, Google IdP, and authentication events.

## Incident Response
**How do we handle issues?**

### On-Call Rotation
- Owner: Denys for this personal project. Escalate by stopping deployment and preserving the failing command/output; no paid escalation is configured.

### Incident Process
1. Detection and triage
2. Investigation and diagnosis
3. Resolution and mitigation
4. Post-mortem and learning

## Health Checks
**How do we verify system health?**

- Open the Worker hostname and complete Google login; verify `/api/me` returns the current account with no-store headers.
- Verify `/api/phrases`, `/api/examples`, `/api/integrations`, and `/api/translate` are scoped after login and unavailable before the Access boundary.
- Compare Worker details, D1 migration state, and a non-secret row-count query with the release evidence after deployment.

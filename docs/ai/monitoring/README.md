---
phase: monitoring
title: Monitoring & Observability
description: Define monitoring strategy, metrics, alerts, and incident response
---

# Monitoring & Observability

## What to watch

- Cloudflare Workers requests and CPU time, D1 query errors, and Worker exceptions.
- Access redirects/login failures on `/integrations`.
- DeepL optional error rates: missing key, timeout, upstream rejection, and empty response.
- Keep an eye on the free-plan request and D1 limits before adding features.

## Logging and privacy

The API logs only operational error messages. Never log request bodies, provider keys, decrypted plaintext, cookies, or Access tokens. Integration status responses use `Cache-Control: no-store`.

## Health checks

The minimum smoke check is: home 200, trainer 200, public phrases API 200, and both protected Integrations routes 302 without an Access session. An owner-authenticated browser check must additionally confirm status, save, translation, and delete.

## Incident response

If translation fails, keep phrase progression available and remove/rotate the provider key if compromise is suspected. If the Worker regresses, inspect the latest deployment and roll back to the last verified version; do not delete D1 data as a first response.

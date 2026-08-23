---
phase: monitoring
title: Monitoring & Observability
description: Define monitoring strategy, metrics, alerts, and incident response
---

# Monitoring & Observability

## Production signals

- Workers & Pages: requests, CPU time, errors, deployments and startup time.
- Access: redirect rate for protected paths and authentication failures.
- D1: row counts and `changes`/`rows_written` for release checks; never print ciphertext.
- Client: guest localStorage errors, failed Tatoeba loads and blocked guest translation messaging.

## Final smoke evidence

Against `https://listen-to-learn.koreybadenis.workers.dev` after Worker version `f0fca2e8-75d3-46c7-b317-1c9f725c23d9`:

- `/` returned `200`.
- `/trainer.html` returned the expected `307` to `/trainer`; `/trainer` returned `200`; `/trainer/` also normalized to `/trainer`.
- `/caption-navigation.js` returned `200`.
- `/api/tatoeba?q=hello` returned `200` JSON.
- `/login`, `/api/me`, `/api/phrases`, `/api/examples`, `/api/translate`, `/integrations` and `/api/integrations` returned Cloudflare Access `302` redirects.
- D1 counts before and after public smoke were unchanged: `users=2`, `phrases=50`, `phrase_progress=51`, `phrase_examples=2`; both queries reported `rows_written=0` and `changed_db=false`.

## Security and free-plan guardrails

- Public Worker routes are explicit; unknown paths remain fail-closed.
- Guest storage contains only bounded phrase/example state, never Access JWTs, identity headers or provider keys.
- Any unexpected guest write, D1 change, Access redirect on `/`/`/trainer`, or 5xx spike blocks further rollout.
- No paid Cloudflare resource or anonymous persistent server storage was added.

## Incident response

1. Confirm the affected path and latest Worker version in Cloudflare.
2. Check Access app destinations and Worker logs without exposing tokens or keys.
3. Roll back the Worker or restore the previous Access destination set as appropriate.
4. Re-run public/protected smoke and D1 row-count checks before reopening rollout.

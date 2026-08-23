---
phase: planning
title: Project Planning & Task Breakdown
description: Break down work into actionable tasks and estimate timeline
---

# Project Planning & Task Breakdown

## Milestones

- [x] Move the existing site into `ListenToLearn` and deploy the Worker/D1 application.
- [x] Make translation optional and add the protected Integrations surface.
- [x] Add D1 migration, encryption secret, Cloudflare Access, tests, and live smoke checks.
- [ ] Owner enters the DeepL key through the Access-protected page and verifies one translation.
- [ ] Add future providers only after their free-tier and storage boundaries are agreed.

## Dependencies

The D1 migration and `INTEGRATIONS_ENCRYPTION_KEY` must exist before saving a key. Cloudflare Access must authenticate the owner before the Integrations API can issue an application session. The real DeepL key is an owner-provided input and is not part of source control.

## Risks and mitigation

- DeepL outage or missing key: keep translation best-effort and phrase progression independent.
- Accidental key exposure: status-only responses, encrypted D1 storage, HttpOnly cookie, no client storage, no logging.
- Free-plan drift: re-check Cloudflare usage before adding paid products or broadening Access.
- Current single-user tables: do not advertise multi-user isolation until `user_id` ownership is designed.

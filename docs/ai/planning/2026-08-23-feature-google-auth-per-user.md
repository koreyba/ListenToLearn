---
phase: planning
title: Project Planning & Task Breakdown
description: Break down work into actionable tasks and estimate timeline
---

# Project Planning & Task Breakdown

## Milestones
**What are the major checkpoints?**

- [x] M1: lifecycle requirements/design/testing docs accepted and feature branch ready.
- [x] M2: JWT boundary, user model and D1 migration implemented.
- [x] M3: all API/data flows isolated and UI bootstrap namespaced.
- [ ] M4: local validation, Cloudflare Access update and remote D1 migration.
- [ ] M5: commit, push, PR, merge, deploy and production smoke.

## Task Breakdown
**What specific work needs to be done?**

### Phase 1: Foundation

- [x] 1.1 Add lifecycle docs and capture no-paid-plan constraints.
- [x] 1.2 Add internal user identity codec and Worker JWT verification.
- [x] 1.3 Add users/progress/ownership schema and legacy migration.

### Phase 2: Core Features

- [x] 2.1 Add authenticated user helper and explicit legacy-owner merge.
- [x] 2.2 Scope phrase list, phrase mutations and custom ownership.
- [x] 2.3 Scope examples and promotion status.
- [x] 2.4 Scope integration secrets and DeepL translation.
- [x] 2.5 Add /api/me and preserve optional translation fallback.

### Phase 3: Integration & Polish

- [x] 3.1 Namespace trainer localStorage after authenticated bootstrap.
- [x] 3.2 Add account indicator/logout affordance.
- [x] 3.3 Add isolation and auth regression tests.
- [x] 3.4 Review diff against requirements/design and update implementation/testing docs.

## Dependencies
**What needs to happen in what order?**

- 1.2 and 1.3 define the interfaces consumed by 2.1–2.4.
- Remote D1 migration must run before production requests use new tables.
- New host-wide Access application provides the primary audience; existing integration app provides a second accepted audience.
- Google IdP and Access policies are already created, but app attachment/policy changes remain deployment work.
- INTEGRATIONS_ENCRYPTION_KEY must remain present in Worker secrets before integration smoke.

## Timeline & Estimates
**When will things be done?**

Работа выполняется в текущем lifecycle-сеансе; оценка по этапам: implementation 30–45 минут, validation/review 15–25 минут, Cloudflare/GitHub rollout 10–20 минут при отсутствии внешнего блокера.

## Risks & Mitigation
**What could go wrong?**

- JWT audience mismatch between host and path-specific Access apps → accept an explicit comma-separated audience list and smoke each protected path.
- SQLite table rebuild/index mismatch → inspect generated SQL and run migration on a disposable/local D1 before remote apply.
- Legacy key AAD mismatch → retain version 1 read path and re-wrap with user-bound version 2.
- Existing user browser state leakage → never read the old key for non-legacy users.
- Cloudflare free-plan surprise → use only existing Worker/D1/Access resources and stop if an operation reports paid billing.

## Resources Needed
**What do we need to succeed?**

- GitHub repository and authenticated git/gh CLI.
- Cloudflare MCP/skill and Wrangler CLI.
- Existing Google OAuth client and Cloudflare Access team domain.
- Local npm dependencies and D1 migration tooling.

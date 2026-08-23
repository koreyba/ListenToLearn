---
phase: planning
title: Project Planning & Task Breakdown
description: Break down work into actionable tasks and estimate timeline
---

# Project Planning & Task Breakdown

## Milestones

- [x] M1: requirements, design and testing strategy approved by the user-facing decision to build local guest mode.
- [x] M2: public-route boundary and guest state implemented without changing authenticated isolation.
- [x] M3: guest UI works on library, trainer and saved examples using localStorage only.
- [ ] M4: automated checks and live public/protected smoke pass.
- [ ] M5: final review, PR, merge to `main`, Access rollout and Worker deployment complete.

## Task Breakdown

### Phase 1: Boundary and state foundation

- [x] 1.1 Add pure guest-library state model, normalization, bounded custom phrases and saved-example helpers. Validate with unit tests for malformed storage, transitions, reset and namespace separation. Covers requirements guest-state and security criteria.
- [x] 1.2 Add explicit Worker public-route classifier and `/login` redirect. Keep JWT verification and authenticated route fail-closed; cover public/protected path matrix. Depends on 1.1 only for shared naming; validates Worker boundary tests.
- [ ] 1.3 Update Access configuration plan/vars for path-scoped protected paths while preserving Google audiences during rollout. Validate via Cloudflare API read-back before mutation and smoke after deploy.

### Phase 2: Public library and trainer

- [x] 2.1 Add guest bootstrap and local library state to `app/page.tsx`, including preset catalog, custom phrases, status transitions, reset action and Google login CTA. Authenticated branch keeps existing `/api/phrases` behavior.
- [x] 2.2 Add guest bootstrap to `public/trainer.html`, including intentional guest handling, local To Learn promotion, local saved examples and account/guest storage separation. Keep Tatoeba public proxy and authenticated API paths distinct.
- [x] 2.3 Add guest translation messaging and protected Integrations/login UX without exposing or storing DeepL credentials. Covers optional translation and security criteria.

### Phase 3: Verification and rollout

- [x] 3.1 Add/update rendered, state and Worker boundary tests; run lint, typecheck, build, Node tests and diff checks.
- [ ] 3.2 Run live guest/protected smoke: root/trainer public, Tatoeba read-only public, API/Integrations Access redirect, authenticated Google path, and D1 row-count immutability for guest requests.
- [ ] 3.3 Perform final implementation/design review, update lifecycle docs with evidence, commit and push the feature branch, open/update PR, merge to `main`, then deploy Worker and verify production.

## Progress

Tasks 1.1, 1.2, 2.1, 2.2, 2.3 and 3.1 are complete. The guest library and trainer use the same bounded local schema, guest mutations avoid user APIs, and the Worker strips untrusted identity headers before both guest and account dispatch. Task 1.3 and live smoke remain pending for coordinated Access rollout.

## Dependencies

- 1.2 must be implemented and deployed together with the Access path change; a mismatch could either lock out guests or expose APIs.
- 2.1 and 2.2 must use a stable guest key and must not call authenticated mutation endpoints when guest mode is active.
- 3.2 requires Cloudflare API/MCP access and an existing Google session for authenticated smoke; no new secret should be pasted into chat.
- The existing D1 migration and per-user encryption key remain prerequisites for account flows but are not changed by this feature.

## Sequencing and Estimates

- Boundary/state foundation: small-to-medium change, completed before UI work.
- UI adaptation: largest work area because the home page is API-driven and trainer has separate inline state.
- Verification/rollout: must be performed after code and Access configuration are both ready; deployment is the final mutation.

## Risks & Mitigation

- Access path overlap: preserve existing integration application and audiences, read back effective apps/policies, then smoke each path.
- Guest/account state leakage: use separate keys and an explicit mode; never use guest localStorage as an authenticated identity signal.
- Hidden D1 writes: keep guest client off user mutation APIs, make route guard fail closed, and compare D1 counts before/after direct guest probes.
- Malformed localStorage: normalize and cap values; fall back to in-memory defaults with a visible warning.
- Scope growth from guest-to-account import: keep merge explicitly out of scope.
- Free-plan drift: do not add storage products; verify Worker size, D1 writes and Access plan before deployment.

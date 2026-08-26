---
phase: planning
title: Authentication Session and Video Persistence Plan
description: Dependency-ordered TDD delivery plan for authoritative auth state and D1-backed account video resume
---

# Authentication Session and Video Persistence Plan

## Milestones

- [x] Milestone 1 — Authoritative session boundary: exchange verified Access login identity for revocable D1-backed Unmumble sessions.
- [x] Milestone 2 — Account video persistence: additive D1 resume schema and subject-scoped API round-trip.
- [x] Milestone 3 — Playback synchronization: user-isolated local mirror, throttled D1 progress, and Videos account restore.
- [ ] Milestone 4 — Release readiness: lifecycle docs, full regression review, Access configuration, migration, and live smoke.

## Task Breakdown

### Phase 1: Session foundation

- [x] **Task 1.1 — Red tests for session and redirect contracts.**
  - Outcome: failing tests reproduce cookie/header extraction, public `/api/session`, safe `returnTo`, public/protected route matrix, and the absence of hint-only bootstrap.
  - Dependencies: reviewed requirements/design.
  - Validation: targeted `node --test` fails for the intended missing behavior, not syntax/import errors.
  - Testing links: Access session/redirect unit tests; session Worker integration test; guest public-page E2E contracts.
- [x] **Task 1.2 — Implement optional verified session and safe login return.**
  - Outcome: Worker validates either assertion or application-cookie JWT, serves `no-store` optional session, strips forged identity, and redirects `/login` only to bounded same-origin public targets.
  - Dependencies: Task 1.1.
  - Validation: Task 1.1 tests green, typecheck, security/source regression checks.
- [x] **Task 1.3 — Replace public-client auth hints with authoritative bootstrap.**
  - Outcome: Library/Practice, Videos, and Trainer probe `/api/session`; all headers use consistent Sign in/Sign out through the branded public `/logout` flow; Settings is consistent; stale `listen-to-learn-authenticated-v1` is not an authority.
  - Dependencies: Task 1.2.
  - Validation: rendered/JSDOM behavior tests, guest route smoke, existing page tests.
  - Testing links: all public-client auth integration and sign-out consistency scenarios.
- [x] **Task 1.4 — Persist explicit application logout across Access SSO refresh.**
  - Outcome: logout sets a host-only HttpOnly guest marker before supplemental Access cleanup; session/account routing honors it until verified explicit `/login` clears it.
  - Dependencies: live reproduction showing application-domain Access logout was immediately reversed by global SSO.
  - Validation: red/green cookie/controller/redirect tests, Worker routing-order contract, sensitivity proof, and full local gates. Deployed refresh/navigation smoke remains in Task 4.4.
- [x] **Task 1.5 — Replace the marker workaround with opaque D1 sessions.**
  - Outcome: `/login` verifies Access once and rotates a 256-bit application session; `/api/session` and every account API authorize through a hashed D1 token; logout revokes the row and clears the cookie.
  - Dependencies: approved architecture revision after the live Settings/global-SSO defect.
  - Validation: red/green token, cookie, expiry, rotation, revocation, and Worker route tests; local migration readback.
- [x] **Task 1.6 — Make Settings and legacy Integrations public UI shells.**
  - Outcome: `/settings` remains guest after logout, `/integrations` redirects to it, and only `/api/integrations` requires the application session.
  - Dependencies: Task 1.5 session resolver.
  - Validation: guest route/UI tests and deployed logout → Settings smoke.
- [x] **Task 1.7 — Make signed-in account identity consistent across every header.**
  - Outcome: Library, Practice, Videos, Trainer, and Settings show the session email beside Sign out on desktop and mobile.
  - Dependencies: Task 1.3 session bootstrap and Task 1.6 public Settings shell.
  - Validation: red/green cross-surface UI contract, full build/test/type/lint gates.

### Phase 2: D1 and video API

- [x] **Task 2.1 — Red tests for persisted resume validation and ownership.**
  - Outcome: failing tests define valid/invalid resume metadata, preserve-on-missing semantics, subject isolation, and account/guest progress key separation.
  - Dependencies: Milestone 1 interfaces stable.
  - Validation: targeted tests fail on missing schema/API/helpers for the expected assertions.
- [x] **Task 2.2 — Add the additive `saved_videos` resume migration and schema.**
  - Outcome: `resume_seconds`, `resume_caption_id`, `resume_caption_text`, and `progress_updated_at` exist with safe defaults/nullability and unchanged ownership indexes.
  - Dependencies: Task 2.1.
  - Validation: Drizzle metadata/generation consistency, local migration apply/list, schema tests.
- [x] **Task 2.3 — Extend video GET/POST without weakening authorization.**
  - Outcome: GET returns normalized resume data; POST atomically creates/refreshes history with optional progress, preserves valid progress when omitted, and always scopes SQL by verified subject.
  - Dependencies: Task 2.2.
  - Validation: API unit/integration contracts, body bounds, duplicate/invalid/ownership cases green.

### Phase 3: Playback and Videos synchronization

- [x] **Task 3.1 — Red tests for bounded progress synchronization.**
  - Outcome: failing controller tests specify immediate local write, at-most-one account write per 15 seconds, changed-only flush, retry after failure, and keepalive exit behavior.
  - Dependencies: Task 2.3 payload contract.
  - Validation: deterministic fake-clock/fake-transport tests fail for the intended throttle/flush behavior.
- [x] **Task 3.2 — Implement reusable progress sync and user-namespaced mirror.**
  - Outcome: pure helper/controller owns storage keys, freshness, throttling, flush, and retry semantics; Account A/B and anonymous state remain isolated.
  - Dependencies: Task 3.1.
  - Validation: controller/unit tests green; malformed storage and transport failure cases green.
- [x] **Task 3.3 — Wire Trainer account progress persistence.**
  - Outcome: initial Continue write includes progress; caption callbacks update local state; pause/navigation/pagehide flush changed progress; guest path never calls account API.
  - Dependencies: Task 3.2.
  - Validation: rendered trainer contracts, existing YouGlish caption/fetch-count suites, account/guest request-count tests.
- [x] **Task 3.4 — Make Videos use the correct source by mode.**
  - Outcome: account cards/resume URLs use D1 plus same-account newer retry data; guest cards use anonymous local data; removal clears only the current mode/account record.
  - Dependencies: Tasks 1.3, 2.3, 3.2.
  - Validation: account/guest page behavior tests, cross-account isolation fixture, URL/resume regressions.

### Phase 4: Reconciliation, verification, and rollout

- [x] **Task 4.1 — Reconcile implementation and testing docs after each implementation task.**
  - Outcome: planning status, implementation decisions, executed commands, and testing checkboxes reflect evidence rather than intent.
  - Dependencies: auto-triggered after Tasks 1.1–3.4.
  - Validation: feature lint and `git diff --check` after each reconciliation.
- [x] **Task 4.2 — Full implementation check, testing phase, and code review.**
  - Outcome: code matches design; no security, ownership, provider, or regression blocker remains.
  - Dependencies: Milestones 1–3 complete.
  - Validation: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, feature lint, diff check, regression revert/fail/restore/pass proof.
- [x] **Task 4.3 — Prepare deployment and monitoring runbooks.**
  - Outcome: additive migration order, Worker rollout, Access update/readback, aggregate-only D1 smoke, rollback, logs/metrics, and privacy rules are explicit.
  - Dependencies: Task 4.2.
  - Validation: runbook review against deployment/monitoring templates and current Cloudflare APIs.
- [ ] **Task 4.4 — Apply and verify D1/Worker/Access changes.**
  - Outcome: preview/production D1 migration is applied; the account Access app protects only exact `/login` destinations; the redundant Settings Access app is removed; account APIs use the Unmumble session; signed-out state survives every public navigation until explicit login.
  - Dependencies: publish/deploy authorization, review-ready commit/branch, Task 4.3.
  - Validation: Access application GET readback, public UI/API route matrix, authenticated session/API smoke, logout/refresh/Settings/re-login smoke, aggregate D1 session/video delta, no guest write delta.

## Dependencies

- Session interfaces precede client bootstrap so all pages consume one contract.
- Schema precedes API resume fields; API contract precedes trainer synchronization.
- Initial history upsert includes progress to prevent a create-versus-progress race.
- The `app_sessions` migration and Worker session exchange must be deployed before Access protection is removed from account APIs.
- Cloudflare Access keeps the existing Google identity/policy and main application audience, but its product destinations are reduced to exact `/login` routes.
- No provider spike is needed: this feature keeps the accepted last-caption cold-restore contract and does not change YouGlish seek behavior.

## Timeline & Estimates

- Milestone 1: medium — Worker auth boundary plus three public clients.
- Milestone 2: small/medium — additive migration and one existing API.
- Milestone 3: medium/high — timing-sensitive controller and static trainer integration.
- Milestone 4: medium — full verification plus coordinated Access/D1 rollout.

Execution is sequential by evidence, not by calendar date. A red test, reviewed green implementation, and planning reconciliation close each task before the next dependency begins.

## Risks & Mitigation

- **Session bearer theft:** store only SHA-256 hashes, use a 256-bit `__Host-` HttpOnly cookie, fixed 30-day expiry, rotation, and server-side revocation.
- **Access/application cutover gap:** the main Access app spans production and preview, so migrate and deploy both Workers first, create real app sessions in both, and only then narrow destinations; preserve exact pre-change snapshots for rollback.
- **D1 write amplification:** throttle to 15 seconds, write only changed progress, flush once at meaningful exits.
- **Pagehide delivery loss:** keep same-account local retry mirror and use a bounded keepalive request; never claim server persistence without D1 readback.
- **Cross-account browser leakage:** derive account local keys from verified `sub`; never merge anonymous or another subject's mirror.
- **Provider regression:** retain existing warm/cold fetch-count and caption-navigation suites unchanged.
- **Access policy drift:** GET exact current applications before mutation, preserve the main Google allow policy/audience, and verify that only `/login` remains product-protected.

## Resources Needed

- Existing Node 22/npm toolchain, Vinext/React tests, Drizzle/D1, and Wrangler 4.x.
- Cloudflare API read/write access for the existing account Access application and D1 databases.
- A real Google-authenticated browser session for final manual smoke; automation must not enter credentials or expose tokens.
- Existing YouGlish trace fixtures and provider regression tests.

## Progress Summary

Milestones 1–3 are complete. Migration `0012`, both Worker deployments, login-only Access cutover, explicit login/account reads, and the deployed public/JSON route matrix are complete and read back. Task 4.4 now has only the final interactive logout/refresh smoke and final review/check publication remaining.

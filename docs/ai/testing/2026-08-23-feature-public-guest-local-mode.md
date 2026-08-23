---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy

## Test Coverage Goals

- Unit-test all new guest-state normalization and transition branches.
- Cover the Worker public-route classifier and protected-route fail-closed behavior.
- Add rendered/source assertions for guest bootstrap, local mutations and the absence of guest calls to user mutation APIs.
- Keep existing authenticated per-user and DeepL boundary tests green.
- Use live smoke checks for public UI, protected Access paths and D1 immutability around guest requests.

## Unit Tests

### Guest library state

- [x] Empty/malformed storage normalizes to a safe default without throwing.
- [x] Preset status transitions are stored by phrase id and do not create server records.
- [x] Custom guest phrase creation is bounded, normalized and idempotent by text.
- [x] Guest saved-example add/remove is isolated by phrase and provider/external id.
- [x] Reset removes all guest state and does not touch account namespace.

### Worker route boundary

- [x] `/`, `/trainer.html`, static assets, `/api/tatoeba` and `/api/tatoeba/audio` are public.
- [x] `/login`, `/api/me`, `/api/phrases`, `/api/examples`, `/api/translate`, `/integrations` and `/api/integrations` are protected by default.
- [ ] A missing/invalid Access identity cannot reach authenticated route handling.
- [x] The login redirect has no open-redirect behavior.

## Integration Tests

- [x] Guest UI starts without calling authenticated phrase/example mutation APIs.
- [x] Guest status/custom phrase/example actions round-trip through localStorage helpers and the shared trainer schema.
- [ ] Authenticated bootstrap still loads user-scoped D1 data and namespaced trainer state.
- [ ] Guest and authenticated namespaces remain independent in the same browser.
- [ ] Direct unauthenticated mutation requests return `401`/Access redirect and D1 row counts remain unchanged.
- [ ] Translation unavailable for guest is non-blocking and does not create a key or phrase row.

## End-to-End Tests

- [ ] Fresh/incognito browser opens `/` without Google and sees the library plus guest CTA.
- [ ] Guest moves a preset, adds a custom phrase, opens the trainer and saves an example; reload preserves local state.
- [ ] Guest reset clears only the trial state.
- [ ] Guest clicks login, completes Google Access, returns to the account library, and sees no automatic guest import.
- [ ] Account A and account B retain separate phrase progress, examples and DeepL status.
- [ ] Integrations remains Google-protected and never exposes plaintext credentials.

## Test Data

- Use the existing preset catalog and deterministic guest ids in unit tests.
- Use synthetic Access user contexts for authenticated route tests; never use real tokens or keys.
- Use D1 schema/count queries only; never print ciphertext.

## Test Reporting & Coverage

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build` (the repository wrapper is unavailable on this macOS host because GNU `timeout` is absent); equivalent bounded `vinext build` passed.
- `node --test tests/*.test.mjs` (targeted guest/rendered suites passed; full suite is the final gate).
- `git diff --check`
- `npx ai-devkit@latest lint --feature public-guest-local-mode`

Document any macOS `timeout` wrapper limitation separately from code failures.

## Manual Testing

- Verify guest flow in a clean/incognito browser and authenticated flow in the existing Google session.
- Verify refresh, second tab, logout, reset, mobile-width layout and keyboard operation.
- Verify Network panel contains no guest `POST/PATCH/DELETE` to user APIs and no secret in localStorage.
- Verify Cloudflare Access redirects only protected paths.

## Performance and Free-Plan Checks

- Guest actions must not add D1 writes or new persistent Cloudflare objects.
- Keep public Tatoeba proxy requests bounded by existing route limits.
- Confirm Worker upload size and current free-plan quotas before deployment.

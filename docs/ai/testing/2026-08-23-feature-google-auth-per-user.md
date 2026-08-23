---
phase: testing
title: Testing Strategy
description: Define testing approach, test cases, and quality assurance
---

# Testing Strategy

## Test Coverage Goals
**What level of testing do we aim for?**

Новые security/data branches покрываются unit/static tests и хотя бы одним runtime isolation harness. Критический production flow дополнительно проверяется после deploy через Google login. Paid-plan resources are not allowed.

## Unit Tests
**What individual components need testing?**

### Identity boundary

- [ ] Valid JWT claims produce sub/email identity.
- [ ] Missing, expired, wrong issuer or wrong audience fails closed.
- [ ] User-supplied internal header is overwritten/ignored by Worker.

### Data access

- [ ] User A cannot select/update/delete B phrase progress.
- [ ] User A and B can save the same provider example independently.
- [ ] Integration secret status/value is scoped by user and plaintext is not returned.
- [ ] Legacy user migration is idempotent and exact-email restricted.
- [ ] Translation outage leaves phrase mutation successful with pending marker.

## Integration Tests
**How do we test component interactions?**

- [ ] Apply migration against a local D1-compatible SQLite and verify row counts/indexes.
- [ ] Exercise phrases/examples/integrations handlers with two identities and one legacy identity.
- [ ] Verify all API routes return 401 without internal identity.
- [ ] Verify custom phrase owner filter and preset shared catalog behavior.

## End-to-End Tests
**What user flows need validation?**

- [ ] Open production hostname, choose Google, return to the app.
- [ ] Add phrase/save example as account A; account B cannot see it.
- [ ] Configure DeepL as A; B sees unconfigured status.
- [ ] Sign out and sign in as another account; trainer localStorage is isolated.
- [ ] Existing owner account retains the legacy library/progress.

## Test Data
**What data do we use for testing?**

Use the current 50 preset phrases plus synthetic users sub-a, sub-b, and legacy owner legacy:koreybadenis@gmail.com. Do not include real API keys in fixtures or test output.

## Test Reporting & Coverage
**How do we verify and communicate test results?**

Fresh gates: npm run lint, npx tsc --noEmit, npm test, migration dry/local check, git diff review.
Report exit codes and key counts; no completion claim from cached output.
Runtime Cloudflare smoke is evidence for Access redirect, Google callback, and production API isolation.

## Manual Testing
**What requires human validation?**

- Google login in Chrome.
- Library tabs, add/status/remove phrase, trainer example save/delete, translation fallback.
- Integrations page status/save/delete and logout.
- Direct unauthenticated API request returns 401.

## Performance Testing
**How do we validate performance?**

No load test is needed for this MVP. Verify JWT/JWKS caching and one D1 lookup per request remain acceptable; DeepL keeps the existing 8 second timeout.

## Bug Tracking
**How do we manage issues?**

Any failed gate blocks commit/merge. Fixes add a regression assertion before the next deployment.

---
phase: testing
title: Authentication Session and Video Persistence Testing Strategy
description: Regression, ownership, persistence, and live Access verification for public guest and signed-in flows
---

# Authentication Session and Video Persistence Testing Strategy

## Test Coverage Goals

- Cover 100% of new pure session/progress normalization branches.
- Cover every changed Worker route-classification and video API validation branch with behavior-level tests where the current harness permits, plus rendered/source contracts only for static HTML wiring that cannot be imported safely.
- Prove both modes: guest-local zero D1 writes and account subject-scoped D1 history/resume.
- Preserve provider navigation/fetch-count contracts and all existing tests.

## Unit Tests

### Access session and redirects

- [x] Missing assertion/cookie produces no optional identity.
- [x] Header token takes precedence on protected requests; cookie fallback is used only for optional browser session detection.
- [x] Malformed cookie parsing cannot inject another cookie value or trusted internal header.
- [x] Safe `returnTo` accepts approved relative learning pages and rejects external/protocol-relative/unapproved/oversized values.
- [x] Public route matrix includes `GET /api/session` but keeps account mutations protected.

### Video resume data

- [x] Normalize valid seconds/caption/timestamp into the public video response.
- [x] Reject negative, non-finite, over-limit, malformed, or partial progress and normalize oversized caption text without overwriting a valid row.
- [x] Missing progress on duplicate history upsert preserves stored resume metadata.
- [x] Account and anonymous progress storage keys are stable and isolated.
- [x] Freshest-progress selection never uses another user's local mirror.

### Progress synchronization controller

- [x] Immediate local write occurs on caption change.
- [x] Continuous callbacks schedule at most one D1 write per 15 seconds.
- [x] Pause/navigation/pagehide flushes changed progress with keepalive.
- [x] Unchanged progress does not write again; failed sync remains retryable and visible.

## Integration Tests

- [ ] Worker `GET /api/session` returns `no-store` guest JSON without identity and verified user JSON with a valid injected verifier fixture.
- [x] Library/Practice, Videos, and Trainer always probe session; none branches solely on `listen-to-learn-authenticated-v1`.
- [x] Videos account bootstrap fetches `/api/videos`; guest bootstrap reads only bounded local history/progress.
- [ ] Video POST creates one subject-owned row with progress and duplicate POST updates it without changing `created_at`.
- [ ] Account A GET/POST/DELETE cannot observe or mutate Account B rows.
- [x] Guest history and playback generate no call to protected video APIs.
- [x] Migration/schema/rendered route contracts include all resume columns and existing unique/index ownership constraints.
- [x] Sign out wording/action is consistent on Library, Practice, Videos, Trainer, and Settings.

## End-to-End Tests

- [ ] Guest opens `/`, `/practice`, `/videos`, and `/trainer`; all render without Access navigation and show Sign in.
- [ ] Sign in from Videos returns to Videos, shows Sign out, and loads account D1 history.
- [ ] Sign in through Settings then navigate to each public page; every page recognizes the account.
- [ ] Account opens a video, advances captions, pauses/leaves, and a second browser/session restores the D1 caption anchor.
- [ ] Sign out, revisit each public page, and verify guest state with no former-account data.
- [ ] Existing Full Video warm transition performs zero extra YouGlish fetches; cold restore performs at most one.

## Test Data

- Deterministic Access identity fixtures for two subjects and two accepted audiences; tokens/verifiers are synthetic and contain no real account data.
- In-memory/fake D1 rows for two users sharing the same YouTube ID to prove composite ownership.
- Boundary fixtures for 11-character YouTube IDs, resume seconds, caption IDs/text, timestamps, and oversized payloads.
- Existing YouGlish live-caption trace fixture remains unchanged for provider regression coverage.

## Test Reporting & Coverage

- Red/green proof: run each new regression test before production code (expected failure), after implementation (pass), with the fix temporarily reverted (failure), and restored (pass).
- Targeted commands are recorded in the implementation log and task evidence.
- Final gates: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check`, and `npx ai-devkit@latest lint --feature auth-session-video-persistence`.
- Coverage gaps must be named; a source-regex assertion alone cannot prove runtime auth or D1 ownership.

### Executed evidence

- Red: session/client tests failed on the missing authoritative bootstrap and local-hint behavior.
- Red: video schema/API tests failed on missing resume columns/helper/route contract.
- Red: synchronization tests failed on missing throttle/flush controller; later retry and stored-row normalization tests also failed before their implementations.
- Red/green review regression: account history requests initially serialized `progress: null` when `localStorage` was unavailable; the focused Trainer contract failed before the fallback fix and passed after account payloads began omitting absent progress.
- Red/green live-preview regression: the branch Access application audience was absent from preview Worker variables, reproducing the authenticated `/login` `401`; the deployment-config test fails when that audience is removed and also proves production is not widened.
- Green targeted suites cover Access JWT issuer/audience/expiry, cookie/header extraction, safe redirects, all client bootstraps, progress validation/freshness, controller timing/retry, migration contract, Trainer wiring, and Videos source selection.
- Local Wrangler applied migrations `0000` through `0011`; pragma readback proved the four expected columns, defaults, and nullability.
- The first full wildcard run passed 162/164 and exposed two obsolete assertions for the old no-progress signatures; both were reconciled with the intentional contract. The latest `npm test` build plus wildcard suite passed 168/168 after the preview-AUD regression was added.
- Regression sensitivity proof: temporarily routing the client probe to `/api/me` made `tests/client-session.test.mjs` fail 2/3 with the expected endpoint mismatch; restoring `/api/session` passed 3/3.

### Named remaining gaps

- The current harness separately proves Access JWT verification, optional response shape, and Worker routing order, but does not execute the bundled Worker with an injected Access verifier. It also proves subject scoping from SQL/source contracts but does not execute `app/api/videos/route.ts` against a two-user D1 fixture. A future Worker integration harness should close these unchecked integration cases.
- No line/branch coverage reporter is configured. Coverage claims are therefore contract/test-case based, not a numeric line percentage.
- Authenticated cross-application and cross-browser E2E requires the real Cloudflare Access configuration and a user-controlled Google session; all E2E items remain unchecked until authorized deployment smoke.

## Manual Testing

- Check desktop and mobile headers for consistent account action and no auth-state flicker that exposes account data.
- Verify Google Access login from Library, Practice, Videos, Trainer, and Settings without entering credentials into automation.
- Verify Access logout clears the application cookie immediately; allow the documented 20–30 second global revocation window before a cross-application assertion check.
- Query only aggregate D1 counts/metadata before and after smoke; do not print subjects, email, queries, captions, or tokens.

## Performance Testing

- Simulate rapid caption callbacks and assert the 15-second write bound plus one final flush.
- Compare public page bootstrap request count: one session probe for guest; one session probe plus the existing page account request for a signed-in user.
- Confirm payloads stay below the existing 16 KiB route limit and keepalive constraints.

## Bug Tracking

- Authentication false-guest state, cross-account data exposure, or unprotected account mutation is release-blocking.
- Lost cross-device resume with safe local fallback is high severity; provider restore precision beyond the accepted caption boundary is out of scope.
- Any test-discovered requirements/design contradiction returns to the corresponding lifecycle phase before implementation continues.

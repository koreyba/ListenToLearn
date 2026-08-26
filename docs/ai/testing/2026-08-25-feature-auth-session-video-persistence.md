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

### Access login exchange and application sessions

- [x] Access JWT issuer, audience, signature, lifetime, and subject validation fails closed.
- [x] Only `/login` consumes an Access assertion; ordinary requests ignore Access identity.
- [x] Session token generation produces 32 random bytes encoded as bounded base64url; D1 stores only SHA-256.
- [x] Exact application-cookie parsing rejects prefix/suffix/oversized/invalid tokens.
- [x] Session creation rotates an existing token, prunes expired rows, and uses a fixed 30-day expiry.
- [x] Session resolution returns the joined D1 user only for a known non-expired hash and deletes an expired matching row.
- [x] Logout deletes the current hash before returning success and clears both current and legacy cookies.
- [x] Malformed cookie parsing cannot inject another cookie value or trusted internal header.
- [x] Safe `returnTo` accepts approved relative learning pages and rejects external/protocol-relative/unapproved/oversized values.
- [x] Public route matrix includes `GET /api/session` but keeps account mutations protected.
- [x] Application cookie attributes are `__Host-`, HttpOnly, Secure, SameSite=Lax, path `/`, and bounded to 30 days.
- [x] Legacy signed-out marker is ignored for authorization and cleared during login/logout rollout.
- [x] Verified explicit login sets the application cookie and allows the public Settings return target without allowing dot-segment/open redirects.

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

- [ ] Worker `GET /api/session` returns `no-store` guest JSON without an app session and D1 user JSON with a valid app session.
- [ ] Worker account routes use only the D1 app session; forged internal headers and Access assertions on non-login paths do not authorize.
- [ ] Worker `/login` exchanges a verified Access identity for a rotated session; `/api/logout` revokes it.
- [x] Library/Practice, Videos, and Trainer always probe session; none branches solely on `listen-to-learn-authenticated-v1`.
- [x] Videos account bootstrap fetches `/api/videos`; guest bootstrap reads only bounded local history/progress.
- [ ] Video POST creates one subject-owned row with progress and duplicate POST updates it without changing `created_at`.
- [ ] Account A GET/POST/DELETE cannot observe or mutate Account B rows.
- [x] Guest history and playback generate no call to protected video APIs.
- [x] Migration/schema/rendered route contracts include all resume columns and existing unique/index ownership constraints.
- [x] Sign out wording/action is consistent on Library, Practice, Videos, Trainer, and Settings.
- [x] `/logout` is public, revokes only the Unmumble session, returns home without Access navigation, and keeps revocation failures inside the app.
- [x] Settings stays public/guest after logout; legacy `/integrations` redirects to `/settings`.

## End-to-End Tests

- [ ] Guest opens `/`, `/practice`, `/videos`, and `/trainer`; all render without Access navigation and show Sign in.
- [ ] Sign in from Videos returns to Videos, shows Sign out, and loads account D1 history.
- [ ] Sign in through Settings then navigate to each public page; every page recognizes the D1 application session.
- [ ] Account opens a video, advances captions, pauses/leaves, and a second browser/session restores the D1 caption anchor.
- [ ] Sign out, revisit each public page including Settings, and verify guest state with no former-account data despite active Access global SSO.
- [ ] Existing Full Video warm transition performs zero extra YouGlish fetches; cold restore performs at most one.

## Test Data

- Deterministic Access identity fixtures for two subjects and two accepted audiences; tokens/verifiers are synthetic and contain no real account data.
- Deterministic fake D1 session adapter plus generated opaque tokens; assertions never contain production cookies or token hashes.
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
- Red for the final session redesign: seven focused failures captured the missing opaque-session module/table, Cloudflare logout removal, public Settings routing, audience narrowing, and login-only Access exchange.
- Green for the final session redesign: 31 focused tests pass for token generation/hash, exact cookies, rotation/expiry/revocation, D1 storage contract, client logout, public Settings, and Worker route authority.
- Green targeted suites cover Access JWT issuer/audience/expiry, cookie/header extraction, safe redirects, all client bootstraps, progress validation/freshness, controller timing/retry, migration contract, Trainer wiring, and Videos source selection.
- Local Wrangler applied migrations through `0012`; pragma readback proved `app_sessions` columns, foreign key, and user/expiry indexes in addition to the video resume fields.
- Remote preview Wrangler applied the two pending migrations, `0010` and `0011`. A fresh list reports no pending migrations; pragma readback proves `language`, `accent`, `resume_seconds`, `resume_caption_id`, `resume_caption_text`, and nullable `progress_updated_at` with the expected defaults.
- Final rollout applied `0012_app_sessions.sql` to preview and production; production also applied its pending `0011`. Fresh remote lists report no pending migrations, and aggregate-safe pragma readback proves all four session columns plus primary-key, user, and expiry indexes in both databases.
- Deployed Worker versions `33adbfc7-7fec-49a0-be45-39d19686fe24` (preview) and `6632b88a-f235-43eb-b6ca-a9d58a6c92ae` (production) both pass explicit login return and account Settings/Videos UI smoke; aggregate D1 readback reports one active application session in each environment.
- Post-cutover Access readback contains only the exact production and stable-preview `/login` destinations on the main application, with its audience, Google IdP, policy, and duration preserved; the redundant Settings application is absent.
- Cookie-free deployed matrix passes in both environments: five public UI/redirect routes, guest `/api/session`, and JSON `401` for Videos and Integrations account APIs.
- Authenticated live-preview smoke after migration loads Practice without the former empty-JSON alert and loads Videos account history with a valid empty state and Sign out action.
- The fresh final build and wildcard suite pass 178/178, followed by TypeScript, lint, feature-document lint, and diff checks.
- Regression sensitivity proof: temporarily changing the required 43-character token length to 42 made all four opaque-session tests fail; restoring 43 passed 4/4 and the full 178/178 suite.

### Named remaining gaps

- Pure session behavior is runtime-tested with a fake store and the D1 schema/store/Worker boundary has source-contract coverage. A full bundled-Worker/D1 integration harness remains desirable if Vinext permits handler and D1 injection.
- No line/branch coverage reporter is configured. Coverage claims are therefore contract/test-case based, not a numeric line percentage.
- The new D1 application-session exchange and account reads are live-proven in both environments. Video write/update/delete, cross-browser restore, and the final interactive Sign out/refresh sequence remain manual release evidence.

## Manual Testing

- Check desktop and mobile headers for consistent account action and no auth-state flicker that exposes account data.
- Verify Google Access login from Library, Practice, Videos, Trainer, and Settings without entering credentials into automation.
- Verify Sign out, refresh, and navigation across all public pages including Settings remain guest while global Access SSO is active; verify account APIs return Worker JSON `401`; then verify explicit Sign in creates a new application session.
- Query only aggregate D1 counts/metadata before and after smoke; do not print subjects, email, queries, captions, or tokens.

## Performance Testing

- Simulate rapid caption callbacks and assert the 15-second write bound plus one final flush.
- Compare public page bootstrap request count: one session probe for guest; one session probe plus the existing page account request for a signed-in user.
- Confirm payloads stay below the existing 16 KiB route limit and keepalive constraints.

## Bug Tracking

- Authentication false-guest state, cross-account data exposure, or unprotected account mutation is release-blocking.
- Lost cross-device resume with safe local fallback is high severity; provider restore precision beyond the accepted caption boundary is out of scope.
- Any test-discovered requirements/design contradiction returns to the corresponding lifecycle phase before implementation continues.

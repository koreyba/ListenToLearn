---
phase: implementation
title: Authentication Session and Video Persistence Implementation
description: Access login exchange, revocable D1 sessions, public learning UI, and account video resume
---

# Authentication Session and Video Persistence Implementation

## Development Setup

- Isolated worktree: `.worktrees/feature-auth-session-video-persistence` on branch `feature-auth-session-video-persistence`.
- Durable AI DevKit task: `121411b4-6fa8-41f4-99c6-c7477ebe2c89`.
- PR #19 already contains the earlier video-resume work; this revision replaces the interim signed-out marker with application-owned sessions.
- Wrangler applied migration `0012` to local, preview, and production D1; production also applied its pending `0011`. Fresh lists report no pending migrations and both remote databases expose the expected `app_sessions` columns and indexes.

## Code Structure

- `lib/access-session.ts`: accepts only the Access assertion injected on explicit `/login` and verifies it cryptographically.
- `lib/app-session.ts`: exact cookie parsing, 256-bit token issue, SHA-256 hashing, fixed expiry, rotation, resolution, revocation, and cookie helpers.
- `lib/d1-app-sessions.ts`: injected D1 adapter for transactional rotation, user join, and revocation.
- `worker/index.ts`: login exchange, public session probe, logout, public-route routing, and app-session authorization for every account API.
- `db/schema.ts`, `drizzle/0012_app_sessions.sql`: hashed application-session table plus user and expiry indexes.
- `lib/client-session.ts`, `app/logout/page.tsx`: branded application logout without Cloudflare logout navigation.
- `/settings`: public shell that loads `/api/integrations` only after an application session; legacy `/integrations` redirects to it.
- Existing video resume schema/API, throttled progress controller, and Library/Practice, Videos, and Trainer integrations remain intact.

## Authoritative Session

1. The learner explicitly opens `/login?returnTo=...`; Cloudflare Access supplies a Google-backed assertion only there.
2. The Worker verifies issuer, audience, signature, lifetime, and subject; it never accepts the Access cookie as product authorization.
3. The Worker upserts the user and generates 32 Web Crypto random bytes.
4. The raw unpadded base64url token is set only in `__Host-unmumble_session`; D1 stores only its SHA-256 hash.
5. `/api/session` and account APIs hash the cookie and join the active session to `users`; client-supplied identity and Access headers are stripped.
6. Login rotates the current browser session and prunes expired rows. Sessions have a fixed 30-day lifetime.

The old `__Host-listen_to_learn_signed_out` cookie is no longer an authority. Login and logout clear it only for rollout compatibility.

## Logout and Public Pages

- `completeSignOut()` posts only to `/api/logout`. It never calls `/cdn-cgi/access/logout`.
- The Worker deletes the current token hash before returning success, clears both application cookies, and leaves the learner on Unmumble.
- A revocation failure returns a no-store `503`; the branded page stays in a retryable error state instead of claiming success.
- `/`, `/practice`, `/videos`, `/trainer`, `/settings`, and `/logout` are public UI. `/integrations` redirects to `/settings` before session resolution.
- Guest clients keep bounded browser-local learning state. Signed-in clients use the existing subject-scoped D1 APIs.

## Account Video Persistence

- `saved_videos` stores bounded resume seconds, caption ID/text, and progress timestamp per `(user_id, youtube_video_id)`.
- POST validates optional progress and preserves existing resume fields when progress is omitted; GET normalizes stored values again.
- The Trainer mirrors changes locally, starts at most one background account write per 15 seconds, flushes meaningful exits, and retains the latest failed snapshot for retry.
- Videos uses D1 plus only the same subject's newer retry mirror for accounts; guests use anonymous local storage.

## Cloudflare Integration

- Production accepts only the main login application's audience. Preview additionally accepts the branch-preview administrative audience.
- The main Access application is to protect exact production and stable-preview `/login` destinations only.
- The redundant Settings/Integrations Access application is removed after the new Worker is deployed.
- Separate `unmumble-*` blue/green resources are not changed by this feature.

## Error Handling and Security

- Missing/unknown/expired sessions render public pages as guest and return JSON `401` from account APIs.
- D1 session lookup/create/revoke failure returns no-store `503`; it never falls back to Access identity.
- Session and account responses are `no-store`; public document caching remains bounded by existing rules.
- Tokens, hashes, cookies, Access JWTs, subjects, emails, captions, queries, and request bodies are not logged.
- Cookie attributes are host-only by construction: `__Host-`, `Path=/`, HttpOnly, Secure, SameSite=Lax, no Domain.
- Every account SQL operation remains scoped by the session-derived subject; neither request body nor client header supplies identity.

## Verification Snapshot

- Red-first focused suite failed seven assertions for the intentionally missing D1-session architecture.
- Green focused suite passes 31/31.
- Sensitivity proof: changing the exact token length from 43 to 42 makes 4/4 session tests fail; restoring it passes 4/4.
- Fresh full evidence: Vinext build and 178/178 tests pass, followed by `npx tsc --noEmit`, ESLint with only two generated-type warnings, AI DevKit feature lint, and `git diff --check`.
- Local migration `0012` applies with no pending migrations; pragma readback proves its columns and indexes.
- Remote preview and production migrations are complete. Preview version `33adbfc7-7fec-49a0-be45-39d19686fe24` and production version `6632b88a-f235-43eb-b6ca-a9d58a6c92ae` are deployed.
- Live explicit login returns to the allowlisted page in both environments and creates one active D1 session per environment. Settings loads account integration status after refresh.
- Access readback proves the main app retains its audience, Google IdP, 24-hour Access duration, and allow policy while protecting only the two exact `/login` destinations. The redundant Settings app deletion returned `202`; four unrelated/administrative apps remain unchanged.
- Cookie-free deployed smoke proves all UI pages return `200`, legacy `/integrations` returns `303 /settings`, `/api/session` returns the guest shape, and account APIs return Worker JSON `401` in preview and production. The final interactive logout/refresh smoke remains.

---
phase: requirements
title: Authentication Session and Video Persistence Requirements
description: Public learning pages, application-owned sessions, and D1-backed personalized history
---

# Authentication Session and Video Persistence Requirements

## Problem Statement

Unmumble is a public learning application with optional personalization. Every learning page, including Settings, must remain usable as a guest. A learner who explicitly signs in with Google gets account-scoped phrases, examples, integrations, video history, and resume progress from D1.

The previous design used Cloudflare Access both as the Google identity broker and as the application's long-lived session boundary. Path-level Access applications protected different pages and APIs, while a Worker-side signed-out marker tried to override Access global SSO. This caused three systemic defects: Settings could silently reauthenticate a signed-out user before the Worker ran, `/api/videos` was omitted from the Access path list, and preview-wide Access made guest behavior dependent on infrastructure policy.

The product needs one clear ownership model: Cloudflare Access proves Google identity only during explicit login; Unmumble owns its session from that point onward.

## Goals & Objectives

### Goals

- Keep `/`, `/practice`, `/videos`, `/trainer`, and `/settings` public and useful without login.
- Keep account data and mutations available only through a valid Unmumble session.
- Use the existing Google identity configured in Cloudflare Access without introducing another OAuth provider or client secret.
- Accept an Access JWT only on explicit `/login`, then exchange it for a revocable application session.
- Store only a cryptographic hash of the opaque session token in D1.
- Make Sign out delete the server-side session and clear the host-only cookie without navigating to a Cloudflare service page.
- Make refresh and navigation remain signed out until the learner explicitly selects Sign in again, even while Cloudflare global SSO remains active.
- Persist signed-in video history, resume seconds, and the last observed caption anchor in subject-owned D1 rows; keep guest history browser-local.
- Preserve the existing safe `returnTo`, phrase, example, integration, video-progress, and provider behavior.

### Non-goals

- Direct Google OAuth or replacing Cloudflare Access as the upstream identity proof in this release.
- Automatic guest-to-account history merge.
- Persisting UI-only preferences such as sort order, playback speed, selected accent, or panel state.
- Supporting authenticated PR branch previews for anonymous external reviewers. Preview-wide Access may remain an administrative gate, but it is not an Unmumble session.
- Preserving current user/session data during the migration; the owner explicitly permits account/session data loss.

## User Stories & Use Cases

- As a guest, I can open every page and use browser-local learning history without an authentication redirect.
- As a learner, I sign in explicitly with Google and return to the page where I started.
- As a signed-in learner, every page reads one authoritative Unmumble session and the same account-scoped D1 data.
- As a learner, Sign out immediately invalidates my server session, clears account state in the browser, and keeps me on the branded site.
- As a signed-out learner, opening Settings or any other public page never creates a new application session.
- As a learner with Cloudflare global SSO, only choosing Sign in again may create another Unmumble session.
- As a signed-in learner, video history and resume progress are available on another browser after that browser signs in.

### Edge Cases

- Missing, malformed, expired, revoked, wrong-issuer, or wrong-audience Access assertion on `/login`: fail closed with `401` and create no user/session.
- Access identity headers on any path other than `/login`: strip and ignore them.
- Missing, malformed, unknown, or expired Unmumble session cookie: resolve guest; protected APIs return `401`.
- A forged internal user header: strip before routing and derive identity only from the D1 session lookup.
- A malicious `returnTo`: redirect to `/` unless it is a bounded same-origin allowlisted UI path.
- Login when an old application session exists: revoke the old session and rotate to a new random token.
- Logout with D1 unavailable: do not claim server revocation; return a retryable failure without exposing credentials.
- Account A signs out and Account B signs in in the same browser: session rotation and user-namespaced retry keys prevent cross-account display.
- Expired session records: reject immediately and remove opportunistically; new login also prunes expired records.

## Success Criteria

- `GET /api/session` is public, `no-store`, and returns either the D1-resolved session user or `{ "user": null }`.
- `/login` is the only application path that accepts `Cf-Access-Jwt-Assertion` as authority; `CF_Authorization` is never parsed by application code.
- Successful `/login` verifies issuer, audience, signature, lifetime, and subject; ensures the D1 user; creates a 256-bit random opaque token; stores only its SHA-256 hash; and sets `__Host-unmumble_session` with `Path=/`, `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Application sessions have a fixed 30-day maximum lifetime and are revocable by deleting their D1 row.
- All protected APIs authorize through the Unmumble session and never require Access path protection.
- `POST /api/logout` deletes the current D1 session before clearing its cookie and returns branded JSON with `Cache-Control: no-store`.
- Sign out, refresh, navigation, and Settings remain guest until explicit `/login` is selected again.
- All UI routes are public at Cloudflare Access; the product Access application protects only exact `/login` destinations. A separate preview-wide administrative gate may protect branch previews.
- The redundant Settings/Integrations Access application no longer protects UI or API paths.
- Existing signed-out marker cookies are cleared during login/logout and are no longer consulted for authorization.
- D1 migrations add `app_sessions` with token-hash primary key, user foreign key, expiry index, and timestamps; account data remains user-scoped.
- Signed-in video GET/POST/DELETE and progress persistence work through the application session; guest actions cause zero D1 writes.
- Targeted TDD, full tests, typecheck, lint, build, migration readback, Access readback, deployed guest smoke, and authenticated login/logout/persistence smoke pass.

## Constraints & Assumptions

- Runtime remains Cloudflare Worker + Vinext + D1 + Cloudflare Access Free.
- Access `sub` remains the stable D1 user ID; email and display name are mutable profile fields.
- Session tokens use Web Crypto randomness and SHA-256; no application session secret is required or committed.
- Cookie authentication uses `SameSite=Lax` and a `__Host-` cookie. Mutation APIs retain same-origin browser behavior and never accept identity from request bodies or query parameters.
- Access global SSO may silently satisfy an explicit `/login`; that is acceptable because the user initiated Sign in. It must never create an application session during ordinary navigation.
- Preview-wide Access is operational access control, not product authentication. Worker authorization ignores its assertion outside `/login`.
- Destructive cleanup of current users/sessions is allowed, but migrations remain structurally reversible by Worker rollback and do not delete learning rows unless explicitly needed.

## Questions & Open Items

No material product or architecture question remains. The approved target is an application-owned, D1-backed session exchanged from a verified Access Google identity only on explicit `/login`.

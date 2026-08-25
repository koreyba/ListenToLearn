---
phase: requirements
title: Authentication Session and Video Persistence Requirements
description: Make authentication state consistent on every public page and persist signed-in video history and resume data in D1
---

# Authentication Session and Video Persistence Requirements

## Problem Statement

ListenToLearn deliberately keeps Library, Practice, Videos, and Trainer public, while Settings and account APIs require Google authentication through Cloudflare Access. The public clients currently infer authentication from `listen-to-learn-authenticated-v1` in `localStorage` instead of asking an authoritative session boundary. This creates false guest states after a valid login, especially when entering through Settings, another tab, or a browser where the hint is absent or stale.

Videos has a second production defect. `/api/videos` is absent from the account Access application's protected paths. A live unauthenticated check therefore reaches the Worker without `Cf-Access-Jwt-Assertion` and returns `401` instead of entering the Access flow. Production D1 contains three user rows and zero `saved_videos` rows, consistent with signed-in video writes never reaching an authenticated route.

The existing account video record stores the Continue Watching item in D1, but resume seconds and the last observed caption anchor were intentionally browser-local. The new product requirement supersedes that boundary: signed-in learning history must survive another browser/device; guests must remain browser-local.

## Goals & Objectives

### Goals

- Keep `/`, `/practice`, `/videos`, and `/trainer` usable without login; keep `/integrations` protected.
- Make every public page derive Sign in/Sign out and guest/account mode from a verified current session, never a client hint alone.
- Make Sign in return to the public page where it started through a same-origin allowlisted `returnTo` value.
- Make Sign out use the official Cloudflare Access application-domain logout endpoint in the background, then return to the public Library without exposing Cloudflare's service page.
- Protect `/api/videos` with the same account Access policy as `/login`, `/api/me`, `/api/phrases`, `/api/examples`, and `/api/translate`.
- Persist signed-in Continue Watching records, resume seconds, last observed caption ID/text, and progress timestamp in user-scoped D1 rows.
- Keep guest video history and resume progress bounded in `localStorage`.
- Preserve phrase progress, custom phrases, saved examples, and integrations as their existing D1-backed account data.

### Non-goals

- Making Settings or any user-owned mutation API public.
- Automatically importing or merging guest phrases, clips, history, or resume progress into an account at login.
- Persisting UI-only preferences such as sort order, playback speed, selected accent, panel state, or transient caption history in D1.
- Persisting a full transcript or captions that the learner did not observe.
- Guaranteeing exact-second cold YouGlish restore; the accepted contract remains restore at the last observed caption boundary.
- Replacing Cloudflare Access with application-owned Google OAuth.

## User Stories & Use Cases

- As a guest, I can open every learning page and use browser-local history without being forced to authenticate.
- As a signed-in learner, I see the same account state and Sign out action on Library, Practice, Videos, and Trainer, regardless of which protected route established the Access session.
- As a learner who chooses Sign in from Videos or Trainer, I return to that page after Google authentication instead of being forced to the Library.
- As a signed-in learner, choosing `Continue in video` creates or refreshes one D1 history row for that YouTube video.
- As a signed-in learner, my last observed caption anchor and approximate resume seconds are available on another browser/device.
- As a guest, the same actions never create or update D1 rows.
- As a learner who signs out, the next public page renders guest state and cannot read the former account's data.

### Edge cases

- Missing, malformed, expired, revoked, wrong-issuer, or wrong-audience Access token: session is guest and protected APIs fail closed.
- A client forges `x-listen-to-learn-user` or identity headers: the Worker removes them before routing.
- A malicious `returnTo` uses another origin, protocol-relative URL, encoded traversal, query injection, or an unapproved path: redirect to `/`.
- Browser storage is unavailable: authoritative session detection and D1 persistence still work; guest state may remain in memory with a warning.
- D1 progress write fails or the page closes during a write: same-browser progress remains in a bounded local mirror and the UI reports/safely retries later; it must not claim server persistence.
- Account A signs out and Account B signs in in the same browser: local retry/progress keys are user-namespaced and never shown across accounts.
- Duplicate history write for the same `videoId`: update one `(user_id, youtube_video_id)` row and retain its original `created_at`.
- Invalid resume seconds/caption metadata: reject or normalize without damaging the existing valid history row.

## Success Criteria

- Fresh automated coverage proves Library/Practice, Videos, and Trainer probe an authoritative session and do not gate account bootstrap solely on `localStorage`.
- A verified Access JWT supplied as the protected-route assertion or cryptographically verified application cookie resolves the same user; missing/invalid identity resolves guest.
- `GET /api/session` is public, `no-store`, returns only verified current-user display/session data or `{ user: null }`, and never accepts query/body/client headers as identity.
- Sign in links carry only safe relative return targets; successful `/login` redirects to the allowlisted target with a bootstrap marker.
- All learning pages use consistent `Sign in with Google` / `Sign out` wording; Settings remains protected and exposes Sign out only after Access authentication.
- `/api/videos` is covered by Cloudflare Access in preview and production; an unauthenticated live request receives an Access redirect, not the Worker's bare `401`.
- D1 migration adds bounded resume fields to `saved_videos`; account GET/POST round-trips them under the verified subject.
- During continuous playback, account progress writes are throttled to at most one background write per 15 seconds, with a final keepalive flush on pause/navigation/pagehide when data changed.
- Guest history/progress performs zero D1 writes. Account A cannot read, update, or delete Account B history or progress.
- Video cards use account resume data in account mode and guest local resume data in guest mode; account data can restore on a second browser.
- Existing warm transition, one-fetch cold restore, caption controls, phrase/clip behavior, and optional DeepL behavior do not regress.
- Feature lint, targeted red/green regression tests, full tests, typecheck, lint, build, migration checks, and live auth/D1 smoke all pass.

## Constraints & Assumptions

- Runtime remains Cloudflare Worker + Vinext + D1 + Cloudflare Access Free; no new paid service is introduced.
- Access identity remains the verified JWT `sub`; email is display/legacy-migration data, not a mutable primary key.
- Cloudflare documents that Access adds `Cf-Access-Jwt-Assertion` to protected origin requests and that the browser application token is a signed `CF_Authorization` cookie. The Worker may accept that cookie only after the same issuer/audience/signature verification used for the header.
- Cloudflare application-domain `/cdn-cgi/access/logout` is the supported logout target and does not document an application return URL. The public `/logout` page therefore requests it in the background with manual redirect handling, returns home only after the request resolves, and keeps a branded retry state on failure. Token revocation may take 20–30 seconds globally; protected APIs remain authoritative.
- Automatic guest-to-account merge stays explicitly deferred to avoid silently combining unrelated local and personal histories.
- Learning/domain data is in scope for D1; presentation preferences remain browser-local by design.

## Questions & Open Items

No material product question remains. The chosen scope is: authoritative session on every learning page, no automatic guest merge, D1-backed account video history plus last-caption resume, and browser-local UI preferences.

Deployment still requires an operational Cloudflare Access edit and live Google-session smoke. That change must preserve the current allow policy and audiences while adding `/api/videos`; it is not inferred from code deployment alone.

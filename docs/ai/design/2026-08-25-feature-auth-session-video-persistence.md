---
phase: design
title: Authentication Session and Video Persistence Design
description: Access-backed explicit login exchanged for revocable Unmumble D1 sessions
---

# Authentication Session and Video Persistence Design

## Architecture Overview

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Cloudflare Access
  participant W as Unmumble Worker
  participant D as D1

  B->>A: Explicit GET /login?returnTo=/videos
  A->>A: Google authentication / global SSO
  A->>W: /login + verified Access JWT assertion
  W->>W: Verify issuer, audience, signature, expiry
  W->>D: Upsert user; rotate opaque app session
  W-->>B: __Host-unmumble_session + 303 /videos
  B->>W: GET /api/session with app cookie
  W->>D: SHA-256 token lookup + user join
  W-->>B: Account session JSON
  B->>W: POST /api/logout
  W->>D: Delete session hash
  W-->>B: Clear app cookie; remain on Unmumble
```

- Cloudflare Access is an upstream identity broker only. It protects exact `/login` destinations and may separately protect branch previews as an administrative gate.
- `worker/index.ts` is the product trust boundary. It strips all incoming identity headers. It verifies Access only for `/login`; every other account request resolves an opaque Unmumble cookie through D1.
- Public pages always render. Clients probe public `GET /api/session` to choose guest-local or account-D1 behavior.
- Settings is a public shell. Integration status and mutations require the same Unmumble session as every other account API.

## Data Models

New `app_sessions` table:

```text
token_hash   TEXT PRIMARY KEY             # base64url SHA-256, never the raw token
user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
created_at   TEXT NOT NULL
expires_at   TEXT NOT NULL
```

Indexes:

- primary-key lookup by `token_hash` for every session resolution;
- `idx_app_sessions_user` for account-wide revocation/cleanup;
- `idx_app_sessions_expires` for expired-record pruning.

The browser cookie contains a 32-byte Web Crypto random token encoded as unpadded base64url. Its fixed maximum lifetime is 30 days. Login deletes the current cookie's session when present, prunes expired sessions, then inserts a new hash. Logout deletes the current hash before clearing the cookie.

Existing `saved_videos` retains one row per `(user_id, youtube_video_id)` with resume seconds, last caption ID/text, and progress timestamp. Guest history remains bounded in `localStorage`; signed-in D1 remains the cross-browser source of truth.

## API and Route Contracts

### `GET /login?returnTo=...` — Access-protected identity exchange

1. Extract only the Access assertion added by Cloudflare for this route.
2. Verify JWT issuer, one accepted login audience, signature, lifetime, and `sub`.
3. Ensure the D1 user using `sub` as immutable ID.
4. Rotate to a new opaque application session.
5. Set `__Host-unmumble_session=<raw token>; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`.
6. Clear legacy `__Host-listen_to_learn_signed_out` during rollout.
7. Redirect with `303` to a bounded allowlisted UI target plus `signedIn=1`.

No other path may exchange an Access JWT for an application identity.

### `GET /api/session` — public optional application session

Always returns `200`, `Cache-Control: no-store`:

```json
{ "user": null }
```

or the minimal D1 user:

```json
{ "user": { "id": "subject", "email": "learner@example.com", "name": "Learner" } }
```

Unknown/expired tokens resolve guest. An expired matching row is deleted opportunistically.

### Account APIs — Worker-protected

For `/api/me`, `/api/phrases`, `/api/examples`, `/api/translate`, `/api/videos`, and `/api/integrations`, the Worker:

1. resolves the application session from D1;
2. returns `401` when absent/invalid;
3. injects the normalized internal user context after stripping any client-supplied copy;
4. routes to the existing subject-scoped handler.

Cloudflare Access does not protect these APIs. This avoids redirect HTML/302 responses at JSON boundaries and makes preview/production authorization identical.

### `POST /api/logout` — server revocation

- Resolve the exact application cookie, hash it, and delete its D1 row.
- If deletion fails, return a retryable no-store error and do not claim success.
- On success (including an already-unknown token), return `{ "signedOut": true }` and clear both the current application cookie and the legacy signed-out marker.
- The branded `/logout` page calls only this endpoint and returns to `/`; it does not call Cloudflare's global logout endpoint.

### Public route behavior

- UI routes `/`, `/practice`, `/videos`, `/trainer`, `/settings`, `/logout`, and legacy `/integrations` remain public.
- `/integrations` permanently redirects to `/settings` before account resolution.
- `GET /api/session` and read-only Tatoeba proxy remain public; account APIs remain fail-closed in the Worker.

## Component Breakdown

- `lib/access-session.ts`: Access assertion extraction and cryptographic login identity verification only.
- `lib/app-session.ts`: cookie parsing/encoding, Web Crypto token generation/hash, D1 create/resolve/revoke, and response-cookie helpers.
- `worker/index.ts`: route classification, login exchange, public optional session, logout revocation, and internal identity propagation.
- `lib/auth.ts`: ensures the Access-proven user at login and continues handler-level defense in depth.
- `lib/client-session.ts` and `app/logout/page.tsx`: authoritative session probe and branded application logout without Cloudflare navigation.
- `db/schema.ts` and migration: `app_sessions` table and indexes.
- Settings, Videos, Trainer, Library/Practice: unchanged client contract around `/api/session`; Settings loads account APIs only after a real app session.

## Design Decisions and Alternatives

### Chosen: opaque server-side D1 sessions

Only a random bearer token reaches the browser and only its hash reaches D1. Server deletion provides immediate revocation and requires no committed/runtime signing secret. The extra D1 lookup is acceptable for the current small learning application and gives a single auditable authorization boundary.

### Rejected: continue using Access cookies plus a signed-out marker

It cannot provide true per-application logout because Access global SSO can reissue application tokens. It also couples every account API to an external path list, which already omitted Videos.

### Rejected: stateless signed application JWT

It removes a D1 read but makes logout unable to revoke a copied token without a denylist and introduces a long-lived signing secret. That is worse for this product's explicit logout requirement.

### Deferred: direct Google OAuth

Direct OAuth is conventional for a consumer product, but it requires separately managed Google credentials and callback configuration. The selected exchange keeps existing Google identity and achieves clean application session ownership now; a future provider migration changes only `/login`, not API authorization.

### Chosen: Access only on `/login`; preview-wide Access is administrative

Production/public UI and JSON APIs are never path-protected by Access. A branch-preview `preview_worker` application may remain owner-only for deployment confidentiality, but its assertion is ignored outside explicit `/login` and therefore cannot silently sign the product back in.

## Security and Reliability

- 256-bit Web Crypto tokens; SHA-256 hashes only in D1; constant-format cookie names and size bounds.
- `__Host-`, HttpOnly, Secure, SameSite=Lax cookie prevents JavaScript access, subdomain setting, and normal cross-site POST attachment.
- Access tokens, application tokens, hashes, cookies, user identifiers, and learning payloads are never logged.
- All account SQL remains subject-scoped; session identity cannot come from query/body/client headers.
- Session and auth responses are `no-store`; public documents retain existing cache behavior.
- Fixed expiry avoids a D1 write on every request. Login and expired-token lookup prune stale sessions.
- Migration is additive. Worker rollback may leave the unused session table safely in place.

## Rollout and Rollback

1. Apply the `app_sessions` migration to both preview and production D1.
2. Deploy both Workers while the old Access routes still exist; this is required because one Access application currently covers both environments.
3. Sign in once per environment to create and verify application sessions.
4. Restrict the shared main Access application to exact `/login` production and stable-preview destinations.
5. Remove `/integrations` and `/api/integrations` protection by deleting the redundant Settings Access application.
6. Keep or narrow preview-wide Access as an administrative gate; verify it no longer determines product session state.
7. Run guest, login, account API, video persistence, Settings, logout, refresh, and explicit re-login smoke in both environments.

Rollback restores the previous Worker and Access application snapshots. The additive session table remains; deleting current sessions is acceptable and forces a clean login.

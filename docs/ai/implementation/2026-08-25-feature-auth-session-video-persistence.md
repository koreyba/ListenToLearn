---
phase: implementation
title: Authentication Session and Video Persistence Implementation
description: Implemented trust boundary, D1 resume model, client mode selection, and throttled account synchronization
---

# Authentication Session and Video Persistence Implementation

## Development Setup

- Isolated worktree: `.worktrees/feature-auth-session-video-persistence` on branch `feature-auth-session-video-persistence`, based on `9683bdf`.
- Dependencies installed with `npm ci`; baseline and final Vinext builds pass.
- Durable AI DevKit task: `121411b4-6fa8-41f4-99c6-c7477ebe2c89`.
- Local D1 verification uses Wrangler's local state. PR #19 is published and Workers Builds uploaded its isolated branch preview version. Authorized preview D1 migrations `0010` and `0011` were applied and read back on 2026-08-25; no Access edit, preview promotion, production migration, or production deployment has been performed.

## Code Structure

- `lib/access-session.ts`: bounded header/cookie token extraction, cryptographic Access JWT verification, and minimal optional-session response.
- `lib/guest-access.ts`: public route matrix plus bounded allowlisted `returnTo` normalization.
- `lib/client-session.ts`: browser session probe, consistent login/logout links, and subject-namespaced progress keys.
- `worker/index.ts`: public `GET/HEAD /api/session` before generic guest routing; protected APIs still require verified identity.
- `lib/video-history.ts`: progress payload and stored-row normalization.
- `db/schema.ts`, `drizzle/0011_tranquil_siren.sql`: additive resume columns.
- `app/api/videos/route.ts`: subject-scoped GET/POST/DELETE with optional atomic progress upsert.
- `public/video-progress-sync.js`: deterministic 15-second coalescing controller with changed-only writes, keepalive flush, and retained failed snapshot.
- Library/Practice, Videos, Trainer, and Settings surfaces now use one Sign in/Sign out contract.

## Implementation Notes

### Authoritative session

- Public clients call `GET /api/session`; `listen-to-learn-authenticated-v1` has been removed as an authority.
- The protected-request assertion remains authoritative. Only the optional session endpoint may fall back to the exact `CF_Authorization` cookie.
- Cookie and assertion tokens pass the same `jose` issuer, audience, signature, expiry, and subject validation.
- `/login` accepts only `/`, `/practice`, `/videos`, or `/trainer` return paths (including bounded trainer query data); all other targets return to `/`.

### Account video persistence

- `saved_videos` adds `resume_seconds`, `resume_caption_id`, `resume_caption_text`, and `progress_updated_at` without changing existing keys or indexes.
- `POST /api/videos` validates origin and optional progress before D1 access. Omitted progress preserves existing resume fields; supplied progress updates them and a server timestamp in the same upsert.
- `GET /api/videos` normalizes stored resume fields again before returning them.
- Videos merges D1 progress with only the same subject's newer local retry mirror; guest mode uses the anonymous key.

### Trainer synchronization

- Every observed full-video progress change is written to the current local mirror immediately.
- The controller sends the first changed account snapshot immediately, coalesces later snapshots to one background start per 15 seconds, ignores an already-delivered identical snapshot, and retains a failed latest snapshot for retry.
- Pause, leaving Full Video, popstate, and pagehide flush pending progress; pagehide uses Fetch `keepalive`.
- The initial Full Video action includes current caption progress, avoiding a history-create/progress-update race.
- If browser storage is unavailable, the account request omits `progress` instead of sending `null`, so the D1 Continue Watching row is still created or refreshed safely.

## Integration Points

- Cloudflare Access still owns Google login. Production accepts the existing account and Settings audiences; preview additionally accepts the verified `preview_worker` application audience without widening production.
- Cloudflare Access configuration must add exact preview and production `/api/videos` destinations to the existing account application before release.
- D1 migration `0011_tranquil_siren.sql` must precede the Worker deployment.
- YouGlish restore behavior remains caption-boundary based; no provider fetch/seek contract was changed.

## Error Handling

- Invalid/missing session degrades public pages to guest mode; protected APIs remain fail-closed.
- Account page data failures keep the verified Sign out state and show an error instead of falsely showing Sign in.
- Failed account progress sync leaves the subject-namespaced local mirror intact and displays a sync warning.
- Invalid progress returns `400`; unexpected D1 failures return no-store `500` responses without logging request bodies or identity values.

## Performance and Security

- Optional session and account responses are `no-store`; static/public cache rules remain unchanged.
- Progress payloads remain under the existing 16 KiB body limit and are bounded to seven days, 160 caption-ID characters, and 1,000 caption-text characters.
- Every video SQL read/update/delete includes the verified subject; the client cannot supply identity.
- Identity headers are stripped before guest routing; JWTs, cookies, subjects, emails, queries, captions, and request bodies are not logged.

## Verification Snapshot

- Red-first tests captured missing session bootstrap, D1 progress schema/API, synchronization, retry, and stored-row normalization.
- The first full run discovered 164 tests; two obsolete expectations were updated for the intentional progress-aware signatures. The final review also caught and red/green-tested the unavailable-`localStorage` fallback; the preview-AUD follow-up brings the fresh suite to 168/168.
- Live PR preview diagnosis reproduced an authenticated `/login` `401`: Access issued the branch-preview application's audience while the deployed preview Worker accepted only the two production audiences. A red/green configuration test now requires the third audience in preview and rejects it in production.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, feature lint, `git diff --check`, and local D1 migration/schema readback pass.
- No P0/P1 code or design blocker remains in local review. The named runtime-harness and live-environment gaps remain explicit in the testing doc.
- Remaining release evidence is operational: production migration, Access edit/readback, authenticated preview write/update/delete and cross-browser restore, deployed guest smoke, and aggregate remote D1 delta. Authenticated preview Practice/Videos reads now pass after the preview migration.

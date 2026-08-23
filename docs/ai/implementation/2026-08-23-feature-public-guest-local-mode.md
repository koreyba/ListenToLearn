---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Development Setup

- Active worktree: `.worktrees/feature-public-guest-local-mode`.
- Bootstrap: `npm ci`.
- Task tracing probe was attempted with `npx ai-devkit@latest task list ...` and is unavailable because this CLI does not expose the `task` command; lifecycle evidence is kept in these docs and command output.

## Code Structure

- `lib/guest-library.ts` owns the serializable guest schema and pure state transitions.
- `app/page.tsx` will select guest or authenticated server mode.
- `public/trainer.html` will retain its existing anonymous trainer namespace and use the shared guest-library shape for library/example state.
- `worker/index.ts` will define the explicit public route allowlist and preserve the verified Access identity boundary.

## Implementation Notes

### Completed: guest state foundation

`lib/guest-library.ts` now provides:

- versioned `GuestLibraryState` with statuses, custom phrases and saved examples;
- normalization that rejects invalid statuses/providers and bounds stored values;
- idempotent custom phrase creation by case-insensitive text;
- immutable status and saved-example transitions;
- a stable guest storage key with no identity, token or secret fields.

Fresh proof: `node --test tests/guest-library.test.mjs` — 6 passed, 0 failed.

### Completed: public Worker boundary

`lib/guest-access.ts` defines a GET/HEAD-only allowlist for the public home, trainer, static assets and read-only Tatoeba proxy, plus a fixed `/login` redirect target. `worker/index.ts` now:

- strips `Cf-Access-Jwt-Assertion`, Access email and internal identity headers before every dispatch;
- sends unauthenticated unknown/protected paths to JSON `401`;
- dispatches only the explicit public allowlist without identity;
- verifies identity before injecting the internal user context;
- redirects an authenticated `/login` request to `/?signedIn=1`.

Fresh proof: `npx tsc --noEmit` — exit 0; `node --test tests/guest-library.test.mjs tests/guest-access.test.mjs` — 8 passed, 0 failed; `git diff --check` — exit 0.

### Completed: guest UI adaptation

`app/page.tsx` now starts in guest mode unless the explicit authenticated hint or `/login` marker is present. Guest preset/custom phrase status changes, additions, removals and reset use `listen-to-learn-guest-library-v1`; authenticated flows retain the existing D1 API calls.

`public/trainer.html` uses the same guest library key for local To Learn promotion and saved Tatoeba/YouGlish examples. It only probes `/api/me` when the account hint exists; otherwise bootstrap is entirely local. Guest translation explains the Google/DeepL requirement without blocking phrase progression. The trainer's existing playback preferences remain under the anonymous or user-namespaced trainer key.

Fresh proof: `npx tsc --noEmit`, `npm run lint` (0 errors, 2 pre-existing generated-file warnings), direct `vinext build`, `node --test tests/guest-library.test.mjs tests/guest-access.test.mjs tests/guest-ui.test.mjs tests/rendered-html.test.mjs`, and `git diff --check` passed.

### Pending implementation tasks

- Apply the path-scoped Cloudflare Access configuration and read it back.
- Preserve authenticated API and per-user storage behavior in live smoke.
- Add live Cloudflare public/protected and D1 no-write evidence.

## Integration Points

- Account APIs remain unchanged at their trust boundary and continue to resolve `getCurrentUser()` before D1 access.
- Guest mode may call only the read-only Tatoeba proxy; no guest route may call D1.
- Cloudflare Access path configuration will be read back via Cloudflare MCP before and after mutation.

## Error Handling

- Malformed localStorage falls back to a normalized empty state.
- Guest translation failure is informational and never blocks local phrase progression.
- Protected API calls without verified identity remain `401`/Access redirects.
- Invalid login return paths are ignored; Worker redirects only to the fixed public home marker.

## Performance Considerations

- Guest state is bounded in memory and localStorage; no D1 writes or cleanup jobs are introduced.
- Tatoeba remains the existing read-only external proxy; no new server-side cache is added.
- Worker public-route classification is O(1) over a small allowlist.

## Security Notes

- Delete the client-supplied internal identity header before both guest and authenticated handler dispatch; a forged header must never reach `ensureUser()`.
- JWT issuer, signature, expiry, subject and audience validation remain mandatory for protected routes.
- Guest localStorage is non-authoritative browser state; never put Access JWTs, subject headers, emails as credentials, DeepL keys or ciphertext there.
- Account keys remain encrypted in D1 and are never returned to guest or account UI.

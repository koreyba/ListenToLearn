---
phase: implementation
title: Implementation Guide
description: Technical implementation notes, patterns, and code guidelines
---

# Implementation Guide

## Development Setup
**How do we get started?**

- Use the repository Node engine (>=22.13) and install the locked dependencies.
- Run local checks through `bash scripts/sites-env.sh -- ...`; production values and secrets stay in Cloudflare.
- The Worker expects `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, the existing D1 binding, and the existing `INTEGRATIONS_ENCRYPTION_KEY` secret.

## Code Structure
**How is the code organized?**

- `worker/index.ts` is the authentication boundary; `lib/user-context.ts` carries trusted identity; `lib/auth.ts` owns users and legacy migration.
- `db/schema.ts` and `drizzle/0006_google_auth_per_user.sql` define the per-user data model.
- API routes scope reads and writes by the Access subject. UI code only receives status/display data, never plaintext provider keys.

## Implementation Notes
**Key technical details to remember:**

### Core Features
- Google authentication: verify Access JWT issuer, audience, signature, expiry, and `sub`; strip client identity headers and inject a compact internal context.
- Per-user state: presets remain shared catalog rows while progress, custom phrase ownership, examples, and encrypted integration secrets use the authenticated subject.
- Legacy handoff: the verified `koreybadenis@gmail.com` identity receives the rows created before auth on first login; the operation is idempotent.

### Patterns & Best Practices
- Fail closed on missing/invalid identity and return JSON 401 before user-owned SQL.
- Use parameterized D1 statements and explicit user filters on every user-owned table.
- Keep translation optional: DeepL failure returns a pending result while phrase progression still commits.

## Integration Points
**How do pieces connect?**

- Cloudflare Access performs the Google redirect and sends the JWT to the Worker.
- Vinext route handlers use the D1 `DB` binding. DeepL is called only with the current user's decrypted key.
- The old v1 AES-GCM associated-data format is supported for one-time rewrapping into user-bound v2 ciphertext.

## Error Handling
**How do we handle failures?**

- Authentication and authorization fail closed; malformed internal context is treated as unauthenticated.
- DeepL timeout/upstream/not-configured errors are converted to a safe pending translation path where the caller supports it.
- Logs include short safe error messages only; JWTs, cookies, request bodies, ciphertext, and plaintext keys are excluded.

## Performance Considerations
**How do we keep it fast?**

- JWKS objects are cached per Access team domain in the Worker isolate.
- Composite user indexes support progress, example, and secret lookups.
- DeepL keeps the existing 8-second timeout and translation backfill is bounded in batches.

## Security Notes
**What security measures are in place?**

- Cloudflare Access + Google is the only browser authentication boundary; application identity comes from a verified JWT `sub`.
- Request inputs are length-limited and parameterized; ordinary cookies, query/body identity, and client identity headers are not trusted.
- DeepL keys are AES-GCM encrypted with a Cloudflare Worker secret and bound to user and provider; only configured status reaches the UI.

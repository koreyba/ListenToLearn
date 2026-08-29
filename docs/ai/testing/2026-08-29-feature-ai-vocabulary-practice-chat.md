---
phase: testing
title: AI Vocabulary Practice Chat Testing
description: Verified feature coverage and remaining release checks
---

# AI Vocabulary Practice Chat Testing

## Automated Coverage

- [x] Exact bounded payloads, same-origin mutations, stable errors, saved/ad-hoc
  targets, three meaning modes, and all limits including the 48,000-character
  aggregate target prompt.
- [x] Migration 0016 fresh/existing application, preservation of prior data,
  ownership, snapshots, ordering, and idempotency.
- [x] Owned chat/meaning repository, atomic `PATCH` target replacement, canonical
  complete history, cross-user rejection, retry without duplicate user rows, and
  30-second stale-pending recovery with late-attempt CAS fencing and chronological
  history for retrying an older turn.
- [x] Learner-led prompt, multiple targets, `all_saved` / `selected` / `explore`,
  target-data isolation, deterministic truncation, and server-only OpenRouter
  runtime.
- [x] Streaming completion/failure persistence, request abort, browser cancellation,
  terminal idempotency, timeout/provider/empty failures, and missing configuration.
- [x] Multiple-chat UI, saved/ad-hoc controls, Library/Practice launch, plain text,
  word/phrase selection, `/api/translate` with `/api/ai/translate` fallback, add to
  `To Learn`, add meaning, and manual status wiring. Repeated phrase occurrences
  use their actual context and stale async translations cannot replace a newer
  selection with the same text in another context.

Fresh targeted command on 2026-08-29:

`node --test tests/ai-chat-*.test.mjs tests/interactive-english-text*.test.mjs`
— 84 passed, 0 failed.

## Manual Local Verification

- [x] Signed-in chat used both saved and ad-hoc targets.
- [x] A real bounded response streamed through OpenRouter preset
  `@preset/free-unmubme-test`.
- [x] Chat, targets, and complete messages survived local D1 reload/reopen.
- [x] A selected assistant word/phrase was translated through the available path.
- [x] Explicit add to `To Learn`, manual status transition, and explicit add
  meaning were exercised; AI performed none of these mutations.

## Repository Gates

- [x] Full repository tests pass on the final implementation diff.
- [x] Full lint passes.
- [x] Production build passes.
- [x] Final human review of security/privacy, responsive accessibility, and the
  intended diff.
- [ ] Production smoke after an explicitly approved deployment.

Live provider calls remain manual only; automated tests use controlled adapters and
never read or print a real credential.

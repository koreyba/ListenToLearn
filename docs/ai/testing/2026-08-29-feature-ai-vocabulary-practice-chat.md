---
phase: testing
title: AI Vocabulary Practice Chat Testing
description: Verified agent-tool contracts and remaining end-to-end gates
---

# AI Vocabulary Practice Chat Testing

## Fresh Automated Evidence

Fresh on 2026-08-29, the production build and full repository suite pass 466/466.
Typecheck, Drizzle schema check, lifecycle lint, diff check, and full lint also pass;
full lint reports zero errors and two warnings in generated
`worker-configuration.d.ts`.

### Covered in the current test tree

- [x] New chat reads the owner-bound latest five and persists a deterministic
  complete assistant opening without a synthetic user message or model call; when
  reused in model history it is escaped inside `UNTRUSTED_VOCABULARY_OPENING`.
- [x] Latest/search reads use active account-visible vocabulary, progress
  `created_at DESC` plus phrase-ID tie-breaker, exact-match-first search across text,
  legacy translation, and owner-isolated personal translations.
- [x] Read limits default/cap correctly; provider output exposes at most six
  meanings per entry, compacts the complete result to at most 7,800 JSON characters
  with meaning/detail truncation metadata, and stops one turn after two calls to
  retain D1 Free query headroom for worst-case writes.
- [x] Search rejects queries over 48 characters and escaped wildcard patterns over
  50 UTF-8 bytes, including Unicode and escape-expansion boundaries.
- [x] Direct write-command recognition rejects practice sentences, examples,
  negation, implied/history-only intent, and values absent from the current message.
- [x] Entry/meaning writes bind server identity, reject foreign/inactive targets,
  normalize duplicates, preserve omitted context, keep preset legacy fields
  immutable, and store every new user translation as a personal meaning.
- [x] Update-meaning requires current translation plus entry text in the same turn;
  owner/phrase/meaning/old translation/context CAS rejects stale/wrong state as a
  traced `mutation_conflict`. Historical owner-custom legacy meanings promote to a
  personal meaning and clear legacy fields atomically.
- [x] New/`pick` add becomes `to_learn`; all already active statuses remain
  unchanged across entry duplicates and meaning writes.
- [x] Manual preset phrase `PATCH` stores a generated fallback as a personal meaning,
  leaves shared preset fields unchanged, and commits meaning plus status atomically.
- [x] Migration 0017 merges historical ASCII-`NOCASE` custom duplicates while
  preserving progress, meaning translation/context/latest-update metadata,
  examples, videos, and chat references; Unicode case variants remain distinct.
  Migration 0018 covers attempts/ledger/receipts, and 0019 repairs duplicate
  pending attempts before enforcing one pending attempt per chat.
- [x] Every within-budget read/rejection/write has a bounded ledger row; call three
  onward returns `tool_budget_exceeded` before trace persistence, changed call
  identity is rejected, and stale/foreign attempts cannot register or mutate.
- [x] Domain mutation, postcondition receipt, and terminal tool-call result commit
  atomically; false postcondition rolls back, equivalent concurrency converges,
  ambiguous post-commit response resolves from the receipt, and changed arguments
  at the same `(userMessage, operation, target)` conflict.
- [x] Instrumented cold full-turn integration counts each D1 statement inside a
  batch: maximum reads use 34, two cold worst-case writes 42, one ambiguous commit
  44, a fully rolled-back mutation 45, and rollback plus ambiguous commit 47.
  Maximum 12-target create-chat ambiguous recovery uses 49/50. A third provider
  call is rejected before trace persistence and does not increase the count.
- [x] A mutation-batch failure is never retried blindly. Tests distinguish receipt
  recovery, stale-attempt rejection, proven CAS `mutation_conflict`, and otherwise
  `operation_failed`, without a partial mutation.
- [x] Failed/stale assistant retries create a new attempt, preserve the logical
  messages and their immutable <=48,000-character practice snapshot, ignore stale
  callbacks, replay receipts, and build older-turn context without later messages.
- [x] Assistant and tool completion plus receipt insert/commit/replay require a
  pending unexpired lease; exact fresh IDs recover ambiguous committed begin/retry
  batches and continue generation.
- [x] Prompt, generation, abort/cancel/error mapping, five-step bound, compact HTTP
  transport, owner-scoped routes, and the chat-only UI source contract are covered.
  The public stream allowlist drops tool/reasoning/source/file/step/raw/provider
  metadata, and provider 429 maps to `provider_rate_limited`.
- [x] Compatibility targets accept bounded saved/ad-hoc entries and all three
  meaning modes through atomic whole-array `PATCH` only; contextual AI translation
  remains authenticated, bounded, and server configured.
- [x] Account chat creation/listing is capped at 100, detail at the latest 200
  messages, model history at 40/32,000, and public DTOs omit internal context and
  provider/model/usage data.
- [x] Meaning-list reads return no more than 50 personal meanings plus an optional
  legacy meaning, while `meaningCount` and `meaningsTruncated` disclose the full
  visible total and truncation.
- [x] Ordinary `ensureUser` is one statement; atomic idempotent legacy-owner transfer
  is covered on login/session bootstrap and excluded from AI routes.

## Repository Verification

- [x] Fresh typecheck on the final current diff.
- [x] Fresh full repository tests and production build: 466/466.
- [x] Fresh full lint: zero errors and two generated-file warnings.
- [x] Fresh Drizzle schema check and tracked-secret/diff checks.
- [x] Fresh final security/privacy/accessibility/responsive/intended-diff review.
- [x] Lifecycle feature lint and docs diff check after this reconciliation.

## Preview Data Evidence

- [x] Read-only preview D1 preflight found no owner-custom ASCII-`NOCASE`
  duplicates at the time it was run.
- [x] Preview previously applied an older 0017 plus 0018, and remote readback exposed
  the three 0018 trace tables.
- [ ] Re-baseline preview or explicitly accept an equivalent forward migration for
  the corrected 0017 meaning-metadata behavior.
- [ ] Apply and verify migration 0019 in preview; no current application claim is
  made.

## Manual Authenticated Smoke

- [x] Branch-preview New Chat creation visibly shows all available latest entries
  and saved translations without a provider call (two entries existed in the
  inspected account).
- [ ] An empty account shows the honest empty opening, and reload preserves both
  empty and populated openings.
- [ ] “Покажи последние десять” and a text search return the real bounded D1 data,
  after which conversational subset practice uses saved meanings.
- [ ] Examples, context change, reverse-translation exercise, and answer feedback
  remain learner-directed in the chat-only interface.
- [ ] An explicit add-entry command commits once and reports the receipt-backed
  result; a practice request, negation, and ambiguous “save it” do not write.
- [ ] Explicit add-meaning/update-personal-meaning persists after reload; an owned
  historical custom legacy meaning promotes to personal, while preset-legacy and
  foreign meaning updates are denied.
- [ ] Before/after D1 inspection confirms active statuses never change through
  agent tools; only a genuinely new/`pick` add starts in `to_learn`.
- [ ] Interrupting after a committed write and retrying replays the receipt without
  another logical mutation; stale output cannot finish the new attempt.
- [ ] A bounded live response with tool use works through the configured local or
  preview provider, and logs/network data expose no key, hidden prompt, private
  vocabulary, tool arguments, or results.
- [x] A real published follow-up maps the observed OpenRouter usage-limit response
  to the dedicated safe UI error without exposing provider internals.
- [ ] Desktop and narrow viewport retain usable chat list, timeline, composer,
  loading/error, send, and retry states.

Automated tests use local D1 and controlled model/tool adapters. They never read,
print, snapshot, or call a real provider credential.

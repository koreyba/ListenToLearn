---
phase: testing
title: AI Vocabulary Practice Chat Testing
description: Verified agent-tool contracts and remaining end-to-end gates
---

# AI Vocabulary Practice Chat Testing

## Fresh Automated Evidence

Command run on 2026-08-29: `npm test`.

Result: full repository suite and production build passed 440/440. The preceding
review-focused suite passed 90/90 and typecheck passed.

### Verified by that suite

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
  normalize duplicates, preserve omitted context, and keep preset legacy fields
  immutable.
- [x] Update-meaning requires current translation plus entry text in the same turn;
  owner/phrase/meaning/old translation/context CAS rejects stale/wrong state as a
  traced `mutation_conflict`.
- [x] New/`pick` add becomes `to_learn`; all already active statuses remain
  unchanged across entry duplicates and meaning writes.
- [x] Manual preset phrase `PATCH` stores a generated fallback as a personal meaning,
  leaves shared preset fields unchanged, and commits meaning plus status atomically.
- [x] Migration 0017 merges historical ASCII-`NOCASE` custom duplicates while
  preserving progress, meanings, examples, videos, and chat references; Unicode
  case variants remain distinct. Migration 0018 covers immutable attempt identities,
  one pending lease, ledger/receipt constraints, replay, and cascade behavior.
- [x] Every within-budget read/rejection/write has a bounded ledger row; call three
  onward returns `tool_budget_exceeded` before trace persistence, changed call
  identity is rejected, and stale/foreign attempts cannot register or mutate.
- [x] Domain mutation, postcondition receipt, and terminal tool-call result commit
  atomically; false postcondition rolls back, equivalent concurrency converges,
  ambiguous post-commit response resolves from the receipt, and changed arguments
  at the same `(userMessage, operation, target)` conflict.
- [x] Instrumented cold full-turn integration counts each D1 statement inside a
  batch: two worst-case new-entry writes plus session lookup, cold user ensure, turn
  preparation, and completion use 45/50 statements; one ambiguous committed-write
  recovery uses 47/50. A third provider call is rejected before trace persistence
  and does not increase the count.
- [x] A transient pre-execution batch failure retries once; an unexplained double
  failure returns and records `operation_failed` without a partial mutation.
- [x] Failed/stale assistant retries create a new attempt, preserve the logical
  messages and their immutable <=48,000-character practice snapshot, ignore stale
  callbacks, replay receipts, and build older-turn context without later messages.
- [x] Assistant and tool completion plus receipt insert/commit/replay require a
  pending unexpired lease; exact fresh IDs recover ambiguous committed begin/retry
  batches and continue generation.
- [x] Prompt, generation, abort/cancel/error mapping, five-step bound, compact HTTP
  transport, owner-scoped routes, and the chat-only UI source contract are covered.
- [x] Compatibility targets accept bounded saved/ad-hoc entries and all three
  meaning modes through atomic whole-array `PATCH` only; contextual AI translation
  remains authenticated, bounded, and server configured.

## Repository Verification

- [x] Typecheck passes with `npx tsc --noEmit --incremental false --pretty false`.
- [x] Lifecycle feature lint passes on all lifecycle documents and the worktree.
- [x] Full repository tests and the production build stage pass: 440/440 tests.
- [x] Full lint exits successfully with zero errors and two warnings in generated
  `worker-configuration.d.ts`.
- [ ] Final human security/privacy/accessibility/responsive/intended-diff review.

## Preview Data Evidence

- [x] Read-only preview D1 preflight found no owner-custom ASCII-`NOCASE`
  duplicates; the tested 0017 merge still protects upgraded databases that have them.
- [ ] Preview migrations 0017 and 0018 remain unapplied.

## Manual Authenticated Smoke

- [ ] Creating a chat visibly shows the real latest five; an empty account shows
  the honest empty opening; reload preserves it.
- [ ] “Покажи последние десять” and a text search return the real bounded D1 data,
  after which conversational subset practice uses saved meanings.
- [ ] Examples, context change, reverse-translation exercise, and answer feedback
  remain learner-directed in the chat-only interface.
- [ ] An explicit add-entry command commits once and reports the receipt-backed
  result; a practice request, negation, and ambiguous “save it” do not write.
- [ ] Explicit add-meaning/update-personal-meaning persists after reload; legacy or
  foreign meaning update is denied.
- [ ] Before/after D1 inspection confirms active statuses never change through
  agent tools; only a genuinely new/`pick` add starts in `to_learn`.
- [ ] Interrupting after a committed write and retrying replays the receipt without
  another logical mutation; stale output cannot finish the new attempt.
- [ ] A bounded live response with tool use works through the configured local or
  preview provider, and logs/network data expose no key, hidden prompt, private
  vocabulary, tool arguments, or results.
- [ ] Desktop and narrow viewport retain usable chat list, timeline, composer,
  loading/error, send, and retry states.

Automated tests use local D1 and controlled model/tool adapters. They never read,
print, snapshot, or call a real provider credential.

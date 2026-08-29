---
phase: requirements
title: AI Vocabulary Practice Chat
description: Chat-only contextual practice with account-scoped vocabulary tools
---

# AI Vocabulary Practice Chat

## Problem

Words become usable through repeated context, not an isolated card. Unmumble already
provides real video contexts and a persistent vocabulary, while a general AI chat
can generate and explain new contexts but does not know that vocabulary. The feature
connects the two in one focused, learner-led conversation.

## Product Boundary

The current delivery is deliberately chat-only. The signed-in learner sees a chat
list, `New Chat`, messages, composer, send/retry, and essential loading/error states.
There are no target cards, meaning selectors, inline vocabulary/status controls, or
Library/Practice preselection entry points in this iteration.

When a chat is created, the server deterministically reads the learner's latest five
active vocabulary entries, formats their saved meanings, and persists that offer as
the first complete assistant message. It does not invent a user turn and does not
need a model call. Before that stored opening is reused in model history, it is
escaped and delimited as `UNTRUSTED_VOCABULARY_OPENING`. The learner then chooses
what to practise in text and may ask for examples, different contexts, explanations,
reverse translation, or answer checks.

## User Stories

- As a learner, I can open several persistent chats and continue their ordered
  history after reload.
- As a learner, a new chat immediately shows my actual latest five saved words or
  phrases and meanings, including an honest empty/fewer-than-five result.
- As a learner, I can ask for the latest `N` items or search my vocabulary in chat,
  then practise any conversational subset without configuring hidden targets.
- As a learner, I can practise an ad-hoc word without saving it.
- As a learner, I can explicitly command the chat to add a vocabulary entry, add a
  personal meaning, or update one of my personal meanings.
- As a learner, mentioning, practising, or showing interest in a word never saves
  it. A write requires a direct, unambiguous command in that same user turn.
- As a learner, AI never moves an existing item between `To Learn`, `Learning Now`,
  and `Learned`; those states remain manual elsewhere in the application.

## Functional Requirements

### Vocabulary reads

- `get_recent_vocabulary` reads 1–10 active entries and defaults to five.
- Recency is deterministic: learner-owned `phrase_progress.created_at DESC`, then
  `phrase_id DESC`. Shared phrase timestamps do not define learner recency.
- `find_vocabulary` performs an owner-scoped search across phrase text, legacy
  translation, and that learner's personal saved translations. It defaults to ten
  results, caps at ten, ranks exact matches first, then uses the same recency order.
- A search query is at most 48 characters. After `%`, `_`, and `\` are escaped for
  D1 `LIKE`, the complete wildcard pattern must be at most 50 UTF-8 bytes.
- Read results contain bounded text, read-only status, legacy meaning when present,
  owned personal meanings, total meaning count, and an honest
  truncation marker. Their complete `{ ok, entries }` JSON stays at or below 7,800
  characters by pruning meanings and then contexts; `meaningsTruncated` and
  `detailsTruncated` disclose those losses. Stored vocabulary is untrusted data,
  never instructions.
- `GET /api/ai/meanings?phraseId=...` returns at most 50 personal meanings plus an
  optional legacy meaning. `meaningCount` reports the full visible total and
  `meaningsTruncated` reports omitted personal meanings.

### Vocabulary writes

The only agent write operations are:

- `add_vocabulary_entry(text, translation?, context?)`;
- `add_vocabulary_meaning(phraseId, translation, context?)`;
- `update_vocabulary_meaning(meaningId, translation, context?)`.

Every write must be authorized from the current user message only. That message
must contain a direct vocabulary-write command and literally contain every text,
translation, and context value being written. Meaning writes must also literally
name the affected word or phrase. Prior turns, model suggestions, practice requests,
and ambiguous references provide no write authority.

Updating a personal meaning additionally requires the current/old translation to
appear literally in that same message. The update is a compare-and-swap bound to
owner, phrase ID, meaning ID, old translation, and old context. Missing, foreign,
or stale state returns a traced `mutation_conflict`; it never overwrites newer data.

Tool inputs never accept `userId`, `chatId`, status, provider/model, roles, SQL, or
arbitrary HTTP operations. Identity, active chat, current user message, assistant
message, and generation-attempt identity are injected by the server.

No agent tool can choose or update an active learning status. A genuinely new or
previously unsaved `pick` entry is initialized in `to_learn` as part of adding it;
an already active item's status is preserved exactly. Every newly supplied user
translation is stored as an owner-scoped personal meaning; new custom entries do
not populate the legacy translation field. Preset legacy data remains immutable.
An explicit update of a historical owner-custom legacy meaning atomically promotes
it to a personal meaning and clears the owner-custom legacy fields.

### Conversation and retries

- The browser submits only `{ clientMessageId, content }`; canonical history and
  tool context are loaded server-side.
- An account can store at most 100 chats; the account list returns at most 100.
  Chat detail returns the latest 200 stored messages in sequence order, while model
  context remains the latest 40 complete messages within 32,000 characters.
- Public chat DTOs omit practice snapshots, provider/model/usage data, attempts,
  tool calls, and receipts.
- The hidden compatibility context supports up to 12 saved or ad-hoc targets and
  the three meaning modes `all_saved`, `selected`, and `explore`. Replacing it is
  one exact atomic `PATCH`, not incremental `POST`/`DELETE`; the current chat UI
  exposes none of these controls.
- One user message has one stable pending/complete/failed assistant message, while
  every retry creates a distinct immutable attempt identity and increasing attempt
  number. At most one attempt in the entire chat may be pending; a fresh concurrent
  turn returns `turn_in_progress`, while an expired lease is repaired before a new
  turn acquires the chat.
- A stale attempt cannot execute a tool or finish/fail a newer attempt. Failed or
  expired turns are retryable; a repeated live/complete turn does not start another
  paid generation.
- Assistant finish/fail, tool registration/completion, receipt insertion, commit,
  and replay require both `pending` status and `lease_expires_at` later than the
  operation timestamp.
- Retrying an older turn uses only canonical messages before that user turn, not
  later conversation.
- Each new user turn stores an immutable provider-safe practice snapshot, bounded
  to 48,000 JSON characters. Retry uses that original snapshot even if the chat's
  compatibility targets change later.
- If D1 reports an error after actually committing a new turn or retry, readback
  recognizes the exact freshly generated user/assistant/attempt IDs and continues
  that generation. Other IDs converge to existing-turn handling.

The account-only `/api/ai/translate` endpoint remains a bounded server-side
contextual-translation fallback. Selection translation is not wired into the
current chat-only UI.

### Durable tool execution

- Every within-budget tool invocation, including reads and policy rejections, is
  recorded in an owner/chat/message/attempt-scoped ledger with canonical arguments,
  SHA-256 hash, bounded result, status, safe error, and optional mutation receipt.
  A separate provider-adapter fence rejects the third and later calls as
  `tool_budget_exceeded` before any D1 trace query.
- A committed write has one durable receipt keyed by
  `(userMessageId, operation, targetKey)`.
- Entry receipt target keys deliberately use the same NFKC/whitespace cleanup and
  ASCII-only case fold as SQLite `NOCASE`. Unicode case variants remain distinct;
  the application does not claim Unicode-insensitive uniqueness that D1 cannot
  enforce.
- Domain statements, postcondition-guarded receipt insertion, and the tool call's
  committed result are one D1 `batch`. A failed postcondition rolls back the whole
  mutation.
- A mutation-batch error is never followed by a blind resubmission. The executor
  checks, in order, for a committed receipt, an expired/stale attempt, and a proven
  owner/entity/old-value CAS conflict. It recovers or replays only those observed
  states; an unclassified failure terminates as `operation_failed`.
- An equivalent retry/repeated call replays the stored receipt. The same receipt key
  with different canonical arguments is a conflict, not a second mutation.
- A provider/stream failure after commit must not erase or duplicate the committed
  vocabulary write; the later attempt replays its receipt.

## Safety Limits

- Request body: 16,384 bytes; user message: 4,000 characters.
- Vocabulary text: 240 characters; meaning/context: 1,000 each.
- Read result count: 10; compact read JSON: 7,800 characters; provider-facing
  meanings per entry: 6, with meaning/detail truncation metadata; prompt
  meaning/context: 100/160 characters.
- Practice target snapshot/prompt data: at most 12 targets and 48,000 JSON
  characters.
- Canonical history: latest 40 complete messages within 32,000 characters.
- Model output: 800 tokens; upstream timeout: 20 seconds; stale-attempt lease:
  30 seconds.
- At most 2 tool calls per user turn and 5 model steps; tools are disabled for the
  final step. The hard two-call budget and pre-trace fence preserve headroom under
  D1 Free's 50-query-per-Worker-invocation allowance. Instrumented envelopes are
  34 statements for two maximum reads, 42 for two cold worst-case writes, 44 with
  one ambiguous committed-write recovery, 45 for a fully rolled-back mutation, and
  47 for rollback followed by ambiguous commit. Ambiguous recovery of maximum-size
  chat creation uses 49 of 50 statements.
- Tool trace arguments/results: 4,096/8,192 JSON characters.

All routes require the application session, owner-scoped D1 access, exact-origin
mutations, and `no-store`. Provider credentials, prompts, private vocabulary,
messages, tool payloads/results, and upstream bodies must not appear in client
responses or operational logs. The public provider stream is an explicit allowlist
of lifecycle/text/finish/error/abort chunks; tool, reasoning, source, file, step,
custom, raw, and provider metadata remain server-only. Provider HTTP 429 is exposed
only as the stable `provider_rate_limited` code.

Ordinary authenticated requests perform only the cheap user ensure. The one-time,
atomic legacy-owner transfer is an explicit idempotent login/session-bootstrap path,
outside AI generation, so it cannot consume the generation invocation's D1 budget.

## Success Criteria

- New-chat latest-five ordering and empty/partial states are deterministic and
  persist without a synthetic user message.
- Latest-`N`, search, grounded practice, and chat reload work within the chat-only
  UI.
- Current-turn explicit-write rules, owner checks, status invariants, immutable
  attempts, ledger entries, atomic receipts, replay, conflicts, and stale-attempt
  fencing are covered by executable tests.
- A manual authenticated smoke confirms real model tool use and persistence before
  any deployment decision.

## Non-goals and Open Decisions

- No automatic progress, spaced repetition, status tool, autonomous curriculum,
  deletion/merge/bulk tools, guest-funded AI, or resumable background run.
- Whether “latest” should mean first activation or most recent re-activation remains
  open; the current deterministic definition is the first progress `created_at`.
- Final direct target/meaning UI, click-to-translate, and Library/Practice launch
  affordances remain open product decisions.
- Broader search semantics, supported intent languages, production model/fallback,
  spend/rate policy, monitoring thresholds, retention, and deployment are open.

## Validation Status

Fresh verification on 2026-08-29 passes: production build plus 466/466 repository
tests, typecheck, Drizzle schema check, lifecycle lint, diff check, and full lint
with zero errors (two generated-file warnings). Final current-diff review found no
unresolved code issue. Authenticated live-provider smoke remains open. Preview
already contains an older applied form of migration 0017; the corrected 0017 still
requires an explicit preview re-baseline/acceptance decision before production,
and preview application of 0019 is not yet claimed.

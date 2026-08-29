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
- As a learner, I can list all vocabulary or only `To Learn`, `Learning`, or
  `Learned`, continue the same list across turns, search it, and practise any
  conversational subset without configuring hidden targets.
- As a learner, I can practise an ad-hoc word without saving it.
- As a learner, I can explicitly command the chat to add a vocabulary entry, add or
  update a personal meaning, or move one named entry to a named learning category.
- As a learner, mentioning, practising, or showing interest in a word never saves
  it. A write requires a direct, unambiguous command in that same user turn.
- As a learner, AI never infers mastery or moves an item autonomously; it changes a
  category only when my current message literally commands the exact entry and
  destination.

## Functional Requirements

### Vocabulary reads

- `list_vocabulary({ category?, limit?, cursor? })` reads pages of 1–10 entries,
  defaults to five, and supports `all`, `to_learn`, `learning`, and `learned`.
  `learning` maps to stored `learning_now`; `learned` accepts stored `learnt` and
  legacy `learned`. There is no overall list-size limit: `hasMore` and opaque
  `nextCursor` continue the same category page by page.
- List order is deterministic and chronological across legacy timestamp encodings:
  `julianday(phrase_progress.created_at) DESC`, then `phrase_id DESC`. The cursor
  preserves the row's raw SQLite/ISO-seconds/ISO-milliseconds timestamp as its
  boundary; its versioned encoding is category-bound, and malformed, non-canonical,
  oversized, or category-mismatched cursors fail before D1.
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
- `update_vocabulary_meaning(meaningId, translation, context?)`;
- `set_vocabulary_category(phraseId, category)`.

Every write must be authorized from the current user message only. That message
must contain a direct vocabulary-write command and literally contain every text,
translation, and context value being written. Meaning writes must also literally
name the affected word or phrase. Prior turns, model suggestions, practice requests,
and ambiguous references provide no write authority.

Command syntax may be recognized case-insensitively, but persisted value matching
is case- and compatibility-sensitive: `Polish` does not authorize `polish`, and
full-width characters do not authorize their ASCII form. Revocation text is
interpreted only as surrounding command language, not when it is the literal entry
being saved (for example, `never mind`). Unquoted terminal punctuation is treated
as command punctuation, while punctuation inside matching quotes remains part of
the literal value (`"wow!"` cannot authorize `wow`).

Updating a personal meaning additionally requires the current/old translation to
appear literally in that same message. The update is a compare-and-swap bound to
owner, phrase ID, meaning ID, old translation, and old context. Missing, foreign,
or stale state returns a traced `mutation_conflict`; it never overwrites newer data.

Tool inputs never accept `userId`, `chatId`, raw stored status, provider/model,
roles, SQL, or arbitrary HTTP operations. Identity, active chat, current user
message, assistant message, and generation-attempt identity are injected by the
server.

`set_vocabulary_category` accepts only canonical `to_learn`, `learning`, or
`learned`. The current message must literally name both the resolved entry text and
destination category; practice performance, earlier turns, or model preference do
not authorize it. The owner-scoped mutation is a compare-and-swap against the
current stored status. Separately, a genuinely new/previously unsaved `pick` entry
starts in `to_learn`; other writes preserve active status. Every newly supplied
translation is stored as an owner-scoped personal meaning; preset legacy data stays
immutable, and an authorized historical custom-legacy update promotes it to a
personal meaning atomically.

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
- `finishTurn` and `failTurn` begin with the owner-scoped `findTurn` result and do
  not spend a separate chat-ownership query. A normal successful terminal batch
  returns the locally constructed terminal state; exact readback is reserved for
  an ambiguous batch response or failed postcondition.
- Before each new turn, the service may read only the latest completed
  `list_vocabulary` result before that user sequence. If it contains a valid
  `hasMore` cursor, the prompt receives only `{ category, cursor }`, not prior entry
  payloads. The cursor may be reused only when the learner asks to continue that
  same category, enabling list traversal across turns despite the two-tool-per-turn
  budget.
- The prompt contract lives at
  `lib/ai-chat/prompts/vocabulary-practice.ts`, has ID
  `unmumble.vocabulary-practice` and version `1`, and returns that identity with the
  system/messages payload. Safe generation events include prompt ID/version so a
  response can be traced to the exact prompt contract without logging prompt text.

There is no separate AI-translation provider path in this iteration. The existing
DeepL-backed `/api/translate` remains a distinct trainer capability; a future
chat-selection translation route must reuse the same traced AI runner instead of
creating an unmetered provider entry point.

### Durable tool execution

- Every within-budget tool invocation, including reads and policy rejections, is
  recorded in an owner/chat/message/attempt-scoped ledger with canonical arguments,
  SHA-256 hash, bounded result, status, safe error, and optional mutation receipt.
  A separate provider-adapter fence rejects the third and later calls as
  `tool_budget_exceeded` before any D1 trace query.
- Provider tool calls issued in one model step are serialized before shared budget/
  circuit checks. Any failed or thrown mutation opens a per-turn circuit. Every
  later queued provider tool call in that turn returns `tool_budget_exceeded` before
  the traced executor and therefore cannot issue a second tool-side D1 call after
  the failed mutation's recovery envelope.
- A committed write has one durable receipt keyed by
  `(userMessageId, operation, targetKey)`.
- Write values and canonical arguments preserve the learner's NFC literal, including
  compatibility characters. Entry receipt target keys apply only NFC/whitespace
  cleanup plus ASCII `A-Z` folding, matching SQLite `NOCASE`; they never use NFKC
  compatibility folding. Unicode case variants remain distinct, and the application
  does not claim Unicode-insensitive uniqueness that D1 cannot enforce.
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
- The six-tool implementation is split by responsibility under
  `lib/ai-chat/tools/vocabulary/`: `contracts`, `policy`, `results`, `handlers`,
  `registry`, and `pagination`. `lib/ai-chat/vocabulary-tools.ts` is a compatibility
  facade only; every tool must still pass through the single traced/budgeted
  registry wrapper.

## Safety Limits

- Request body: 16,384 bytes; user message: 4,000 characters.
- Vocabulary text: 240 characters; meaning/context: 1,000 each.
- List/search page size: at most 10; a list has no overall entry cap and advances
  only by its <=512-character opaque cursor. Compact result JSON is at most 7,800
  characters; provider-facing meanings per entry are at most 6, with meaning/detail
  truncation metadata; prompt meaning/context is 100/160 characters.
- Practice target snapshot/prompt data: at most 12 targets and 48,000 JSON
  characters.
- Canonical history: latest 40 complete messages within 32,000 characters.
- Model output: 800 tokens; upstream timeout: 20 seconds; stale-attempt lease:
  30 seconds.
- At most 2 tool calls per user turn and 5 model steps; tools are disabled for the
  final step. The hard two-call budget and pre-trace fence preserve headroom under
  D1 Free's 50-query-per-Worker-invocation allowance. Current instrumented
  generation envelopes are 35 statements for two maximum reads, 43 for two cold
  writes, 45 with one ambiguous committed write, 36 for rollback plus the mutation
  circuit, 38 when that rollback is followed by ambiguous terminal failure, and 41
  for legacy-promotion rollback plus ambiguous terminal failure. Ambiguous maximum-
  size chat creation remains the exact worst case at 49/50.
- Tool trace arguments/results: 4,096/8,192 JSON characters.
- Generation is limited by separate Cloudflare counters to 10 requests per
  authenticated account per minute and an aggregate 100 requests per Cloudflare
  location per minute. A denial, missing binding, or binding error fails closed
  before D1 turn creation or provider work. Cloudflare documents these counters as
  local and eventually consistent, so they are approximate edge abuse guards, not
  a globally atomic quota or exact billing ledger.
- Tool-enabled requests accept only the code-owned concrete OpenRouter model
  `deepseek/deepseek-v4-flash-0731`; preset and unlisted model identifiers fail as
  `not_configured`. The request disables provider plugins and requires
  `data_collection: deny`, ZDR routing, and `require_parameters: true` so only
  endpoints supporting every request parameter are eligible. Only the locally
  registered, traced AI SDK tools are serialized to OpenRouter.

All routes require the application session, owner-scoped D1 access, exact-origin
mutations, and `no-store`. Provider credentials, prompts, private vocabulary,
messages, tool payloads/results, and upstream bodies must not appear in client
responses or operational logs. The public provider stream is an explicit allowlist
of lifecycle/text/finish/error/abort chunks; tool, reasoning, source, file, step,
custom, raw, and provider metadata remain server-only. Provider HTTP 429 is exposed
only as the stable `provider_rate_limited` code. Structured operational events use
an exact metadata allowlist for generation start/completion/failure and rate-limit
rejection; prompts, vocabulary, messages, tool arguments/results, and credentials
are never event fields.

Ordinary authenticated requests perform only the cheap user ensure. The one-time,
atomic legacy-owner transfer is an explicit idempotent login/session-bootstrap path,
outside AI generation, so it cannot consume the generation invocation's D1 budget.

## Success Criteria

- New-chat latest-five ordering and empty/partial states are deterministic and
  persist without a synthetic user message.
- Category listing with cross-turn cursor continuation, search, grounded practice,
  and chat reload work within the chat-only UI.
- Current-turn explicit-write rules, owner checks, status invariants, immutable
  attempts, ledger entries, atomic receipts, replay, conflicts, and stale-attempt
  fencing are covered by executable tests.
- A manual authenticated smoke confirms real model tool use and persistence before
  any deployment decision.

## Non-goals and Open Decisions

- No inferred/automatic progress, autonomous category changes, spaced repetition,
  autonomous curriculum, deletion/merge/bulk tools, guest-funded AI, or resumable
  background run.
- Whether “latest” should mean first activation or most recent re-activation remains
  open; the current deterministic definition is the first progress `created_at`.
- Final direct target/meaning UI, click-to-translate, and Library/Practice launch
  affordances remain open product decisions.
- Broader search semantics, supported intent languages, future fallback models,
  model-allowlist governance, spend ownership, monitoring thresholds, retention,
  and deployment are open.

## Validation Status

Fresh exact-diff evidence on 2026-08-29 passes the focused backend suite 219/219 and
full `npm test` 503/503, plus typecheck, Drizzle validation, dependency audit,
lifecycle lint, diff check, tracked-secret check, and ignore check. Full lint has
zero errors and three existing warnings. Independent final review found no P0/P1.
Backend commit `8f671288` is pushed and PR #32 reports green CodeQL, Analyze, Sonar, and
Workers checks. Preview migration 0020 is applied; `configured_provider` and
`configured_model` exist and are backfilled, the one-pending-attempt-per-chat index
exists, and `PRAGMA foreign_key_check` is clean. An authenticated provider-backed
preview smoke requested latest ten/all available and the `To Learn` category; each
response returned the account's two matching entries and performed no user-data
mutation. Commit `c970f80` documented a
zero-duplicate preflight before preview ran 0017, so that preview remains accepted
as behaviorally equivalent to corrected 0017. Manual traversal beyond ten with
cross-turn continuation, write/replay smoke, operational ownership, and production
authorization remain open. No production deployment is claimed.

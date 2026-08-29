---
phase: implementation
title: AI Vocabulary Practice Chat Implementation
description: Implemented chat-only tools, attempts, ledger, and mutation receipts
---

# AI Vocabulary Practice Chat Implementation

## Implemented Files

- `app/components/ai-practice-chat.tsx`: minimal account-gated chat list, `New
  Chat`, messages, composer, stream state, and retry; no target/meaning/status UI.
- `lib/ai-chat/chat-creation.ts`, `prompt.ts`: server-built latest-five opening and
  its escaped `UNTRUSTED_VOCABULARY_OPENING` model-history envelope.
- `lib/vocabulary/contracts.ts`, `repository.ts`, `mutations.ts`: reusable bounded
  vocabulary reads and composable mutation plans.
- `lib/ai-chat/vocabulary-tools.ts`: two read tools, three guarded write tools,
  current-message policy, provider result bounds, and opening formatter.
- `lib/ai-chat/tool-trace.ts`: durable invocation registration, execution ledger,
  atomic mutation receipt commit, hash conflict, and replay.
- `lib/ai-chat/service.ts`, `generation.ts`, `prompt.ts`, `repository.ts`: tool-aware
  bounded generation, canonical history, distinct attempts, per-chat single-flight,
  public stream allowlisting, fencing, and retries.
- `lib/ai-chat/http.ts`, `client.ts`, chat routes: explicit public DTOs plus bounded
  account chat list and message history.
- `lib/ai-chat/practice-context.ts`: immutable provider-safe per-turn snapshots,
  bounded to the 48,000-character target-data budget.
- `app/api/phrases/route.ts`: preset fallback translations remain personal; manual
  status plus new personal meaning commit atomically.
- `app/api/ai/chats/[chatId]/targets/route.ts`: atomic owner-scoped replacement of
  the complete saved/ad-hoc target set; no incremental target mutation routes.
- `app/api/ai/translate/route.ts`, `lib/ai-chat/translation.ts`: authenticated,
  bounded contextual translation fallback, currently not called by the chat UI.
- `drizzle/0017_abandoned_molecule_man.sql`: deterministic historical
  ASCII-`NOCASE` duplicate merge, reference transfer, and per-owner uniqueness.
- `drizzle/0018_jittery_the_liberteens.sql`: assistant attempts, tool calls, and
  mutation receipts.
- `drizzle/0019_chat_turn_single_flight.sql`: deterministic pending-attempt repair
  and one-pending-attempt-per-chat uniqueness.
- `lib/auth.ts`, `worker/index.ts`: cheap ordinary user ensure and explicit atomic
  legacy-owner migration on login/session bootstrap, outside AI generation.

## Actual Tool Contracts

- `get_recent_vocabulary({ limit? })`: default 5, capped at 10; active owned-visible
  entries ordered by progress `created_at DESC`, phrase ID `DESC`.
- `find_vocabulary({ query, limit? })`: default/max 10; SQLite-`NOCASE` search over
  phrase text, legacy translation, and only the current owner's personal saved
  translations, with exact match first and then deterministic recency. Queries are
  at most 48 characters and the escaped wildcard pattern at most 50 UTF-8 bytes.
- `add_vocabulary_entry({ text, translation?, context? })` returns the committed
  bounded result `{ ok: true, saved: true, text }`.
- `add_vocabulary_meaning({ phraseId, translation, context? })` returns
  `{ ok: true, saved: true, phraseId, translation }`.
- `update_vocabulary_meaning({ meaningId, translation, context? })` returns
  `{ ok: true, updated: true, meaningId, translation }`.

The two IDs used by meaning writes come from owner-scoped reads, not user identity.
Every text value persisted must also appear literally in the persisted current user
message, which must itself match a direct vocabulary-write command. Extra tool
fields are rejected. No tool accepts status.

Update authorization also requires the current translation and affected entry text
literally in the current message. The handler reads the owned meaning snapshot and
the planner compares owner, phrase ID, meaning ID, old translation, and old context
in its SQL/postcondition. Missing or concurrently changed state is recorded as
`mutation_conflict`, not applied as a stale overwrite.

The compatibility target contract accepts at most 12 saved or ad-hoc entries with
`all_saved`, saved-only `selected`, or `explore` meaning mode. It is mutated only by
one whole-array `PATCH`; the chat-only browser does not render these controls.

New/unsaved entries begin in `to_learn`; adding a duplicate preserves any active
status. Every new supplied translation is a normalized owner-scoped personal
meaning, including the first translation of a new custom entry. Preset legacy
fields cannot be changed. Historical owner-custom legacy fields are exposed with a
phrase-scoped ID; an authorized CAS update creates/updates a personal meaning and
clears those legacy fields atomically.

## Deterministic New Chat

The chat route reads exactly five recent entries before creation. The formatter
uses stored meanings and produces an honest empty/partial list. `createChat` writes
the chat and complete opening assistant row in one D1 batch. The opening has no
synthetic user row, attempt, tool call, provider/model, or usage. When canonical
history is prepared for a later model turn, that opening alone is escaped and
wrapped in `UNTRUSTED_VOCABULARY_OPENING` markers.

Chat creation is capped at 100 chats per account. Listing returns at most 100
summaries; detail returns the latest 200 messages in sequence order. Model history
is independently capped at 40 complete messages/32,000 characters. Public DTOs
remove practice snapshots and provider/model/usage fields and never expose attempts,
tool calls, or receipts.

## Attempt and Tool Persistence

`beginTurn` batches a stable user message, stable assistant message, attempt 1, and
chat timestamp. The user row also stores a provider-safe snapshot of the current
practice targets/meaning mode, bounded to 12 targets and 48,000 JSON characters. A
retry keeps both messages and that original snapshot, marks an abandoned pending
attempt expired when necessary, and inserts attempt `N+1`; the attempt identity and
number are never reused. Migration 0019 expires duplicate pending attempts, repairs
their assistant rows, and installs a partial unique index enforcing one pending
attempt per chat. A new turn first repairs an expired lease; a fresh competing turn
returns `turn_in_progress`. Finish, failure, and tool registration all require the
exact current pending attempt with a live `lease_expires_at`, which fences late
callbacks. Tool terminal updates and receipt insert/commit/replay use the same
pending-plus-live-lease predicate.

`beginTurn` and retry allocate fresh message/attempt IDs before their batches. On
an ambiguous post-commit D1 error, exact-ID readback returns `created` or `retrying`
and generation continues; unrelated IDs converge to the normal existing-turn path.

Before execution, each of the first two provider tool calls is stored with
canonical argument JSON and SHA-256. The provider adapter rejects call three onward
as `tool_budget_exceeded` before the trace executor, so no D1 trace query or ledger
row is consumed. A duplicate provider call ID in one attempt returns its prior
terminal result or reports in-progress; a changed tool/hash is a conflict. Read
successes and in-budget policy rejections receive terminal ledger rows like writes.

For a mutation, the planner returns versioned `operation`, stable `targetKey`,
canonical args/result, domain statements, and an owner/status/entity postcondition.
The executor batches domain statements, guarded durable receipt, and the call's
`committed` update. The unique receipt key is
`(user_message_id, operation, target_key)`. Same hash replays; different hash
rejects; equivalent concurrent or ambiguous-post-commit retries converge on the
single receipt. Any batch error triggers read-only classification: matching receipt
recovery/replay, stale-attempt rejection, then an owner/entity/old-value CAS check.
The mutation batch is not submitted a second time; an unclassified failure records
`operation_failed`.

Entry receipt target keys use NFKC/whitespace cleanup plus ASCII-only `A-Z` folding
to match SQLite `NOCASE`. Non-ASCII case variants intentionally keep distinct keys.

Migration 0017 selects the earliest owner-custom ASCII-`NOCASE` entry as canonical,
merges legacy fields/progress, moves or deduplicates meanings/examples, rewrites
saved-video origins and chat practice/selected-meaning references, then deletes
redundant phrases and creates the partial unique index. Duplicate meaning collapse
preserves deterministic non-empty translation/context and the latest `updated_at`.

## Bounds and Failure Handling

The AI SDK uses `stepCountIs(5)` and disables tools from step 4 onward; handlers
allow two total tool invocations. A separate provider-adapter fence rejects the
third and later calls before trace persistence. This reserves headroom below D1
Free's 50-query Worker-invocation budget. Instrumented full-invocation envelopes
are 34 statements for two maximum reads, 42 for two cold worst-case writes, 44 with
one ambiguous committed write, 45 for a fully rolled-back mutation, and 47 for
rollback followed by ambiguous commit. Maximum 12-target chat creation with an
ambiguous committed response recovers at 49/50 statements. Provider output includes
at most six meanings. The complete successful tool result is compacted to at most
7,800 JSON characters by dropping extra meanings and then contexts, with
`meaningCount`, `meaningsTruncated`, and `detailsTruncated`. Tool trace args/results
remain limited to 4,096/8,192 canonical JSON characters.

`GET /api/ai/meanings` is independently bounded to 50 personal meanings plus an
optional legacy meaning; `meaningCount` preserves the full visible count and
`meaningsTruncated` makes personal-meaning truncation explicit.

Existing chat limits remain 16,384 request bytes, 4,000 message characters,
40/32,000 canonical history messages/characters, 800 output tokens, 20-second
timeout, and 30-second attempt lease. Abort, cancellation, provider failure, and
empty output fail the current attempt with a safe code. A retry of an older turn
loads only messages before that turn and can replay committed receipts.

The browser stream receives only allowlisted start/text/finish/error/abort chunks;
text IDs are remapped and raw finish/provider data is removed. Tool, reasoning,
source, file, custom, step, request, warning, and raw chunks stay server-side.
Provider HTTP 429 maps to `provider_rate_limited`.

Terminal persistence keeps configured model/preset separately from the sanitized
actual routed model. Internal usage stores only token totals, unique bounded routed
provider names, and finite nonnegative OpenRouter-reported cost/upstream-cost sums
across steps. Raw provider metadata, reasoning, tool inputs, and response bodies are
never copied into usage storage or the browser stream.

## Validation Evidence

Fresh verification on 2026-08-29 passes: production build plus 466/466 repository
tests, typecheck, full lint with zero errors and two generated-file warnings,
Drizzle check, lifecycle lint, and diff check. Current-diff review found no
unresolved code issue. Live authenticated OpenRouter tool behavior remains
unproven for this revision.

The branch has a PR preview, but its already-applied 0017 is older than the corrected
file in this revision; preview re-baseline or an accepted forward migration is
required. Preview application of 0019 is not claimed. No production deployment,
production migration, or production secret change is claimed here.

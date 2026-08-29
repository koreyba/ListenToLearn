---
phase: implementation
title: AI Vocabulary Practice Chat Implementation
description: Implemented chat-only tools, attempts, ledger, and mutation receipts
---

# AI Vocabulary Practice Chat Implementation

## Implemented Files

- `app/components/ai-practice-chat.tsx`: minimal account-gated chat list, `New
  Chat`, messages, composer, stream state, and retry; no target/meaning/status UI.
- `lib/ai-chat/chat-creation.ts` and
  `lib/ai-chat/prompts/vocabulary-practice.ts`: server-built latest-five opening,
  escaped `UNTRUSTED_VOCABULARY_OPENING`, learner-led system contract, list
  continuation, and prompt ID `unmumble.vocabulary-practice` version `1`.
- `lib/vocabulary/contracts.ts`, `repository.ts`, `mutations.ts`,
  `practice-reader.ts`: reusable bounded vocabulary reads, a read-only saved-target/
  practice projection boundary, and composable mutation plans. The chat repository
  no longer owns SQL for `phrases` or `phrase_meanings`.
- `lib/ai-chat/tools/vocabulary/{contracts,policy,results,handlers,registry,pagination}.ts`:
  six tool contracts, exact current-turn policy, result compaction, domain
  orchestration, one traced AI SDK registry wrapper, and opaque cross-turn cursors.
  `lib/ai-chat/vocabulary-tools.ts` is a thin re-export facade.
- `lib/ai-chat/tool-trace.ts`: durable invocation registration, execution ledger,
  atomic mutation receipt commit, hash conflict, and replay.
- `lib/ai-chat/service.ts`, `generation.ts`, `repository.ts`,
  `runtime.ts`: tool-aware bounded generation, provider adapter, canonical history,
  distinct attempts, per-chat single-flight, public stream allowlisting, fencing,
  and retries.
- `lib/ai-chat/http.ts`, `public-contracts.ts`, `client.ts`, chat routes: shared
  explicit public DTOs plus bounded account chat list and message history.
- `lib/ai-chat/rate-limit.ts`, `observability.ts`: fail-closed per-account and
  per-location aggregate-edge Cloudflare limits plus privacy-safe operational
  events with an exact field allowlist.
- `lib/ai-chat/practice-context.ts`: immutable provider-safe per-turn snapshots,
  bounded to the 48,000-character target-data budget.
- `app/api/phrases/route.ts`: preset fallback translations remain personal; manual
  status plus new personal meaning commit atomically.
- `app/api/ai/chats/[chatId]/targets/route.ts`: atomic owner-scoped replacement of
  the complete saved/ad-hoc target set; no incremental target mutation routes.
- The unused `/api/ai/translate` route and its separate provider runner were removed;
  future AI selection translation must reuse the traced generation boundary. The
  existing DeepL `/api/translate` remains a separate trainer capability.
- `drizzle/0017_abandoned_molecule_man.sql`: deterministic historical
  ASCII-`NOCASE` duplicate merge, reference transfer, and per-owner uniqueness.
- `drizzle/0018_jittery_the_liberteens.sql`: assistant attempts, tool calls, and
  mutation receipts.
- `drizzle/0019_chat_turn_single_flight.sql`: deterministic pending-attempt repair
  and one-pending-attempt-per-chat uniqueness.
- `drizzle/0020_easy_mentallo.sql`: configured provider/model provenance on every
  attempt, including failure and timeout paths.
- `lib/auth.ts`, `worker/index.ts`: cheap ordinary user ensure and explicit atomic
  legacy-owner migration on login/session bootstrap, outside AI generation.
- `package.json`, `package-lock.json`: exact Next.js `16.3.3` runtime/config package
  versions; the production dependency audit is clean.

## Actual Tool Contracts

- `list_vocabulary({ category?, limit?, cursor? })`: defaults to five, caps each
  page at ten, filters `all|to_learn|learning|learned`, and orders by progress
  `julianday(created_at) DESC`, phrase ID `DESC`. `hasMore/nextCursor` provide an
  unlimited overall listing through validated category-bound pages. The boundary
  retains the raw stored SQLite/ISO-seconds/ISO-milliseconds timestamp, while SQL
  compares its chronology through `julianday`.
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
- `set_vocabulary_category({ phraseId, category })` accepts only
  `to_learn|learning|learned` and returns the receipt-backed canonical category.

The two IDs used by meaning writes come from owner-scoped reads, not user identity.
Every text value persisted must also appear literally in the persisted current user
message, which must itself match a direct vocabulary-write command. Extra tool
fields are rejected; the category tool accepts the public category, never raw D1
status or identity.

Command detection remains case-insensitive where appropriate, while value binding
preserves exact case and compatibility characters: `Polish` cannot authorize
`polish`, and full-width text cannot authorize normalized ASCII. Revocation phrases
are recognized only outside the literal value span, so saving `never mind` remains
valid. Matching quotes preserve meaningful terminal punctuation (`"wow!"`), while
unquoted terminal punctuation remains command syntax.

Update authorization also requires the current translation and affected entry text
literally in the current message. The handler reads the owned meaning snapshot and
the planner compares owner, phrase ID, meaning ID, old translation, and old context
in its SQL/postcondition. Missing or concurrently changed state is recorded as
`mutation_conflict`, not applied as a stale overwrite.

Category authorization similarly parses one direct current-turn command, requires
the resolved entry text plus exact canonical destination, and rejects practice,
description, negation, revocation, wrong entry, or wrong destination. The planner
compare-and-swaps the owner-scoped stored status; the prompt separately forbids any
autonomous mastery/category inference.

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

After each turn, `list_vocabulary` results already live in the tool ledger. For the
next turn the service reads only the latest completed earlier list result, validates
its category-bound version-1 cursor, and gives the prompt only `{ category, cursor
}`. The learner can therefore say “continue” across turns without re-sending entry
payloads or removing the two-call limit. A changed category must start without the
old cursor.

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

Each attempt stores sanitized configured provider/model before inference. Completed
messages separately store the actual routed model and aggregate usage. Failure and
stale-expiry paths retain configured provenance without inventing an actual model;
`finishTurn` and `failTurn` start from the owner-scoped `findTurn` record, so no
separate ownership query is needed. On a normal successful terminal batch they
return the constructed state directly; only an ambiguous batch response or failed
postcondition triggers exact owner-scoped readback. `failTurn` accepts an ambiguous
post-commit response only when that readback matches its own failure payload.

`beginTurn` and retry allocate fresh message/attempt IDs before their batches. On
an ambiguous post-commit D1 error, exact-ID readback returns `created` or `retrying`
and generation continues; unrelated IDs converge to the normal existing-turn path.

Before execution, each of the first two provider tool calls is stored with
canonical argument JSON and SHA-256. The provider adapter rejects call three onward
as `tool_budget_exceeded` before the trace executor, so no D1 trace query or ledger
row is consumed. A duplicate provider call ID in one attempt returns its prior
terminal result or reports in-progress; a changed tool/hash is a conflict. Read
successes and in-budget policy rejections receive terminal ledger rows like writes.

The registry serializes same-step provider tool calls through one execution queue
before checking the shared call limit/circuit. It opens the per-turn circuit when a
mutation returns `{ ok: false }` or throws. Every later queued provider tool in that
turn is rejected as `tool_budget_exceeded` before the executor, so even concurrent
provider calls cannot follow a failed mutation recovery with another tool-side D1
call.

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

Write authorization, persistence, and canonical arguments preserve the NFC literal.
Entry receipt target keys use NFC/whitespace cleanup plus ASCII-only `A-Z` folding
to match SQLite `NOCASE`; they do not apply NFKC compatibility folding. Full-width
forms and non-ASCII case variants intentionally keep distinct keys.

Migration 0017 selects the earliest owner-custom ASCII-`NOCASE` entry as canonical,
merges legacy fields/progress, moves or deduplicates meanings/examples, rewrites
saved-video origins and chat practice/selected-meaning references, then deletes
redundant phrases and creates the partial unique index. Duplicate meaning collapse
preserves deterministic non-empty translation/context and the latest `updated_at`.

## Bounds and Failure Handling

The AI SDK uses `stepCountIs(5)` and disables tools from step 4 onward; handlers
allow two total tool invocations. A separate provider-adapter fence rejects the
third and later calls before trace persistence, while a failed mutation opens the
per-turn circuit before any following tool. This reserves headroom below D1 Free's
50-query Worker-invocation budget. Instrumented generation envelopes are 35
statements for two maximum reads, 43 for two cold writes, 45 with one ambiguous
committed write, 36 for rollback/circuit, 38 for rollback plus ambiguous terminal
failure, and 41 for legacy-promotion rollback plus ambiguous terminal failure.
Maximum 12-target chat creation with an ambiguous committed response remains the
exact worst case at 49/50 statements. The Promise-all legacy-promotion regression
combines a full rollback, concurrent duplicate update, and ambiguous failed terminal
at 41 statements; the queued duplicate is rejected without D1. Provider output includes
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

Before turn creation, Cloudflare Rate Limiting applies a SHA-256 account key at
10 generations/minute and an aggregate edge key at 100 per Cloudflare location per
minute. Denial, a missing binding, or a binding error fails closed and reaches
neither D1 turn persistence nor OpenRouter. Cloudflare documents these counters as
location-local and eventually consistent: this is approximate abuse control, not a
globally atomic quota or exact billing.

Runtime configuration accepts only the code-owned concrete model
`deepseek/deepseek-v4-flash-0731`; preset and unlisted identifiers fail closed.
Requests disable provider plugins and require `data_collection: deny`, ZDR, and
`require_parameters: true`, which excludes endpoints that cannot support every
request parameter. The actual provider serializer is tested with a fake fetch: it
sends the concrete model, no preset/fallback fields, and only the local AI SDK tool
supplied by the generation layer. Preset response caching is no longer configured;
DeepSeek prompt-prefix caching remains automatic without extra application settings.

Terminal persistence keeps the configured model separately from the sanitized
actual routed model. Internal usage stores only token totals, unique bounded routed
provider names, and finite nonnegative OpenRouter-reported cost/upstream-cost sums
across steps. Raw provider metadata, reasoning, tool inputs, and response bodies are
never copied into usage storage or the browser stream.

## Validation Evidence

Fresh exact-diff evidence passes focused backend tests 217/217 (including the
concurrent queue/circuit regression), full `npm test` 501/501, typecheck, Drizzle,
audit, lifecycle/diff/secret/ignore checks, and lint with zero errors plus three
existing warnings. Independent final review found no P0/P1. Coverage includes the
six-tool registry, legacy timestamp pagination, NFC/NOCASE identity, mutation
circuit, owner-scoped terminal paths, and exact D1 envelopes. A live direct
OpenRouter smoke returned a DeepSeek
`list_vocabulary` tool call; it proves model tool selection only, not authenticated
app execution or D1 effects.

The branch has a PR preview whose already-applied 0017 is older than the corrected
file. Commit `c970f80` documents a zero-duplicate preflight before that deployment,
so current preview data is explicitly accepted as behaviorally equivalent and needs
no 0017 re-baseline or forward migration; fresh production will run corrected 0017.
Read-only preview evidence confirms 0019 applied, its pending-chat index present,
`PRAGMA foreign_key_check` clean, and 0020 as the only pending migration. Commit/
push and preview rebuild, 0020 plus post-migration checks, authenticated updated-
preview tool smoke, operational ownership, and production authorization remain
open. No production deployment, production migration, or production secret change
is claimed here.

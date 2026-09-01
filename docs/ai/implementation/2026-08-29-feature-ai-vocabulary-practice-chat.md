---
phase: implementation
title: AI Vocabulary Practice Chat Implementation
description: Implemented chat-only tools, attempts, ledger, and mutation receipts
---

# AI Vocabulary Practice Chat Implementation

## Implemented Files

- `app/components/ai-practice-chat.tsx`, `ai-chat-workspace.tsx`, and
  `ai-chat-conversation.tsx`: the account shell, chat-list/navigation state, and
  active conversation are separate boundaries. The workspace owns URL-backed
  selection, per-chat drafts, last-request-wins switching, and single-flight chat
  creation; the conversation owns transcript follow/jump and selection/proposal UI.
- `app/components/use-ai-chat-turn-controller.ts` and `lib/ai-chat/client-http.ts`:
  one client turn controller owns transport, optimistic `clientMessageId`
  reconciliation, send/retry/stop, cancellation, interrupted-stream recovery, and
  stable public HTTP errors. After fast probes, interrupted-stream recovery polls
  canonical state with 5-to-15-second bounded backoff through the five-minute lease,
  using detail-only refreshes instead of reloading the chat list on every probe,
  aborting on chat change/unmount, and preserving unverifiable outbound text for the
  same idempotent retry. Stop has an explicit cancelling phase that blocks a
  racing send until the server decision returns; a pre-accept failure restores only
  its outbound text and never overwrites a newer draft.
- `app/components/ai-chat-composer.tsx`: compact and full-screen composition share
  one controlled draft while the component owns caret/focus restoration, body-scroll
  lock, focus containment, keyboard submission, and send/stop controls.
- `app/components/ai-chat-selection-actions.tsx`,
  `app/components/interactive-english-text.ts`, and `lib/ai-chat/selection.ts`:
  exact-text rendering with subtly clickable English words, one roving word tab stop
  per message, long-press click suppression and stale-range gesture replacement,
  rendered-plain-text Markdown selection offsets owned solely by the interactive
  message surface, desktop anchored toolbar/mobile bottom sheet, identity-keyed DeepL state, exact
  phrase saving, mixed-script preservation,
  and distinct 500-character translation/240-character vocabulary limits.
- The chat composer auto-grows without resize/scrollbar chrome, uses only the rounded
  shell for focus, and expands into a full-screen shared-draft editor with focus
  containment/restoration, Escape dismissal, body-scroll lock, and explicit send.
- `app/globals.css`, `public/app-theme.css`, and `public/site-navigation.css`:
  responsive chat surfaces, >=44px interactive targets, reduced-motion handling,
  WCAG AA action contrast, >=3:1 control boundaries, and a compact signed-in mobile
  header. The theme toggle suppresses its intentional pre-hydration attribute
  difference while the early theme controller remains authoritative.
- `lib/ai-chat/chat-creation.ts` and
  `lib/ai-chat/prompts/vocabulary-practice.ts`: server-built latest-five opening,
  escaped `UNTRUSTED_VOCABULARY_OPENING`, learner-led system contract, list
  continuation, fresh-read rules, English-learning scope gate with an explicit
  vocabulary-operation exception, and prompt ID `unmumble.vocabulary-practice`
  version `7`.
- `lib/vocabulary/contracts.ts`, `repository.ts`, `mutations.ts`,
  `practice-reader.ts`: reusable bounded vocabulary reads, a read-only saved-target/
  practice projection boundary, and composable mutation plans. `mutations.ts`
  remains the stable domain facade while mixed change sets delegate to
  `change-set-planner.ts`.
- `lib/vocabulary/change-set-planner.ts` and `change-set-plan-builder.ts`: mixed
  changes follow explicit read/parse/load/resolve/conflict-validation/build stages;
  the separate builder owns the cohesive atomic SQL envelope, snapshot guards, and
  postconditions. Existing statement ordering, bindings, error reasons, and D1
  budgets remain part of the facade contract. The chat repository owns no SQL for
  `phrases` or `phrase_meanings`.
- `lib/ai-chat/tools/vocabulary/{contracts,policy,results,handlers,registry,pagination}.ts`:
  exactly three active contracts (two reads plus one mixed proposal), result compaction, domain
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
- `app/api/ai/chats/[chatId]/messages/[clientMessageId]/cancel/route.ts` and
  `lib/ai-chat/{repository,service,http}.ts`: authenticated same-origin turn
  terminalization, owner-scoped idempotent replay, and a sanitized terminal DTO;
  cancellation runs in its own invocation and does not add D1 statements to the
  normal generation success path.
- `lib/ai-chat/rate-limit.ts`, `observability.ts`: fail-closed per-account and
  per-location aggregate-edge Cloudflare limits plus privacy-safe operational
  events with an exact field allowlist.
- `lib/ai-chat/practice-context.ts`: immutable provider-safe per-turn snapshots,
  bounded to the 48,000-character target-data budget.
- `app/api/phrases/route.ts`: preset fallback translations remain personal; manual
  status plus new personal meaning commit atomically.
- `app/api/ai/chats/[chatId]/targets/route.ts`: atomic owner-scoped replacement of
  the complete saved/ad-hoc target set; no incremental target mutation routes.
- The unused OpenRouter-backed `/api/ai/translate` route and its separate model
  runner remain removed. Chat selection now reuses the existing server-side DeepL
  `/api/translate`, so no second model runner or browser-visible credential is added.
- `drizzle/0017_abandoned_molecule_man.sql`: deterministic historical
  ASCII-`NOCASE` duplicate merge, reference transfer, and per-owner uniqueness.
- `drizzle/0018_jittery_the_liberteens.sql`: assistant attempts, tool calls, and
  mutation receipts.
- `drizzle/0019_chat_turn_single_flight.sql`: deterministic pending-attempt repair
  and one-pending-attempt-per-chat uniqueness.
- `drizzle/0020_easy_mentallo.sql`: configured provider/model provenance on every
  attempt, including failure and timeout paths.
- `drizzle/0021_cold_stone_men.sql`: immutable confirmation-gated vocabulary write
  proposals.
- `drizzle/0022_terminal_attempt_telemetry.sql`: bounded aggregate terminal
  telemetry on assistant attempts.
- `drizzle/0023_proposal_attempt_scope.sql`: proposal idempotency scoped to
  `(origin_attempt_id, operation, target_key)` so an explicit retry can create a
  fresh proposal without exposing the failed origin.
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
- `propose_vocabulary_change_set({ changes })` accepts one closed mixed union of
  `add_entry`, `add_meaning`, `update_meaning`, `change_state`, and
  `change_recent_state`. One request may resolve at most 30 concrete changes;
  `change_recent_state.count = N` consumes N of that budget. It performs bounded
  owner-scoped resolution, rejects ambiguous/conflicting targets, and stores one
  immutable atomic review proposal without changing vocabulary.

The IDs used by meaning and state proposals come from owner-scoped reads, not the
browser or model. Natural references may be resolved from canonical conversation
context; the exact values are then displayed in the inline card. No active tool
uses the legacy regex/literal-current-turn gate. Extra fields are rejected, and
identity, raw D1 status, and mutation SQL never enter public tool arguments.
Meaning and state planners compare owner plus the complete immutable snapshot in
their SQL/postconditions. Missing or concurrently changed state is recorded as
`mutation_conflict`, not applied as a stale overwrite. Confirmed removal changes a
shared preset only to this learner's `pick` progress; an owned custom phrase and
its foreign-key children are deleted only for that owner. Historical pending
`vocabulary.set-category/v1` proposals remain confirmable for compatibility.

Planner validation returns only the closed reasons `invalid_input`,
`missing_target`, `ambiguous_meaning`, `conflicting_changes`,
`change_limit_exceeded`, and `unsupported_change`. A shared preset legacy-meaning
edit uses `unsupported_change`; generation turns it into a deterministic safe
assistant response without copying the planner message. Meaning additions and
updates are validated as one final normalized output set per phrase, so cross-action
collisions reject the complete proposal before persistence.

The compatibility target contract accepts at most 12 saved or ad-hoc entries with
`all_saved`, saved-only `selected`, or `explore` meaning mode. It is mutated only by
one whole-array `PATCH`; the chat-only browser does not render these controls.

New/unsaved entries begin in `to_learn`; re-adding a `pick` entry refreshes its
activation `created_at`, while adding an already-active duplicate preserves status
and recency. Every new supplied translation is a normalized owner-scoped personal
meaning, including the first translation of a new custom entry. Preset legacy
fields cannot be changed. Historical owner-custom legacy fields are exposed with a
phrase-scoped ID; an authorized CAS update creates/updates a personal meaning and
clears those legacy fields atomically.

New change-set phrase and meaning IDs are generated from 16 random bytes and encoded
as compact URL-safe Base64 tokens. The production generator is covered with 30
translated additions whose canonical arguments stay at or below the planner's
3,600-byte ceiling before the durable 4,096-byte proposal check.

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

The AI SDK lets the model choose among the three bounded tools. A successful mixed
proposal stops generation immediately and the server completes the assistant with a
deterministic review message, so proposal turns do not spend a second provider
round-trip. A successful read permits only one following provider step. Tool timeout,
tool error, or `{ ok: false }` is terminal for the turn and is never automatically
resubmitted. Handlers still allow at most two total invocations, and a failed
mutation opens the per-turn circuit before any following tool. Instrumented cold
generation envelopes are 35 statements for two maximum reads, 36 for a mixed
proposal, 38 for its ambiguous completion/provider-failure envelope, 32 for
rollback/circuit, and 34 for rollback plus ambiguous terminal recovery.
Maximum 12-target chat creation with an ambiguous committed response remains the
exact worst case at 49/50 statements. The Promise-all legacy-promotion regression
combines a full rollback, concurrent duplicate update, and ambiguous failed terminal
at 37 statements; the queued duplicate is rejected without D1. Provider output includes
at most six meanings. The complete successful tool result is compacted to at most
7,800 JSON characters by dropping extra meanings and then contexts, with
`meaningCount`, `meaningsTruncated`, and `detailsTruncated`. Tool trace args/results
remain limited to 4,096/8,192 canonical JSON characters.

`GET /api/ai/meanings` is independently bounded to 50 personal meanings plus an
optional legacy meaning; `meaningCount` preserves the full visible count and
`meaningsTruncated` makes personal-meaning truncation explicit.

Existing chat limits remain 16,384 request bytes, 4,000 message characters, and
40/32,000 canonical history messages/characters. Output is capped at 2,400 tokens;
generation inactivity deadlines are 20 seconds to the first semantic chunk,
20 seconds between semantic chunks, and 5 seconds for tool execution. Active
semantic output has no absolute total or per-step deadline. The generation adapter's
first-activity watchdog begins before provider connection and is cleared by the first
semantic `onChunk`; the SDK then resets its inter-chunk deadline on later activity.
The independent attempt recovery lease is five minutes. A non-`stop` finish reason is retryable
`response_incomplete`; explicit cancellation is `generation_cancelled`; tool
deadline/failure use `tool_timeout`/`tool_failed`. Provider failure and empty output
also fail truthfully. Each terminal attempt stores only a bounded <=2,048-byte
aggregate telemetry allowlist (`elapsedMs`, finish reason, step/tool/output counts);
raw errors, prompts, tool arguments,
and provider payloads are excluded. Lease recovery records
`generation_interrupted` plus `{"termination":"lease_expired"}`, rather than
misclassifying an interrupted Worker as a proven provider timeout. A user message
enters canonical model history only when its paired assistant response is complete,
so failed and still-pending turns do not contaminate later prompts. A retry of an
older turn loads only messages before that turn and can replay committed receipts.
Browser Stop/stream-interruption recovery can also call the dedicated cancellation
route with only the stable client message ID. It atomically changes the exact pending
assistant/attempt to `generation_cancelled`, even just after lease expiry; repeated
calls return the existing terminal state and late generation callbacks cannot
overwrite it. Client cancellation and canonical reconciliation share an eight-second
deadline, after which the draft remains safely retryable instead of freezing the
composer. A stream that ends without a real terminal finish is treated as an
interruption and enters the same cancellation/reconciliation path.

There is no application regex router, forced tool choice, generated fallback call,
or provider retry middleware. The versioned prompt asks the model to resolve natural
unambiguous references from bounded canonical history and to submit the whole
requested mutation through one change-set; server validation returns the specific
ambiguity, conflict, or unsupported-target failure. Every successful path still
produces a pending proposal that requires the separate confirmation endpoint. A
proposal is listed or confirmable only while its immutable
origin attempt is complete; proposals produced by an interrupted/failed attempt stay
hidden and cannot be executed after a later retry completes the shared assistant row.
Within one attempt, proposal lookup/idempotency uses
`(origin_attempt_id, operation, target_key)`. A later retry attempt creates a new
immutable proposal; migration 0023 replaces the earlier message-scoped unique index,
and only the retry origin can make that new proposal visible.

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
across steps. Operational completion/failure adds only bounded elapsed, finish,
step/tool-count and output-size counters. Raw
provider metadata, reasoning, tool
inputs, and response bodies are never copied into usage storage, logs, or the
browser stream.

## Validation Evidence

Fresh 2026-09-01 evidence for the architecture split passes the production build,
651/651 tests, TypeScript, ESLint with zero errors, lifecycle lint, and
`git diff --check`. Focused evidence includes 50/50 current recovery/Markdown tests,
the earlier 74/74 client/UI architecture suite, and 97/97 vocabulary planner, tool,
proposal-lifecycle, and exact D1-budget tests. It retains coverage for typed preset rejection, real compact IDs at
the 30-change boundary, cross-action collision rejection, retry isolation, the hard
client cancellation deadline, quiet-stream recovery, and exact confirmation costs.

Authenticated local browser E2E on the refactored client rendered Markdown, stopped
and retried a live long response, then accepted a normal follow-up in the same chat.
Three additions produced one inline proposal and Cancel persisted no vocabulary
change. At 319px and desktop master-detail breakpoints, document, drawer, sidebar,
and conversation widths had no horizontal overflow; the full-screen editor retained
the shared draft/focus boundary and body-scroll lock. Exact middle-caret transfer is
covered by the focused client test because the browser driver cannot position a
textarea caret deterministically.

The current recovery follow-up repeated Retry -> live Stop -> Ready and then sent a
successful Markdown response in the same authenticated local chat. Bold output was
rendered semantically, a later interactive word replaced the prior selection state,
and a 390px viewport kept document and composer widths overflow-free. Local DeepL
was intentionally unconfigured and returned its stable setup message without
breaking the selection UI.

Earlier authenticated local browser E2E used the real model and D1 at desktop and 390px
mobile breakpoints. Three additions produced one grouped proposal; a later mixed
add/update/remove request produced one proposal with all three groups; both confirms
completed atomically. Stop terminalized a live provider turn in under one second and
the same chat accepted a subsequent message and returned a normal answer. Desktop,
mobile composer, grouped-card, and chat-drawer checks found no horizontal overflow.
Architecture commit `7bcfe9a` is published to PR #32; its Tests, CodeQL,
SonarCloud, Qodana, and Cloudflare branch-preview build are green. Extended
authenticated preview smoke remains separate from this local evidence.

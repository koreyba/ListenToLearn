---
phase: design
title: AI Vocabulary Practice Chat Design
description: Chat-only UI with bounded vocabulary tools and durable inline write approval
---

# AI Vocabulary Practice Chat Design

## Architecture

The feature stays in the existing React/vinext Cloudflare Worker. The browser is a
minimal chat client; the Worker owns identity, history, prompt, tools, OpenRouter
runtime, and D1 persistence.

```mermaid
flowchart LR
  UI["/chat: list + messages + composer"] --> API["authenticated chat API"]
  API --> Turn["canonical user/assistant turn"]
  Turn --> Attempt["immutable attempt identity"]
  Attempt --> SDK["Vercel AI SDK loop"]
  SDK --> Read["category pages / search"]
  Continuation["validated cross-turn cursor"] --> SDK
  SDK --> Context["vocabulary practice reader"]
  SDK --> Proposal["durable write proposal"]
  Read --> Vocabulary[(D1 vocabulary)]
  Context --> Vocabulary
  Proposal --> Ledger["tool-call ledger + proposal receipt"]
  Ledger --> ProposalStore[(D1 proposals)]
  UI --> Confirm["confirm/cancel by proposal ID"]
  Confirm --> ProposalStore
  Confirm --> Batch["set-based domain write + decision"]
  Batch --> Vocabulary
  SDK --> OpenRouter
```

Guests may render the sign-in boundary; generation and tools remain account-only.

## Chat-only Browser Contract

- `GET/POST /api/ai/chats` lists or creates owned chats.
- `GET /api/ai/chats/:id` restores an owned chat.
- `POST /api/ai/chats/:id/messages` accepts only
  `{ clientMessageId, content }` and streams the assistant response.
- `PATCH /api/ai/chats/:id/write-proposals/:proposalId` accepts only
  `{ decision: "confirm" | "cancel" }`, never mutation arguments. It loads the
  owned immutable proposal by ID; confirmation performs no model call.
- The browser cannot submit identity, history, roles, targets, model, tool names,
  arguments, results, receipts, or attempts.
- Account storage and list output are capped at 100 chats. Detail returns the
  latest 200 stored messages in ascending sequence order. The public detail mapper
  removes per-turn practice snapshots and provider/model/usage fields; attempts,
  ledger calls, receipts, and canonical internal arguments never enter the chat
  DTO. It does include sanitized inline proposal display/status/result data.
- The visible UI contains a separate chat list and conversation pane, `New Chat`,
  timeline, composer, send/retry, essential states, one contextual action surface
  for text selected inside a message, and inline proposal cards after their
  assistant message. Compatibility target/meaning APIs
  and tables may remain, but the UI does not depend on them or preselect vocabulary
  from Library/Practice.
- Compatibility target replacement is one owner-scoped atomic
  `PATCH /api/ai/chats/:id/targets` containing the complete desired array; there are
  no incremental target `POST`/`DELETE` routes. It accepts up to 12 saved/ad-hoc
  targets with `all_saved`, saved-only `selected`, or `explore` meaning mode.
- There is no separate AI-translation route. Chat selection deliberately reuses
  the existing authenticated DeepL-backed `/api/translate`; no OpenRouter runner,
  model call, or additional provider path is introduced.

## Responsive Interaction Design

The chat is a master/detail workspace rather than two vertically stacked cards.
Desktop keeps a 280-300px chat list beside one conversation. Tablet and mobile keep
the conversation as the primary surface and expose the list through an accessible
drawer with an overlay, `aria-expanded`, Escape dismissal, and focus-visible
controls. The selected chat ID is reflected in the `/chat?chat=...` URL so reload
and browser navigation restore the same owned chat.

The conversation owns a compact header, a named `role=log` transcript, and a
composer fixed inside the pane. Enter sends on a physical keyboard, Shift+Enter
adds a line, and IME composition never submits. Draft text is stored per chat.
Transcript scrolling follows new content only while the learner is near the bottom;
otherwise a `Jump to latest` control appears.

The compact textarea auto-grows only from 48px to 112px and hides native resize and
scrollbar chrome. Its focus is represented by the rounded composer shell. Once a
draft exists, an expand control opens a full-viewport modal editor with the shared
draft, focus trap/restoration, body-scroll lock, Escape dismissal, character count,
and Cmd/Ctrl+Enter send. This keeps long mobile input out of a nested scrolling box.

Chat opening is last-request-wins. Creating a chat is single-flight. List loading,
empty state, chat opening, ready, submitted, streaming, retry, and fatal errors are
rendered distinctly. Refresh reads the selected detail and list once each and never
remounts a conversation merely because `updatedAt` changed.

## Message Selection and DeepL Flow

`InteractiveEnglishText` preserves the exact message while segmenting Latin-script
word tokens into a subtle dotted-underline interaction layer. A tap/click opens the
word action. Only one word per message is in the tab order; arrows/Home/End move the
roving tab stop and Enter/Space activate it. A conversation-level `selectionchange`
listener still accepts ranges only inside one message and derives bounded sentence
context plus a viewport anchor.

On coarse pointers, a >=450ms hold suppresses its following synthetic click for a
bounded interval. Finishing any non-collapsed range also suppresses word activation.
Native long-press handles therefore win over the word action, while a normal tap
remains immediate. Gesture-start fingerprints distinguish a newly created range
from a lingering old one, so the next short tap/click clears the old range and
activates its own word.

Desktop anchors one compact toolbar near the range; mobile renders it as a bottom
sheet above the site navigation and safe area. The action identity is
`messageId + text + context`. DeepL requests are aborted when that identity changes,
and stale results are ignored. Translation posts the exact selection/context to
`/api/translate`. Saving posts the exact selection/context to `/api/phrases`, adding
the displayed translation only when it belongs to the same identity. Save remains
available after a translation failure and is single-flight until the server result
is known. The action panel is keyed by that identity, so a new word/range clears the
previous translation and save result before either next request can run.

Mixed Latin/Cyrillic or other-script text is intentionally stored as one exact
selection. The MVP neither splits it nor guesses which fragment is primary. DeepL
remains EN-to-RU and its mixed-text result is presented as best effort. A subtle
note explains this before saving. Translation is limited to 500 characters and
entry creation to 240; the latter action is disabled with a visible reason rather
than truncating.

## Vocabulary Boundary

`lib/vocabulary/practice-reader.ts` owns vocabulary-specific resolution of saved
practice targets and the current practice-item projection. It validates account-
visible phrases and owner-scoped selected meanings, then returns domain drafts/items
to the chat repository. `lib/ai-chat/repository.ts` retains chat ownership checks,
target validation for meaning mode/ad-hoc input, ordered resolution, and atomic chat
persistence. This keeps vocabulary SQL out of the chat persistence module without
adding extra ownership queries or changing the measured D1 envelopes.

The AI-tool package follows the same boundary internally:

- `tools/vocabulary/contracts.ts` owns names and types;
- `policy.ts` is legacy compatibility code only and is not registered as an active
  provider tool authorization boundary;
- `results.ts` owns bounded provider output;
- `handlers.ts` orchestrates domain reads/plans;
- `registry.ts` owns the six AI SDK schemas and one traced budget wrapper;
- `pagination.ts` owns opaque cursor encoding/validation and continuation parsing.

`lib/ai-chat/vocabulary-tools.ts` only re-exports this API as a thin compatibility
facade. This keeps parsing, transport, persistence, and provider registration from
collapsing back into one module.

## Deterministic Opening and Read Tools

`POST /api/ai/chats` calls `listRecent(userId, 5)` before creation. D1 orders active
entries by `julianday(phrase_progress.created_at) DESC, phrases.id DESC`, so legacy
SQLite timestamps and ISO timestamps share one chronological order. Pagination
keeps the selected row's raw SQLite/ISO-seconds/ISO-milliseconds timestamp in the
opaque boundary and compares it through `julianday`. The Worker formats a bounded
Russian offer and persists it in the chat-creation batch as complete assistant
sequence 1 with `clientMessageId = opening:<chatId>`. No synthetic user message,
assistant attempt, tool ledger row, or provider call is created. When this message
later enters model history, the service escapes delimiter-like characters and wraps
it in `BEGIN/END_UNTRUSTED_VOCABULARY_OPENING` markers; the persisted UI copy
remains readable.

The model later receives two read tools:

- `list_vocabulary({ category?, limit?, cursor? })`: page size 1–10 (default 5),
  categories `all`, `to_learn`, `learning`, and `learned`, newest first. It has no
  overall entry limit: a versioned opaque cursor advances only the same category;
- `find_vocabulary({ query, limit? })`: default/maximum 10; owner-scoped substring
  search over phrase text, legacy translation, and the current learner's personal
  translations, with exact matches first, then recency and phrase-ID tie-breaker.
  Query text is capped at 48 characters and its escaped wildcard `LIKE` pattern at
  50 UTF-8 bytes.

Both read only account-visible vocabulary. The public category mapping is
`to_learn -> to_learn`, `learning_now -> learning`, and `learnt|learned -> learned`.
Each provider-facing entry is
bounded to 240 text characters and six meanings of 100/160 translation/context
characters. The whole success result is at most 7,800 JSON characters: excess
meanings are removed first, then meaning contexts are blanked if needed, with
`meaningsTruncated` and `detailsTruncated` preserving honest metadata.

The authenticated meaning-list endpoint separately returns at most 50 personal
meanings plus an optional legacy meaning. Its `meaningCount` is the full visible
total and `meaningsTruncated` discloses any omitted personal meanings.

After a completed `list_vocabulary` call, its ledger result is the continuation
source. Before the next user sequence, the service reads the latest earlier result
and accepts only `ok + hasMore + category + valid nextCursor`. Only `{ category,
cursor }` enters the next prompt; prior entries do not. The prompt tells the model
to reuse it only when the learner asks to continue that same listing. This makes
full traversal possible across turns while preserving the two-call per-turn budget.

## Versioned Prompt Contract

The prompt is isolated at `lib/ai-chat/prompts/vocabulary-practice.ts` with stable
ID `unmumble.vocabulary-practice` and version `2`. Its contract is learner-led,
plain-text, treats openings/targets/tool results as untrusted data, forbids inferred
writes or autonomous category changes, and carries only a validated list cursor for
continuation. Natural user references may resolve against bounded canonical history,
but a mutation tool creates a proposal only. The prompt must never claim a domain
write succeeded while the proposal is pending. The service passes prompt ID/version
into privacy-safe lifecycle events; prompt text itself is never logged.

## Proposal Tools and Confirmation Authorization

The model has four proposal tools: `propose_vocabulary_entries`,
`propose_vocabulary_meaning`, `propose_vocabulary_meaning_update`, and
`propose_vocabulary_category`. Together with the two reads this remains an exact
six-tool registry with the existing two-call turn budget. JSON Schemas reject extra
properties and omit identity/raw stored status. Entry proposals accept 1–10 items.

There is no regex or current-turn literal policy. The model may resolve natural
references from bounded canonical history, then the server enriches entity-changing
proposals with the current owner-visible IDs and compare-and-swap values. The tool
atomically stores immutable canonical arguments plus a bounded public display model
and returns `pending_confirmation`; it never executes the domain mutation.

The inline card is the authorization surface. Confirm and Cancel remain visible for
a pending proposal and use at least 44px semantic buttons. Long entry batches show
three items initially with an accessible inline disclosure. Busy and terminal
confirmed/cancelled/failed states use live regions and never remain actionable.

Confirmation identifies only the proposal and decision. The server reloads the
owned proposal and dispatches its versioned operation to deterministic planners; it
does not trust the card payload and does not call the model. Meaning updates and category changes use
captured owner-scoped compare-and-swap inputs. A wrong owner, stale entity, or
concurrent edit fails the postcondition and becomes a durable failed decision.

`propose_vocabulary_entries` canonicalizes the whole set before persistence.
Identical duplicates collapse; normalized-text collisions with different
translation/context reject the proposal. Confirmation performs one set-based read
and bounded set-based writes for all 1–10 entries, preserving exact NFC literals and
mixed-language items. The entire batch commits or rolls back, and each result is
`added` or `already_saved`.

The existing manual phrase `PATCH` and selection `POST /api/phrases` remain outside
the agent proposal boundary and execute immediately. For a
preset phrase with no stored translation, it saves the resolved translation as the
current learner's personal meaning and commits that meaning with the requested
status change in one D1 batch; shared preset fields remain immutable.

## Attempts, Ledger, and Receipts

`ai_chat_assistant_attempts` separates a logical assistant message from each
generation run. Attempt ID and number are never reused; terminal attempts remain as
history. Migration 0019 repairs historical duplicate pending attempts and adds a
partial unique index on `chat_id`, allowing only one `pending` attempt across a
chat. Migration 0020 stores the configured provider/model on the attempt before
generation, independently from terminal provider/model and sanitized routed-provider
telemetry. The 30-second lease expires abandoned work; a fresh second turn returns
`turn_in_progress`. Finish/fail/tool SQL is fenced by the exact current attempt with
both `status = pending` and an unexpired
`lease_expires_at`. The same lease predicate protects assistant terminal writes,
tool registration/completion, receipt insertion, commit, and replay.

`ai_chat_tool_calls` records every within-budget invocation before execution,
including reads and rejections. A provider-adapter counter rejects the third and
later calls with `tool_budget_exceeded` before reaching the trace executor, so they
consume no D1 trace queries. The identity
`(assistant_attempt_id, provider_tool_call_id)` is unique; canonical argument JSON
and SHA-256 detect conflicting ID reuse. Terminal states are `succeeded`,
`committed`, `replayed`, `rejected`, or `failed`.

`ai_chat_vocabulary_write_proposals` is the approval boundary. Each immutable
proposal binds owner/chat/user message/assistant message/origin attempt/tool call,
a versioned operation and target key, canonical planner input plus SHA-256, and a
sanitized display projection. Only lifecycle/result fields transition from
`pending` to one terminal state: `committed`, `cancelled`, or `conflict`. A unique
`(user_message_id, operation, target_key)` key makes equal-hash retries reuse the
proposal and rejects changed arguments. Public DTOs omit target keys, hashes,
canonical input, and trace IDs. Proposals are never included in model history and
are exposed only after their assistant message is complete.

The registry serializes provider tool calls from the same model step through one
execution queue before applying the shared call counter and mutation circuit. If a
mutation returns any bounded failure or throws, the circuit opens and every later
queued provider tool call in that model turn returns `tool_budget_exceeded` before
the traced executor. A failed mutation can therefore consume its recovery envelope,
but even provider calls issued concurrently cannot trigger a second tool-side D1
call in the same turn.

`ai_chat_tool_mutation_receipts` remains the domain-commit idempotency boundary. Its
unique key is `(user_message_id, operation, target_key)`. Operations are versioned
domain names; entry targets use normalized text, while meaning updates use the
owned meaning ID. Equal canonical-argument hashes replay the stored bounded result;
different hashes return `mutation_conflict`.

Write policy, persistence, and canonical arguments keep the learner's NFC literal
and do not compatibility-fold it. Entry `target_key` normalization mirrors SQLite
`NOCASE`: NFC and whitespace cleanup followed by ASCII `A-Z` folding only. This
aligns receipt identity with the database unique index; full-width/other
compatibility forms and non-ASCII case variants intentionally remain distinct.

For proposal creation, D1 atomically inserts/reuses the proposal and completes the
originating tool call as `succeeded`; no vocabulary SQL or mutation receipt runs.
For confirmation, a separate executor loads the immutable proposal and batches the
domain statements, postcondition-guarded receipt, and guarded proposal transition to
`committed`. Concurrent equivalent confirms converge on that result. Confirm/cancel
races have one winner; the opposite decision returns conflict. A batch error is not
retried blindly: readback first recovers a terminal proposal/receipt, then classifies
a proven stale CAS as terminal `conflict`; an unclassified failure leaves the
proposal pending and returns a retryable safe error.

## Turn and Retry Flow

1. `beginTurn` batches the complete user row, its bounded immutable
   practice snapshot (at most 48,000 JSON characters), pending assistant row,
   attempt 1, and chat timestamp.
2. The service rebuilds bounded canonical history only before this user sequence,
   restores at most one validated continuation from the latest earlier completed
   `list_vocabulary` ledger result, builds prompt ID/version
   `unmumble.vocabulary-practice`/`2`, creates the tool executor with
   user/chat/message/attempt IDs, and
   starts a maximum five-step AI SDK loop.
3. Each tool call is registered and fenced before execution. The hard per-turn
   budget is two calls. A pre-trace adapter fence rejects call three onward without
   D1 trace work; same-step calls are serialized, and a failed/thrown proposal opens
   the earlier circuit before any later queued provider tool call. Counting each
   batch statement, current generation envelopes are 35 for two maximum reads, 40
   for two cold proposals, 42 with one ambiguous proposal commit, 32 for proposal
   rollback/circuit, 34 for rollback plus ambiguous terminal failure, and 37 for a
   meaning-update proposal rollback plus ambiguous terminal failure (including the
   concurrent duplicate case). A separate Confirm request, including session and
   user refresh, costs 10 statements for either one or ten bulk entries. Maximum-size
   create-chat ambiguous recovery remains 49/50. Tools are disabled for the final
   model step.
4. Final text/usage completes only the current attempt and assistant row. Both
   `finishTurn` and `failTurn` start from owner-scoped `findTurn`, avoiding a
   redundant ownership query. A normal successful terminal batch returns locally
   constructed terminal state without another read. Error, abort, cancellation, or
   timeout fails only that current attempt; exact readback is used only after an
   ambiguous D1 response or failed postcondition, and accepts only this attempt's
   own committed terminal state.
5. Retry retains the same user, practice snapshot, and assistant message, expires
   any stale pending attempt, inserts the next attempt number, and replays matching
   durable receipts. Later target changes cannot rewrite an older turn's context.

Turn and retry IDs are allocated before their D1 batches. If a batch response is
ambiguous after commit, readback accepts only those exact fresh user/assistant and
attempt IDs as the operation's own result (`created`/`retrying`), allowing the
service to continue generation rather than return a false conflict.

The provider timeout is 20 seconds and the pending lease is 30 seconds. Complete or
fresh-pending duplicate client turns return conflict/existing state rather than
starting another paid request; reuse with different user content is rejected. A
fresh pending attempt for any other turn in the same chat is also rejected.

Provider stream data passes through a public allowlist: start, remapped text
start/delta/end, sanitized finish, stable error, and abort. Tool, reasoning, source,
file, custom, step, raw, request, warning, and provider metadata chunks are dropped.
Provider 429 maps to `provider_rate_limited`; other upstream failures expose only
stable public codes.

## Provider, Abuse, and Operational Boundary

Runtime configuration is valid only when it names the code-owned concrete model
`deepseek/deepseek-v4-flash-0731`; presets and unlisted models fail closed as
`not_configured`. Each request disables OpenRouter plugins and sets
`data_collection: deny`, ZDR, and `require_parameters: true` so an endpoint must
support every sent parameter, including local function tools. The generation layer
supplies local vocabulary tools explicitly, and an outbound serialization test
verifies that those local tools remain while no preset or fallback-model fields
reach OpenRouter.

There is no runtime preset dependency. Removing the preset also removes its
OpenRouter response-cache configuration; requests explicitly disable provider
plugins. DeepSeek prompt-prefix caching is a separate provider behavior and remains
automatic without an application or preset setting.

Before turn creation or provider work, Cloudflare rate-limit bindings enforce 10
generation requests per authenticated account per minute and an aggregate 100 per
Cloudflare location per minute. Missing/erroring bindings fail closed with a safe
503; a denied counter returns the stable 429 `provider_rate_limited` code. The
location-local, eventually consistent counters are approximate edge abuse guards,
not globally atomic or exact spend accounting.

The service emits only four allowlisted structured events: generation started,
completed, failed, and rate-limit rejected. Generation events include bounded
attempt, provider/configured-or-actual-model, prompt ID/version, and safe error
identifiers; prompts, messages, vocabulary, tool arguments/results, credentials,
and upstream bodies are excluded.

## Limits and Privacy

Existing chat ceilings remain: 16,384 request bytes; 4,000 message characters;
100 chats per account/list response; latest 200 messages per detail; 40 complete
model-history messages/32,000 characters; 800 output tokens; 20-second provider
timeout. Vocabulary page/search limits are 10 entries per result, 240 entry
characters, 1,000 meaning/context characters, and six bounded provider meanings per
entry. A list has no overall entry cap and advances by a <=512-character opaque
cursor. A successful compact result is capped at 7,800 JSON characters. Practice target
data is capped at 12 targets/48,000 characters. Tool trace JSON is limited to 4,096
argument and 8,192 result characters; provider call ID/tool name are limited to
240/120 characters.

Every mutation requires exact origin; every D1 operation is owner scoped. Stored
vocabulary is untrusted prompt data, assistant output is plain text, and public
errors/logging exclude secrets, prompts, messages, vocabulary, tool arguments,
results, and upstream bodies.

## Local Verification

Fresh 2026-08-30 exact-diff evidence passes full `npm test` 564/564 (including the
production build), plus typecheck and lint with zero errors plus three existing
warnings. Focused proposal lifecycle, route, tool, prompt, schema/migration, bulk,
D1-budget, and UI suites are green. Controlled 1280px and 390px browser checks of
the actual themed card confirm three-item disclosure, 44px actions, and no horizontal
overflow; earlier controlled chat checks cover word actions, current-selection
translate/add payloads, native-selection regressions, rounded focus, compact no-scroll
input, and expanded editing. Independent exact-diff review found no P0/P1.
final review found no P0/P1. Backend commit `8f671288` is pushed and PR #32 has green CodeQL,
Analyze, Sonar, and Workers checks. Authenticated provider-backed preview requests
for latest ten/all available and `To Learn` each returned the account's two matching
entries without a user-data mutation. These close local/published read-path gates, not manual >10
cross-turn traversal, write/replay, or production rollout gates.

## Duplicate Migration Contract

Migration 0017 chooses the earliest owner-custom phrase under SQLite ASCII
`NOCASE` as canonical, merges historical duplicates, and then creates the partial
unique index. It preserves/rehomes progress, personal meanings, examples, saved
video origins, and chat practice-item phrase/selected-meaning references; duplicate
meaning/example rows converge deterministically. Before duplicate meanings are
deleted, the canonical meaning preserves their non-empty translation/context and
latest `updated_at`. Unicode case variants stay separate by explicit contract.

Preview already executed an older 0017 body, but commit `c970f80` documents the
read-only preflight that found zero owner-custom ASCII-`NOCASE` duplicates before
that deployment. The corrected merge therefore had no rows to transform, and this
preview is explicitly accepted as behaviorally equivalent: no 0017 re-baseline or
forward migration is needed there. Fresh production will execute the corrected
0017. Preview evidence confirms 0019 and 0020 applied,
`configured_provider`/`configured_model` present and backfilled, the one-pending-
attempt-per-chat index present, and `PRAGMA foreign_key_check` clean.

## Authentication Migration Boundary

`ensureUser` is the normal one-statement user upsert. The historical legacy-owner
transfer is a separate atomic, idempotent operation invoked during `/login` and
`/api/session`, including existing-session bootstrap, never inside an AI generation
request.

## Open Decisions

- Whether re-activation should change recency; today `created_at` defines latest.
- Final target/meaning controls, editable translation/meaning selection, and
  cross-surface launch.
- Intent-language quality and future multilingual proposal resolution.
- Model-allowlist governance, future fallback models, spend ownership, guest access,
  retention, monitoring thresholds, deployment, and resumable/background execution.

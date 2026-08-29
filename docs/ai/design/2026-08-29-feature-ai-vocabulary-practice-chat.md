---
phase: design
title: AI Vocabulary Practice Chat Design
description: Chat-only UI with bounded vocabulary tools and durable D1 execution receipts
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
  SDK --> Read["latest N / search"]
  SDK --> Guard["current-turn write policy"]
  Read --> Vocabulary[(D1 vocabulary)]
  Guard --> Ledger["tool-call ledger"]
  Ledger --> Batch["domain write + receipt + call result"]
  Batch --> Vocabulary
  SDK --> OpenRouter
```

Guests may render the sign-in boundary; generation and tools remain account-only.

## Chat-only Browser Contract

- `GET/POST /api/ai/chats` lists or creates owned chats.
- `GET /api/ai/chats/:id` restores an owned chat.
- `POST /api/ai/chats/:id/messages` accepts only
  `{ clientMessageId, content }` and streams the assistant response.
- The browser cannot submit identity, history, roles, targets, model, tool names,
  arguments, results, receipts, or attempts.
- The visible UI contains chat list, `New Chat`, timeline, composer, send/retry, and
  essential states only. Compatibility target/meaning APIs and tables may remain,
  but the UI does not depend on them or preselect vocabulary from Library/Practice.
- Compatibility target replacement is one owner-scoped atomic
  `PATCH /api/ai/chats/:id/targets` containing the complete desired array; there are
  no incremental target `POST`/`DELETE` routes. It accepts up to 12 saved/ad-hoc
  targets with `all_saved`, saved-only `selected`, or `explore` meaning mode.
- `POST /api/ai/translate` is an authenticated, bounded server-side contextual
  translation fallback; the current chat UI does not invoke it.

## Deterministic Opening and Read Tools

`POST /api/ai/chats` calls `listRecent(userId, 5)` before creation. D1 orders active
entries by `phrase_progress.created_at DESC, phrases.id DESC`. The Worker formats a
bounded Russian offer and persists it in the chat-creation batch as complete
assistant sequence 1 with `clientMessageId = opening:<chatId>`. No synthetic user
message, assistant attempt, tool ledger row, or provider call is created. When this
message later enters model history, the service escapes delimiter-like characters
and wraps it in `BEGIN/END_UNTRUSTED_VOCABULARY_OPENING` markers; the persisted UI
copy remains readable.

The model later receives two read tools:

- `get_recent_vocabulary({ limit? })`: default 5, integer range 1–10;
- `find_vocabulary({ query, limit? })`: default/maximum 10; owner-scoped substring
  search over phrase text, legacy translation, and the current learner's personal
  translations, with exact matches first, then recency and phrase-ID tie-breaker.
  Query text is capped at 48 characters and its escaped wildcard `LIKE` pattern at
  50 UTF-8 bytes.

Both read only active account-visible vocabulary (`to_learn`, `learning_now`,
`learnt`, plus the stored legacy `learned` alias). Each provider-facing entry is
bounded to 240 text characters and six meanings of 100/160 translation/context
characters. The whole success result is at most 7,800 JSON characters: excess
meanings are removed first, then meaning contexts are blanked if needed, with
`meaningsTruncated` and `detailsTruncated` preserving honest metadata.

## Write Tools and Authorization

The model has `add_vocabulary_entry`, `add_vocabulary_meaning`, and
`update_vocabulary_meaning`. Their JSON Schemas reject extra properties and omit
identity/status. Handlers bind the authenticated user and exact persisted current
user message.

A write passes only when that current message contains a recognized direct
vocabulary-write command and literally includes every value to persist. Meaning
writes additionally resolve the entry server-side and require its text literally
in the same message. Prior turns and model-generated values never authorize a
write. Denials become bounded tool results, so the assistant can ask for a precise
command.

An update also requires the resolved current translation literally in the current
message. The planner captures phrase/meaning IDs plus old translation/context and
executes an owner-scoped compare-and-swap. A wrong owner, entry, meaning, old value,
or concurrent edit fails the postcondition/conflict guard and becomes a traced
`mutation_conflict`.

There is no status tool. Mutation plans can initialize a new/`pick` entry as
`to_learn`, but preserve every active status. Preset legacy fields are never
updated; owner-custom empty legacy fields may be initialized, otherwise additions
are user-owned `phrase_meanings`. Updating by meaning ID is personal/owner scoped
and cannot target the `legacy` sentinel.

The existing manual phrase `PATCH` remains outside the agent tool boundary. For a
preset phrase with no stored translation, it saves the resolved translation as the
current learner's personal meaning and commits that meaning with the requested
status change in one D1 batch; shared preset fields remain immutable.

## Attempts, Ledger, and Receipts

`ai_chat_assistant_attempts` separates a logical assistant message from each
generation run. Attempt ID and number are never reused; terminal attempts remain as
history, and a partial unique index allows only one `pending` attempt per assistant
message. The 30-second lease expires abandoned work. Finish/fail/tool SQL is fenced
by the exact current attempt with both `status = pending` and an unexpired
`lease_expires_at`. The same lease predicate protects assistant terminal writes,
tool registration/completion, receipt insertion, commit, and replay.

`ai_chat_tool_calls` records every within-budget invocation before execution,
including reads and rejections. A provider-adapter counter rejects the third and
later calls with `tool_budget_exceeded` before reaching the trace executor, so they
consume no D1 trace queries. The identity
`(assistant_attempt_id, provider_tool_call_id)` is unique; canonical argument JSON
and SHA-256 detect conflicting ID reuse. Terminal states are `succeeded`,
`committed`, `replayed`, `rejected`, or `failed`.

`ai_chat_tool_mutation_receipts` is the cross-attempt idempotency boundary. Its
unique key is `(user_message_id, operation, target_key)`. Operations are versioned
domain names; entry targets use normalized text, while meaning updates use the
owned meaning ID. Equal canonical-argument hashes replay the stored bounded result;
different hashes return `mutation_conflict`.

Entry `target_key` normalization mirrors SQLite `NOCASE`: NFKC and whitespace
cleanup followed by ASCII `A-Z` folding only. This aligns receipt identity with the
database unique index; non-ASCII case variants intentionally remain distinct.

For a write, D1 executes domain statements, a postcondition-guarded receipt insert,
and the tool-call `committed` update in one `batch`. A false owner/status/entity
postcondition aborts the batch. Concurrent equivalent writes converge on one
receipt; an ambiguous error after commit is resolved by reading that receipt. A
failure before execution is safe to retry once because the batch is idempotent and
receipt guarded. If both attempts fail without a receipt or stale-attempt verdict,
the ledger call ends with `operation_failed`.

## Turn and Retry Flow

1. `beginTurn` batches the complete user row, its bounded immutable
   practice snapshot (at most 48,000 JSON characters), pending assistant row,
   attempt 1, and chat timestamp.
2. The service rebuilds bounded canonical history only before this user sequence,
   creates the tool executor with user/chat/message/attempt IDs, and starts a
   maximum five-step AI SDK loop.
3. Each tool call is registered and fenced before execution. The hard per-turn
   budget is two calls. A pre-trace adapter fence rejects call three onward without
   D1 trace work, leaving room under D1 Free's 50-query invocation limit. Counting
   each batch statement, a cold turn with two new-entry writes uses 45 statements;
   one ambiguous committed-write recovery raises that envelope to 47. Tools are
   disabled for the final model step.
4. Final text/usage completes only the current attempt and assistant row. Error,
   abort, cancellation, or timeout fails only that current attempt.
5. Retry retains the same user, practice snapshot, and assistant message, expires
   any stale pending attempt, inserts the next attempt number, and replays matching
   durable receipts. Later target changes cannot rewrite an older turn's context.

Turn and retry IDs are allocated before their D1 batches. If a batch response is
ambiguous after commit, readback accepts only those exact fresh user/assistant and
attempt IDs as the operation's own result (`created`/`retrying`), allowing the
service to continue generation rather than return a false conflict.

The provider timeout is 20 seconds and the pending lease is 30 seconds. Complete or
fresh-pending duplicate client turns return conflict/existing state rather than
starting another paid request; reuse with different user content is rejected.

## Limits and Privacy

Existing chat ceilings remain: 16,384 request bytes; 4,000 message characters;
40 complete history messages/32,000 characters; 800 output tokens; 20-second
provider timeout. Vocabulary limits are 10 read entries, 240 entry characters,
1,000 meaning/context characters, and six bounded provider meanings per entry. A
successful compact read result is capped at 7,800 JSON characters. Practice target
data is capped at 12 targets/48,000 characters. Tool trace JSON is limited to 4,096
argument and 8,192 result characters; provider call ID/tool name are limited to
240/120 characters.

Every mutation requires exact origin; every D1 operation is owner scoped. Stored
vocabulary is untrusted prompt data, assistant output is plain text, and public
errors/logging exclude secrets, prompts, messages, vocabulary, tool arguments,
results, and upstream bodies.

## Duplicate Migration Contract

Migration 0017 chooses the earliest owner-custom phrase under SQLite ASCII
`NOCASE` as canonical, merges historical duplicates, and then creates the partial
unique index. It preserves/rehomes progress, personal meanings, examples, saved
video origins, and chat practice-item phrase/selected-meaning references; duplicate
meaning/example rows converge deterministically. Unicode case variants stay
separate by explicit contract.

## Open Decisions

- Whether re-activation should change recency; today `created_at` defines latest.
- Final target/meaning controls, interactive translation, and cross-surface launch.
- Intent languages and whether deterministic write authorization should evolve
  beyond the current Russian/English command recognizer.
- Production model/routing, spend/rate policy, guest access, retention, monitoring
  thresholds, and resumable/background execution.

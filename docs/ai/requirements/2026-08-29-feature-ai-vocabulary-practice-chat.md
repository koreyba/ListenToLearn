---
phase: requirements
title: AI Vocabulary Practice Chat
description: Chat-only contextual practice with account-scoped vocabulary tools and confirmed writes
---

# AI Vocabulary Practice Chat

## Problem

Words become usable through repeated context, not an isolated card. Unmumble already
provides real video contexts and a persistent vocabulary, while a general AI chat
can generate and explain new contexts but does not know that vocabulary. The feature
connects the two in one focused, learner-led conversation.

## Product Boundary

The current delivery is deliberately chat-focused. The signed-in learner sees a
separate chat list and conversation pane, `New Chat`, messages, composer,
send/retry, and essential loading/error states. Selecting text inside one message
opens compact translation and vocabulary actions. Each English word has a subtle
interactive treatment and opens the same actions on tap/click without taking native
range selection away from the learner. Agent-requested vocabulary changes appear as
durable inline confirmation cards in the conversation; they do not mutate data
until the learner confirms. There are no target cards, meaning selectors, or
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
- As a learner, I can naturally ask for one mixed change set containing additions,
  meaning additions/updates, moves, and removals, up to 30 concrete vocabulary
  changes in one request.
- As a learner, mentioning, practising, or showing interest in a word never saves
  it. The agent first shows the exact proposed change inline, and only my explicit
  confirmation commits it.
- As a learner, AI never infers mastery or moves an item autonomously; it may
  resolve a natural reference from conversation context, but the inline proposal
  must show the exact entry and destination before I confirm it.
- As a learner, I can select a word, phrase, sentence, or mixed English/Russian
  fragment inside one chat message, translate it through my configured DeepL
  integration, and explicitly add the exact selection to my vocabulary.
- As a learner, I can tap/click an English word to act on it, while a mobile long
  press still starts native multi-word selection and never triggers the word action.
- As a learner writing a long request, I can expand the compact composer into a
  full-screen editor instead of scrolling inside a small input.
- As a learner on mobile, I can move between the chat list and one conversation
  without scrolling past the entire history list; on desktop both panes remain
  visible together.

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

The provider registry exposes exactly three account-scoped tools: the two read
tools above and one mutation proposal tool,
`propose_vocabulary_change_set({ changes })`. The closed change union supports:

- `add_entry` with exact text and optional translation/context;
- `add_meaning` with exact entry text, translation, and optional context;
- `update_meaning` with exact entry text, optional current translation for
  disambiguation, replacement translation, and optional context;
- `change_state` with exact entry text and destination
  `to_learn|learning|learned|removed`;
- `change_recent_state` with an exact count and destination.

Natural, unambiguous references may resolve through bounded canonical conversation
context. The model does not need to repeat database IDs or a rigid command grammar.
The server resolves every referenced entity against current owner-visible state;
missing, ambiguous, conflicting, or unsupported requests return an explicit
validation error and never become an inferred write. The browser renders the exact
resolved values for review. A proposal is not success and performs no domain write.

The learner authorizes a mutation only by confirming that stored proposal. The
confirmation request names the proposal and decision but contains no mutation
arguments; the server loads the immutable, owner-scoped canonical arguments and
executes them deterministically without a second model call. Cancellation records a
terminal state and performs no domain write. Confirm/cancel races converge to one
durable state, and repeated confirms replay the same bounded result.

One model proposal becomes one inline confirmation card. The card groups concrete
items by addition, meaning addition, meaning update, and move/removal, shows the
complete change count with a compact accessible disclosure for long sets, and has
one Confirm and one Cancel decision for the whole atomic change set on desktop and
mobile.

The change-set limit is 30 concrete changes. Every explicit action has weight one;
`change_recent_state({ count: N })` has weight N after deterministic resolution.
The aggregate weight must be 1–30, and at most one recent-state selector is allowed.
Identical actions collapse where their effect is equivalent; conflicting actions on
one normalized target reject the complete proposal. Meaning additions and updates
that converge on one normalized owner/phrase translation also reject the complete
proposal. Mixed-language text remains one exact item.

The change set is set-based and atomic. Confirmation returns one bounded result per
canonical concrete action. Entry additions report `added` or `already_saved`;
`already_saved` means active owner-visible progress existed when the confirmed plan
was built. A stale, foreign, missing, ambiguous, or conflicting action rolls back
the whole confirmation rather than partially applying the remainder.

Meaning updates remain compare-and-swap operations bound to owner, phrase ID,
meaning ID, old translation, and old context captured server-side when the proposal
is created. State-change texts resolve in one set-based owner-scoped query to an
immutable phrase ID/text/source/status snapshot. Missing, foreign, duplicate, or
stale state fails truthfully and the complete batch rolls back.

Tool inputs never accept `userId`, `chatId`, raw stored status, provider/model,
roles, SQL, or arbitrary HTTP operations. Identity, active chat, current user
message, assistant message, and generation-attempt identity are injected by the
server.

On confirmed removal, a preset phrase remains immutable shared Library data and only
this learner's progress becomes `pick`; a learner-owned custom phrase deletes only
that owner row and its foreign-key children. Confirmation never re-resolves the
targets. Separately, a genuinely new/previously unsaved `pick` entry starts in
`to_learn` and refreshes progress `created_at`, so re-adding it is newest; an
already-active duplicate preserves status and recency. Every newly supplied
translation is stored as an owner-scoped personal meaning; preset legacy data stays
immutable, and a confirmed historical custom-legacy update promotes it atomically.
Trying to edit shared preset legacy meaning returns the closed typed
`unsupported_change` result with a deterministic supported alternative.

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
- A tool timeout, tool failure, provider failure, explicit cancellation, or
  interrupted Worker makes the current attempt terminal and releases the chat for a
  later message or explicit retry. The composer must not stay frozen behind an
  abandoned pending attempt; the lease is only the emergency recovery fence.
- Canonical model history contains complete logical pairs only: a user message enters
  history only with its successfully completed assistant response. Pending, failed,
  cancelled, and interrupted pairs remain visible as product state where applicable
  but cannot contaminate a later provider prompt.
- Assistant finish/fail, tool registration/completion, receipt insertion, commit,
  and replay require both `pending` status and `lease_expires_at` later than the
  operation timestamp.
- `POST /api/ai/chats/:chatId/messages/:clientMessageId/cancel` accepts only an
  authenticated same-origin empty command. It terminalizes the exact latest pending
  assistant attempt as `generation_cancelled` even when its lease has just elapsed,
  so an explicit Stop does not wait for the five-minute recovery lease. A browser-
  observed stream interruption does not claim cancellation: it polls the canonical
  chat through the lease with bounded backoff, reconciles the terminal result, and
  preserves an unverifiable outbound message for idempotent retry. Complete/failed
  turns replay their existing terminal state,
  foreign or missing turns return 404, and late generation callbacks stay fenced.
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
- Any claim about current/latest/recent/present/missing vocabulary requires
  `list_vocabulary` or `find_vocabulary` in that same model turn. History, prior
  reads, and confirmation are not database truth; this rule adds no automatic D1
  read and leaves the model to call a read tool when the claim is needed.
- The prompt contract lives at
  `lib/ai-chat/prompts/vocabulary-practice.ts`, has ID
  `unmumble.vocabulary-practice` and version `7`, and returns that identity with the
  system/messages payload. The prompt accepts English-learning requests and Unmumble
  vocabulary operations, accepts general topics only when explicitly used for English
  practice, and otherwise gives a brief scope redirect without calling tools. Safe
  generation events include prompt ID/version so a response can be traced to the exact
  prompt contract without logging prompt text.

### Interactive message selection

- English word tokens preserve the exact rendered message and are marked with a
  quiet dotted underline. Click/tap opens a word action surface. Keyboard access
  uses one roving tab stop per message plus arrow/Home/End navigation and
  Enter/Space activation, rather than placing every word in the page tab order.
- A touch held for at least 450ms suppresses the following synthetic click long
  enough for native range handles to appear. A completed non-collapsed selection
  also suppresses word activation, so long-press and drag cannot accidentally open
  a single-word action. A later short tap/click clears that lingering range and
  activates the newly chosen word.
- Text selection is accepted only when both ends of the range are inside one chat
  message. It preserves the exact cleaned selection, including mixed scripts, as
  one item; the client does not split text or infer a primary language.
- `POST /api/translate` remains the one authenticated DeepL path and receives the
  exact `{ text, context }`. Translation is English-to-Russian and best-effort for
  mixed-language selections. A DeepL error never disables vocabulary saving.
- `POST /api/phrases` receives the exact selection and bounded message context,
  plus the displayed DeepL result only when it belongs to that same message/text/
  context identity. New entries begin in `To Learn`; an existing active category
  is preserved and reported honestly.
- Translation accepts at most 500 characters. Vocabulary entry text accepts at
  most 240 characters. The client never truncates silently: for selections of
  241-500 characters, Translate remains available while Add is disabled with an
  explanation.
- Desktop presents a selection-anchored action surface. Mobile presents the same
  actions as a safe-area-aware bottom sheet so native selection handles remain
  usable. Escape closes the action surface and touch targets are at least 44px.

### Composer interaction

- The compact textarea grows from 48px to 112px, has no resize handle or internal
  scrollbar, and keeps focus indication on the rounded composer shell rather than
  drawing a rectangular outline inside it.
- A non-empty draft exposes an expand control. It opens a full-viewport modal editor
  with the same draft, body-scroll lock, focus trap, Escape/close dismissal, focus
  restoration, a character counter, and Cmd/Ctrl+Enter submission. Mobile and
  desktop share the same draft and never lose text while switching modes.

### Durable tool execution

- Every within-budget tool invocation, including reads and policy rejections, is
  recorded in an owner/chat/message/attempt-scoped ledger with canonical arguments,
  SHA-256 hash, bounded result, status, safe error, and optional mutation receipt.
  A separate provider-adapter fence rejects the third and later calls as
  `tool_budget_exceeded` before any D1 trace query.
- Provider tool calls issued in one model step are serialized before shared budget/
  circuit checks. Any failed or thrown proposal operation opens a per-turn circuit. Every
  later queued provider tool call in that turn returns `tool_budget_exceeded` before
  the traced executor and therefore cannot issue a second tool-side D1 call after
  the failed mutation's recovery envelope.
- A committed agent proposal has one durable receipt keyed by
  `(userMessageId, operation, targetKey)`. Its immutable row binds owner, chat,
  user/assistant message, attempt, operation, canonical argument hash, and bounded
  display payload.
- Each proposal has one guarded lifecycle: `pending`, `committed`, `cancelled`, or
  `conflict`. Canonical mutation arguments and their hash never change. The public
  chat DTO exposes only sanitized display data and terminal result/error state.
- Write values and canonical arguments preserve the learner's NFC literal, including
  compatibility characters. Entry receipt target keys apply only NFC/whitespace
  cleanup plus ASCII `A-Z` folding, matching SQLite `NOCASE`; they never use NFKC
  compatibility folding. Unicode case variants remain distinct, and the application
  does not claim Unicode-insensitive uniqueness that D1 cannot enforce.
- Proposal insertion, postcondition-guarded receipt insertion, and the tool call's
  committed result are one D1 `batch`. A failed postcondition rolls back the whole
  proposal operation.
- Confirmation runs in a later Worker invocation. Its set-based domain statements
  and postcondition-guarded terminal transition are one D1 `batch`; a false owner,
  stale-state, or count postcondition rolls back every vocabulary change. Ambiguous
  completion is resolved by reading the decision before any retry.
- A mutation-batch error is never followed by a blind resubmission. The executor
  checks, in order, for a committed receipt, an expired/stale attempt, and a proven
  owner/entity/old-value CAS conflict. It recovers or replays only those observed
  states; an unclassified failure terminates as `operation_failed`.
- An equivalent retry/repeated call replays the stored receipt. The same receipt key
  with different canonical arguments is a conflict, not a second mutation.
- A proposal is listable and confirmable only when its exact origin attempt is
  complete. A failed or interrupted origin remains hidden and cannot authorize a
  later vocabulary write; the chat itself remains usable.
- Proposal creation is idempotent within
  `(originAttemptId, operation, targetKey)`. A learner retry has a new attempt and
  may create a new immutable proposal while the failed origin remains hidden;
  migration 0023 replaces the earlier message-scoped proposal index.
- The three-tool implementation is split by responsibility under
  `lib/ai-chat/tools/vocabulary/`: `contracts`, `results`, `handlers`,
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
- Model output: 2,400 tokens. Generation inactivity deadlines are 20 seconds to the
  first semantic chunk, 20 seconds between semantic chunks, and 5 seconds for a tool
  execution. There is no absolute total or per-step model deadline while semantic
  output continues. The independent stale-attempt recovery lease is five minutes.
- At most 2 tool calls per user turn. A mixed mutation request normally needs one
  `propose_vocabulary_change_set` call; a grounded lookup followed by that proposal
  may use both. The pre-trace fence preserves headroom under D1 Free's
  50-query-per-Worker-invocation allowance. Proposal creation remains in the
  generation invocation; confirmation is a separate invocation and must also stay
  below 50. Fresh statement-count tests own the exact post-change envelopes.
- A successful proposal tool ends the provider path for that turn. The server
  persists the proposal and deterministic assistant/card state without asking the
  model to narrate the tool result. A schema, resolution, timeout, or tool error is
  terminal for the attempt and maps to a stable explicit error. There is no
  automatic provider resubmission and no parser-generated fallback tool call;
  retrying is a separate learner action with a new immutable attempt.
- Tool trace arguments/results: 4,096/8,192 JSON characters.
- A proposal contains 1–30 weighted concrete changes. Canonical aggregate arguments
  stay within the existing 4,096-character tool-argument cap and confirmation
  results within the 8,192-character result cap.
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
  rejection. Terminal events may additionally carry bounded elapsed time, finish
  reason, step/tool counts, output-character count, and bounded termination
  classification; prompts, vocabulary,
  messages, tool arguments/results, and credentials are never event fields.

Ordinary authenticated requests perform only the cheap user ensure. The one-time,
atomic legacy-owner transfer is an explicit idempotent login/session-bootstrap path,
outside AI generation, so it cannot consume the generation invocation's D1 budget.

## Success Criteria

- New-chat latest-five ordering and empty/partial states are deterministic and
  persist without a synthetic user message.
- Category listing with cross-turn cursor continuation, search, grounded practice,
  and chat reload work within the chat-only UI.
- Desktop and mobile preserve a usable master/detail chat layout; fast chat
  switching cannot let an older response replace the last selected chat, and a
  refresh does not discard per-chat drafts.
- Single-message word/phrase/mixed-text selection translates through DeepL and
  explicitly saves the exact text without making saving depend on translation.
- Consecutive selections reset old translation/save state; translate and add requests
  always snapshot the current message/text/context identity.
- Compact and expanded composers remain usable without a nested scrollbar on both
  mobile and desktop, and the compact input has no inner rectangular focus outline.
- Natural unambiguous-reference resolution, explicit ambiguity errors, owner checks,
  immutable canonical arguments, one grouped inline confirmation, atomic mixed
  execution up to 30 weighted changes, cancellation, replay, conflicts, ambiguous
  completion, and stale-state fencing are covered by executable tests.
- A manual authenticated smoke confirms real model tool use and persistence before
  any deployment decision.

## Non-goals and Open Decisions

- No inferred/automatic progress, autonomous category changes, spaced repetition,
  autonomous curriculum, shared-Library deletion/merge, guest-funded AI, or
  resumable background run.
- “Latest” means the most recent activation: re-adding an entry currently at
  `pick` refreshes progress `created_at`; re-adding an already-active entry does not.
- Final direct target/meaning UI, editable translation/meaning selection, and
  Library/Practice launch affordances remain open product decisions.
- Broader search semantics, supported intent languages, future fallback models,
  model-allowlist governance, spend ownership, monitoring thresholds, retention,
  and deployment are open.

## Validation Status

Fresh 2026-08-31 focused evidence passes 134/134 generation, vocabulary-tool,
mixed-planner, proposal-retry, schema/migration, and D1-budget tests. It covers typed
preset rejection, compact production IDs for 30 translated additions, cross-action
meaning collisions, reactivation ordering, and migration 0023. The full suite,
browser E2E, preview deployment, and push have not been rerun for this exact diff and
remain open gates.

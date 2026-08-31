---
phase: planning
title: AI Vocabulary Practice Chat Plan
description: Delivery status for the chat-only vocabulary-agent revision
---

# AI Vocabulary Practice Chat Plan

## Current Status

The resource-first backend follow-up is implemented in the current local diff.
Fresh 2026-08-31 focused evidence passes 134/134 generation, vocabulary-tool,
change-set, proposal-retry, schema/migration, and D1-budget tests. This slice has not
been revalidated with the full suite, browser E2E, a preview deployment, or a push;
those remain explicit gates rather than completion claims.

The approved resource-first follow-up is active in the current diff. The provider
surface is being reduced to two reads plus one mixed proposal tool; one atomic
change set may contain up to 30 weighted additions, meaning changes, moves, and
removals behind one grouped inline confirmation. Automatic provider recovery and a
post-proposal narration call are removed. Terminal tool/model/interruption states
must release the chat, and only complete user/assistant pairs may enter later model
history. The historical 25-turn smoke remains baseline evidence, not verification
of this follow-up. PR-preview deployment is authorized; production is not.

## Implemented

- [x] **P01 · Chat-only surface** — chat list, `New Chat`, timeline, composer,
  send/retry, loading/error states; target/meaning/status controls and preselection
  entry points removed.
- [x] **P02 · Deterministic opening** — new chat reads the owner's latest five by
  chronological `julianday(created_at)` plus phrase-ID tie-breaker and persists a
  bounded complete assistant offer without a user row or model call. Cursors keep
  the raw SQLite/ISO-seconds/ISO-milliseconds boundary; model history receives the
  opening only inside escaped `UNTRUSTED_VOCABULARY_OPENING` markers.
- [x] **P03 · Vocabulary reads and continuation** — `list_vocabulary` pages `all`,
  `to_learn`, `learning`, or `learned` newest-first with no overall list cap, plus
  bounded search across text and owner-visible meanings. Opaque versioned cursors
  are category-bound; the latest completed list can continue across a later turn
  without copying its entries into the prompt.
- [x] **P04 · Confirmation-gated agent writes** — the exact three-tool registry
  contains two reads and one mixed proposal tool. Natural unambiguous references
  resolve through bounded canonical context; explicit ambiguity/conflict errors
  replace guessed targets. The model can only persist an immutable proposal. State
  and meaning actions resolve exact owner-visible entities and capture owner-scoped
  CAS values; only the learner's later Confirm executes the write. A shared preset
  legacy-meaning edit returns the closed typed `unsupported_change` result and a
  deterministic learner-facing explanation; no private planner detail is exposed.
- [x] **P05 · Category-safe domain plans** — new/`pick` add initializes `to_learn`;
  reactivation refreshes recency while an active duplicate preserves it; entry/
  meaning writes preserve active category, while only an explicit state proposal
  changes it through owner-scoped CAS. Confirmed removal hides a shared preset only
  from this learner's Practice and deletes an owned custom row only for its owner.
  Preset legacy data is immutable and
  personal meanings are owner scoped; historical custom legacy values promote
  safely. Manual preset `PATCH` batches personal fallback meaning with its requested
  status outside the agent boundary.
- [x] **P05a · Compatibility context** — one atomic whole-array target `PATCH`
  supports bounded saved/ad-hoc targets and all three meaning modes while controls
  stay out of the UI. Vocabulary-specific saved-target resolution/current-item SQL
  lives behind `lib/vocabulary/practice-reader.ts`; chat persistence retains
  ownership, ordering, validation, and atomic writes.
- [x] **P05b · Single traced AI provider path** — the unused OpenRouter-backed
  `/api/ai/translate` surface remains removed. Chat text selection reuses the
  existing server-side DeepL `/api/translate`; it does not add a second model
  runner or expose provider credentials to the browser.
- [x] **P06 · Immutable attempts** — distinct numbered attempt identity per retry,
  one pending lease per chat enforced by migration 0019, stale-turn repair,
  status-plus-expiry fencing for assistant/tools/receipts, history-before-current-
  turn replay, immutable per-turn practice snapshots, fresh-ID recovery from
  ambiguous committed begin/retry batches, and owner-scoped `findTurn` terminal
  gating without redundant ownership reads. Normal finish/fail success returns the
  constructed state; exact readback is reserved for ambiguity/postcondition races.
  A separate owner-scoped cancellation endpoint immediately terminalizes the exact
  pending attempt (including an elapsed lease), replays existing terminal state
  idempotently, and fences late callbacks without changing normal success cost.
  Migration 0020 records configured provider/model before generation separately
  from terminal provider/actual response model and sanitized routed-provider
  telemetry.
  Migration 0023 scopes proposal idempotency to
  `(originAttemptId, operation, targetKey)`: a retry attempt creates a new immutable
  proposal, while a failed origin's proposal remains hidden and unconfirmable.
- [x] **P07 · Tool-call ledger** — canonical bounded args/result, hash, status,
  safe error, attempt/provider-call identity, and records for reads/rejections too.
- [x] **P08 · Atomic mutation receipts** — unique
  `(userMessageId, operation, targetKey)` receipt, guarded D1 batch with domain
  statements and terminal call result, then receipt/stale/CAS recovery after an
  error. The mutation batch is never blindly retried; unclassified failure becomes
  `operation_failed`. Persistence/canonical args retain NFC literals; entry keys use
  NFC/whitespace cleanup and SQLite-compatible ASCII casefold without NFKC folding,
  leaving compatibility forms and Unicode case variants distinct by contract.
- [x] **P09 · Bounded orchestration** — two tool calls remain the hard ceiling, so a
  grounded read may precede one mixed proposal. The provider-adapter pre-trace fence
  rejects call three onward without D1 queries. Same-step calls serialize before
  shared limit/circuit checks; a failed or thrown proposal opens the circuit, so no
  later queued provider call reaches D1. Proposal success terminates the provider
  path and persists deterministic assistant/card state. Set-based generation and
  confirmation envelopes for the 30-change boundary must each remain below D1
  Free's 50-query limit and are owned by fresh statement-count tests.
  Production IDs inside change-set canonical arguments are compact 128-bit
  URL-safe values, keeping a real 30-item translated-add plan within the 3,600-byte
  planner ceiling and the durable 4,096-byte proposal-input limit.
- [x] **P09a · Bounded public transport** — 100 chats per account/list, latest 200
  detail messages, 40/32,000 model history, explicit public DTOs, provider-stream
  allowlisting, and stable `provider_rate_limited` mapping.
- [x] **P09b · Provider and abuse fence** — presets and unlisted models fail closed;
  every request uses the code-owned concrete DeepSeek model, disables provider
  plugins, denies data collection with ZDR, requires endpoint parameter support,
  and retains only local traced AI SDK tools. Cloudflare bindings enforce 10
  generation requests per account/minute plus
  an approximate aggregate 100 per Cloudflare location/minute and fail closed
  before D1 turn creation/provider work when unavailable.
- [x] **P09c · Safe operational events** — exact-field events cover generation
  start/completion/failure and rate-limit rejection without prompts, vocabulary,
  tool payloads/results, credentials, or provider bodies. Bounded elapsed, finish,
  step/tool-count, and output-size metrics make terminal failures diagnosable;
  configured and actual model provenance remain distinct. Terminal metadata records
  only bounded termination classification, never user text or tool arguments.
- [x] **P09d · Auth migration isolation** — ordinary `ensureUser` stays cheap;
  atomic idempotent legacy-owner transfer runs only on login/session bootstrap.
- [x] **P10 · Versioned prompt and SRP tools** — prompt path
  `lib/ai-chat/prompts/vocabulary-practice.ts` exposes ID
  `unmumble.vocabulary-practice`/version `5` and reports that identity in safe
  events. Three vocabulary tools are split into contracts/results/handlers/registry/
  pagination; `vocabulary-tools.ts` is a thin facade and every active tool shares
  one traced budget wrapper.

## Remaining Gates

- [x] **P15 · Durable inline write approval** — add immutable owner-scoped proposal
  payloads with guarded terminal states; expose only sanitized proposal DTOs; render
  accessible inline Confirm/Cancel cards; execute confirmation from stored arguments
  without a model call; cover replay, races, cancellation, stale CAS, ambiguous D1
  completion, owner isolation, direct selection-write preservation, and sub-50 D1
  statement envelopes. The UI safely defaults an older chat DTO without
  `writeProposals` to an empty list.

- [x] **P15a · Stable generation and Practice removal** — raise complete-response
  capacity to 2,400 tokens, enforce structured 45/25/20/20/5-second deadlines,
  classify non-stop output as retryable `response_incomplete`, classify cancellation
  truthfully, add atomic owner-safe removal, require same-turn reads for
  current/latest claims, and refresh recency only when reactivating from `pick`.

- [x] **P15b · Resource-first mixed changes and usable terminal failures** — expose
  exactly two reads plus `propose_vocabulary_change_set`; resolve 1–30 weighted
  concrete additions, meaning additions/updates, moves, recent-N changes, and
  removals into one immutable atomic proposal; render one grouped inline card with
  one Confirm/Cancel pair; confirm deterministically without a model; return
  explicit ambiguity/conflict errors; perform no automatic provider resubmission or
  application-generated fallback call; terminalize timeout/tool/provider/cancelled/
  interrupted attempts so the same chat remains usable; admit only complete logical
  user/assistant pairs to canonical history; verify generation/confirm D1 headroom,
  desktop/mobile UI, interruption, and replay before marking complete.

- [x] **P11 · Responsive chat workspace** — keep list and dialogue visible together
  on desktop; use a drawer on tablet/mobile; preserve selected chat in the URL,
  per-chat drafts, last-request-wins switching, single-flight creation, honest
  loading states, and follow-vs-jump transcript scrolling.
- [x] **P11a · Interactive message selection** — preserve exact message text while
  adding subtly actionable English words with one roving tab stop per message, mobile
  long-press/synthetic-click fencing, one desktop anchored toolbar/mobile bottom
  sheet, DeepL translation, exact `/api/phrases` saving, stale-response fencing,
  mixed-script preservation, and distinct 500/240-character limits.
- [x] **P11b · Visual and accessibility pass** — align chat surfaces with the site
  theme, improve light-theme control/action contrast, provide >=44px chat targets,
  compact the signed-in mobile header, add a compact no-scroll composer plus
  full-screen editor, remove the textarea's inner focus frame, and verify desktop/
  mobile overflow and focus.

- [x] **P12 · Authenticated preview read smoke** — the published application used
  the provider-backed `list_vocabulary` path for latest ten/all available and
  category `To Learn`; each returned the account's two matching entries and no
  user-data mutation was performed.
- [ ] **P12a · Extended cloud smoke** — traverse more than ten entries through
  pagination/cross-turn continuation, then verify proposal Confirm/Cancel and
  interruption/replay without duplicate mutation after an authorized deployment.
- [x] **P13 · Final local verification/review** — rerun production build, full test,
  typecheck, lint, diff check, mixed proposal/lifecycle/route/tool/prompt/schema/
  migration/budget/UI suites, controlled 1280px/390px grouped-card checks, and
  independent P0/P1 review on the resource-first exact diff. Earlier 598/598 and
  25-turn results remain baseline evidence only.
- [ ] **P14 · Release decision** — assign spend/alerts/retention/key-rotation
  ownership, then obtain explicit production migration/deployment authorization.

## Open Product and Technical Decisions

- “Latest” is the most recent activation: reactivation from `pick` refreshes
  progress `created_at`; active duplicates retain their existing recency.
- Final direct target/meaning UX, editable translation/meaning selection, and
  Library/Practice launch remain deferred. Selection translation and exact-text
  saving are now in scope.
- Proposal requests may use natural language and bounded canonical history; only
  unambiguous owner-visible targets become canonical values shown inline. Explicit
  ambiguity is an error, and the stored proposal plus learner confirmation is the
  approval boundary. Persisted values still preserve exact NFC/case/compatibility
  literals. Broader intent-language quality remains a prompt/model concern.
- Meaning actions are validated against the final normalized output set for each
  phrase. Cross-action additions/updates that would converge on one saved meaning
  reject the whole proposal as `conflicting_changes` before any write.
- Guest AI, fallback models, model-allowlist governance, spend ownership, retention,
  observability thresholds, and resumable/background streams remain deferred.

## Key Risks

- Model intent is not an authorization boundary. Hard safety comes from server
  identity, strict schemas, immutable owner-scoped proposal arguments, explicit
  learner confirmation, category/meaning CAS, atomic postconditions, and receipts.
- A proposal from a failed or interrupted origin attempt is hidden and
  unconfirmable. The attempt must terminalize promptly so the learner can continue;
  confirmation ambiguity on a valid complete-origin proposal must resolve through
  the durable proposal/receipt before any retry.
- Corrected migration 0017 deterministically merges historical owner-custom
  ASCII-`NOCASE` duplicates, preserves duplicate meaning translation/context/latest
  update metadata, and rehomes progress, examples, videos, and chat references.
  Preview has an older applied 0017, but `c970f80` recorded zero duplicates before
  its deployment, so the current preview is explicitly accepted as behaviorally
  equivalent and needs no corrective migration. Preview 0019/0020, configured
  provenance backfill, pending-chat index, and clean foreign keys are verified.
- The runtime intentionally rejects presets and unlisted models; the
  concrete model, local-tool-only serialization, disabled plugins, and privacy
  plus parameter-support fences must remain covered. Preset response-cache settings
  are gone; DeepSeek prompt caching is automatic. Cloudflare `edgeAggregate` rate
  limiting is per-location/eventually consistent, so provider-side budget controls
  and monitoring still own spend risk.

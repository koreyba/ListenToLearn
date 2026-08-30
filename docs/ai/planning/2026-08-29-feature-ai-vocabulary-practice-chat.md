---
phase: planning
title: AI Vocabulary Practice Chat Plan
description: Delivery status for the chat-only vocabulary-agent revision
---

# AI Vocabulary Practice Chat Plan

## Current Status

The chat-only backend and responsive chat workspace are implemented locally. Fresh
2026-08-30 exact-diff evidence passes full `npm test` 564/564 (including the
production build), typecheck, and lint with zero errors plus three existing warnings.
Focused proposal/lifecycle/bulk/budget/UI suites and controlled 1280px/390px card
verification are green. Earlier browser verification covers desktop/light/dark,
narrow mobile, chat drawer/switching, drafts, mixed-language selection, actionable
English words, current-selection translate/add, and compact/expanded composer
behavior. Prior backend commit `8f671288` is pushed; its PR #32 CodeQL, Analyze,
Sonar, and Workers checks are green. Preview 0020 is applied with configured provenance columns backfilled,
the pending-chat index present, and foreign keys clean. Authenticated provider-
backed preview requests for latest ten/all available and `To Learn` each returned
the account's two matching entries without mutating user data. No production deployment is claimed;
manual >10 cross-turn traversal, write/replay, operational ownership, and production
authorization remain open.

The approved follow-up is implemented and locally verified: immediate agent writes
and the literal-command regex boundary are replaced by durable inline proposals,
learner confirmation, and a true atomic 1–10 entry bulk operation. Direct selection
Add remains immediate; the six-tool/two-call limits remain unchanged. No deployment
is authorized.

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
- [x] **P04 · Confirmation-gated agent writes** — the exact six-tool registry
  contains two reads and four proposal tools. Natural references resolve through
  bounded canonical context; the model can only persist an immutable proposal.
  Category and meaning proposals resolve exact owner-visible entities and capture
  owner-scoped CAS values; only the learner's later Confirm executes the write.
- [x] **P05 · Category-safe domain plans** — new/`pick` add initializes `to_learn`;
  entry/meaning writes preserve active category, while only the explicit category
  plan changes it through owner-scoped CAS. Preset legacy data is immutable and
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
  Migration 0020 records configured provider/model before generation separately
  from terminal provider/actual response model and sanitized routed-provider
  telemetry.
- [x] **P07 · Tool-call ledger** — canonical bounded args/result, hash, status,
  safe error, attempt/provider-call identity, and records for reads/rejections too.
- [x] **P08 · Atomic mutation receipts** — unique
  `(userMessageId, operation, targetKey)` receipt, guarded D1 batch with domain
  statements and terminal call result, then receipt/stale/CAS recovery after an
  error. The mutation batch is never blindly retried; unclassified failure becomes
  `operation_failed`. Persistence/canonical args retain NFC literals; entry keys use
  NFC/whitespace cleanup and SQLite-compatible ASCII casefold without NFKC folding,
  leaving compatibility forms and Unicode case variants distinct by contract.
- [x] **P09 · Bounded orchestration** — two tool calls, five model steps, tools
  disabled on the final step, and a provider-adapter pre-trace fence that rejects
  call three onward without D1 queries. Same-step calls serialize before shared
  limit/circuit checks; a failed or thrown proposal opens the circuit, so no later
  queued provider tool reaches D1. Exact generation envelopes are 35 for two reads,
  40 for two cold proposals, 42 with one ambiguous proposal commit, 32 for proposal
  rollback/circuit, 34 for rollback plus ambiguous terminal failure, and 37 for a
  meaning-update proposal rollback plus ambiguous terminal failure. Confirming a
  bulk proposal costs 10 statements including auth/user refresh for both one and
  ten entries; maximum create-chat recovery remains 49/50.
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
  tool payloads/results, credentials, or provider bodies; configured and actual
  model provenance remain distinct.
- [x] **P09d · Auth migration isolation** — ordinary `ensureUser` stays cheap;
  atomic idempotent legacy-owner transfer runs only on login/session bootstrap.
- [x] **P10 · Versioned prompt and SRP tools** — prompt path
  `lib/ai-chat/prompts/vocabulary-practice.ts` exposes ID
  `unmumble.vocabulary-practice`/version `2` and reports that identity in safe
  events. Six vocabulary tools are split into contracts/results/handlers/registry/
  pagination; `vocabulary-tools.ts` is a thin facade and every active tool shares
  one traced budget wrapper. The legacy literal parser is not registered on the
  provider path.

## Remaining Gates

- [x] **P15 · Durable inline write approval** — add immutable owner-scoped proposal
  payloads with guarded terminal states; change all four model mutation tools to
  proposals; replace singular entry add with set-based atomic 1–10 bulk; expose only
  sanitized proposal DTOs; render accessible inline Confirm/Cancel cards; execute
  confirmation from stored arguments without a second model call; cover replay,
  races, cancellation, stale CAS, ambiguous D1 completion, owner isolation, direct
  selection-write preservation, and fresh sub-50 D1 statement envelopes. The UI
  safely defaults an older chat DTO without `writeProposals` to an empty list.

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
- [x] **P13 · Final local verification/review** — the current exact diff passes
  production build, full `npm test` 564/564, typecheck, and lint with zero errors
  plus three existing warnings. Focused proposal, lifecycle, route, tool, prompt,
  schema/migration, bulk, budget, and UI suites are green. Controlled 1280px/390px
  card verification confirms 44px actions, disclosure, and no horizontal overflow.
  Independent exact-diff review found no P0/P1.
- [ ] **P14 · Release decision** — assign spend/alerts/retention/key-rotation
  ownership, then obtain explicit production migration/deployment authorization.

## Open Product and Technical Decisions

- “Latest” currently means first progress `created_at`; whether re-activation should
  move an item to the front needs a product/data-model decision.
- Final direct target/meaning UX, editable translation/meaning selection, and
  Library/Practice launch remain deferred. Selection translation and exact-text
  saving are now in scope.
- Proposal requests may use natural language and bounded canonical history; the
  exact canonical values shown inline, not regex/literal matching, are the approval
  boundary. Persisted values still preserve exact NFC/case/compatibility literals.
  Broader intent-language quality remains a prompt/model concern.
- Guest AI, fallback models, model-allowlist governance, spend ownership, retention,
  observability thresholds, and resumable/background streams remain deferred.

## Key Risks

- Model intent is not an authorization boundary. Hard safety comes from server
  identity, strict schemas, immutable owner-scoped proposal arguments, explicit
  learner confirmation, category/meaning CAS, atomic postconditions, and receipts.
- A committed proposal can outlive a failed provider response by design, but cannot
  mutate vocabulary until confirmed. Confirmation ambiguity must resolve through
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

---
phase: planning
title: AI Vocabulary Practice Chat Plan
description: Delivery status for the chat-only vocabulary-agent revision
---

# AI Vocabulary Practice Chat Plan

## Current Status

The chat-only backend is implemented locally. Fresh exact-diff evidence passes the
focused backend suite 219/219, full `npm test` 503/503, typecheck, Drizzle, audit,
lifecycle/diff/secret/ignore checks, and lint with zero errors plus three existing
warnings. Independent final review found no P0/P1. The concrete-model serializer
passes, and a live direct OpenRouter smoke returned a DeepSeek `list_vocabulary`
tool call. Read-only preview evidence confirms 0019 applied, its pending-chat index
present, foreign keys clean, and only 0020 pending. The zero-duplicate preflight in
`c970f80` makes preview behaviorally equivalent to corrected 0017. No deployment is
claimed; commit/push/rebuild, preview 0020/checks, authenticated updated-preview
smoke, operational ownership, and production authorization remain open.

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
- [x] **P04 · Explicit writes** — add entry, add meaning, update meaning, and
  `set_vocabulary_category` use strict schemas, server identity, and current-turn
  literal commands. Category changes require the exact resolved entry and canonical
  destination and never infer mastery. Update/category plans use owner-scoped CAS;
  quoted punctuation, case, compatibility characters, negation, and revocation are
  handled deterministically.
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
- [x] **P05b · Single traced provider path** — the unused `/api/ai/translate`
  surface is removed. DeepL `/api/translate` remains trainer-only; a future chat
  translation capability is deferred until it can reuse the traced AI runner.
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
  limit/circuit checks; a failed or thrown mutation opens the circuit, so no later
  queued provider tool reaches D1. Exact generation envelopes are 35 for two reads,
  43 for two writes, 45 for an ambiguous write, 36 for rollback/circuit, 38 for
  rollback plus ambiguous terminal failure, and 41 for legacy rollback plus
  ambiguous terminal failure (also under concurrent duplicate call); maximum
  create-chat recovery remains 49/50.
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
  `unmumble.vocabulary-practice`/version `1` and reports that identity in safe
  events. Six vocabulary tools are split into contracts/policy/results/handlers/
  registry/pagination; `vocabulary-tools.ts` is a thin facade and every tool shares
  one traced budget wrapper.

## Remaining Gates

- [ ] **P12 · Authenticated manual smoke** — deterministic latest five, request
  all/category pagination and cross-turn continuation, search/select/practise,
  explicit add/add-meaning/update/category change, ambiguous-write denial,
  autonomous-category denial, retry/replay, and reload. Partial evidence: earlier
  preview New Chat passed; direct OpenRouter now proves DeepSeek can select
  `list_vocabulary`, but not that the app executed the tool against owned D1 data.
- [x] **P13 · Final local verification/review** — focused 219/219, full `npm test`
  503/503, typecheck, Drizzle, audit, lifecycle/diff/secret/ignore checks, and lint
  (zero errors, three existing warnings) pass; independent review found no P0/P1.
- [ ] **P14 · Publish and release decision** — commit/push and rebuild preview,
  apply/verify preview 0020, run authenticated updated-preview smoke, assign spend/
  alerts/retention/rotation ownership, then obtain explicit production migration/
  deployment authorization.

## Open Product and Technical Decisions

- “Latest” currently means first progress `created_at`; whether re-activation should
  move an item to the front needs a product/data-model decision.
- Final direct target/meaning UX, click translation, and Library/Practice launch are
  intentionally unresolved after simplifying to chat-only.
- Current explicit-write recognition is bounded Russian/English heuristics. Command
  syntax may ignore case, but persisted values require exact NFC/case/compatibility
  literals; quotes preserve meaningful terminal punctuation, and revocation is only
  leading or punctuation-delimited trailing command language. Supported languages
  and future confirmation UX remain open.
- Guest AI, fallback models, model-allowlist governance, spend ownership, retention,
  observability thresholds, and resumable/background streams remain deferred.

## Key Risks

- Model intent is not an authorization boundary. Hard safety comes from server
  identity, current-message literal checks, strict schemas, owner-scoped category/
  meaning CAS, attempt fencing, atomic postconditions, and receipts. The category
  tool expands capability but not autonomous authority.
- A committed write can outlive a failed provider response by design. Retry must
  replay the receipt rather than attempt compensating deletion or another mutation.
- Corrected migration 0017 deterministically merges historical owner-custom
  ASCII-`NOCASE` duplicates, preserves duplicate meaning translation/context/latest
  update metadata, and rehomes progress, examples, videos, and chat references.
  Preview has an older applied 0017, but `c970f80` recorded zero duplicates before
  its deployment, so the current preview is explicitly accepted as behaviorally
  equivalent and needs no corrective migration. Preview 0019/index and clean
  foreign keys are verified; 0020 remains the only pending preview migration.
- The runtime intentionally rejects presets and unlisted models; the
  concrete model, local-tool-only serialization, disabled plugins, and privacy
  plus parameter-support fences must remain covered. Preset response-cache settings
  are gone; DeepSeek prompt caching is automatic. Cloudflare `edgeAggregate` rate
  limiting is per-location/eventually consistent, so provider-side budget controls
  and monitoring still own spend risk.

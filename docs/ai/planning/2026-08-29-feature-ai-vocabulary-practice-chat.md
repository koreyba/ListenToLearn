---
phase: planning
title: AI Vocabulary Practice Chat Plan
description: Delivery status for the chat-only vocabulary-agent revision
---

# AI Vocabulary Practice Chat Plan

## Current Status

The chat-only backend and current-diff review are complete locally. Production build
plus 466/466 tests, typecheck, full lint, Drizzle check, lifecycle lint, and diff
check pass. Preview contains an older applied 0017 and 0018; the corrected 0017
requires re-baseline/acceptance, and preview application of new migration 0019 is
not claimed. Authenticated live-provider smoke remains open.

## Implemented

- [x] **P01 · Chat-only surface** — chat list, `New Chat`, timeline, composer,
  send/retry, loading/error states; target/meaning/status controls and preselection
  entry points removed.
- [x] **P02 · Deterministic opening** — new chat reads the owner's latest five by
  progress creation time plus phrase-ID tie-breaker and persists a bounded complete
  assistant offer without a user row or model call; model history receives it only
  inside escaped `UNTRUSTED_VOCABULARY_OPENING` markers.
- [x] **P03 · Vocabulary reads** — bounded latest `N` (default 5, max 10) and search
  (default/max 10) across text, legacy translation, and owner-isolated personal
  translations; compact results stay within 7,800 JSON characters with explicit
  meaning/detail truncation metadata. Search input is capped at 48 characters and
  the escaped `LIKE` pattern at 50 UTF-8 bytes.
- [x] **P04 · Explicit writes** — add entry, add meaning, and update personal
  meaning use strict schemas, server identity, current-turn direct-command/literal
  checks, and no status input/tool. Update additionally requires the old translation
  and entry text, then owner/phrase/meaning/old-value CAS; stale state is a traced
  `mutation_conflict`.
- [x] **P05 · Status-safe domain plans** — new/`pick` add initializes `to_learn`,
  active states remain unchanged, preset legacy data is immutable, personal
  meanings are normalized and owner scoped. Every new user translation is personal;
  guarded updates promote historical owner-custom legacy meanings to personal rows.
  Manual preset `PATCH` stores fallback translation personally and batches it
  atomically with the requested status.
- [x] **P05a · Compatibility context** — one atomic whole-array target `PATCH`
  supports bounded saved/ad-hoc targets and all three meaning modes; the account
  translation fallback remains server-side while both controls stay out of the UI.
- [x] **P06 · Immutable attempts** — distinct numbered attempt identity per retry,
  one pending lease per chat enforced by migration 0019, stale-turn repair,
  status-plus-expiry fencing for assistant/tools/receipts, history-before-current-
  turn replay, immutable per-turn practice snapshots, and fresh-ID recovery from
  ambiguous committed begin/retry batches.
- [x] **P07 · Tool-call ledger** — canonical bounded args/result, hash, status,
  safe error, attempt/provider-call identity, and records for reads/rejections too.
- [x] **P08 · Atomic mutation receipts** — unique
  `(userMessageId, operation, targetKey)` receipt, guarded D1 batch with domain
  statements and terminal call result, then receipt/stale/CAS recovery after an
  error. The mutation batch is never blindly retried; unclassified failure becomes
  `operation_failed`. Entry keys use SQLite-compatible ASCII casefold, leaving
  Unicode case variants distinct by contract.
- [x] **P09 · Bounded orchestration** — two tool calls, five model steps, tools
  disabled on the final step, and a provider-adapter pre-trace fence that rejects
  call three onward without D1 queries. Current statement envelopes are 34, 42,
  44, 45, and 47 for maximum reads, cold writes, ambiguous commit, rollback, and
  rollback plus ambiguous commit; maximum create-chat recovery is 49/50.
- [x] **P09a · Bounded public transport** — 100 chats per account/list, latest 200
  detail messages, 40/32,000 model history, explicit public DTOs, provider-stream
  allowlisting, and stable `provider_rate_limited` mapping.
- [x] **P09b · Auth migration isolation** — ordinary `ensureUser` stays cheap;
  atomic idempotent legacy-owner transfer runs only on login/session bootstrap.
- [x] **P10 · Fresh repository verification** — rerun full tests/build, typecheck,
  full lint, lifecycle lint, docs diff check, and current-diff final review.

## Remaining Gates

- [ ] **P12 · Authenticated manual smoke** — deterministic latest five, request
  latest ten, search/select/practise, explicit add/add-meaning/update-meaning,
  ambiguous-write denial, unchanged active statuses, retry/replay, and reload.
  Partial evidence: branch-preview New Chat creation and the deterministic opening
  with all available latest vocabulary passed. The provider-backed continuation is
  blocked by the observed OpenRouter usage limit before tool execution.
- [x] **P13 · Final review refresh** — ownership, current-turn authorization, prompt data,
  status invariants, attempt fencing, receipt conflicts, logging/privacy,
  accessibility, responsive shell, and intended diff.
- [ ] **P14 · Release decision** — accept/re-baseline corrected 0017, approve 0018/
  0019, provider secret, production model/cost controls/monitoring, deployment, and
  post-deploy smoke.

## Open Product and Technical Decisions

- “Latest” currently means first progress `created_at`; whether re-activation should
  move an item to the front needs a product/data-model decision.
- Final direct target/meaning UX, click translation, and Library/Practice launch are
  intentionally unresolved after simplifying to chat-only.
- Current explicit-write recognition is bounded Russian/English heuristics plus
  literal-value checks; supported languages and future confirmation UX are open.
- Guest AI, production model/fallback, rate/spend policy, retention, observability
  thresholds, and resumable/background streams remain deferred.

## Key Risks

- Model intent is not an authorization boundary. Hard safety comes from server
  identity, current-message literal checks, strict schemas, missing status tool,
  owner-scoped SQL, attempt fencing, atomic postconditions, and receipts.
- A committed write can outlive a failed provider response by design. Retry must
  replay the receipt rather than attempt compensating deletion or another mutation.
- Corrected migration 0017 deterministically merges historical owner-custom
  ASCII-`NOCASE` duplicates, preserves duplicate meaning translation/context/latest
  update metadata, and rehomes progress, examples, videos, and chat references.
  Preview has an older applied 0017, so re-baseline or an accepted forward path is
  a release blocker; preview 0019 application remains unverified.

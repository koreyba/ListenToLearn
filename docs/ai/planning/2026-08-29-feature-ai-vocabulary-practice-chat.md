---
phase: planning
title: AI Vocabulary Practice Chat Plan
description: Delivery status for the chat-only vocabulary-agent revision
---

# AI Vocabulary Practice Chat Plan

## Current Status

The review-fixed chat-only revision is present in the current diff. The latest full
repository gate passes 439/439 with the production build, and typecheck passes.
Full lint passes with zero errors and two warnings in generated
`worker-configuration.d.ts`. Requirements and lifecycle docs describe the
implemented contracts. Final review closure and authenticated live-provider smoke
remain open; preview migrations 0017/0018 have not been applied.

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
  meanings are normalized and owner scoped. Manual preset `PATCH` stores fallback
  translation personally and batches it atomically with the requested status.
- [x] **P05a · Compatibility context** — one atomic whole-array target `PATCH`
  supports bounded saved/ad-hoc targets and all three meaning modes; the account
  translation fallback remains server-side while both controls stay out of the UI.
- [x] **P06 · Immutable attempts** — distinct numbered attempt identity per retry,
  one pending lease, status-plus-expiry fencing for assistant/tools/receipts,
  history-before-current-turn replay, immutable per-turn practice snapshots, and
  fresh-ID recovery from ambiguous committed begin/retry batches.
- [x] **P07 · Tool-call ledger** — canonical bounded args/result, hash, status,
  safe error, attempt/provider-call identity, and records for reads/rejections too.
- [x] **P08 · Atomic mutation receipts** — unique
  `(userMessageId, operation, targetKey)` receipt, guarded D1 batch with domain
  statements and terminal call result, replay/conflict/race recovery, one safe
  pre-execution retry, then `operation_failed` on an unexplained double failure.
  Entry keys use SQLite-compatible ASCII casefold, leaving Unicode case variants
  distinct by contract.
- [x] **P09 · Bounded orchestration** — two tool calls, five model steps, tools
  disabled on the final step, and a provider-adapter pre-trace fence that rejects
  call three onward without D1 queries; instrumented cold full-turn envelopes are
  45 statements for two worst-case new-entry writes and 47 with one ambiguous
  committed-write recovery, below the Free-plan 50-query limit.
- [x] **P10 · Repository verification** — latest full suite/build passes 439/439;
  typecheck, full lint, lifecycle feature lint, and docs diff checks pass.

## Remaining Gates

- [ ] **P12 · Authenticated manual smoke** — deterministic latest five, request
  latest ten, search/select/practise, explicit add/add-meaning/update-meaning,
  ambiguous-write denial, unchanged active statuses, retry/replay, and reload.
- [ ] **P13 · Final review** — ownership, current-turn authorization, prompt data,
  status invariants, attempt fencing, receipt conflicts, logging/privacy,
  accessibility, responsive shell, and intended diff.
- [ ] **P14 · Release decision** — approve migrations 0017/0018, provider secret,
  production model/cost controls/monitoring, deployment, and post-deploy smoke.

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
- Migration files are append-only. Migration 0017 now deterministically merges
  historical owner-custom ASCII-`NOCASE` duplicates and rehomes progress, meanings,
  examples, videos, and chat references before adding uniqueness. Unicode case
  variants stay distinct. Preview preflight is clean, but 0017/0018 remain unapplied.

---
phase: monitoring
title: AI Vocabulary Practice Chat Monitoring
description: Required privacy-safe signals for attempts, tools, receipts, and spend
---

# AI Vocabulary Practice Chat Monitoring

## Current State

No production dashboard, alert, or deployment is claimed. The code now emits an
exact allowlist of structured generation start/completion/failure and rate-limit
rejection events. Wrangler configuration enables logs at full head sampling and
traces at 10% for production configuration, with full logs/traces in preview; these
are configuration facts, not deployed-state evidence. The durable D1 ledger is an
execution/audit boundary, not a substitute for aggregated operational metrics.
Fresh exact-diff automated/static checks pass (219/219 focused, 503/503 full, zero
lint errors with three existing warnings), and independent review found no P0/P1;
alert thresholds, spend ownership, retention, and key-rotation ownership remain
release decisions.

## Implemented Safe Signals

- `ai_chat_generation_started`: attempt ID, configured provider, and configured
  model, prompt ID, and prompt version.
- `ai_chat_generation_completed`: attempt ID, terminal provider adapter, and actual
  response model plus prompt ID/version.
- `ai_chat_generation_failed`: attempt ID, stable error code, and prompt ID/version
  once prompt construction has completed.
- `ai_chat_generation_rejected`: stable rate-limit/internal error code before turn
  creation.

Unknown events/fields are not emitted, unsafe identifiers normalize to `unknown`,
and an event-sink failure cannot fail a generation. Migration 0020 also persists
configured provider/model on each attempt separately from terminal provider/model
and sanitized routed-provider telemetry.

## Required Signals

- Aggregate the implemented generation lifecycle events into counts and failure
  rates. Add latency, cancellation, token totals, and OpenRouter-reported
  cost/upstream-cost totals without expanding the event privacy boundary.
- Compare configured model with terminal actual response model and sanitized routed-
  provider names. Runtime integrity checks should confirm the concrete code-owned
  DeepSeek model, absent preset/fallback fields, disabled provider plugins, only
  local registered tools, and `data_collection: deny`, ZDR, plus
  `require_parameters: true`. The preset response cache is intentionally absent;
  DeepSeek prompt-prefix caching is automatic and has no application toggle.
- Group generation outcomes by allowlisted prompt ID/version
  (`unmumble.vocabulary-practice`/`1`) and alert on `unknown`; never log prompt text.
- Cloudflare generation-limit outcomes for 10 requests per account/minute and 100
  aggregate requests per Cloudflare location/minute, including account/edge denial
  and missing/erroring binding. The limiter fails closed before D1 turn creation/
  provider work, but is location-local and eventually consistent: an approximate
  abuse guard rather than a globally atomic quota or billing ledger.
- Attempt outcomes (`complete`, `failed`, `expired`), lease age, retries per
  assistant message, `turn_in_progress`, more than one pending attempt per chat, any
  pending attempt surviving the 30-second lease, and terminal assistant/tool/receipt
  writes rejected because the lease expired. Distinguish ordinary failure writes
  returned directly from owner-scoped `findTurn` plus the successful batch from
  `finishTurn`/`failTurn` ambiguity or postcondition races recovered by exact
  terminal-state readback.
- Tool calls by name and terminal status (`succeeded`, `committed`, `replayed`,
  `rejected`, `failed`), tool-budget exhaustion, stale-attempt rejection, and
  tool-call identity conflict. Track calls-per-turn against the hard limit of two
  and adapter-level pre-trace rejections from call three onward; these rejections have
  no ledger row. Track serialized same-step queue/circuit rejection after a failed
  or thrown mutation separately; the rejected queued call also has no ledger row or
  D1 work. Track D1 query usage/headroom against the Free-plan 50-query invocation
  allowance and the measured generation envelopes: 35 maximum reads, 43 cold
  writes, 45 ambiguous write, 36 rollback/circuit, 38 rollback plus ambiguous
  terminal failure, and 41 legacy rollback plus ambiguous terminal failure. The
  concurrent duplicate-write regression also remains 41; maximum create-chat
  ambiguous recovery remains exactly 49/50.
- Mutation receipt commit/replay/conflict counts by versioned operation, plus D1
  batch/postcondition failures and their receipt-recovered, stale-attempt,
  CAS-conflict, or `operation_failed` classification. There is no blind mutation-
  batch retry to monitor. A failed mutation must open the turn circuit before any
  later queued provider call reaches the traced executor.
- Category-list/search result counts and opening empty/partial counts, without
  vocabulary content; track `hasMore`, cursor validation/rejection, continuation
  reuse across turns, `meaningsTruncated`/`detailsTruncated`, and near-7,800-character
  compact results without logging cursors or payloads.
- Rejected/near-limit practice snapshots by target count and serialized size, never
  snapshot content; the hard target-data budget is 48,000 characters.
- Category-write commit/replay/conflict counts by canonical destination. Alert if a
  non-category tool changes `phrase_progress`, or if a category transition lacks a
  traced `set_vocabulary_category` receipt; never log the named entry.
- Meaning-update conflict counts split safely between authorization rejection and
  owner/phrase/meaning/old-value CAS conflict, without logging either translation.
- Account chat/list/detail near-limit counts (100/100/200) and model-history
  truncation (40/32,000), without logging titles or messages.
- Public stream dropped-chunk counts by safe chunk type and stable provider errors,
  especially `provider_rate_limited`; never log a dropped chunk payload.
- Legacy-owner bootstrap migration success/failure/rollback only on login/session,
  separately from AI generation D1 budgets.

## Privacy Boundary

Operational logs may contain correlation ID, environment, normalized configured and
routed provider/model identifiers, prompt ID/version, latency, counts, token/cost
totals, tool name, attempt number/status, versioned operation, and safe error code. They must not
contain keys/session data, prompts, messages, vocabulary, translations/contexts,
tool args/results/hashes/target keys, provider bodies, or raw metadata. Access to D1
ledger rows must follow the same account/operations controls as private vocabulary.

## Alerts and Triage

Thresholds remain an open release decision. At minimum, notify on sustained auth or
D1 failures, provider failure/timeout spike, pending attempts beyond lease, elevated
`stale_attempt`/`tool_call_conflict`/`mutation_conflict`/`operation_failed`, repeated
`turn_in_progress`, lease-fence rejection spike, D1 query usage approaching 50,
receipt-vs-domain inconsistency, an untraced category mutation, or spend approaching
its cap. Alert separately if runtime preview schema does not contain the accepted
behaviorally-equivalent 0017 state, migration 0019 per-chat index, or has foreign-
key violations. Migration 0020 configured-provenance columns remain a pre-rollout
gate while it is the only pending preview migration; alert on absence only after
its planned application.

Triage in order: verify session and D1 health; group by safe code/attempt/tool
status; inspect owner and receipt invariants without copying private payloads; stop
generation if cost/privacy/write safety is uncertain; preserve D1 history; rotate
the provider key if exposure is possible; then repeat the bounded authenticated
preview smoke before re-enabling.

## Health Verification

Owned chat list/detail and category-list/search checks validate application/D1
without a paid model call. A live direct OpenRouter smoke confirms that the concrete
DeepSeek model selects `list_vocabulary`; it does not prove authenticated route
execution, ownership, ledger writes, or cross-turn cursor continuation. A deliberate
authenticated preview smoke must still verify paginated read/continuation, denied
ambiguous/autonomous category write, one explicit receipt-backed write, retry/replay,
and reload within a fixed budget. Production automation must not perform ongoing
vocabulary writes merely as a health check.

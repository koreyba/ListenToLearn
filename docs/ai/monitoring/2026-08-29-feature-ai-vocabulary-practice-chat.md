---
phase: monitoring
title: AI Vocabulary Practice Chat Monitoring
description: Required privacy-safe signals for attempts, tools, receipts, and spend
---

# AI Vocabulary Practice Chat Monitoring

## Current State

No production dashboard, alert, or deployment is claimed. The durable D1 ledger is
an execution/audit boundary, not a substitute for aggregated operational metrics.

## Required Signals

- Chat generation count, completion/failure/cancellation, latency, token counts,
  configured model/preset, sanitized actual routed model/provider names,
  OpenRouter-reported cost/upstream-cost totals, and stable public error code.
- Attempt outcomes (`complete`, `failed`, `expired`), lease age, retries per
  assistant message, `turn_in_progress`, more than one pending attempt per chat, any
  pending attempt surviving the 30-second lease, and terminal assistant/tool/receipt
  writes rejected because the lease expired.
- Tool calls by name and terminal status (`succeeded`, `committed`, `replayed`,
  `rejected`, `failed`), tool-budget exhaustion, stale-attempt rejection, and
  tool-call identity conflict. Track calls-per-turn against the hard limit of two
  and adapter-level pre-trace rejections from call three onward; these rejections have
  no ledger row. Track D1 query usage/headroom against the Free-plan 50-query
  invocation allowance and the measured envelopes: 34 maximum reads, 42 cold
  writes, 44 ambiguous commit, 45 rollback, 47 rollback plus ambiguous commit, and
  49/50 maximum create-chat ambiguous recovery.
- Mutation receipt commit/replay/conflict counts by versioned operation, plus D1
  batch/postcondition failures and their receipt-recovered, stale-attempt,
  CAS-conflict, or `operation_failed` classification. There is no blind mutation-
  batch retry to monitor.
- Latest/search result counts and opening empty/partial counts, without vocabulary
  content; count `meaningsTruncated`/`detailsTruncated` and near-7,800-character
  compact results without logging their payloads.
- Rejected/near-limit practice snapshots by target count and serialized size, never
  snapshot content; the hard target-data budget is 48,000 characters.
- A status-invariant guard: agent writes must not transition an already active
  phrase; investigate any correlated `phrase_progress` transition.
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
routed provider/model identifiers, latency, counts, token/cost totals, tool name,
attempt number/status, versioned operation, and safe error code. They must not
contain keys/session data, prompts, messages, vocabulary, translations/contexts,
tool args/results/hashes/target keys, provider bodies, or raw metadata. Access to D1
ledger rows must follow the same account/operations controls as private vocabulary.

## Alerts and Triage

Thresholds remain an open release decision. At minimum, notify on sustained auth or
D1 failures, provider failure/timeout spike, pending attempts beyond lease, elevated
`stale_attempt`/`tool_call_conflict`/`mutation_conflict`/`operation_failed`, repeated
`turn_in_progress`, lease-fence rejection spike, D1 query usage approaching 50,
receipt-vs-domain inconsistency, an active-status mutation, or spend approaching
its cap. Alert separately if runtime preview schema does not contain the accepted
corrected-0017 baseline and migration 0019 per-chat index.

Triage in order: verify session and D1 health; group by safe code/attempt/tool
status; inspect owner and receipt invariants without copying private payloads; stop
generation if cost/privacy/write safety is uncertain; preserve D1 history; rotate
the provider key if exposure is possible; then repeat the bounded authenticated
preview smoke before re-enabling.

## Health Verification

Owned chat list/detail and latest/search checks validate application/D1 without a
paid model call. A deliberate authenticated provider smoke must verify read tool,
denied ambiguous write, one explicit receipt-backed write, interruption/replay, and
reload within a fixed budget. Production automation must not perform ongoing
vocabulary writes merely as a health check.

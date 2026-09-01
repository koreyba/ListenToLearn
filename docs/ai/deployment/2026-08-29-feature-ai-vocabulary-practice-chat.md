---
phase: deployment
title: AI Vocabulary Practice Chat Deployment
description: Preview rollout state for chat tools, uniqueness, attempts, and receipts
---

# AI Vocabulary Practice Chat Deployment

## Current State

Backend commit `8f671288` is pushed to PR #32; CodeQL, Analyze, Sonar, and Workers checks are
green and the branch preview is current. Preview migration 0020 is applied:
`configured_provider` and `configured_model` are present/backfilled, the one-
pending-attempt-per-chat index is present, and `PRAGMA foreign_key_check` is clean.
The `c970f80` zero-duplicate preflight still makes preview's older 0017 behaviorally
equivalent to corrected 0017; fresh production will run corrected 0017. An
authenticated provider-backed preview smoke requested the latest ten/all available
and category `To Learn`; both responses returned the account's two matching entries,
with no user-data mutation. No production code
deploy, production migration, or production secret change is claimed.

The 2026-08-31 stability/removal follow-up passes local `npm test` 598/598,
typecheck, diff check, and lint with zero errors plus three existing warnings. Its
real-model 25-turn local smoke completed every turn and all expected Confirm/Cancel
flows with clean terminal D1 state. This revision is authorized for the PR #32
preview only; current-revision preview checks and authenticated smoke remain a gate.

## Configuration

- `OPENROUTER_API_KEY`: Cloudflare Worker secret, never a committed var.
- `OPENROUTER_MODEL`: committed non-secret concrete model ID
  `deepseek/deepseek-v4-flash-0731`. Runtime rejects preset/unlisted IDs, disables
  provider plugins, requires data-collection denial, ZDR, and full request-parameter
  support, and serializes only locally registered AI SDK tools. Preset response
  caching is no longer configured; DeepSeek prompt caching remains automatic and
  requires no application setting.
- Prompt contract: `lib/ai-chat/prompts/vocabulary-practice.ts`, ID
  `unmumble.vocabulary-practice`, version `7`; ID/version are allowlisted operational
  metadata, while prompt text remains private.
- `AI_CHAT_USER_RATE_LIMITER`: 10 authenticated generation requests/minute per
  SHA-256 account key; `AI_CHAT_EDGE_AGGREGATE_RATE_LIMITER`: approximate aggregate
  100/minute per Cloudflare location. Cloudflare counters are location-local and
  eventually consistent, not globally atomic. Missing/error bindings fail closed.
- Local `.dev.vars*` remains ignored. Secrets must not enter browser bundles, D1,
  trace tables, URLs, public errors, or logs.

Missing provider configuration preserves chats and returns `not_configured` before
paid inference.

## Migration Plan

Apply migrations in order after a normal backup/checkpoint:

1. `0016`: chat, targets, messages, and personal meanings.
2. `0017`: choose the earliest per-owner ASCII-`NOCASE` custom phrase as canonical;
   merge historical duplicates and transfer progress, meanings, examples, saved
   video origins, and chat phrase/selected-meaning references before creating the
   unique index. Duplicate meaning collapse preserves non-empty translation/context
   and latest-update metadata. Unicode case variants intentionally remain distinct.
3. `0018`: assistant attempts, tool-call ledger, and mutation receipts.
4. `0019`: repair duplicate pending attempts, fail their orphaned assistant rows,
   and enforce one pending attempt per chat.
5. `0020`: add and backfill configured provider/model provenance for immutable
   assistant attempts.

Preview already executed an older 0017 body, but its pre-deployment zero-duplicate
preflight in `c970f80` proves that the corrected merge had no data to transform. The
current preview is therefore explicitly accepted as behaviorally equivalent; do
not create a re-baseline or forward migration solely for 0017 there. This exception
does not change the fresh-production sequence: production must run the corrected
0017, then 0018–0020 in order. Preview has now applied 0020 and verified foreign
keys, the per-chat pending-attempt index, and configured-provenance columns/backfill.

## Release Gates

- [x] Fresh exact-diff full `npm test` passes 598/598, including the production
  build; earlier focused backend evidence passes 219/219.
- [x] Typecheck, Drizzle, dependency audit, lifecycle/diff/secret/ignore checks pass;
  full lint has zero errors and three existing warnings.
- [x] Independent final review reports no P0/P1.
- [x] Preview D1 zero-duplicate preflight from `c970f80` makes its older 0017
  behaviorally equivalent to corrected 0017; no re-baseline/forward migration is
  required there.
- [x] Preview migration 0019 is applied; the per-chat pending-attempt index exists
  and `PRAGMA foreign_key_check` is clean.
- [x] Backend commit `8f671288` is pushed, the PR preview is current, and PR #32 CodeQL,
  Analyze, Sonar, and Workers checks are green.
- [x] Preview migration 0020 is applied; configured provider/model columns are
  present/backfilled, the pending-chat index remains present, and foreign keys are
  clean.
- [x] Concrete code-allowlisted DeepSeek model, privacy/local-tool fence, and
  10/account plus approximate 100/location per-minute edge abuse limits are explicit
  in deployment configuration.
- [x] Instrumented generation envelopes are 35/40/42/32/34/37 statements for the
  documented read/write/ambiguity/rollback cases; serialized concurrent legacy
  rollback remains 37, and maximum-size create recovery is the exact 49/50 maximum.
- [x] Direct live OpenRouter smoke confirms DeepSeek can select the locally declared
  `list_vocabulary` schema; this is not application smoke.
- [ ] Spend cap ownership, alerts, retention, and rotation owner are approved.
- [x] Authenticated preview smoke covers deterministic New Chat creation and its
  latest-vocabulary opening without a provider call.
- [x] Authenticated provider-backed preview smoke requested latest ten/all available
  entries and category `To Learn`; each response returned the account's two matching
  entries without user-data mutation.
- [x] Authenticated local real-model smoke completed 25/25 turns, including bulk
  add/remove/move, Confirm/Cancel, mixed-language input, and fresh post-mutation
  reads; D1 recorded zero failed/pending attempts and proposals.
- [ ] Push this stability/removal revision to PR #32, wait for its checks and branch
  preview, then run an authenticated preview write/read smoke.
- [ ] Manually verify pagination/cross-turn continuation with more than ten entries.
- [ ] Manually verify explicit write denial/commit and interruption/replay without
  duplicate mutation.
- [ ] Production deployment and remote production migrations receive explicit
  authorization.

## Rollout and Rollback

Deploy through the existing Worker pipeline; Vercel hosting is not required.
Observe attempt/tool/receipt error and spend signals during a limited authenticated
preview before production. Migration application must stop before code upload on
any error, then verify the expected schema/indexes before continuing.

The ordinary auth ensure remains on account API requests, but the heavier atomic
legacy-owner transfer runs only during login/session bootstrap. Include that
bootstrap in preview verification without charging its D1 statements to an AI
generation invocation.

On unsafe ownership, write authorization/CAS, status change, receipt conflict, error
rate, latency, or spend, disable provider configuration and roll back Worker code.
Chats remain readable while generation is disabled. Keep additive migration data;
do not run destructive down migrations. Rotate the key on suspected exposure.
